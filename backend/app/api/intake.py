"""
Patient intake questionnaire and gating endpoints.

POST /sessions - Create new screening session
POST /sessions/{session_id}/intake - Submit questionnaire and get gating decision

Gating logic determines whether to proceed to walk test based on:
- Age range (40-100)
- Pain severity threshold
- Other risk factors
"""

import uuid
from datetime import datetime
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.db.models import Patient, User, get_db
from app.config import get_settings
from app.api.auth import get_current_user

router = APIRouter(prefix="/sessions", tags=["sessions"])


# Request/response models
class CreateSessionResponse(BaseModel):
    session_id: str
    created_at: datetime


class IntakeRequest(BaseModel):
    # Patient details
    full_name: str
    phone: Optional[str] = None
    address: Optional[str] = None

    # Questionnaire
    age: int
    gender: str  # "Male", "Female", "Other", "M", "F"
    morning_stiffness_minutes: Optional[int] = 0
    pain_severity: Optional[int] = 0
    pain_duration_category: Optional[str] = "none"  # "none", "weeks", "months", "years"
    prior_knee_injury: bool = False
    prior_knee_surgery: bool = False

    class Config:
        schema_extra = {
            "example": {
                "full_name": "Sunita Sharma",
                "phone": "+91 98765 43210",
                "address": "123 Main St, Mumbai",
                "age": 65,
                "gender": "Female",
                "morning_stiffness_minutes": 30,
                "pain_severity": 7,
                "pain_duration_category": "months",
                "prior_knee_injury": True,
                "prior_knee_surgery": False,
            }
        }


class GateDecision(BaseModel):
    gate_status: str  # "pass" | "fail"
    passed: bool
    reason: Optional[str] = None
    recommendation: Optional[str] = None


class ActiveSessionResponse(BaseModel):
    session_id: Optional[int] = None
    patient_id: Optional[int] = None


@router.post("/", response_model=CreateSessionResponse)
async def create_session(
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Create a new screening session.

    Returns a unique session ID that should be used for all subsequent calls.
    Note: This now creates a placeholder patient record.
    """
    print(f"DEBUG: create_session called for user_id={user.id}")

    # Create placeholder patient record
    patient = Patient(
        patient_name="Pending",  # Will be updated on intake submission
        created_at=datetime.utcnow(),
        user_id=user.id,
    )
    db.add(patient)
    db.commit()
    db.refresh(patient)

    print(f"DEBUG: Created patient with id={patient.patient_id}")
    print(f"DEBUG: About to return: session_id={str(patient.patient_id)}, created_at={patient.created_at}")

    # Return the patient_id as the session_id
    return CreateSessionResponse(session_id=str(patient.patient_id), created_at=patient.created_at)


@router.post("/{session_id}/intake", response_model=GateDecision)
async def submit_intake(
    session_id: str,
    intake: IntakeRequest,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Submit patient intake questionnaire and get gating decision.

    The gate determines whether the patient should proceed to the walk test
    or be referred directly to a healthcare provider.

    session_id is now the patient_id.
    """
    settings = get_settings()

    # Validate patient exists and belongs to current user
    patient = db.query(Patient).filter(Patient.patient_id == int(session_id)).first()
    if not patient:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Patient {session_id} not found"
        )

    # Security: only allow updating patients belonging to the current user
    if patient.user_id != user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Cannot modify patients belonging to other users"
        )

    # Update patient with intake data
    patient.patient_name = intake.full_name
    patient.age = intake.age
    patient.gender = intake.gender
    patient.symptoms = f"Pain severity: {intake.pain_severity or 0}/10, Morning stiffness: {intake.morning_stiffness_minutes or 0} min, Duration: {intake.pain_duration_category or 'none'}"
    patient.morning_stiffness_minutes = intake.morning_stiffness_minutes
    patient.pain_severity = intake.pain_severity
    patient.pain_duration_category = intake.pain_duration_category
    patient.prior_knee_injury = intake.prior_knee_injury
    patient.prior_knee_surgery = intake.prior_knee_surgery

    # Apply gating logic
    gate_passed, gate_reason = evaluate_gate(
        age=intake.age,
        pain_severity=intake.pain_severity or 0,
        morning_stiffness=intake.morning_stiffness_minutes or 0,
        injury=intake.prior_knee_injury,
        settings=settings,
    )

    # Update patient with gate result
    patient.gate_passed = gate_passed
    patient.gate_reason = gate_reason

    db.commit()

    # Build recommendation
    if gate_passed:
        recommendation = "Proceed to walk test."
    elif intake.age < settings.min_age_for_screening:
        recommendation = "You are below the recommended age for knee OA screening. Please consult a doctor for persistent symptoms."
    elif intake.age > settings.max_age_for_screening:
        recommendation = "Given your age, please consult a healthcare provider directly for comprehensive assessment."
    elif (intake.pain_severity or 0) == 0 and (intake.morning_stiffness_minutes or 0) == 0 and not intake.prior_knee_injury:
        recommendation = "No knee symptoms or injury reported. The demo walk test is not needed in this pathway right now."
    else:
        recommendation = "Your symptoms warrant direct medical evaluation. Please consult a healthcare provider."

    return GateDecision(
        gate_status="pass" if gate_passed else "fail",
        passed=gate_passed,
        reason=gate_reason,
        recommendation=recommendation,
    )


def evaluate_gate(age: int, pain_severity: int, morning_stiffness: int, injury: bool, settings) -> tuple[bool, str]:
    """
    Determine if patient passes gate to proceed to walk test.

    Gating rules:
    1. Age must be between min_age_for_screening (40) and max_age_for_screening (100)
    2. Must report at least one symptom (pain > 0, stiffness > 0, or prior injury)

    Returns:
        (passed: bool, reason: str)
    """
    # Check age range
    if age < settings.min_age_for_screening:
        return False, f"Age below minimum screening threshold ({settings.min_age_for_screening})"

    if age > settings.max_age_for_screening:
        return False, f"Age above recommended screening threshold ({settings.max_age_for_screening})"

    # Check symptoms/history
    if pain_severity <= 0 and morning_stiffness <= 0 and not injury:
        return False, "No knee pain, morning stiffness, or prior knee injury reported"

    # All checks passed
    return True, "Patient meets criteria for knee OA screening walk test"


@router.get("/active", response_model=ActiveSessionResponse)
async def get_active_session(db: Session = Depends(get_db)):
    """
    Get the most recently created session that is currently active (mid-flow).

    An active session is one where:
    - Intake has been submitted (gate_passed is not None)
    - Result has not yet been fetched (risk_level is None)

    This endpoint is used by ESP32 sensor nodes to discover the current patient_id
    for data submission. Returns null values if no active session exists.

    No authentication required (needed for hardware without stored credentials).
    """
    # Find the most recent patient that has passed intake but hasn't completed the result
    active_patient = db.query(Patient).filter(
        Patient.gate_passed.isnot(None),  # Intake submitted
        Patient.risk_level.is_(None)      # Result not yet generated
    ).order_by(Patient.patient_id.desc()).first()

    if not active_patient:
        return ActiveSessionResponse(session_id=None, patient_id=None)

    return ActiveSessionResponse(
        session_id=active_patient.patient_id,
        patient_id=active_patient.patient_id
    )

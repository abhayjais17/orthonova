"""
Patient endpoints for health workers to view their patients and screening results.

GET /patients - List all patients for the current user
GET /patients/{patient_id} - Get detailed info for one patient
"""

from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy.orm import Session
from sqlalchemy import desc

from app.db.models import Patient, User, get_db
from app.api.auth import get_current_user

router = APIRouter(prefix="/patients", tags=["patients"])


class PatientSummary(BaseModel):
    """Summary of a patient for the dashboard list."""
    id: str  # patient_id (previously session_id)
    full_name: str
    age: Optional[int] = None
    last_screened: str  # ISO datetime
    risk_level: Optional[str] = None  # "Low", "Moderate", "High"

    class Config:
        from_attributes = True


class PatientDetail(BaseModel):
    """Full details for a single patient."""
    id: str
    full_name: str
    age: Optional[int] = None
    last_screened: str  # ISO datetime
    risk_level: Optional[str] = None
    risk_score: Optional[float] = None
    explanation: Optional[str] = None
    contributing_factors: Optional[List[str]] = None
    gate_status: Optional[str] = None
    symptoms: Optional[str] = None

    class Config:
        from_attributes = True


@router.get("/", response_model=List[PatientSummary])
async def get_patients(
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Get all patients for the current logged-in health worker.

    Returns a list of patients with their latest screening result.
    """
    # Query patients belonging to this user, ordered by most recent first
    patients = (
        db.query(Patient)
        .filter(Patient.user_id == user.id)
        .filter(Patient.patient_name.isnot(None))  # Only patients with details
        .order_by(desc(Patient.created_at))
        .all()
    )

    results = []
    for patient in patients:
        results.append(
            PatientSummary(
                id=str(patient.patient_id),
                full_name=patient.patient_name or "Unknown",
                age=patient.age,
                last_screened=patient.created_at.isoformat() if patient.created_at else "",
                risk_level=patient.risk_level,
            )
        )

    return results


@router.get("/{patient_id}", response_model=PatientDetail)
async def get_patient(
    patient_id: str,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Get detailed information for a single patient.

    The patient_id is the numeric ID. Only returns patients
    belonging to the current user.
    """
    # Try exact match on patient_id
    patient = (
        db.query(Patient)
        .filter(Patient.patient_id == int(patient_id))
        .filter(Patient.user_id == user.id)
        .first()
    )

    if not patient:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Patient {patient_id} not found"
        )

    return PatientDetail(
        id=str(patient.patient_id),
        full_name=patient.patient_name or "Unknown",
        age=patient.age,
        last_screened=patient.created_at.isoformat() if patient.created_at else "",
        risk_level=patient.risk_level,
        risk_score=patient.risk_score,
        explanation=patient.explanation,
        contributing_factors=patient.contributing_factors or [],
        gate_status="pass" if patient.gate_passed else "fail" if patient.gate_passed is False else "pending",
        symptoms=patient.symptoms,
    )

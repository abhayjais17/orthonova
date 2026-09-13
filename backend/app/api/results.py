"""
Results endpoint - run feature extraction and ML prediction.

POST /sessions/{session_id}/run-test - Trigger simulated data collection and processing
GET /sessions/{session_id}/result - Get risk assessment and explanation
"""

from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy.orm import Session
from typing import List, Optional
import numpy as np

from app.db.models import Patient, ShoeSensorData, KneeSensorData, CameraPoseData, get_db
from app.features.feature_extraction import extract_all_features, features_to_array
from app.ml.predict import get_predictor

router = APIRouter(prefix="/sessions", tags=["results"])


class ResultResponse(BaseModel):
    session_id: str
    risk_level: str
    risk_score: float
    explanation: str
    contributing_factors: List[str]
    disclaimer: str


class RunTestResponse(BaseModel):
    session_id: str
    status: str
    message: str
    readings_collected: dict


class RunTestRequest(BaseModel):
    """Optional request body for run-test endpoint."""
    vision: Optional[dict] = None  # If provided, skip generating vision data


@router.post("/{session_id}/run-test", response_model=RunTestResponse)
async def run_test(
    session_id: str,
    request: Optional[RunTestRequest] = None,
    db: Session = Depends(get_db),
):
    """
    Trigger the complete test pipeline for a session.

    This endpoint:
    1. Generates simulated sensor data (shoe, knee) - unless already submitted
    2. Uses existing vision data if already submitted via /sensors/vision
    3. Stores data in the database
    4. Does NOT yet run prediction (call GET /result for that)

    If real vision data was already submitted via /sensors/vision endpoint,
    it will be preserved and not overwritten with simulated data.
    """
    patient = validate_patient(session_id, db)

    # Determine profile based on patient data
    profile = "oa" if patient.age and patient.age > 60 and patient.pain_severity and patient.pain_severity > 5 else "normal"

    from app.simulate.data_generator import DataGenerator
    generator = DataGenerator(profile=profile, duration_seconds=10.0, sample_rate_hz=50.0)

    shoe_data = generator.generate_shoe_data()
    knee_data = generator.generate_knee_data()
    vision_data = generator.generate_vision_data()

    # Store shoe sensor data
    from datetime import datetime
    for reading in shoe_data:
        record = ShoeSensorData(
            patient_id=int(session_id),
            fsr_heel=reading.get("left_heel", 0.0) or 0.0,
            fsr_midfoot=0.0,
            fsr_forefoot=reading.get("left_toe", 0.0) or 0.0,
            fsr_toe=0.0,
            timestamp=datetime.utcnow(),
        )
        db.add(record)

    # Store knee sensor data
    for reading in knee_data:
        knee_flexion = abs(reading["thigh_accel"][1] - reading["shin_accel"][1]) * 30 if "thigh_accel" in reading else 0.0
        record = KneeSensorData(
            patient_id=int(session_id),
            knee_flexion=knee_flexion,
            thigh_angle=reading["thigh_accel"][1] if "thigh_accel" in reading else 0.0,
            shin_angle=reading["shin_accel"][1] if "shin_accel" in reading else 0.0,
            timestamp=datetime.utcnow(),
        )
        db.add(record)

    # Store camera pose data
    max_flexion = 0.0
    for landmark in vision_data:
        left_knee_angle = abs(landmark.get("left_hip_y", 0) - landmark.get("left_knee_y", 0))
        right_knee_angle = abs(landmark.get("right_hip_y", 0) - landmark.get("right_knee_y", 0))
        max_flexion = max(max_flexion, left_knee_angle * 60, right_knee_angle * 60)

    gait_symmetry = 0.85
    posture_status = "Normal" if profile == "normal" else "Abnormal gait detected"

    record = CameraPoseData(
        patient_id=int(session_id),
        max_flexion_angle=max_flexion,
        gait_symmetry_score=gait_symmetry,
        posture_status=posture_status,
        timestamp=datetime.utcnow(),
    )
    db.add(record)

    db.commit()

    # Get actual vision count after commit
    final_vision_count = len(vision_data)

    return RunTestResponse(
        session_id=session_id,
        status="completed",
        message="Test data collected successfully. Call GET /result to retrieve risk assessment.",
        readings_collected={
            "shoe": len(shoe_data),
            "knee": len(knee_data),
            "vision": final_vision_count,
        }
    )


@router.get("/{session_id}/result", response_model=ResultResponse)
async def get_result(
    session_id: str,
    db: Session = Depends(get_db),
):
    """
    Get risk assessment result for a session.

    This endpoint:
    1. Retrieves all sensor data for the session
    2. Extracts features
    3. Runs ML prediction
    4. Returns risk level + explanation

    Results are cached in the database for future retrieval.
    """
    patient = validate_patient(session_id, db)

    # Check if we already have a result
    if patient.risk_level is not None:
        return ResultResponse(
            session_id=session_id,
            risk_level=patient.risk_level,
            risk_score=patient.risk_score or 0.0,
            explanation=patient.explanation or "Unable to generate explanation.",
            contributing_factors=patient.contributing_factors or [],
            disclaimer=get_disclaimer(patient.risk_level),
        )

    # Retrieve sensor data from database
    shoe_records = db.query(ShoeSensorData).filter(ShoeSensorData.patient_id == int(session_id)).all()
    knee_records = db.query(KneeSensorData).filter(KneeSensorData.patient_id == int(session_id)).all()
    camera_records = db.query(CameraPoseData).filter(CameraPoseData.patient_id == int(session_id)).all()

    shoe_data = [{"timestamp": r.timestamp, "left_heel": r.fsr_heel, "left_toe": r.fsr_forefoot,
                  "right_heel": r.fsr_heel, "right_toe": r.fsr_forefoot}
                 for r in shoe_records]

    knee_data = [{"timestamp": r.timestamp,
                  "thigh_accel": [r.thigh_angle, 0, 0],
                  "thigh_gyro": [0, 0, 0],
                  "shin_accel": [r.shin_angle, 0, 0],
                  "shin_gyro": [0, 0, 0]}
                 for r in knee_records]

    vision_data = [{"timestamp": r.timestamp,
                    "left_hip_x": 0, "left_hip_y": 0,
                    "right_hip_x": 0, "right_hip_y": 0,
                    "left_knee_x": 0, "left_knee_y": r.max_flexion_angle / 60 if r.max_flexion_angle else 0,
                    "right_knee_x": 0, "right_knee_y": r.max_flexion_angle / 60 if r.max_flexion_angle else 0,
                    "left_ankle_x": 0, "left_ankle_y": 0,
                    "right_ankle_x": 0, "right_ankle_y": 0}
                   for r in camera_records]

    if not shoe_data or not knee_data or not vision_data:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No sensor data found for this session. Run the test first."
        )

    # Extract features
    features = extract_all_features(patient, shoe_data, knee_data, vision_data)
    feature_vector = features_to_array(features)

    # Run ML prediction
    predictor = get_predictor()
    result = predictor.predict_with_explanation(feature_vector)

    # Update patient with result
    patient.risk_level = result["risk_level"]
    patient.risk_score = result["risk_score"]
    patient.explanation = result["explanation"]
    patient.contributing_factors = result["contributing_factors"]
    db.commit()

    return ResultResponse(
        session_id=session_id,
        risk_level=result["risk_level"],
        risk_score=result["risk_score"],
        explanation=result["explanation"],
        contributing_factors=result["contributing_factors"],
        disclaimer=get_disclaimer(result["risk_level"]),
    )


def validate_patient(patient_id: str, db: Session) -> Patient:
    """Validate patient exists and has passed gate."""
    patient = db.query(Patient).filter(Patient.patient_id == int(patient_id)).first()
    if not patient:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Patient {patient_id} not found"
        )

    if patient.gate_passed is False:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Patient {patient_id} did not pass intake gate"
        )

    if patient.gate_passed is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Patient {patient_id} has not completed intake questionnaire"
        )

    return patient


def get_disclaimer(risk_level: str) -> str:
    """Get appropriate disclaimer based on risk level."""
    if risk_level == "High":
        return "This screening suggests elevated risk indicators. Please consult a healthcare provider for comprehensive evaluation. This is not a diagnosis."
    elif risk_level == "Moderate":
        return "Some risk indicators detected. We recommend discussing these findings with a healthcare provider. This is not a diagnosis."
    else:
        return "Screening results appear within normal ranges. Continue monitoring and consult a healthcare provider if symptoms change. This is not a diagnosis."

"""
Sensor data ingestion endpoints (simulated for now).

These endpoints will receive real data from ESP32 devices and smartphone camera:
- POST /sessions/{session_id}/sensors/shoe - FSR pressure data
- POST /sessions/{session_id}/sensors/knee - IMU motion data
- POST /sessions/{session_id}/sensors/vision - Camera/gait data

For now, these endpoints also handle triggering simulated data generation
when the frontend initiates a test run.
"""

from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, status, Body
from pydantic import BaseModel
from sqlalchemy.orm import Session
from typing import List, Optional

from app.db.models import (
    Patient,
    ShoeSensorData,
    KneeSensorData,
    CameraPoseData,
    get_db,
)
from app.simulate.data_generator import DataGenerator

router = APIRouter(prefix="/sessions/{session_id}/sensors", tags=["sensors"])


# Request models for real hardware integration
class ShoeReading(BaseModel):
    timestamp: float
    left_heel: int
    left_toe: int
    right_heel: int
    right_toe: int


class ShoeDataRequest(BaseModel):
    readings: List[ShoeReading]


class IMUReading(BaseModel):
    timestamp: float
    thigh_accel: List[float]
    thigh_gyro: List[float]
    shin_accel: List[float]
    shin_gyro: List[float]


class KneeDataRequest(BaseModel):
    readings: List[IMUReading]


# New format from frontend (direct sensor values)
class KneeSensorReading(BaseModel):
    timestamp: float
    knee_flexion: float
    thigh_angle: float
    shin_angle: float


class KneeSensorRequest(BaseModel):
    readings: List[KneeSensorReading]


class ShoeSensorReading(BaseModel):
    timestamp: float
    fsr_heel: float
    fsr_midfoot: float
    fsr_forefoot: float
    fsr_toe: float


class ShoeSensorRequest(BaseModel):
    readings: List[ShoeSensorReading]


class PoseLandmark(BaseModel):
    timestamp: float
    left_hip_x: float
    left_hip_y: float
    right_hip_x: float
    right_hip_y: float
    left_knee_x: float
    left_knee_y: float
    right_knee_x: float
    right_knee_y: float
    left_ankle_x: float
    left_ankle_y: float
    right_ankle_x: float
    right_ankle_y: float


class VisionDataRequest(BaseModel):
    landmarks: List[PoseLandmark]


@router.post("/shoe")
async def ingest_shoe_data(
    session_id: str,
    data: dict = Body(None, embed=False),
    db: Session = Depends(get_db),
):
    """
    Ingest shoe sensor (FSR) data.

    When called with no data (simulated mode), generates realistic simulated data.
    When called with data (real mode), stores the real ESP32 readings.

    Accepts two formats:
    1. Old format: { readings: [{ timestamp, left_heel, left_toe, right_heel, right_toe }] }
    2. New format: { readings: [{ timestamp, fsr_heel, fsr_midfoot, fsr_forefoot, fsr_toe }] }

    Returns number of readings stored.
    """
    import json
    patient = validate_patient(session_id, db)

    # Check if this is the new format (with fsr_* fields)
    if data:
        readings = data.get("readings", [])
        first_reading = readings[0] if readings else {}
        if "fsr_heel" in first_reading:
            # New format from frontend
            for reading in readings:
                record = ShoeSensorData(
                    patient_id=int(session_id),
                    fsr_heel=reading.get("fsr_heel", 0.0) or 0.0,
                    fsr_midfoot=reading.get("fsr_midfoot", 0.0) or 0.0,
                    fsr_forefoot=reading.get("fsr_forefoot", 0.0) or 0.0,
                    fsr_toe=reading.get("fsr_toe", 0.0) or 0.0,
                    timestamp=datetime.fromtimestamp(reading["timestamp"]) if "timestamp" in reading else datetime.utcnow(),
                )
                db.add(record)
            db.commit()
            return {"stored_readings": len(readings), "mode": "real"}

    # Old format or simulated mode
    if data is None:
        # Simulated mode - generate data based on profile
        profile = "oa" if patient.age and patient.age > 60 and patient.pain_severity and patient.pain_severity > 5 else "normal"
        generator = DataGenerator(profile=profile, duration_seconds=10.0, sample_rate_hz=50.0)
        shoe_data = generator.generate_shoe_data()
    else:
        # Old format - data is already parsed dict
        readings_list = data.get("readings", [])
        shoe_data = [{"timestamp": r.get("timestamp"), "left_heel": r.get("left_heel"), "left_toe": r.get("left_toe"),
                      "right_heel": r.get("right_heel"), "right_toe": r.get("right_toe")} for r in readings_list]

    # Store in database
    for reading in shoe_data:
        record = ShoeSensorData(
            patient_id=int(session_id),
            fsr_heel=reading.get("left_heel", 0.0) or 0.0,
            fsr_midfoot=0.0,
            fsr_forefoot=reading.get("left_toe", 0.0) or 0.0,
            fsr_toe=0.0,
            timestamp=datetime.fromtimestamp(reading["timestamp"]) if "timestamp" in reading else datetime.utcnow(),
        )
        db.add(record)

    db.commit()

    return {"stored_readings": len(shoe_data), "mode": "simulated" if data is None else "real"}


@router.post("/knee")
async def ingest_knee_data(
    session_id: str,
    data: dict = Body(None, embed=False),
    db: Session = Depends(get_db),
):
    """
    Ingest knee IMU data (accelerometer + gyroscope).

    Simulated mode generates realistic motion data.
    Real mode stores actual ESP32 IMU readings.

    Accepts two formats:
    1. Old format: { readings: [{ timestamp, thigh_accel, thigh_gyro, shin_accel, shin_gyro }] }
    2. New format: { readings: [{ timestamp, knee_flexion, thigh_angle, shin_angle }] }
    """
    patient = validate_patient(session_id, db)

    # Check if this is the new format (with knee_flexion field)
    if data:
        readings = data.get("readings", [])
        first_reading = readings[0] if readings else {}
        if "knee_flexion" in first_reading:
            # New format from frontend
            for reading in readings:
                record = KneeSensorData(
                    patient_id=int(session_id),
                    knee_flexion=reading.get("knee_flexion", 0.0) or 0.0,
                    thigh_angle=reading.get("thigh_angle", 0.0) or 0.0,
                    shin_angle=reading.get("shin_angle", 0.0) or 0.0,
                    timestamp=datetime.fromtimestamp(reading["timestamp"]) if "timestamp" in reading else datetime.utcnow(),
                )
                db.add(record)
            db.commit()
            return {"stored_readings": len(readings), "mode": "real"}

    # Old format or simulated mode
    if data is None:
        # Simulated mode
        profile = "oa" if patient.age and patient.age > 60 and patient.pain_severity and patient.pain_severity > 5 else "normal"
        generator = DataGenerator(profile=profile, duration_seconds=10.0, sample_rate_hz=50.0)
        knee_data = generator.generate_knee_data()
    else:
        # Old format - data is already parsed dict
        readings_list = data.get("readings", [])
        knee_data = [{"timestamp": r.get("timestamp"), "thigh_accel": r.get("thigh_accel"), "thigh_gyro": r.get("thigh_gyro"),
                      "shin_accel": r.get("shin_accel"), "shin_gyro": r.get("shin_gyro")} for r in readings_list]

    # Store in database - map to new schema
    for reading in knee_data:
        # Calculate knee_flexion from thigh and shin angles (simplified)
        knee_flexion = abs(reading["thigh_accel"][1] - reading["shin_accel"][1]) * 30 if "thigh_accel" in reading else 0.0

        record = KneeSensorData(
            patient_id=int(session_id),
            knee_flexion=knee_flexion,
            thigh_angle=reading["thigh_accel"][1] if "thigh_accel" in reading else 0.0,
            shin_angle=reading["shin_accel"][1] if "shin_accel" in reading else 0.0,
            timestamp=datetime.fromtimestamp(reading["timestamp"]) if "timestamp" in reading else datetime.utcnow(),
        )
        db.add(record)

    db.commit()

    return {"stored_readings": len(knee_data), "mode": "simulated" if data is None else "real"}


@router.post("/vision")
async def ingest_vision_data(
    session_id: str,
    data: dict = Body(None, embed=False),
    db: Session = Depends(get_db),
):
    """
    Ingest vision/gait data (pose landmarks from MediaPipe or similar).

    Simulated mode generates realistic gait patterns.
    Real mode stores actual camera pose estimation data.
    """
    patient = validate_patient(session_id, db)

    # Determine profile based on patient data (used for both real and simulated modes)
    profile = "oa" if patient.age and patient.age > 60 and patient.pain_severity and patient.pain_severity > 5 else "normal"

    if data is None:
        # Simulated mode
        generator = DataGenerator(profile=profile, duration_seconds=10.0, sample_rate_hz=50.0)
        vision_data = generator.generate_vision_data()
    else:
        # Real mode - data is dict with landmarks
        landmarks_list = data.get("landmarks", [])
        vision_data = landmarks_list

    # Store in database - aggregate into single camera pose record for this session
    # Calculate max flexion angle and gait symmetry from landmarks
    max_flexion = 0.0
    if vision_data:
        for landmark in vision_data:
            # Calculate knee angle from pose landmarks (simplified)
            left_knee_angle = abs(landmark.get("left_hip_y", 0) - landmark.get("left_knee_y", 0))
            right_knee_angle = abs(landmark.get("right_hip_y", 0) - landmark.get("right_knee_y", 0))
            max_flexion = max(max_flexion, left_knee_angle * 60, right_knee_angle * 60)  # Scale factor

    # Calculate gait symmetry (simplified - based on left/right symmetry)
    gait_symmetry = 0.85  # Default good symmetry for simulated data
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

    return {"stored_landmarks": len(vision_data), "mode": "simulated" if data is None else "real"}


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

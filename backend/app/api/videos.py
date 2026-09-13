"""
Video recording endpoints - upload, store, and retrieve walk test videos.

POST /sessions/{session_id}/video - Upload video file
GET /sessions/{session_id}/video - Stream video file for playback

Videos are stored in a per-patient folder structure:
  backend/storage/patients/{patient_id}/videos/{session_id}.webm
"""

import logging
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, status
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session
from pathlib import Path

from app.db.models import Patient, get_db

router = APIRouter(prefix="/sessions", tags=["videos"])

# Base storage directory for all patient artifacts
STORAGE_BASE_PATH = Path(__file__).parent.parent.parent / "storage" / "patients"
STORAGE_BASE_PATH.mkdir(parents=True, exist_ok=True)

# Storage threshold for warning (500 MB)
STORAGE_WARNING_THRESHOLD = 500 * 1024 * 1024

logger = logging.getLogger(__name__)


def get_patient_storage_path(patient_id: str) -> Path:
    """Get the base storage path for a patient."""
    return STORAGE_BASE_PATH / patient_id


def get_patient_video_path(patient_id: str, session_id: str) -> Path:
    """Get the full path for a patient's video file."""
    video_dir = get_patient_storage_path(patient_id) / "videos"
    video_dir.mkdir(parents=True, exist_ok=True)
    return video_dir / f"{session_id}.webm"


def get_storage_size() -> int:
    """Calculate total size of all patient storage."""
    total_size = 0
    for file_path in STORAGE_BASE_PATH.glob("**/videos/*.webm"):
        total_size += file_path.stat().st_size
    return total_size


@router.post("/{session_id}/video", status_code=status.HTTP_201_CREATED)
async def upload_video(
    session_id: str,
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
):
    """
    Upload a video recording for a session.

    Saves the video file to disk in per-patient folder structure and stores metadata in the database.
    """
    # Validate patient exists (session_id is now patient_id)
    patient = db.query(Patient).filter(Patient.patient_id == int(session_id)).first()
    if not patient:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Patient {session_id} not found"
        )

    patient_id = session_id  # session_id IS the patient_id now

    # Check storage size and log warning if exceeding threshold
    current_storage = get_storage_size()
    if current_storage > STORAGE_WARNING_THRESHOLD:
        logger.warning(
            f"Video storage exceeds threshold: {current_storage / (1024*1024):.1f} MB > "
            f"{STORAGE_WARNING_THRESHOLD / (1024*1024):.1f} MB. Consider moving to cloud storage."
        )

    # Generate file path in per-patient folder structure
    video_path = get_patient_video_path(str(patient_id), session_id)

    # Save video file
    try:
        content = await file.read()
        with open(video_path, "wb") as f:
            f.write(content)
        file_size = len(content)
    except Exception as e:
        logger.error(f"Failed to save video for session {session_id}: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to save video file"
        )

    logger.info(f"Video uploaded for session {session_id} (patient {patient_id}): {file_size} bytes to {video_path}")

    return {
        "session_id": session_id,
        "patient_id": patient_id,
        "video_path": str(video_path),
        "file_size": file_size,
        "recorded_at": datetime.utcnow().isoformat(),
    }


@router.get("/{session_id}/video")
async def get_video(
    session_id: str,
    db: Session = Depends(get_db),
):
    """
    Stream video file for a session.

    Returns the video file for playback in the browser.
    """
    # Validate patient exists
    patient = db.query(Patient).filter(Patient.patient_id == int(session_id)).first()
    if not patient:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Patient {session_id} not found"
        )

    # Look for video file in patient folder
    video_path = get_patient_video_path(session_id, session_id)

    if not video_path.exists():
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No video recording found for this session"
        )

    # Return video file with proper media type
    return FileResponse(
        path=str(video_path),
        media_type="video/webm",
        filename=f"{session_id}.webm"
    )


@router.delete("/{session_id}/video", status_code=status.HTTP_204_NO_CONTENT)
async def delete_video(
    session_id: str,
    db: Session = Depends(get_db),
):
    """
    Delete video recording for a session.

    Removes the video file from disk.
    """
    # Validate patient exists
    patient = db.query(Patient).filter(Patient.patient_id == int(session_id)).first()
    if not patient:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Patient {session_id} not found"
        )

    video_path = get_patient_video_path(session_id, session_id)

    # Delete file from disk
    if video_path.exists():
        try:
            video_path.unlink()
            logger.info(f"Deleted video file: {video_path}")
        except Exception as e:
            logger.error(f"Failed to delete video file {video_path}: {e}")

    return None

from sqlalchemy import create_engine, Column, Integer, String, Float, DateTime, Boolean, JSON, ForeignKey, Text
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker, relationship
from datetime import datetime
import os
import ssl

from app.config import get_settings

settings = get_settings()

# Build absolute path to CA certificate for MySQL SSL connections
# Check for CA_CERT_PATH environment variable first (for Render), fall back to local path
_ca_cert_path = os.getenv('CA_CERT_PATH')
if not _ca_cert_path:
    _ca_cert_path = os.path.join(os.path.dirname(__file__), '..', '..', 'certs', 'ca.pem')
_cert_path = _ca_cert_path

# Determine if we're using MySQL (requires SSL for Aiven) vs SQLite
_is_mysql = settings.database_url.startswith('mysql')

# SSL context for MySQL connections
# PyMySQL 1.4.x accepts either an ssl.SSLContext or a dict with ssl params
if _is_mysql and os.path.exists(_cert_path):
    _ssl_context = ssl.create_default_context(cafile=_cert_path)
    _connect_args = {"ssl": _ssl_context}
else:
    _connect_args = {}

# Create database engine
engine = create_engine(
    settings.database_url,
    echo=False,
    pool_pre_ping=True,  # Verify connections before using them
    pool_size=10,
    max_overflow=20,
    connect_args=_connect_args,
)
# Create session factory
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

# Base class for all models
Base = declarative_base()


def get_db():
    """Dependency for FastAPI to inject DB sessions."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


# =============================================================================
# AUTH TABLES (These need to be created in Aiven - additive only)
# =============================================================================

class User(Base):
    """Health worker / clinic staff account."""

    __tablename__ = "users"

    id = Column(Integer, primary_key=True, autoincrement=True)
    username = Column(String(80), unique=True, nullable=False, index=True)
    password = Column(String(255), nullable=False)  # TODO: hash before real deployment
    full_name = Column(String(255), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    # Relationships
    patients = relationship("Patient", back_populates="user")
    auth_tokens = relationship("AuthToken", back_populates="user", cascade="all, delete-orphan")


class AuthToken(Base):
    """Persistent auth tokens that survive backend restarts."""

    __tablename__ = "auth_tokens"

    id = Column(Integer, primary_key=True, autoincrement=True)
    token = Column(String(64), unique=True, nullable=False, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    # Relationship
    user = relationship("User", back_populates="auth_tokens")


# =============================================================================
# PATIENT TABLE (Matches existing Aiven schema)
# =============================================================================

class Patient(Base):
    """Patient information - matches existing Aiven schema."""

    __tablename__ = "patients"

    patient_id = Column(Integer, primary_key=True, autoincrement=True)
    patient_name = Column(String(100), nullable=False)
    age = Column(Integer, nullable=True)
    gender = Column(String(20), nullable=True)
    symptoms = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=True)

    # Foreign key to health worker who created this patient
    user_id = Column(Integer, ForeignKey("users.id"), nullable=True)

    # Questionnaire fields (added to match backend needs)
    morning_stiffness_minutes = Column(Integer, nullable=True)
    pain_severity = Column(Integer, nullable=True)
    pain_duration_category = Column(String(20), nullable=True)
    prior_knee_injury = Column(Boolean, default=False)
    prior_knee_surgery = Column(Boolean, default=False)

    # Gating result
    gate_passed = Column(Boolean, nullable=True)
    gate_reason = Column(String(255), nullable=True)

    # Test run result
    risk_level = Column(String(20), nullable=True)  # "Low", "Moderate", "High"
    risk_score = Column(Float, nullable=True)  # 0.0 to 1.0 probability
    explanation = Column(Text, nullable=True)
    contributing_factors = Column(JSON, nullable=True)

    # Relationships
    user = relationship("User", back_populates="patients")
    shoe_sensor_data = relationship("ShoeSensorData", back_populates="patient")
    knee_sensor_data = relationship("KneeSensorData", back_populates="patient")
    camera_pose_data = relationship("CameraPoseData", back_populates="patient")


# =============================================================================
# SENSOR DATA TABLES (Match existing Aiven schema)
# =============================================================================

class ShoeSensorData(Base):
    """Shoe sensor data - matches existing Aiven schema."""

    __tablename__ = "shoe_sensor_data"

    record_id = Column(Integer, primary_key=True, autoincrement=True)
    patient_id = Column(Integer, ForeignKey("patients.patient_id"), nullable=True)
    fsr_heel = Column(Float, nullable=True)
    fsr_midfoot = Column(Float, nullable=True)
    fsr_forefoot = Column(Float, nullable=True)
    fsr_toe = Column(Float, nullable=True)
    timestamp = Column(DateTime, nullable=True)

    patient = relationship("Patient", back_populates="shoe_sensor_data")


class KneeSensorData(Base):
    """Knee sensor data - matches existing Aiven schema."""

    __tablename__ = "knee_sensor_data"

    record_id = Column(Integer, primary_key=True, autoincrement=True)
    patient_id = Column(Integer, ForeignKey("patients.patient_id"), nullable=True)
    knee_flexion = Column(Float, nullable=True)
    thigh_angle = Column(Float, nullable=True)
    shin_angle = Column(Float, nullable=True)
    timestamp = Column(DateTime, nullable=True)

    patient = relationship("Patient", back_populates="knee_sensor_data")


class CameraPoseData(Base):
    """Camera pose data - matches existing Aiven schema."""

    __tablename__ = "camera_pose_data"

    record_id = Column(Integer, primary_key=True, autoincrement=True)
    patient_id = Column(Integer, ForeignKey("patients.patient_id"), nullable=True)
    max_flexion_angle = Column(Float, nullable=True)
    gait_symmetry_score = Column(Float, nullable=True)
    posture_status = Column(String(100), nullable=True)
    timestamp = Column(DateTime, nullable=True)

    patient = relationship("Patient", back_populates="camera_pose_data")


def init_db():
    """Create auth tables in the database (additive only - does not touch existing tables)."""
    # Only create users and auth_tokens tables if they don't exist
    # These are needed for login functionality
    from sqlalchemy import text

    with engine.connect() as conn:
        # Check if users table exists
        result = conn.execute(text(
            "SELECT TABLE_NAME FROM information_schema.TABLES "
            "WHERE TABLE_SCHEMA = 'orthonova' AND TABLE_NAME = 'users'"
        ))
        if not result.fetchone():
            print("Creating 'users' table...")
            User.__table__.create(engine, checkfirst=True)

        # Check if auth_tokens table exists
        result = conn.execute(text(
            "SELECT TABLE_NAME FROM information_schema.TABLES "
            "WHERE TABLE_SCHEMA = 'orthonova' AND TABLE_NAME = 'auth_tokens'"
        ))
        if not result.fetchone():
            print("Creating 'auth_tokens' table...")
            AuthToken.__table__.create(engine, checkfirst=True)

    # Add new columns to patients table if they don't exist
    try:
        with engine.connect() as conn:
            # Check if user_id column exists in patients
            result = conn.execute(text(
                "SELECT COLUMN_NAME FROM information_schema.COLUMNS "
                "WHERE TABLE_SCHEMA = 'orthonova' AND TABLE_NAME = 'patients' AND COLUMN_NAME = 'user_id'"
            ))
            if not result.fetchone():
                print("Adding 'user_id' column to patients table...")
                conn.execute(text("ALTER TABLE patients ADD COLUMN user_id INT NULL"))
                conn.execute(text("ALTER TABLE patients ADD CONSTRAINT fk_patients_user FOREIGN KEY (user_id) REFERENCES users(id)"))
                conn.commit()

            # Add questionnaire columns
            new_columns = [
                ("morning_stiffness_minutes", "INT NULL"),
                ("pain_severity", "INT NULL"),
                ("pain_duration_category", "VARCHAR(20) NULL"),
                ("prior_knee_injury", "BOOLEAN DEFAULT FALSE"),
                ("prior_knee_surgery", "BOOLEAN DEFAULT FALSE"),
                ("gate_passed", "BOOLEAN NULL"),
                ("gate_reason", "VARCHAR(255) NULL"),
                ("risk_level", "VARCHAR(20) NULL"),
                ("risk_score", "FLOAT NULL"),
                ("explanation", "TEXT NULL"),
                ("contributing_factors", "JSON NULL"),
            ]

            for col_name, col_def in new_columns:
                result = conn.execute(text(
                    f"SELECT COLUMN_NAME FROM information_schema.COLUMNS "
                    f"WHERE TABLE_SCHEMA = 'orthonova' AND TABLE_NAME = 'patients' AND COLUMN_NAME = '{col_name}'"
                ))
                if not result.fetchone():
                    print(f"Adding '{col_name}' column to patients table...")
                    conn.execute(text(f"ALTER TABLE patients ADD COLUMN {col_name} {col_def}"))
                    conn.commit()

    except Exception as e:
        print(f"Note: Could not add columns to patients table: {e}")
        print("This is OK if columns already exist or if there are permission issues.")

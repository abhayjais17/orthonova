# Orthonova

A low-cost, portable screening tool for early detection of Knee Osteoarthritis (OA) warning signs in rural/underserved areas.

## Architecture

- **Frontend**: Next.js (TypeScript, App Router, Tailwind CSS) - Patient/operator UI
- **Backend**: Python (FastAPI) - Sensor ingestion, database, ML model, vision processing
- Communication: REST API (JSON over HTTP)

## Prerequisites

- Node.js 18+ and npm
- Python 3.9+
- MySQL 8.0+

## Quick Start

### 1. Database Setup

```bash
# Start MySQL and create database
mysql -u root -p
CREATE DATABASE orthonova CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER 'orthonova_user'@'localhost' IDENTIFIED BY 'orthonova_pass';
GRANT ALL PRIVILEGES ON orthonova.* TO 'orthonova_user'@'localhost';
FLUSH PRIVILEGES;
EXIT;
```

### 2. Backend Setup

```bash
cd backend

# Create virtual environment
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt

# Configure environment
cp .env.example .env
# Edit .env with your MySQL credentials

# Initialize database tables
python setup_database.py

# Generate simulated training data and train initial model
python -m app.ml.train_model

# Start FastAPI server
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

Backend will be available at `http://localhost:8000`
API documentation at `http://localhost:8000/docs`

### 3. Frontend Setup

Open a new terminal:

```bash
cd frontend

# Install dependencies
npm install

# Configure environment
cp .env.local.example .env.local
# Should contain: NEXT_PUBLIC_API_URL=http://localhost:8000

# Start Next.js dev server
npm run dev
```

Frontend will be available at `http://localhost:3000`

## Current Implementation Status

### ✅ Fully Implemented (Simulated Data)

- Complete MySQL schema with SQLAlchemy models
- Simulated sensor data generators (normal vs OA-like profiles):
  - **Shoe sensors**: FSR force data with realistic heel-strike patterns
  - **Knee IMU**: Motion data with knee flexion angles and micro-shocks
  - **Vision/gait**: Pose-based stride and symmetry metrics
- Feature extraction pipeline (15 features per session)
- Baseline ML model (Random Forest classifier)
- Complete REST API with CORS enabled
- Full patient flow UI (welcome → intake → gating → test → results)
- Risk assessment with plain-language explanations
- Bilingual support (English/Hindi labels)

### 🔄 Ready for Hardware Integration

The system is architected to swap simulated data for real hardware with minimal changes:

#### Shoe Node (ESP32 + FSR sensors)
- **Current**: `backend/app/simulate/data_generator.py` generates realistic force profiles
- **Integration point**: `POST /sessions/{session_id}/sensors/shoe` endpoint
- **Required**: ESP32 sends JSON: `{"timestamp": ms, "left_heel": 0-1023, "left_toe": ..., "right_heel": ..., "right_toe": ...}`
- **No changes needed**: Feature extraction, ML model, frontend, database schema

#### Knee Node (ESP32 + MPU-6050 IMUs)
- **Current**: Simulated IMU data with knee flexion angles and micro-shocks
- **Integration point**: `POST /sessions/{session_id}/sensors/knee` endpoint
- **Required**: ESP32 sends JSON: `{"timestamp": ms, "thigh_accel": [x,y,z], "thigh_gyro": [x,y,z], "shin_accel": [x,y,z], "shin_gyro": [x,y,z]}`
- **No changes needed**: Feature extraction calculates knee angle from IMU quaternions

#### Vision (Smartphone Camera + MediaPipe)
- **Current**: Mocked MediaPipe pose landmark output
- **Integration point**: `POST /sessions/{session_id}/sensors/vision` endpoint
- **Required**: Camera app sends pose landmarks per frame (MediaPipe output format)
- **To add**: Real MediaPipe Python integration in `backend/app/api/vision.py`
- **No changes needed**: Feature extraction, frontend, results display

## Project Structure

```
orthonova/
├── frontend/          Next.js patient UI
│   ├── app/          Page routes (welcome, intake, test, results)
│   ├── components/   Reusable UI components
│   └── lib/          API client and utilities
│
├── backend/          FastAPI + ML pipeline
│   ├── app/
│   │   ├── api/      REST endpoints
│   │   ├── db/       SQLAlchemy models and connection
│   │   ├── features/ Feature extraction from raw sensor data
│   │   ├── ml/       Model training and prediction
│   │   └── simulate/ Data generators (swap out when hardware ready)
│   └── setup_database.py
│
└── README.md         This file
```

## Retraining the Model

When you collect real patient data:

```bash
cd backend
source venv/bin/activate  # Windows: venv\Scripts\activate

# The training script reads all sessions from the database
# Make sure you have labeled data (verified OA status) in the sessions table
python -m app.ml.train_model

# New model.pkl will be saved and automatically used by the API
```

## API Endpoints

### Authentication
- `POST /auth/login` - Login with username/password, returns auth token
- `GET /auth/me` - Get current logged-in user info
- `POST /auth/logout` - Invalidate session token

### Patients
- `GET /patients` - List all patients for the current user
- `GET /patients/{id}` - Get detailed info for one patient

### Sessions
- `POST /sessions` - Create new screening session (requires auth)
- `POST /sessions/{id}/intake` - Submit questionnaire with patient details, get gating decision
- `POST /sessions/{id}/run-test` - Trigger sensor data collection (simulated for now)
- `GET /sessions/{id}/result` - Get risk assessment and explanation
- `POST /sessions/{id}/sensors/shoe` - Ingest shoe sensor data (ready for ESP32)
- `POST /sessions/{id}/sensors/knee` - Ingest knee IMU data (ready for ESP32)
- `POST /sessions/{id}/sensors/vision` - Ingest vision/gait data (ready for camera)

## Authentication & User Management

The system now supports user authentication for health workers. Each health worker has their own account, and patients are scoped to the user who created them.

### Demo Accounts

After running `python setup_database.py`, two demo accounts are available:

- **Username**: `demo`, **Password**: `demo123`, **Name**: Demo User
- **Username**: `priya`, **Password**: `priya123`, **Name**: Priya Sharma

### Login Flow

1. Navigate to `/login` in the frontend
2. Enter one of the demo credentials above
3. On success, you'll be redirected to `/dashboard` showing your patients

### ⚠️ IMPORTANT: Security TODO

**Before any real deployment with actual patient data:**

1. **Password Hashing**: Implement password hashing using `passlib[bcrypt]`. Currently passwords are stored in plain text for development convenience.

2. **JWT Tokens**: Replace the simple in-memory session tokens with proper signed JWTs with expiry. Currently tokens are simple random strings stored in memory.

3. **HTTPS**: Ensure all communication happens over HTTPS in production.

4. **Session Expiry**: Add proper token expiration and refresh mechanisms.

These are explicitly temporary shortcuts for local development. Do not deploy to production without implementing these security measures.

## Design Philosophy

- **Offline-first**: Runs entirely locally, no cloud dependencies
- **Data persistence**: All raw + processed data stored in MySQL for model improvement
- **Modular**: Sensor ingestion → feature extraction → ML scoring are independent
- **Trustworthy UI**: Calm, accessible design for elderly non-technical users
- **Clinical caution**: Never claims diagnosis, only screening risk levels

## Color Theme

- Primary: `#1F6F78` (teal blue)
- Low risk: `#7FA650` (sage green)
- Moderate risk: `#E0A548` (warm amber)
- High risk: `#C15B4A` (muted terracotta)

## Notes

- This is a **screening tool**, not a diagnostic device
- High-risk results should always prompt referral to a qualified healthcare provider
- Model performance metrics are based on simulated data - real-world validation required
- All patient data handling must comply with local healthcare privacy regulations

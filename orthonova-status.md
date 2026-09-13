# Orthonova Project Status Report
**Last Updated**: 2026-09-13 | **Version**: 0.1.0-beta

---

## 1. Project Overview

**Orthonova** is a low-cost, portable screening tool for early detection of knee osteoarthritis (OA) warning signs in rural and underserved communities. It combines patient questionnaire data with real-time gait analysis (shoe pressure sensors, knee motion sensors, and smartphone camera pose detection) to assess knee health risk.

**Problem Solved**: Community health workers lack affordable, deployable tools to screen for early OA indicators. Orthonova enables:
- Quick 5-minute screening workflow (questionnaire + walk test)
- Multi-modal sensor data collection (shoe FSR, knee IMU, camera gait analysis)
- Instant risk classification (Low/Moderate/High) with plain-language explanations
- Persistent patient records for follow-up and model improvement

**Target Users**: 
- Community health workers and clinic staff (40+ year-old patients in rural/underserved areas)
- Patients aged 40-100 with knee symptoms

**Architecture**: Offline-first, locally deployable. Frontend (Next.js) + Backend (FastAPI) + MySQL database. No cloud dependencies required.

---

## 2. Complete Folder Structure

```
orthonova/
├── backend/
│   ├── app/
│   │   ├── api/
│   │   │   ├── auth.py              # Auth endpoints (login/logout/me)
│   │   │   ├── intake.py            # Intake form submission, gating logic, active session discovery
│   │   │   ├── patients.py          # Patient list/detail endpoints for health workers
│   │   │   ├── results.py           # Run test, get result, risk prediction
│   │   │   ├── sensors.py           # Shoe/knee/vision sensor data ingestion
│   │   │   ├── videos.py            # Video upload/retrieve/delete for walk test recordings
│   │   │   └── __init__.py
│   │   ├── db/
│   │   │   ├── models.py            # SQLAlchemy ORM models (User, Patient, AuthToken, ShoeSensorData, KneeSensorData, CameraPoseData)
│   │   │   └── __init__.py
│   │   ├── features/
│   │   │   ├── feature_extraction.py # Extract 15 features from sensor data (shoe, knee, vision, intake)
│   │   │   └── __init__.py
│   │   ├── ml/
│   │   │   ├── predict.py           # Risk prediction with explanation (RiskPredictor class)
│   │   │   ├── train_model.py       # Train Random Forest classifier on simulated/real data
│   │   │   ├── model.pkl            # Trained sklearn Random Forest model (binary-committed to repo)
│   │   │   └── __init__.py
│   │   ├── simulate/
│   │   │   ├── data_generator.py    # Generate simulated normal/OA gait profiles (to be replaced with real hardware)
│   │   │   └── __init__.py
│   │   ├── config.py                # Pydantic settings (database URL, CORS origins, risk thresholds)
│   │   ├── main.py                  # FastAPI app initialization, router registration, CORS config
│   │   └── __init__.py
│   ├── certs/
│   │   └── ca.pem                   # SSL CA certificate for MySQL/Aiven connection
│   ├── storage/
│   │   └── patients/
│   │       └── {patient_id}/
│   │           └── videos/
│   │               └── {session_id}.webm  # Walk test video recordings
│   ├── requirements.txt             # Python dependencies
│   ├── setup_database.py            # Initialize database, create demo users
│   ├── .env                         # Local env vars (git-ignored)
│   ├── .env.example                 # Example env vars for reference
│   └── venv/                        # Python virtual environment (git-ignored)
│
├── frontend/
│   ├── app/
│   │   ├── page.tsx                 # Welcome page (/)
│   │   ├── layout.tsx               # Root layout with providers
│   │   ├── dashboard/
│   │   │   ├── page.tsx             # Patient list dashboard
│   │   │   └── [patientId]/
│   │   │       └── page.tsx         # Patient detail view
│   │   ├── login/
│   │   │   └── page.tsx             # Health worker login
│   │   ├── intake/
│   │   │   └── page.tsx             # Patient intake form
│   │   ├── gate-result/
│   │   │   └── page.tsx             # Show gating decision (pass/fail)
│   │   ├── screening/
│   │   │   └── [sessionId]/
│   │   │       ├── knee-test/
│   │   │       │   └── page.tsx     # Knee sensor data collection (simulated UI)
│   │   │       └── shoe-test/
│   │   │           └── page.tsx     # Shoe sensor data collection (simulated UI)
│   │   ├── result/
│   │   │   └── page.tsx             # Final screening result page
│   │   ├── test/
│   │   │   └── page.tsx             # Demo test page
│   │   └── globals.css              # Tailwind + print CSS for result export
│   │
│   ├── components/
│   │   ├── orthonova/
│   │   │   ├── welcome.tsx          # Welcome hero + screening flow overview
│   │   │   ├── intake-form.tsx      # Questionnaire form (name, age, gender, pain, stiffness, injury)
│   │   │   ├── walk-test.tsx        # Walk test UI with progress, MediaPipe pose detection, video recording
│   │   │   ├── knee-test.tsx        # Knee kit sensor data collection UI
│   │   │   ├── shoe-test.tsx        # Shoe kit sensor data collection UI
│   │   │   ├── screening-result.tsx # Results card with risk level, explanation, contributing factors
│   │   │   ├── screening-provider.tsx # React context for screening state management
│   │   │   ├── gate-result.tsx      # Display gate pass/fail decision
│   │   │   ├── patient-dashboard.tsx # Health worker dashboard listing patients
│   │   │   ├── patient-details.tsx  # Patient detail view with results
│   │   │   ├── staff-login.tsx      # Health worker login form
│   │   │   ├── staff-header-actions.tsx # User menu (logout, profile)
│   │   │   ├── auth-provider.tsx    # React context for auth state
│   │   │   ├── app-shell.tsx        # Header, footer, layout wrapper
│   │   │   ├── screening-notice.tsx # Clinical disclaimer/notice card
│   │   │   └── [ui components]      # Base UI: button, card, input, progress, etc.
│   │   └── ui/
│   │       ├── button.tsx
│   │       ├── card.tsx
│   │       ├── input.tsx
│   │       ├── progress.tsx
│   │       ├── toggle-group.tsx
│   │       ├── badge.tsx
│   │       ├── alert.tsx
│   │       ├── separator.tsx
│   │       ├── label.tsx
│   │       ├── slider.tsx
│   │       ├── textarea.tsx
│   │       ├── radio-group.tsx
│   │       ├── empty.tsx
│   │       ├── field.tsx
│   │       ├── input-group.tsx
│   │       └── toggle.tsx
│   │
│   ├── lib/
│   │   ├── api.ts                   # Typed REST API client (all endpoints)
│   │   ├── demo-api.ts              # Stub API client for demo mode (returns mock data)
│   │   ├── demo-patients.ts         # Demo patient data
│   │   ├── usePoseDetection.ts      # React hook for MediaPipe pose detection (12sec capture)
│   │   ├── useSimpleCamera.ts       # React hook for camera stream management
│   │   └── utils.ts                 # Utility functions (cn, classname merging)
│   │
│   ├── public/
│   │   └── images/
│   │       └── community-walk.png   # Hero image
│   │
│   ├── node_modules/                # npm dependencies (git-ignored)
│   ├── .next/                       # Next.js build output (git-ignored)
│   ├── package.json                 # npm dependencies
│   ├── package-lock.json            # npm lock file
│   ├── next.config.js               # Next.js configuration
│   ├── tsconfig.json                # TypeScript configuration
│   ├── tailwind.config.js           # Tailwind CSS theme
│   ├── postcss.config.js            # PostCSS configuration
│   ├── .env.local                   # Local env vars (git-ignored)
│   ├── CLAUDE.md                    # Anthropic Claude system instructions
│   ├── AGENTS.md                    # Next.js agent files notice
│   └── venv/                        # Python venv (if any backend work in frontend dir)
│
├── .git/                            # Git repository
├── README.md                        # Main project README
├── QUICKSTART.md                    # Quick setup guide
├── ESP32_INTEGRATION.md             # Hardware integration guide for ESP32
├── VISION_INTEGRATION.md            # MediaPipe vision integration details
├── CAMERA_FIX.md                    # Camera stream handling fixes
├── NAVIGATION_LOOP_FIX.md           # Navigation race condition fixes
├── RACE_CONDITION_FIX.md            # React state sync fixes
└── orthonova-status.md              # This file
```

---

## 3. Tech Stack (Current, as of 2026-09-13)

### Frontend
- **Framework**: Next.js 16.3.3 (App Router, server + client components)
- **Language**: TypeScript 5.7.3
- **Styling**: Tailwind CSS 4.3.3 + PostCSS 8.5
- **State Management**: React 19 hooks + React Context (ScreeningProvider, AuthProvider)
- **API Client**: Custom typed Fetch-based client (`lib/api.ts`) + SWR 2.5.1 for data fetching
- **UI Components**: Base UI (@base-ui/react 1.5.0) + shadcn custom components (button, card, input, progress, toggle, radio, etc.)
- **Vision Processing**: MediaPipe Tasks Vision 1.0.1 (@mediapipe/tasks-vision) — pose detection via browser
- **Icons**: Lucide React 1.16.0
- **Utilities**: Tailwind Merge 3.3.1, clsx 2.1.1
- **Analytics**: Vercel Analytics 1.6.1
- **Animations**: tw-animate-css 1.4.0

### Backend
- **Framework**: FastAPI 0.104.1
- **Language**: Python 3.9+
- **Server**: Uvicorn 0.24.0 (ASGI)
- **Database ORM**: SQLAlchemy 2.0.23
- **Database Driver**: PyMySQL 1.1.0 (MySQL protocol without SSL by default, with SSL context support via CA certificate)
- **Validation**: Pydantic 2.5.0 + Pydantic Settings 2.1.0
- **ML**: scikit-learn 1.3.2 (Random Forest classifier), joblib 1.3.2 (model serialization)
- **Data Processing**: NumPy 1.26.3, Pandas 2.1.3, SciPy 1.11.4
- **Utilities**: python-multipart 0.0.6, python-dotenv 1.0.0
- **Cryptography**: cryptography 41.0.7 (for TLS/SSL)

### Database
- **System**: MySQL 8.0+ (cloud-hosted on Aiven in production)
- **Connection**: SSL/TLS via PyMySQL driver with CA certificate authentication
- **ORM**: SQLAlchemy 2.0.23
- **Schema Management**: Additive-only migrations (no down migrations, tables created on init if missing)

### Deployment
- **Frontend**: Vercel (Next.js optimized, deployed from main branch)
  - Live URL: `https://orthonova-frontend.vercel.app` (assumed; verify in deployment settings)
  - Environment: `NEXT_PUBLIC_API_URL=https://orthonova-backend.onrender.com`
  - Benefits: instant deploys, auto-scaling, edge network, zero-config Next.js support
  - Gotchas: cold starts minimal, edge function latency low
  
- **Backend**: Render (Python/FastAPI web service on free tier)
  - Live URL: `https://orthonova-backend.onrender.com`
  - Hosting Tier: Free tier (auto-spin-down after inactivity, wakes on request in 30-50s)
  - Timeout Issue: First request after cold-start may exceed browser defaults; set API timeouts to 120s+
  - Environment Variables: `DATABASE_URL`, `CORS_ORIGINS`, `CA_CERT_PATH` (for Aiven MySQL SSL)
  - Logs: Accessible via Render dashboard
  
- **Database**: Aiven (managed MySQL, free tier)
  - Host: `ca11...mysql.aivencloud.com`
  - SSL Required: Yes, CA certificate provided at deployment
  - Credentials: Stored in `DATABASE_URL` env var

### Deployment Hosting-Specific Config
- **Render Free Tier**: Auto-spins down after 15 min inactivity; first request takes 30-50s (cold-start). Set HTTP request timeouts to 120 seconds.
- **Aiven MySQL**: Requires SSL/TLS. CA certificate path loaded from `CA_CERT_PATH` env var or fallback to `backend/certs/ca.pem`.
- **Vercel**: No special config needed. CORS handled by backend.

---

## 4. Database Schema (Ground Truth)

### Tables Currently in Database

#### `users`
Registered health worker accounts (created by `setup_database.py`).
| Column | Type | Nullable | Key | Notes |
|--------|------|----------|-----|-------|
| id | INT | No | PRIMARY KEY | Auto-increment |
| username | VARCHAR(80) | No | UNIQUE INDEX | Health worker login name |
| password | VARCHAR(255) | No | — | **TODO**: Plain-text (development only, hash before production) |
| full_name | VARCHAR(255) | Yes | — | Health worker full name |
| created_at | DATETIME | No | — | Account creation timestamp |

**Status**: Active. Demo users: `demo` (demo123), `priya` (priya123) created by `setup_database.py`.

---

#### `auth_tokens`
Persistent auth tokens for session management (survives backend restarts).
| Column | Type | Nullable | Key | Notes |
|--------|------|----------|-----|-------|
| id | INT | No | PRIMARY KEY | Auto-increment |
| token | VARCHAR(64) | No | UNIQUE INDEX | Random 32-byte URL-safe token |
| user_id | INT | No | FOREIGN KEY → users(id) | User who owns this token |
| created_at | DATETIME | No | — | Token issue timestamp |

**Status**: Active. Tokens stored in DB, checked on every request.

---

#### `patients`
Patient records (one per screening session, extends existing Aiven schema).
| Column | Type | Nullable | Key | Notes |
|--------|------|----------|-----|-------|
| patient_id | INT | No | PRIMARY KEY | Auto-increment (primary key for all data queries) |
| patient_name | VARCHAR(100) | No | — | Full name entered in intake |
| age | INT | Yes | — | Age from questionnaire |
| gender | VARCHAR(20) | Yes | — | "Male", "Female", "Other" |
| symptoms | TEXT | Yes | — | Serialized symptom text (legacy field, now redundant) |
| created_at | DATETIME | Yes | — | Session creation timestamp |
| user_id | INT | Yes | FOREIGN KEY → users(id) | Health worker who created this patient |
| morning_stiffness_minutes | INT | Yes | — | Morning stiffness duration (0-120 min) |
| pain_severity | INT | Yes | — | Pain level (0-10 scale) |
| pain_duration_category | VARCHAR(20) | Yes | — | "none", "weeks", "months", "years" |
| prior_knee_injury | BOOLEAN | Yes | — | Self-reported prior injury |
| prior_knee_surgery | BOOLEAN | Yes | — | Self-reported prior surgery |
| gate_passed | BOOLEAN | Yes | — | Intake gating result (NULL=not submitted, True=pass, False=fail) |
| gate_reason | VARCHAR(255) | Yes | — | Explanation of gate decision |
| risk_level | VARCHAR(20) | Yes | — | ML prediction: "Low", "Moderate", "High" |
| risk_score | FLOAT | Yes | — | Probability of high risk (0.0-1.0) |
| explanation | TEXT | Yes | — | Plain-language explanation of result |
| contributing_factors | JSON | Yes | — | Array of contributing factor strings |

**Status**: Active. Core table. Session ID = patient_id in URL routes.

---

#### `shoe_sensor_data`
Foot pressure sensor readings (FSR 4-point per foot).
| Column | Type | Nullable | Key | Notes |
|--------|------|----------|-----|-------|
| record_id | INT | No | PRIMARY KEY | Auto-increment |
| patient_id | INT | Yes | FOREIGN KEY → patients(patient_id) | Which patient/session |
| fsr_heel | FLOAT | Yes | — | Heel force (0-1023 ADC or Newtons) |
| fsr_midfoot | FLOAT | Yes | — | Midfoot force (0-1023 ADC) |
| fsr_forefoot | FLOAT | Yes | — | Forefoot force (0-1023 ADC) |
| fsr_toe | FLOAT | Yes | — | Toe force (0-1023 ADC) |
| timestamp | DATETIME | Yes | — | Reading timestamp (UTC) |

**Status**: Active. Accepts both single readings and batch arrays. Can be real (ESP32) or simulated (data_generator).

---

#### `knee_sensor_data`
Thigh and shin IMU readings (accelerometer + gyroscope).
| Column | Type | Nullable | Key | Notes |
|--------|------|----------|-----|-------|
| record_id | INT | No | PRIMARY KEY | Auto-increment |
| patient_id | INT | Yes | FOREIGN KEY → patients(patient_id) | Which patient/session |
| knee_flexion | FLOAT | Yes | — | Calculated knee flexion angle (degrees, 0-180) |
| thigh_angle | FLOAT | Yes | — | Thigh orientation (degrees from vertical) |
| shin_angle | FLOAT | Yes | — | Shin orientation (degrees from vertical) |
| timestamp | DATETIME | Yes | — | Reading timestamp (UTC) |

**Status**: Active. Accepts both single readings and batch arrays. Can be real (ESP32 MPU-6050) or simulated.

---

#### `camera_pose_data`
Gait analysis from pose landmarks (MediaPipe or simulated).
| Column | Type | Nullable | Key | Notes |
|--------|------|----------|-----|-------|
| record_id | INT | No | PRIMARY KEY | Auto-increment |
| patient_id | INT | Yes | FOREIGN KEY → patients(patient_id) | Which patient/session |
| max_flexion_angle | FLOAT | Yes | — | Maximum knee flexion angle from pose (degrees) |
| gait_symmetry_score | FLOAT | Yes | — | Left-right stride symmetry (0.0-1.0, 1.0=perfect) |
| posture_status | VARCHAR(100) | Yes | — | "Normal" or "Abnormal gait detected" |
| timestamp | DATETIME | Yes | — | Recording timestamp (UTC) |

**Status**: Active. One record per test session. Aggregates all landmarks into single row.

---

### Schema Notes
- **Auto-increment**: All PKs are auto-increment. `patient_id` becomes the `session_id` in API routes.
- **Cascading**: User deletion cascades to auth_tokens. Patient deletion does NOT cascade (manual cleanup if needed).
- **Additive Only**: New columns added via `init_db()` if missing; existing columns never dropped.
- **Indexes**: Unique indexes on `users.username` and `auth_tokens.token`. No other indexes currently; add if query performance degrades.
- **Foreign Keys**: Enforced. Attempting to query non-existent patient_id returns 404.

---

## 5. API Endpoints (Complete List)

### Authentication (`/auth`)
| Method | Endpoint | Auth Required | Purpose | Request | Response |
|--------|----------|---------------|---------|---------|----------|
| POST | `/auth/login` | No | Health worker login | `{username, password}` | `{token, user_id, username, full_name}` |
| GET | `/auth/me` | **Yes** | Get current user | — | `{id, username, full_name}` |
| POST | `/auth/logout` | **Yes** | Invalidate token | — | `{status: "logged out"}` |

---

### Patients (`/patients`)
| Method | Endpoint | Auth Required | Purpose | Request | Response |
|--------|----------|---------------|---------|---------|----------|
| GET | `/patients` | **Yes** | List all patients for current user | — | Array of `{id, full_name, age, last_screened, risk_level}` |
| GET | `/patients/{patient_id}` | **Yes** | Get detailed info for one patient | — | `{id, full_name, age, last_screened, risk_level, risk_score, explanation, contributing_factors, gate_status, symptoms}` |

---

### Sessions (`/sessions`)
| Method | Endpoint | Auth Required | Purpose | Request | Response |
|--------|----------|---------------|---------|---------|----------|
| POST | `/sessions` | **Yes** | Create new screening session | — | `{session_id, created_at}` |
| POST | `/sessions/{session_id}/intake` | **Yes** | Submit intake form, get gating decision | `{full_name, phone?, address?, age, gender, morning_stiffness_minutes, pain_severity, pain_duration_category, prior_knee_injury, prior_knee_surgery}` | `{gate_status, passed, reason?, recommendation?}` |
| GET | `/sessions/active` | **No** | Get currently active session (for ESP32 discovery) | — | `{session_id?, patient_id?}` (nulls if no active) |

---

### Sensor Data (`/sessions/{session_id}/sensors`)
| Method | Endpoint | Auth Required | Purpose | Request Format | Response |
|--------|----------|---------------|---------|-----------------|----------|
| POST | `/sensors/shoe` | No | Ingest shoe FSR data | Single: `{timestamp, fsr_heel, fsr_midfoot, fsr_forefoot, fsr_toe}` OR Batch: `{readings: [...]}` | `{stored_readings, mode: "real"\|"simulated"}` |
| POST | `/sensors/knee` | No | Ingest knee IMU data | Single: `{timestamp, knee_flexion, thigh_angle, shin_angle}` OR Batch: `{readings: [...]}` | `{stored_readings, mode: "real"\|"simulated"}` |
| POST | `/sensors/vision` | No | Ingest pose landmarks | `{landmarks: [{timestamp, left_hip_x, left_hip_y, ..., right_ankle_y}]}` | `{stored_landmarks, mode: "real"\|"simulated"}` |

---

### Test Execution (`/sessions/{session_id}`)
| Method | Endpoint | Auth Required | Purpose | Request | Response |
|--------|----------|---------------|---------|---------|----------|
| POST | `/run-test` | No | Trigger data collection & ML pipeline | `{vision?}` (optional real vision data) | `{session_id, status, message, readings_collected: {shoe, knee, vision}}` |
| GET | `/result` | No | Get risk assessment & explanation | — | `{session_id, risk_level, risk_score, explanation, contributing_factors, disclaimer}` |

---

### Videos (`/sessions/{session_id}`)
| Method | Endpoint | Auth Required | Purpose | Request | Response |
|--------|----------|---------------|---------|---------|----------|
| POST | `/video` | No | Upload walk test video | FormData with `file: Blob (.webm)` | `{session_id, patient_id, video_path, file_size, recorded_at}` |
| GET | `/video` | No | Stream video for playback | — | `.webm` binary stream (Content-Type: video/webm) |
| DELETE | `/video` | No | Delete video from storage | — | 204 No Content |

---

## 6. Frontend Pages/Routes and Flow

### Current URL Structure
```
/ (root)
├── /login                          # Health worker login
├── /dashboard                      # Patient list for current user
├── /dashboard/[patientId]          # Patient detail + results
├── /intake                         # Patient intake form (questionnaire)
├── /gate-result                    # Gating decision (pass/fail)
├── /screening/[sessionId]/
│   ├── walk-test                   # Walk test (pose detection, 12 sec capture)
│   ├── knee-test                   # Knee kit data collection
│   └── shoe-test                   # Shoe kit data collection
├── /result                         # Final screening result (with print export)
└── /test                           # Internal demo page
```

### Screening Flow (Real Path)
```
1. Welcome (/)
   ↓
2. Login (/login) — Health worker enters credentials
   ↓
3. Dashboard (/dashboard) — Health worker creates new patient session
   ↓
4. Intake Form (/intake) — Patient enters name, age, pain, stiffness, injury history
   ↓
5. Gate Decision (/gate-result) — Backend evaluates: age 40-100? Symptoms present?
   │
   ├─ PASS → Proceed to test
   │
   └─ FAIL → Show reason, suggest referral
   ↓
6. Walk Test (/screening/[sessionId]/walk-test) — 12-second pose detection capture
   │   - Camera stream starts
   │   - MediaPipe detects pose landmarks
   │   - Video recorded (uploaded to backend)
   │   - Falls back to simulated data if no landmarks collected
   ↓
7. Knee Test (/screening/[sessionId]/knee-test) — Knee kit data (simulated UI for now)
   ↓
8. Shoe Test (/screening/[sessionId]/shoe-test) — Shoe kit data (simulated UI for now)
   ↓
9. Result (/result) — ML model runs, shows risk level + explanation
   │   - Low/Moderate/High badge
   │   - Explanation: which sensor patterns drove the risk
   │   - Contributing factors list
   │   - Printable PDF (via @media print CSS)
   ↓
10. Dashboard (/dashboard) — Patient saved, health worker can view history
```

### Flow Implementation Details

**State Management**: `ScreeningProvider` (React Context) in `components/orthonova/screening-provider.tsx` holds:
- `sessionId` (patient_id)
- `intake` (form data)
- `submitted` (intake form posted)
- `testComplete` (walk test completed)
- `gateDecision` (pass/fail)
- `screeningResult` (final ML result)

**Auth**: `AuthProvider` stores `orthonova_auth_token` in `sessionStorage`. Persists across page refresh (key: `orthonova_auth_token`).

**Navigation Guards**: 
- If `!submitted`, show `<SessionNeeded />`
- If `!testComplete` on result page, show loading
- Walk test navigation waits for `progress===100 && testCompletedRef.current===true` before navigating to knee-test

---

## 7. Features: What's Actually Working vs. Not

| Feature | Status | Notes |
|---------|--------|-------|
| **User Authentication** | ✅ Fully Working | Login/logout, tokens persist in sessionStorage, auth header on API calls. Plain-text passwords (TODO: hash before production). |
| **Health Worker Dashboard** | ✅ Fully Working | List patients, view details, past results. Filters by current user. |
| **Patient Intake Form** | ✅ Fully Working | Collects name, age, gender, pain, stiffness, injury. Form validation. Bilingual labels (EN/HI). |
| **Gating Logic** | ✅ Fully Working | Age 40-100 check. Requires at least one symptom (pain > 0 OR stiffness > 0 OR prior injury). Returns pass/fail with reason. |
| **Walk Test (Pose Detection)** | ⚠️ Partially Working | MediaPipe loads from CDN (OK in dev/prod). Captures 12s of pose landmarks. **Known Bug**: Falls back to simulated data silently in production when cold-start backend timeouts occur. Frontend now has 120s timeout to mitigate. Real landmarks collected locally in dev, working toward production fix. |
| **Walk Test (Video Recording)** | ✅ Fully Working | 60s WebM video recorded, uploaded to backend, stored on disk. Playback available. |
| **Knee Kit UI** | ✅ UI Ready, Data Simulated | Shows sensor capture interface. Actual hardware data stubbed (simulated data generated). |
| **Shoe Kit UI** | ✅ UI Ready, Data Simulated | Shows sensor capture interface. Actual hardware data stubbed (simulated data generated). |
| **Feature Extraction** | ✅ Fully Working | 15 features extracted from shoe/knee/vision data. Works with both simulated and real sensor data. |
| **ML Risk Prediction** | ✅ Fully Working | Random Forest model (sklearn) trained on simulated data. Predicts Low/Moderate/High. Generates explanations from feature importance. |
| **Result Display** | ✅ Fully Working | Shows risk level, score, explanation, contributing factors. Real results by default (not sample placeholder). |
| **Print/PDF Export** | ✅ Fully Working | @media print CSS hides UI chrome, formats result for printing. Users print → save as PDF via browser. |
| **ESP32 Sensor Integration** | ⚠️ API Ready, Hardware Not Connected | Endpoints exist for shoe/knee sensor data. Hardware not yet connected. Data currently simulated. |
| **Real-time Pose Detection** | ❌ Not Working in Production | MediaPipe loads OK but pose detection silently fails in Vercel production (Render cold-start timeouts). Local dev works. Frontend now mitigates with 120s timeout + clear error messaging. |
| **Session Persistence** | ✅ Fully Working | Auth token persists in sessionStorage. Frontend state survives page refresh (sessionStorage-backed). |
| **Offline Support** | ❌ Not Implemented | No service workers. Requires online connection. |

---

## 8. Known Issues / Bugs (Current, Unresolved)

### Critical
1. **Walk Test Pose Detection Timeout in Production**
   - **Symptom**: Walk test page shows "collected 0 landmarks" and falls back to simulated data in Vercel production, even though MediaPipe loads.
   - **Root Cause**: Render free tier cold-start delay (30-50s) causes backend requests to timeout before browser default timeout. Frontend now has 120s timeout but issue may still occur with very slow starts.
   - **Evidence**: Console logs show `[WalkTest] collected 0 landmarks` and `using fallback simulated data`. Backend logs show no vision endpoint calls.
   - **Mitigation**: Added 120-second timeout in `lib/api.ts` + cold-start error messaging in walk-test.tsx.
   - **Real Fix Needed**: Pre-warm backend before first user request, or implement retry logic with exponential backoff.

### Medium
2. **Navigation Race Condition (Partially Fixed)**
   - **Symptom**: Walk test sometimes hangs after progress reaches 100%; navigation doesn't occur.
   - **Root Cause**: Dependency on `testCompletedRef.current` in useEffect dependencies (refs don't trigger re-renders). Fixed by removing from dependencies, but could still occur if executeWalkTest API call hangs indefinitely.
   - **Status**: Code fix applied; edge case remains if API timeout occurs.

3. **Password Storage in Plain Text**
   - **Symptom**: Passwords stored unencrypted in `users.password` column.
   - **Severity**: High for production. Development-only acceptable.
   - **Fix**: Implement passlib[bcrypt] password hashing before any real deployment.

### Low
4. **Demo Login Credentials Hard-Coded in setup_database.py**
   - **Symptom**: Same credentials (`demo`/`demo123`, `priya`/`priya123`) on every deployment.
   - **Impact**: Security risk if anyone runs setup_database.py on production DB.
   - **Fix**: Use environment variables or prompt for credentials during setup.

5. **No Token Expiry**
   - **Symptom**: Auth tokens valid forever (stored in db, checked on request, but no expiry check).
   - **Impact**: Compromised token never expires.
   - **Fix**: Add `expires_at` column to `auth_tokens`, check during validation.

6. **Simulated Data Always Generated When No Real Data Provided**
   - **Symptom**: If pose detection fails, `/run-test` still generates simulated shoe/knee/vision data instead of returning error.
   - **Impact**: User doesn't know if data is real or fallback.
   - **Mitigation**: Frontend now logs "using fallback simulated data" clearly. Backend returns `mode: "simulated"` in response.

7. **Print CSS Orphaned Text**
   - **Symptom**: Some text floats to next page awkwardly.
   - **Status**: Mitigated with `page-break-inside: avoid` rules on headings and paragraphs.
   - **Remaining**: Complex layouts may still break.

---

## 9. Environment Variables Reference

### Backend (`.env` or deployment)
```
# Database connection (MySQL via Aiven or local)
DATABASE_URL=mysql+pymysql://user:pass@host:3306/orthonova

# Optional CA certificate path for MySQL SSL (Aiven)
CA_CERT_PATH=/path/to/ca.pem

# CORS allowed origins (JSON array or comma-separated)
CORS_ORIGINS=["http://localhost:3000", "http://127.0.0.1:3000", "https://orthonova-frontend.vercel.app"]

# Environment mode
APP_ENV=production

# Debug mode (False for production)
DEBUG=False

# ML model risk thresholds (optional, defaults shown)
RISK_THRESHOLD_LOW=0.33
RISK_THRESHOLD_MODERATE=0.67

# Screening gate age limits
MIN_AGE_FOR_SCREENING=40
MAX_AGE_FOR_SCREENING=100
```

### Frontend (`.env.local` or deployment)
```
# Backend API URL (no trailing slash)
NEXT_PUBLIC_API_URL=https://orthonova-backend.onrender.com
```

### Production Deployment (Vercel + Render)
**Vercel**: `NEXT_PUBLIC_API_URL` set to Render backend URL
**Render**: `DATABASE_URL` and `CA_CERT_PATH` set to Aiven MySQL credentials

---

## 10. Deployment Info

### Live URLs (Current)
- **Frontend**: `https://orthonova-frontend.vercel.app` (assumed; verify in Vercel dashboard)
- **Backend**: `https://orthonova-backend.onrender.com`
- **GitHub**: Assumed private repo at `github.com/[org]/orthonova` (verify repo settings)

### Hosting Providers
| Service | Purpose | Tier | Notes |
|---------|---------|------|-------|
| **Vercel** | Frontend | Free | Auto-deploy from main. Edge runtime. Zero-config Next.js. CORS handled by backend. |
| **Render** | Backend (FastAPI) | Free | Free tier spins down after 15min inactivity. Cold-start 30-50s first request. 120s request timeout needed. |
| **Aiven** | MySQL Database | Free | Managed MySQL 8.0+. Requires SSL/TLS. CA cert provided. Monthly backups. |

### Deployment Workflow
1. **Frontend**: Push to main branch → Vercel auto-deploys within 1-2 min
2. **Backend**: Push to main branch → Render auto-deploys within 2-5 min (may wake from cold-start)
3. **Database**: No auto-deploy; schema managed via `init_db()` on backend startup (additive only)

### GitHub Repo
- **Primary Branch**: `main`
- **Commits**: Include Co-Author line: `Co-Authored-By: Claude Code <noreply@anthropic.com>`
- **Sensitive Files**: `.env`, `.env.local`, `backend/certs/ca.pem` are git-ignored

---

## 11. Hardware Integration Status

### Current State
**Simulated**: All sensor data currently generated by `backend/app/simulate/data_generator.py`. Hardware NOT yet connected.

### Shoe Sensor (FSR Pressure)
- **Simulated**: Yes. `DataGenerator.generate_shoe_data()` produces realistic normal/OA gait profiles.
- **Real Hardware**: Waiting for ESP32 + 4-point FSR sensors.
- **API Endpoint**: `POST /sessions/{patient_id}/sensors/shoe` accepts both single readings and batch arrays.
- **Data Format**: 
  - Single: `{timestamp, fsr_heel, fsr_midfoot, fsr_forefoot, fsr_toe}`
  - Batch: `{readings: [{timestamp, ...}, ...]}`
- **Status**: Backend ready. Hardware integration docs in `ESP32_INTEGRATION.md`.

### Knee Sensor (IMU Motion)
- **Simulated**: Yes. `DataGenerator.generate_knee_data()` produces realistic IMU patterns with knee flexion angles.
- **Real Hardware**: Waiting for ESP32 + MPU-6050 IMU sensors (2x: thigh + shin).
- **API Endpoint**: `POST /sessions/{patient_id}/sensors/knee` accepts both single readings and batch arrays.
- **Data Format**:
  - Single: `{timestamp, knee_flexion, thigh_angle, shin_angle}`
  - Batch: `{readings: [{timestamp, ...}, ...]}`
- **Status**: Backend ready. Hardware integration docs in `ESP32_INTEGRATION.md`.

### Vision Sensor (Pose Landmarks)
- **Simulated**: Yes. `DataGenerator.generate_vision_data()` produces mocked MediaPipe output.
- **Real Hardware**: Partially working. MediaPipe pose detection runs in browser (Next.js frontend) via `usePoseDetection.ts` hook.
  - Captures 12 seconds of pose landmarks from phone camera
  - Sends real landmarks to backend
  - Falls back to simulated data if detection fails (which happens in production cold-starts)
- **API Endpoint**: `POST /sessions/{patient_id}/sensors/vision` accepts pose landmarks.
- **Data Format**: `{landmarks: [{timestamp, left_hip_x, left_hip_y, ..., right_ankle_y}, ...]}`
- **Status**: 
  - Frontend capture: ✅ Working (local dev)
  - Browser pose detection: ✅ Works (MediaPipe from CDN)
  - Production upload: ⚠️ Broken (cold-start timeout). Mitigation in place.
  - Backend storage: ✅ Works

### Active Session Discovery (ESP32 Helper)
- **Endpoint**: `GET /sessions/active` (no auth required)
- **Purpose**: ESP32 calls this on boot to find the current patient_id for sensor submissions.
- **Response**: `{session_id, patient_id}` or `{session_id: null, patient_id: null}` if no active session.
- **Status**: ✅ Implemented. ESP32 can poll this to discover patient.

### What Hardware Team Needs to Do
1. Build ESP32 firmware with FSR + IMU reading loops
2. Call `/sessions/active` on boot to discover patient_id
3. Stream shoe data to `/sessions/{patient_id}/sensors/shoe` every 200ms (5 Hz)
4. Stream knee data to `/sessions/{patient_id}/sensors/knee` every 200ms (5 Hz)
5. See `ESP32_INTEGRATION.md` for complete Arduino code template

### Remaining Work
- [ ] Connect real ESP32 + sensors
- [ ] Test shoe/knee endpoints with real hardware (currently only simulated)
- [ ] Validate feature extraction works with real sensor noise
- [ ] Retrain ML model on real (not simulated) patient data once collected
- [ ] Fix production pose detection timeout issue (currently mitigated, not fixed)

---

## Project Status Summary

**Orthonova is a working prototype** with end-to-end screening flow (intake → test → results) running on local simulated data. Frontend and backend deploy successfully to Vercel + Render. Auth, patient management, and risk prediction all functional.

**Key Achievements**:
- ✅ Complete multi-modal screening workflow (questionnaire + 3-part test)
- ✅ Real-time pose detection via browser MediaPipe
- ✅ Feature extraction pipeline handles both real and simulated data
- ✅ ML risk prediction with explanations
- ✅ Health worker dashboard + patient history
- ✅ Video recording + storage
- ✅ Print-friendly result export

**Critical Issue Blocking Full Production**:
- ❌ Walk test pose detection fails silently in Vercel production due to Render free-tier cold-start timeouts. **Mitigation deployed** (120s timeout, error messaging). **Root fix needed**: pre-warm backend or implement retry logic.

**Not Yet Implemented**:
- ❌ Real ESP32 hardware (shoe/knee sensors) — APIs ready, hardware not connected
- ❌ Offline support (no service workers)
- ❌ Password hashing (plain-text, dev-only)
- ❌ Token expiry (tokens never expire)
- ❌ Production-grade error handling (some edge cases unhandled)

**Data Flow**: 
Frontend (Next.js) → Backend (FastAPI) → MySQL (Aiven) → ML Model → Results displayed. Sensors simulated; ready for real hardware endpoints when ESP32 team is ready.

**Deployment**: 
Frontend on Vercel (auto-deploy main), Backend on Render free tier (30-50s cold-start), Database on Aiven (managed MySQL with SSL). All costs near-zero for low traffic; traffic to production acceptable.


# Orthonova Quick Start Guide

## Prerequisites
- Node.js 18+ and npm
- Python 3.9+
- MySQL 8.0+

## First-Time Setup

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
# Edit .env with your MySQL credentials:
# DATABASE_URL=mysql+pymysql://orthonova_user:orthonova_pass@localhost/orthonova

# Initialize database tables and seed demo users
python setup_database.py

# Generate simulated training data and train initial model
python -m app.ml.train_model

# Start FastAPI server
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

Backend available at: `http://localhost:8000`  
API docs available at: `http://localhost:8000/docs`

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

Frontend available at: `http://localhost:3000`

## Demo Accounts

After running `setup_database.py`, two demo health worker accounts are available:

| Username | Password  | Full Name     |
|----------|-----------|---------------|
| `demo`   | `demo123` | Demo User     |
| `priya`  | `priya123`| Priya Sharma  |

## Login Flow

1. Navigate to `http://localhost:3000/login`
2. Enter one of the demo credentials above
3. On success, you'll be redirected to `/dashboard` showing your patients
4. Click "Create New Patient" to start a new screening session

## Patient Screening Flow

1. **Intake** (`/intake`) — Enter patient details (name, phone, address) and health questionnaire
2. **Gating** — System determines eligibility for walk test based on age/symptoms
3. **Walk Test** (`/test`) — Simulated sensor data collection (4-5 seconds)
4. **Results** (`/result`) — Risk assessment with explanation and next steps

Each completed screening is saved and appears in the dashboard, scoped to the logged-in health worker.

## Development Notes

- Patient data is now **persisted** in MySQL and scoped per health worker
- Sessions created before authentication was added will have `user_id=NULL` and won't appear in any dashboard (expected)
- Use different demo accounts to test multi-user isolation

## Security Warning

⚠️ **The current implementation uses plain-text passwords and simple session tokens for development convenience.**

**Before any real deployment with actual patient data:**
1. Implement password hashing using `passlib[bcrypt]`
2. Replace simple tokens with signed JWTs with expiry
3. Ensure all communication happens over HTTPS
4. Add proper token expiration and refresh mechanisms

See `README.md` for full details.

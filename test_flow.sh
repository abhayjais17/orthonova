#!/bin/bash

# Test script to run the complete screening flow and verify data in database

set -e

API_URL="http://localhost:8000"
DB_PATH="D:/orthonova/backend/app/db/orthonova.db"

echo "====== Starting Complete Flow Test ======"
echo ""

# 1. Create session
echo "[1/7] Creating session..."
SESSION_RESPONSE=$(curl -s -X POST "$API_URL/sessions/" \
  -H "Content-Type: application/json")
SESSION_ID=$(echo $SESSION_RESPONSE | grep -o '"session_id":"[^"]*' | cut -d'"' -f4)
echo "Session ID: $SESSION_ID"
echo ""

# 2. Submit intake (pass gate)
echo "[2/7] Submitting intake form..."
INTAKE_RESPONSE=$(curl -s -X POST "$API_URL/sessions/$SESSION_ID/intake" \
  -H "Content-Type: application/json" \
  -d '{
    "full_name": "Test User",
    "age": 65,
    "gender": "Male",
    "morning_stiffness_minutes": 30,
    "pain_severity": 7,
    "pain_duration_category": "months",
    "prior_knee_injury": false,
    "prior_knee_surgery": false
  }')
echo "Gate decision: $INTAKE_RESPONSE"
echo ""

# 3. Submit walk test (vision data)
echo "[3/7] Submitting vision data..."
VISION_RESPONSE=$(curl -s -X POST "$API_URL/sessions/$SESSION_ID/sensors/vision" \
  -H "Content-Type: application/json" \
  -d '{
    "landmarks": [
      {
        "timestamp": 1000,
        "left_hip_x": 100, "left_hip_y": 200,
        "right_hip_x": 150, "right_hip_y": 200,
        "left_knee_x": 110, "left_knee_y": 300,
        "right_knee_x": 160, "right_knee_y": 300,
        "left_ankle_x": 120, "left_ankle_y": 400,
        "right_ankle_x": 170, "right_ankle_y": 400
      }
    ]
  }')
echo "Vision submission: $VISION_RESPONSE"
echo ""

# 4. Submit knee test data
echo "[4/7] Submitting knee sensor data..."
KNEE_RESPONSE=$(curl -s -X POST "$API_URL/sessions/$SESSION_ID/sensors/knee" \
  -H "Content-Type: application/json" \
  -d '{
    "readings": [
      {"timestamp": 1000, "knee_flexion": 65.0, "thigh_angle": 30.0, "shin_angle": 35.0},
      {"timestamp": 1200, "knee_flexion": 66.0, "thigh_angle": 31.0, "shin_angle": 36.0},
      {"timestamp": 1400, "knee_flexion": 67.0, "thigh_angle": 32.0, "shin_angle": 37.0}
    ]
  }')
echo "Knee submission: $KNEE_RESPONSE"
echo ""

# 5. Submit shoe test data
echo "[5/7] Submitting shoe sensor data..."
SHOE_RESPONSE=$(curl -s -X POST "$API_URL/sessions/$SESSION_ID/sensors/shoe" \
  -H "Content-Type: application/json" \
  -d '{
    "readings": [
      {"timestamp": 2000, "fsr_heel": 200.0, "fsr_midfoot": 50.0, "fsr_forefoot": 30.0, "fsr_toe": 10.0},
      {"timestamp": 2200, "fsr_heel": 210.0, "fsr_midfoot": 55.0, "fsr_forefoot": 35.0, "fsr_toe": 15.0},
      {"timestamp": 2400, "fsr_heel": 220.0, "fsr_midfoot": 60.0, "fsr_forefoot": 40.0, "fsr_toe": 20.0}
    ]
  }')
echo "Shoe submission: $SHOE_RESPONSE"
echo ""

# 6. Check database for saved data
echo "[6/7] Checking database for saved data..."
echo ""

# Query camera_pose_data
echo "  Camera Pose Data:"
sqlite3 "$DB_PATH" "SELECT COUNT(*), MAX(patient_id) FROM camera_pose_data WHERE patient_id = $SESSION_ID;" || echo "    (query failed)"

# Query knee_sensor_data
echo "  Knee Sensor Data:"
sqlite3 "$DB_PATH" "SELECT COUNT(*), MAX(patient_id) FROM knee_sensor_data WHERE patient_id = $SESSION_ID;" || echo "    (query failed)"

# Query shoe_sensor_data
echo "  Shoe Sensor Data:"
sqlite3 "$DB_PATH" "SELECT COUNT(*), MAX(patient_id) FROM shoe_sensor_data WHERE patient_id = $SESSION_ID;" || echo "    (query failed)"

echo ""

# 7. Get result
echo "[7/7] Fetching screening result..."
RESULT=$(curl -s -X GET "$API_URL/sessions/$SESSION_ID/result")
echo "Result: $RESULT"
echo ""

echo "====== Test Complete ======"

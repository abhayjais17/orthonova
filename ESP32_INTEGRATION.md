# ESP32 Sensor Integration Guide

## Base URL
```
https://orthonova-backend.onrender.com
```

**Important**: The Render free tier spins down after inactivity. The first request after a period of inactivity may take 30-50 seconds to respond while the server wakes up. For live demos, send a test request 1-2 minutes before the demo starts to ensure the server is awake.

---

## Integration Flow

### 1. Get Active Session
**Before sending any sensor data**, the ESP32 must first discover which patient session is currently active.

**Endpoint**: `GET /sessions/active`

**Request**:
```
GET https://orthonova-backend.onrender.com/sessions/active
```

**Response** (when a session is active):
```json
{
  "session_id": 48,
  "patient_id": 48
}
```

**Response** (when no active session):
```json
{
  "session_id": null,
  "patient_id": null
}
```

**Usage in ESP32 code**:
- Call this endpoint once on boot or before starting sensor streaming
- Store the `patient_id` value
- Use this `patient_id` in all subsequent sensor POST requests
- If you get `null`, wait and retry (no patient is currently going through the flow)

---

## 2. Shoe Sensor Data (FSR Pressure Sensors)

**Endpoint**: `POST /sessions/{patient_id}/sensors/shoe`

Replace `{patient_id}` with the value obtained from `/sessions/active`.

**Single Reading** (recommended for real-time streaming):
```json
{
  "timestamp": 1726228887,
  "fsr_heel": 200.5,
  "fsr_midfoot": 50.3,
  "fsr_forefoot": 75.8,
  "fsr_toe": 25.1
}
```

**Batch Readings** (if buffering multiple readings):
```json
{
  "readings": [
    {
      "timestamp": 1726228887,
      "fsr_heel": 200.5,
      "fsr_midfoot": 50.3,
      "fsr_forefoot": 75.8,
      "fsr_toe": 25.1
    },
    {
      "timestamp": 1726228888,
      "fsr_heel": 210.2,
      "fsr_midfoot": 52.1,
      "fsr_forefoot": 77.3,
      "fsr_toe": 26.4
    }
  ]
}
```

**Field Descriptions**:
- `timestamp`: Unix timestamp (seconds since epoch). Use `millis()` converted to seconds, or sync with NTP.
- `fsr_heel`: Force-sensitive resistor reading from heel sensor (0-1023 or calibrated to Newtons)
- `fsr_midfoot`: FSR reading from midfoot sensor
- `fsr_forefoot`: FSR reading from forefoot sensor
- `fsr_toe`: FSR reading from toe sensor

**Response**:
```json
{
  "stored_readings": 1,
  "mode": "real"
}
```

---

## 3. Knee Sensor Data (IMU Motion Sensors)

**Endpoint**: `POST /sessions/{patient_id}/sensors/knee`

Replace `{patient_id}` with the value obtained from `/sessions/active`.

**Single Reading** (recommended for real-time streaming):
```json
{
  "timestamp": 1726228887,
  "knee_flexion": 65.5,
  "thigh_angle": 30.2,
  "shin_angle": 35.3
}
```

**Batch Readings** (if buffering multiple readings):
```json
{
  "readings": [
    {
      "timestamp": 1726228887,
      "knee_flexion": 65.5,
      "thigh_angle": 30.2,
      "shin_angle": 35.3
    },
    {
      "timestamp": 1726228888,
      "knee_flexion": 66.1,
      "thigh_angle": 31.0,
      "shin_angle": 35.1
    }
  ]
}
```

**Field Descriptions**:
- `timestamp`: Unix timestamp (seconds since epoch)
- `knee_flexion`: Knee flexion angle in degrees (0-180, where 0 is fully extended)
- `thigh_angle`: Thigh orientation angle in degrees relative to vertical
- `shin_angle`: Shin orientation angle in degrees relative to vertical

**Response**:
```json
{
  "stored_readings": 1,
  "mode": "real"
}
```

---

## ESP32 Arduino Code Template

```cpp
#include <WiFi.h>
#include <HTTPClient.h>
#include <ArduinoJson.h>

// WiFi credentials (configure these)
const char* ssid = "YOUR_WIFI_SSID";
const char* password = "YOUR_WIFI_PASSWORD";

// Backend URL
const char* baseUrl = "https://orthonova-backend.onrender.com";

// Current patient ID (obtained from /sessions/active)
int currentPatientId = -1;

void setup() {
  Serial.begin(115200);
  
  // Connect to WiFi
  WiFi.begin(ssid, password);
  while (WiFi.status() != WL_CONNECTED) {
    delay(500);
    Serial.print(".");
  }
  Serial.println("\nWiFi connected");
  
  // Get active session
  getActiveSession();
}

void loop() {
  if (currentPatientId > 0) {
    // Read sensor data
    float heelPressure = analogRead(FSR_HEEL_PIN);
    float midfootPressure = analogRead(FSR_MIDFOOT_PIN);
    float forefootPressure = analogRead(FSR_FOREFOOT_PIN);
    float toePressure = analogRead(FSR_TOE_PIN);
    
    // Send to backend
    sendShoeData(heelPressure, midfootPressure, forefootPressure, toePressure);
    
    delay(200); // Send every 200ms (adjust as needed)
  } else {
    // No active session, retry
    delay(5000);
    getActiveSession();
  }
}

void getActiveSession() {
  if (WiFi.status() == WL_CONNECTED) {
    HTTPClient http;
    String url = String(baseUrl) + "/sessions/active";
    
    http.begin(url);
    http.setTimeout(60000); // 60 second timeout (for server wake-up)
    int httpCode = http.GET();
    
    if (httpCode == 200) {
      String payload = http.getString();
      DynamicJsonDocument doc(1024);
      deserializeJson(doc, payload);
      
      if (!doc["patient_id"].isNull()) {
        currentPatientId = doc["patient_id"];
        Serial.print("Active patient ID: ");
        Serial.println(currentPatientId);
      } else {
        Serial.println("No active session");
        currentPatientId = -1;
      }
    } else {
      Serial.print("Error getting active session: ");
      Serial.println(httpCode);
    }
    
    http.end();
  }
}

void sendShoeData(float heel, float midfoot, float forefoot, float toe) {
  if (WiFi.status() == WL_CONNECTED) {
    HTTPClient http;
    String url = String(baseUrl) + "/sessions/" + String(currentPatientId) + "/sensors/shoe";
    
    http.begin(url);
    http.addHeader("Content-Type", "application/json");
    
    // Create JSON payload
    DynamicJsonDocument doc(512);
    doc["timestamp"] = millis() / 1000; // Convert to seconds
    doc["fsr_heel"] = heel;
    doc["fsr_midfoot"] = midfoot;
    doc["fsr_forefoot"] = forefoot;
    doc["fsr_toe"] = toe;
    
    String jsonPayload;
    serializeJson(doc, jsonPayload);
    
    int httpCode = http.POST(jsonPayload);
    
    if (httpCode == 200) {
      Serial.println("Shoe data sent successfully");
    } else {
      Serial.print("Error sending shoe data: ");
      Serial.println(httpCode);
    }
    
    http.end();
  }
}

void sendKneeData(float flexion, float thighAngle, float shinAngle) {
  if (WiFi.status() == WL_CONNECTED) {
    HTTPClient http;
    String url = String(baseUrl) + "/sessions/" + String(currentPatientId) + "/sensors/knee";
    
    http.begin(url);
    http.addHeader("Content-Type", "application/json");
    
    // Create JSON payload
    DynamicJsonDocument doc(512);
    doc["timestamp"] = millis() / 1000; // Convert to seconds
    doc["knee_flexion"] = flexion;
    doc["thigh_angle"] = thighAngle;
    doc["shin_angle"] = shinAngle;
    
    String jsonPayload;
    serializeJson(doc, jsonPayload);
    
    int httpCode = http.POST(jsonPayload);
    
    if (httpCode == 200) {
      Serial.println("Knee data sent successfully");
    } else {
      Serial.print("Error sending knee data: ");
      Serial.println(httpCode);
    }
    
    http.end();
  }
}
```

---

## Important Notes

1. **WiFi Configuration**: The ESP32 must have WiFi credentials (SSID and password) configured in the sketch. These are not provided by the backend.

2. **First Request Delay**: The first HTTP request after the server has been idle may take 30-50 seconds. Set HTTPClient timeout to at least 60 seconds for the initial `/sessions/active` call.

3. **Active Session Logic**: An "active session" is defined as:
   - A patient who has completed intake/questionnaire
   - Has NOT yet received their final results
   - This is the patient currently going through walk test → knee kit → shoe kit

4. **Error Handling**: If `/sessions/active` returns null or if POST requests fail, the ESP32 should wait and retry. Don't spam the server with rapid retries.

5. **Timestamp**: Use Unix timestamp in seconds. If the ESP32 doesn't have NTP sync, you can omit the timestamp field and the server will use its own timestamp.

6. **No Authentication**: The sensor endpoints don't require authentication tokens (designed for hardware without credential storage). The `patient_id` in the URL path is sufficient.

7. **Sampling Rate**: Recommended 5-10 Hz (every 100-200ms) for real-time streaming. The backend can handle higher rates if needed.

---

## Testing

Use `curl` to test the endpoints:

```bash
# Get active session
curl https://orthonova-backend.onrender.com/sessions/active

# Send single shoe reading (replace 48 with actual patient_id)
curl -X POST https://orthonova-backend.onrender.com/sessions/48/sensors/shoe \
  -H "Content-Type: application/json" \
  -d '{"timestamp": 1726228887, "fsr_heel": 200, "fsr_midfoot": 50, "fsr_forefoot": 75, "fsr_toe": 25}'

# Send single knee reading
curl -X POST https://orthonova-backend.onrender.com/sessions/48/sensors/knee \
  -H "Content-Type: application/json" \
  -d '{"timestamp": 1726228887, "knee_flexion": 65, "thigh_angle": 30, "shin_angle": 35}'
```

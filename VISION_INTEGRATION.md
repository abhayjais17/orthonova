# Real-Time Vision/Pose Detection Integration

## Summary

The walk test screen (`/test`) now uses **real, in-browser pose detection** via MediaPipe instead of purely simulated vision data. Video processing happens locally on the device with no network transmission of raw video.

## Architecture

### Frontend Components

**1. `lib/usePoseDetection.ts` - Core Pose Detection Hook**
- Initializes MediaPipe's PoseLandmarker (lite model) via FilesetResolver
- Manages camera access via `getUserMedia` API
- Processes video frames in real-time using `requestAnimationFrame`
- Extracts 33 body landmarks from each frame, specifically tracking:
  - Hip positions (left/right)
  - Knee positions (left/right) 
  - Ankle positions (left/right)
- Normalizes landmark coordinates to frame dimensions
- Returns time-series landmark data in the contract expected by the backend

**Key Interfaces:**
```typescript
interface PoseLandmarkFrame {
  timestamp: number
  left_hip_x, left_hip_y
  right_hip_x, right_hip_y
  left_knee_x, left_knee_y
  right_knee_x, right_knee_y
  left_ankle_x, left_ankle_y
  right_ankle_x, right_ankle_y
}

interface PoseDetectionState {
  isLoading: boolean
  error: string | null
  isDetecting: boolean
  frameCount: number
  landmarks: PoseLandmarkFrame[]
}
```

**2. `components/orthonova/walk-test.tsx` - Updated Walk Test UI**
- Shows live video preview during the vision capture phase (12 seconds)
- Displays real-time frame count and countdown
- Gracefully handles camera permission denial with fallback to simulated data
- Integrates with pose detection hook to collect real landmark time series
- Passes collected landmarks to the backend for feature extraction

**Key Flow:**
1. User starts test → Camera permission requested
2. 12-second pose detection window begins
3. Live video shows in preview with landmark detection status
4. After 12s, collected landmarks sent to backend alongside simulated shoe/knee data
5. If camera unavailable/denied → Falls back to fully simulated data

**3. `lib/api.ts` - Updated API Client**
- Added `PoseLandmark` and `VisionDataRequest` types
- Added `submitVisionData()` method to send real landmarks directly to `/sessions/{id}/sensors/vision`
- Updated `runTest()` to preserve existing vision data if already submitted

**4. `components/orthonova/screening-provider.tsx` - Updated Context**
- Modified `executeWalkTest()` to accept optional real vision data
- Submits real landmarks if available, otherwise uses simulated test pipeline

### Backend Changes

**1. `app/api/results.py` - Smart Test Runner**
- Added `RunTestRequest` model to accept optional vision data
- Updated `run_test` endpoint to:
  - Check if vision data already exists (from real camera)
  - Only generate simulated vision data if none provided
  - Generate simulated shoe/knee data as before
  - Preserve real vision data for feature extraction

**Data Flow:**
```
Frontend (real vision) → POST /sensors/vision → Stored in DB
Frontend → POST /run-test → Generates shoe/knee, skips vision if exists
Backend → GET /result → Extracts features from all data (real vision + sim shoe/knee)
```

## Feature Extraction

Vision features extracted from real landmarks by `backend/app/features/feature_extraction.py`:

1. **avg_stride_length** - Peak-to-peak range of ankle x-positions, normalized by patient height
2. **gait_symmetry** - Ratio of left/right stride (1.0 = perfect symmetry)
3. **posture_sway** - Standard deviation of hip center position (x,y)

These match the same contract the ML model expects from simulated data.

## Camera & Privacy

- **Local Processing**: Video frames never leave the device; only pose landmarks are transmitted
- **Permission Handling**: Browser permission dialog shown on first access
- **Fallback**: If user denies camera, test continues with fully simulated data (no error)
- **Network**: Only JSON landmark data (~1-2 KB per frame × ~24 fps × 12s = ~288 frames = ~500 KB max) sent to backend

## Model Details

- **MediaPipe Version**: @mediapipe/tasks-vision@1.0.1
- **Model**: `pose_landmarker_lite` (lightweight, suitable for modest hardware)
- **Running Mode**: VIDEO (real-time frame processing)
- **Output**: 33 landmarks per frame (we use hip, knee, ankle)
- **Latency**: Real-time on modern hardware; gracefully skips frames if processing can't keep up

## Testing Checklist

- [ ] Frontend: Camera permission flow works (allow/deny)
- [ ] Frontend: Live video preview visible during capture
- [ ] Frontend: Pose landmarks detected and collected (frame count > 0)
- [ ] Frontend: Real landmarks sent to backend on walk test completion
- [ ] Backend: Real vision data stored in `vision_data` table
- [ ] Backend: `/run-test` preserves existing vision data
- [ ] Backend: Feature extraction produces vision features from real data
- [ ] Backend: ML prediction uses real vision mixed with simulated shoe/knee
- [ ] Backend: Result returned successfully with risk assessment
- [ ] E2E: Full walk test flow works with real camera → backend → result

## Deployment Notes

- MediaPipe model files loaded from CDN (jsdelivr)
- No changes to existing shoe/knee sensor pipelines (remain simulated)
- Fully backward compatible: if no camera, test works with simulated data
- No additional server-side dependencies required

## Future Enhancements

- Shoe & knee sensor data collection from ESP32 hardware
- Post-processing of raw landmarks (smoothing, confidence filtering)
- Visualization of detected pose overlaid on video
- Mobile-optimized camera capture

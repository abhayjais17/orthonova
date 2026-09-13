# MediaPipe Race Condition Fix

## Problem

The walk test screen showed a black video preview and threw the following error:

```
Uncaught TypeError: Cannot read properties of undefined (reading 'startTime')
  at et.reportAllChanges (<anonymous>:2:19429)
```

Preceded by:
```
Graph successfully started running.
Graph finished closing successfully.
```

## Root Cause

**React Strict Mode double-invoke race condition** with MediaPipe's PoseLandmarker lifecycle:

1. Component mounts → `useEffect` runs → PoseLandmarker initialized
2. React Strict Mode triggers cleanup → `poseLandmarkerRef.current.close()` called
3. Strict Mode re-runs effect → Second PoseLandmarker created
4. First landmarker's internal graph is closed, but `detectForVideo()` callbacks from `requestAnimationFrame` are still pending
5. Stale callback fires → tries to access internal properties on a disposed/closed graph → crash

The crash prevented the video from rendering because the detection loop never started properly.

## Solution

Added **three layers of guards** in `lib/usePoseDetection.ts`:

### 1. Mount Guard (`isMountedRef`)
```typescript
const isMountedRef = useRef(true)

useEffect(() => {
  isMountedRef.current = true
  // ... initialization
  return () => {
    isMountedRef.current = false
    // All async operations check this before proceeding
  }
}, [])
```

Prevents stale async callbacks from executing after unmount.

### 2. Initialization Guard (`isInitializingRef`)
```typescript
const isInitializingRef = useRef(false)

// Skip if already initializing (Strict Mode guard)
if (isInitializingRef.current) {
  return
}

isInitializingRef.current = true
// ... create PoseLandmarker
isInitializingRef.current = false
```

Prevents double initialization from Strict Mode, ensuring only **one** PoseLandmarker instance per mount.

### 3. Detection Active Guard (`isDetectionActiveRef`)
```typescript
const isDetectionActiveRef = useRef(false)

const processFrame = useCallback(async () => {
  // Guard: check all conditions before calling detectForVideo
  if (
    !isMountedRef.current ||
    !isDetectionActiveRef.current ||
    !poseLandmarkerRef.current ||
    !videoRef.current
  ) {
    return
  }

  // Safe to call detectForVideo
  const result = poseLandmarkerRef.current.detectForVideo(video, timestamp)

  // Guard: check again after detectForVideo completes (async boundary)
  if (!isDetectionActiveRef.current || !isMountedRef.current) {
    return // Don't process result from a stale/closed instance
  }

  // ... process result
}, [])
```

Ensures `detectForVideo` is never called on a closed/stale landmarker, and results from stale calls are discarded.

### 4. Cleanup Order Fix

**Before:**
```typescript
return () => {
  if (poseLandmarkerRef.current) {
    poseLandmarkerRef.current.close() // ❌ Animation frame still running!
  }
}
```

**After:**
```typescript
return () => {
  isMountedRef.current = false

  // FIRST: Stop the detection loop (cancel animation frame)
  if (animationFrameRef.current !== null) {
    cancelAnimationFrame(animationFrameRef.current)
    animationFrameRef.current = null
  }
  isDetectionActiveRef.current = false

  // THEN: Close the landmarker (graph is now idle)
  if (poseLandmarkerRef.current) {
    try {
      poseLandmarkerRef.current.close()
    } catch (err) {
      console.error('Error closing pose landmarker:', err)
    }
    poseLandmarkerRef.current = null
  }
}
```

Cancel the animation frame loop **before** closing the MediaPipe graph, so no `detectForVideo` calls are in-flight when `.close()` is called.

### 5. Video Element Attributes

Added `autoPlay` to the video element (was missing):

```tsx
<video
  ref={poseDetection.videoRef}
  autoPlay  // ✅ Added
  playsInline
  muted
/>
```

Also set these programmatically in `startCamera`:
```typescript
videoRef.current.autoplay = true
videoRef.current.playsInline = true
videoRef.current.muted = true
```

## Testing Checklist

After this fix, verify:

- [x] Frontend builds with no TypeScript errors
- [ ] No console errors during walk test (check for "Cannot read properties of undefined")
- [ ] "Graph successfully started running" appears once (not twice)
- [ ] "Graph finished closing successfully" only appears on unmount (not mid-detection)
- [ ] Live camera feed is **visible** (not a black box)
- [ ] Frame count increments during detection
- [ ] Green landmark dots appear on the person in the video
- [ ] Detection completes successfully after 12 seconds
- [ ] Real landmark data is sent to backend

## Technical Details

**React Strict Mode** intentionally double-invokes effects in development to surface cleanup bugs. The pattern:

1. Mount → Effect → Cleanup → Effect again

This is **good** — it caught a real bug that would have occurred in production when:
- User navigates away mid-detection
- Component re-renders during detection
- Multiple instances of the component exist (e.g., modal + page)

The fix ensures the component is **idempotent** and safe under Strict Mode.

## Files Changed

- `frontend/lib/usePoseDetection.ts` - Added guards and fixed cleanup order
- `frontend/components/orthonova/walk-test.tsx` - Added `autoPlay` attribute
- `RACE_CONDITION_FIX.md` - This document

# Camera Preview Black Screen Fix

## Problem

The `<video>` element on the `/test` walk-test screen remained completely black despite camera permission being granted and stream being active. Debug logs revealed:

```
[PoseDetection] getUserMedia resolved successfully ✓ (stream valid)
[PoseDetection] videoRef.current: null ✗ (ref not attached)
[PoseDetection] videoElement in DOM? false ✗ (element not rendered yet)
```

## Root Cause

**Race condition between state update and ref attachment:**

In the original `handleStart()` function:
```typescript
const handleStart = async () => {
  setShowCamera(true)           // 1. Request state change
  
  try {
    await poseDetection.startCamera()  // 2. Immediately call startCamera()
    // ← At this point, the <video> element hasn't been rendered yet!
  }
}
```

The `<video>` element is conditionally rendered:
```tsx
{showCamera && cameraReady && (
  <video ref={poseDetection.videoRef} ... />
)}
```

So the sequence was:
1. `handleStart()` calls `setShowCamera(true)`
2. `handleStart()` immediately calls `startCamera()` (before React renders)
3. `startCamera()` tries to use `videoRef.current` → **null** (element not in DOM yet)
4. Stream is created but never attached to a video element
5. Only the canvas draws (which is now the display element), but it has no video frames to draw

## Solution

**Moved the camera initialization into a `useEffect` that triggers AFTER the render:**

```typescript
// Track whether we've initialized camera for the current test run
const cameraInitRef = useRef(false)

// When showCamera becomes true, start the camera after render completes
useEffect(() => {
  if (showCamera && !cameraInitRef.current && running) {
    cameraInitRef.current = true

    const initCamera = async () => {
      // Camera initialization (all the startCamera, startDetection logic)
      // This runs AFTER React has rendered the <video> element
    }

    // Use setTimeout to ensure we're after the render cycle
    setTimeout(initCamera, 0)
  }
}, [showCamera, running])

// handleStart() now just sets state
const handleStart = async () => {
  setRunning(true)
  setShowCamera(true)      // ← Triggers useEffect
  setVisionPhase(true)
}
```

**Key insights:**
- `setShowCamera(true)` triggers a re-render
- The `useEffect` dependency `[showCamera, running]` fires AFTER that render
- By that time, the `<video>` element exists in DOM and `videoRef.current` is attached
- `setTimeout(initCamera, 0)` ensures we're in the next microtask after render
- `cameraInitRef` prevents double-initialization from Strict Mode

## JSX Changes

Added `<canvas>` element as the visible display layer (video draws to canvas each frame):

```tsx
{showCamera && cameraReady && (
  <div className="rounded-lg border-2 border-secondary bg-muted overflow-hidden relative">
    <video
      ref={poseDetection.videoRef}
      style={{ display: 'none' }}
    />
    <canvas
      ref={poseDetection.canvasRef}
      className="w-full bg-black"
      style={{ display: 'block' }}
    />
  </div>
)}
```

The `<video>` is hidden but still exists and receives the media stream. The `<canvas>` is visible and displays the video frames + pose landmarks that `processFrame()` draws every animation frame.

## Testing Checklist

After this fix, verify:

- [x] Frontend builds with no TypeScript errors
- [ ] Start walk test, allow camera permission
- [ ] Debug logs should show: `[PoseDetection] startCamera called` (in useEffect)
- [ ] Debug logs should show: `[PoseDetection] videoRef.current: <video>` (NOT null)
- [ ] Debug logs should show: `[PoseDetection] Video drawn to canvas...`
- [ ] **Live camera feed is VISIBLE** in the preview box (not black)
- [ ] Green landmark circles appear on detected person
- [ ] Frame count increments during 12-second capture
- [ ] Detection completes and sends real landmarks to backend
- [ ] Final result is generated with real vision + simulated shoe/knee data

## Files Modified

- `components/orthonova/walk-test.tsx` - Moved camera init to useEffect
- `lib/usePoseDetection.ts` - Added comprehensive debug logging

## Debug Logging

The temporary console logs can be removed once verified working. Key ones:

```typescript
console.log('[PoseDetection] startCamera called')
console.log('[PoseDetection] videoRef.current:', videoElement)
console.log('[PoseDetection] Video drawn to canvas...')
```

These helped identify that `videoRef.current` was null at the critical moment.

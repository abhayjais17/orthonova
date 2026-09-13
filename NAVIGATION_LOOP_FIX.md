# Navigation Loop and Video Black Screen Fix

## Problem

The walk test exhibited two related issues:

1. **Video preview remained completely black** despite camera permission being granted and stream being active
2. **Repeated automatic page reloads** visible as rapid `GET /result 200` requests in dev server terminal
3. **Repeated `AbortError: The play() request was interrupted by a new load request`** in browser console
4. The video stream was being torn down and re-initialized repeatedly, never getting a stable moment to render frames

## Root Causes

### 1. Router Object in useEffect Dependency Array

**Location:** `components/orthonova/walk-test.tsx` line 68

**Problem:**
```typescript
useEffect(() => {
  if (progress < 100 || !running) return
  setTestComplete(true)
  const timer = setTimeout(() => router.push('/result'), 900)
  return () => clearTimeout(timer)
}, [progress, running, router, setTestComplete])  // ← router object here
```

In Next.js, the `router` object from `useRouter()` can be recreated on renders, causing this effect to fire repeatedly when `progress` hits 100. Each fire schedules another navigation, creating a loop.

**Fix:** Removed `router` from dependency array. The effect only needs to respond to `progress` and `running` changes, not router changes.

```typescript
}, [progress, running, setTestComplete])  // ✓ Fixed
```

### 2. useSWR Automatic Revalidation on Result Page

**Location:** `components/orthonova/screening-result.tsx` line 91-95

**Problem:**
```typescript
const { data: fetchedResult, error, isLoading, mutate } = useSWR(
  !samplePatient && submitted && testComplete && sessionId ? ['screening-result', sessionId] : null,
  fetchResult,
  { revalidateOnFocus: false },  // ← Only one setting disabled
)
```

`useSWR` has **multiple automatic revalidation mechanisms enabled by default:**
- `revalidateOnReconnect: true` - refetches when browser reconnects to network
- `revalidateIfStale: true` - refetches if data is marked stale
- `dedupingInterval: 2000ms` - only 2 second dedup window

When the `/result` page loaded, useSWR would:
1. Fetch the result initially
2. Automatically revalidate on any network/state change
3. Each revalidation would trigger a re-render
4. This caused the appearance of repeated page reloads
5. If user was still navigating away from `/test`, the camera stream would be repeatedly interrupted

**Fix:** Disabled all automatic revalidation since we only want to fetch once when landing on the result page:

```typescript
const { data: fetchedResult, error, isLoading, mutate } = useSWR(
  !samplePatient && submitted && testComplete && sessionId ? ['screening-result', sessionId] : null,
  fetchResult,
  {
    revalidateOnFocus: false,
    revalidateOnReconnect: false,
    revalidateIfStale: false,
    dedupingInterval: 60000, // Long dedup interval to prevent accidental refetches
  },
)
```

## How They Were Related

The two issues compounded each other:

1. Navigation loop from router dependency → rapid navigation back/forth between `/test` and `/result`
2. useSWR revalidation → additional fetches/re-renders on `/result` page
3. Camera stream on `/test` never got a stable moment to attach to video element and render
4. `video.play()` promises kept getting interrupted → `AbortError`
5. Video stayed black because frames never rendered

## Testing Checklist

After these fixes, verify:

- [ ] Dev server terminal shows `/test` loads exactly once when starting walk test
- [ ] Dev server terminal shows `/result` loads exactly once when test completes
- [ ] No repeated `GET /test` or `GET /result` requests in terminal
- [ ] Browser console shows `[PoseDetection] srcObject assigned, count: 1` (exactly once)
- [ ] No `AbortError` messages in console (or only one on navigation away, which is expected)
- [ ] **Camera feed is VISIBLE** (not black) during the 12-second capture
- [ ] Green landmark dots appear on detected person
- [ ] Frame count increments during detection
- [ ] Navigation from `/test` to `/result` happens exactly once after completion

## Files Changed

- `components/orthonova/walk-test.tsx` - Removed `router` from navigation effect dependency array
- `components/orthonova/screening-result.tsx` - Disabled useSWR automatic revalidation
- `lib/usePoseDetection.ts` - Added srcObject assignment counter for debugging

## Additional Improvements Made Earlier

- Implemented callback ref pattern to fix videoRef null issue
- Added pendingStreamRef to handle race between stream and element mounting
- Fixed cleanup order (cancel animation frame before closing MediaPipe graph)
- Silenced harmless AbortError when navigating away

## Next Steps

Once verified working:
- Remove debug console logs from both `usePoseDetection.ts` and `walk-test.tsx`
- Remove `assignCountRef` counter (was for debugging only)
- Verify camera feed renders visibly during test
- Verify detection completes and sends real landmarks to backend

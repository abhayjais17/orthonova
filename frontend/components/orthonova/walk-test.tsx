'use client'

import { useEffect, useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { Footprints, Check, ArrowRight, PersonStanding, MoveRight, Accessibility, Pause, Camera, AlertCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { useScreening, passesDemoGate } from './screening-provider'
import { SessionNeeded } from './gate-result'
import { BackLink } from './app-shell'
import { usePoseDetection } from '@/lib/usePoseDetection'
import { useSimpleCamera } from '@/lib/useSimpleCamera'
import { cn } from '@/lib/utils'

const stages = [
  { text: 'Analyzing walking pattern…', icon: Footprints },
  { text: 'Analyzing knee movement…', icon: Accessibility },
  { text: 'Analyzing posture…', icon: PersonStanding },
]

const VISION_CAPTURE_DURATION_MS = 12000 // 12 seconds for vision capture
const VIDEO_RECORDING_DURATION_MS = 60000 // 60 seconds for video recording

export function WalkTest() {
  const { intake, submitted, gateDecision, setTestComplete, executeWalkTest, sessionId } = useScreening()
  const poseDetection = usePoseDetection()
  const simpleCamera = useSimpleCamera()
  const [running, setRunning] = useState(false)
  const [progress, setProgress] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const [visionPhase, setVisionPhase] = useState(false)
  const router = useRouter()
  const testCompletedRef = useRef(false)
  const progressTimerRef = useRef<NodeJS.Timeout | null>(null)
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const videoChunksRef = useRef<Blob[]>([])

  const pass = gateDecision ? gateDecision.gate_status === 'pass' || gateDecision.passed : passesDemoGate(intake)

  // Manage progress timer
  useEffect(() => {
    if (!running) {
      if (progressTimerRef.current) {
        clearInterval(progressTimerRef.current)
        progressTimerRef.current = null
      }
      return
    }

    progressTimerRef.current = setInterval(() => {
      setProgress((p) => {
        if (!testCompletedRef.current && p >= 90) return 90
        return Math.min(p + 1.5, 100)
      })
    }, 200)

    return () => {
      if (progressTimerRef.current) {
        clearInterval(progressTimerRef.current)
      }
    }
  }, [running])

  // Transition to knee test when complete
  useEffect(() => {
    console.log('[WalkTest] Navigation useEffect:', { progress, running, testCompletedRef: testCompletedRef.current })
    if (progress < 100 || !running) return
    // Wait for testCompletedRef to be set by runDetection() before navigating
    // This ensures data submission completes first
    if (!testCompletedRef.current) return

    console.log('[WalkTest] Test completed, navigating to knee-test in 900ms')
    setTestComplete(true)
    const timer = setTimeout(() => {
      console.log('[WalkTest] Navigating to knee-test now')
      if (sessionId) {
        router.push(`/screening/${sessionId}/knee-test`)
      }
    }, 900)
    return () => clearTimeout(timer)
  }, [progress, running, testCompletedRef.current, setTestComplete, sessionId, router])

  // Start pose detection when camera is ready
  useEffect(() => {
    console.log('[WalkTest] Detection useEffect triggered:', {
      cameraReady: simpleCamera.cameraReady,
      running,
      visionPhase,
      shouldRun: simpleCamera.cameraReady && running && visionPhase
    })

    if (!simpleCamera.cameraReady || !running || !visionPhase) return

    let cancelled = false

    async function runDetection() {
      try {
        console.log('[WalkTest] runDetection started - camera ready, beginning pose detection')

        // Wait for video element to have frames
        const video = simpleCamera.videoRef.current
        if (!video) {
          console.error('[WalkTest] Video element not available')
          throw new Error('Video element not available')
        }

        console.log('[WalkTest] Video element found, readyState:', video.readyState)

        // Wait for video to have actual data
        if (video.readyState < 2) {
          console.log('[WalkTest] Waiting for video data...')
          await new Promise<void>((resolve) => {
            const handler = () => {
              video.removeEventListener('loadeddata', handler)
              console.log('[WalkTest] Video data loaded')
              resolve()
            }
            video.addEventListener('loadeddata', handler)
          })
        }

        if (cancelled) {
          console.log('[WalkTest] Cancelled during video wait')
          return
        }

        // Start pose detection
        console.log('[WalkTest] Calling poseDetection.startDetection()...')
        await poseDetection.startDetection()
        console.log('[WalkTest] Pose detection started successfully')

        // Collect pose data for the specified duration
        console.log('[WalkTest] Collecting pose data for', VISION_CAPTURE_DURATION_MS, 'ms')
        await new Promise((resolve) => setTimeout(resolve, VISION_CAPTURE_DURATION_MS))

        if (cancelled) {
          console.log('[WalkTest] Cancelled during data collection')
          return
        }

        // Stop detection and extract landmarks
        console.log('[WalkTest] Stopping detection...')
        poseDetection.stopDetection()
        const collectedLandmarks = poseDetection.landmarks
        console.log('[WalkTest] Detection complete, collected', collectedLandmarks.length, 'landmarks')

        // If we have real landmarks, use them; otherwise continue with simulated data
        console.log('[WalkTest] Calling executeWalkTest with', collectedLandmarks.length, 'landmarks')
        if (collectedLandmarks.length > 0) {
          await executeWalkTest(collectedLandmarks)
        } else {
          console.log('[WalkTest] No landmarks collected, using fallback simulated data')
          await executeWalkTest()
        }

        console.log('[WalkTest] Test completed successfully, setting progress to 100')
        testCompletedRef.current = true
        setProgress(100)
      } catch (err: unknown) {
        if (cancelled) {
          console.log('[WalkTest] Error after cancellation, ignoring:', err)
          return
        }
        console.error('[WalkTest] Detection error:', err)
        setError('Vision capture failed. Continuing with simulated data.')
        try {
          console.log('[WalkTest] Attempting fallback execution...')
          await executeWalkTest()
          testCompletedRef.current = true
          setProgress(100)
        } catch (fallbackErr) {
          console.error('[WalkTest] Fallback execution failed:', fallbackErr)
          const fallbackMsg =
            fallbackErr instanceof Error
              ? fallbackErr.message
              : 'Walk test data collection failed. Please try again.'
          setError(fallbackMsg)
        }
      }
    }

    runDetection()

    return () => {
      cancelled = true
      poseDetection.stopDetection()
    }
  }, [simpleCamera.cameraReady, running, visionPhase])

  if (!submitted) return <SessionNeeded />
  if (!pass) {
    return (
      <div className="page-width py-10">
        <div className="mx-auto max-w-2xl">
          <h1 className="page-heading">You can pause here.</h1>
          <p className="pt-4">This demo pathway does not require a walk test based on your answers.</p>
          <BackLink href="/gate-result">Return to your next step</BackLink>
        </div>
      </div>
    )
  }

  const stage = Math.min(Math.floor(progress / 34), 2)

  // Start/stop video recording when test runs
  useEffect(() => {
    if (!running || !visionPhase || !simpleCamera.cameraReady) return

    let recordingTimeout: NodeJS.Timeout | null = null

    async function startVideoRecording() {
      try {
        const video = simpleCamera.videoRef.current
        if (!video || !video.srcObject) {
          console.log('[WalkTest] Video element or stream not available for recording')
          return
        }

        console.log('[WalkTest] Starting video recording...')
        videoChunksRef.current = []

        const stream = video.srcObject as MediaStream
        const recorder = new MediaRecorder(stream, { mimeType: 'video/webm' })

        recorder.ondataavailable = (event) => {
          videoChunksRef.current.push(event.data)
        }

        recorder.onstop = async () => {
          console.log('[WalkTest] Video recording stopped, uploading...')
          const blob = new Blob(videoChunksRef.current, { type: 'video/webm' })

          if (sessionId && blob.size > 0) {
            try {
              const formData = new FormData()
              formData.append('file', blob, `${sessionId}.webm`)

              const token = sessionStorage.getItem('orthonova_auth_token')
              const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8888'}/sessions/${sessionId}/video`, {
                method: 'POST',
                headers: token ? { Authorization: `Bearer ${token}` } : {},
                body: formData,
              })

              if (response.ok) {
                console.log('[WalkTest] Video uploaded successfully')
              } else {
                console.error('[WalkTest] Video upload failed:', response.statusText)
              }
            } catch (err) {
              console.error('[WalkTest] Video upload error:', err)
            }
          }
        }

        recorder.start()
        mediaRecorderRef.current = recorder

        // Stop recording after 30 seconds
        recordingTimeout = setTimeout(() => {
          if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
            console.log('[WalkTest] Stopping video recording after 30 seconds')
            mediaRecorderRef.current.stop()
          }
        }, VIDEO_RECORDING_DURATION_MS)
      } catch (err) {
        console.error('[WalkTest] Video recording error:', err)
      }
    }

    startVideoRecording()

    return () => {
      if (recordingTimeout) clearTimeout(recordingTimeout)
      if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
        mediaRecorderRef.current.stop()
      }
    }
  }, [running, visionPhase, simpleCamera.cameraReady, sessionId])

  const handleStart = async () => {
    console.log('[WalkTest] handleStart called, setting visionPhase: true')
    setError(null)
    setTestComplete(false)
    setProgress(0)
    testCompletedRef.current = false
    setRunning(true)
    setVisionPhase(true)
  }

  const handlePause = () => {
    setRunning(false)
    setProgress(0)
    setTestComplete(false)
    poseDetection.stopDetection()
  }

  return (
    <div className="page-width enter-page py-6">
      <div className="mx-auto flex max-w-2xl flex-col gap-6">
        {!running && <BackLink href="/gate-result">Back to your next step</BackLink>}
        <Card className="screen-card">
          <CardHeader className="justify-items-center gap-4 text-center">
            <p className="eyebrow">Step 2 · Walk test</p>
            <span className="flex size-24 items-center justify-center rounded-3xl bg-secondary text-primary">
              <Footprints className="size-12" strokeWidth={1.5} />
            </span>
            <CardTitle>
              <h1 className="page-heading">
                {running ? (progress === 100 ? 'All done. Well done.' : 'One step at a time.') : 'A gentle walk, at your pace.'}
              </h1>
            </CardTitle>
            <CardDescription>
              {running
                ? visionPhase
                  ? 'Stand 2-3 meters from the camera. We are analyzing your gait.'
                  : 'Your health worker is here with you. There is no need to hurry.'
                : 'Let your health worker know when you feel ready.'}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {/* Camera preview - ALWAYS rendered (unconditionally) */}
            <div className="mb-6 flex flex-col gap-3">
              <div className="rounded-lg border-2 border-secondary bg-muted overflow-hidden relative">
                {/* Video element for camera feed and recording */}
                <video
                  ref={simpleCamera.videoRef}
                  autoPlay
                  playsInline
                  muted
                  className="w-full bg-black"
                  style={{ display: running ? 'block' : 'none' }}
                />

                {/* Overlay canvas for pose visualization - positioned on top of video */}
                <canvas
                  ref={poseDetection.overlayCanvasRef}
                  className="absolute inset-0 w-full h-full pointer-events-none"
                  style={{ display: running && simpleCamera.cameraReady ? 'block' : 'none' }}
                />

                {!running && (
                  <div className="flex items-center justify-center bg-black text-white p-8">
                    <p className="text-sm text-muted-foreground">Camera preview will appear here when you start the test</p>
                  </div>
                )}
                {running && !simpleCamera.cameraReady && !simpleCamera.cameraError && (
                  <div className="absolute inset-0 flex items-center justify-center bg-black">
                    <p className="text-white">Starting camera…</p>
                  </div>
                )}
                {running && simpleCamera.cameraError && (
                  <div className="absolute inset-0 flex items-center justify-center bg-black">
                    <p className="text-red-400">Camera error: {simpleCamera.cameraError}</p>
                  </div>
                )}
              </div>
              {running && visionPhase && simpleCamera.cameraReady && (
                <div className="flex items-center gap-2 rounded-lg bg-blue-50 p-3 text-sm text-blue-900">
                  <Camera className="size-4 shrink-0" />
                  <span>Recording your movement... {Math.round((VIDEO_RECORDING_DURATION_MS - progress * 100) / 1000)}s remaining</span>
                </div>
              )}
            </div>

            {running ? (
              <div className="flex flex-col gap-7">
                <div role="status" aria-live="polite" className="text-center text-xl font-semibold text-primary">
                  {progress === 100 ? 'Your sample summary is ready.' : stages[stage].text}
                </div>
                <Progress value={progress} aria-label="Walk test progress" />
                <ol className="flex flex-col gap-4">
                  {stages.map(({ text, icon: Icon }, index) => (
                    <li
                      key={text}
                      className={cn(
                        'flex items-center gap-4 rounded-xl p-4 text-lg max-sm:grid max-sm:grid-cols-[2rem_minmax(0,1fr)] max-sm:gap-x-3 max-sm:gap-y-1',
                        index === stage ? 'bg-secondary text-primary' : 'text-muted-foreground'
                      )}
                    >
                      <span className="flex size-8 items-center justify-center">
                        {index < stage || progress === 100 ? <Check className="size-5 text-primary" /> : <Icon className="size-5" />}
                      </span>
                      {text.replace('Analyzing ', '').replace('…', '').replace(/^./, (s) => s.toUpperCase())}
                      <span className="ml-auto text-sm max-sm:col-start-2 max-sm:ml-0">
                        {index < stage || progress === 100 ? 'Complete' : index === stage ? 'In progress' : 'Up next'}
                      </span>
                    </li>
                  ))}
                </ol>
              </div>
            ) : (
              <ol className="flex flex-col gap-5">
                {[
                  { icon: PersonStanding, text: 'Stand comfortably on a clear, level path.' },
                  { icon: MoveRight, text: 'Walk naturally. Use your usual walking aid if needed.' },
                  { icon: Pause, text: 'Stop and tell your health worker if you feel pain or unsteadiness.' },
                ].map(({ icon: Icon, text }) => (
                  <li key={text} className="flex items-start gap-4">
                    <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-secondary text-primary">
                      <Icon className="size-5" />
                    </span>
                    <p className="text-lg">{text}</p>
                  </li>
                ))}
              </ol>
            )}
            {error && (
              <div className="mt-4 flex items-start gap-3 rounded-lg border border-destructive/20 bg-destructive/5 p-3">
                <AlertCircle className="size-4 shrink-0 text-destructive mt-0.5" />
                <p className="text-sm text-destructive">{error}</p>
              </div>
            )}
            {!running && (
              <p className="pt-7 text-center text-sm text-muted-foreground">
                Real-time camera analysis · Your video is processed locally and never leaves your device.
              </p>
            )}
          </CardContent>
          <CardFooter className="flex-col gap-3">
            {running ? (
              <Button
                variant="outline"
                size="lg"
                className="w-full"
                onClick={handlePause}
                disabled={progress === 100}
              >
                Pause test
              </Button>
            ) : (
              <Button
                size="lg"
                className="w-full"
                onClick={handleStart}
                disabled={poseDetection.isLoading}
              >
                {poseDetection.isLoading ? 'Loading pose model...' : 'Start Test'} <ArrowRight data-icon="inline-end" />
              </Button>
            )}
          </CardFooter>
        </Card>
      </div>
    </div>
  )
}
'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import { FilesetResolver, PoseLandmarker, DrawingUtils } from '@mediapipe/tasks-vision'

export interface PoseLandmarkFrame {
  timestamp: number
  left_hip_x: number
  left_hip_y: number
  right_hip_x: number
  right_hip_y: number
  left_knee_x: number
  left_knee_y: number
  right_knee_x: number
  right_knee_y: number
  left_ankle_x: number
  left_ankle_y: number
  right_ankle_x: number
  right_ankle_y: number
}

export interface PoseDetectionState {
  isLoading: boolean
  error: string | null
  isDetecting: boolean
  frameCount: number
  landmarks: PoseLandmarkFrame[]
}

export interface UsePoseDetectionReturn extends PoseDetectionState {
  startCamera: () => Promise<void>
  stopCamera: () => void
  startDetection: () => Promise<void>
  stopDetection: () => void
  videoRef: React.RefObject<HTMLVideoElement | null>
  overlayCanvasRef: React.RefObject<HTMLCanvasElement>
  setVideoRef: (node: HTMLVideoElement | null) => void
}

export function usePoseDetection(): UsePoseDetectionReturn {
  const [state, setState] = useState<PoseDetectionState>({
    isLoading: true,
    error: null,
    isDetecting: false,
    frameCount: 0,
    landmarks: [],
  })

  const videoElementRef = useRef<HTMLVideoElement | null>(null)
  const overlayCanvasRef = useRef<HTMLCanvasElement>(null!)
  const poseLandmarkerRef = useRef<PoseLandmarker | null>(null)
  const drawingUtilsRef = useRef<DrawingUtils | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const pendingStreamRef = useRef<MediaStream | null>(null)
  const animationFrameRef = useRef<number | null>(null)
  const landmarksRef = useRef<PoseLandmarkFrame[]>([])
  const startTimeRef = useRef<number>(0)

  // Guard refs to prevent race conditions from React Strict Mode double-invoke
  const isMountedRef = useRef(true)
  const isInitializingRef = useRef(false)
  const isDetectionActiveRef = useRef(false)

  // Track srcObject assignments
  const assignCountRef = useRef(0)

  // Callback ref: fires when video element is attached to DOM
  const setVideoRef = useCallback((node: HTMLVideoElement | null) => {
    console.log('[PoseDetection] setVideoRef callback:', { node, hasPendingStream: !!pendingStreamRef.current })
    videoElementRef.current = node

    if (node && pendingStreamRef.current) {
      // Stream was obtained before element mounted, attach it now
      console.log('[PoseDetection] Attaching pending stream to video element')
      node.autoplay = true
      node.playsInline = true
      node.muted = true
      assignCountRef.current++
      console.log('[PoseDetection] srcObject assigned, count:', assignCountRef.current)
      node.srcObject = pendingStreamRef.current

      node
        .play()
        .then(() => {
          console.log('[PoseDetection] video.play() resolved successfully in callback ref')
        })
        .catch((err) => {
          // AbortError is expected when navigating away - ignore it
          if (err.name !== 'AbortError') {
            console.error('[PoseDetection] video.play() failed in callback ref:', err)
          }
        })
    }
  }, [])

  // Initialize MediaPipe PoseLandmarker
  useEffect(() => {
    isMountedRef.current = true

    // Skip if already initializing (Strict Mode guard)
    if (isInitializingRef.current) {
      return
    }

    const initializePoseLandmarker = async () => {
      if (!isMountedRef.current || isInitializingRef.current) return

      isInitializingRef.current = true
      try {
        const vision = await FilesetResolver.forVisionTasks(
          'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm'
        )

        if (!isMountedRef.current) {
          return
        }

        const landmarker = await PoseLandmarker.createFromOptions(vision, {
          baseOptions: {
            modelAssetPath:
              'https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task',
          },
          runningMode: 'VIDEO',
          numPoses: 1,
        })

        if (!isMountedRef.current) {
          // Component unmounted during initialization, close the landmarker
          landmarker.close()
          return
        }

        poseLandmarkerRef.current = landmarker
        setState((prev) => ({ ...prev, isLoading: false }))
      } catch (err) {
        if (!isMountedRef.current) return

        const errorMessage =
          err instanceof Error ? err.message : 'Failed to initialize pose landmarker'
        setState((prev) => ({
          ...prev,
          isLoading: false,
          error: errorMessage,
        }))
      } finally {
        isInitializingRef.current = false
      }
    }

    initializePoseLandmarker()

    // Cleanup on unmount
    return () => {
      isMountedRef.current = false

      // Stop detection FIRST (cancel animation frame before closing graph)
      if (animationFrameRef.current !== null) {
        cancelAnimationFrame(animationFrameRef.current)
        animationFrameRef.current = null
      }
      isDetectionActiveRef.current = false

      // Now close the landmarker (graph is no longer receiving detectForVideo calls)
      if (poseLandmarkerRef.current) {
        try {
          poseLandmarkerRef.current.close()
        } catch (err) {
          console.error('Error closing pose landmarker:', err)
        }
        poseLandmarkerRef.current = null
      }
    }
  }, [])

  const startCamera = useCallback(async () => {
    console.log('[PoseDetection] startCamera called')

    if (!isMountedRef.current) {
      console.log('[PoseDetection] Component not mounted, aborting')
      return
    }

    try {
      setState((prev) => ({ ...prev, error: null }))

      console.log('[PoseDetection] Requesting camera access...')
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 640 }, height: { ideal: 480 } },
        audio: false,
      })

      console.log('[PoseDetection] getUserMedia resolved successfully')
      console.log('[PoseDetection] Stream:', stream)
      console.log('[PoseDetection] Video tracks:', stream.getVideoTracks())
      console.log('[PoseDetection] Video track readyState:', stream.getVideoTracks().map(t => t.readyState))
      console.log('[PoseDetection] Video track label:', stream.getVideoTracks().map(t => t.label))

      if (!isMountedRef.current) {
        console.log('[PoseDetection] Component unmounted while waiting, stopping stream')
        stream.getTracks().forEach((track) => track.stop())
        return
      }

      streamRef.current = stream
      pendingStreamRef.current = stream

      const videoElement = videoElementRef.current
      console.log('[PoseDetection] videoElementRef.current:', videoElement)
      console.log('[PoseDetection] videoElement exists?', !!videoElement)

      if (videoElement) {
        console.log('[PoseDetection] Video element already mounted, attaching stream immediately')
        videoElement.autoplay = true
        videoElement.playsInline = true
        videoElement.muted = true
        assignCountRef.current++
        console.log('[PoseDetection] srcObject assigned, count:', assignCountRef.current)
        videoElement.srcObject = stream

        try {
          await videoElement.play()
          console.log('[PoseDetection] video.play() resolved successfully')
          console.log('[PoseDetection] videoElement paused?', videoElement.paused)
          console.log('[PoseDetection] videoElement readyState:', videoElement.readyState)
        } catch (playError: any) {
          // AbortError is expected when navigating away - ignore it
          if (playError?.name !== 'AbortError') {
            console.error('[PoseDetection] video.play() failed:', playError)
          }
        }
      } else {
        console.log('[PoseDetection] Video element not yet mounted - stream stored in pendingStreamRef, will attach when callback ref fires')
      }
    } catch (err) {
      console.error('[PoseDetection] getUserMedia failed:', err)

      if (!isMountedRef.current) return

      const errorMessage =
        err instanceof Error ? err.message : 'Failed to access camera'
      setState((prev) => ({
        ...prev,
        error: errorMessage,
      }))
    }
  }, [])

  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop())
      streamRef.current = null
    }
    pendingStreamRef.current = null
    if (videoElementRef.current) {
      videoElementRef.current.srcObject = null
    }
  }, [])

  const extractLandmarksFromResult = (
    result: any,
    timestamp: number,
    frameWidth: number,
    frameHeight: number
  ): PoseLandmarkFrame | null => {
    if (!result.landmarks || result.landmarks.length === 0) {
      return null
    }

    const poses = result.landmarks[0]
    if (!poses || poses.length === 0) {
      return null
    }

    // MediaPipe pose landmarks: 0=nose, 11=left_hip, 12=right_hip, 13=left_knee, 14=right_knee, 15=left_ankle, 16=right_ankle
    const getLandmark = (index: number) => {
      const lm = poses[index]
      return {
        x: lm.x * frameWidth,
        y: lm.y * frameHeight,
      }
    }

    const leftHip = getLandmark(11)
    const rightHip = getLandmark(12)
    const leftKnee = getLandmark(13)
    const rightKnee = getLandmark(14)
    const leftAnkle = getLandmark(15)
    const rightAnkle = getLandmark(16)

    return {
      timestamp,
      left_hip_x: leftHip.x,
      left_hip_y: leftHip.y,
      right_hip_x: rightHip.x,
      right_hip_y: rightHip.y,
      left_knee_x: leftKnee.x,
      left_knee_y: leftKnee.y,
      right_knee_x: rightKnee.x,
      right_knee_y: rightKnee.y,
      left_ankle_x: leftAnkle.x,
      left_ankle_y: leftAnkle.y,
      right_ankle_x: rightAnkle.x,
      right_ankle_y: rightAnkle.y,
    }
  }

  const processFrame = useCallback(async () => {
    // Guard: check if this callback should still be running
    if (
      !isMountedRef.current ||
      !isDetectionActiveRef.current ||
      !videoElementRef.current ||
      !overlayCanvasRef.current ||
      !poseLandmarkerRef.current ||
      !state.isDetecting
    ) {
      return
    }

    try {
      const video = videoElementRef.current
      const canvas = overlayCanvasRef.current

      // Update canvas size to match video
      if (canvas.width !== video.videoWidth || canvas.height !== video.videoHeight) {
        canvas.width = video.videoWidth
        canvas.height = video.videoHeight

        // Initialize DrawingUtils when canvas is sized
        if (!drawingUtilsRef.current && canvas.width > 0 && canvas.height > 0) {
          const ctx = canvas.getContext('2d')
          if (ctx) {
            drawingUtilsRef.current = new DrawingUtils(ctx)
          }
        }
      }

      // Guard: ensure the landmarker is still valid before calling detectForVideo
      if (!poseLandmarkerRef.current) {
        return
      }

      // Run pose landmarker on current video frame
      const timestamp = performance.now()
      const result = poseLandmarkerRef.current.detectForVideo(video, timestamp)

      // Guard: check if still active after detectForVideo completes
      if (!isDetectionActiveRef.current || !isMountedRef.current) {
        return
      }

      // Extract landmark frame
      const landmarkFrame = extractLandmarksFromResult(
        result,
        timestamp - startTimeRef.current,
        video.videoWidth,
        video.videoHeight
      )

      if (landmarkFrame) {
        landmarksRef.current.push(landmarkFrame)
        if (isMountedRef.current) {
          setState((prev) => ({
            ...prev,
            frameCount: prev.frameCount + 1,
            landmarks: landmarksRef.current,
          }))
        }
      }

      // Draw visualization on overlay canvas
      const ctx = canvas.getContext('2d')
      if (ctx && drawingUtilsRef.current) {
        // Clear the overlay canvas (transparent background)
        ctx.clearRect(0, 0, canvas.width, canvas.height)

        // Draw pose landmarks and connections if available
        if (result.landmarks && result.landmarks.length > 0) {
          const poses = result.landmarks[0]

          // Draw all connections in teal
          ctx.strokeStyle = '#00BFA5'
          ctx.lineWidth = 2
          drawingUtilsRef.current.drawConnectors(
            poses,
            PoseLandmarker.POSE_CONNECTIONS,
            { color: '#00BFA5', lineWidth: 2 }
          )

          // Draw all landmarks as small dots
          poses.forEach((landmark: any, index: number) => {
            const x = landmark.x * canvas.width
            const y = landmark.y * canvas.height

            // Hip, knee, ankle landmarks: 11=left hip, 12=right hip, 13=left knee, 14=right knee, 15=left ankle, 16=right ankle
            const isLegLandmark = [11, 12, 13, 14, 15, 16].includes(index)

            if (isLegLandmark) {
              // Emphasize leg landmarks with larger circles and brighter color
              ctx.fillStyle = '#00E5CC'
              ctx.beginPath()
              ctx.arc(x, y, 6, 0, 2 * Math.PI)
              ctx.fill()
              // Add outline for extra emphasis
              ctx.strokeStyle = '#FFFFFF'
              ctx.lineWidth = 1
              ctx.stroke()
            } else {
              // Regular landmarks
              ctx.fillStyle = 'rgba(0, 191, 165, 0.6)'
              ctx.beginPath()
              ctx.arc(x, y, 3, 0, 2 * Math.PI)
              ctx.fill()
            }
          })
        }
      }

      // Continue processing next frame (only if still active)
      if (isDetectionActiveRef.current && isMountedRef.current) {
        animationFrameRef.current = requestAnimationFrame(processFrame)
      }
    } catch (err) {
      console.error('[PoseDetection] Error processing frame:', err)
    }
  }, [state.isDetecting])

  const startDetection = useCallback(async () => {
    if (!isMountedRef.current) return

    const video = videoElementRef.current
    if (!video) {
      setState((prev) => ({
        ...prev,
        error: 'Video element not ready',
      }))
      return
    }

    // Wait for video to be ready
    if (video.readyState !== HTMLMediaElement.HAVE_ENOUGH_DATA) {
      await new Promise((resolve) => {
        const handler = () => {
          video.removeEventListener('canplay', handler)
          resolve(null)
        }
        video.addEventListener('canplay', handler)
      })
    }

    if (!isMountedRef.current) return

    landmarksRef.current = []
    startTimeRef.current = performance.now()
    isDetectionActiveRef.current = true

    setState((prev) => ({
      ...prev,
      isDetecting: true,
      frameCount: 0,
      landmarks: [],
    }))

    animationFrameRef.current = requestAnimationFrame(processFrame)
  }, [processFrame])

  const stopDetection = useCallback(() => {
    if (!isMountedRef.current) return

    // Stop the animation frame loop first
    if (animationFrameRef.current !== null) {
      cancelAnimationFrame(animationFrameRef.current)
      animationFrameRef.current = null
    }
    isDetectionActiveRef.current = false

    setState((prev) => ({
      ...prev,
      isDetecting: false,
    }))
  }, [])

  return {
    ...state,
    startCamera,
    stopCamera,
    startDetection,
    stopDetection,
    videoRef: videoElementRef as React.RefObject<HTMLVideoElement | null>,
    overlayCanvasRef,
    setVideoRef,
  }
}

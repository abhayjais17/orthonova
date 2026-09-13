'use client'

import { useEffect, useRef, useState } from 'react'

export function useSimpleCamera() {
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const [cameraReady, setCameraReady] = useState(false)
  const [cameraError, setCameraError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false

    async function start() {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { width: { ideal: 640 }, height: { ideal: 480 } },
          audio: false,
        })

        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop())
          return
        }

        streamRef.current = stream
        console.log('[SimpleCamera] Stream obtained:', stream)
        console.log('[SimpleCamera] Video tracks:', stream.getVideoTracks())
        console.log('[SimpleCamera] Video ref exists?', !!videoRef.current)

        if (videoRef.current) {
          videoRef.current.autoplay = true
          videoRef.current.playsInline = true
          videoRef.current.muted = true
          videoRef.current.srcObject = stream
          console.log('[SimpleCamera] srcObject assigned to video element')

          try {
            await videoRef.current.play()
            console.log('[SimpleCamera] video.play() succeeded, readyState:', videoRef.current.readyState)
            if (!cancelled) setCameraReady(true)
          } catch (playError: any) {
            console.error('[SimpleCamera] video.play() failed:', playError)
            if (!cancelled) {
              setCameraError(`Video playback failed: ${playError.message}`)
            }
          }
        } else {
          console.error('[SimpleCamera] videoRef.current is null!')
        }
      } catch (err) {
        console.error('[SimpleCamera] getUserMedia failed:', err)
        if (!cancelled) {
          const errorMessage = err instanceof Error ? err.message : 'Camera access failed'
          setCameraError(errorMessage)
        }
      }
    }

    start()

    return () => {
      console.log('[SimpleCamera] Cleanup')
      cancelled = true
      streamRef.current?.getTracks().forEach((t) => t.stop())
      streamRef.current = null
      if (videoRef.current) {
        videoRef.current.srcObject = null
      }
    }
  }, [])

  return { videoRef, cameraReady, cameraError }
}
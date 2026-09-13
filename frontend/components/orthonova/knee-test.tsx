'use client'

import { useEffect, useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { Accessibility, Check, ArrowRight, AlertCircle, Pause } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { useScreening, passesDemoGate } from './screening-provider'
import { SessionNeeded } from './gate-result'
import { BackLink } from './app-shell'

const KNEE_TEST_DURATION_MS = 10000 // 10 seconds for knee data collection

interface KneeReading {
  timestamp: number
  knee_flexion: number
  thigh_angle: number
  shin_angle: number
}

export function KneeTest() {
  const { intake, submitted, gateDecision, sessionId } = useScreening()
  const [running, setRunning] = useState(false)
  const [progress, setProgress] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const [readings, setReadings] = useState<KneeReading[]>([])
  const [currentReading, setCurrentReading] = useState<KneeReading | null>(null)
  const [highFlexion, setHighFlexion] = useState(false)
  const router = useRouter()
  const testCompletedRef = useRef(false)
  const progressTimerRef = useRef<NodeJS.Timeout | null>(null)
  const dataIntervalRef = useRef<NodeJS.Timeout | null>(null)

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

    const startTime = Date.now()
    progressTimerRef.current = setInterval(() => {
      const elapsed = Date.now() - startTime
      const percentage = Math.min(100, (elapsed / KNEE_TEST_DURATION_MS) * 100)
      setProgress(percentage)

      if (elapsed >= KNEE_TEST_DURATION_MS) {
        setRunning(false)
        if (progressTimerRef.current) clearInterval(progressTimerRef.current)
        handleTestComplete()
      }
    }, 100)

    return () => {
      if (progressTimerRef.current) clearInterval(progressTimerRef.current)
    }
  }, [running])

  // Generate simulated knee data
  function generateKneeReading(index: number): KneeReading {
    const age = parseInt(intake?.age || '0')
    const pain = intake?.pain || 0
    const profile = age > 60 && pain > 5 ? 'oa' : 'normal'
    const t = index / 50 // normalized time
    const timestamp = Date.now() + index * 200 // simulate 200ms between readings

    let knee_flexion: number
    let thigh_angle: number
    let shin_angle: number

    if (profile === 'normal') {
      // Normal gait: knee flexion 60-75 degrees, smooth
      knee_flexion = 65 + Math.sin(t * Math.PI * 4) * 8 + (Math.random() - 0.5) * 3
      thigh_angle = 30 + Math.sin(t * Math.PI * 4) * 5
      shin_angle = 35 + Math.sin(t * Math.PI * 4 + 0.5) * 5
    } else {
      // OA-like gait: reduced flexion (25-35), jerkier
      knee_flexion = 28 + Math.sin(t * Math.PI * 6) * 4 + (Math.random() - 0.5) * 8
      thigh_angle = 15 + Math.sin(t * Math.PI * 6) * 3 + (Math.random() - 0.5) * 4
      shin_angle = 20 + Math.sin(t * Math.PI * 6 + 0.3) * 3 + (Math.random() - 0.5) * 4
    }

    return { timestamp, knee_flexion: Math.max(0, knee_flexion), thigh_angle, shin_angle }
  }

  function handleStart() {
    setRunning(true)
    setProgress(0)
    setError(null)
    setReadings([])
    setCurrentReading(null)
    setHighFlexion(false)
    testCompletedRef.current = false

    // Simulate streaming readings every 200ms
    let readingIndex = 0
    dataIntervalRef.current = setInterval(() => {
      const reading = generateKneeReading(readingIndex)
      setReadings(prev => [...prev, reading])
      setCurrentReading(reading)

      // Detect high flexion (normal is >60, OA is <35)
      const age = parseInt(intake?.age || '0')
      const pain = intake?.pain || 0
      const profile = age > 60 && pain > 5 ? 'oa' : 'normal'
      setHighFlexion(profile === 'normal' && reading.knee_flexion > 60)

      readingIndex++
    }, 200)
  }

  async function handleTestComplete() {
    if (dataIntervalRef.current) clearInterval(dataIntervalRef.current)
    testCompletedRef.current = true

    if (readings.length === 0) {
      setError('No data collected')
      return
    }

    // Send data to backend - wait for completion before navigating
    if (sessionId) {
      try {
        const { api } = await import('@/lib/api')
        await api.submitKneeData(sessionId, readings)
        console.log('[KneeTest] Knee data submitted successfully')
      } catch (err) {
        console.error('Failed to submit knee data:', err)
        setError('Failed to save knee data: ' + (err instanceof Error ? err.message : String(err)))
        return // Don't navigate on error
      }
    }

    // Auto-navigate to shoe test after 2 seconds
    setTimeout(() => {
      if (sessionId) {
        router.push(`/screening/${sessionId}/shoe-test`)
      }
    }, 2000)
  }

  if (!submitted) {
    return <SessionNeeded />
  }

  if (!pass) {
    return (
      <div className="page-width enter-page py-12 md:py-16">
        <div className="mx-auto max-w-lg">
          <Card className="screen-card">
            <CardHeader>
              <CardTitle>Knee Kit Test</CardTitle>
              <CardDescription>Not available for your profile</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground">You did not pass the screening gate and cannot proceed to the knee test.</p>
            </CardContent>
            <CardFooter>
              <BackLink href="/screening" />
            </CardFooter>
          </Card>
        </div>
      </div>
    )
  }

  return (
    <div className="page-width enter-page py-12 md:py-16">
      <div className="mx-auto max-w-2xl">
        <BackLink href="/screening" />

        <Card className="screen-card mt-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-3">
              <Accessibility className="size-6" />
              Knee Kit Test
            </CardTitle>
            <CardDescription>Real-time knee flexion and angle measurement</CardDescription>
          </CardHeader>

          <CardContent className="space-y-6">
            {/* Disclaimer */}
            <div className="rounded-lg bg-amber-50 p-4 text-sm text-amber-900 border border-amber-200">
              <p className="font-medium mb-1">Simulated Data</p>
              <p>This is simulated sensor data until hardware is connected. Real ESP32 knee IMU data will appear here once hardware is active.</p>
            </div>

            {/* Status Display */}
            {!running && !testCompletedRef.current && (
              <div className="rounded-lg bg-blue-50 p-4 border border-blue-200">
                <p className="text-sm text-blue-900">
                  <span className="font-medium">Ready to start:</span> Click the button below to begin collecting knee sensor data.
                </p>
              </div>
            )}

            {running && (
              <div className="space-y-4">
                {/* Progress bar */}
                <div>
                  <div className="flex justify-between mb-2">
                    <span className="text-sm font-medium">Collection Progress</span>
                    <span className="text-sm text-muted-foreground">{Math.round(progress)}%</span>
                  </div>
                  <Progress value={progress} className="h-3" />
                </div>

                {/* Current readings */}
                {currentReading && (
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div className="rounded-lg bg-primary/10 p-4 border border-primary/20">
                      <p className="text-xs text-muted-foreground font-medium uppercase mb-2">Knee Flexion</p>
                      <p className="text-3xl font-bold text-primary">{currentReading.knee_flexion.toFixed(1)}°</p>
                      <p className="text-xs text-muted-foreground mt-1">
                        {highFlexion ? '✓ Normal' : '⚠ Reduced'}
                      </p>
                    </div>
                    <div className="rounded-lg bg-secondary/30 p-4 border border-secondary/50">
                      <p className="text-xs text-muted-foreground font-medium uppercase mb-2">Thigh Angle</p>
                      <p className="text-3xl font-bold text-secondary-foreground">{currentReading.thigh_angle.toFixed(1)}°</p>
                    </div>
                    <div className="rounded-lg bg-tertiary/20 p-4 border border-tertiary/30">
                      <p className="text-xs text-muted-foreground font-medium uppercase mb-2">Shin Angle</p>
                      <p className="text-3xl font-bold">{currentReading.shin_angle.toFixed(1)}°</p>
                    </div>
                  </div>
                )}

                {/* Readings collected */}
                <div className="text-sm text-muted-foreground">
                  <span className="font-medium text-foreground">{readings.length}</span> readings collected
                </div>
              </div>
            )}

            {testCompletedRef.current && (
              <div className="rounded-lg bg-green-50 p-4 border border-green-200 flex items-start gap-3">
                <Check className="size-5 text-green-600 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="font-medium text-green-900">Test Complete</p>
                  <p className="text-sm text-green-800 mt-1">
                    Collected <span className="font-medium">{readings.length}</span> knee sensor readings.
                  </p>
                  <p className="text-sm text-green-800 mt-2">Proceeding to Shoe Kit test...</p>
                </div>
              </div>
            )}

            {error && (
              <div className="rounded-lg bg-red-50 p-4 border border-red-200 flex items-start gap-3">
                <AlertCircle className="size-5 text-red-600 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="font-medium text-red-900">Error</p>
                  <p className="text-sm text-red-800">{error}</p>
                </div>
              </div>
            )}
          </CardContent>

          <CardFooter>
            {!running && !testCompletedRef.current && (
              <Button onClick={handleStart} size="lg" className="w-full">
                Start Knee Kit Test
                <ArrowRight className="ml-2 size-4" />
              </Button>
            )}
            {running && (
              <Button onClick={() => setRunning(false)} variant="outline" size="lg" className="w-full">
                <Pause className="size-4 mr-2" />
                Stop Test
              </Button>
            )}
            {testCompletedRef.current && (
              <Button onClick={() => router.push(`/screening/${sessionId}/shoe-test`)} size="lg" className="w-full">
                Continue to Shoe Kit
                <ArrowRight className="ml-2 size-4" />
              </Button>
            )}
          </CardFooter>
        </Card>
      </div>
    </div>
  )
}

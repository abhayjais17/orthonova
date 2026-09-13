'use client'

import { useEffect, useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { Footprints, Check, ArrowRight, AlertCircle, Pause } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { useScreening, passesDemoGate } from './screening-provider'
import { SessionNeeded } from './gate-result'
import { BackLink } from './app-shell'
import { cn } from '@/lib/utils'

const SHOE_TEST_DURATION_MS = 10000 // 10 seconds for shoe data collection

interface ShoeReading {
  timestamp: number
  fsr_heel: number
  fsr_midfoot: number
  fsr_forefoot: number
  fsr_toe: number
}

export function ShoeTest() {
  const { intake, submitted, gateDecision, sessionId } = useScreening()
  const [running, setRunning] = useState(false)
  const [progress, setProgress] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const [readings, setReadings] = useState<ShoeReading[]>([])
  const [currentReading, setCurrentReading] = useState<ShoeReading | null>(null)
  const [heelStrike, setHeelStrike] = useState(false)
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
      const percentage = Math.min(100, (elapsed / SHOE_TEST_DURATION_MS) * 100)
      setProgress(percentage)

      if (elapsed >= SHOE_TEST_DURATION_MS) {
        setRunning(false)
        if (progressTimerRef.current) clearInterval(progressTimerRef.current)
        handleTestComplete()
      }
    }, 100)

    return () => {
      if (progressTimerRef.current) clearInterval(progressTimerRef.current)
    }
  }, [running])

  // Generate simulated shoe data
  function generateShoeReading(index: number): ShoeReading {
    const age = parseInt(intake?.age || '0')
    const pain = intake?.pain || 0
    const profile = age > 60 && pain > 5 ? 'oa' : 'normal'
    const t = index / 50 // normalized time
    const timestamp = Date.now() + index * 200 // simulate 200ms between readings

    let fsr_heel: number
    let fsr_midfoot: number
    let fsr_forefoot: number
    let fsr_toe: number

    if (profile === 'normal') {
      // Normal gait: heel strike with loading, roll through foot
      const phase = (t * 4) % 1 // gait cycle 0-1
      if (phase < 0.2) {
        // Heel strike
        fsr_heel = 200 + Math.random() * 50
        fsr_midfoot = 50 + Math.random() * 30
        fsr_forefoot = 30 + Math.random() * 20
        fsr_toe = 10 + Math.random() * 10
      } else if (phase < 0.6) {
        // Midstance to push-off
        fsr_heel = 150 + Math.random() * 40
        fsr_midfoot = 120 + Math.random() * 40
        fsr_forefoot = 100 + Math.random() * 40
        fsr_toe = 80 + Math.random() * 30
      } else {
        // Swing phase
        fsr_heel = 30 + Math.random() * 20
        fsr_midfoot = 20 + Math.random() * 15
        fsr_forefoot = 15 + Math.random() * 10
        fsr_toe = 5 + Math.random() * 5
      }
    } else {
      // OA gait: reduced heel strike, flatter loading
      const phase = (t * 4) % 1
      if (phase < 0.25) {
        // Reduced heel strike (antalgic)
        fsr_heel = 80 + Math.random() * 40 // much lower
        fsr_midfoot = 100 + Math.random() * 40 // increased midfoot loading
        fsr_forefoot = 90 + Math.random() * 40
        fsr_toe = 70 + Math.random() * 30
      } else if (phase < 0.65) {
        fsr_heel = 40 + Math.random() * 30
        fsr_midfoot = 140 + Math.random() * 50
        fsr_forefoot = 130 + Math.random() * 50
        fsr_toe = 100 + Math.random() * 40
      } else {
        fsr_heel = 20 + Math.random() * 15
        fsr_midfoot = 30 + Math.random() * 20
        fsr_forefoot = 25 + Math.random() * 15
        fsr_toe = 15 + Math.random() * 10
      }
    }

    return {
      timestamp,
      fsr_heel: Math.max(0, fsr_heel),
      fsr_midfoot: Math.max(0, fsr_midfoot),
      fsr_forefoot: Math.max(0, fsr_forefoot),
      fsr_toe: Math.max(0, fsr_toe),
    }
  }

  function handleStart() {
    setRunning(true)
    setProgress(0)
    setError(null)
    setReadings([])
    setCurrentReading(null)
    setHeelStrike(false)
    testCompletedRef.current = false

    // Simulate streaming readings every 200ms
    let readingIndex = 0
    dataIntervalRef.current = setInterval(() => {
      const reading = generateShoeReading(readingIndex)
      setReadings(prev => [...prev, reading])
      setCurrentReading(reading)

      // Detect heel strike (heel pressure > 150)
      setHeelStrike(reading.fsr_heel > 150)

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
        await api.submitShoeData(sessionId, readings)
        console.log('[ShoeTest] Shoe data submitted successfully')
      } catch (err) {
        console.error('Failed to submit shoe data:', err)
        setError('Failed to save shoe data: ' + (err instanceof Error ? err.message : String(err)))
        return // Don't navigate on error
      }
    }

    // Auto-navigate to results after 2 seconds
    setTimeout(() => {
      router.push('/result')
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
              <CardTitle>Shoe Kit Test</CardTitle>
              <CardDescription>Not available for your profile</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground">You did not pass the screening gate and cannot proceed to the shoe test.</p>
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
              <Footprints className="size-6" />
              Shoe Kit Test
            </CardTitle>
            <CardDescription>Real-time foot pressure and force measurement</CardDescription>
          </CardHeader>

          <CardContent className="space-y-6">
            {/* Disclaimer */}
            <div className="rounded-lg bg-amber-50 p-4 text-sm text-amber-900 border border-amber-200">
              <p className="font-medium mb-1">Simulated Data</p>
              <p>This is simulated sensor data until hardware is connected. Real ESP32 shoe FSR data will appear here once hardware is active.</p>
            </div>

            {/* Status Display */}
            {!running && !testCompletedRef.current && (
              <div className="rounded-lg bg-blue-50 p-4 border border-blue-200">
                <p className="text-sm text-blue-900">
                  <span className="font-medium">Ready to start:</span> Click the button below to begin collecting shoe sensor data.
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

                {/* Heel strike indicator */}
                {currentReading && (
                  <div className="rounded-lg bg-teal-50 p-4 border border-teal-200">
                    <p className="text-sm font-medium text-teal-900 mb-3">Heel Strike Detection</p>
                    <p className="text-lg font-bold">
                      {heelStrike ? (
                        <span className="text-green-600">✓ Heel Strike Detected</span>
                      ) : (
                        <span className="text-amber-600">○ Loading Phase</span>
                      )}
                    </p>
                  </div>
                )}

                {/* Current readings - 4 sensor columns */}
                {currentReading && (
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    <div className={cn(
                      'rounded-lg p-3 border transition-all',
                      heelStrike && currentReading.fsr_heel > 150
                        ? 'bg-green-100 border-green-400'
                        : 'bg-slate-100 border-slate-300'
                    )}>
                      <p className="text-xs text-muted-foreground font-medium uppercase mb-1">Heel</p>
                      <p className="text-2xl font-bold">{currentReading.fsr_heel.toFixed(0)}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">% pressure</p>
                    </div>
                    <div className={cn(
                      'rounded-lg p-3 border transition-all',
                      currentReading.fsr_midfoot > 100
                        ? 'bg-blue-100 border-blue-400'
                        : 'bg-slate-100 border-slate-300'
                    )}>
                      <p className="text-xs text-muted-foreground font-medium uppercase mb-1">Midfoot</p>
                      <p className="text-2xl font-bold">{currentReading.fsr_midfoot.toFixed(0)}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">% pressure</p>
                    </div>
                    <div className={cn(
                      'rounded-lg p-3 border transition-all',
                      currentReading.fsr_forefoot > 100
                        ? 'bg-purple-100 border-purple-400'
                        : 'bg-slate-100 border-slate-300'
                    )}>
                      <p className="text-xs text-muted-foreground font-medium uppercase mb-1">Forefoot</p>
                      <p className="text-2xl font-bold">{currentReading.fsr_forefoot.toFixed(0)}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">% pressure</p>
                    </div>
                    <div className={cn(
                      'rounded-lg p-3 border transition-all',
                      currentReading.fsr_toe > 80
                        ? 'bg-orange-100 border-orange-400'
                        : 'bg-slate-100 border-slate-300'
                    )}>
                      <p className="text-xs text-muted-foreground font-medium uppercase mb-1">Toe</p>
                      <p className="text-2xl font-bold">{currentReading.fsr_toe.toFixed(0)}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">% pressure</p>
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
                    Collected <span className="font-medium">{readings.length}</span> shoe sensor readings across all 4 sensors.
                  </p>
                  <p className="text-sm text-green-800 mt-2">Redirecting to results...</p>
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
                Start Shoe Kit Test
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
              <Button onClick={() => router.push('/result')} size="lg" className="w-full">
                View Results
                <ArrowRight className="ml-2 size-4" />
              </Button>
            )}
          </CardFooter>
        </Card>
      </div>
    </div>
  )
}

'use client'

import { createContext, useContext, useState, useCallback } from 'react'
import type { GateDecision, ResultResponse, IntakePayload, PoseLandmark } from '@/lib/api'
import { api } from '@/lib/api'

export type IntakeData = {
  fullName: string
  phone: string
  address: string
  age: string
  gender: string
  stiffness: number | null
  pain: number | null
  duration: string
  injury: string
}

const emptyIntake: IntakeData = {
  fullName: '',
  phone: '',
  address: '',
  age: '',
  gender: '',
  stiffness: null,
  pain: null,
  duration: '',
  injury: '',
}

interface ScreeningContextType {
  sessionId: string | null
  setSessionId: (id: string | null) => void
  intake: IntakeData
  setIntake: (data: IntakeData) => void
  submitted: boolean
  setSubmitted: (value: boolean) => void
  testComplete: boolean
  setTestComplete: (value: boolean) => void
  language: string
  setLanguage: (value: string) => void
  gateDecision: GateDecision | null
  setGateDecision: (decision: GateDecision | null) => void
  screeningResult: ResultResponse | null
  setScreeningResult: (result: ResultResponse | null) => void
  initSession: () => Promise<string>
  submitIntakeForm: (data: IntakeData) => Promise<GateDecision>
  executeWalkTest: (visionData?: PoseLandmark[]) => Promise<void>
  fetchResult: () => Promise<ResultResponse>
  reset: () => void
}

const ScreeningContext = createContext<ScreeningContextType | null>(null)

export function ScreeningProvider({ children }: { children: React.ReactNode }) {
  const [sessionId, setSessionId] = useState<string | null>(null)
  const [intake, setIntake] = useState<IntakeData>(emptyIntake)
  const [submitted, setSubmitted] = useState(false)
  const [testComplete, setTestComplete] = useState(false)
  const [language, setLanguage] = useState('en')
  const [gateDecision, setGateDecision] = useState<GateDecision | null>(null)
  const [screeningResult, setScreeningResult] = useState<ResultResponse | null>(null)

  const initSession = useCallback(async (): Promise<string> => {
    if (sessionId) return sessionId
    const res = await api.createSession()
    setSessionId(res.session_id)
    return res.session_id
  }, [sessionId])

  const submitIntakeForm = useCallback(
    async (data: IntakeData): Promise<GateDecision> => {
      let activeSessionId = sessionId
      if (!activeSessionId) {
        const sessionRes = await api.createSession()
        activeSessionId = sessionRes.session_id
        setSessionId(activeSessionId)
      }

      const payload = {
        full_name: data.fullName,
        phone: data.phone || null,
        address: data.address || null,
        age: parseInt(data.age, 10) || 0,
        gender: data.gender,
        morning_stiffness_minutes: data.stiffness ?? 0,
        pain_severity: data.pain ?? 0,
        pain_duration_category: data.duration || 'none',
        prior_knee_injury: data.injury === 'Yes',
        prior_knee_surgery: false,
      }

      const decision = await api.submitIntake(activeSessionId, payload)
      setGateDecision(decision)
      setSubmitted(true)
      return decision
    },
    [sessionId]
  )

  const executeWalkTest = useCallback(async (visionData?: PoseLandmark[]): Promise<void> => {
    if (!sessionId) {
      throw new Error('No active session found')
    }

    // If real vision data is provided, submit it; otherwise run with simulated data
    if (visionData && visionData.length > 0) {
      // Submit real vision data to the vision endpoint
      await api.submitVisionData(sessionId, { landmarks: visionData })
      // Then generate shoe and knee data through the regular test endpoint
      await api.runTest(sessionId)
    } else {
      // Run full simulated test
      await api.runTest(sessionId)
    }
  }, [sessionId])

  const fetchResult = useCallback(async (): Promise<ResultResponse> => {
    if (!sessionId) {
      throw new Error('No active session found')
    }
    const res = await api.getResult(sessionId)
    setScreeningResult(res)
    return res
  }, [sessionId])

  const reset = useCallback(() => {
    setSessionId(null)
    setIntake({ ...emptyIntake })
    setSubmitted(false)
    setTestComplete(false)
    setGateDecision(null)
    setScreeningResult(null)
  }, [])

  return (
    <ScreeningContext.Provider
      value={{
        sessionId,
        setSessionId,
        intake,
        setIntake,
        submitted,
        setSubmitted,
        testComplete,
        setTestComplete,
        language,
        setLanguage,
        gateDecision,
        setGateDecision,
        screeningResult,
        setScreeningResult,
        initSession,
        submitIntakeForm,
        executeWalkTest,
        fetchResult,
        reset,
      }}
    >
      {children}
    </ScreeningContext.Provider>
  )
}

export function useScreening() {
  const context = useContext(ScreeningContext)
  if (!context) throw new Error('ScreeningProvider is required')
  return context
}

export function passesDemoGate(data: IntakeData) {
  return Number(data.age) >= 40 && ((data.pain ?? 0) > 0 || (data.stiffness ?? 0) > 0 || data.injury === 'Yes')
}

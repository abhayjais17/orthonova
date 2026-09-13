import type { api as backendApi, VisionDataRequest } from './api'

const delay = (milliseconds: number) => new Promise(resolve => setTimeout(resolve, milliseconds))

// Keep the original API contract so the backend client can replace this demo adapter.
export const api = {
  async createSession() {
    await delay(150)
    return { session_id: `demo-${crypto.randomUUID()}`, created_at: new Date().toISOString() }
  },
  async submitIntake(_sessionId: string, payload: any) {
    await delay(500)
    const passed = payload.age >= 40 && (payload.pain_severity > 0 || payload.morning_stiffness_minutes > 0 || payload.prior_knee_injury)
    return { gate_status: passed ? 'pass' : 'fail', passed }
  },
  async runTest(_sessionId: string) {
    await delay(4500)
    return { session_id: _sessionId, status: 'demo', message: 'Simulated walk complete. No sensor data collected.', readings_collected: { shoe: 0, knee: 0, vision: 0 } }
  },
  async submitVisionData(_sessionId: string, data: VisionDataRequest) {
    await delay(200)
    return { stored_landmarks: data.landmarks.length, mode: 'demo' }
  },
  async submitKneeData(_sessionId: string, readings: any[]) {
    await delay(200)
    return { stored_readings: readings.length, mode: 'demo' }
  },
  async submitShoeData(_sessionId: string, readings: any[]) {
    await delay(200)
    return { stored_readings: readings.length, mode: 'demo' }
  },
  async getResult(sessionId: string) {
    await delay(300)
    return {
      session_id: sessionId,
      risk_level: 'Moderate',
      risk_score: 0,
      explanation: 'This illustrative sample shows reduced pressure on the heel while walking and limited knee bending. These patterns can have several causes and may be worth discussing with a doctor. No risk has been calculated from this questionnaire or simulated walk.',
      contributing_factors: [],
      disclaimer: 'Fixed demonstration only. No clinical assessment has been performed.',
    }
  },
} as typeof backendApi

/**
 * Orthonova Typed API Client
 * Calls FastAPI backend endpoints via REST.
 */

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'

// =============================================================================
// Auth Types
// =============================================================================

export interface User {
  id: number
  username: string
  full_name: string | null
}

export interface LoginResponse {
  token: string
  user_id: number
  username: string
  full_name: string | null
}

export interface LoginRequest {
  username: string
  password: string
}

// =============================================================================
// Patient Types
// =============================================================================

export interface PatientSummary {
  id: string
  full_name: string
  age?: number | null
  phone?: string | null
  last_screened: string
  risk_level?: string | null
}

export interface PatientDetail {
  id: string
  full_name: string
  age?: number | null
  phone?: string | null
  address?: string | null
  last_screened: string
  risk_level?: string | null
  risk_score?: number | null
  explanation?: string | null
  contributing_factors?: string[] | null
}

// =============================================================================
// Session/Intake Types (existing)
// =============================================================================

export interface SessionResponse {
  session_id: string
  created_at: string
}

export interface IntakePayload {
  full_name: string
  phone?: string | null
  address?: string | null
  age: number
  gender: string
  morning_stiffness_minutes: number
  pain_severity: number
  pain_duration_category: string
  prior_knee_injury: boolean
  prior_knee_surgery: boolean
}

export interface GateDecision {
  gate_status: 'pass' | 'fail'
  passed: boolean
  reason?: string
  recommendation?: string
}

export interface PoseLandmark {
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

export interface VisionDataRequest {
  landmarks: PoseLandmark[]
}

export interface RunTestResponse {
  session_id: string
  status: string
  message: string
  readings_collected: {
    shoe: number
    knee: number
    vision: number
  }
}

export interface ResultResponse {
  session_id: string
  risk_level: 'Low' | 'Moderate' | 'High' | string
  risk_score: number
  explanation: string
  contributing_factors: string[]
  disclaimer: string
}

// =============================================================================
// Auth State Management (simple in-memory storage)
// =============================================================================

let authToken: string | null = null

export function getAuthToken(): string | null {
  if (typeof window !== 'undefined') {
    // Check sessionStorage first (persists across page refreshes)
    const stored = sessionStorage.getItem('orthonova_auth_token')
    if (stored) {
      authToken = stored
    }
  }
  return authToken
}

export function setAuthToken(token: string | null): void {
  authToken = token
  if (typeof window !== 'undefined') {
    if (token) {
      sessionStorage.setItem('orthonova_auth_token', token)
    } else {
      sessionStorage.removeItem('orthonova_auth_token')
    }
  }
}

export function clearAuthToken(): void {
  setAuthToken(null)
}

// =============================================================================
// API Helper
// =============================================================================

// Timeout for API requests - longer for cold-start detection (Render free tier can take 30-50s)
const FETCH_TIMEOUT_MS = 120000 // 2 minutes for cold-start scenarios

function fetchWithTimeout(url: string, options: RequestInit, timeoutMs: number): Promise<Response> {
  return new Promise((resolve, reject) => {
    const controller = new AbortController()
    const timeoutId = setTimeout(() => {
      controller.abort()
      reject(new Error(`Request timeout after ${timeoutMs}ms - backend may be cold-starting`))
    }, timeoutMs)

    fetch(url, { ...options, signal: controller.signal })
      .then((response) => {
        clearTimeout(timeoutId)
        resolve(response)
      })
      .catch((err) => {
        clearTimeout(timeoutId)
        reject(err)
      })
  })
}

async function fetchJson<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const url = `${API_BASE_URL}${endpoint}`
  const token = getAuthToken()
  const startTime = performance.now()

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>),
  }

  // Add auth token if available
  if (token) {
    headers['Authorization'] = `Bearer ${token}`
  }

  console.log(`[API] ${options.method || 'GET'} ${endpoint}`)

  try {
    const response = await fetchWithTimeout(url, {
      headers,
      ...options,
    }, FETCH_TIMEOUT_MS)

    const duration = performance.now() - startTime
    console.log(`[API] ${options.method || 'GET'} ${endpoint} - ${response.status} (${duration.toFixed(0)}ms)`)

    // Handle auth errors - redirect to login
    if (response.status === 401) {
      clearAuthToken()
      // Redirect to login with a message
      if (typeof window !== 'undefined') {
        sessionStorage.setItem('auth_error', 'Your session expired. Please log in again.')
        window.location.href = '/login'
      }
      throw new Error('Session expired')
    }

    if (!response.ok) {
      let errorMessage = `HTTP ${response.status}: ${response.statusText}`
      try {
        const errorBody = await response.json()
        if (errorBody.detail) {
          errorMessage = errorBody.detail
        }
      } catch {
        // Ignore JSON parse error on non-JSON response
      }
      throw new Error(errorMessage)
    }

    return response.json()
  } catch (err) {
    const duration = performance.now() - startTime
    console.error(`[API] ${options.method || 'GET'} ${endpoint} - Error after ${duration.toFixed(0)}ms:`, err)
    throw err
  }
}

// =============================================================================
// Auth API
// =============================================================================

export const authApi = {
  async login(request: LoginRequest): Promise<LoginResponse> {
    return fetchJson<LoginResponse>('/auth/login', {
      method: 'POST',
      body: JSON.stringify(request),
    })
  },

  async logout(): Promise<void> {
    try {
      await fetchJson('/auth/logout', { method: 'POST' })
    } catch {
      // Ignore logout errors - we still clear local state
    }
    clearAuthToken()
  },

  async getCurrentUser(): Promise<User> {
    return fetchJson<User>('/auth/me', { method: 'GET' })
  },
}

// =============================================================================
// Patient API
// =============================================================================

export const patientApi = {
  async getPatients(): Promise<PatientSummary[]> {
    return fetchJson<PatientSummary[]>('/patients/', { method: 'GET' })
  },

  async getPatient(patientId: string): Promise<PatientDetail> {
    return fetchJson<PatientDetail>(`/patients/${patientId}`, { method: 'GET' })
  },
}

// =============================================================================
// Session API (existing)
// =============================================================================

export const api = {
  createSession: async (): Promise<SessionResponse> => {
    return fetchJson<SessionResponse>('/sessions/', {
      method: 'POST',
    })
  },

  submitIntake: async (sessionId: string, payload: IntakePayload): Promise<GateDecision> => {
    return fetchJson<GateDecision>(`/sessions/${sessionId}/intake`, {
      method: 'POST',
      body: JSON.stringify(payload),
    })
  },

  runTest: async (sessionId: string, visionData?: VisionDataRequest): Promise<RunTestResponse> => {
    // If visionData is provided, use real vision data; otherwise use simulated data
    const body = visionData
      ? JSON.stringify({ vision: visionData })
      : undefined

    return fetchJson<RunTestResponse>(`/sessions/${sessionId}/run-test`, {
      method: 'POST',
      body,
    })
  },

  // New method to submit real vision data directly
  submitVisionData: async (sessionId: string, data: VisionDataRequest): Promise<{ stored_landmarks: number; mode: string }> => {
    return fetchJson(`/sessions/${sessionId}/sensors/vision`, {
      method: 'POST',
      body: JSON.stringify(data),
    })
  },

  // Submit knee sensor data
  submitKneeData: async (sessionId: string, readings: Array<{
    timestamp: number
    knee_flexion: number
    thigh_angle: number
    shin_angle: number
  }>): Promise<{ stored_readings: number; mode: string }> => {
    return fetchJson(`/sessions/${sessionId}/sensors/knee`, {
      method: 'POST',
      body: JSON.stringify({ readings }),
    })
  },

  // Submit shoe sensor data
  submitShoeData: async (sessionId: string, readings: Array<{
    timestamp: number
    fsr_heel: number
    fsr_midfoot: number
    fsr_forefoot: number
    fsr_toe: number
  }>): Promise<{ stored_readings: number; mode: string }> => {
    return fetchJson(`/sessions/${sessionId}/sensors/shoe`, {
      method: 'POST',
      body: JSON.stringify({ readings }),
    })
  },

  getResult: async (sessionId: string): Promise<ResultResponse> => {
    return fetchJson<ResultResponse>(`/sessions/${sessionId}/result`, {
      method: 'GET',
    })
  },
}

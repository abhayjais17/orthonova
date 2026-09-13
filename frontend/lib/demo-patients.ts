import type { IntakeData } from '@/components/orthonova/screening-provider'
import type { ResultResponse } from './api'

export type DemoPatient = {
  sessionId?: string
  intake?: IntakeData
  result?: ResultResponse
  id: string
  name: string
  age: number
  lastScreened: string
  risk: 'low' | 'moderate' | 'high'
}

export const demoPatients: DemoPatient[] = [
  { id: 'ON-1004', name: 'Sunita Sharma', age: 58, lastScreened: '2026-09-10', risk: 'moderate' },
  { id: 'ON-1003', name: 'Rajesh Kumar', age: 64, lastScreened: '2026-09-09', risk: 'low' },
  { id: 'ON-1002', name: 'Meena Patel', age: 52, lastScreened: '2026-09-08', risk: 'high' },
  { id: 'ON-1001', name: 'Anil Desai', age: 47, lastScreened: '2026-09-07', risk: 'low' },
]

export function formatScreenedDate(date: string) {
  return new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' }).format(new Date(`${date}T12:00:00Z`))
}

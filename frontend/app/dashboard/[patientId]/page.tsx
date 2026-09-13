import type { Metadata } from 'next'
import { PatientScreening } from '@/components/orthonova/screening-result'

export const metadata: Metadata = { title: 'Sample patient screening', robots: { index: false, follow: false } }
export const dynamic = 'force-dynamic'

export default async function PatientPage({ params }: { params: Promise<{ patientId: string }> }) {
  const { patientId } = await params
  return <PatientScreening patientId={patientId} />
}

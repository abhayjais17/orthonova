'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { ArrowRight, Plus, UsersRound, ClipboardList, Info, Search } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card'
import { Empty, EmptyHeader, EmptyMedia, EmptyTitle, EmptyDescription, EmptyContent } from '@/components/ui/empty'
import { patientApi, type PatientSummary } from '@/lib/api'
import { useAuth } from './auth-provider'
import { useScreening } from './screening-provider'

function formatScreenedDate(dateString: string) {
  const date = new Date(dateString)
  return new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' }).format(date)
}

export function CreatePatientLink() {
  const { reset } = useScreening()
  return <Link href="/intake" onClick={reset} className="primary-link"><Plus className="size-5" aria-hidden="true" />Create New Patient</Link>
}

export function PatientDashboard({ patients: suppliedPatients }: { patients?: PatientSummary[] }) {
  const router = useRouter()
  const { isAuthenticated, isLoading: authLoading } = useAuth()
  const [patients, setPatients] = useState<PatientSummary[]>(suppliedPatients ?? [])
  const [loading, setLoading] = useState(!suppliedPatients)
  const [error, setError] = useState('')
  const [previewEmpty, setPreviewEmpty] = useState(false)
  const [searchId, setSearchId] = useState('')
  const [searchError, setSearchError] = useState('')
  const [searchLoading, setSearchLoading] = useState(false)

  // Redirect to login if not authenticated
  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      router.push('/login')
    }
  }, [authLoading, isAuthenticated, router])

  // Load patients from API
  useEffect(() => {
    if (suppliedPatients || !isAuthenticated) return

    async function loadPatients() {
      try {
        setError('')
        const data = await patientApi.getPatients()
        setPatients(data)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load patients')
      } finally {
        setLoading(false)
      }
    }

    loadPatients()
  }, [isAuthenticated, suppliedPatients])

  const handleSearchPatient = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!searchId.trim()) {
      setSearchError('Please enter a patient ID')
      return
    }

    setSearchLoading(true)
    setSearchError('')

    try {
      const patient = await patientApi.getPatient(searchId.trim())
      router.push(`/dashboard/${patient.id}`)
    } catch (err) {
      setSearchError('No patient found with that ID. Try again or create a new patient.')
      setSearchLoading(false)
    }
  }

  if (authLoading || loading) {
    return (
      <div className="page-width enter-page flex flex-col gap-8 py-10 md:gap-10 md:py-12">
        <div className="flex flex-col items-start justify-between gap-6 md:flex-row md:items-end">
          <div className="flex flex-col gap-3">
            <p className="eyebrow">Your clinic workspace</p>
            <h1 className="page-heading">Every patient. Every step.</h1>
            <p className="max-w-xl text-lg text-muted-foreground">Loading your dashboard…</p>
          </div>
        </div>
      </div>
    )
  }

  const visiblePatients = previewEmpty ? [] : patients

  return (
    <div className="page-width enter-page flex flex-col gap-8 py-10 md:gap-10 md:py-12">
      <div className="flex flex-col items-start justify-between gap-6 md:flex-row md:items-end">
        <div className="flex flex-col gap-3">
          <p className="eyebrow">Your clinic workspace</p>
          <h1 className="page-heading">Every patient. Every step.</h1>
          <p className="max-w-xl text-lg text-muted-foreground">A little care starts here.</p>
        </div>
        <CreatePatientLink />
      </div>
      <section aria-labelledby="patients-heading">
        <Card className="screen-card">
          <CardHeader className="gap-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <CardTitle><h2 id="patients-heading" className="flex items-center gap-3"><UsersRound className="size-6 text-primary" aria-hidden="true" />Your patients</h2></CardTitle>
              <span className="text-sm text-muted-foreground">{visiblePatients.length} {visiblePatients.length === 1 ? 'patient' : 'patients'}</span>
            </div>
            <CardDescription>Pick up where you left off, or start a new screening.</CardDescription>
            {/* Search box */}
            <form onSubmit={handleSearchPatient} className="flex gap-2 pt-2">
              <div className="relative flex-1">
                <input
                  type="text"
                  placeholder="Search by patient ID..."
                  value={searchId}
                  onChange={(e) => {
                    setSearchId(e.target.value)
                    setSearchError('')
                  }}
                  className="w-full rounded-lg border border-border bg-background px-3 py-2 pl-10 text-sm placeholder-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                />
                <Search className="absolute left-3 top-2.5 size-4 text-muted-foreground" />
              </div>
              <Button type="submit" size="sm" disabled={searchLoading} variant="default">
                {searchLoading ? 'Searching...' : 'Find'}
              </Button>
            </form>
            {searchError && <p className="text-sm text-destructive">{searchError}</p>}
          </CardHeader>
          <CardContent>
            {error && <div className="mb-4 rounded-md bg-red-50 p-3 text-sm text-red-700">{error}</div>}
            {visiblePatients.length ? (
              <ul aria-label="Patient list" className="flex flex-col gap-4">
                {visiblePatients.map(patient => <PatientRow key={patient.id} patient={patient} />)}
              </ul>
            ) : (
              <Empty className="patient-empty py-10 md:py-14">
                <EmptyHeader>
                  <EmptyMedia variant="icon"><ClipboardList aria-hidden="true" /></EmptyMedia>
                  <EmptyTitle><h3>Your first patient is a step away.</h3></EmptyTitle>
                  <EmptyDescription>No patients yet. Start a screening and give someone a clearer picture of their knee health.</EmptyDescription>
                </EmptyHeader>
                <EmptyContent><CreatePatientLink /></EmptyContent>
              </Empty>
            )}
          </CardContent>
        </Card>
      </section>
      <div className="flex flex-col items-start justify-between gap-3 sm:flex-row sm:items-center">
        <p className="flex items-center gap-2 text-sm text-muted-foreground"><Info className="size-4 shrink-0 text-primary" aria-hidden="true" />Patient data is now saved per health worker. Results persist between sessions.</p>
        <Button variant="link" className="min-h-11" onClick={() => setPreviewEmpty(value => !value)} aria-pressed={previewEmpty}>{previewEmpty ? 'Show patients' : 'Preview empty state'}</Button>
      </div>
    </div>
  )
}

function PatientRow({ patient }: { patient: PatientSummary }) {
  const riskName = patient.risk_level ? patient.risk_level[0].toUpperCase() + patient.risk_level.slice(1) : 'Unknown'
  return (
    <li className="patient-row">
      <div className="col-span-2 flex min-w-0 items-center gap-4 md:col-span-1">
        <span aria-hidden="true" className="flex size-11 shrink-0 items-center justify-center rounded-full bg-secondary text-sm font-semibold text-primary">{patient.full_name.split(' ').map(word => word[0]).join('').toUpperCase().slice(0, 2)}</span>
        <div className="min-w-0"><h3 className="font-heading text-xl font-bold [overflow-wrap:anywhere]">{patient.full_name}</h3><p className="text-sm text-muted-foreground">{patient.id.slice(0, 8)}</p></div>
      </div>
      <div><p className="pb-1 text-xs text-muted-foreground">Age</p><p className="text-base">{patient.age ?? '—'} years</p></div>
      <div><p className="pb-1 text-xs text-muted-foreground">Last screened</p><time dateTime={patient.last_screened} className="text-base">{formatScreenedDate(patient.last_screened)}</time></div>
      <div><p className="pb-1 text-xs text-muted-foreground">Last risk level</p><Badge variant={(patient.risk_level?.toLowerCase() as 'low' | 'moderate' | 'high') ?? 'low'} size="compact">{riskName} risk</Badge></div>
      <Link href={`/dashboard/${patient.id}`} className="quiet-link justify-self-end" aria-label={`View ${patient.full_name}'s screening`}>View <ArrowRight className="size-4" aria-hidden="true" /></Link>
    </li>
  )
}

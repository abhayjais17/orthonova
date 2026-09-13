'use client'

import { useState, useEffect } from 'react'
import useSWR from 'swr'
import { BackLink } from './app-shell'
import { useRouter } from 'next/navigation'
import { Check, Download, ArrowRight, Stethoscope, Footprints, Sprout } from 'lucide-react'
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import { patientApi, type PatientDetail, type ResultResponse } from '@/lib/api'
import { useScreening } from './screening-provider'
import { SessionNeeded } from './gate-result'
import { ScreeningNotice } from './screening-notice'

const examples = {
  low: {
    name: 'Low',
    heading: 'Keep caring for your knees.',
    explanation: 'This sample shows a steady walking pattern and comfortable knee movement. These would be reassuring signs, but a screening cannot rule out a knee problem.',
    advice: 'Keep moving comfortably and speak with a doctor if pain appears or continues.',
    icon: Sprout,
  },
  moderate: {
    name: 'Moderate',
    heading: 'A little attention can go a long way.',
    explanation: 'This sample shows reduced pressure on the heel while walking and limited knee bending. These patterns can have several causes and may be worth discussing with a doctor.',
    advice: 'Arrange a visit with a doctor to discuss your knee symptoms and suitable next steps.',
    icon: Stethoscope,
  },
  high: {
    name: 'High',
    heading: 'Let’s take the next step together.',
    explanation: 'This sample shows noticeable changes in walking and reduced knee movement. These patterns do not confirm osteoarthritis, but a doctor’s examination would help clarify the cause.',
    advice: 'Arrange a doctor’s appointment soon. Your health worker can help you find the right care.',
    icon: Stethoscope,
  },
}

function formatScreenedDate(dateString: string) {
  const date = new Date(dateString)
  return new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' }).format(date)
}

export function PatientScreening({ patientId }: { patientId: string }) {
  const router = useRouter()
  const [patient, setPatient] = useState<PatientDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    async function loadPatient() {
      try {
        const data = await patientApi.getPatient(patientId)
        setPatient(data)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load patient')
      } finally {
        setLoading(false)
      }
    }

    loadPatient()
  }, [patientId])

  if (loading) {
    return (
      <div className="page-width flex flex-col items-center gap-5 py-12">
        <p role="status">Loading patient details…</p>
      </div>
    )
  }

  if (error || !patient) {
    return (
      <div className="page-width flex flex-col items-center gap-5 py-12">
        <p role="status" className="text-red-600">{error || 'Patient not found'}</p>
        <BackLink href="/dashboard">Back to patient list</BackLink>
      </div>
    )
  }

  return <ScreeningResult samplePatient={patient} />
}

export function ScreeningResult({ samplePatient }: { samplePatient?: PatientDetail }) {
  const { sessionId, intake, submitted, testComplete, fetchResult, reset } = useScreening()
  const [previewRisk, setRisk] = useState<keyof typeof examples | null>(null)
  const router = useRouter()
  const { data: fetchedResult, error, isLoading, mutate } = useSWR(
    !samplePatient && submitted && testComplete && sessionId ? ['screening-result', sessionId] : null,
    fetchResult,
    {
      revalidateOnFocus: false,
      revalidateOnReconnect: false,
      revalidateIfStale: false,
      dedupingInterval: 60000,
    },
  )
  const screeningResult = samplePatient ? {
    session_id: samplePatient.id,
    risk_level: samplePatient.risk_level || 'Moderate',
    risk_score: samplePatient.risk_score || 0,
    explanation: samplePatient.explanation || '',
    contributing_factors: samplePatient.contributing_factors || [],
    disclaimer: '',
  } : fetchedResult

  // Check if we're showing real computed result vs a sample preview
  const hasRealResult = !samplePatient && screeningResult?.risk_level != null && screeningResult?.explanation
  const isPreviewingSample = previewRisk != null || (!hasRealResult && !samplePatient)

  const resultRisk = (screeningResult?.risk_level || '').toLowerCase()
  const effectiveRiskKey = resultRisk === 'low' || resultRisk === 'high' ? resultRisk : 'moderate'
  const risk = previewRisk ?? effectiveRiskKey as keyof typeof examples

  if (!samplePatient && !submitted) return <SessionNeeded />
  if (!samplePatient && !testComplete) return <SessionNeeded test />
  if (!samplePatient && (isLoading || error)) return (
    <div className="page-width flex flex-col items-center gap-5 py-12">
      <p role="status">{error ? 'Unable to load the result.' : 'Preparing your summary…'}</p>
      {error && <Button size="lg" onClick={() => mutate()}>Try again</Button>}
      <BackLink href="/dashboard">Back to patient list</BackLink>
    </div>
  )

  const result = examples[risk]
  const Icon = result.icon
  const explanationText =
    screeningResult && risk === (screeningResult.risk_level?.toLowerCase() as keyof typeof examples)
      ? screeningResult.explanation
      : result.explanation

  return (
    <div className="page-width enter-page py-6">
      <div className="mx-auto flex max-w-2xl flex-col gap-6">
        <div className="no-print"><BackLink href="/dashboard">Back to patient list</BackLink></div>
        {(samplePatient || intake.fullName) && <p className="text-center text-base text-muted-foreground"><span className="font-semibold text-foreground">{samplePatient?.full_name ?? intake.fullName}</span>{' · '}{samplePatient?.age ?? intake.age} years{samplePatient && <> · {formatScreenedDate(samplePatient.last_screened)}</>}</p>}
        <div className="flex flex-col items-center gap-3 text-center">
          <span className="flex items-center gap-2 text-sm font-semibold text-primary">
            <Check className="size-4" />All three steps complete
          </span>
          <h1 className="page-heading">Your knee health summary</h1>
          <p className="text-lg text-muted-foreground">A little understanding. A clearer next step.</p>
        </div>
        <div className="no-print flex flex-wrap items-center justify-center gap-2 rounded-xl border border-dashed border-border p-3">
          <span className="text-sm text-muted-foreground">Preview sample:</span>
          <ToggleGroup
            className="demo-toggle"
            value={[risk]}
            onValueChange={values => {
              if (values[0] && values[0] in examples) setRisk(values[0] as keyof typeof examples)
            }}
            aria-label="Preview sample risk level"
          >
            {Object.entries(examples).map(([key, value]) => (
              <ToggleGroupItem key={key} value={key}>
                {value.name}
              </ToggleGroupItem>
            ))}
          </ToggleGroup>
        </div>
        <Card className="screen-card">
          <CardHeader className="justify-items-center gap-4 text-center">
            <p className="eyebrow">Screening summary · Clinical support</p>
            <Badge variant={risk}>{result.name} risk</Badge>
            <CardTitle>
              <h2 className="font-heading text-3xl font-bold leading-tight text-balance">{result.heading}</h2>
            </CardTitle>
            <CardDescription>
              {isPreviewingSample
                ? 'Illustrative sample only. No risk has been calculated from your answers or your walk.'
                : 'Your personalized screening result based on your answers and sensor data.'}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col gap-6">
              <div>
                <h3 className="flex items-center gap-2 font-heading text-xl font-bold">
                  <Footprints className="size-5 text-primary" />What this result means
                </h3>
                <p className="pt-3 text-lg leading-relaxed text-muted-foreground">{explanationText}</p>
                {screeningResult?.contributing_factors &&
                  screeningResult.contributing_factors.length > 0 &&
                  risk === (screeningResult.risk_level?.toLowerCase() as keyof typeof examples) && (
                    <ul className="mt-3 flex flex-col gap-1 text-base text-muted-foreground">
                      {screeningResult.contributing_factors.map((factor, i) => (
                        <li key={i} className="flex items-center gap-2">
                          <span className="size-1.5 rounded-full bg-primary" />
                          {factor}
                        </li>
                      ))}
                    </ul>
                  )}
              </div>
              <div className="rounded-2xl bg-secondary p-5 text-primary">
                <h3 className="flex items-center gap-2 font-heading text-xl font-bold">
                  <Icon className="size-5" />Your next step
                </h3>
                <p className="pt-2 text-lg leading-relaxed">{result.advice}</p>
              </div>
              <ScreeningNotice result />
              <p className="text-sm text-muted-foreground border-t pt-4">
                For sudden severe pain, a hot swollen knee, or inability to bear weight, seek prompt medical care.
              </p>
            </div>
          </CardContent>
          <CardFooter className="no-print flex-col gap-4">
            <Button size="lg" variant="outline" className="w-full" onClick={() => window.print()}>
              <Download data-icon="inline-start" />Save or print {isPreviewingSample ? 'sample result' : 'result'}
            </Button>
            <Button
              variant="ghost"
              size="lg"
              className="w-full"
              onClick={() => {
                reset()
                router.push('/intake')
              }}
            >
              Start a new screening <ArrowRight data-icon="inline-end" />
            </Button>
          </CardFooter>
        </Card>
      </div>
    </div>
  )
}
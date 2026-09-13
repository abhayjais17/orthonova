'use client'

import Link from 'next/link'
import { ArrowRight, Check, Sprout, Footprints } from 'lucide-react'
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card'
import { useScreening, passesDemoGate } from './screening-provider'
import { ScreeningNotice } from './screening-notice'
import { BackLink } from './app-shell'

export function GateResult() {
  const { intake, submitted, gateDecision } = useScreening()
  if (!submitted) return <SessionNeeded />

  // Use real gateDecision from backend if available, otherwise fallback to local rule
  const pass = gateDecision ? gateDecision.gate_status === 'pass' || gateDecision.passed : passesDemoGate(intake)

  let failureDescription = Number(intake.age) < 40
    ? 'This example screening pathway is designed for people aged 40 and above. The demo walk test is not needed in this pathway right now.'
    : 'You haven’t reported knee pain, morning stiffness, or a previous knee injury. The demo walk test is not needed in this pathway right now.'

  if (gateDecision?.recommendation && !pass) {
    failureDescription = gateDecision.recommendation
  }

  return (
    <div className="page-width enter-page py-8">
      <div className="mx-auto flex max-w-2xl flex-col gap-6">
        <BackLink href="/intake">Review your answers</BackLink>
        <Card className="screen-card text-center">
          <CardHeader className="justify-items-center gap-5">
            <span className="flex size-20 items-center justify-center rounded-full bg-secondary text-primary">
              {pass ? <Check className="size-10" /> : <Sprout className="size-10" />}
            </span>
            <p className="eyebrow">{pass ? 'You’re ready for the next step' : 'A little reassurance'}</p>
            <CardTitle>
              <h1 className="page-heading">{pass ? "Let's proceed to the walk test." : 'You can pause here for now.'}</h1>
            </CardTitle>
            <CardDescription>
              {pass ? 'Thank you for sharing. Next, your health worker will guide you through a short, comfortable walk.' : failureDescription}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="rounded-2xl bg-background p-5 text-lg text-muted-foreground">
              {pass ? (
                <p className="flex items-start gap-3 text-left">
                  <Footprints className="mt-1 size-5 shrink-0 text-primary" />
                  Wear comfortable footwear and use your usual walking aid if needed. Stop if you feel pain or unsteadiness.
                </p>
              ) : (
                <p>This does not rule out a knee problem. If you have discomfort or concerns, a doctor can help—at any age.</p>
              )}
            </div>
            <p className="pt-5 text-sm text-muted-foreground">Demo eligibility only. These rules are not medical advice.</p>
          </CardContent>
          <CardFooter className="justify-center">
            <Link className="primary-link w-full" href={pass ? '/test' : '/intake'}>
              {pass ? 'Continue to walk test' : 'Review your answers'}
              <ArrowRight className="size-5" />
            </Link>
          </CardFooter>
        </Card>
        <ScreeningNotice />
        <BackLink href="/dashboard">Back to patient list</BackLink>
      </div>
    </div>
  )
}

export function SessionNeeded({ test = false }: { test?: boolean }) {
  return (
    <div className="page-width py-12">
      <div className="mx-auto flex max-w-xl flex-col items-center gap-6 text-center">
        <Footprints className="size-12 text-primary" />
        <h1 className="page-heading">{test ? 'One small step first.' : 'Let’s start with you.'}</h1>
        <p className="text-lg text-muted-foreground">
          {test
            ? 'Complete the simulated walk test to see your sample result.'
            : 'Please complete the short questionnaire first. Answers are cleared when the page is refreshed.'}
        </p>
        <Link href={test ? '/test' : '/intake'} className="primary-link">
          {test ? 'Go to walk test' : 'Start questionnaire'}
          <ArrowRight className="size-5" />
        </Link>
        <BackLink href="/dashboard">Back to patient list</BackLink>
      </div>
    </div>
  )
}

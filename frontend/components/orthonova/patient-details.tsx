'use client'

import { UserRound } from 'lucide-react'
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card'
import { Field, FieldGroup, FieldLabel, FieldError } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import type { IntakeData } from './screening-provider'

type PatientDetailsProps = {
  intake: IntakeData
  errors: Record<string, string>
  onChange: <K extends keyof IntakeData>(key: K, value: IntakeData[K]) => void
}

export function PatientDetails({ intake, errors, onChange }: PatientDetailsProps) {
  return (
    <Card className="screen-card">
      <CardHeader>
        <CardTitle><h2 className="flex items-center gap-3"><UserRound className="size-6 text-primary" aria-hidden="true" />Patient Details</h2></CardTitle>
        <CardDescription>Start with the person behind the screening. Phone number and address are optional.</CardDescription>
      </CardHeader>
      <CardContent>
        <FieldGroup>
          <Field data-invalid={!!errors.fullName}>
            <FieldLabel htmlFor="fullName">Full name</FieldLabel>
            <Input id="fullName" name="fullName" autoComplete="off" placeholder="Patient’s full name" value={intake.fullName} onChange={event => onChange('fullName', event.target.value)} maxLength={120} required aria-invalid={!!errors.fullName} aria-describedby={errors.fullName ? 'fullName-error' : undefined} />
            <FieldError id="fullName-error">{errors.fullName}</FieldError>
          </Field>
          <Field>
            <FieldLabel htmlFor="phone">Phone number <span className="text-sm font-normal text-muted-foreground">(optional)</span></FieldLabel>
            <Input id="phone" name="phone" type="tel" inputMode="tel" autoComplete="off" placeholder="Patient’s phone number" value={intake.phone} onChange={event => onChange('phone', event.target.value)} maxLength={30} />
          </Field>
          <Field>
            <FieldLabel htmlFor="address">Address <span className="text-sm font-normal text-muted-foreground">(optional)</span></FieldLabel>
            <Textarea id="address" name="address" autoComplete="off" placeholder="Street, locality, city or village" value={intake.address} onChange={event => onChange('address', event.target.value)} maxLength={500} rows={3} />
          </Field>
        </FieldGroup>
      </CardContent>
    </Card>
  )
}

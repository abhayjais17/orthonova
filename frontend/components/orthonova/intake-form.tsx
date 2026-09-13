'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowRight, ClipboardList, Info } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card'
import { Field, FieldGroup, FieldLabel, FieldDescription, FieldSet, FieldLegend, FieldError } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { Slider } from '@/components/ui/slider'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { Progress, ProgressLabel, ProgressValue } from '@/components/ui/progress'
import { useScreening, type IntakeData } from './screening-provider'
import { BackLink } from './app-shell'
import { PatientDetails } from './patient-details'

export function IntakeForm() {
  const { intake, setIntake, setSubmitted, setTestComplete, submitIntakeForm } = useScreening()
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [isSubmitting, setIsSubmitting] = useState(false)
  const router = useRouter()
  const requiredValues = [intake.fullName.trim(), intake.age, intake.gender, intake.stiffness, intake.pain, intake.duration, intake.injury]
  const requiredCompleted = requiredValues.filter(value => value !== '' && value !== null).length
  const optionalCompleted = [intake.phone, intake.address].filter(value => value.trim() !== '' || requiredCompleted === 7).length
  const completed = requiredCompleted + optionalCompleted

  function update<K extends keyof IntakeData>(key: K, value: IntakeData[K]) {
    setIntake({ ...intake, [key]: value })
    setSubmitted(false)
    setTestComplete(false)
    setErrors(previous => ({ ...previous, [key]: '' }))
  }

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const next: Record<string, string> = {}
    if (!intake.fullName.trim()) next.fullName = 'Please enter the patient’s full name.'
    if (!intake.age || !Number.isInteger(Number(intake.age)) || Number(intake.age) < 1 || Number(intake.age) > 120) next.age = 'Please enter an age between 1 and 120.'
    if (!intake.gender) next.gender = 'Please select an option.'
    if (intake.stiffness === null) next.stiffness = 'Please move the slider or choose No stiffness.'
    if (intake.pain === null) next.pain = 'Please move the slider or choose No pain.'
    if (!intake.duration) next.duration = 'Please select how long you have had pain, or No pain.'
    if (!intake.injury) next.injury = 'Please choose Yes or No.'
    setErrors(next)
    if (Object.keys(next).length) {
      requestAnimationFrame(() => document.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus())
      return
    }

    try {
      setIsSubmitting(true)
      await submitIntakeForm(intake)
      router.push('/gate-result')
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Unable to connect to server. Please try again.'
      setErrors({ form: msg })
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="page-width enter-page pb-4">
      <div className="mx-auto flex max-w-3xl flex-col gap-7">
        <div>
          <BackLink href="/dashboard">Back to patient list</BackLink>
          <p className="eyebrow pt-5">Step 1 · About you</p>
          <h1 className="page-heading pt-3">Let&apos;s get to know your knees.</h1>
          <p className="pt-4 text-lg text-muted-foreground">There are no right or wrong answers. Your health worker can help.</p>
        </div>
        <div className="flex flex-col gap-2">
          <Progress value={Math.round((completed / 9) * 100)} aria-label="Questionnaire completion">
            <ProgressLabel>Questions completed · {completed} of 9</ProgressLabel>
            <ProgressValue />
          </Progress>
          <p className="text-sm text-muted-foreground">Includes 2 optional fields, which can be skipped. They count as complete when all required answers are filled.</p>
        </div>
        <form onSubmit={submit} noValidate className="flex flex-col gap-7">
          <PatientDetails intake={intake} errors={errors} onChange={update} />
          <Card className="screen-card">
            <CardHeader>
              <CardTitle>
                <h2 className="flex items-center gap-3">
                  <ClipboardList className="size-6 text-primary" />A little about you
                </h2>
              </CardTitle>
              <CardDescription>Take your time. Answer all six questions below.</CardDescription>
            </CardHeader>
            <CardContent>
              <FieldGroup>
                <Field data-invalid={!!errors.age}>
                  <FieldLabel htmlFor="age">How old are you?</FieldLabel>
                  <Input
                    id="age"
                    type="number"
                    min={1}
                    max={120}
                    inputMode="numeric"
                    placeholder="Your age in years"
                    value={intake.age}
                    onChange={e => update('age', e.target.value)}
                    aria-invalid={!!errors.age}
                    aria-describedby={errors.age ? 'age-error' : undefined}
                    required
                  />
                  <FieldError id="age-error">{errors.age}</FieldError>
                </Field>
                <FieldSet data-invalid={!!errors.gender}>
                  <FieldLegend id="gender-label">Gender</FieldLegend>
                  <RadioGroup
                    value={intake.gender}
                    onValueChange={value => update('gender', String(value))}
                    aria-labelledby="gender-label"
                    className="grid-cols-1 min-[400px]:grid-cols-3"
                  >
                    {['Male', 'Female', 'Other'].map(option => (
                      <label key={option} className="choice-card">
                        <RadioGroupItem value={option} aria-invalid={!!errors.gender} />
                        {option}
                      </label>
                    ))}
                  </RadioGroup>
                  <FieldError>{errors.gender}</FieldError>
                </FieldSet>
                <SymptomSlider
                  label="Morning knee stiffness"
                  description="How long do your knees feel stiff after you wake up?"
                  value={intake.stiffness}
                  max={60}
                  unit="min"
                  zeroLabel="No stiffness"
                  endLabel="60 minutes"
                  error={errors.stiffness}
                  onChange={value => update('stiffness', value)}
                />
                <SymptomSlider
                  label="Knee pain severity"
                  description="How much do your knees hurt on a typical day?"
                  value={intake.pain}
                  max={10}
                  unit="/ 10"
                  zeroLabel="No pain"
                  endLabel="Severe pain"
                  error={errors.pain}
                  onChange={value => update('pain', value)}
                />
                <Field data-invalid={!!errors.duration}>
                  <FieldLabel htmlFor="duration">How long have you had knee pain?</FieldLabel>
                  <select
                    id="duration"
                    value={intake.duration}
                    onChange={e => update('duration', e.target.value)}
                    aria-invalid={!!errors.duration}
                    required
                  >
                    <option value="" disabled>Choose a duration</option>
                    <option value="none">No pain</option>
                    <option value="weeks">A few weeks</option>
                    <option value="months">A few months</option>
                    <option value="years">A year or longer</option>
                  </select>
                  <FieldError>{errors.duration}</FieldError>
                </Field>
                <FieldSet data-invalid={!!errors.injury}>
                  <FieldLegend id="injury-label">Have you had a knee injury or knee surgery?</FieldLegend>
                  <RadioGroup
                    value={intake.injury}
                    onValueChange={value => update('injury', String(value))}
                    aria-labelledby="injury-label"
                    className="grid-cols-2"
                  >
                    {['Yes', 'No'].map(option => (
                      <label key={option} className="choice-card">
                        <RadioGroupItem value={option} aria-invalid={!!errors.injury} />
                        {option}
                      </label>
                    ))}
                  </RadioGroup>
                  <FieldError>{errors.injury}</FieldError>
                </FieldSet>
              </FieldGroup>
            </CardContent>
            <CardFooter className="flex-col gap-3">
              {errors.form && <FieldError className="text-center">{errors.form}</FieldError>}
              <Button type="submit" size="lg" className="w-full" disabled={isSubmitting}>
                {isSubmitting ? 'Submitting...' : 'Continue'} <ArrowRight data-icon="inline-end" />
              </Button>
              <p className="text-center text-sm text-muted-foreground">Your answers stay in this session only.</p>
            </CardFooter>
          </Card>
        </form>
        <p className="flex items-start gap-2 text-sm text-muted-foreground">
          <Info className="mt-1 size-4 shrink-0 text-primary" />
          This is a demonstration. The questionnaire and eligibility rules are not clinically validated.
        </p>
      </div>
    </div>
  )
}

function SymptomSlider({
  label,
  description,
  value,
  max,
  unit,
  zeroLabel,
  endLabel,
  error,
  onChange,
}: {
  label: string
  description: string
  value: number | null
  max: number
  unit: string
  zeroLabel: string
  endLabel: string
  error?: string
  onChange: (value: number) => void
}) {
  return (
    <Field data-invalid={!!error}>
      <FieldLabel>{label}</FieldLabel>
      <FieldDescription>{description}</FieldDescription>
      <div className="px-4 pb-2 pt-12">
        <Slider
          value={[value ?? 0]}
          min={0}
          max={max}
          step={1}
          aria-label={label}
          aria-invalid={!!error}
          onValueChange={values => onChange(Array.isArray(values) ? values[0] : values)}
          formatValue={v => `${v} ${unit}`}
        />
      </div>
      <div className="flex items-center justify-between gap-3">
        <button
          type="button"
          className="min-h-11 rounded-lg text-base text-primary underline decoration-primary/40 underline-offset-4 hover:decoration-primary focus-visible:ring-3 focus-visible:ring-ring"
          onClick={() => onChange(0)}
        >
          {zeroLabel}
          {value === 0 ? ' (selected)' : ''}
        </button>
        <span className="text-base text-muted-foreground">{endLabel}</span>
      </div>
      <FieldError>{error}</FieldError>
    </Field>
  )
}

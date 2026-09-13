'use client'

import { useState, useEffect, type FormEvent } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowRight, Eye, EyeOff, HeartHandshake, LoaderCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card'
import { Field, FieldGroup, FieldLabel, FieldError } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { InputGroup, InputGroupInput, InputGroupAddon, InputGroupButton } from '@/components/ui/input-group'
import { useAuth } from './auth-provider'

type StaffLoginProps = { onLogin?: (username: string, password: string) => Promise<void> }

export function StaffLogin({ onLogin }: StaffLoginProps) {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const { login } = useAuth()
  const router = useRouter()

  // Check for auth error message from redirect
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const authError = sessionStorage.getItem('auth_error')
      if (authError) {
        setError(authError)
        sessionStorage.removeItem('auth_error')
      }
    }
  }, [])

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (loading) return
    setError('')
    setLoading(true)
    try {
      if (onLogin) {
        // Custom handler for testing
        await onLogin(username.trim(), password)
      } else {
        // Real authentication via API (updates AuthProvider state)
        await login(username.trim(), password)
      }
      setPassword('')
      router.push('/dashboard')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to continue. Please try again.')
      setLoading(false)
    }
  }

  return (
    <div className="page-width enter-page py-12 md:py-16">
      <div className="mx-auto flex max-w-lg flex-col items-center gap-7">
        <div className="flex flex-col items-center gap-4 text-center">
          <span className="flex size-16 items-center justify-center rounded-2xl bg-secondary text-primary"><HeartHandshake className="size-8" strokeWidth={1.5} aria-hidden="true" /></span>
          <p className="eyebrow">For our health workers</p>
          <h1 className="page-heading">Welcome back.</h1>
          <p className="max-w-sm text-lg text-muted-foreground">A little care. A meaningful difference.<br />Let&apos;s take the next step together.</p>
        </div>
        <form onSubmit={submit} className="w-full" aria-busy={loading}>
          <Card className="screen-card">
            <CardHeader>
              <CardTitle><h2>Log in to Orthonova</h2></CardTitle>
              <CardDescription>Your patient screenings, in one place.</CardDescription>
            </CardHeader>
            <CardContent>
              <FieldGroup>
                <Field data-disabled={loading}>
                  <FieldLabel htmlFor="username">Username</FieldLabel>
                  <Input id="username" name="username" placeholder="Enter your username" autoComplete="username" autoCapitalize="none" spellCheck={false} required maxLength={80} pattern=".*\S.*" value={username} onChange={event => setUsername(event.target.value)} disabled={loading} />
                </Field>
                <Field data-disabled={loading}>
                  <FieldLabel htmlFor="password">Password</FieldLabel>
                  <InputGroup>
                    <InputGroupInput id="password" name="password" type={showPassword ? 'text' : 'password'} placeholder="Enter your password" autoComplete="current-password" required value={password} onChange={event => setPassword(event.target.value)} disabled={loading} />
                    <InputGroupAddon align="inline-end">
                      <InputGroupButton data-slot="input-group-button" size="icon-sm" aria-label={showPassword ? 'Hide password' : 'Show password'} aria-pressed={showPassword} aria-controls="password" onClick={() => setShowPassword(value => !value)} disabled={loading}>
                        {showPassword ? <EyeOff /> : <Eye />}
                      </InputGroupButton>
                    </InputGroupAddon>
                  </InputGroup>
                </Field>
                {error && <FieldError role="alert">{error}</FieldError>}
              </FieldGroup>
            </CardContent>
            <CardFooter className="flex-col gap-4">
              <Button type="submit" size="lg" className="w-full" disabled={loading}>
                {loading ? <><LoaderCircle className="animate-spin" data-icon="inline-start" />Opening dashboard…</> : <>Log in <ArrowRight data-icon="inline-end" /></>}
              </Button>
              <p className="text-center text-sm text-muted-foreground">Use the account provided by your clinic administrator</p>
            </CardFooter>
          </Card>
        </form>
        <p className="max-w-sm text-center text-sm text-muted-foreground">Demo accounts: demo/demo123 or priya/priya123</p>
      </div>
    </div>
  )
}

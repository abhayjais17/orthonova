'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Footprints, ShieldCheck, Check, ArrowLeft, Globe } from 'lucide-react'
import { Button, buttonVariants } from '@/components/ui/button'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import { useScreening } from './screening-provider'
import { cn } from '@/lib/utils'
import { StaffHeaderActions } from './staff-header-actions'

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const { language, setLanguage } = useScreening()
  const isWelcome = pathname === '/'
  const isLogin = pathname === '/login'
  const isDashboard = pathname.startsWith('/dashboard')
  const isScreening = ['/intake', '/gate-result', '/test', '/result'].some(p => pathname.startsWith(p)) ||
                       pathname.includes('/knee-test') ||
                       pathname.includes('/shoe-test')

  // Determine current step (1-5)
  let step = 1
  if (pathname === '/intake' || pathname === '/gate-result') step = 1
  else if (pathname === '/test') step = 2
  else if (pathname.includes('/knee-test')) step = 3
  else if (pathname.includes('/shoe-test')) step = 4
  else if (pathname === '/result') step = 5

  const steps = ['About you', 'Walk test', 'Knee kit', 'Shoe kit', 'Your result']

  return <div className="flex min-h-svh flex-col">
    <a href="#main-content" className="sr-only focus:not-sr-only focus:bg-primary focus:p-4 focus:text-primary-foreground">Skip to content</a>
    <header className="border-b border-border/70">
      <div className={cn('page-width flex h-24 flex-nowrap items-center justify-between', !isDashboard && !isLogin && 'public-header-row', isWelcome && 'max-sm:h-20')}>
        <Link href="/" aria-label="Orthonova home" className="header-brand flex shrink-0 items-center gap-2 sm:gap-3">
          <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground sm:size-11 sm:rounded-2xl"><Footprints className="size-5 -rotate-12 sm:size-6" strokeWidth={1.8} /></span>
          <span className="font-heading text-xl font-extrabold tracking-tight text-primary sm:text-2xl">orthonova<span className="text-accent">.</span></span>
        </Link>
        {isDashboard ? <StaffHeaderActions /> : isLogin ? <span className="text-sm text-muted-foreground">Staff portal</span> : <div className="flex shrink-0 items-center gap-2 sm:gap-4 lg:gap-8">
          {isWelcome && <div className="hidden sm:contents"><Link href="/login" className="quiet-link whitespace-nowrap">Staff login</Link></div>}
          <span className="hidden text-sm text-muted-foreground lg:block">Every step towards better health.</span>
          <div className="hidden sm:contents">
            <ToggleGroup className="language-toggle" spacing={1} value={[language]} onValueChange={values => { if (values[0]) setLanguage(values[0]) }} aria-label="Language preference (English content demo)">
              <ToggleGroupItem value="en" aria-label="English">English</ToggleGroupItem>
              <ToggleGroupItem value="hi" aria-label="Hindi"><span lang="hi">हिन्दी</span></ToggleGroupItem>
            </ToggleGroup>
          </div>
          <Button
            type="button"
            variant="secondary"
            className="h-11 w-18 rounded-xl sm:hidden"
            aria-label={language === 'en' ? 'Language: EN (English). Switch to Hindi' : 'Language: हिन्दी (Hindi). Switch to English'}
            title={language === 'en' ? 'Switch to Hindi' : 'Switch to English'}
            onClick={() => setLanguage(language === 'en' ? 'hi' : 'en')}
          >
            <Globe data-icon="inline-start" aria-hidden="true" />
            <span lang={language === 'hi' ? 'hi' : 'en'}>{language === 'en' ? 'EN' : 'हिन्दी'}</span>
          </Button>
          {isWelcome && <Link href="/login" aria-label="Staff login" title="Staff login" className={cn(buttonVariants({ variant: 'ghost' }), 'size-11 rounded-xl sm:hidden')}><ShieldCheck aria-hidden="true" /></Link>}
        </div>}
      </div>
    </header>
    {language === 'hi' && <p role="status" className="bg-secondary px-6 py-2 text-center text-sm text-primary">Hindi selected. This demonstration currently shows English content.</p>}
    {isScreening && <nav aria-label="Screening progress" className="page-width py-7"><ol className="mx-auto flex max-w-4xl items-center justify-between gap-2 sm:gap-3">{steps.map((label, i) => <li key={label} className={cn('flex items-center gap-1.5 text-xs max-sm:flex-col max-sm:text-2xs sm:text-sm md:gap-2 md:text-base', step >= i + 1 ? 'text-primary' : 'text-muted-foreground')} aria-current={step === i + 1 ? 'step' : undefined}><span className={cn('flex size-7 shrink-0 items-center justify-center rounded-full text-xs font-semibold sm:size-8 md:size-9', step >= i + 1 ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground')}>{step > i + 1 ? <Check className="size-3 md:size-4" /> : i + 1}</span><span className="max-w-16 overflow-hidden text-ellipsis sm:max-w-none">{label}</span></li>)}</ol></nav>}
    <main id="main-content" className="flex-1">{children}</main>
    <footer className="page-width pb-6 pt-8"><div className="flex flex-col items-center justify-between gap-3 border-t border-border/80 pt-5 text-center text-sm text-muted-foreground sm:flex-row sm:text-left"><p>Thoughtfully made for every step of life.</p><p className="flex items-center gap-2"><ShieldCheck className="size-4 text-primary" /> Screening only. Not a diagnosis.</p></div><p className="pt-3 text-center text-sm text-muted-foreground/80">Interactive demonstration · No health data is saved</p></footer>
  </div>
}

export function BackLink({ href = '/', children = 'Back' }: { href?: string; children?: React.ReactNode }) {
  return <Link href={href} className="quiet-link"><ArrowLeft className="size-4" />{children}</Link>
}

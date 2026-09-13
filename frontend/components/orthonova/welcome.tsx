import Image from 'next/image'
import Link from 'next/link'
import { ArrowRight, Clock3, ClipboardList, Footprints, FileCheck2, Sprout, UsersRound, ShieldCheck } from 'lucide-react'
import { Card, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { ScreeningNotice } from './screening-notice'

const steps = [
  { icon: ClipboardList, title: 'A few simple questions', description: 'Tell us a little about yourself and how your knees feel.', color: 'text-primary bg-secondary' },
  { icon: Footprints, title: 'A short, comfortable walk', description: 'Walk at your own pace, with your health worker beside you.', color: 'text-primary bg-secondary' },
  { icon: FileCheck2, title: 'Understand your knee health', description: 'Get a clear summary and guidance on what to do next.', color: 'text-primary bg-secondary' },
]
export function Welcome() {
  return <div className="page-width enter-page">
    <section className="grid items-center gap-4 pb-10 pt-10 md:grid-cols-[1.1fr_1fr] md:gap-6 md:pb-12 md:pt-12">
      <div className="flex flex-col items-start gap-6">
        <div className="inline-flex items-center gap-2 rounded-full bg-secondary px-4 py-2 text-sm font-semibold text-primary"><Sprout className="size-4" /> A little care goes a long way</div>
        <h1 className="text-balance font-heading text-[2.8rem] font-bold leading-[1.12] tracking-[-.045em] md:text-[3.6rem] lg:text-[4.1rem]">A small step for<br /><span className="text-primary">healthier knees.</span></h1>
        <p className="max-w-lg text-lg leading-relaxed text-muted-foreground md:text-xl">Keep doing the things you love. A few simple questions and a short walk can help you better understand your knee health.</p>
        <div className="flex flex-col gap-4 pt-2">
          <Link href="/intake" className="primary-link min-w-64">Start Screening <ArrowRight className="size-5" /></Link>
          <p className="flex items-center gap-2 text-sm text-muted-foreground"><Clock3 className="size-4" /> About 5 minutes <span className="px-1 text-border">•</span> Easy and gentle</p>
        </div>
      </div>
      <figure className="relative mx-auto w-full max-w-md md:max-w-none">
        <Image src="/images/community-walk.png" alt="An older woman walking comfortably beside a supportive community health worker" width={1024} height={1280} priority className="h-80 w-full object-cover object-center mix-blend-multiply sm:h-96 md:h-[450px] lg:h-[470px]" />
        <figcaption className="mx-auto -mt-2 flex w-fit items-center gap-3 rounded-full bg-card px-5 py-3 text-sm shadow-sm"><span className="flex size-8 items-center justify-center rounded-full bg-secondary text-primary"><UsersRound className="size-4" /></span>You don&apos;t have to do this alone.</figcaption>
      </figure>
    </section>
    <section className="flex flex-col gap-6 pb-8" aria-labelledby="how-it-works">
      <div className="flex flex-wrap items-center justify-between gap-3"><h2 id="how-it-works" className="font-heading text-2xl font-bold tracking-tight">Your knee health check, made simple</h2><span className="text-sm text-muted-foreground">Three gentle steps. At your pace.</span></div>
      <div className="grid gap-4 md:grid-cols-3">{steps.map(({ icon: Icon, title, description }, i) => <Card key={title} className="welcome-step soft-card rounded-2xl ring-0 [--card-spacing:1.5rem]"><CardHeader className="gap-4"><div className="flex items-center justify-between"><span className="flex size-11 items-center justify-center rounded-xl bg-secondary text-primary"><Icon className="size-6" strokeWidth={1.6} /></span><span className="text-sm text-muted-foreground">Step {i + 1}</span></div><CardTitle><h3 className="font-heading text-lg font-bold">{title}</h3></CardTitle><CardDescription><p className="text-base leading-relaxed text-muted-foreground">{description}</p></CardDescription></CardHeader></Card>)}</div>
    </section>
    <ScreeningNotice />
    <p className="flex items-center justify-center gap-2 pt-5 text-center text-sm text-muted-foreground"><ShieldCheck className="size-4 shrink-0 text-primary" />Your health worker will guide you, every step of the way.</p>
  </div>
}

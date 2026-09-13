import type { Metadata } from 'next'
import { IntakeForm } from '@/components/orthonova/intake-form'
export const metadata: Metadata = { title: 'About you' }
export default function Page() { return <IntakeForm /> }

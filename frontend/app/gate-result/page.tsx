import type { Metadata } from 'next'
import { GateResult } from '@/components/orthonova/gate-result'
export const metadata: Metadata = { title: 'Your next step' }
export default function Page() { return <GateResult /> }

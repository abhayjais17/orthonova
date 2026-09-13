import type { Metadata } from 'next'
import { ScreeningResult } from '@/components/orthonova/screening-result'
export const metadata: Metadata = { title: 'Your result' }
export default function Page() { return <ScreeningResult /> }

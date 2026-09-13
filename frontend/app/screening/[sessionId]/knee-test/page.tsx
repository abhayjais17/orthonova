import type { Metadata } from 'next'
import { KneeTest } from '@/components/orthonova/knee-test'

export const metadata: Metadata = {
  title: 'Knee Kit Test',
  robots: { index: false, follow: false },
}
export const dynamic = 'force-dynamic'

export default function KneeTestPage() {
  return <KneeTest />
}

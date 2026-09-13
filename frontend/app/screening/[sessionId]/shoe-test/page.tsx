import type { Metadata } from 'next'
import { ShoeTest } from '@/components/orthonova/shoe-test'

export const metadata: Metadata = {
  title: 'Shoe Kit Test',
  robots: { index: false, follow: false },
}
export const dynamic = 'force-dynamic'

export default function ShoeTestPage() {
  return <ShoeTest />
}

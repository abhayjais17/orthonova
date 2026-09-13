import type { Metadata } from 'next'
import { WalkTest } from '@/components/orthonova/walk-test'
export const metadata: Metadata = { title: 'Your walk test' }
export default function Page() {
  return <WalkTest />
}

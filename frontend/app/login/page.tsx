import type { Metadata } from 'next'
import { StaffLogin } from '@/components/orthonova/staff-login'

export const metadata: Metadata = { title: 'Staff login', robots: { index: false, follow: false } }
export const dynamic = 'force-dynamic'

export default function LoginPage() {
  return <StaffLogin />
}

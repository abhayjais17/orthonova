import type { Metadata, Viewport } from 'next'
import { Nunito, Noto_Sans_Devanagari } from 'next/font/google'
import { AppShell } from '@/components/orthonova/app-shell'
import { AuthProvider } from '@/components/orthonova/auth-provider'
import { ScreeningProvider } from '@/components/orthonova/screening-provider'
import './globals.css'

const nunito = Nunito({ subsets: ['latin'], variable: '--font-nunito', display: 'swap' })
const body = Noto_Sans_Devanagari({ subsets: ['latin', 'devanagari'], variable: '--font-body', display: 'swap' })

export const metadata: Metadata = {
  title: { default: 'Orthonova — A small step for healthier knees', template: '%s | Orthonova' },
  description: 'A gentle knee health screening workspace for clinic staff, with a patient dashboard, guided questionnaire, and simulated walk test. Interactive demonstration only; no patient data is saved. Screening only, not a diagnosis.',
}
export const viewport: Viewport = { themeColor: '#F7F5F0', colorScheme: 'light', width: 'device-width', initialScale: 1 }

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en" className={`bg-background ${nunito.variable} ${body.variable}`}><body className="font-sans antialiased"><AuthProvider><ScreeningProvider><AppShell>{children}</AppShell></ScreeningProvider></AuthProvider></body></html>
}

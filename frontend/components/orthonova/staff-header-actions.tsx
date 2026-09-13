'use client'

import { useRouter } from 'next/navigation'
import { LogOut } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { authApi, getAuthToken } from '@/lib/api'
import { useEffect, useState } from 'react'

export function StaffHeaderActions() {
  const router = useRouter()
  const [userName, setUserName] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function loadUser() {
      const token = getAuthToken()
      if (!token) {
        router.push('/login')
        return
      }
      try {
        const user = await authApi.getCurrentUser()
        setUserName(user.full_name || user.username)
      } catch {
        // Token invalid, redirect to login
        await authApi.logout()
        router.push('/login')
      } finally {
        setLoading(false)
      }
    }
    loadUser()
  }, [router])

  async function handleLogout() {
    await authApi.logout()
    router.push('/login')
  }

  if (loading) {
    return (
      <div className="flex items-center gap-3 sm:gap-6">
        <div className="hidden items-center gap-3 sm:flex">
          <span className="flex size-10 items-center justify-center rounded-full bg-secondary text-sm font-semibold text-primary">...</span>
          <div className="flex flex-col"><span className="text-sm">Loading...</span></div>
        </div>
      </div>
    )
  }

  return (
    <div className="flex items-center gap-3 sm:gap-6">
      <div className="hidden items-center gap-3 sm:flex">
        <span aria-hidden="true" className="flex size-10 items-center justify-center rounded-full bg-secondary text-sm font-semibold text-primary">{userName.split(/\s+/).slice(0, 2).map(word => word[0]).join('').toUpperCase()}</span>
        <div className="flex flex-col"><span className="max-w-48 truncate text-sm font-semibold">{userName}</span><span className="text-xs text-muted-foreground">Health worker</span></div>
      </div>
      <Button variant="ghost" size="lg" onClick={handleLogout}><LogOut data-icon="inline-start" />Log out</Button>
    </div>
  )
}

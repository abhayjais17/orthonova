'use client'

import { createContext, useContext, useEffect, useState, useCallback } from 'react'
import { authApi, setAuthToken, clearAuthToken, getAuthToken, type User } from '@/lib/api'

interface AuthContextType {
  user: User | null
  isLoading: boolean
  isAuthenticated: boolean
  login: (username: string, password: string) => Promise<void>
  logout: () => Promise<void>
}

const AuthContext = createContext<AuthContextType | null>(null)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  // Check for existing session on mount
  useEffect(() => {
    async function checkAuth() {
      const token = getAuthToken()
      if (!token) {
        setIsLoading(false)
        return
      }

      try {
        const userData = await authApi.getCurrentUser()
        setUser(userData)
      } catch {
        // Token invalid or expired
        clearAuthToken()
      } finally {
        setIsLoading(false)
      }
    }

    checkAuth()
  }, [])

  const login = useCallback(async (username: string, password: string) => {
    const response = await authApi.login({ username, password })
    setAuthToken(response.token)
    setUser({
      id: response.user_id,
      username: response.username,
      full_name: response.full_name,
    })
  }, [])

  const logout = useCallback(async () => {
    await authApi.logout()
    clearAuthToken()
    setUser(null)
  }, [])

  return (
    <AuthContext.Provider
      value={{
        user,
        isLoading,
        isAuthenticated: !!user,
        login,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}
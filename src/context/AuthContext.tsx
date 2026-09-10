import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import type { ReactNode } from 'react';
import { AuthState } from '../types/auth';

const AuthContext = createContext<{
  authState: AuthState
  login: (credentials: { username: string; password: string }) => Promise<void>
  logout: () => Promise<void>
  reloadUser: () => Promise<void>
}>({
  authState: { user: null, isAuthenticated: false, isLoading: true },
  login: async () => {},
  logout: async () => {},
  reloadUser: async () => {},
})

export const useAuth = () => {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [authState, setAuthState] = useState<AuthState>({
    user: null,
    isAuthenticated: false,
    isLoading: true,
  })

  const checkAuth = useCallback(async () => {
    try {
      const response = await fetch('/api/auth/me', { credentials: 'same-origin' })
      if (!response.ok) {
        setAuthState({ user: null, isAuthenticated: false, isLoading: false })
        return
      }
      const data = await response.json()
      setAuthState({ user: data.user ?? null, isAuthenticated: Boolean(data.user), isLoading: false })
    } catch (error) {
      console.error('Error checking auth status:', error)
      setAuthState({ user: null, isAuthenticated: false, isLoading: false })
    }
  }, [])

  useEffect(() => {
    void checkAuth()
  }, [checkAuth])

  const login = async (credentials: { username: string; password: string }) => {
    setAuthState(prev => ({ ...prev, isLoading: true }))
    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(credentials),
      })
      const data = await response.json().catch(() => ({}))
      if (!response.ok) {
        throw new Error(data.error || 'Login failed')
      }
      setAuthState({ user: data.user ?? null, isAuthenticated: Boolean(data.user), isLoading: false })
    } catch (error) {
      setAuthState({ user: null, isAuthenticated: false, isLoading: false })
      throw error
    }
  }

  const reloadUser = useCallback(async () => {
    try {
      const response = await fetch('/api/auth/me', { credentials: 'same-origin' })
      if (!response.ok) {
        return
      }
      const data = await response.json()
      setAuthState({ user: data.user ?? null, isAuthenticated: Boolean(data.user), isLoading: false })
    } catch (error) {
      console.error('Error reloading user:', error)
    }
  }, [])

  const logout = async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST', credentials: 'same-origin' })
    } catch (error) {
      console.error('Error during logout:', error)
    }
    setAuthState({ user: null, isAuthenticated: false, isLoading: false })
  }

  if (authState.isLoading) {
    return <div className="flex items-center justify-center min-h-screen bg-police-950">
      <div className="text-center">
        <div className="mx-auto h-12 w-12">
          <svg className="h-12 w-12 text-accent-cyan animate-pulse" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path>
          </svg>
        </div>
        <p className="mt-4 text-police-400">Loading secure session...</p>
      </div>
    </div>
  }

  return (
    <AuthContext.Provider value={{ authState, login, logout, reloadUser }}>
      {children}
    </AuthContext.Provider>
  )
}
import { createContext, useContext, useState, useEffect } from 'react'
import { User, AuthState } from '../types/auth'

const AuthContext = createContext<{
  authState: AuthState
  login: (credentials: { email: string; password: string }) => Promise<void>
  logout: () => void
}>({
  authState: { user: null, isAuthenticated: false, isLoading: true },
  login: async () => {},
  logout: () => {},
})

export const useAuth = () => {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [authState, setAuthState] = useState<AuthState>({
    user: null,
    isAuthenticated: false,
    isLoading: true,
  })

  useEffect(() => {
    // Simulate checking auth status (in real app, this would check token/session)
    const checkAuth = async () => {
      try {
        // Simulate delay
        await new Promise(resolve => setTimeout(resolve, 1000))
        
        // Mock user data for demo
        const mockUser: User = {
          id: 'user_001',
          name: 'Inspector Vikram Singh',
          email: 'vikram.singh@haryanapolice.gov.in',
          badgeNumber: 'HP-2024-0087',
          role: 'investigator',
          department: 'Criminal Investigation Department',
          rank: 'Inspector',
          avatar: 'https://ui-avatars.com/api/?name=Vikram+Singh&background=0d1e33&color=00d4ff',
          lastLogin: new Date().toISOString(),
          permissions: [
            'dashboard.view',
            'search.execute',
            'profile.view',
            'profile.edit',
            'graph.view',
            'darkweb.view',
            'reports.generate',
            'reports.export',
            'alerts.view',
            'audit.view',
          ],
        }
        
        setAuthState({
          user: mockUser,
          isAuthenticated: true,
          isLoading: false,
        })
      } catch (error) {
        setAuthState({
          user: null,
          isAuthenticated: false,
          isLoading: false,
        })
      }
    }
    
    checkAuth()
  }, [])

  const login = async (credentials: { email: string; password: string }) => {
    setAuthState(prev => ({ ...prev, isLoading: true }))
    
    try {
      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 1500))
      
      // Simple mock validation
      if (credentials.email && credentials.password) {
        const mockUser: User = {
          id: 'user_001',
          name: 'Inspector Vikram Singh',
          email: credentials.email,
          badgeNumber: 'HP-2024-0087',
          role: 'investigator',
          department: 'Criminal Investigation Department',
          rank: 'Inspector',
          avatar: 'https://ui-avatars.com/api/?name=Vikram+Singh&background=0d1e33&color=00d4ff',
          lastLogin: new Date().toISOString(),
          permissions: [
            'dashboard.view',
            'search.execute',
            'profile.view',
            'profile.edit',
            'graph.view',
            'darkweb.view',
            'reports.generate',
            'reports.export',
            'alerts.view',
            'audit.view',
          ],
        }
        
        setAuthState({
          user: mockUser,
          isAuthenticated: true,
          isLoading: false,
        })
      } else {
        throw new Error('Invalid credentials')
      }
    } catch (error) {
      setAuthState({
        user: null,
        isAuthenticated: false,
        isLoading: false,
      })
      throw error
    }
  }

  const logout = () => {
    setAuthState({
      user: null,
      isAuthenticated: false,
      isLoading: false,
    })
  }

  if (authState.isLoading) {
    return <div className="flex items-center justify-center min-h-screen">Loading...</div>
  }

  return (
    <AuthContext.Provider value={{ authState, login, logout }}>
      {children}
    </AuthContext.Provider>
  )
}
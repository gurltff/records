import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import { watchAuthState, getLocalCurrentUser, isDemoMode } from '../services/authService'
import { getById } from '../services/store'
import type { UserProfile } from '../types'

interface AuthCtx {
  user: UserProfile | null
  loading: boolean
  setUser: (user: UserProfile | null) => void
}

const Ctx = createContext<AuthCtx>({ user: null, loading: true, setUser: () => {} })

const KNOWN_ROLES = ['student', 'teacher', 'cr']

/*
 * An earlier build had a separate "alumni" role. Anyone still holding such an
 * account is a student who has graduated, so treat them as a student rather
 * than bouncing between the login page and a dashboard they can't open.
 */
function withKnownRole(user: UserProfile | null): UserProfile | null {
  if (!user || KNOWN_ROLES.includes(user.role)) return user
  return { ...user, role: 'student' }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<UserProfile | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let mounted = true
    let request = 0

    const loadProfile = async (uid: string | null) => {
      const requestId = ++request
      if (!mounted) return

      // Demo authentication is local and must always win over Firebase auth.
      if (isDemoMode()) {
        const demoUser = getLocalCurrentUser()
        if (mounted && requestId === request) {
          setUser(withKnownRole(demoUser))
          setLoading(false)
        }
        return
      }

      if (!uid) {
        if (mounted && requestId === request) {
          setUser(null)
          setLoading(false)
        }
        return
      }

      try {
        const profile = await getById<UserProfile>('users', uid)
        if (mounted && requestId === request) {
          setUser(withKnownRole(profile))
          setLoading(false)
        }
      } catch (error) {
        console.error('Could not load user profile:', error)
        if (mounted && requestId === request) {
          setUser(null)
          setLoading(false)
        }
      }
    }

    const unsubscribe = watchAuthState((uid) => { void loadProfile(uid) })

    const interval = window.setInterval(() => {
      if (!mounted) return
      if (isDemoMode()) {
        const latest = getLocalCurrentUser()
        if (latest) setUser(withKnownRole(latest))
      }
    }, 2500)

    return () => {
      mounted = false
      window.clearInterval(interval)
      unsubscribe()
    }
  }, [])

  return (
    <Ctx.Provider value={{ user, loading, setUser: (next) => setUser(withKnownRole(next)) }}>
      {children}
    </Ctx.Provider>
  )
}

export function useAuth() { return useContext(Ctx) }

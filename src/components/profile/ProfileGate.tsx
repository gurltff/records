import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import { useAuth } from '../../context/AuthContext'
import { findRecordForUser } from '../../services/recordsService'
import type { StudentRecord } from '../../types'
import CreateProfileWizard from './CreateProfileWizard'

interface ProfileCtx {
  profile: StudentRecord
  setProfile: (profile: StudentRecord) => void
}

const Ctx = createContext<ProfileCtx | null>(null)

export function useMyProfile() {
  const ctx = useContext(Ctx)
  if (!ctx) throw new Error('useMyProfile must be used inside <ProfileGate>')
  return ctx
}

/*
 * Every student must have a profile. On first login this shows the
 * "Create your profile" steps instead of the dashboard.
 */
export default function ProfileGate({ children }: { children: ReactNode }) {
  const { user } = useAuth()
  const [profile, setProfile] = useState<StudentRecord | null | undefined>(undefined)
  const [failed, setFailed] = useState(false)
  const [attempt, setAttempt] = useState(0)

  // Keyed on uid: the demo AuthContext hands out a fresh user object every few seconds.
  const uid = user?.uid
  useEffect(() => {
    if (!user) return
    let cancelled = false
    setFailed(false)
    findRecordForUser(user)
      .then((found) => !cancelled && setProfile(found))
      .catch((error) => {
        console.error(error)
        if (!cancelled) setFailed(true)
      })
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [uid, attempt])

  if (failed) {
    return (
      <main className="page-shell">
        <div className="card">
          <p className="font-semibold">Couldn't load your profile.</p>
          <button type="button" className="btn-primary mt-3" onClick={() => setAttempt((n) => n + 1)}>
            Try again
          </button>
        </div>
      </main>
    )
  }
  if (profile === undefined) {
    return (
      <main className="page-shell">
        <div className="card">Loading your profile…</div>
      </main>
    )
  }
  if (profile === null) return <CreateProfileWizard onCreated={setProfile} />
  return <Ctx.Provider value={{ profile, setProfile }}>{children}</Ctx.Provider>
}

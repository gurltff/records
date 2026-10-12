import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { logInDemo } from '../services/authService'
import { DEMO_ADMIN_SEED, DEMO_PASSWORD, hasDemoData, setupDemoData } from '../services/demoseed'

/*
 * Shareable demo link (/admin-demo): prepares the demo data in this browser
 * if needed, signs in as the demo admin and opens the admin console.
 */
export default function AdminDemo() {
  const navigate = useNavigate()
  const { setUser } = useAuth()
  const [status, setStatus] = useState('Preparing the admin demo…')
  const [failed, setFailed] = useState(false)
  const started = useRef(false)

  useEffect(() => {
    if (started.current) return
    started.current = true
    ;(async () => {
      try {
        if (!hasDemoData()) await setupDemoData(setStatus)
        setStatus('Signing in as the college admin…')
        const profile = await logInDemo(DEMO_ADMIN_SEED.email, DEMO_PASSWORD)
        setUser(profile)
        navigate('/admin', { replace: true })
      } catch (error) {
        console.error(error)
        setFailed(true)
      }
    })()
  }, [navigate, setUser])

  return (
    <main className="page-shell max-w-xl">
      <div className="card text-center py-10">
        <p className="text-4xl" aria-hidden="true">🗂</p>
        <h1 className="text-2xl font-black mt-3">Admin console demo</h1>
        {failed ? (
          <>
            <p className="text-ink-muted mt-2">The demo couldn't start in this browser.</p>
            <a href={import.meta.env.BASE_URL} className="btn-primary inline-block mt-5">Go to the login page</a>
          </>
        ) : (
          <p className="text-ink-muted mt-2" role="status">{status}</p>
        )}
      </div>
    </main>
  )
}

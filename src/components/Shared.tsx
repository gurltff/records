import {
  type ReactNode,
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from 'react'
import { createPortal } from 'react-dom'
import { Navigate, Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useTheme } from '../context/ThemeContext'
import { logOut } from '../services/authService'
import type { Role } from '../types'

/* =========================================================
   NAVBAR
   ========================================================= */

export function Navbar() {
  const { user, setUser } = useAuth()
  const { dark, toggle } = useTheme()

  const home = homeForRole(user?.role)

  /*
   * IMPORTANT:
   * Render the navbar directly into document.body.
   *
   * This prevents any parent page/container with:
   * - overflow
   * - transform
   * - translate
   * - scale
   * - filter
   *
   * from affecting the fixed navbar.
   */
  if (typeof document === 'undefined') {
    return null
  }

  return createPortal(
    <header
      className="app-navbar"
      style={{
        position: 'absolute',
        inset: '0 0 auto 0',
        zIndex: 2147483647,
      }}
    >
      <nav className="app-navbar-inner">
        {/* LEFT SIDE */}
        <Link
          to={user ? home : '/'}
          className="navbar-brand"
        >
          <span className="navbar-logo">
            ✓
          </span>

          <span className="navbar-title">
            Maitreyi Smart Campus
          </span>
        </Link>

        {/* RIGHT SIDE */}
        <div className="navbar-actions">

          {/* DARK / LIGHT MODE */}
          <button
            type="button"
            className="navbar-theme-button"
            onClick={toggle}
            aria-label="Toggle theme"
          >
            {dark ? '☀️' : '🌙'}
          </button>

          {/* USER */}
          {user && (
            <>
              <span className="navbar-user">
                {user.name} · {user.role}
              </span>

              <button
                type="button"
                className="navbar-logout"
                onClick={async () => {
                  await logOut()
                  setUser(null)
                }}
              >
                Log out
              </button>
            </>
          )}
        </div>
      </nav>
    </header>,
    document.body,
  )
}

export function homeForRole(role?: Role) {
  if (role === 'cr') return '/cr'
  if (role === 'teacher') return '/teacher'
  if (role === 'alumni') return '/alumni'
  return '/student'
}

/* =========================================================
   PROTECTED ROUTE
   ========================================================= */

export function ProtectedRoute({
  role,
  children,
}: {
  role: Role | Role[]
  children: ReactNode
}) {
  const { user, loading } = useAuth()

  if (loading) {
    return (
      <div className="p-8 text-center text-ink-muted">
        Loading…
      </div>
    )
  }

  if (!user) {
    return <Navigate to="/" replace />
  }

  const allowed = Array.isArray(role) ? role : [role]

  if (!allowed.includes(user.role)) {
    return <Navigate to="/" replace />
  }

  return <>{children}</>
}

export function AuthenticatedRoute({
  children,
}: {
  children: ReactNode
}) {
  const { user, loading } = useAuth()

  if (loading) {
    return (
      <div className="p-8 text-center text-ink-muted">
        Loading…
      </div>
    )
  }

  if (!user) {
    return <Navigate to="/" replace />
  }

  return <>{children}</>
}

/* =========================================================
   TOAST
   ========================================================= */

interface Toast {
  id: number
  text: string
  kind: 'success' | 'error' | 'info'
}

const ToastCtx = createContext<{
  push: (text: string, kind?: Toast['kind']) => void
}>({
  push: () => {},
})

export function ToastProvider({
  children,
}: {
  children: ReactNode
}) {
  const [toasts, setToasts] = useState<Toast[]>([])

  const push = useCallback(
    (
      text: string,
      kind: Toast['kind'] = 'info',
    ) => {
      const id = Date.now()

      setToasts((t) => [
        ...t,
        {
          id,
          text,
          kind,
        },
      ])

      setTimeout(() => {
        setToasts((t) =>
          t.filter((x) => x.id !== id),
        )
      }, 4000)
    },
    [],
  )

  return (
    <ToastCtx.Provider value={{ push }}>
      {children}

      <div className="fixed bottom-4 right-4 z-[999999] space-y-2">
        {toasts.map((t) => (
          <div
            key={t.id}
            className={`px-4 py-2.5 rounded-full shadow-pop border-2 border-ink text-ink text-sm font-semibold ${
              t.kind === 'success'
                ? 'bg-sage'
                : t.kind === 'error'
                  ? 'bg-blush'
                  : 'bg-butter'
            }`}
          >
            {t.text}
          </div>
        ))}
      </div>
    </ToastCtx.Provider>
  )
}

export function useToast() {
  return useContext(ToastCtx)
}

/* =========================================================
   EMPTY STATE
   ========================================================= */

export function EmptyState({
  text,
}: {
  text: string
}) {
  return (
    <div className="text-center text-sm text-ink-muted py-10">
      {text}
    </div>
  )
}
/* =========================================================
   MODAL
   ========================================================= */

const openModals: symbol[] = []

export function Modal({
  title,
  onClose,
  children,
  wide = false,
}: {
  title: ReactNode
  onClose: () => void
  children: ReactNode
  wide?: boolean
}) {
  const [id] = useState(() => Symbol('modal'))

  useEffect(() => {
    openModals.push(id)
    return () => {
      openModals.splice(openModals.indexOf(id), 1)
    }
  }, [id])

  useEffect(() => {
    // Escape closes only the top-most modal (a document viewer over a record).
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && openModals[openModals.length - 1] === id) onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [id, onClose])

  return (
    <div
      className="fixed inset-0 z-40 bg-ink/50 overflow-y-auto px-3 sm:px-4 pt-24 pb-8"
      role="dialog"
      aria-modal="true"
      onClick={onClose}
    >
      <div
        className={`card w-full mx-auto ${wide ? 'max-w-4xl' : 'max-w-xl'}`}
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3 mb-4">
          <h3 className="font-extrabold text-lg">{title}</h3>
          <button type="button" className="btn-outline text-sm shrink-0" onClick={onClose}>
            Close
          </button>
        </div>
        {children}
      </div>
    </div>
  )
}

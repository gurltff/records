import { useEffect, useMemo, useState } from 'react'
import { useAuth } from '../../context/AuthContext'
import { ACHIEVEMENT_AREAS } from '../../data/recordOptions'
import { listDirectory } from '../../services/recordsService'
import type { DirectoryProfile } from '../../types'
import { TINTS } from './RecordBits'

export default function AlumniNetwork() {
  const { user } = useAuth()
  const [profiles, setProfiles] = useState<DirectoryProfile[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [programme, setProgramme] = useState('')
  const [area, setArea] = useState('')
  const [status, setStatus] = useState<'all' | 'alumni' | 'current'>('alumni')

  useEffect(() => {
    listDirectory()
      .then(setProfiles)
      .catch((error) => console.error(error))
      .finally(() => setLoading(false))
  }, [])

  const programmes = useMemo(() => Array.from(new Set(profiles.map((p) => p.programme).filter(Boolean))).sort(), [profiles])

  const visible = profiles
    .filter((p) => status === 'all' || p.status === status)
    .filter((p) => !programme || p.programme === programme)
    .filter((p) => !area || p.areas.includes(area as DirectoryProfile['areas'][number]))
    .filter((p) => {
      const q = search.trim().toLowerCase()
      if (!q) return true
      return [p.name, p.headline, p.programme, p.graduationYear, ...p.interests].join(' ').toLowerCase().includes(q)
    })
    .sort((a, b) => b.graduationYear.localeCompare(a.graduationYear) || a.name.localeCompare(b.name))

  return (
    <div className="space-y-5">
      <div className="card-tint tint-sky">
        <h3 className="font-extrabold">Alumni network</h3>
        <p className="text-sm text-ink/80 mt-1">
          Find seniors by what they do now — a master's at an NIT, a job in analytics, or clearing JAM or NET. Only people
          who opted in from their own record appear here, and contact details are shown only if they chose to share them.
        </p>
      </div>

      <div className="card grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <input className="input" placeholder="Search name, course, company, interest…" value={search} onChange={(e) => setSearch(e.target.value)} aria-label="Search alumni network" />
        <select className="input" value={programme} onChange={(e) => setProgramme(e.target.value)} aria-label="Course">
          <option value="">All courses</option>
          {programmes.map((p) => (
            <option key={p}>{p}</option>
          ))}
        </select>
        <select className="input" value={area} onChange={(e) => setArea(e.target.value)} aria-label="Area">
          <option value="">All areas</option>
          {ACHIEVEMENT_AREAS.map((a) => (
            <option key={a}>{a}</option>
          ))}
        </select>
        <select className="input" value={status} onChange={(e) => setStatus(e.target.value as typeof status)} aria-label="Who">
          <option value="alumni">Alumni</option>
          <option value="current">Current students</option>
          <option value="all">Everyone</option>
        </select>
      </div>

      {loading ? (
        <div className="card">Loading network…</div>
      ) : visible.length === 0 ? (
        <div className="card text-center text-sm text-ink-muted py-10">
          Nobody matches these filters yet. As more alumni opt in from their record, they will appear here.
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {visible.map((p, i) => (
            <article key={p.id} className={`card-tint ${TINTS[i % TINTS.length]} flex flex-col`}>
              <div className="flex items-start justify-between gap-2">
                <div>
                  <h4 className="font-extrabold text-ink">
                    {p.name}
                    {p.id === user?.uid && <span className="text-xs font-semibold text-ink/60"> (you)</span>}
                  </h4>
                  <p className="text-xs text-ink/70">
                    {p.programme} · {p.status === 'alumni' ? `Batch of ${p.graduationYear}` : 'Current student'}
                  </p>
                </div>
              </div>
              <p className="font-semibold text-ink mt-3">{p.headline}</p>
              {(p.areas.length > 0 || p.interests.length > 0) && (
                <div className="flex flex-wrap gap-1.5 mt-3">
                  {p.areas.map((a) => (
                    <span key={a} className="badge bg-ink text-cream-soft border-ink" title="Achievement area">
                      ★ {a}
                    </span>
                  ))}
                  {p.interests
                    .filter((interest) => !p.areas.some((a) => a.toLowerCase() === interest.toLowerCase()))
                    .map((interest) => (
                      <span key={interest} className="badge bg-cream-soft border-ink text-ink" title="Interest">
                        {interest}
                      </span>
                    ))}
                </div>
              )}
              <div className="mt-auto pt-4">
                {p.contactEmail ? (
                  <a className="btn-outline text-sm inline-block" href={`mailto:${p.contactEmail}?subject=${encodeURIComponent('Hello from a Maitreyi junior')}`}>
                    ✉ Say hello
                  </a>
                ) : (
                  <p className="text-xs text-ink/60">Contact not shared</p>
                )}
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  )
}

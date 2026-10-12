import { useEffect, useMemo, useState } from 'react'
import { useAuth } from '../../context/AuthContext'
import { ACHIEVEMENT_AREAS } from '../../data/recordOptions'
import { listDirectory } from '../../services/recordsService'
import type { DirectoryProfile } from '../../types'
import { studyYearOf } from '../../utils/records'
import { Avatar } from './ProfileHeader'

const YEAR_FILTERS = [
  { value: 'all', label: 'Everyone' },
  { value: '1', label: '1st year' },
  { value: '2', label: '2nd year' },
  { value: '3', label: '3rd year' },
  { value: '0', label: 'Graduated' },
]

/* Profiles students chose to show — see what classmates and seniors are doing. */
export default function Explore() {
  const { user } = useAuth()
  const [profiles, setProfiles] = useState<DirectoryProfile[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [year, setYear] = useState('all')
  const [programme, setProgramme] = useState('')
  const [area, setArea] = useState('')

  useEffect(() => {
    listDirectory()
      .then(setProfiles)
      .catch((error) => console.error(error))
      .finally(() => setLoading(false))
  }, [])

  const withYear = useMemo(() => profiles.map((p) => ({ ...p, year: studyYearOf(p) })), [profiles])
  const programmes = useMemo(() => Array.from(new Set(profiles.map((p) => p.programme).filter(Boolean))).sort(), [profiles])

  const visible = withYear
    .filter((p) => year === 'all' || String(Math.min(p.year.index, 3)) === year)
    .filter((p) => !programme || p.programme === programme)
    .filter((p) => !area || p.areas.includes(area as DirectoryProfile['areas'][number]))
    .filter((p) => {
      const q = search.trim().toLowerCase()
      if (!q) return true
      return [p.name, p.bio, p.headline, p.programme, ...p.doingNow, ...p.highlights, ...p.interests].join(' ').toLowerCase().includes(q)
    })
    .sort((a, b) => (a.year.index || 9) - (b.year.index || 9) || b.updatedAt - a.updatedAt)

  const count = (value: string) => withYear.filter((p) => value === 'all' || String(Math.min(p.year.index, 3)) === value).length

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-2xl font-black">Explore</h2>
        <p className="text-sm text-ink-muted mt-1 max-w-2xl">
          See what students in every year — and seniors who've graduated — are doing: clubs, projects, exams they're
          preparing for, internships and achievements. Only profiles that chose to be visible are shown.
        </p>
      </div>

      <div className="card space-y-3">
        <div className="flex flex-wrap gap-2" role="tablist" aria-label="Year">
          {YEAR_FILTERS.map((f) => (
            <button
              key={f.value}
              type="button"
              role="tab"
              aria-selected={year === f.value}
              className={`pill-tab ${year === f.value ? 'pill-tab-active' : 'pill-tab-idle'}`}
              onClick={() => setYear(f.value)}
            >
              {f.label} <span className="opacity-60">{count(f.value)}</span>
            </button>
          ))}
        </div>
        <div className="grid sm:grid-cols-3 gap-3">
          <input className="input" placeholder="Search: CAT, Enactus, research, a name…" value={search} onChange={(e) => setSearch(e.target.value)} aria-label="Search profiles" />
          <select className="input" value={programme} onChange={(e) => setProgramme(e.target.value)} aria-label="Course">
            <option value="">All courses</option>
            {programmes.map((p) => (
              <option key={p}>{p}</option>
            ))}
          </select>
          <select className="input" value={area} onChange={(e) => setArea(e.target.value)} aria-label="Achievement area">
            <option value="">Any achievement area</option>
            {ACHIEVEMENT_AREAS.map((a) => (
              <option key={a}>{a}</option>
            ))}
          </select>
        </div>
      </div>

      {loading ? (
        <div className="card">Loading profiles…</div>
      ) : visible.length === 0 ? (
        <div className="card text-center text-sm text-ink-muted py-10">No profiles match these filters yet.</div>
      ) : (
        <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-4">
          {visible.map((p) => (
            <article key={p.id} className="card flex flex-col">
              <div className="flex items-start gap-3">
                <Avatar name={p.name} />
                <div className="min-w-0">
                  <h3 className="font-extrabold leading-tight">
                    {p.name}
                    {p.id === user?.uid && <span className="text-xs font-semibold text-ink-muted"> (you)</span>}
                  </h3>
                  <p className="text-xs text-ink-muted">
                    {p.year.label} · {p.programme}
                  </p>
                </div>
              </div>

              {p.bio && <p className="text-sm mt-3">{p.bio}</p>}

              {(p.status === 'alumni' ? [p.headline, ...p.doingNow.filter((d) => d !== p.headline)] : p.doingNow).filter(Boolean).length > 0 && (
                <div className="mt-3">
                  <p className="text-[11px] font-bold uppercase tracking-wide text-ink-muted">Doing now</p>
                  <ul className="text-sm mt-1 space-y-0.5">
                    {(p.status === 'alumni' ? [p.headline, ...p.doingNow.filter((d) => d !== p.headline)] : p.doingNow)
                      .filter((d) => d && d !== 'Not reported')
                      .slice(0, 3)
                      .map((d) => (
                        <li key={d}>• {d}</li>
                      ))}
                  </ul>
                </div>
              )}

              {p.highlights.length > 0 && (
                <div className="mt-3">
                  <p className="text-[11px] font-bold uppercase tracking-wide text-ink-muted">Highlights</p>
                  <ul className="text-sm mt-1 space-y-0.5">
                    {p.highlights.slice(0, 2).map((h) => (
                      <li key={h}>🏆 {h}</li>
                    ))}
                  </ul>
                </div>
              )}

              {p.interests.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mt-3">
                  {p.interests.map((interest) => (
                    <span key={interest} className="badge bg-butter border-ink text-ink">{interest}</span>
                  ))}
                </div>
              )}

              <div className="mt-auto pt-4">
                {p.contactEmail ? (
                  <a className="btn-outline text-sm inline-block" href={`mailto:${p.contactEmail}?subject=${encodeURIComponent('Hello from a Maitreyi student')}`}>
                    ✉ Say hello
                  </a>
                ) : (
                  <p className="text-xs text-ink-muted">Contact not shared</p>
                )}
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  )
}

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { Modal, useToast } from '../components/Shared'
import RecordDetail from '../components/records/RecordDetail'
import RecordForm from '../components/records/RecordForm'
import { DocumentViewer } from '../components/records/DocumentsPanel'
import {
  BarList,
  FreshnessBadge,
  Meter,
  OutcomeBadge,
  StatTile,
  StatusBadge,
  TINTS,
} from '../components/records/RecordBits'
import { ACHIEVEMENT_AREAS, RECORD_PROGRAMMES } from '../data/recordOptions'
import {
  actorOf,
  graduateBatch,
  importRecords,
  listAllDocuments,
  listAllUpdates,
  listAllVerifications,
  listDrives,
  listRecords,
  saveDrive,
  saveRecord,
  verifyItem,
} from '../services/recordsService'
import type {
  DriveAudience,
  RecordDocument,
  RecordUpdate,
  RecordVerification,
  StudentRecord,
  UpdateDrive,
  UserProfile,
} from '../types'
import { batchSummaryCsv, csvToRecords, downloadCsv, recordTemplateCsv, recordsToCsv } from '../utils/csv'
import {
  ENTRY_KIND_LABEL,
  OUTCOME_LABEL,
  areasOf,
  batchLabel,
  batchSummaries,
  completeness,
  currentJob,
  currentStudy,
  driveProgress,
  emptyRecord,
  formatDate,
  freshness,
  headline,
  isGraduationDue,
  median,
  newId,
  packageOf,
  primaryOutcome,
  relativeDays,
  studyYearOf,
  doingNow,
  topCounts,
  verifiableEntries,
  verificationFor,
  verificationMap,
  type Outcome,
} from '../utils/records'

type Tab = 'records' | 'verify' | 'drives' | 'insights'

const today = () => new Date().toISOString().slice(0, 10)
const pct = (part: number, whole: number) => (whole ? Math.round((part / whole) * 100) : 0)

interface Filters {
  search: string
  programme: string
  batch: string
  /* '1'–'3' year of study, '0' graduated */
  year: '' | '0' | '1' | '2' | '3'
  outcome: '' | Outcome
  area: string
  freshness: '' | 'fresh' | 'due' | 'stale'
}

const NO_FILTERS: Filters = { search: '', programme: '', batch: '', year: '', outcome: '', area: '', freshness: '' }

const YEAR_TABS: { value: Filters['year']; label: string }[] = [
  { value: '', label: 'All' },
  { value: '1', label: '1st year' },
  { value: '2', label: '2nd year' },
  { value: '3', label: '3rd year' },
  { value: '0', label: 'Graduated' },
]

const yearKey = (record: StudentRecord) => String(Math.min(studyYearOf(record).index, 3))

function nowText(record: StudentRecord) {
  if (record.status === 'alumni') return headline(record)
  const now = doingNow(record)
  return now.length ? now.join(' · ') : 'Nothing added yet'
}

function matchesSearch(record: StudentRecord, query: string) {
  const q = query.trim().toLowerCase()
  if (!q) return true
  return [
    record.name,
    record.rollNo,
    record.collegeEmail,
    record.personalEmail,
    record.mobile,
    headline(record),
    ...record.higherStudies.map((s) => `${s.course} ${s.institution}`),
    ...record.employment.map((j) => `${j.designation} ${j.company}`),
    ...record.internships.map((i) => `${i.title} ${i.organisation}`),
    ...record.interests,
    ...record.activities.map((a) => `${a.title} ${a.organisation}`),
    record.bio,
  ]
    .join(' ')
    .toLowerCase()
    .includes(q)
}

type View = 'overview' | 'students' | 'verify' | 'requests' | 'reports' | 'data'

const VIEWS: { id: View; icon: string; label: string }[] = [
  { id: 'overview', icon: '🏠', label: 'Overview' },
  { id: 'students', icon: '🎓', label: 'Students' },
  { id: 'verify', icon: '✔', label: 'Verification' },
  { id: 'requests', icon: '📣', label: 'Update requests' },
  { id: 'reports', icon: '📊', label: 'Reports' },
  { id: 'data', icon: '🗂', label: 'Data & import' },
]

function greeting(date = new Date()) {
  const h = date.getHours()
  return h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening'
}

/* "Dr. Meenakshi Sen" → "Meenakshi" */
function firstName(name: string) {
  const parts = name.split(/\s+/).filter((p) => !/^(dr|ms|mrs|mr|prof)\.?$/i.test(p))
  return parts[0] ?? name
}

/*
 * The admin console: everything about students' profiles lives here, not
 * with teachers. Sidebar navigation on desktop, a scrollable row on phones.
 */
export default function AdminDashboard() {
  const { user } = useAuth()
  const { push } = useToast()
  const [params, setParams] = useSearchParams()
  const view = (VIEWS.find((v) => v.id === params.get('view'))?.id ?? 'overview') as View
  const go = (next: View) => {
    setParams(next === 'overview' ? {} : { view: next })
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const [records, setRecords] = useState<StudentRecord[]>([])
  const [verifications, setVerifications] = useState<RecordVerification[]>([])
  const [documents, setDocuments] = useState<RecordDocument[]>([])
  const [drives, setDrives] = useState<UpdateDrive[]>([])
  const [updates, setUpdates] = useState<RecordUpdate[]>([])
  const [loading, setLoading] = useState(true)
  const [filters, setFilters] = useState<Filters>(NO_FILTERS)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [adding, setAdding] = useState<StudentRecord | null>(null)
  const [importing, setImporting] = useState(false)
  const [busy, setBusy] = useState(false)

  const load = useCallback(async () => {
    const [allRecords, allVerifications, allDocuments, allDrives, allUpdates] = await Promise.all([
      listRecords(),
      listAllVerifications(),
      listAllDocuments(),
      listDrives(),
      listAllUpdates(),
    ])
    setRecords(allRecords)
    setVerifications(allVerifications)
    setDocuments(allDocuments)
    setDrives(allDrives)
    setUpdates(allUpdates)
  }, [])

  useEffect(() => {
    load()
      .catch((error) => {
        console.error(error)
        push('Could not load student profiles.', 'error')
      })
      .finally(() => setLoading(false))
  }, [load, push])

  const vMap = useMemo(() => verificationMap(verifications), [verifications])

  /* ---------- derived ---------- */

  const unverified = useMemo(() => {
    const rows: { record: StudentRecord; kind: keyof typeof ENTRY_KIND_LABEL; item: { id: string }; label: string; proofs: RecordDocument[] }[] = []
    for (const record of records) {
      const recordDocs = documents.filter((d) => d.recordId === record.id)
      for (const entry of verifiableEntries(record)) {
        if (verificationFor(entry.item, vMap)) continue
        rows.push({ record, kind: entry.kind, item: entry.item, label: entry.label, proofs: recordDocs.filter((d) => d.linkedItemId === entry.item.id) })
      }
      for (const doc of recordDocs) {
        if (!verificationFor(doc, vMap)) rows.push({ record, kind: 'document', item: doc, label: doc.name, proofs: [doc] })
      }
    }
    return rows.sort((a, b) => b.proofs.length - a.proofs.length || b.record.updatedAt - a.record.updatedAt)
  }, [records, documents, vMap])

  const graduationDue = useMemo(() => {
    const byYear = new Map<string, number>()
    for (const r of records) if (isGraduationDue(r)) byYear.set(r.graduationYear, (byYear.get(r.graduationYear) ?? 0) + 1)
    return Array.from(byYear.entries()).sort(([a], [b]) => a.localeCompare(b))
  }, [records])

  const programmes = useMemo(
    () => Array.from(new Set([...records.map((r) => r.programme).filter(Boolean)])).sort(),
    [records],
  )
  const batches = useMemo(
    () => Array.from(new Set(records.map((r) => r.graduationYear).filter(Boolean))).sort().reverse(),
    [records],
  )

  const filtered = useMemo(
    () =>
      records
        .filter((r) => matchesSearch(r, filters.search))
        .filter((r) => !filters.programme || r.programme === filters.programme)
        .filter((r) => !filters.batch || r.graduationYear === filters.batch)
        .filter((r) => !filters.year || yearKey(r) === filters.year)
        .filter((r) => !filters.outcome || primaryOutcome(r) === filters.outcome)
        .filter((r) => !filters.area || areasOf(r).includes(filters.area as never))
        .filter((r) => !filters.freshness || freshness(r) === filters.freshness)
        .sort((a, b) => b.graduationYear.localeCompare(a.graduationYear) || a.name.localeCompare(b.name)),
    [records, filters],
  )

  if (!user) return null
  const actor = actorOf(user)
  const selected = records.find((r) => r.id === selectedId) ?? null
  const openRequests = drives.filter((d) => d.isActive).length

  /* ---------- actions ---------- */

  async function handleGraduate(year: string) {
    if (!window.confirm(`Mark every student of batch ${year} as graduated? They keep the same login, and get a request to add what they're doing next.`)) return
    setBusy(true)
    try {
      const count = await graduateBatch(records, '', year, actor)
      await saveDrive({
        id: newId('drive'),
        title: `Congratulations, batch of ${year}! 🎓`,
        message: 'Congratulations on graduating. Tell us what comes next — higher studies, a job, or exam preparation — and upload your admission or offer letter.',
        audience: 'alumni',
        programme: '',
        graduationYear: year,
        recordId: '',
        dueDate: new Date(Date.now() + 30 * 864e5).toISOString().slice(0, 10),
        createdBy: user!.uid,
        createdByName: user!.name,
        createdAt: Date.now(),
        isActive: true,
      })
      await load()
      push(`${count} student${count === 1 ? '' : 's'} marked as graduated.`, 'success')
    } catch (error) {
      console.error(error)
      push('Could not mark the batch as graduated.', 'error')
    } finally {
      setBusy(false)
    }
  }

  async function handleAddSave() {
    if (!adding) return
    if (!adding.name.trim() || !adding.programme || !adding.graduationYear) {
      push('Name, course and graduation year are required.', 'error')
      return
    }
    const duplicate = adding.rollNo && records.find((r) => r.rollNo === adding.rollNo.trim())
    if (duplicate && !window.confirm(`A profile with roll no. ${adding.rollNo} already exists (${duplicate.name}). Add anyway?`)) return
    setBusy(true)
    try {
      await saveRecord({ ...adding, rollNo: adding.rollNo.trim() }, null, actor)
      setAdding(null)
      await load()
      push('Profile added.', 'success')
    } catch (error) {
      console.error(error)
      push('Could not add the profile.', 'error')
    } finally {
      setBusy(false)
    }
  }

  async function quickVerify(record: StudentRecord, kind: keyof typeof ENTRY_KIND_LABEL, item: { id: string }, label: string) {
    try {
      await verifyItem(record.id, item, kind, `${ENTRY_KIND_LABEL[kind].toLowerCase()}: ${label}`, actor)
      setVerifications(await listAllVerifications())
    } catch (error) {
      console.error(error)
      push('Could not verify this entry.', 'error')
    }
  }

  const counts: Partial<Record<View, number>> = {
    students: records.length,
    verify: unverified.length,
    requests: openRequests,
  }

  const graduationBanners = graduationDue.map(([year, count]) => (
    <div key={year} className="card-tint tint-butter flex flex-wrap items-center justify-between gap-3">
      <p className="text-sm">
        🎓 <b>{count} student{count === 1 ? '' : 's'} from batch {year}</b> {count === 1 ? 'has' : 'have'} finished the final year but{' '}
        {count === 1 ? "isn't" : "aren't"} marked as graduated yet.
      </p>
      <button type="button" className="btn-primary text-sm" disabled={busy} onClick={() => handleGraduate(year)}>
        Mark batch {year} as graduated
      </button>
    </div>
  ))

  return (
    <main className="page-shell">
      <div className="grid grid-cols-[minmax(0,1fr)] lg:grid-cols-[230px_minmax(0,1fr)] gap-6 items-start">
        {/* SIDEBAR */}
        <aside className="card p-3 lg:sticky lg:top-24 min-w-0">
          <div className="hidden lg:block px-2 pt-1 pb-3 mb-2 border-b border-line dark:border-cream-soft/15">
            <p className="text-xs font-bold uppercase tracking-wide text-ink-muted">Admin console</p>
            <p className="font-extrabold leading-tight mt-0.5">Student records office</p>
          </div>
          <nav aria-label="Admin sections" className="flex lg:flex-col gap-1 overflow-x-auto">
            {VIEWS.map((v) => (
              <button
                key={v.id}
                type="button"
                aria-current={view === v.id ? 'page' : undefined}
                onClick={() => go(v.id)}
                className={`flex items-center gap-2.5 rounded-2xl px-3 py-2 text-sm font-semibold whitespace-nowrap text-left transition-colors ${
                  view === v.id ? 'bg-ink text-cream-soft dark:bg-cream-soft dark:text-ink' : 'hover:bg-ink/5 dark:hover:bg-cream-soft/10'
                }`}
              >
                <span aria-hidden="true" className="w-5 text-center">{v.icon}</span>
                <span className="flex-1">{v.label}</span>
                {counts[v.id] !== undefined && (
                  <span className={`text-xs tabular-nums rounded-full px-2 py-0.5 ${view === v.id ? 'bg-cream-soft/20' : 'bg-chip dark:bg-cream-soft/10'}`}>
                    {counts[v.id]}
                  </span>
                )}
              </button>
            ))}
          </nav>
          <p className="hidden lg:block text-xs text-ink-muted px-2 pt-3 mt-2 border-t border-line dark:border-cream-soft/15">
            Signed in as {user.name}
          </p>
        </aside>

        {/* CONTENT */}
        <div className="min-w-0 space-y-6">
          {loading ? (
            <div className="card">Loading student profiles…</div>
          ) : (
            <>
              {view === 'overview' && (
                <OverviewView
                  user={user}
                  records={records}
                  drives={drives}
                  updates={updates}
                  unverified={unverified}
                  graduationBanners={graduationBanners}
                  onGo={go}
                  onOpen={setSelectedId}
                  onFilter={(patch) => {
                    setFilters({ ...NO_FILTERS, ...patch })
                    go('students')
                  }}
                />
              )}

              {view === 'students' && (
                <>
                  <ViewHeader
                    title="Students"
                    subtitle="Every student's profile, from first year to after graduation. Click a row to open, verify or edit it."
                    actions={
                      <button type="button" className="btn-primary" onClick={() => setAdding(emptyRecord({ source: 'teacher', status: 'alumni' }))}>
                        + Add from paper form
                      </button>
                    }
                  />
                  {graduationBanners}
                  <RecordsTab
                    filters={filters}
                    setFilters={setFilters}
                    programmes={programmes}
                    batches={batches}
                    filtered={filtered}
                    total={records.length}
                    documents={documents}
                    onOpen={setSelectedId}
                  />
                </>
              )}

              {view === 'verify' && (
                <>
                  <ViewHeader title="Verification" subtitle="Check entries against offer letters, admission letters and certificates." />
                  <VerifyTab rows={unverified} onOpen={setSelectedId} onVerify={quickVerify} />
                </>
              )}

              {view === 'requests' && (
                <>
                  <ViewHeader title="Update requests" subtitle="Ask a group of students to review their profiles, and see who has responded." />
                  <DrivesTab drives={drives} records={records} programmes={programmes} batches={batches} onCreated={load} teacherName={user.name} teacherId={user.uid} />
                </>
              )}

              {view === 'reports' && (
                <>
                  <ViewHeader title="Reports" subtitle="Graduation outcomes by batch, where graduates went, exams cleared and areas students excel in." />
                  <InsightsTab records={records} programmes={programmes} />
                </>
              )}

              {view === 'data' && (
                <>
                  <ViewHeader title="Data & import" subtitle="Bring in existing records and take data out for reports." />
                  <DataView
                    records={records}
                    onAdd={() => setAdding(emptyRecord({ source: 'teacher', status: 'alumni' }))}
                    onImport={() => setImporting(true)}
                  />
                </>
              )}
            </>
          )}
        </div>
      </div>

      {selected && (
        <RecordDetail key={selected.id} record={selected} viewer={user} onClose={() => setSelectedId(null)} onChanged={() => load()} />
      )}

      {adding && (
        <Modal wide title="Add a profile from a paper form" onClose={() => setAdding(null)}>
          <RecordForm value={adding} onChange={setAdding} mode="teacher" />
          <div className="sticky bottom-0 card flex flex-wrap justify-end gap-2 mt-4">
            <button type="button" className="btn-outline text-sm" onClick={() => setAdding(null)}>
              Cancel
            </button>
            <button type="button" className="btn-primary text-sm" disabled={busy} onClick={handleAddSave}>
              {busy ? 'Saving…' : 'Save profile'}
            </button>
          </div>
        </Modal>
      )}

      {importing && (
        <ImportModal
          existing={records}
          onClose={() => setImporting(false)}
          onImported={async () => {
            setImporting(false)
            await load()
          }}
        />
      )}
    </main>
  )
}

function ViewHeader({ title, subtitle, actions }: { title: string; subtitle: string; actions?: ReactNode }) {
  return (
    <section className="flex flex-wrap items-end justify-between gap-3">
      <div>
        <p className="eyebrow">Admin console</p>
        <h1 className="page-title">{title}</h1>
        <p className="page-subtitle max-w-2xl">{subtitle}</p>
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </section>
  )
}

/* =========================================================
   OVERVIEW
   ========================================================= */

function OverviewView({
  user,
  records,
  drives,
  updates,
  unverified,
  graduationBanners,
  onGo,
  onOpen,
  onFilter,
}: {
  user: UserProfile
  records: StudentRecord[]
  drives: UpdateDrive[]
  updates: RecordUpdate[]
  unverified: { proofs: RecordDocument[] }[]
  graduationBanners: ReactNode[]
  onGo: (view: View) => void
  onOpen: (id: string) => void
  onFilter: (patch: Partial<Filters>) => void
}) {
  const current = records.filter((r) => studyYearOf(r).index > 0)
  const graduated = records.length - current.length
  const fresh = records.filter((r) => freshness(r) === 'fresh').length
  const stale = records.filter((r) => freshness(r) === 'stale').length
  const linked = records.filter((r) => r.ownerUid).length
  const withProof = unverified.filter((u) => u.proofs.length > 0).length
  const incomplete = records.filter((r) => r.ownerUid && completeness(r).percent < 60).length
  const byYear = (key: string) => records.filter((r) => yearKey(r) === key).length
  const nameOf = new Map(records.map((r) => [r.id, r]))

  const openDrives = drives
    .filter((d) => d.isActive)
    .map((d) => ({ drive: d, progress: driveProgress(d, records) }))
    .filter((d) => d.progress.pending.length > 0)

  const recentAchievements = records
    .flatMap((r) => r.achievements.filter((a) => a.title && a.date && a.date <= today()).map((a) => ({ a, r })))
    .sort((x, y) => y.a.date.localeCompare(x.a.date))
    .slice(0, 6)

  const activity = updates.filter((u) => nameOf.has(u.recordId)).slice(0, 8)

  const attention: { text: ReactNode; action: string; onClick: () => void }[] = [
    ...openDrives.map(({ drive, progress }) => ({
      text: (
        <>
          <b>{progress.pending.length}</b> haven't answered “{drive.title}”
          {drive.dueDate && drive.dueDate < today() ? ' — overdue' : drive.dueDate ? ` · due ${formatDate(drive.dueDate)}` : ''}
        </>
      ),
      action: 'View',
      onClick: () => onGo('requests'),
    })),
    ...(withProof
      ? [{ text: <><b>{withProof}</b> entries have a proof document waiting to be verified</>, action: 'Verify', onClick: () => onGo('verify') }]
      : []),
    ...(stale
      ? [{ text: <><b>{stale}</b> profiles haven't been updated in over a year</>, action: 'See them', onClick: () => onFilter({ freshness: 'stale' }) }]
      : []),
    ...(incomplete
      ? [{ text: <><b>{incomplete}</b> signed-up students have profiles under 60% complete</>, action: 'See them', onClick: () => onFilter({}) }]
      : []),
  ]

  return (
    <>
      <section>
        <p className="eyebrow">Admin console · {new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long' })}</p>
        <h1 className="page-title">
          {greeting()}, {firstName(user.name)}
        </h1>
        <p className="page-subtitle">Here's where student profiles stand today.</p>
      </section>

      <section className="grid sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <StatTile tint="" label="Students" value={records.length} note={`1st ${byYear('1')} · 2nd ${byYear('2')} · 3rd ${byYear('3')} · graduated ${graduated}`} />
        <StatTile tint="" label="Profiles up to date" value={`${pct(fresh, records.length)}%`} note={`${fresh} updated or confirmed in the last 6 months`} />
        <StatTile tint="" label="Awaiting verification" value={unverified.length} note={`${withProof} with a proof document`} />
        <StatTile tint="" label="Signed up" value={`${pct(linked, records.length)}%`} note={`${linked} of ${records.length} profiles linked to a login`} />
      </section>

      {graduationBanners}

      <section className="grid xl:grid-cols-[1.15fr_0.85fr] gap-6 items-start">
        <div className="card">
          <h2 className="font-extrabold text-lg mb-3">Needs attention</h2>
          {attention.length === 0 ? (
            <p className="text-sm text-ink-muted">All caught up. 🎉</p>
          ) : (
            <ul className="divide-y divide-line dark:divide-cream-soft/10">
              {attention.map((item, i) => (
                <li key={i} className="py-3 flex items-center justify-between gap-3">
                  <span className="text-sm">{item.text}</span>
                  <button type="button" className="btn-outline text-xs shrink-0" onClick={item.onClick}>
                    {item.action}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="card">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-extrabold text-lg">Recent activity</h2>
            <span className="text-xs text-ink-muted">{updates.length} changes logged</span>
          </div>
          {activity.length === 0 ? (
            <p className="text-sm text-ink-muted">No changes yet.</p>
          ) : (
            <ul className="space-y-2.5">
              {activity.map((u) => (
                <li key={u.id} className="text-sm">
                  <button type="button" className="font-semibold underline-offset-2 hover:underline" onClick={() => onOpen(u.recordId)}>
                    {nameOf.get(u.recordId)!.name}
                  </button>
                  <span className="text-ink-muted"> · {u.summary}</span>
                  <span className="block text-xs text-ink-muted">
                    {u.actorName === nameOf.get(u.recordId)!.name ? 'by the student' : `by ${u.actorName}`} · {relativeDays(u.at)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>

      <YearActivityPanel records={records} />

      <section className="card">
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-extrabold text-lg">Recent achievements</h2>
          <button type="button" className="btn-outline text-xs" onClick={() => onGo('reports')}>
            Reports →
          </button>
        </div>
        {recentAchievements.length === 0 ? (
          <p className="text-sm text-ink-muted">No achievements added yet.</p>
        ) : (
          <ul className="grid sm:grid-cols-2 gap-3">
            {recentAchievements.map(({ a, r }) => (
              <li key={a.id}>
                <button type="button" onClick={() => onOpen(r.id)} className="w-full text-left rounded-2xl border border-line dark:border-cream-soft/20 p-3 hover:bg-ink/5">
                  <p className="font-semibold">🏆 {a.title}</p>
                  <p className="text-xs text-ink-muted mt-0.5">
                    {r.name} · {studyYearOf(r).short} · {a.area} · {formatDate(a.date)}
                  </p>
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </>
  )
}

/* =========================================================
   DATA & IMPORT
   ========================================================= */

function DataView({ records, onAdd, onImport }: { records: StudentRecord[]; onAdd: () => void; onImport: () => void }) {
  const tiles: { icon: string; title: string; body: string; action: string; onClick: () => void }[] = [
    {
      icon: '📝',
      title: 'Add from a paper form',
      body: 'Type in an old Alumni Database form. It links to the student automatically if they sign up with the same email.',
      action: '+ Add profile',
      onClick: onAdd,
    },
    {
      icon: '⬆',
      title: 'Import a spreadsheet',
      body: 'Upload a CSV of existing alumni data. Columns follow the paper form; duplicates are skipped.',
      action: 'Import CSV',
      onClick: onImport,
    },
    {
      icon: '📄',
      title: 'Download the template',
      body: 'The CSV columns to use for importing, with one sample row.',
      action: 'Download template',
      onClick: () => downloadCsv('student-profiles-template.csv', recordTemplateCsv()),
    },
    {
      icon: '⬇',
      title: 'Export all profiles',
      body: `All ${records.length} profiles in the paper-form column order, ready for Excel or Google Sheets.`,
      action: 'Export CSV',
      onClick: () => downloadCsv(`maitreyi-student-profiles-${today()}.csv`, recordsToCsv(records)),
    },
    {
      icon: '📊',
      title: 'NIRF batch summary',
      body: 'Graduates per batch, higher studies, placements, median package, internships and exams cleared.',
      action: 'Export summary',
      onClick: () => downloadCsv(`batch-outcomes-${today()}.csv`, batchSummaryCsv(records)),
    },
  ]
  return (
    <section className="grid sm:grid-cols-2 xl:grid-cols-3 gap-4">
      {tiles.map((t) => (
        <article key={t.title} className="card flex flex-col">
          <p className="text-2xl" aria-hidden="true">{t.icon}</p>
          <h2 className="font-extrabold mt-2">{t.title}</h2>
          <p className="text-sm text-ink-muted mt-1 flex-1">{t.body}</p>
          <button type="button" className="btn-outline text-sm mt-4 self-start" onClick={t.onClick}>
            {t.action}
          </button>
        </article>
      ))}
    </section>
  )
}

/* =========================================================
   RECORDS TAB
   ========================================================= */

function RecordsTab({
  filters,
  setFilters,
  programmes,
  batches,
  filtered,
  total,
  documents,
  onOpen,
}: {
  filters: Filters
  setFilters: (f: Filters) => void
  programmes: string[]
  batches: string[]
  filtered: StudentRecord[]
  total: number
  documents: RecordDocument[]
  onOpen: (id: string) => void
}) {
  const set = (patch: Partial<Filters>) => setFilters({ ...filters, ...patch })
  const docCount = (id: string) => documents.filter((d) => d.recordId === id).length
  const active = JSON.stringify(filters) !== JSON.stringify(NO_FILTERS)

  return (
    <div className="space-y-4">
      <section className="card">
        <div className="flex flex-wrap gap-2 mb-3" role="tablist" aria-label="Year of study">
          {YEAR_TABS.map((t) => (
            <button
              key={t.value}
              type="button"
              role="tab"
              aria-selected={filters.year === t.value}
              className={`pill-tab ${filters.year === t.value ? 'pill-tab-active' : 'pill-tab-idle'}`}
              onClick={() => set({ year: t.value })}
            >
              {t.label}
            </button>
          ))}
        </div>
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <input
            className="input lg:col-span-2"
            placeholder="Search name, roll no., club, project, company, institute…"
            value={filters.search}
            onChange={(e) => set({ search: e.target.value })}
            aria-label="Search records"
          />
          <select className="input" value={filters.programme} onChange={(e) => set({ programme: e.target.value })} aria-label="Course">
            <option value="">All courses</option>
            {programmes.map((p) => (
              <option key={p}>{p}</option>
            ))}
          </select>
          <select className="input" value={filters.batch} onChange={(e) => set({ batch: e.target.value })} aria-label="Batch">
            <option value="">All batches</option>
            {batches.map((b) => (
              <option key={b} value={b}>Batch of {b}</option>
            ))}
          </select>
          <select className="input" value={filters.outcome} onChange={(e) => set({ outcome: e.target.value as Filters['outcome'] })} aria-label="Doing now">
            <option value="">Doing anything</option>
            {(Object.keys(OUTCOME_LABEL) as Outcome[]).map((o) => (
              <option key={o} value={o}>{OUTCOME_LABEL[o]}</option>
            ))}
          </select>
          <select className="input" value={filters.area} onChange={(e) => set({ area: e.target.value })} aria-label="Achievement area">
            <option value="">Any achievement area</option>
            {ACHIEVEMENT_AREAS.map((a) => (
              <option key={a}>{a}</option>
            ))}
          </select>
          <select className="input" value={filters.freshness} onChange={(e) => set({ freshness: e.target.value as Filters['freshness'] })} aria-label="Last updated">
            <option value="">Any update date</option>
            <option value="fresh">Up to date (&lt; 6 months)</option>
            <option value="due">Update due (6–12 months)</option>
            <option value="stale">Out of date (&gt; 1 year)</option>
          </select>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-3 mt-4">
          <p className="text-sm text-ink-muted">
            Showing <b>{filtered.length}</b> of {total} records
            {active && (
              <>
                {' · '}
                <button type="button" className="underline font-semibold" onClick={() => setFilters(NO_FILTERS)}>
                  Clear filters
                </button>
              </>
            )}
          </p>
          <button
            type="button"
            className="btn-outline text-sm"
            disabled={filtered.length === 0}
            onClick={() => downloadCsv(`maitreyi-records-${today()}.csv`, recordsToCsv(filtered))}
          >
            ⬇ Export {active ? 'filtered ' : ''}CSV ({filtered.length})
          </button>
        </div>
      </section>

      <section className="card overflow-hidden">
        {filtered.length === 0 ? (
          <div className="rounded-2xl border-2 border-dashed border-ink/20 p-8 text-center">
            <p className="font-semibold">No records match.</p>
            <p className="text-sm text-ink-muted mt-1">Try clearing a filter, or add / import records.</p>
          </div>
        ) : (
          <>
          {/* Phones get a compact list; the full table needs a wider screen. */}
          <ul className="sm:hidden divide-y divide-ink/10 dark:divide-cream-soft/10 -my-2">
            {filtered.map((record) => (
              <li key={record.id}>
                <button type="button" className="w-full text-left py-3 flex items-start justify-between gap-3" onClick={() => onOpen(record.id)}>
                  <span className="min-w-0">
                    <span className="block font-bold">{record.name}</span>
                    <span className="block text-xs text-ink-muted">
                      {record.programme || '—'} · {batchLabel(record)}
                    </span>
                    <span className="block text-xs mt-1 truncate">
                      {studyYearOf(record).short} · {nowText(record)}
                    </span>
                  </span>
                  <span className="shrink-0">
                    <FreshnessBadge record={record} />
                  </span>
                </button>
              </li>
            ))}
          </ul>
          <div className="hidden sm:block overflow-x-auto">
            <table className="table min-w-[860px]">
              <thead>
                <tr>
                  <th>Student</th>
                  <th>Course · Year</th>
                  <th>Doing now</th>
                  <th>Complete</th>
                  <th>Last updated</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {filtered.map((record) => {
                  const score = completeness(record, docCount(record.id)).percent
                  return (
                    <tr key={record.id} className="cursor-pointer hover:bg-butter/40 dark:hover:bg-cream-soft/5" onClick={() => onOpen(record.id)}>
                      <td>
                        <div className="font-bold">{record.name}</div>
                        <div className="text-xs text-ink-muted">
                          {record.rollNo || 'No roll no.'} · {record.ownerUid ? '🔗 signed up' : 'not signed up'}
                        </div>
                      </td>
                      <td>
                        <div className="font-semibold">{record.programme || '—'}</div>
                        <div className="text-xs text-ink-muted">
                          {studyYearOf(record).label} · {batchLabel(record)}
                        </div>
                      </td>
                      <td className="max-w-[280px]">
                        {record.status === 'alumni' && (
                          <div className="flex flex-wrap gap-1 mb-1">
                            <OutcomeBadge record={record} />
                          </div>
                        )}
                        <div className="text-xs line-clamp-2" title={nowText(record)}>{nowText(record)}</div>
                      </td>
                      <td className="w-32">
                        <div className="text-xs font-semibold tabular-nums mb-1">{score}%</div>
                        <Meter value={score} label={`${record.name} completeness`} />
                      </td>
                      <td>
                        <FreshnessBadge record={record} showDate />
                      </td>
                      <td>
                        <button
                          type="button"
                          className="btn-outline text-sm"
                          onClick={(e) => {
                            e.stopPropagation()
                            onOpen(record.id)
                          }}
                        >
                          Open
                        </button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
          </>
        )}
      </section>
    </div>
  )
}

/* =========================================================
   VERIFICATION QUEUE
   ========================================================= */

function VerifyTab({
  rows,
  onOpen,
  onVerify,
}: {
  rows: { record: StudentRecord; kind: keyof typeof ENTRY_KIND_LABEL; item: { id: string }; label: string; proofs: RecordDocument[] }[]
  onOpen: (id: string) => void
  onVerify: (record: StudentRecord, kind: keyof typeof ENTRY_KIND_LABEL, item: { id: string }, label: string) => void
}) {
  const [open, setOpen] = useState<RecordDocument | null>(null)
  const [onlyWithProof, setOnlyWithProof] = useState(true)
  const visible = onlyWithProof ? rows.filter((r) => r.proofs.length > 0) : rows

  return (
    <section className="card overflow-hidden">
      <div className="flex flex-wrap items-start justify-between gap-3 mb-4">
        <div>
          <h2 className="text-xl font-black">Verification queue</h2>
          <p className="text-sm text-ink-muted mt-1 max-w-2xl">
            Check each entry against its proof (offer letter, admission letter, certificate) or your paper files.
            A verified entry that the student edits later returns to this queue automatically.
          </p>
        </div>
        <label className="flex items-center gap-2 text-sm font-semibold">
          <input type="checkbox" checked={onlyWithProof} onChange={(e) => setOnlyWithProof(e.target.checked)} />
          Only entries with a document attached
        </label>
      </div>

      {visible.length === 0 ? (
        <div className="rounded-2xl border-2 border-dashed border-ink/20 p-8 text-center">
          <p className="font-semibold">Nothing waiting here. 🎉</p>
          {onlyWithProof && rows.length > 0 && <p className="text-sm text-ink-muted mt-1">{rows.length} entries have no document — untick the filter to see them.</p>}
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="table min-w-[760px]">
            <thead>
              <tr>
                <th>Student</th>
                <th>Entry</th>
                <th>Proof</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {visible.slice(0, 200).map((row) => (
                <tr key={`${row.record.id}_${row.item.id}`}>
                  <td>
                    <button type="button" className="font-bold underline text-left" onClick={() => onOpen(row.record.id)}>
                      {row.record.name}
                    </button>
                    <div className="text-xs text-ink-muted">
                      {row.record.programme} · {batchLabel(row.record)}
                    </div>
                  </td>
                  <td>
                    <span className="badge mr-2">{ENTRY_KIND_LABEL[row.kind]}</span>
                    <span className="font-semibold">{row.label || 'Untitled'}</span>
                  </td>
                  <td>
                    {row.proofs.length === 0 ? (
                      <span className="text-xs text-ink-muted">No document</span>
                    ) : (
                      row.proofs.map((doc) => (
                        <button key={doc.id} type="button" className="block text-xs font-semibold underline" onClick={() => setOpen(doc)}>
                          📎 {doc.name}
                        </button>
                      ))
                    )}
                  </td>
                  <td className="text-right whitespace-nowrap">
                    <button type="button" className="btn-primary text-xs" onClick={() => onVerify(row.record, row.kind, row.item, row.label)}>
                      ✓ Verify
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {visible.length > 200 && <p className="text-xs text-ink-muted mt-3">Showing the first 200 of {visible.length}.</p>}
        </div>
      )}
      {open && <DocumentViewer doc={open} onClose={() => setOpen(null)} />}
    </section>
  )
}

/* =========================================================
   UPDATE REQUESTS (DRIVES)
   ========================================================= */

const AUDIENCE_LABEL: Record<DriveAudience, string> = {
  alumni: 'Graduated students',
  current: 'Current students',
  all: 'Everyone',
}

function DrivesTab({
  drives,
  records,
  programmes,
  batches,
  onCreated,
  teacherId,
  teacherName,
}: {
  drives: UpdateDrive[]
  records: StudentRecord[]
  programmes: string[]
  batches: string[]
  onCreated: () => Promise<void>
  teacherId: string
  teacherName: string
}) {
  const { push } = useToast()
  const year = new Date().getFullYear()
  const blank = {
    title: `Profile update ${year}`,
    message: 'Please review your profile — what you are doing now, exams cleared, achievements — and upload any new offer or admission letters.',
    audience: 'alumni' as DriveAudience,
    programme: '',
    graduationYear: '',
    dueDate: new Date(Date.now() + 21 * 864e5).toISOString().slice(0, 10),
  }
  const [form, setForm] = useState(blank)
  const [expanded, setExpanded] = useState<string | null>(null)

  const preview = driveProgress({ ...form, id: '', recordId: '', createdBy: '', createdByName: '', createdAt: Date.now(), isActive: true }, records)

  async function create(event: React.FormEvent) {
    event.preventDefault()
    if (!form.title.trim()) return
    await saveDrive({ ...form, id: newId('drive'), recordId: '', createdBy: teacherId, createdByName: teacherName, createdAt: Date.now(), isActive: true })
    setForm(blank)
    await onCreated()
    push(`Update request sent to ${preview.targeted.length} records.`, 'success')
  }

  async function toggle(drive: UpdateDrive) {
    await saveDrive({ ...drive, isActive: !drive.isActive })
    await onCreated()
  }

  async function copyEmails(list: StudentRecord[]) {
    const emails = list.map((r) => r.personalEmail || r.collegeEmail).filter(Boolean)
    try {
      await navigator.clipboard.writeText(emails.join(', '))
      push(`Copied ${emails.length} email addresses — paste them into Bcc.`, 'success')
    } catch {
      window.prompt('Copy these addresses:', emails.join(', '))
    }
  }

  const describe = (d: UpdateDrive) => {
    if (d.recordId) return `Single record: ${records.find((r) => r.id === d.recordId)?.name ?? 'deleted record'}`
    return [AUDIENCE_LABEL[d.audience], d.programme || 'All courses', d.graduationYear ? `Batch of ${d.graduationYear}` : 'All batches'].join(' · ')
  }

  return (
    <div className="grid xl:grid-cols-[0.9fr_1.1fr] gap-6 items-start">
      <section className="card-tint tint-sky">
        <h2 className="text-xl font-black">Request an update</h2>
        <p className="text-sm text-ink/70 mt-1">
          Everyone in the group sees a banner on their dashboard until they update or confirm their record. Track who has responded on the right.
        </p>
        <form onSubmit={create} className="space-y-3 mt-4">
          <label className="block">
            <span className="text-sm font-medium">Title</span>
            <input className="input mt-1" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} required />
          </label>
          <label className="block">
            <span className="text-sm font-medium">Message</span>
            <textarea className="input mt-1 min-h-[90px]" value={form.message} onChange={(e) => setForm({ ...form, message: e.target.value })} />
          </label>
          <div className="grid sm:grid-cols-2 gap-3">
            <label className="block">
              <span className="text-sm font-medium">Who</span>
              <select className="input mt-1" value={form.audience} onChange={(e) => setForm({ ...form, audience: e.target.value as DriveAudience })}>
                {Object.entries(AUDIENCE_LABEL).map(([k, v]) => (
                  <option key={k} value={k}>{v}</option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className="text-sm font-medium">Respond by</span>
              <input className="input mt-1" type="date" min={today()} value={form.dueDate} onChange={(e) => setForm({ ...form, dueDate: e.target.value })} />
            </label>
            <label className="block">
              <span className="text-sm font-medium">Course</span>
              <select className="input mt-1" value={form.programme} onChange={(e) => setForm({ ...form, programme: e.target.value })}>
                <option value="">All courses</option>
                {Array.from(new Set([...programmes, ...RECORD_PROGRAMMES])).sort().map((p) => (
                  <option key={p}>{p}</option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className="text-sm font-medium">Batch</span>
              <select className="input mt-1" value={form.graduationYear} onChange={(e) => setForm({ ...form, graduationYear: e.target.value })}>
                <option value="">All batches</option>
                {batches.map((b) => (
                  <option key={b} value={b}>Batch of {b}</option>
                ))}
              </select>
            </label>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
            <p className="text-sm font-semibold">Reaches {preview.targeted.length} records</p>
            <button type="submit" className="btn-primary" disabled={preview.targeted.length === 0}>
              Send request
            </button>
          </div>
        </form>
      </section>

      <section className="space-y-3">
        {drives.length === 0 && <div className="card text-sm text-ink-muted">No update requests yet.</div>}
        {drives
          .slice()
          .sort((a, b) => Number(b.isActive) - Number(a.isActive) || b.createdAt - a.createdAt)
          .map((drive) => {
            const progress = driveProgress(drive, records)
            const share = pct(progress.responded, progress.targeted.length)
            const overdue = drive.isActive && drive.dueDate && drive.dueDate < today()
            return (
              <article key={drive.id} className={`card ${drive.isActive ? '' : 'opacity-70'}`}>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <h3 className="font-extrabold">
                      {drive.title}{' '}
                      <span className={`badge ml-1 ${drive.isActive ? (overdue ? 'bg-blush text-ink' : 'bg-sage text-ink') : ''}`}>
                        {drive.isActive ? (overdue ? 'Overdue' : 'Open') : 'Closed'}
                      </span>
                    </h3>
                    <p className="text-xs text-ink-muted mt-1">
                      {describe(drive)} · sent {formatDate(drive.createdAt)} by {drive.createdByName}
                      {drive.dueDate ? ` · due ${formatDate(drive.dueDate)}` : ''}
                    </p>
                  </div>
                  <button type="button" className="btn-outline text-xs" onClick={() => toggle(drive)}>
                    {drive.isActive ? 'Close' : 'Reopen'}
                  </button>
                </div>
                <div className="mt-3">
                  <div className="flex justify-between text-sm mb-1">
                    <span className="font-semibold">
                      {progress.responded} of {progress.targeted.length} responded
                    </span>
                    <span className="tabular-nums">{share}%</span>
                  </div>
                  <Meter value={share} label={`${drive.title} response rate`} />
                </div>
                {progress.pending.length > 0 && (
                  <div className="mt-3 flex flex-wrap gap-2">
                    <button type="button" className="text-sm font-semibold underline" onClick={() => setExpanded(expanded === drive.id ? null : drive.id)}>
                      {expanded === drive.id ? 'Hide' : 'Show'} {progress.pending.length} pending
                    </button>
                    <button type="button" className="text-sm font-semibold underline" onClick={() => copyEmails(progress.pending)}>
                      Copy pending emails
                    </button>
                  </div>
                )}
                {expanded === drive.id && (
                  <ul className="mt-3 divide-y divide-ink/10 text-sm">
                    {progress.pending.map((r) => (
                      <li key={r.id} className="py-2 flex flex-wrap justify-between gap-2">
                        <span className="font-semibold">
                          {r.name} <span className="font-normal text-ink-muted">· {r.programme} · {r.graduationYear}</span>
                        </span>
                        <span className="text-ink-muted">
                          {r.personalEmail || r.collegeEmail || 'no email'}
                          {r.mobile ? ` · ${r.mobile}` : ''}
                          {r.ownerUid ? '' : ' · not signed up'}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </article>
            )
          })}
      </section>
    </div>
  )
}

/* =========================================================
   BATCH OUTCOMES (NIRF-style)
   ========================================================= */

function InsightsTab({ records, programmes }: { records: StudentRecord[]; programmes: string[] }) {
  const [programme, setProgramme] = useState('')
  const scoped = programme ? records.filter((r) => r.programme === programme) : records
  const alumni = scoped.filter((r) => r.status === 'alumni')
  const summaries = batchSummaries(scoped)
  const totals = summaries.reduce(
    (acc, b) => ({ total: acc.total + b.total, hs: acc.hs + b.higherStudies, job: acc.job + b.employed, unknown: acc.unknown + b.unknown }),
    { total: 0, hs: 0, job: 0, unknown: 0 },
  )
  const packages = alumni
    .map(currentJob)
    .map((job) => (job ? packageOf(job) : null))
    .filter((v): v is number => v !== null)
  const medianAll = median(packages)

  const institutions = topCounts(alumni.map((r) => currentStudy(r)?.institution ?? ''))
  const employers = topCounts(alumni.map((r) => currentJob(r)?.company ?? ''))
  const exams = topCounts(scoped.flatMap((r) => r.exams.filter((e) => e.result === 'qualified').map((e) => (e.exam === 'OTHERS' ? e.otherName : e.exam))))
  const areas = ACHIEVEMENT_AREAS.map((a) => ({ label: a, count: scoped.filter((r) => areasOf(r).includes(a)).length })).filter((a) => a.count > 0).sort((a, b) => b.count - a.count)


  return (
    <div className="space-y-6">
      <section className="card flex flex-wrap items-end justify-between gap-3">
        <label className="block min-w-[260px]">
          <span className="text-sm font-medium">Course</span>
          <select className="input mt-1" value={programme} onChange={(e) => setProgramme(e.target.value)}>
            <option value="">All courses</option>
            {programmes.map((p) => (
              <option key={p}>{p}</option>
            ))}
          </select>
        </label>
        <button
          type="button"
          className="btn-outline text-sm"
          onClick={() => downloadCsv(`batch-outcomes${programme ? `-${programme.replace(/[^a-z0-9]+/gi, '-')}` : ''}-${today()}.csv`, batchSummaryCsv(scoped))}
        >
          ⬇ Export batch summary (NIRF)
        </button>
      </section>

      <section className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatTile tint={TINTS[3]} label="Graduates on record" value={totals.total} note={`${totals.unknown} haven't reported an outcome`} />
        <StatTile tint={TINTS[2]} label="Higher studies" value={`${pct(totals.hs, totals.total)}%`} note={`${totals.hs} graduates`} />
        <StatTile tint={TINTS[0]} label="Placed / employed" value={`${pct(totals.job, totals.total)}%`} note={`${totals.job} graduates`} />
        <StatTile tint={TINTS[1]} label="Median package" value={medianAll === null ? '—' : `₹${medianAll} LPA`} note={`From ${packages.length} reported packages`} />
      </section>

      <section className="card overflow-hidden">
        <p className="eyebrow">Graduation outcomes</p>
        <h2 className="text-2xl font-black mt-1">By graduating batch</h2>
        <p className="text-sm text-ink-muted mt-1 mb-4">
          Shares are of graduates on record in that batch. Use the export for NIRF “Graduation Outcomes” and NAAC criterion 5.
        </p>
        {summaries.length === 0 ? (
          <p className="text-sm text-ink-muted">No graduates on record yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="table min-w-[820px]">
              <thead>
                <tr>
                  <th>Batch</th>
                  <th>On record</th>
                  <th>Higher studies</th>
                  <th>Placed</th>
                  <th>Median package</th>
                  <th>Did internship</th>
                  <th>Qualified exam</th>
                  <th>Not reported</th>
                </tr>
              </thead>
              <tbody>
                {summaries.map((b) => (
                  <tr key={b.graduationYear}>
                    <td className="font-bold">{b.graduationYear}</td>
                    <td className="tabular-nums">{b.total}</td>
                    {[b.higherStudies, b.employed].map((value, i) => (
                      <td key={i} className="w-36">
                        <div className="text-xs tabular-nums mb-1">
                          {value} · {pct(value, b.total)}%
                        </div>
                        <Meter value={pct(value, b.total)} />
                      </td>
                    ))}
                    <td className="tabular-nums">{b.medianPackageLPA === null ? '—' : `₹${b.medianPackageLPA} LPA`}</td>
                    <td className="tabular-nums">{b.didInternship} · {pct(b.didInternship, b.total)}%</td>
                    <td className="tabular-nums">{b.qualifiedExam}</td>
                    <td className="tabular-nums">{b.unknown}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="grid lg:grid-cols-2 gap-6">
        <div className="card">
          <h3 className="font-extrabold text-lg">Where graduates study now</h3>
          <p className="text-sm text-ink-muted mb-4">Institutes for current higher studies</p>
          <BarList items={institutions} />
        </div>
        <div className="card">
          <h3 className="font-extrabold text-lg">Where graduates work now</h3>
          <p className="text-sm text-ink-muted mb-4">Current employers</p>
          <BarList items={employers} />
        </div>
        <div className="card">
          <h3 className="font-extrabold text-lg">Competitive exams cleared</h3>
          <p className="text-sm text-ink-muted mb-4">Students and graduates who passed each exam</p>
          <BarList items={exams} />
        </div>
        <div className="card">
          <h3 className="font-extrabold text-lg">Where students excel</h3>
          <p className="text-sm text-ink-muted mb-4">Students with at least one achievement in each area</p>
          <BarList items={areas} />
        </div>
      </section>
    </div>
  )
}

/* What 1st, 2nd and 3rd years are up to, from their own profiles. */
function YearActivityPanel({ records }: { records: StudentRecord[] }) {
  const scoped = records
  // What current students are up to, by year of study.
  const current = scoped.filter((r) => studyYearOf(r).index > 0)
  const years = [1, 2, 3].map((index) => {
    const list = current.filter((r) => Math.min(studyYearOf(r).index, 3) === index)
    return {
      index,
      total: list.length,
      active: list.filter((r) => r.activities.some((a) => a.ongoing)).length,
      achievements: list.reduce((sum, r) => sum + r.achievements.length, 0),
      interned: list.filter((r) => r.internships.length > 0).length,
    }
  })
  const activityKinds = topCounts(current.flatMap((r) => r.activities.filter((a) => a.ongoing).map((a) => a.kind)), 8)

  return (
      <section className="card">
        <p className="eyebrow">Current students</p>
        <h2 className="text-2xl font-black mt-1">What each year is doing</h2>
        <p className="text-sm text-ink-muted mt-1 mb-4">From students' own profiles — clubs, projects, courses and exam preparation they've marked as ongoing.</p>
        <div className="grid lg:grid-cols-[1.2fr_1fr] gap-6">
          <div className="grid sm:grid-cols-3 gap-3">
            {years.map((y) => (
              <div key={y.index} className={`card-tint ${TINTS[y.index]}`}>
                <p className="text-sm font-semibold">{['', '1st', '2nd', '3rd'][y.index]} year</p>
                <p className="text-3xl font-black mt-1">{y.total}</p>
                <ul className="text-xs text-ink/70 mt-2 space-y-0.5">
                  <li>{y.active} doing an activity</li>
                  <li>{y.achievements} achievement{y.achievements === 1 ? '' : 's'}</li>
                  <li>{y.interned} did an internship</li>
                </ul>
              </div>
            ))}
          </div>
          <div>
            <h3 className="font-bold mb-3">Ongoing activities by type</h3>
            <BarList items={activityKinds} />
          </div>
        </div>
      </section>
  )
}

/* =========================================================
   CSV IMPORT
   ========================================================= */

function ImportModal({ existing, onClose, onImported }: { existing: StudentRecord[]; onClose: () => void; onImported: () => void }) {
  const { user } = useAuth()
  const { push } = useToast()
  const [fileName, setFileName] = useState('')
  const [parsed, setParsed] = useState<{ fresh: StudentRecord[]; duplicates: StudentRecord[]; errors: string[] } | null>(null)
  const [busy, setBusy] = useState(false)
  const input = useRef<HTMLInputElement>(null)

  async function handleFile(file: File) {
    setFileName(file.name)
    const { records, errors } = csvToRecords(await file.text())
    const rolls = new Set(existing.map((r) => r.rollNo).filter(Boolean))
    const keys = new Set(existing.map((r) => `${r.name.toLowerCase()}|${r.programme}|${r.graduationYear}`))
    const fresh: StudentRecord[] = []
    const duplicates: StudentRecord[] = []
    for (const r of records) {
      const dup = (r.rollNo && rolls.has(r.rollNo)) || keys.has(`${r.name.toLowerCase()}|${r.programme}|${r.graduationYear}`)
      ;(dup ? duplicates : fresh).push(r)
    }
    setParsed({ fresh, duplicates, errors })
  }

  async function handleImport() {
    if (!user || !parsed) return
    setBusy(true)
    try {
      await importRecords(parsed.fresh, actorOf(user), fileName || 'CSV')
      push(`Imported ${parsed.fresh.length} records.`, 'success')
      onImported()
    } catch (error: any) {
      console.error(error)
      push(error?.name === 'QuotaExceededError' ? 'Browser storage is full in demo mode.' : 'Import failed.', 'error')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal title="Import profiles from a spreadsheet" onClose={onClose}>
      <div className="space-y-4">
        <p className="text-sm text-ink-muted">
          Already keep alumni data in Excel or Google Sheets? Save it as CSV with the template's column names (they match the paper form) and import it.
          A student's profile is linked automatically when they sign up with the same college or personal email.
        </p>
        <button type="button" className="btn-outline text-sm" onClick={() => downloadCsv('alumni-records-template.csv', recordTemplateCsv())}>
          ⬇ Download template
        </button>
        <input
          ref={input}
          type="file"
          accept=".csv,text/csv"
          className="input"
          onChange={(e) => {
            const file = e.target.files?.[0]
            if (file) handleFile(file).catch(() => push('Could not read that file.', 'error'))
          }}
        />
        {parsed && (
          <div className="card-tint tint-butter text-sm space-y-1">
            <p>
              <b>{parsed.fresh.length}</b> new record{parsed.fresh.length === 1 ? '' : 's'} ready to import.
            </p>
            {parsed.duplicates.length > 0 && <p>{parsed.duplicates.length} already exist (same roll no. or name + course + batch) and will be skipped.</p>}
            {parsed.errors.slice(0, 6).map((e) => (
              <p key={e} className="text-ink/70">⚠ {e}</p>
            ))}
            {parsed.errors.length > 6 && <p className="text-ink/70">…and {parsed.errors.length - 6} more notes.</p>}
          </div>
        )}
        <div className="flex justify-end gap-2">
          <button type="button" className="btn-outline text-sm" onClick={onClose}>
            Cancel
          </button>
          <button type="button" className="btn-primary text-sm" disabled={busy || !parsed || parsed.fresh.length === 0} onClick={handleImport}>
            {busy ? 'Importing…' : `Import ${parsed?.fresh.length ?? 0} records`}
          </button>
        </div>
      </div>
    </Modal>
  )
}

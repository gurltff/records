import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { ACTIVITY_ICON, ACTIVITY_LABEL, HIGHER_STUDY_STATUS_LABEL } from '../../data/recordOptions'
import { Modal, useToast } from '../Shared'
import {
  actorOf,
  confirmRecord,
  listDocuments,
  listDrives,
  listUpdates,
  listVerifications,
  saveRecord,
} from '../../services/recordsService'
import type { RecordDocument, RecordUpdate, RecordVerification, StudentRecord, UpdateDrive } from '../../types'
import {
  completeness,
  durationLabel,
  emptyAchievement,
  examLabel,
  formatDate,
  freshness,
  isGraduationDue,
  lastTouched,
  monthLabel,
  pendingDrivesFor,
  relativeDays,
  verifiableEntries,
  verificationFor,
  verificationMap,
} from '../../utils/records'
import {
  AboutFields,
  AchievementsFields,
  ActivitiesFields,
  ConsentFields,
  DetailsFields,
  ExamsFields,
  InternshipsFields,
  StatusFields,
  type SectionProps,
} from '../records/RecordForm'
import DocumentsPanel from '../records/DocumentsPanel'
import RecordTimeline from '../records/RecordTimeline'
import { Meter, VerifiedBadge } from '../records/RecordBits'
import { useMyProfile } from './ProfileGate'
import ProfileHeader from './ProfileHeader'
import JourneyTimeline from './JourneyTimeline'

type SectionKey = 'details' | 'about' | 'activities' | 'internships' | 'status' | 'exams' | 'achievements' | 'consent'

const SECTION_TITLE: Record<SectionKey, string> = {
  details: 'Edit student details',
  about: 'Edit bio & interests',
  activities: "What you're doing now",
  internships: 'Internships',
  status: 'After graduation',
  exams: 'Competitive exams',
  achievements: 'Achievements',
  consent: 'Consent & visibility',
}

function SectionFields({ section, ...props }: SectionProps & { section: SectionKey }) {
  switch (section) {
    case 'details':
      return <DetailsFields {...props} />
    case 'about':
      return <AboutFields {...props} />
    case 'activities':
      return <ActivitiesFields {...props} />
    case 'internships':
      return <InternshipsFields {...props} />
    case 'status':
      return <StatusFields {...props} />
    case 'exams':
      return <ExamsFields {...props} />
    case 'achievements':
      return <AchievementsFields {...props} />
    case 'consent':
      return <ConsentFields {...props} />
  }
}

function Panel({ title, action, children }: { title: string; action?: ReactNode; children: ReactNode }) {
  return (
    <section className="card">
      <div className="flex items-center justify-between gap-3 mb-3">
        <h2 className="font-extrabold text-lg">{title}</h2>
        {action}
      </div>
      {children}
    </section>
  )
}

function EditLink({ onClick, children = 'Edit' }: { onClick: () => void; children?: ReactNode }) {
  return (
    <button type="button" className="btn-outline text-xs" onClick={onClick}>
      {children}
    </button>
  )
}

function Stat({ value, label }: { value: ReactNode; label: string }) {
  return (
    <div className="rounded-2xl bg-cream-deep/70 dark:bg-cream-soft/5 border border-ink/5 px-3 py-2">
      <p className="text-xl font-black">{value}</p>
      <p className="text-xs text-ink-muted">{label}</p>
    </div>
  )
}

export default function MyProfile() {
  const { user } = useAuth()
  const { push } = useToast()
  const { profile, setProfile } = useMyProfile()

  const [documents, setDocuments] = useState<RecordDocument[]>([])
  const [verifications, setVerifications] = useState<RecordVerification[]>([])
  const [updates, setUpdates] = useState<RecordUpdate[]>([])
  const [drives, setDrives] = useState<UpdateDrive[]>([])
  const [editing, setEditing] = useState<SectionKey | null>(null)
  const [draft, setDraft] = useState<StudentRecord>(profile)
  const [saving, setSaving] = useState(false)
  const [showHistory, setShowHistory] = useState(false)

  const loadExtras = useCallback(async () => {
    const [docs, verifs, history, allDrives] = await Promise.all([
      listDocuments(profile.id),
      listVerifications(profile.id),
      listUpdates(profile.id),
      listDrives(),
    ])
    setDocuments(docs)
    setVerifications(verifs)
    setUpdates(history)
    setDrives(allDrives)
  }, [profile.id])

  useEffect(() => {
    loadExtras().catch((error) => console.error(error))
  }, [loadExtras])

  const vMap = useMemo(() => verificationMap(verifications), [verifications])

  if (!user) return null
  const actor = actorOf(user)
  const score = completeness(profile, documents.length)
  const entries = verifiableEntries(profile)
  const verifiedCount = entries.filter((e) => verificationFor(e.item, vMap)).length
  const pendingDrives = pendingDrivesFor(drives, profile)
  const isGraduate = profile.status === 'alumni'
  const ongoing = profile.activities.filter((a) => a.ongoing)
  const past = profile.activities.filter((a) => !a.ongoing)

  function open(section: SectionKey, start?: StudentRecord) {
    setDraft(start ?? profile)
    setEditing(section)
  }

  async function save() {
    if (!draft.name.trim()) {
      push('Please enter your name.', 'error')
      return
    }
    if (!draft.consent) {
      push('Your profile needs the consent box ticked to be saved.', 'error')
      return
    }
    setSaving(true)
    try {
      const { record, changed } = await saveRecord(draft, profile, actor)
      setEditing(null)
      if (changed.length === 0) {
        push('No changes to save.', 'info')
        return
      }
      setProfile(record)
      await loadExtras()
      push('Profile updated ✓', 'success')
    } catch (error) {
      console.error(error)
      push('Could not save. Please try again.', 'error')
    } finally {
      setSaving(false)
    }
  }

  async function confirm() {
    setSaving(true)
    try {
      setProfile(await confirmRecord(profile, actor))
      await loadExtras()
      push('Thanks — your profile is marked as up to date.', 'success')
    } catch (error) {
      console.error(error)
      push('Could not confirm your profile.', 'error')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-5">
      <ProfileHeader profile={profile} actions={<button type="button" className="btn-outline" onClick={() => open('about')}>✏️ Edit</button>}>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-5">
          <Stat value={profile.achievements.length} label="Achievements" />
          <Stat value={profile.internships.length} label="Internships" />
          <Stat value={profile.exams.filter((e) => e.result === 'qualified').length} label="Exams cleared" />
          <Stat value={`${verifiedCount}/${entries.length}`} label="Verified by the college" />
        </div>
        <div className="mt-4">
          <div className="flex justify-between text-xs text-ink-muted mb-1">
            <span>Profile {score.percent}% complete{score.missing.length > 0 ? ` — next: ${score.missing[0]}` : ''}</span>
            <span>Updated {relativeDays(lastTouched(profile))}</span>
          </div>
          <Meter value={score.percent} label="Profile completeness" />
        </div>
      </ProfileHeader>

      {/* PROMPTS */}
      {pendingDrives.map((drive) => (
        <div key={drive.id} className="card-tint tint-butter flex flex-wrap items-start justify-between gap-3">
          <div className="max-w-2xl">
            <h3 className="font-extrabold">📣 {drive.title}</h3>
            <p className="text-sm text-ink/80 mt-1">{drive.message}</p>
            <p className="text-xs text-ink/60 mt-2">
              From {drive.createdByName}
              {drive.dueDate ? ` · please respond by ${formatDate(drive.dueDate)}` : ''}
            </p>
          </div>
          <button type="button" className="btn-outline text-sm" disabled={saving} onClick={confirm}>
            Nothing changed — confirm
          </button>
        </div>
      ))}

      {isGraduationDue(profile) && (
        <div className="card-tint tint-blush flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm">
            🎓 <b>Batch {profile.graduationYear} has finished.</b> Congratulations! Mark yourself as graduated and add what's next.
          </p>
          <button type="button" className="btn-primary text-sm" onClick={() => open('status', { ...profile, status: 'alumni' })}>
            I've graduated
          </button>
        </div>
      )}

      {pendingDrives.length === 0 && freshness(profile) !== 'fresh' && (
        <div className="card-tint tint-blush flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm font-semibold">You last updated your profile {relativeDays(lastTouched(profile))}. Still accurate?</p>
          <button type="button" className="btn-outline text-sm" disabled={saving} onClick={confirm}>
            Yes, confirm
          </button>
        </div>
      )}

      <div className="grid lg:grid-cols-[1.35fr_1fr] gap-5 items-start">
        {/* LEFT */}
        <div className="space-y-5">
          <Panel title="Doing now" action={<EditLink onClick={() => open('activities')}>+ Add</EditLink>}>
            {isGraduate && (profile.employment.some((j) => j.current) || profile.higherStudies.some((s) => s.status === 'pursuing' || s.status === 'admitted')) && (
              <ul className="space-y-2 mb-3">
                {profile.higherStudies
                  .filter((s) => s.status === 'pursuing' || s.status === 'admitted')
                  .map((s) => (
                    <li key={s.id} className="flex gap-3 items-start">
                      <span aria-hidden="true">🎓</span>
                      <span>
                        <b>{s.course}</b> · {s.institution}
                        <span className="block text-xs text-ink-muted">{HIGHER_STUDY_STATUS_LABEL[s.status]}</span>
                      </span>
                    </li>
                  ))}
                {profile.employment
                  .filter((j) => j.current)
                  .map((j) => (
                    <li key={j.id} className="flex gap-3 items-start">
                      <span aria-hidden="true">🏢</span>
                      <span>
                        <b>{j.designation}</b> · {j.company}
                        <span className="block text-xs text-ink-muted">{j.location}</span>
                      </span>
                    </li>
                  ))}
              </ul>
            )}
            {ongoing.length === 0 && !isGraduate ? (
              <button type="button" onClick={() => open('activities')} className="w-full rounded-2xl border-2 border-dashed border-ink/30 dark:border-cream-soft/30 p-5 text-sm text-ink-muted hover:bg-butter/40">
                + Add a club, project, course or an exam you're preparing for
              </button>
            ) : (
              <ul className="grid sm:grid-cols-2 gap-2">
                {ongoing.map((a) => (
                  <li key={a.id} className="rounded-2xl border border-line dark:border-cream-soft/20 p-3">
                    <p className="font-semibold">
                      <span aria-hidden="true">{ACTIVITY_ICON[a.kind]} </span>
                      {a.title}
                    </p>
                    <p className="text-xs text-ink-muted mt-0.5">{[a.kind, a.organisation, a.since && `since ${monthLabel(a.since)}`].filter(Boolean).join(' · ')}</p>
                  </li>
                ))}
              </ul>
            )}
            {isGraduate && profile.activity && (
              <p className="text-sm mt-3">
                {ACTIVITY_LABEL[profile.activity]}
                {profile.activityNote ? ` — ${profile.activityNote}` : ''}
              </p>
            )}
            {past.length > 0 && <p className="text-xs text-ink-muted mt-3">Earlier: {past.map((a) => a.title).join(' · ')}</p>}
          </Panel>

          <Panel
            title="My journey"
            action={<EditLink onClick={() => open('achievements', { ...profile, achievements: [emptyAchievement(), ...profile.achievements] })}>+ Achievement</EditLink>}
          >
            <p className="text-sm text-ink-muted -mt-1 mb-4">Everything you add, grouped by year of college.</p>
            <JourneyTimeline profile={profile} verifications={vMap} />
            {profile.achievements.length > 0 && (
              <button type="button" className="text-xs font-semibold underline mt-4" onClick={() => open('achievements')}>
                Edit achievements
              </button>
            )}
          </Panel>
        </div>

        {/* RIGHT */}
        <div className="space-y-5">
          <Panel title="Internships" action={<EditLink onClick={() => open('internships')} />}>
            {profile.internships.length === 0 ? (
              <p className="text-sm text-ink-muted">{profile.hadInternships === 'no' ? 'None yet.' : 'Add internships you have done during college.'}</p>
            ) : (
              <ul className="space-y-2">
                {profile.internships.map((i) => (
                  <li key={i.id} className="text-sm">
                    <p className="font-semibold">{i.title || 'Internship'}</p>
                    <p className="text-xs text-ink-muted">{[i.organisation, durationLabel(i.startDate, i.endDate)].filter(Boolean).join(' · ')}</p>
                    <div className="mt-1"><VerifiedBadge verification={verificationFor(i, vMap)} /></div>
                  </li>
                ))}
              </ul>
            )}
          </Panel>

          <Panel title="Competitive exams" action={<EditLink onClick={() => open('exams')} />}>
            {profile.exams.length === 0 ? (
              <p className="text-sm text-ink-muted">NET, GATE, CAT, JAM, UPSC… add any you've appeared in or cleared.</p>
            ) : (
              <div className="flex flex-wrap gap-1.5">
                {profile.exams.map((e) => (
                  <span key={e.id} className={`badge ${e.result === 'qualified' ? 'bg-sage text-ink' : ''}`}>
                    {examLabel(e)}
                  </span>
                ))}
              </div>
            )}
          </Panel>

          <Panel title={isGraduate ? 'After graduation' : 'Plans after graduation'} action={<EditLink onClick={() => open('status')} />}>
            {profile.higherStudies.length + profile.employment.length === 0 && !profile.activity ? (
              <p className="text-sm text-ink-muted">
                {isGraduate ? 'Add your course or job — upload the admission or offer letter under Documents.' : 'Got an admission or job offer for after college? Add it here.'}
              </p>
            ) : (
              <ul className="space-y-2 text-sm">
                {profile.higherStudies.map((s) => (
                  <li key={s.id}>
                    🎓 <b>{s.course}</b> · {s.institution} <span className="text-xs text-ink-muted">({HIGHER_STUDY_STATUS_LABEL[s.status]})</span>
                  </li>
                ))}
                {profile.employment.map((j) => (
                  <li key={j.id}>
                    🏢 <b>{j.designation}</b> · {j.company} {j.current && <span className="text-xs text-ink-muted">(current)</span>}
                  </li>
                ))}
              </ul>
            )}
          </Panel>

          <Panel title="Details & privacy" action={<EditLink onClick={() => open('details')} />}>
            <dl className="text-sm space-y-1">
              <div className="flex justify-between gap-3"><dt className="text-ink-muted">Roll no.</dt><dd className="font-semibold">{profile.rollNo || '—'}</dd></div>
              <div className="flex justify-between gap-3"><dt className="text-ink-muted">Personal email</dt><dd className="font-semibold truncate">{profile.personalEmail || '—'}</dd></div>
              <div className="flex justify-between gap-3"><dt className="text-ink-muted">Mobile</dt><dd className="font-semibold">{profile.mobile || '—'}</dd></div>
              <div className="flex justify-between gap-3"><dt className="text-ink-muted">On Explore</dt><dd className="font-semibold">{profile.directoryOptIn ? 'Visible to students' : 'Hidden'}</dd></div>
            </dl>
            <div className="flex flex-wrap gap-2 mt-3">
              <button type="button" className="text-xs font-semibold underline" onClick={() => open('consent')}>
                Change visibility
              </button>
              <Link to={`/records/${profile.id}/print`} className="text-xs font-semibold underline">
                Print as college form
              </Link>
            </div>
          </Panel>

          {score.missing.length > 0 && (
            <section className="card-tint tint-butter">
              <h2 className="font-extrabold">Finish your profile</h2>
              <div className="my-2"><Meter value={score.percent} label="Profile completeness" /></div>
              <ul className="text-sm space-y-1">
                {score.missing.map((m) => (
                  <li key={m}>○ {m}</li>
                ))}
              </ul>
            </section>
          )}
        </div>
      </div>

      <DocumentsPanel record={profile} documents={documents} actor={actor} verifications={vMap} onChanged={() => loadExtras()} />

      <div>
        <button type="button" className="text-sm font-semibold underline" onClick={() => setShowHistory((v) => !v)}>
          {showHistory ? 'Hide' : 'Show'} change history ({updates.length})
        </button>
        {showHistory && (
          <div className="mt-3">
            <RecordTimeline updates={updates} />
          </div>
        )}
      </div>

      {editing && (
        <Modal wide={editing !== 'about' && editing !== 'consent'} title={SECTION_TITLE[editing]} onClose={() => setEditing(null)}>
          <SectionFields section={editing} value={draft} set={(patch) => setDraft((d) => ({ ...d, ...patch }))} mode="self" verifications={vMap} />
          <div className="flex justify-end gap-2 mt-5">
            <button type="button" className="btn-outline text-sm" onClick={() => setEditing(null)}>
              Cancel
            </button>
            <button type="button" className="btn-primary text-sm" disabled={saving} onClick={save}>
              {saving ? 'Saving…' : 'Save'}
            </button>
          </div>
        </Modal>
      )}
    </div>
  )
}

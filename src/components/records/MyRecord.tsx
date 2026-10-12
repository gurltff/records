import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { useToast } from '../Shared'
import {
  actorOf,
  confirmRecord,
  draftRecordForUser,
  findRecordForUser,
  listDocuments,
  listDrives,
  listUpdates,
  listVerifications,
  saveRecord,
} from '../../services/recordsService'
import type { RecordDocument, RecordUpdate, RecordVerification, StudentRecord, UpdateDrive } from '../../types'
import {
  completeness,
  formatDate,
  freshness,
  isGraduationDue,
  lastTouched,
  pendingDrivesFor,
  relativeDays,
  verifiableEntries,
  verificationFor,
  verificationMap,
} from '../../utils/records'
import DocumentsPanel from './DocumentsPanel'
import RecordForm from './RecordForm'
import RecordTimeline from './RecordTimeline'
import { FreshnessBadge, Meter, StatTile } from './RecordBits'

function scrollToForm() {
  document.getElementById('record-form')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
}

export default function MyRecord() {
  const { user } = useAuth()
  const { push } = useToast()

  const [saved, setSaved] = useState<StudentRecord | null>(null)
  const [draft, setDraft] = useState<StudentRecord | null>(null)
  const [documents, setDocuments] = useState<RecordDocument[]>([])
  const [verifications, setVerifications] = useState<RecordVerification[]>([])
  const [updates, setUpdates] = useState<RecordUpdate[]>([])
  const [drives, setDrives] = useState<UpdateDrive[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  const loadExtras = useCallback(async (recordId: string) => {
    const [docs, verifs, history] = await Promise.all([
      listDocuments(recordId),
      listVerifications(recordId),
      listUpdates(recordId),
    ])
    setDocuments(docs)
    setVerifications(verifs)
    setUpdates(history)
  }, [])

  // Keyed on uid: in demo mode AuthContext re-creates the user object every few
  // seconds, and reloading on each would wipe unsaved edits.
  const uid = user?.uid
  useEffect(() => {
    if (!user) return
    let cancelled = false
    setLoading(true)
    Promise.all([findRecordForUser(user), listDrives()])
      .then(async ([record, allDrives]) => {
        if (cancelled) return
        setDrives(allDrives)
        setSaved(record)
        setDraft(record ?? draftRecordForUser(user))
        if (record) await loadExtras(record.id)
      })
      .catch((error) => {
        console.error(error)
        push('Could not load your record.', 'error')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [uid, loadExtras, push])

  const vMap = useMemo(() => verificationMap(verifications), [verifications])
  const dirty = useMemo(() => !saved || JSON.stringify(saved) !== JSON.stringify(draft), [saved, draft])

  if (!user) return null
  if (loading || !draft) return <div className="card">Loading your record…</div>

  const actor = actorOf(user)
  const score = completeness(draft, saved ? documents.length : undefined)
  const entries = verifiableEntries(draft)
  const verifiedCount = entries.filter((e) => verificationFor(e.item, vMap)).length
  const pendingDrives = saved ? pendingDrivesFor(drives, saved) : []

  async function handleSave() {
    if (!draft || !user) return
    if (!draft.name.trim()) {
      push('Please enter your name.', 'error')
      return
    }
    if (!draft.consent) {
      push('Please tick the declaration at the end of the form before saving.', 'error')
      document.getElementById('record-form')?.querySelector('section:last-of-type')?.scrollIntoView({ behavior: 'smooth' })
      return
    }
    setSaving(true)
    try {
      const { record, changed } = await saveRecord(draft, saved, actor)
      if (saved && changed.length === 0) {
        push('No changes to save.', 'info')
        return
      }
      setSaved(record)
      setDraft(record)
      await loadExtras(record.id)
      push(saved ? 'Record updated — thank you!' : 'Record created — thank you!', 'success')
    } catch (error) {
      console.error(error)
      push('Could not save your record. Please try again.', 'error')
    } finally {
      setSaving(false)
    }
  }

  async function handleConfirm() {
    if (!saved || !user) return
    setSaving(true)
    try {
      const confirmed = await confirmRecord(saved, actor)
      setSaved(confirmed)
      setDraft(confirmed)
      await loadExtras(confirmed.id)
      push('Thanks — your record is marked as up to date.', 'success')
    } catch (error) {
      console.error(error)
      push('Could not confirm your record.', 'error')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-5">
      {/* SUMMARY */}
      <div className="grid md:grid-cols-3 gap-4">
        <StatTile
          tint="tint-butter"
          label="Profile completeness"
          value={`${score.percent}%`}
          note={
            <div className="space-y-1.5">
              <Meter value={score.percent} label="Profile completeness" />
              {score.missing.length > 0 && <p>Missing: {score.missing.slice(0, 2).join(', ')}{score.missing.length > 2 ? '…' : ''}</p>}
            </div>
          }
        />
        <StatTile
          tint="tint-sky"
          label="Last updated"
          value={saved ? relativeDays(lastTouched(saved)) : 'Not saved yet'}
          note={saved ? <FreshnessBadge record={saved} /> : 'Fill the form below and save.'}
        />
        <StatTile
          tint="tint-sage"
          label="Verified by department"
          value={`${verifiedCount}/${entries.length}`}
          note="Entries a teacher has checked against your documents."
        />
      </div>

      {/* PROMPTS */}
      {!saved && (
        <div className="card-tint tint-sky">
          <h3 className="font-extrabold">👋 Start your record</h3>
          <p className="text-sm text-ink/80 mt-1">
            This is the digital version of the Alumni Database form. We have pre-filled what we know from your account —
            complete the rest and save. You can come back and update it any time, even years after graduating.
          </p>
        </div>
      )}

      {pendingDrives.map((drive) => (
        <div key={drive.id} className="card-tint tint-butter">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="max-w-2xl">
              <h3 className="font-extrabold">📣 {drive.title}</h3>
              <p className="text-sm text-ink/80 mt-1">{drive.message}</p>
              <p className="text-xs text-ink/60 mt-2">
                Requested by {drive.createdByName}
                {drive.dueDate ? ` · please respond by ${formatDate(drive.dueDate)}` : ''}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <button type="button" className="btn-primary text-sm" onClick={scrollToForm}>
                Review & update
              </button>
              <button type="button" className="btn-outline text-sm" disabled={saving || dirty} onClick={handleConfirm}>
                Nothing changed — confirm
              </button>
            </div>
          </div>
        </div>
      ))}

      {saved && isGraduationDue(draft) && (
        <div className="card-tint tint-blush">
          <h3 className="font-extrabold">🎓 Batch {draft.graduationYear} has graduated</h3>
          <p className="text-sm text-ink/80 mt-1">Congratulations! Switch your record to alumni and tell us what you are doing next.</p>
          <button
            type="button"
            className="btn-primary text-sm mt-3"
            onClick={() => {
              setDraft({ ...draft, status: 'alumni' })
              push('Now add your next step under Current status, then save.', 'info')
              scrollToForm()
            }}
          >
            I've graduated — switch to alumni
          </button>
        </div>
      )}

      {saved && pendingDrives.length === 0 && freshness(saved) !== 'fresh' && (
        <div className="card-tint tint-blush flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm font-semibold">
            Your record was last updated {relativeDays(lastTouched(saved))}. Is everything still accurate?
          </p>
          <button type="button" className="btn-outline text-sm" disabled={saving || dirty} onClick={handleConfirm}>
            Yes, confirm
          </button>
        </div>
      )}

      {/* FORM */}
      <div id="record-form" className="scroll-mt-28">
        <RecordForm value={draft} onChange={setDraft} mode="self" verifications={vMap} />
      </div>

      <DocumentsPanel
        record={saved}
        documents={documents}
        actor={actor}
        verifications={vMap}
        onChanged={() => saved && loadExtras(saved.id)}
      />

      {saved && <RecordTimeline updates={updates} />}

      {/* ACTION BAR */}
      <div className="sticky bottom-3 z-30">
        <div className="card flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-ink-muted">
            {dirty ? (saved ? 'You have unsaved changes.' : 'Not saved yet.') : `Saved · ${relativeDays(lastTouched(draft))}`}
          </p>
          <div className="flex flex-wrap gap-2">
            {saved && (
              <Link to={`/records/${saved.id}/print`} className="btn-outline text-sm">
                🖨 Print form
              </Link>
            )}
            {saved && dirty && (
              <button type="button" className="btn-outline text-sm" onClick={() => setDraft(saved)}>
                Discard changes
              </button>
            )}
            <button type="button" className="btn-primary text-sm" disabled={saving || !dirty} onClick={handleSave}>
              {saving ? 'Saving…' : saved ? 'Save changes' : 'Save record'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

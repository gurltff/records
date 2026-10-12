import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { ACTIVITY_LABEL, HIGHER_STUDY_STATUS_LABEL } from '../../data/recordOptions'
import { getWhere } from '../../services/store'
import {
  actorOf,
  deleteRecord,
  listDocuments,
  listUpdates,
  listVerifications,
  saveDrive,
  saveRecord,
  unverifyItem,
  verifyItem,
} from '../../services/recordsService'
import type {
  AttendanceRecord,
  RecordDocument,
  RecordUpdate,
  RecordVerification,
  StudentRecord,
  UserProfile,
} from '../../types'
import {
  ENTRY_KIND_LABEL,
  batchLabel,
  completeness,
  durationLabel,
  formatDate,
  headline,
  monthLabel,
  newId,
  verifiableEntries,
  verificationFor,
  verificationMap,
  type VerifiableEntry,
} from '../../utils/records'
import { Modal, useToast } from '../Shared'
import DocumentsPanel, { DocumentViewer } from './DocumentsPanel'
import RecordForm from './RecordForm'
import RecordTimeline from './RecordTimeline'
import JourneyTimeline from '../profile/JourneyTimeline'
import { ACTIVITY_ICON } from '../../data/recordOptions'
import { FreshnessBadge, Meter, OutcomeBadge, SectionCard, StatusBadge, VerifiedBadge } from './RecordBits'

function entryMeta(entry: VerifiableEntry): string {
  const item = entry.item as any
  switch (entry.kind) {
    case 'internship':
      return [item.startDate && item.endDate ? `${formatDate(item.startDate)} – ${formatDate(item.endDate)}` : '', durationLabel(item.startDate, item.endDate), item.mode]
        .filter(Boolean)
        .join(' · ')
    case 'higherStudy':
      return [HIGHER_STUDY_STATUS_LABEL[item.status as keyof typeof HIGHER_STUDY_STATUS_LABEL], item.startYear && `from ${item.startYear}`, item.location, item.admittedVia]
        .filter(Boolean)
        .join(' · ')
    case 'employment':
      return [item.location, item.annualPackageLPA && `₹${item.annualPackageLPA} LPA`, item.current ? 'Current job' : item.endDate && `until ${formatDate(item.endDate)}`]
        .filter(Boolean)
        .join(' · ')
    case 'achievement':
      return [item.area, item.date && formatDate(item.date), item.description].filter(Boolean).join(' · ')
    default:
      return ''
  }
}

function useAttendanceInMySubjects(teacher: UserProfile, record: StudentRecord) {
  const [summary, setSummary] = useState<{ present: number; total: number } | null>(null)
  // A string key: the demo AuthContext hands out a fresh user object every few seconds.
  const subjectKey = (teacher.assignedCourseIds ?? []).join('|')
  useEffect(() => {
    const keys = subjectKey ? subjectKey.split('|') : []
    if (!record.ownerUid || record.status !== 'current' || keys.length === 0) return
    // Queried per subject so it stays within what Firestore rules let a teacher read.
    Promise.all(keys.map((key) => getWhere<AttendanceRecord>('attendanceRecords', 'courseKey', key)))
      .then((lists) => {
        const mine = lists.flat().filter((r) => r.studentId === record.ownerUid)
        setSummary({ present: mine.filter((r) => r.status === 'present').length, total: mine.length })
      })
      .catch(() => setSummary(null))
  }, [subjectKey, record.ownerUid, record.status])
  return summary
}

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex flex-wrap gap-x-3 text-sm py-1.5">
      <span className="w-36 shrink-0 text-ink-muted">{label}</span>
      <span className="font-semibold break-all">{children || '—'}</span>
    </div>
  )
}

export default function RecordDetail({
  record: initial,
  teacher,
  onClose,
  onChanged,
}: {
  record: StudentRecord
  teacher: UserProfile
  onClose: () => void
  onChanged: () => void
}) {
  const { push } = useToast()
  const actor = actorOf(teacher)
  const [record, setRecord] = useState(initial)
  const [draft, setDraft] = useState<StudentRecord | null>(null)
  const [documents, setDocuments] = useState<RecordDocument[]>([])
  const [verifications, setVerifications] = useState<RecordVerification[]>([])
  const [updates, setUpdates] = useState<RecordUpdate[]>([])
  const [openDoc, setOpenDoc] = useState<RecordDocument | null>(null)
  const [busy, setBusy] = useState(false)
  const attendance = useAttendanceInMySubjects(teacher, record)

  const reload = useCallback(async () => {
    const [docs, verifs, history] = await Promise.all([
      listDocuments(record.id),
      listVerifications(record.id),
      listUpdates(record.id),
    ])
    setDocuments(docs)
    setVerifications(verifs)
    setUpdates(history)
  }, [record.id])

  useEffect(() => {
    reload().catch((error) => {
      console.error(error)
      push('Could not load record details.', 'error')
    })
  }, [reload, push])

  const vMap = useMemo(() => verificationMap(verifications), [verifications])
  const entries = verifiableEntries(record)
  const score = completeness(record, documents.length)

  async function toggleVerify(item: { id: string }, kind: VerifiableEntry['kind'] | 'document', label: string, verify: boolean) {
    setBusy(true)
    try {
      if (verify) await verifyItem(record.id, item, kind, `${ENTRY_KIND_LABEL[kind].toLowerCase()}: ${label}`, actor)
      else await unverifyItem(record.id, item.id, `${ENTRY_KIND_LABEL[kind].toLowerCase()}: ${label}`, actor)
      await reload()
      onChanged()
    } catch (error) {
      console.error(error)
      push('Could not update verification.', 'error')
    } finally {
      setBusy(false)
    }
  }

  async function handleSave() {
    if (!draft) return
    if (!draft.name.trim() || !draft.programme || !draft.graduationYear) {
      push('Name, course and graduation year are required.', 'error')
      return
    }
    setBusy(true)
    try {
      const { record: saved, changed } = await saveRecord(draft, record, actor)
      setRecord(saved)
      setDraft(null)
      await reload()
      onChanged()
      push(changed.length ? `Saved: ${changed.join(', ')}` : 'No changes to save.', changed.length ? 'success' : 'info')
    } catch (error) {
      console.error(error)
      push('Could not save the record.', 'error')
    } finally {
      setBusy(false)
    }
  }

  async function requestUpdate() {
    const due = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)
    await saveDrive({
      id: newId('drive'),
      title: 'Please review your record',
      message: `Hi ${record.name.split(' ')[0]}, the department is updating its records. Please check your details and add anything new — courses, jobs, exams or achievements.`,
      audience: 'all',
      programme: '',
      graduationYear: '',
      recordId: record.id,
      dueDate: due,
      createdBy: teacher.uid,
      createdByName: teacher.name,
      createdAt: Date.now(),
      isActive: true,
    })
    onChanged()
    const contact = record.personalEmail || record.collegeEmail
    push(
      record.ownerUid
        ? `Request sent — ${record.name} will see it when they log in.`
        : `Request saved. ${record.name} hasn't signed up yet${contact ? ` — invite them at ${contact}` : ''}.`,
      'success',
    )
  }

  async function handleDelete() {
    if (!window.confirm(`Delete the record for ${record.name}? This also removes its documents. This cannot be undone.`)) return
    setBusy(true)
    try {
      await deleteRecord(record)
      onChanged()
      onClose()
      push('Record deleted.', 'success')
    } catch (error) {
      console.error(error)
      push('Could not delete the record.', 'error')
      setBusy(false)
    }
  }

  const proofsFor = (itemId: string) => documents.filter((d) => d.linkedItemId === itemId)

  const groups: [string, VerifiableEntry['kind']][] = [
    ['Internships', 'internship'],
    ['Higher studies', 'higherStudy'],
    ['Job', 'employment'],
    ['Competitive exams', 'exam'],
    ['Achievements', 'achievement'],
  ]

  return (
    <Modal
      wide
      onClose={onClose}
      title={
        <span className="flex flex-wrap items-center gap-2">
          {record.name}
          <StatusBadge record={record} />
          <OutcomeBadge record={record} />
        </span>
      }
    >
      <div className="space-y-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            {record.bio && <p className="italic">“{record.bio}”</p>}
            <p className="font-semibold">{headline(record)}</p>
            <p className="text-sm text-ink-muted">
              {record.programme || 'Course not set'} · Batch {batchLabel(record)} · Roll no. {record.rollNo || '—'}
            </p>
            <p className="text-xs text-ink-muted mt-1">
              {record.ownerUid ? '🔗 Linked to a student account' : 'Not signed up yet — record is claimed automatically when they register with this email.'}
              {' · '}Source: {record.source === 'self' ? 'self-reported' : record.source === 'import' ? 'spreadsheet import' : 'digitised by teacher'}
            </p>
          </div>
          <div className="w-full sm:w-56 space-y-1.5">
            <div className="flex justify-between text-sm">
              <span className="font-semibold">Completeness</span>
              <span className="tabular-nums">{score.percent}%</span>
            </div>
            <Meter value={score.percent} label="Completeness" />
            <FreshnessBadge record={record} showDate />
          </div>
        </div>

        {!draft && (
          <div className="flex flex-wrap gap-2">
            <button type="button" className="btn-primary text-sm" onClick={() => setDraft(record)}>
              ✏️ Edit record
            </button>
            <Link to={`/records/${record.id}/print`} className="btn-outline text-sm">
              🖨 Print form
            </Link>
            <button type="button" className="btn-outline text-sm" disabled={busy} onClick={requestUpdate}>
              📣 Request update
            </button>
            <button type="button" className="btn-outline text-sm" disabled={busy} onClick={handleDelete}>
              Delete
            </button>
          </div>
        )}

        {draft ? (
          <>
            <RecordForm value={draft} onChange={setDraft} mode="teacher" verifications={vMap} />
            <div className="sticky bottom-0 card flex flex-wrap justify-end gap-2">
              <button type="button" className="btn-outline text-sm" onClick={() => setDraft(null)}>
                Cancel
              </button>
              <button type="button" className="btn-primary text-sm" disabled={busy} onClick={handleSave}>
                {busy ? 'Saving…' : 'Save changes'}
              </button>
            </div>
          </>
        ) : (
          <>
            {score.missing.length > 0 && (
              <div className="card-tint tint-butter text-sm">
                <b>Missing:</b> {score.missing.join(' · ')}
              </div>
            )}

            <SectionCard title="Doing now & journey">
              {record.activities.length > 0 ? (
                <ul className="grid sm:grid-cols-2 gap-2 mb-5">
                  {record.activities.map((a) => (
                    <li key={a.id} className="rounded-2xl border border-line dark:border-cream-soft/20 p-3 text-sm">
                      <p className="font-semibold">
                        <span aria-hidden="true">{ACTIVITY_ICON[a.kind]} </span>
                        {a.title}
                      </p>
                      <p className="text-xs text-ink-muted">
                        {[a.kind, a.organisation, a.ongoing ? 'ongoing' : 'earlier', a.since && `since ${monthLabel(a.since)}`].filter(Boolean).join(' · ')}
                      </p>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-ink-muted mb-5">No current activities added.</p>
              )}
              <JourneyTimeline profile={record} verifications={vMap} />
            </SectionCard>

            <SectionCard title="Contact">
              <Row label="College email">{record.collegeEmail}</Row>
              <Row label="Personal email">{record.personalEmail}</Row>
              <Row label="Mobile">{record.mobile}</Row>
              {attendance && (
                <Row label="Attendance">
                  {attendance.total === 0
                    ? 'No classes recorded in your subjects'
                    : `${Math.round((attendance.present / attendance.total) * 100)}% in your subjects (${attendance.present}/${attendance.total} classes)`}
                </Row>
              )}
            </SectionCard>

            <SectionCard
              title="Verify entries"
              subtitle="Check each entry against its proof document. If the student edits an entry later, it becomes unverified automatically."
            >
              <div className="space-y-5">
                {groups.map(([title, kind]) => {
                  const list = entries.filter((e) => e.kind === kind)
                  return (
                    <div key={kind}>
                      <h4 className="font-bold mb-2">
                        {title}
                        {kind === 'internship' && record.hadInternships === 'no' && <span className="font-normal text-ink-muted"> — none (answered No)</span>}
                      </h4>
                      {list.length === 0 ? (
                        <p className="text-sm text-ink-muted">None reported.</p>
                      ) : (
                        <ul className="space-y-2">
                          {list.map((entry) => {
                            const verified = verificationFor(entry.item, vMap)
                            const proofs = proofsFor(entry.item.id)
                            return (
                              <li key={entry.item.id} className="flex flex-wrap items-center gap-3 rounded-2xl border border-line dark:border-cream-soft/20 p-3">
                                <div className="min-w-0 flex-1">
                                  <p className="font-semibold">{entry.label || 'Untitled entry'}</p>
                                  {entryMeta(entry) && <p className="text-xs text-ink-muted">{entryMeta(entry)}</p>}
                                  {verified && (
                                    <p className="text-xs text-ink-muted">
                                      Verified by {verified.verifiedByName} · {formatDate(verified.verifiedAt)}
                                    </p>
                                  )}
                                </div>
                                <div className="flex flex-wrap items-center gap-2">
                                  {proofs.map((doc) => (
                                    <button key={doc.id} type="button" className="text-xs font-semibold underline" onClick={() => setOpenDoc(doc)}>
                                      📎 {doc.name}
                                    </button>
                                  ))}
                                  <VerifiedBadge verification={verified} />
                                  <button
                                    type="button"
                                    className="btn-outline text-xs"
                                    disabled={busy}
                                    onClick={() => toggleVerify(entry.item, entry.kind, entry.label, !verified)}
                                  >
                                    {verified ? 'Undo' : 'Verify'}
                                  </button>
                                </div>
                              </li>
                            )
                          })}
                        </ul>
                      )}
                    </div>
                  )
                })}

                {record.activity && (
                  <p className="text-sm">
                    <b>Other activity:</b> {ACTIVITY_LABEL[record.activity]}
                    {record.activityNote ? ` — ${record.activityNote}` : ''}
                  </p>
                )}
                {record.interests.length > 0 && (
                  <div className="flex flex-wrap gap-1.5">
                    {record.interests.map((i) => (
                      <span key={i} className="badge bg-butter text-ink">{i}</span>
                    ))}
                  </div>
                )}
              </div>
            </SectionCard>

            <DocumentsPanel
              record={record}
              documents={documents}
              actor={actor}
              verifications={vMap}
              canVerify
              onToggleVerify={(doc, verify) => toggleVerify(doc, 'document', doc.name, verify)}
              onChanged={() => {
                reload()
                onChanged()
              }}
            />

            <RecordTimeline updates={updates} />
          </>
        )}
      </div>

      {openDoc && <DocumentViewer doc={openDoc} onClose={() => setOpenDoc(null)} />}
    </Modal>
  )
}

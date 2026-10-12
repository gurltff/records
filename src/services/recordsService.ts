import { getAll, getById, getWhere, put, remove } from './store'
import { isDemoMode, syncLocalUserProfile } from './authService'
import {
  areasOf,
  batchFromStudyYear,
  changedSections,
  doingNow,
  emptyRecord,
  fingerprint,
  headline,
  newId,
  normaliseRecord,
  pruneEmpty,
} from '../utils/records'
import type {
  DirectoryProfile,
  RecordAction,
  RecordDocument,
  RecordUpdate,
  RecordVerification,
  Role,
  StudentRecord,
  UpdateDrive,
  UserProfile,
  VerifiableKind,
} from '../types'

export const RECORDS = 'studentRecords'
export const DOCUMENTS = 'recordDocuments'
export const UPDATES = 'recordUpdates'
export const VERIFICATIONS = 'recordVerifications'
export const DRIVES = 'updateDrives'
export const DIRECTORY = 'directoryProfiles'

export interface Actor {
  uid: string
  name: string
  role: Role
}

export function actorOf(user: UserProfile): Actor {
  return { uid: user.uid, name: user.name, role: user.role }
}

async function log(recordId: string, actor: Actor, action: RecordAction, summary: string, at = Date.now()) {
  const entry: RecordUpdate = {
    id: newId('upd'),
    recordId,
    actorId: actor.uid,
    actorName: actor.name,
    actorRole: actor.role,
    action,
    summary,
    at,
  }
  await put(UPDATES, entry)
}

/* =========================================================
   RECORDS
   ========================================================= */

export async function listRecords() {
  return (await getAll<StudentRecord>(RECORDS)).map(normaliseRecord)
}

export async function getRecord(id: string) {
  const record = await getById<StudentRecord>(RECORDS, id)
  return record ? normaliseRecord(record) : null
}

/*
 * Finds the signed-in student's record. If a teacher digitised or imported
 * their paper form earlier, it is claimed here by matching email.
 */
export async function findRecordForUser(user: UserProfile): Promise<StudentRecord | null> {
  const owned = await getWhere<StudentRecord>(RECORDS, 'ownerUid', user.uid)
  if (owned.length > 0) return normaliseRecord(owned.sort((a, b) => b.updatedAt - a.updatedAt)[0])

  const email = user.email.trim().toLowerCase()
  if (!email) return null

  for (const field of ['collegeEmail', 'personalEmail'] as const) {
    const matches = await getWhere<StudentRecord>(RECORDS, field, email)
    const unclaimed = matches.find((r) => !r.ownerUid)
    if (unclaimed) {
      const claimed: StudentRecord = normaliseRecord({ ...unclaimed, ownerUid: user.uid })
      await put(RECORDS, claimed)
      await log(claimed.id, actorOf(user), 'claimed', `Linked to ${user.name}'s account`)
      return claimed
    }
  }
  return null
}

/* A new, unsaved profile pre-filled from the account. */
export function draftRecordForUser(user: UserProfile): StudentRecord {
  const programme = user.enrolledCourseIds?.[0]?.split('::')[0] ?? ''
  const email = user.email.trim().toLowerCase()
  const looksPersonal = /@(gmail|yahoo|outlook|hotmail|icloud|proton)\./.test(email)

  return emptyRecord({
    id: `rec_${user.uid}`,
    ownerUid: user.uid,
    name: user.name,
    programme,
    ...batchFromStudyYear(user.year),
    status: 'current',
    collegeEmail: looksPersonal ? '' : email,
    personalEmail: looksPersonal ? email : '',
    source: 'self',
  })
}

export interface SaveResult {
  record: StudentRecord
  changed: string[]
}

export async function saveRecord(draft: StudentRecord, prev: StudentRecord | null, actor: Actor): Promise<SaveResult> {
  const next = pruneEmpty(draft)
  const changed = prev ? changedSections(prev, next) : ['Profile created']
  if (prev && changed.length === 0) return { record: prev, changed }

  const now = Date.now()
  const record: StudentRecord = {
    ...next,
    collegeEmail: next.collegeEmail.trim().toLowerCase(),
    personalEmail: next.personalEmail.trim().toLowerCase(),
    updatedAt: now,
    lastConfirmedAt: prev ? next.lastConfirmedAt : now,
    createdAt: prev ? prev.createdAt : now,
  }
  await put(RECORDS, record)
  await log(record.id, actor, prev ? 'updated' : 'created', prev ? `Updated ${changed.join(', ')}` : 'Profile created')
  await syncDirectory(record, actor)
  return { record, changed }
}

export async function confirmRecord(record: StudentRecord, actor: Actor) {
  const confirmed: StudentRecord = { ...record, lastConfirmedAt: Date.now() }
  await put(RECORDS, confirmed)
  await log(record.id, actor, 'confirmed', 'Confirmed the record is still accurate')
  return confirmed
}

export async function deleteRecord(record: StudentRecord) {
  const [docs, verifications] = await Promise.all([listDocuments(record.id), listVerifications(record.id)])
  await Promise.all([
    ...docs.map((d) => remove(DOCUMENTS, d.id)),
    ...verifications.map((v) => remove(VERIFICATIONS, v.id)),
  ])
  if (record.ownerUid) await remove(DIRECTORY, record.ownerUid).catch(() => undefined)
  await remove(RECORDS, record.id)
}

export async function importRecords(records: StudentRecord[], actor: Actor, label: string) {
  for (const record of records) {
    await put(RECORDS, record)
    await log(record.id, actor, 'imported', `Imported from ${label}`, record.createdAt)
  }
}

/*
 * Marks a batch's profiles as graduated. Students keep the same login;
 * their account only records the graduation year (a CR stops being CR).
 */
export async function graduateBatch(records: StudentRecord[], programme: string, graduationYear: string, actor: Actor) {
  const batch = records.filter(
    (r) => r.status === 'current' && r.graduationYear === graduationYear && (!programme || r.programme === programme),
  )
  for (const record of batch) {
    await put(RECORDS, { ...record, status: 'alumni' })
    await log(record.id, actor, 'graduated', `Marked as graduated (batch ${graduationYear})`)
    if (record.ownerUid) {
      const account = await getById<UserProfile>('users', record.ownerUid)
      if (account && (account.role === 'student' || account.role === 'cr')) {
        const graduated: UserProfile = { ...account, role: 'student', graduationYear }
        await put('users', { ...graduated, id: account.uid })
        if (isDemoMode()) syncLocalUserProfile(graduated)
      }
    }
  }
  return batch.length
}

/* =========================================================
   ALUMNI DIRECTORY (opt-in, public subset only)
   ========================================================= */

/* The public card shown on Explore — no phone, roll number or documents. */
export function directoryProfileOf(record: StudentRecord): DirectoryProfile {
  return {
    id: record.ownerUid ?? record.id,
    recordId: record.id,
    name: record.name,
    programme: record.programme,
    admissionYear: record.admissionYear,
    graduationYear: record.graduationYear,
    status: record.status,
    bio: record.bio,
    headline: headline(record),
    doingNow: doingNow(record),
    highlights: record.achievements
      .slice()
      .sort((a, b) => b.date.localeCompare(a.date))
      .slice(0, 3)
      .map((a) => a.title)
      .filter(Boolean),
    areas: areasOf(record),
    interests: record.interests,
    contactEmail: record.shareContact ? record.personalEmail || record.collegeEmail : '',
    updatedAt: record.updatedAt,
  }
}

async function syncDirectory(record: StudentRecord, actor: Actor) {
  // Only the owner may publish or withdraw their own directory card.
  if (!record.ownerUid || record.ownerUid !== actor.uid) return
  if (record.consent && record.directoryOptIn) {
    await put(DIRECTORY, directoryProfileOf(record))
  } else {
    await remove(DIRECTORY, record.ownerUid).catch(() => undefined)
  }
}

export async function listDirectory() {
  const profiles = await getAll<Partial<DirectoryProfile>>(DIRECTORY)
  return profiles.map((p) => ({ bio: '', doingNow: [], highlights: [], admissionYear: '', ...p }) as DirectoryProfile)
}

/* =========================================================
   DOCUMENTS
   ========================================================= */

export function listDocuments(recordId: string) {
  return getWhere<RecordDocument>(DOCUMENTS, 'recordId', recordId)
}

export function listAllDocuments() {
  return getAll<RecordDocument>(DOCUMENTS)
}

export async function addDocument(
  record: StudentRecord,
  input: Pick<RecordDocument, 'kind' | 'name' | 'mimeType' | 'dataUrl' | 'size' | 'linkedItemId'>,
  actor: Actor,
) {
  const doc: RecordDocument = {
    ...input,
    id: newId('doc'),
    recordId: record.id,
    uploadedBy: actor.uid,
    uploadedByName: actor.name,
    uploadedAt: Date.now(),
  }
  await put(DOCUMENTS, doc)
  await log(record.id, actor, 'document_added', `Uploaded ${doc.name}`)
  return doc
}

export async function removeDocument(doc: RecordDocument, actor: Actor) {
  await remove(DOCUMENTS, doc.id)
  await remove(VERIFICATIONS, `${doc.recordId}__${doc.id}`).catch(() => undefined)
  await log(doc.recordId, actor, 'document_removed', `Removed ${doc.name}`)
}

/* =========================================================
   VERIFICATION
   ========================================================= */

export function listVerifications(recordId: string) {
  return getWhere<RecordVerification>(VERIFICATIONS, 'recordId', recordId)
}

export function listAllVerifications() {
  return getAll<RecordVerification>(VERIFICATIONS)
}

export async function verifyItem(
  recordId: string,
  item: { id: string },
  itemKind: VerifiableKind,
  label: string,
  actor: Actor,
) {
  const verification: RecordVerification = {
    id: `${recordId}__${item.id}`,
    recordId,
    itemId: item.id,
    itemKind,
    fingerprint: fingerprint(item),
    verifiedBy: actor.uid,
    verifiedByName: actor.name,
    verifiedAt: Date.now(),
  }
  await put(VERIFICATIONS, verification)
  await log(recordId, actor, 'verified', `Verified ${label}`)
  return verification
}

export async function unverifyItem(recordId: string, itemId: string, label: string, actor: Actor) {
  await remove(VERIFICATIONS, `${recordId}__${itemId}`)
  await log(recordId, actor, 'unverified', `Removed verification: ${label}`)
}

/* =========================================================
   HISTORY & UPDATE DRIVES
   ========================================================= */

export async function listUpdates(recordId: string) {
  const items = await getWhere<RecordUpdate>(UPDATES, 'recordId', recordId)
  return items.sort((a, b) => b.at - a.at)
}

export function listDrives() {
  return getAll<UpdateDrive>(DRIVES)
}

export async function saveDrive(drive: UpdateDrive) {
  await put(DRIVES, drive)
  return drive
}

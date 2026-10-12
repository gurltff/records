import { ACTIVITY_LABEL } from '../data/recordOptions'
import type {
  Achievement,
  AchievementArea,
  Activity,
  Employment,
  ExamResult,
  HigherStudy,
  Internship,
  RecordVerification,
  StudentRecord,
  UpdateDrive,
} from '../types'

const DAY = 24 * 60 * 60 * 1000

/* A record touched in the last 6 months is fresh; after a year it is stale. */
export const FRESH_DAYS = 180
export const STALE_DAYS = 365

export function newId(prefix: string) {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`
}

/* =========================================================
   CONSTRUCTORS
   ========================================================= */

export function emptyRecord(partial: Partial<StudentRecord> = {}): StudentRecord {
  const now = Date.now()
  return {
    id: newId('rec'),
    ownerUid: null,
    name: '',
    rollNo: '',
    programme: '',
    admissionYear: '',
    graduationYear: '',
    status: 'current',
    bio: '',
    collegeEmail: '',
    personalEmail: '',
    mobile: '',
    hadInternships: '',
    internships: [],
    higherStudies: [],
    employment: [],
    activity: '',
    activityNote: '',
    activities: [],
    exams: [],
    achievements: [],
    interests: [],
    consent: false,
    directoryOptIn: false,
    shareContact: false,
    source: 'self',
    createdAt: now,
    updatedAt: now,
    lastConfirmedAt: now,
    ...partial,
  }
}

/* Fills fields added after a profile was saved, so older data keeps working. */
export function normaliseRecord(record: StudentRecord): StudentRecord {
  const defaults = emptyRecord()
  const merged = { ...defaults, ...record } as StudentRecord
  for (const key of ['internships', 'higherStudies', 'employment', 'activities', 'exams', 'achievements', 'interests'] as const) {
    if (!Array.isArray(merged[key])) (merged as any)[key] = []
  }
  return merged
}

const filled = (...values: string[]) => values.some((v) => v.trim() !== '')

/* Drops entries the student added but left blank. */
export function pruneEmpty(record: StudentRecord): StudentRecord {
  return {
    ...record,
    internships: record.internships.filter((i) => filled(i.title, i.organisation)),
    higherStudies: record.higherStudies.filter((s) => filled(s.course, s.institution)),
    employment: record.employment.filter((j) => filled(j.designation, j.company)),
    activities: record.activities.filter((a) => filled(a.title)),
    exams: record.exams.filter((e) => e.exam !== 'OTHERS' || filled(e.otherName)),
    achievements: record.achievements.filter((a) => filled(a.title)),
  }
}

export function emptyActivity(kind: Activity['kind'] = 'Club / society'): Activity {
  const now = new Date()
  return { id: newId('act'), title: '', kind, organisation: '', since: now.toISOString().slice(0, 7), ongoing: true, description: '' }
}

export function emptyInternship(): Internship {
  return { id: newId('int'), organisation: '', title: '', startDate: '', endDate: '', mode: '', description: '' }
}

export function emptyHigherStudy(): HigherStudy {
  return { id: newId('hs'), course: '', institution: '', location: '', startYear: '', status: 'admitted', admittedVia: '' }
}

export function emptyEmployment(): Employment {
  return { id: newId('job'), designation: '', company: '', location: '', annualPackageLPA: '', startDate: '', endDate: '', current: true }
}

export function emptyExam(exam: ExamResult['exam'] = 'NET'): ExamResult {
  return { id: newId('exam'), exam, otherName: '', result: 'appeared', year: '', score: '' }
}

export function emptyAchievement(): Achievement {
  return { id: newId('ach'), title: '', area: 'Academics', level: 'College', date: '', description: '' }
}

/* =========================================================
   ACADEMIC CALENDAR
   ========================================================= */

/* DU sessions start in July: Oct 2026 belongs to the 2026–27 session. */
export function academicYearOf(date = new Date()) {
  return date.getMonth() >= 6 ? date.getFullYear() : date.getFullYear() - 1
}

const STUDY_YEARS = ['First Year', 'Second Year', 'Third Year', 'Fourth Year']

/* Best guess of the batch for a current student from "Second Year" etc. */
export function batchFromStudyYear(studyYear: string | undefined, date = new Date()) {
  const index = STUDY_YEARS.indexOf(studyYear ?? '')
  if (index < 0) return { admissionYear: '', graduationYear: '' }
  const admission = academicYearOf(date) - index
  return { admissionYear: String(admission), graduationYear: String(admission + 3) }
}

/* The final-year session has ended, so this profile should be marked as graduated. */
export function isGraduationDue(record: StudentRecord, date = new Date()) {
  const year = Number(record.graduationYear)
  return record.status === 'current' && Number.isFinite(year) && year > 0 && academicYearOf(date) >= year
}

export interface StudyYear {
  /* 1–4 while studying; 0 once graduated or the final session has ended. */
  index: number
  label: string
  short: string
}

const ORDINAL = ['', '1st', '2nd', '3rd', '4th']

export function studyYearOf(record: Pick<StudentRecord, 'status' | 'admissionYear' | 'graduationYear'>, date = new Date()): StudyYear {
  const graduated = { index: 0, label: 'Graduated', short: 'Graduated' }
  if (record.status === 'alumni') return graduated
  const admission = Number(record.admissionYear)
  const graduation = Number(record.graduationYear)
  const session = academicYearOf(date)
  if (graduation && session >= graduation) return graduated
  if (!admission) return { index: 0, label: 'Current student', short: 'Student' }
  const index = Math.min(4, Math.max(1, session - admission + 1))
  return { index, label: STUDY_YEARS[index - 1], short: `${ORDINAL[index]} year` }
}

/* =========================================================
   JOURNEY (year-by-year timeline)
   ========================================================= */

export interface JourneyItem {
  id: string
  kind: 'achievement' | 'internship' | 'exam' | 'activity' | 'higherStudy' | 'employment'
  title: string
  meta: string
  date: string
}

export interface JourneyBucket {
  key: string
  label: string
  items: JourneyItem[]
}

function bucketFor(date: string, record: StudentRecord) {
  const admission = Number(record.admissionYear)
  const graduation = Number(record.graduationYear)
  if (!date) return { key: 'z-undated', label: 'Undated' }
  const d = new Date(date.length === 4 ? `${date}-09-01` : date.length === 7 ? `${date}-01` : date)
  if (Number.isNaN(d.getTime())) return { key: 'z-undated', label: 'Undated' }
  const session = academicYearOf(d)
  if (!admission) return { key: `s-${session}`, label: `${session}–${String(session + 1).slice(2)}` }
  if (session < admission) return { key: 'a-before', label: 'Before college' }
  if (graduation && session >= graduation) return { key: 'y-after', label: 'After graduation' }
  const index = Math.min(4, session - admission + 1)
  return { key: `b-${index}`, label: `${STUDY_YEARS[index - 1]} (${session}–${String(session + 1).slice(2)})` }
}

export function journeyOf(record: StudentRecord): JourneyBucket[] {
  const items: JourneyItem[] = [
    ...record.achievements.map((a) => ({ id: a.id, kind: 'achievement' as const, title: a.title, meta: `${a.area} · ${a.level}`, date: a.date })),
    ...record.internships.map((i) => ({
      id: i.id,
      kind: 'internship' as const,
      title: i.title || 'Internship',
      meta: [i.organisation, durationLabel(i.startDate, i.endDate)].filter(Boolean).join(' · '),
      date: i.startDate,
    })),
    ...record.exams.map((e) => ({
      id: e.id,
      kind: 'exam' as const,
      title: `${e.exam === 'OTHERS' ? e.otherName || 'Exam' : e.exam} — ${e.result === 'qualified' ? 'cleared' : 'appeared'}`,
      meta: e.score,
      // Most entrance exams (JAM, GATE, CUET-PG) are held early in the year.
      date: e.year ? `${e.year}-03` : '',
    })),
    ...record.activities.map((a) => ({
      id: a.id,
      kind: 'activity' as const,
      title: a.title,
      meta: [a.kind, a.organisation, a.ongoing ? 'ongoing' : ''].filter(Boolean).join(' · '),
      date: a.since,
    })),
    ...record.higherStudies.map((s) => ({
      id: s.id,
      kind: 'higherStudy' as const,
      title: [s.course, s.institution].filter(Boolean).join(' · '),
      meta: s.admittedVia,
      date: s.startYear ? `${s.startYear}-08` : '',
    })),
    ...record.employment.map((j) => ({
      id: j.id,
      kind: 'employment' as const,
      title: [j.designation, j.company].filter(Boolean).join(' · '),
      meta: j.location,
      date: j.startDate,
    })),
  ].filter((item) => item.title.trim())

  const buckets = new Map<string, JourneyBucket>()
  for (const item of items) {
    const { key, label } = bucketFor(item.date, record)
    if (!buckets.has(key)) buckets.set(key, { key, label, items: [] })
    buckets.get(key)!.items.push(item)
  }
  return Array.from(buckets.values())
    .sort((a, b) => b.key.localeCompare(a.key))
    .map((bucket) => ({ ...bucket, items: bucket.items.sort((a, b) => b.date.localeCompare(a.date)) }))
}

/* =========================================================
   FRESHNESS
   ========================================================= */

export type Freshness = 'fresh' | 'due' | 'stale'

export function lastTouched(record: Pick<StudentRecord, 'updatedAt' | 'lastConfirmedAt'>) {
  return Math.max(record.updatedAt || 0, record.lastConfirmedAt || 0)
}

export function daysSince(ts: number, now = Date.now()) {
  return Math.max(0, Math.floor((now - ts) / DAY))
}

export function freshness(record: StudentRecord, now = Date.now()): Freshness {
  const days = daysSince(lastTouched(record), now)
  if (days < FRESH_DAYS) return 'fresh'
  if (days < STALE_DAYS) return 'due'
  return 'stale'
}

export function relativeDays(ts: number, now = Date.now()) {
  const days = daysSince(ts, now)
  if (days === 0) return 'today'
  if (days === 1) return 'yesterday'
  if (days < 31) return `${days} days ago`
  const months = Math.floor(days / 30.4)
  if (months < 12) return `${months} month${months > 1 ? 's' : ''} ago`
  const years = Math.floor(days / 365)
  return `${years} year${years > 1 ? 's' : ''} ago`
}

/* =========================================================
   OUTCOMES
   ========================================================= */

export type Outcome =
  | 'studying'
  | 'employed'
  | 'higher_studies'
  | 'preparing'
  | 'entrepreneur'
  | 'break'
  | 'other'
  | 'unknown'

export const OUTCOME_LABEL: Record<Outcome, string> = {
  studying: 'Studying at college',
  employed: 'Employed',
  higher_studies: 'Higher studies',
  preparing: 'Preparing for exams',
  entrepreneur: 'Entrepreneur',
  break: 'Taking a break',
  other: 'Other',
  unknown: 'Not reported',
}

export function currentJob(record: StudentRecord) {
  return record.employment.find((job) => job.current && (job.company || job.designation))
}

export function currentStudy(record: StudentRecord) {
  return record.higherStudies.find(
    (study) => (study.status === 'admitted' || study.status === 'pursuing') && (study.course || study.institution),
  )
}

export function primaryOutcome(record: StudentRecord): Outcome {
  if (record.status === 'current') return 'studying'
  if (currentJob(record)) return 'employed'
  if (currentStudy(record)) return 'higher_studies'
  if (record.activity) return record.activity
  return 'unknown'
}

function joinParts(...parts: string[]) {
  return parts.map((p) => p.trim()).filter(Boolean).join(' · ')
}

/* Short labels for "doing now": ongoing activities, internships, course or job. */
export function doingNow(record: StudentRecord): string[] {
  const today = new Date().toISOString().slice(0, 10)
  const labels = [
    ...(record.status === 'alumni'
      ? [currentJob(record), currentStudy(record)].filter(Boolean).map((x: any) => joinParts(x.designation ?? x.course, x.company ?? x.institution))
      : []),
    ...record.internships.filter((i) => i.endDate && i.endDate >= today).map((i) => joinParts('Interning', i.organisation)),
    ...record.activities.filter((a) => a.ongoing && a.title.trim()).map((a) => a.title.trim()),
  ]
  return Array.from(new Set(labels.filter(Boolean)))
}

/* One-line "what are they doing now", e.g. "M.Sc. Applied Mathematics · NIT Warangal". */
export function headline(record: StudentRecord) {
  const outcome = primaryOutcome(record)
  if (outcome === 'studying') return doingNow(record)[0] ?? joinParts(record.programme, studyYearOf(record).label)
  if (outcome === 'employed') {
    const job = currentJob(record)!
    return joinParts(job.designation, job.company)
  }
  if (outcome === 'higher_studies') {
    const study = currentStudy(record)!
    return joinParts(study.course, study.institution)
  }
  if (outcome === 'unknown') return OUTCOME_LABEL.unknown
  return record.activityNote.trim() || ACTIVITY_LABEL[outcome]
}

export function packageOf(job: Employment) {
  const value = parseFloat(job.annualPackageLPA.replace(/[^0-9.]/g, ''))
  return Number.isFinite(value) && value > 0 ? value : null
}

/* =========================================================
   COMPLETENESS
   ========================================================= */

export interface Completeness {
  percent: number
  missing: string[]
}

export function completeness(record: StudentRecord, documentCount?: number): Completeness {
  const checks: [boolean, string][] = [
    [Boolean(record.name.trim()), 'Student name'],
    [Boolean(record.rollNo.trim()), 'Examination roll number'],
    [Boolean(record.programme && record.admissionYear && record.graduationYear), 'Course and batch'],
    [Boolean(record.mobile.trim()), 'Mobile number'],
    [Boolean(record.personalEmail.trim()), 'Personal email (college email expires after graduation)'],
    [
      record.hadInternships === 'no' || (record.hadInternships === 'yes' && record.internships.length > 0),
      'Internships during graduation',
    ],
    record.status === 'alumni'
      ? [primaryOutcome(record) !== 'unknown', 'Current status (higher studies, job or other)']
      : [record.activities.length > 0 || record.achievements.length > 0, "What you're doing now (an activity or achievement)"],
    [Boolean(record.bio.trim()), 'A one-line bio'],
    [record.consent, 'Declaration & consent'],
  ]

  const hasClaims = record.internships.length + record.higherStudies.length + record.employment.length > 0
  if (documentCount !== undefined && hasClaims) {
    checks.push([documentCount > 0, 'Proof document (offer letter, admission letter or certificate)'])
  }

  const passed = checks.filter(([ok]) => ok).length
  return {
    percent: Math.round((passed / checks.length) * 100),
    missing: checks.filter(([ok]) => !ok).map(([, label]) => label),
  }
}

/* =========================================================
   VERIFICATION FINGERPRINTS
   ========================================================= */

function stableStringify(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`
  if (value && typeof value === 'object') {
    const entries = Object.entries(value as Record<string, unknown>)
      .filter(([, v]) => v !== undefined)
      .sort(([a], [b]) => a.localeCompare(b))
    return `{${entries.map(([k, v]) => `${JSON.stringify(k)}:${stableStringify(v)}`).join(',')}}`
  }
  return JSON.stringify(value)
}

/* FNV-1a over the entry's content: editing any field changes the fingerprint. */
export function fingerprint(item: object) {
  const text = stableStringify(item)
  let hash = 0x811c9dc5
  for (let i = 0; i < text.length; i++) {
    hash ^= text.charCodeAt(i)
    hash = Math.imul(hash, 0x01000193)
  }
  return (hash >>> 0).toString(16).padStart(8, '0')
}

export type VerificationMap = Map<string, RecordVerification>

export function verificationMap(list: RecordVerification[]): VerificationMap {
  return new Map(list.map((v) => [v.itemId, v]))
}

export function verificationFor<T extends { id: string }>(item: T, map: VerificationMap) {
  const v = map.get(item.id)
  return v && v.fingerprint === fingerprint(item) ? v : null
}

export interface VerifiableEntry {
  kind: 'internship' | 'higherStudy' | 'employment' | 'exam' | 'achievement'
  item: Internship | HigherStudy | Employment | ExamResult | Achievement
  label: string
}

export function examLabel(exam: ExamResult) {
  const name = exam.exam === 'OTHERS' ? exam.otherName.trim() || 'Other exam' : exam.exam
  return joinParts(`${name} ${exam.year}`.trim(), exam.result === 'qualified' ? 'Qualified' : 'Appeared', exam.score)
}

export function verifiableEntries(record: StudentRecord): VerifiableEntry[] {
  return [
    ...record.internships.map((item) => ({
      kind: 'internship' as const,
      item,
      label: joinParts(item.title, item.organisation),
    })),
    ...record.higherStudies.map((item) => ({
      kind: 'higherStudy' as const,
      item,
      label: joinParts(item.course, item.institution),
    })),
    ...record.employment.map((item) => ({
      kind: 'employment' as const,
      item,
      label: joinParts(item.designation, item.company),
    })),
    ...record.exams.map((item) => ({ kind: 'exam' as const, item, label: examLabel(item) })),
    ...record.achievements.map((item) => ({
      kind: 'achievement' as const,
      item,
      label: joinParts(item.title, item.level),
    })),
  ]
}

export const ENTRY_KIND_LABEL: Record<VerifiableEntry['kind'] | 'document', string> = {
  internship: 'Internship',
  higherStudy: 'Higher studies',
  employment: 'Job',
  exam: 'Exam',
  achievement: 'Achievement',
  document: 'Document',
}

/* =========================================================
   CHANGE SUMMARY (for the update history)
   ========================================================= */

const SECTIONS: [string, (keyof StudentRecord)[]][] = [
  ['Student details', ['name', 'rollNo', 'programme', 'admissionYear', 'graduationYear', 'status']],
  ['About', ['bio']],
  ['Doing now', ['activities']],
  ['Contact', ['collegeEmail', 'personalEmail', 'mobile']],
  ['Internships', ['hadInternships', 'internships']],
  ['Higher studies', ['higherStudies']],
  ['Job', ['employment']],
  ['Current activity', ['activity', 'activityNote']],
  ['Competitive exams', ['exams']],
  ['Achievements & interests', ['achievements', 'interests']],
  ['Privacy & consent', ['consent', 'directoryOptIn', 'shareContact']],
]

export function changedSections(prev: StudentRecord, next: StudentRecord) {
  return SECTIONS.filter(([, keys]) =>
    keys.some((key) => stableStringify(prev[key]) !== stableStringify(next[key])),
  ).map(([label]) => label)
}

/* =========================================================
   UPDATE DRIVES
   ========================================================= */

export function driveMatches(drive: UpdateDrive, record: StudentRecord) {
  if (drive.recordId) return drive.recordId === record.id
  if (drive.audience === 'alumni' && record.status !== 'alumni') return false
  if (drive.audience === 'current' && record.status !== 'current') return false
  if (drive.programme && drive.programme !== record.programme) return false
  if (drive.graduationYear && drive.graduationYear !== record.graduationYear) return false
  return true
}

export function driveResponded(drive: UpdateDrive, record: StudentRecord) {
  return lastTouched(record) >= drive.createdAt
}

export function driveProgress(drive: UpdateDrive, records: StudentRecord[]) {
  const targeted = records.filter((r) => driveMatches(drive, r))
  const pending = targeted.filter((r) => !driveResponded(drive, r))
  return { targeted, pending, responded: targeted.length - pending.length }
}

export function pendingDrivesFor(drives: UpdateDrive[], record: StudentRecord) {
  return drives
    .filter((d) => d.isActive && driveMatches(d, record) && !driveResponded(d, record))
    .sort((a, b) => b.createdAt - a.createdAt)
}

/* =========================================================
   BATCH OUTCOMES (NIRF "Graduation Outcomes" style)
   ========================================================= */

export function median(values: number[]) {
  if (values.length === 0) return null
  const sorted = [...values].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2
}

export interface BatchSummary {
  graduationYear: string
  total: number
  higherStudies: number
  employed: number
  otherReported: number
  unknown: number
  medianPackageLPA: number | null
  didInternship: number
  qualifiedExam: number
}

export function batchSummaries(records: StudentRecord[]): BatchSummary[] {
  const groups = new Map<string, StudentRecord[]>()
  for (const record of records) {
    if (record.status !== 'alumni') continue
    const key = record.graduationYear || 'Unknown'
    groups.set(key, [...(groups.get(key) ?? []), record])
  }

  return Array.from(groups.entries())
    .map(([graduationYear, list]) => {
      const outcomes = list.map(primaryOutcome)
      const packages = list
        .map(currentJob)
        .map((job) => (job ? packageOf(job) : null))
        .filter((v): v is number => v !== null)
      return {
        graduationYear,
        total: list.length,
        higherStudies: outcomes.filter((o) => o === 'higher_studies').length,
        employed: outcomes.filter((o) => o === 'employed').length,
        otherReported: outcomes.filter((o) => ['preparing', 'entrepreneur', 'break', 'other'].includes(o)).length,
        unknown: outcomes.filter((o) => o === 'unknown').length,
        medianPackageLPA: median(packages),
        didInternship: list.filter((r) => r.internships.length > 0).length,
        qualifiedExam: list.filter((r) => r.exams.some((e) => e.result === 'qualified')).length,
      }
    })
    .sort((a, b) => b.graduationYear.localeCompare(a.graduationYear))
}

/* Case-insensitive tally keeping the first spelling seen, e.g. top employers. */
export function topCounts(values: string[], limit = 6) {
  const counts = new Map<string, { label: string; count: number }>()
  for (const raw of values) {
    const label = raw.trim()
    if (!label) continue
    const key = label.toLowerCase()
    const entry = counts.get(key)
    if (entry) entry.count++
    else counts.set(key, { label, count: 1 })
  }
  return Array.from(counts.values())
    .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label))
    .slice(0, limit)
}

export function areasOf(record: StudentRecord): AchievementArea[] {
  return Array.from(new Set(record.achievements.map((a) => a.area)))
}

/* =========================================================
   DISPLAY HELPERS
   ========================================================= */

export function formatDate(value: string | number) {
  if (!value) return ''
  const date = typeof value === 'number' ? new Date(value) : new Date(`${value}T00:00:00`)
  if (Number.isNaN(date.getTime())) return String(value)
  return date.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
}

/* "2025-08" → "Aug 2025" */
export function monthLabel(value: string) {
  if (!/^\d{4}-\d{2}$/.test(value)) return value
  return new Date(`${value}-01T00:00:00`).toLocaleDateString('en-IN', { month: 'short', year: 'numeric' })
}

export function durationLabel(start: string, end: string) {
  if (!start || !end) return ''
  const days = Math.round((new Date(end).getTime() - new Date(start).getTime()) / DAY)
  if (!Number.isFinite(days) || days < 0) return ''
  if (days < 45) {
    const weeks = Math.max(1, Math.round(days / 7))
    return `${weeks} week${weeks > 1 ? 's' : ''}`
  }
  const months = Math.round(days / 30.4)
  return `${months} month${months > 1 ? 's' : ''}`
}

export function batchLabel(record: Pick<StudentRecord, 'admissionYear' | 'graduationYear'>) {
  if (record.admissionYear && record.graduationYear) return `${record.admissionYear}–${record.graduationYear}`
  return record.graduationYear || record.admissionYear || '—'
}

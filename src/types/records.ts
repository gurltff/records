import type { Role } from './index'

/*
 * One StudentRecord per student, kept from admission through alumni life.
 * The fields mirror the paper "Alumni Database form" so departments can
 * digitise existing forms one-to-one.
 */

export type RecordStatus =
  | 'current'
  | 'alumni'

export type RecordSource =
  | 'self'
  | 'teacher'
  | 'import'

export interface Internship {
  id: string
  organisation: string
  /* Role or project title, e.g. "Summer Internship Programme — Graph theory project" */
  title: string
  startDate: string
  endDate: string
  mode: '' | 'On-site' | 'Remote' | 'Hybrid'
  description: string
}

export type HigherStudyStatus =
  | 'admitted'
  | 'pursuing'
  | 'completed'
  | 'discontinued'

export interface HigherStudy {
  id: string
  /* e.g. "M.Sc. Applied Mathematics" */
  course: string
  institution: string
  location: string
  startYear: string
  status: HigherStudyStatus
  /* e.g. "IIT JAM 2026 · CCMN counselling" */
  admittedVia: string
}

export interface Employment {
  id: string
  designation: string
  company: string
  location: string
  /* Annual package in lakh per annum, kept as typed so "4.5" stays "4.5". */
  annualPackageLPA: string
  startDate: string
  endDate: string
  current: boolean
}

export type ExamName =
  | 'NET'
  | 'SET/SLET'
  | 'GATE'
  | 'CAT'
  | 'IAS/IPS'
  | 'STATE PSC'
  | 'UPSC'
  | 'JAM'
  | 'CUET-PG'
  | 'OTHERS'

export type ExamResultKind =
  | 'appeared'
  | 'qualified'

export interface ExamResult {
  id: string
  exam: ExamName
  /* Only used when exam is OTHERS. */
  otherName: string
  result: ExamResultKind
  year: string
  score: string
}

export type AchievementArea =
  | 'Academics'
  | 'Research'
  | 'Sports'
  | 'Cultural'
  | 'Leadership'
  | 'Entrepreneurship'
  | 'Social service'
  | 'Certification'
  | 'Competition'

export type AchievementLevel =
  | 'College'
  | 'University'
  | 'State'
  | 'National'
  | 'International'

export interface Achievement {
  id: string
  title: string
  area: AchievementArea
  level: AchievementLevel
  date: string
  description: string
}

export type CurrentActivity =
  | ''
  | 'preparing'
  | 'entrepreneur'
  | 'break'
  | 'other'

export interface StudentRecord {
  id: string

  /*
   * uid of the student/alumni account that owns this record.
   * null for records a teacher digitised or imported before the
   * student signed up — they are claimed automatically on sign-up
   * when the college or personal email matches.
   */
  ownerUid: string | null

  name: string
  rollNo: string
  programme: string
  admissionYear: string
  graduationYear: string
  status: RecordStatus

  collegeEmail: string
  /* College mailboxes expire after graduation, so this keeps us in touch. */
  personalEmail: string
  mobile: string

  hadInternships: '' | 'yes' | 'no'
  internships: Internship[]

  higherStudies: HigherStudy[]
  employment: Employment[]
  activity: CurrentActivity
  activityNote: string

  exams: ExamResult[]
  achievements: Achievement[]
  interests: string[]

  /* Replaces the signature on the paper form. */
  consent: boolean
  directoryOptIn: boolean
  shareContact: boolean

  source: RecordSource
  createdAt: number
  updatedAt: number
  /* Bumped by "Nothing changed — confirm" so unchanged records stay fresh. */
  lastConfirmedAt: number
}

export type DocumentKind =
  | 'offer_letter'
  | 'admission_letter'
  | 'internship_certificate'
  | 'exam_scorecard'
  | 'achievement_certificate'
  | 'marksheet'
  | 'other'

export interface RecordDocument {
  id: string
  recordId: string
  kind: DocumentKind
  name: string
  mimeType: string
  /* Compressed image or small PDF as a data URL (no paid Storage bucket needed). */
  dataUrl: string
  size: number
  /* Optional entry this document proves (internship, job, admission…). */
  linkedItemId: string
  uploadedBy: string
  uploadedByName: string
  uploadedAt: number
}

export type VerifiableKind =
  | 'internship'
  | 'higherStudy'
  | 'employment'
  | 'exam'
  | 'achievement'
  | 'document'

/*
 * Teacher verification of one entry. It stores a fingerprint of the
 * entry's content, so any later edit by the student automatically
 * makes the entry "unverified" again. Only teachers can write these.
 */
export interface RecordVerification {
  id: string
  recordId: string
  itemId: string
  itemKind: VerifiableKind
  fingerprint: string
  verifiedBy: string
  verifiedByName: string
  verifiedAt: number
}

export type RecordAction =
  | 'created'
  | 'updated'
  | 'confirmed'
  | 'claimed'
  | 'imported'
  | 'verified'
  | 'unverified'
  | 'document_added'
  | 'document_removed'
  | 'graduated'

/* Append-only history of every change to a record. */
export interface RecordUpdate {
  id: string
  recordId: string
  actorId: string
  actorName: string
  actorRole: Role
  action: RecordAction
  summary: string
  at: number
}

export type DriveAudience =
  | 'alumni'
  | 'current'
  | 'all'

/*
 * A request from the department asking a group of students/alumni
 * (or one record) to review and update their record by a due date.
 */
export interface UpdateDrive {
  id: string
  title: string
  message: string
  audience: DriveAudience
  /* '' means every programme. */
  programme: string
  /* '' means every batch. */
  graduationYear: string
  /* Set for a request sent to a single record. */
  recordId: string
  dueDate: string
  createdBy: string
  createdByName: string
  createdAt: number
  isActive: boolean
}

/*
 * Public, opt-in subset of a record shown in the alumni network.
 * Kept in its own collection so classmates never read phone numbers,
 * roll numbers or documents.
 */
export interface DirectoryProfile {
  id: string
  recordId: string
  name: string
  programme: string
  graduationYear: string
  status: RecordStatus
  headline: string
  areas: AchievementArea[]
  interests: string[]
  contactEmail: string
  updatedAt: number
}

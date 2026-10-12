import { describe, expect, it } from 'vitest'
import {
  academicYearOf,
  batchFromStudyYear,
  batchSummaries,
  changedSections,
  completeness,
  driveMatches,
  driveProgress,
  durationLabel,
  doingNow,
  emptyAchievement,
  emptyActivity,
  emptyEmployment,
  emptyHigherStudy,
  emptyInternship,
  emptyRecord,
  journeyOf,
  normaliseRecord,
  pruneEmpty,
  studyYearOf,
  fingerprint,
  freshness,
  headline,
  isGraduationDue,
  median,
  pendingDrivesFor,
  primaryOutcome,
  topCounts,
  verificationFor,
  verificationMap,
} from './records'
import type { ExamName, RecordVerification, UpdateDrive } from '../types'
import { emptyExam } from './records'

const emptyExamFor = (exam: ExamName) => emptyExam(exam)

const DAY = 24 * 60 * 60 * 1000
const NOW = new Date('2026-10-12T12:00:00').getTime()

function drive(patch: Partial<UpdateDrive> = {}): UpdateDrive {
  return {
    id: 'd1',
    title: 'Annual update',
    message: '',
    audience: 'alumni',
    programme: '',
    graduationYear: '',
    recordId: '',
    dueDate: '',
    createdBy: 't1',
    createdByName: 'Teacher',
    createdAt: NOW - 10 * DAY,
    isActive: true,
    ...patch,
  }
}

describe('academic calendar', () => {
  it('starts the session in July', () => {
    expect(academicYearOf(new Date('2026-10-12'))).toBe(2026)
    expect(academicYearOf(new Date('2026-03-01'))).toBe(2025)
  })

  it('derives a batch from the study year', () => {
    expect(batchFromStudyYear('Second Year', new Date('2026-10-12'))).toEqual({ admissionYear: '2025', graduationYear: '2028' })
    expect(batchFromStudyYear('First Year', new Date('2027-02-01'))).toEqual({ admissionYear: '2026', graduationYear: '2029' })
    expect(batchFromStudyYear(undefined)).toEqual({ admissionYear: '', graduationYear: '' })
  })

  it('flags current students whose final session has ended', () => {
    const r = emptyRecord({ status: 'current', graduationYear: '2026' })
    expect(isGraduationDue(r, new Date('2026-10-12'))).toBe(true)
    expect(isGraduationDue(r, new Date('2026-05-01'))).toBe(false)
    expect(isGraduationDue({ ...r, status: 'alumni' }, new Date('2026-10-12'))).toBe(false)
  })
})

describe('freshness', () => {
  it('uses the later of updated and confirmed', () => {
    const r = emptyRecord({ updatedAt: NOW - 400 * DAY, lastConfirmedAt: NOW - 400 * DAY })
    expect(freshness(r, NOW)).toBe('stale')
    expect(freshness({ ...r, lastConfirmedAt: NOW - 200 * DAY }, NOW)).toBe('due')
    expect(freshness({ ...r, lastConfirmedAt: NOW - 5 * DAY }, NOW)).toBe('fresh')
  })
})

describe('outcomes', () => {
  it('prefers a current job, then current higher studies', () => {
    const study = { ...emptyHigherStudy(), course: 'M.Sc. Applied Mathematics', institution: 'NIT Warangal', status: 'admitted' as const }
    const job = { ...emptyEmployment(), designation: 'Analyst', company: 'Northwind', current: true }
    const alum = emptyRecord({ status: 'alumni', higherStudies: [study] })

    expect(primaryOutcome(alum)).toBe('higher_studies')
    expect(headline(alum)).toBe('M.Sc. Applied Mathematics · NIT Warangal')
    expect(primaryOutcome({ ...alum, employment: [job] })).toBe('employed')
    expect(primaryOutcome({ ...alum, higherStudies: [{ ...study, status: 'completed' }] })).toBe('unknown')
    expect(primaryOutcome({ ...alum, higherStudies: [], activity: 'preparing' })).toBe('preparing')
    expect(primaryOutcome(emptyRecord({ status: 'current' }))).toBe('studying')
  })
})

describe('completeness', () => {
  it('lists what is missing and counts proof only when documents are known', () => {
    const r = emptyRecord({
      name: 'Test Student',
      bio: 'Maths student',
      rollNo: '1',
      programme: 'B.Sc. (Hons) Mathematics',
      admissionYear: '2023',
      graduationYear: '2026',
      mobile: '+91 90000 00000',
      personalEmail: 'x@example.com',
      hadInternships: 'yes',
      internships: [emptyInternship()],
      status: 'alumni',
      activity: 'preparing',
      consent: true,
    })
    expect(completeness(r)).toEqual({ percent: 100, missing: [] })
    const withDocs = completeness(r, 0)
    expect(withDocs.percent).toBe(90)
    expect(withDocs.missing[0]).toMatch(/Proof document/)
    expect(completeness({ ...r, hadInternships: 'yes', internships: [] }).missing).toContain('Internships during graduation')
  })
})

describe('verification fingerprints', () => {
  it('is stable across key order and changes when content changes', () => {
    expect(fingerprint({ a: 1, b: 'x' })).toBe(fingerprint({ b: 'x', a: 1 }))
    expect(fingerprint({ a: 1, b: 'x' })).not.toBe(fingerprint({ a: 1, b: 'y' }))
  })

  it('lapses when the verified entry is edited', () => {
    const item = { ...emptyInternship(), title: 'Summer internship' }
    const v: RecordVerification = {
      id: 'r__i',
      recordId: 'r',
      itemId: item.id,
      itemKind: 'internship',
      fingerprint: fingerprint(item),
      verifiedBy: 't',
      verifiedByName: 'T',
      verifiedAt: NOW,
    }
    const map = verificationMap([v])
    expect(verificationFor(item, map)).toBe(v)
    expect(verificationFor({ ...item, title: 'Edited' }, map)).toBeNull()
  })
})

describe('change summary', () => {
  it('names the sections that changed', () => {
    const a = emptyRecord({ name: 'A' })
    const b = { ...a, name: 'B', interests: ['Finance'] }
    expect(changedSections(a, b)).toEqual(['Student details', 'Achievements & interests'])
    expect(changedSections(a, { ...a })).toEqual([])
  })
})

describe('update drives', () => {
  const alum = emptyRecord({ id: 'r1', status: 'alumni', programme: 'B.Com (Hons)', graduationYear: '2024', updatedAt: NOW - 30 * DAY, lastConfirmedAt: NOW - 30 * DAY })
  const current = emptyRecord({ id: 'r2', status: 'current', programme: 'B.Com (Hons)', graduationYear: '2027', updatedAt: NOW, lastConfirmedAt: NOW })

  it('targets by audience, course, batch or a single record', () => {
    expect(driveMatches(drive(), alum)).toBe(true)
    expect(driveMatches(drive(), current)).toBe(false)
    expect(driveMatches(drive({ audience: 'all', graduationYear: '2027' }), current)).toBe(true)
    expect(driveMatches(drive({ programme: 'B.A. Programme' }), alum)).toBe(false)
    expect(driveMatches(drive({ recordId: 'r2', audience: 'alumni' }), current)).toBe(true)
  })

  it('counts a record as responded once updated or confirmed after the drive', () => {
    const progress = driveProgress(drive({ audience: 'all' }), [alum, current])
    expect(progress.targeted).toHaveLength(2)
    expect(progress.responded).toBe(1)
    expect(progress.pending.map((r) => r.id)).toEqual(['r1'])
    expect(pendingDrivesFor([drive(), drive({ id: 'closed', isActive: false })], alum).map((d) => d.id)).toEqual(['d1'])
  })
})

describe('batch outcomes', () => {
  it('summarises alumni per batch with a median package', () => {
    const job = (lpa: string) => ({ ...emptyEmployment(), company: 'X', designation: 'Y', annualPackageLPA: lpa })
    const records = [
      emptyRecord({ status: 'alumni', graduationYear: '2025', employment: [job('4')] }),
      emptyRecord({ status: 'alumni', graduationYear: '2025', employment: [job('6')] }),
      emptyRecord({ status: 'alumni', graduationYear: '2025', higherStudies: [{ ...emptyHigherStudy(), course: 'M.A.', status: 'pursuing' }] }),
      emptyRecord({ status: 'alumni', graduationYear: '2024' }),
      emptyRecord({ status: 'current', graduationYear: '2027' }),
    ]
    const [b2025, b2024] = batchSummaries(records)
    expect(b2025).toMatchObject({ graduationYear: '2025', total: 3, employed: 2, higherStudies: 1, unknown: 0, medianPackageLPA: 5 })
    expect(b2024).toMatchObject({ graduationYear: '2024', total: 1, unknown: 1, medianPackageLPA: null })
  })

  it('computes medians and case-insensitive tallies', () => {
    expect(median([])).toBeNull()
    expect(median([3, 1, 2])).toBe(2)
    expect(topCounts(['NIT Warangal', 'nit warangal ', 'IIT Delhi', ''])).toEqual([
      { label: 'NIT Warangal', count: 2 },
      { label: 'IIT Delhi', count: 1 },
    ])
  })
})

describe('durations', () => {
  it('reads like the certificate', () => {
    expect(durationLabel('2025-06-20', '2025-08-20')).toBe('2 months')
    expect(durationLabel('2025-06-01', '2025-06-15')).toBe('2 weeks')
    expect(durationLabel('', '2025-06-15')).toBe('')
  })
})

describe('year of study', () => {
  const at = new Date('2026-10-12')
  it('counts from the July session', () => {
    expect(studyYearOf(emptyRecord({ admissionYear: '2026', graduationYear: '2029' }), at)).toMatchObject({ index: 1, short: '1st year' })
    expect(studyYearOf(emptyRecord({ admissionYear: '2024', graduationYear: '2027' }), at)).toMatchObject({ index: 3, label: 'Third Year' })
  })
  it('treats a finished batch or a graduated profile as graduated', () => {
    expect(studyYearOf(emptyRecord({ admissionYear: '2023', graduationYear: '2026' }), at).label).toBe('Graduated')
    expect(studyYearOf(emptyRecord({ status: 'alumni', admissionYear: '2025', graduationYear: '2028' }), at).index).toBe(0)
  })
})

describe('journey', () => {
  it('groups entries by year of college, newest first', () => {
    const record = emptyRecord({
      admissionYear: '2023',
      graduationYear: '2026',
      achievements: [
        { ...emptyAchievement(), title: 'Quiz winner', date: '2023-11-02' },
        { ...emptyAchievement(), title: 'Paper', date: '2025-01-20' },
        { ...emptyAchievement(), title: 'Untitled date', date: '' },
      ],
      exams: [{ ...emptyExamFor('JAM'), result: 'qualified', year: '2026' }],
    })
    const buckets = journeyOf(record)
    expect(buckets.map((b) => b.label)).toEqual(['Undated', 'Third Year (2025–26)', 'Second Year (2024–25)', 'First Year (2023–24)'])
    expect(buckets[1].items[0].title).toBe('JAM — cleared')
    expect(buckets[2].items[0].title).toBe('Paper')
  })
})

describe('doing now', () => {
  it('lists ongoing activities, and the course or job of graduates', () => {
    const r = emptyRecord({
      activities: [
        { ...emptyActivity(), title: 'Preparing for CAT' },
        { ...emptyActivity(), title: 'Old club', ongoing: false },
      ],
    })
    expect(doingNow(r)).toEqual(['Preparing for CAT'])
    const grad = { ...r, status: 'alumni' as const, employment: [{ ...emptyEmployment(), designation: 'Analyst', company: 'Northwind' }] }
    expect(doingNow(grad)).toEqual(['Analyst · Northwind', 'Preparing for CAT'])
  })
})

describe('cleanup', () => {
  it('drops blank entries before saving', () => {
    const r = emptyRecord({
      achievements: [emptyAchievement(), { ...emptyAchievement(), title: 'Kept' }],
      activities: [emptyActivity()],
      internships: [emptyInternship()],
    })
    const clean = pruneEmpty(r)
    expect(clean.achievements.map((a) => a.title)).toEqual(['Kept'])
    expect(clean.activities).toEqual([])
    expect(clean.internships).toEqual([])
  })

  it('fills fields missing from profiles saved by older versions', () => {
    const old = { ...emptyRecord({ name: 'Old' }) } as any
    delete old.activities
    delete old.bio
    const fixed = normaliseRecord(old)
    expect(fixed.activities).toEqual([])
    expect(fixed.bio).toBe('')
    expect(fixed.name).toBe('Old')
  })
})

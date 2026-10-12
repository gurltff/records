import { EXAM_NAMES } from '../data/recordOptions'
import type { ExamName, ExamResult, Internship, StudentRecord } from '../types'
import {
  OUTCOME_LABEL,
  batchSummaries,
  currentJob,
  currentStudy,
  emptyEmployment,
  emptyExam,
  emptyHigherStudy,
  emptyInternship,
  emptyRecord,
  lastTouched,
  primaryOutcome,
} from './records'

/* =========================================================
   LOW-LEVEL CSV
   ========================================================= */

/* RFC 4180 parser: quoted fields, escaped quotes, CRLF/LF, optional BOM. */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = []
  let row: string[] = []
  let field = ''
  let quoted = false
  const src = text.replace(/^﻿/, '')

  for (let i = 0; i < src.length; i++) {
    const ch = src[i]
    if (quoted) {
      if (ch === '"' && src[i + 1] === '"') {
        field += '"'
        i++
      } else if (ch === '"') {
        quoted = false
      } else {
        field += ch
      }
    } else if (ch === '"') {
      quoted = true
    } else if (ch === ',') {
      row.push(field)
      field = ''
    } else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && src[i + 1] === '\n') i++
      row.push(field)
      rows.push(row)
      row = []
      field = ''
    } else {
      field += ch
    }
  }
  if (field !== '' || row.length > 0) {
    row.push(field)
    rows.push(row)
  }
  return rows.filter((r) => r.some((cell) => cell.trim() !== ''))
}

/*
 * Spreadsheet apps execute cells that start with = + - @ as formulas.
 * Student-entered text is neutralised with a leading apostrophe;
 * plain numbers and phone numbers like "+91 98…" are left alone.
 */
function neutraliseFormula(value: string) {
  if (/^[=@\t\r]/.test(value)) return `'${value}`
  if (/^[+-]/.test(value) && !/^[+-][\d\s().-]*$/.test(value)) return `'${value}`
  return value
}

export function toCsv(rows: (string | number | null | undefined)[][]) {
  return rows
    .map((row) =>
      row
        .map((cell) => {
          const text = neutraliseFormula(cell === null || cell === undefined ? '' : String(cell))
          return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text
        })
        .join(','),
    )
    .join('\r\n')
}

export function downloadCsv(filename: string, csv: string) {
  const blob = new Blob(['﻿', csv], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  window.setTimeout(() => URL.revokeObjectURL(url), 1000)
}

/* =========================================================
   RECORDS <-> CSV (columns follow the paper form)
   ========================================================= */

export const RECORD_COLUMNS = [
  'Student Name',
  'Examination Roll No.',
  'Course Name',
  'Admission Year',
  'Graduation Year',
  'Status',
  'College Email',
  'Personal Email',
  'Mobile No',
  'Internships Done (Y/N)',
  'Number of Internships',
  'Internship Details',
  'Higher Studies Course',
  'Higher Studies Institution',
  'Job Designation',
  'Company',
  'Job Location',
  'Annual Package (LPA)',
  'Exams Qualified',
  'Exams Appeared',
  'Achievements',
  'Current Outcome',
  'Last Updated',
] as const

function examText(exam: ExamResult) {
  const name = exam.exam === 'OTHERS' ? exam.otherName.trim() || 'Other exam' : exam.exam
  return [name, exam.year, exam.score ? `(${exam.score})` : ''].filter(Boolean).join(' ')
}

function internshipText(item: Internship) {
  return [item.title, item.organisation, item.startDate && item.endDate ? `${item.startDate} to ${item.endDate}` : '']
    .filter(Boolean)
    .join(', ')
}

export function recordsToCsv(records: StudentRecord[]) {
  const rows = records.map((r) => {
    const study = currentStudy(r) ?? r.higherStudies[0]
    const job = currentJob(r) ?? r.employment[0]
    return [
      r.name,
      r.rollNo,
      r.programme,
      r.admissionYear,
      r.graduationYear,
      r.status === 'alumni' ? 'Alumni' : 'Current',
      r.collegeEmail,
      r.personalEmail,
      r.mobile,
      r.hadInternships === 'yes' || r.internships.length ? 'Y' : r.hadInternships === 'no' ? 'N' : '',
      r.internships.length || '',
      r.internships.map(internshipText).join('; '),
      study?.course ?? '',
      study?.institution ?? '',
      job?.designation ?? '',
      job?.company ?? '',
      job?.location ?? '',
      job?.annualPackageLPA ?? '',
      r.exams.filter((e) => e.result === 'qualified').map(examText).join('; '),
      r.exams.filter((e) => e.result === 'appeared').map(examText).join('; '),
      r.achievements.map((a) => `${a.title} (${a.area}, ${a.level})`).join('; '),
      OUTCOME_LABEL[primaryOutcome(r)],
      new Date(lastTouched(r)).toISOString().slice(0, 10),
    ]
  })
  return toCsv([[...RECORD_COLUMNS], ...rows])
}

export function recordTemplateCsv() {
  return toCsv([
    [...RECORD_COLUMNS],
    [
      'Sample Student',
      '22000000001',
      'B.A. (Hons) Economics',
      '2022',
      '2025',
      'Alumni',
      '22000000001@college.example.edu',
      'sample.student@example.com',
      '+91 90000 00000',
      'Y',
      '1',
      'Research intern, Sample Policy Institute, 2024-05-15 to 2024-07-15',
      'M.A. Economics',
      'Sample University',
      '',
      '',
      '',
      '',
      'CUET-PG 2025',
      'NET 2025',
      '',
      '',
      '',
    ],
  ])
}

const normaliseHeader = (h: string) => h.toLowerCase().replace(/[^a-z0-9]/g, '')

function splitList(value: string) {
  return value
    .split(';')
    .map((part) => part.trim())
    .filter(Boolean)
}

function parseExams(value: string, result: ExamResult['result']): ExamResult[] {
  return splitList(value).map((text) => {
    const score = text.match(/\(([^)]*)\)/)?.[1]?.trim() ?? ''
    const withoutScore = text.replace(/\([^)]*\)/, '')
    const year = withoutScore.match(/\b(19|20)\d{2}\b/)?.[0] ?? ''
    const name = withoutScore.replace(year, '').replace(/[·,]/g, ' ').replace(/\s+/g, ' ').trim()
    const known = EXAM_NAMES.find((exam) => exam !== 'OTHERS' && name.toUpperCase().startsWith(exam))
    const exam: ExamName = known ?? 'OTHERS'
    return { ...emptyExam(exam), otherName: known ? '' : name, result, year, score }
  })
}

export interface CsvImportResult {
  records: StudentRecord[]
  errors: string[]
}

export function csvToRecords(text: string, now = Date.now()): CsvImportResult {
  const rows = parseCsv(text)
  if (rows.length < 2) return { records: [], errors: ['The file has no data rows.'] }

  const header = rows[0].map(normaliseHeader)
  const index = (column: (typeof RECORD_COLUMNS)[number]) => header.indexOf(normaliseHeader(column))
  if (index('Student Name') < 0) {
    return { records: [], errors: ['Missing the "Student Name" column. Download the template to see the expected headers.'] }
  }

  const records: StudentRecord[] = []
  const errors: string[] = []

  rows.slice(1).forEach((row, i) => {
    const get = (column: (typeof RECORD_COLUMNS)[number]) => {
      const at = index(column)
      return at >= 0 ? (row[at] ?? '').trim() : ''
    }
    const line = i + 2
    const name = get('Student Name')
    if (!name) {
      errors.push(`Row ${line}: skipped — no student name.`)
      return
    }

    const status = /alum/i.test(get('Status')) ? 'alumni' : /current/i.test(get('Status')) ? 'current' : null
    const graduationYear = get('Graduation Year')
    const inferredStatus =
      status ?? (graduationYear && Number(graduationYear) <= new Date(now).getFullYear() ? 'alumni' : 'current')

    const internships = splitList(get('Internship Details')).map((title) => ({ ...emptyInternship(), title }))
    const count = parseInt(get('Number of Internships'), 10)
    const yn = get('Internships Done (Y/N)').toUpperCase()

    const record = emptyRecord({
      name,
      rollNo: get('Examination Roll No.'),
      programme: get('Course Name'),
      admissionYear: get('Admission Year'),
      graduationYear,
      status: inferredStatus,
      collegeEmail: get('College Email').toLowerCase(),
      personalEmail: get('Personal Email').toLowerCase(),
      mobile: get('Mobile No'),
      hadInternships: yn.startsWith('Y') || internships.length || count > 0 ? 'yes' : yn.startsWith('N') ? 'no' : '',
      internships,
      exams: [...parseExams(get('Exams Qualified'), 'qualified'), ...parseExams(get('Exams Appeared'), 'appeared')],
      source: 'import',
      createdAt: now,
      updatedAt: now,
      lastConfirmedAt: now,
    })

    if (get('Higher Studies Course') || get('Higher Studies Institution')) {
      record.higherStudies = [
        { ...emptyHigherStudy(), course: get('Higher Studies Course'), institution: get('Higher Studies Institution'), status: 'pursuing' },
      ]
    }
    if (get('Job Designation') || get('Company')) {
      record.employment = [
        {
          ...emptyEmployment(),
          designation: get('Job Designation'),
          company: get('Company'),
          location: get('Job Location'),
          annualPackageLPA: get('Annual Package (LPA)').replace(/[^0-9.]/g, ''),
        },
      ]
    }
    if (!record.programme) errors.push(`Row ${line}: ${name} has no course name — imported anyway, please complete it.`)
    records.push(record)
  })

  return { records, errors }
}

/* =========================================================
   BATCH SUMMARY EXPORT
   ========================================================= */

export function batchSummaryCsv(records: StudentRecord[]) {
  const rows = batchSummaries(records).map((b) => [
    b.graduationYear,
    b.total,
    b.higherStudies,
    b.employed,
    b.otherReported,
    b.unknown,
    b.medianPackageLPA ?? '',
    b.didInternship,
    b.qualifiedExam,
  ])
  return toCsv([
    [
      'Graduation Year',
      'Graduates on record',
      'Opted for higher studies',
      'Placed / employed',
      'Other (preparing, entrepreneur, break)',
      'Outcome not reported',
      'Median package (LPA)',
      'Did an internship',
      'Qualified a competitive exam',
    ],
    ...rows,
  ])
}

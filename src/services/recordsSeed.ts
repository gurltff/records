// Demo-only student & alumni records. Every person, phone number and email
// here is fictional; organisations named "Northwind", "Contoso", "Fabrikam"
// etc. are placeholder companies.
import { put } from './store'
import { DIRECTORY, DOCUMENTS, DRIVES, RECORDS, UPDATES, VERIFICATIONS } from './recordsService'
import {
  areasOf,
  batchFromStudyYear,
  emptyAchievement,
  emptyEmployment,
  emptyExam,
  emptyHigherStudy,
  emptyInternship,
  emptyRecord,
  fingerprint,
  headline,
} from '../utils/records'
import type {
  Achievement,
  DirectoryProfile,
  Employment,
  HigherStudy,
  Internship,
  RecordDocument,
  RecordUpdate,
  RecordVerification,
  StudentRecord,
  UpdateDrive,
  UserProfile,
} from '../types'

export const RECORD_COLLECTIONS = [RECORDS, DOCUMENTS, UPDATES, VERIFICATIONS, DRIVES, DIRECTORY]

const DAY = 24 * 60 * 60 * 1000

/* Small deterministic PRNG so the demo looks the same on every setup. */
function mulberry32(seed: number) {
  return () => {
    seed |= 0
    seed = (seed + 0x6d2b79f5) | 0
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

let rand = mulberry32(2026)
const pick = <T,>(items: T[]) => items[Math.floor(rand() * items.length)]

const NAMES = [
  'Ishita Bansal', 'Meera Pillai', 'Riya Malhotra', 'Sneha Kulkarni', 'Tanvi Joshi',
  'Aditi Saxena', 'Pooja Chauhan', 'Shreya Ghosh', 'Nikita Arora', 'Diya Bhatt',
  'Simran Kaur', 'Anjali Verma', 'Muskan Gupta', 'Ritika Sen', 'Kritika Das',
  'Sakshi Mehra', 'Palak Jain', 'Vaishnavi Reddy', 'Harshita Tiwari', 'Aisha Khan',
  'Bhavya Singh', 'Zoya Ahmed',
]

const PROGRAMMES = [
  'B.Sc. (Hons) Mathematics',
  'B.Sc. (Hons) Physics',
  'B.Com (Hons)',
  'B.A. (Hons) Economics',
  'B.A. (Hons) English',
  'B.Sc. (Hons) Chemistry',
]

const STUDIES: [string, string, string, string][] = [
  ['M.Sc. Mathematics', 'IIT Delhi', 'New Delhi', 'IIT JAM'],
  ['M.Sc. Applied Mathematics', 'NIT Warangal', 'Warangal', 'IIT JAM · CCMN counselling'],
  ['M.A. Economics', 'Delhi School of Economics', 'Delhi', 'CUET-PG'],
  ['M.Sc. Physics', 'University of Hyderabad', 'Hyderabad', 'CUET-PG'],
  ['MBA', 'IIM Indore', 'Indore', 'CAT'],
  ['M.A. English', 'Jawaharlal Nehru University', 'New Delhi', 'CUET-PG'],
  ['M.Sc. Chemistry', 'IIT Bombay', 'Mumbai', 'IIT JAM'],
  ['M.Com', 'Delhi School of Economics', 'Delhi', 'CUET-PG'],
]

const JOBS: [string, string, string, string][] = [
  ['Data Analyst', 'Northwind Analytics', 'Gurugram', '6.5'],
  ['Associate Consultant', 'Contoso Consulting', 'Bengaluru', '8'],
  ['Audit Associate', 'Fabrikam & Co. LLP', 'New Delhi', '5.2'],
  ['Research Assistant', 'Tailspin Policy Lab', 'New Delhi', '4.8'],
  ['Content Writer', 'Litware Media', 'Noida', '4'],
  ['Financial Analyst', 'Woodgrove Bank', 'Mumbai', '7.2'],
  ['Mathematics Teacher', 'Adventure Works School', 'Delhi', '4.5'],
  ['Software Trainee', 'Proseware Technologies', 'Noida', '5.5'],
]

const INTERNSHIPS: [string, string][] = [
  ['Summer Internship Programme — research project', 'Centre for Research, Maitreyi College'],
  ['Data analysis intern', 'Tailspin Policy Lab'],
  ['Marketing intern', 'Litware Media'],
  ['Teaching volunteer', 'Community Learning Trust'],
  ['Finance intern', 'Woodgrove Bank'],
]

const ACHIEVEMENTS: [string, Achievement['area'], Achievement['level']][] = [
  ['Gold medal, inter-college mathematics olympiad', 'Academics', 'University'],
  ['Paper presented at a national conference', 'Research', 'National'],
  ['Captain, college basketball team', 'Sports', 'University'],
  ['First prize, inter-college street play', 'Cultural', 'University'],
  ['President, departmental society', 'Leadership', 'College'],
  ['NSS volunteer — 120 hours', 'Social service', 'College'],
  ['NPTEL certificate: Python for Data Science', 'Certification', 'National'],
  ['Finalist, national hackathon (team)', 'Competition', 'National'],
]

const INTERESTS = ['Data science', 'Finance', 'Teaching', 'Research', 'Civil services', 'Public policy', 'Writing & media']

function makeInternship(year: number): Internship {
  const [title, organisation] = pick(INTERNSHIPS)
  return {
    ...emptyInternship(),
    title,
    organisation,
    startDate: `${year}-06-20`,
    endDate: `${year}-08-20`,
    mode: pick(['On-site', 'Remote', 'Hybrid'] as const),
  }
}

function makeStudy(year: number, template = pick(STUDIES)): HigherStudy {
  const [course, institution, location, via] = template
  return { ...emptyHigherStudy(), course, institution, location, startYear: String(year), status: 'pursuing', admittedVia: `${via} ${year}` }
}

function makeJob(year: number, template = pick(JOBS)): Employment {
  const [designation, company, location, annualPackageLPA] = template
  return { ...emptyEmployment(), designation, company, location, annualPackageLPA, startDate: `${year}-07-15` }
}

function makeAchievement(year: number): Achievement {
  const [title, area, level] = pick(ACHIEVEMENTS)
  return { ...emptyAchievement(), title, area, level, date: `${year}-02-15` }
}

function email(name: string, suffix: string) {
  return `${name.toLowerCase().replace(/[^a-z]+/g, '.')}.${suffix}@example.com`
}

/* A readable placeholder "document" so the proof/verification flow can be demoed. */
function sampleDocument(title: string, lines: string[]) {
  const text = lines
    .map((line, i) => `<text x="40" y="${150 + i * 34}" font-size="20" fill="#333">${line}</text>`)
    .join('')
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" width="800" height="560" viewBox="0 0 800 560">` +
    `<rect width="800" height="560" fill="#fff" stroke="#111" stroke-width="6"/>` +
    `<text x="40" y="70" font-size="30" font-weight="700" font-family="sans-serif" fill="#111">${title}</text>` +
    `<text x="40" y="104" font-size="16" font-family="sans-serif" fill="#777">SAMPLE DOCUMENT — DEMO DATA ONLY</text>` +
    `<g font-family="sans-serif">${text}</g></svg>`
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`
}

interface SeedInput {
  students: UserProfile[]
  alumni: UserProfile[]
  teacher: UserProfile
  studyYear: string
  studentProgramme: string
}

export async function seedRecords({ students, alumni, teacher, studyYear, studentProgramme }: SeedInput) {
  rand = mulberry32(2026)
  const now = Date.now()
  const records: StudentRecord[] = []
  const updates: RecordUpdate[] = []
  const verifications: RecordVerification[] = []
  const documents: RecordDocument[] = []
  const directory: DirectoryProfile[] = []
  let roll = 1

  const nextRoll = (admission: number) => `${String(admission).slice(2)}99000${String(roll++).padStart(3, '0')}`

  const logEntry = (record: StudentRecord, action: RecordUpdate['action'], summary: string, at: number, actor?: UserProfile) => {
    updates.push({
      id: `demo_upd_${updates.length}`,
      recordId: record.id,
      actorId: actor?.uid ?? record.ownerUid ?? teacher.uid,
      actorName: actor?.name ?? (record.ownerUid ? record.name : teacher.name),
      actorRole: actor?.role ?? (record.ownerUid ? 'student' : 'teacher'),
      action,
      summary,
      at,
    })
  }

  const verify = (record: StudentRecord, item: { id: string }, itemKind: RecordVerification['itemKind'], at: number) => {
    verifications.push({
      id: `${record.id}__${item.id}`,
      recordId: record.id,
      itemId: item.id,
      itemKind,
      fingerprint: fingerprint(item),
      verifiedBy: teacher.uid,
      verifiedByName: teacher.name,
      verifiedAt: at,
    })
    logEntry(record, 'verified', `Verified ${itemKind === 'document' ? 'document' : 'entry'}`, at, teacher)
  }

  /* --- Linked current students (the attendance demo accounts) --- */
  const studentBatch = batchFromStudyYear(studyYear)
  students.forEach((student, i) => {
    const touched = now - (20 + i * 40) * DAY
    const record = emptyRecord({
      id: `rec_${student.uid}`,
      ownerUid: student.uid,
      name: student.name,
      rollNo: nextRoll(Number(studentBatch.admissionYear)),
      programme: studentProgramme,
      ...studentBatch,
      status: 'current',
      collegeEmail: student.email,
      mobile: `+91 90000 1000${i}`,
      hadInternships: i === 1 ? 'yes' : 'no',
      internships: i === 1 ? [makeInternship(Number(studentBatch.admissionYear) + 1)] : [],
      achievements: [makeAchievement(Number(studentBatch.admissionYear) + 1)],
      interests: [INTERESTS[i], INTERESTS[i + 2]],
      consent: true,
      directoryOptIn: i === 1,
      source: 'self',
      createdAt: touched - 30 * DAY,
      updatedAt: touched,
      lastConfirmedAt: touched,
    })
    records.push(record)
    logEntry(record, 'created', 'Record created', record.createdAt, student)
    logEntry(record, 'updated', 'Updated Achievements & interests', touched, student)
  })

  /* --- Linked alumni demo accounts --- */
  const [ananya, kavya] = alumni
  if (ananya) {
    const touched = now - 400 * DAY
    const internship: Internship = {
      ...emptyInternship(),
      title: 'Summer Internship Programme — graph theory in network routing',
      organisation: 'Centre for Research, Maitreyi College',
      startDate: '2024-06-20',
      endDate: '2024-08-20',
      mode: 'On-site',
    }
    const study = makeStudy(2025, STUDIES[0])
    study.status = 'admitted'
    const record = emptyRecord({
      id: `rec_${ananya.uid}`,
      ownerUid: ananya.uid,
      name: ananya.name,
      rollNo: nextRoll(2022),
      programme: 'B.Sc. (Hons) Mathematics',
      admissionYear: '2022',
      graduationYear: '2025',
      status: 'alumni',
      collegeEmail: 'ananya.iyer.demo@college.example.edu',
      personalEmail: ananya.email,
      mobile: '+91 90000 20001',
      hadInternships: 'yes',
      internships: [internship],
      higherStudies: [study],
      exams: [
        { ...emptyExam('JAM'), result: 'qualified', year: '2025', score: 'AIR 812' },
        { ...emptyExam('CUET-PG'), result: 'appeared', year: '2025' },
      ],
      achievements: [{ ...emptyAchievement(), title: 'Paper presented at a national conference', area: 'Research', level: 'National', date: '2025-01-20' }],
      interests: ['Research', 'Teaching'],
      consent: true,
      directoryOptIn: true,
      shareContact: true,
      createdAt: touched - 200 * DAY,
      updatedAt: touched,
      lastConfirmedAt: touched,
    })
    records.push(record)
    logEntry(record, 'created', 'Record created', record.createdAt, ananya)
    logEntry(record, 'updated', 'Updated Higher studies, Competitive exams', touched, ananya)

    const certificate: RecordDocument = {
      id: 'demo_doc_ananya_internship',
      recordId: record.id,
      kind: 'internship_certificate',
      name: 'Internship certificate (sample).svg',
      mimeType: 'image/svg+xml',
      dataUrl: sampleDocument('Certificate of Appreciation', [
        'Summer Internship Programme 2024',
        `Awarded to ${ananya.name}, B.Sc. (Hons) Mathematics`,
        'Project: Graph theory in network routing',
        '20 June 2024 – 20 August 2024',
      ]),
      size: 1600,
      linkedItemId: internship.id,
      uploadedBy: ananya.uid,
      uploadedByName: ananya.name,
      uploadedAt: touched - 150 * DAY,
    }
    const allotment: RecordDocument = {
      ...certificate,
      id: 'demo_doc_ananya_admission',
      kind: 'admission_letter',
      name: 'Seat allotment letter (sample).svg',
      dataUrl: sampleDocument('Provisional Seat Allotment', [
        `Candidate: ${ananya.name}`,
        `Programme: ${study.course}`,
        `Institute: ${study.institution}`,
        'Allotted through JAM 2025 counselling',
      ]),
      linkedItemId: study.id,
      uploadedAt: touched,
    }
    documents.push(certificate, allotment)
    logEntry(record, 'document_added', `Uploaded ${certificate.name}`, certificate.uploadedAt, ananya)
    logEntry(record, 'document_added', `Uploaded ${allotment.name}`, allotment.uploadedAt, ananya)
    verify(record, internship, 'internship', touched - 140 * DAY)
    verify(record, certificate, 'document', touched - 140 * DAY)
  }

  if (kavya) {
    const touched = now - 60 * DAY
    const job = makeJob(2024, JOBS[2])
    const record = emptyRecord({
      id: `rec_${kavya.uid}`,
      ownerUid: kavya.uid,
      name: kavya.name,
      rollNo: nextRoll(2021),
      programme: 'B.Com (Hons)',
      admissionYear: '2021',
      graduationYear: '2024',
      status: 'alumni',
      collegeEmail: 'kavya.menon.demo@college.example.edu',
      personalEmail: kavya.email,
      mobile: '+91 90000 20002',
      hadInternships: 'yes',
      internships: [{ ...makeInternship(2023), title: 'Finance intern', organisation: 'Woodgrove Bank' }],
      employment: [job],
      exams: [{ ...emptyExam('CAT'), result: 'appeared', year: '2025', score: '88 percentile' }],
      achievements: [{ ...emptyAchievement(), title: 'President, Commerce society', area: 'Leadership', level: 'College', date: '2023-04-01' }],
      interests: ['Finance', 'Consulting'],
      consent: true,
      directoryOptIn: true,
      shareContact: false,
      createdAt: touched - 300 * DAY,
      updatedAt: touched,
      lastConfirmedAt: touched,
    })
    records.push(record)
    logEntry(record, 'created', 'Record created', record.createdAt, kavya)
    logEntry(record, 'updated', 'Updated Job', touched, kavya)
    verify(record, job, 'employment', touched + 2 * DAY)
  }

  /* --- Digitised paper forms (not yet claimed by a student account) --- */
  NAMES.forEach((name, i) => {
    const programme = PROGRAMMES[i % PROGRAMMES.length]
    // Four records from the 2026 batch are still "current" so the graduate-batch flow can be shown.
    const isUngraduated = i < 4
    const graduation = isUngraduated ? 2026 : 2022 + (i % 5)
    const admission = graduation - 3
    const touchedDaysAgo = isUngraduated ? 150 + i * 5 : Math.floor(rand() * 620) + 5
    const touched = now - touchedDaysAgo * DAY
    const createdAt = Math.min(touched, now - 420 * DAY)

    const record = emptyRecord({
      id: `demo_rec_${i}`,
      ownerUid: null,
      name,
      rollNo: nextRoll(admission),
      programme,
      admissionYear: String(admission),
      graduationYear: String(graduation),
      status: isUngraduated ? 'current' : 'alumni',
      collegeEmail: `${name.split(' ')[0].toLowerCase()}.${admission}@college.example.edu`,
      personalEmail: rand() > 0.2 ? email(name, String(graduation)) : '',
      mobile: rand() > 0.15 ? `+91 90000 3${String(i).padStart(4, '0')}` : '',
      consent: true,
      source: i % 3 === 0 ? 'import' : 'teacher',
      createdAt,
      updatedAt: touched,
      lastConfirmedAt: touched,
    })

    if (rand() > 0.35) {
      record.hadInternships = 'yes'
      record.internships = [makeInternship(admission + 1)]
      if (rand() > 0.7) record.internships.push(makeInternship(admission + 2))
    } else {
      record.hadInternships = rand() > 0.3 ? 'no' : ''
    }

    if (rand() > 0.4) record.achievements.push(makeAchievement(admission + 1))
    if (rand() > 0.7) record.achievements.push(makeAchievement(admission + 2))
    record.interests = [pick(INTERESTS)]

    if (!isUngraduated) {
      const dice = rand()
      if (dice < 0.4) {
        record.higherStudies = [makeStudy(graduation)]
        const via = record.higherStudies[0].admittedVia
        const exam = (['JAM', 'CUET-PG', 'CAT'] as const).find((e) => via.includes(e))
        if (exam) record.exams.push({ ...emptyExam(exam), result: 'qualified', year: String(graduation) })
      } else if (dice < 0.78) {
        record.employment = [makeJob(graduation)]
      } else if (dice < 0.88) {
        record.activity = 'preparing'
        record.activityNote = 'Preparing for UPSC civil services'
        record.exams.push({ ...emptyExam('UPSC'), result: 'appeared', year: String(graduation + 1) })
      } else if (dice < 0.93) {
        record.activity = 'entrepreneur'
        record.activityNote = 'Runs an online tutoring start-up'
      }
      if (rand() > 0.75) record.exams.push({ ...emptyExam('NET'), result: rand() > 0.5 ? 'qualified' : 'appeared', year: String(graduation + 1) })
    }

    records.push(record)
    logEntry(record, 'imported', record.source === 'import' ? 'Imported from alumni spreadsheet' : 'Digitised from paper Alumni Database form', createdAt)
    if (touched > createdAt) logEntry(record, 'updated', 'Updated Job, Higher studies', touched)

    // Teachers have already checked some entries against the paper files.
    const first = record.employment[0] ?? record.higherStudies[0]
    if (first && rand() > 0.5) verify(record, first, record.employment[0] ? 'employment' : 'higherStudy', touched + DAY)
  })

  /* --- Update drives --- */
  const drives: UpdateDrive[] = [
    {
      id: 'demo_drive_2026',
      title: 'Annual alumni update 2026',
      message:
        'Please review your record — current course or job, exams cleared and any offer/admission letters. It takes two minutes and feeds the college NIRF & NAAC reports.',
      audience: 'alumni',
      programme: '',
      graduationYear: '',
      recordId: '',
      dueDate: new Date(now + 21 * DAY).toISOString().slice(0, 10),
      createdBy: teacher.uid,
      createdByName: teacher.name,
      createdAt: now - 30 * DAY,
      isActive: true,
    },
    {
      id: 'demo_drive_2025',
      title: 'Annual alumni update 2025',
      message: 'Yearly check-in for all alumni.',
      audience: 'alumni',
      programme: '',
      graduationYear: '',
      recordId: '',
      dueDate: new Date(now - 340 * DAY).toISOString().slice(0, 10),
      createdBy: teacher.uid,
      createdByName: teacher.name,
      createdAt: now - 395 * DAY,
      isActive: false,
    },
  ]

  /* --- Opt-in alumni network cards --- */
  for (const record of records) {
    if (!record.ownerUid || !record.consent || !record.directoryOptIn) continue
    directory.push({
      id: record.ownerUid,
      recordId: record.id,
      name: record.name,
      programme: record.programme,
      graduationYear: record.graduationYear,
      status: record.status,
      headline: headline(record),
      areas: areasOf(record),
      interests: record.interests,
      contactEmail: record.shareContact ? record.personalEmail || record.collegeEmail : '',
      updatedAt: record.updatedAt,
    })
  }

  for (const item of records) await put(RECORDS, item)
  for (const item of updates) await put(UPDATES, item)
  for (const item of verifications) await put(VERIFICATIONS, item)
  for (const item of documents) await put(DOCUMENTS, item)
  for (const item of drives) await put(DRIVES, item)
  for (const item of directory) await put(DIRECTORY, item)
}

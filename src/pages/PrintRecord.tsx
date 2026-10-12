import { useEffect, useState, type ReactNode } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { EXAM_NAMES } from '../data/recordOptions'
import { getRecord, listDocuments, listVerifications } from '../services/recordsService'
import type { ExamName, RecordDocument, RecordVerification, StudentRecord } from '../types'
import {
  batchLabel,
  currentJob,
  currentStudy,
  durationLabel,
  formatDate,
  lastTouched,
  verifiableEntries,
  verificationFor,
  verificationMap,
} from '../utils/records'

function FormRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <tr>
      <th className="border border-ink px-3 py-2 text-left align-top font-semibold w-[45%]">{label}</th>
      <td className="border border-ink px-3 py-2 align-top">{children || <span className="text-ink/40">—</span>}</td>
    </tr>
  )
}

function ExamTicks({ record, result }: { record: StudentRecord; result: 'qualified' | 'appeared' }) {
  const ticked = (exam: ExamName) => record.exams.some((e) => e.exam === exam && e.result === result)
  const others = record.exams.filter((e) => e.exam === 'OTHERS' && e.result === result).map((e) => e.otherName).filter(Boolean)
  return (
    <div className="grid grid-cols-2 sm:grid-cols-5 gap-x-4 gap-y-2 text-sm">
      {EXAM_NAMES.map((exam) => (
        <span key={exam} className="whitespace-nowrap">
          <span aria-hidden="true" className="inline-block w-4 h-4 border border-ink mr-1.5 align-[-2px] text-center leading-[14px] text-xs font-bold">
            {ticked(exam) ? '✓' : ''}
          </span>
          {exam === 'OTHERS' && others.length ? `OTHERS (${others.join(', ')})` : exam}
          <span className="sr-only">{ticked(exam) ? ' — yes' : ' — no'}</span>
        </span>
      ))}
    </div>
  )
}

export default function PrintRecord() {
  const { id = '' } = useParams()
  const navigate = useNavigate()
  const { user } = useAuth()
  const [record, setRecord] = useState<StudentRecord | null | undefined>(undefined)
  const [verifications, setVerifications] = useState<RecordVerification[]>([])
  const [documents, setDocuments] = useState<RecordDocument[]>([])

  useEffect(() => {
    Promise.all([getRecord(id), listVerifications(id), listDocuments(id)])
      .then(([r, v, d]) => {
        setRecord(r)
        setVerifications(v)
        setDocuments(d)
      })
      .catch(() => setRecord(null))
  }, [id])

  const allowed = record && user && (user.role === 'teacher' || record.ownerUid === user.uid)

  if (record === undefined) return <div className="page-shell"><div className="card">Loading…</div></div>
  if (!record || !allowed) {
    return (
      <div className="page-shell">
        <div className="card">This record is not available.</div>
      </div>
    )
  }

  const vMap = verificationMap(verifications)
  const entries = verifiableEntries(record)
  const verified = entries.filter((e) => verificationFor(e.item, vMap))
  const study = currentStudy(record) ?? record.higherStudies[0]
  const job = currentJob(record) ?? record.employment[0]

  return (
    <div className="page-shell max-w-4xl">
      <div className="no-print flex flex-wrap justify-between gap-2 mb-4">
        <button type="button" className="btn-outline" onClick={() => navigate(-1)}>
          ← Back
        </button>
        <button type="button" className="btn-primary" onClick={() => window.print()}>
          🖨 Print / save as PDF
        </button>
      </div>

      <article className="print-sheet border-2 border-ink rounded-3xl p-6 sm:p-10">
        <header className="text-center mb-6">
          <p className="text-2xl font-black tracking-wide">MAITREYI COLLEGE</p>
          <p className="text-sm">(University of Delhi)</p>
          <h1 className="text-xl font-extrabold mt-4 underline">Alumni Database Form</h1>
        </header>

        <p className="text-sm mb-2">
          <b>Course Name:</b> {record.programme}
        </p>
        <p className="text-sm leading-6 mb-5">
          Dear alumni, graduation is a milestone that marks the end of one great experience and the beginning of a new
          phase in your life. We always encourage you to stay connected with the college and share your knowledge and
          passion with the graduates of tomorrow.
        </p>

        <table className="w-full border-collapse text-sm mb-5">
          <tbody>
            <FormRow label="Student Name">{record.name}</FormRow>
            <FormRow label="Examination Roll No.">{record.rollNo}</FormRow>
            <FormRow label="Course Name">{record.programme}</FormRow>
            <FormRow label="Graduation passing year (Batch)">{batchLabel(record)}</FormRow>
            <FormRow label="Email Id">
              {[record.collegeEmail, record.personalEmail].filter(Boolean).join(' · ')}
            </FormRow>
            <FormRow label="Mobile No">{record.mobile}</FormRow>
            <FormRow label="Internships done during graduation year (Y/N)">
              {record.hadInternships === 'yes' || record.internships.length ? 'Yes' : record.hadInternships === 'no' ? 'No' : ''}
            </FormRow>
            <FormRow label="If yes, please specify number of internships">{record.internships.length || ''}</FormRow>
            <FormRow label="Details of internship (when, where, duration)">
              {record.internships.length > 0 && (
                <ul className="space-y-1">
                  {record.internships.map((i) => (
                    <li key={i.id}>
                      {[i.title, i.organisation].filter(Boolean).join(', ')}
                      {i.startDate && i.endDate ? ` — ${formatDate(i.startDate)} to ${formatDate(i.endDate)} (${durationLabel(i.startDate, i.endDate)})` : ''}
                    </li>
                  ))}
                </ul>
              )}
            </FormRow>
            <tr>
              <th colSpan={2} className="border border-ink px-3 py-2 text-left font-extrabold bg-ink/5">
                Current Status:
              </th>
            </tr>
            <FormRow label="If pursuing higher studies (M.A./M.Com/M.Sc./Ph.D/MBA/B.Ed/Other), specify the course and university">
              {study ? [study.course, study.institution].filter(Boolean).join(', ') : ''}
            </FormRow>
            <FormRow label="If doing job, specify your designation, company name, location">
              {job ? [job.designation, job.company, job.location].filter(Boolean).join(', ') : ''}
            </FormRow>
            <FormRow label="Annual package">{job?.annualPackageLPA ? `₹${job.annualPackageLPA} lakh per annum` : ''}</FormRow>
          </tbody>
        </table>

        <p className="text-sm font-bold mb-2">Have you passed any of the following competitive exams?</p>
        <ExamTicks record={record} result="qualified" />
        <p className="text-sm font-bold mt-5 mb-2">Have you appeared in any of the following competitive exams?</p>
        <ExamTicks record={record} result="appeared" />

        {record.achievements.length > 0 && (
          <>
            <p className="text-sm font-bold mt-5 mb-2">Achievements</p>
            <ul className="text-sm list-disc pl-5 space-y-0.5">
              {record.achievements.map((a) => (
                <li key={a.id}>
                  {a.title} — {a.area}, {a.level}
                  {a.date ? ` (${formatDate(a.date)})` : ''}
                </li>
              ))}
            </ul>
          </>
        )}

        <div className="grid sm:grid-cols-2 gap-6 mt-8 text-sm">
          <div>
            <p className="font-bold">Student declaration</p>
            <p className="mt-1">
              {record.consent
                ? `Confirmed ${record.source === 'self' ? 'digitally by the student' : 'on the signed paper form'}. Last updated ${formatDate(lastTouched(record))}.`
                : 'Not yet confirmed by the student.'}
            </p>
          </div>
          <div>
            <p className="font-bold">Department verification</p>
            <p className="mt-1">
              {verified.length} of {entries.length} entries verified
              {verified.length > 0 ? ` by ${Array.from(new Set(verified.map((e) => verificationFor(e.item, vMap)!.verifiedByName))).join(', ')}` : ''}.
              {' '}
              {documents.length} supporting document{documents.length === 1 ? '' : 's'} on file.
            </p>
          </div>
        </div>

        <p className="text-[11px] text-ink/50 mt-8 border-t border-ink/20 pt-3">
          Record {record.id} · generated {formatDate(Date.now())} from Maitreyi Smart Campus
        </p>
      </article>
    </div>
  )
}

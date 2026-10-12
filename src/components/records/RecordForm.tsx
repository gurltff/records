import { useState, type ReactNode } from 'react'
import {
  ACHIEVEMENT_AREAS,
  ACHIEVEMENT_LEVELS,
  ACTIVITY_LABEL,
  EXAM_NAMES,
  HIGHER_STUDY_STATUS_LABEL,
  INTEREST_SUGGESTIONS,
  RECORD_PROGRAMMES,
  graduationYearOptions,
} from '../../data/recordOptions'
import type {
  Achievement,
  CurrentActivity,
  Employment,
  ExamResult,
  HigherStudy,
  Internship,
  StudentRecord,
} from '../../types'
import {
  durationLabel,
  emptyAchievement,
  emptyEmployment,
  emptyExam,
  emptyHigherStudy,
  emptyInternship,
  verificationFor,
  type VerificationMap,
} from '../../utils/records'
import { EntryCard, Field, SectionCard, VerifiedBadge } from './RecordBits'

const YEARS = graduationYearOptions()

function patchItem<T extends { id: string }>(list: T[], id: string, patch: Partial<T>): T[] {
  return list.map((item) => (item.id === id ? { ...item, ...patch } : item))
}

function YearSelect({ value, onChange, placeholder = 'Select year' }: { value: string; onChange: (v: string) => void; placeholder?: string }) {
  return (
    <select className="input" value={value} onChange={(e) => onChange(e.target.value)}>
      <option value="">{placeholder}</option>
      {YEARS.map((y) => (
        <option key={y} value={y}>{y}</option>
      ))}
    </select>
  )
}

function ProgrammeInput({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const known = RECORD_PROGRAMMES.includes(value)
  const [other, setOther] = useState(Boolean(value) && !known)
  return (
    <div className="space-y-2">
      <select
        className="input"
        value={other ? '__other' : value}
        onChange={(e) => {
          if (e.target.value === '__other') {
            setOther(true)
            onChange('')
          } else {
            setOther(false)
            onChange(e.target.value)
          }
        }}
      >
        <option value="">Select course</option>
        {RECORD_PROGRAMMES.map((p) => (
          <option key={p} value={p}>{p}</option>
        ))}
        <option value="__other">Other (type it)</option>
      </select>
      {other && (
        <input className="input" placeholder="e.g. B.Sc. (Hons) Statistics" value={value} onChange={(e) => onChange(e.target.value)} />
      )}
    </div>
  )
}

function Choice<T extends string>({
  value,
  options,
  onChange,
  name,
}: {
  value: T
  options: { value: T; label: string }[]
  onChange: (v: T) => void
  name: string
}) {
  return (
    <div className="flex flex-wrap gap-2" role="radiogroup" aria-label={name}>
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          role="radio"
          aria-checked={value === option.value}
          className={`pill-tab ${value === option.value ? 'pill-tab-active' : 'pill-tab-idle'}`}
          onClick={() => onChange(option.value)}
        >
          {option.label}
        </button>
      ))}
    </div>
  )
}

function EntryStatus({ item, verifications }: { item: { id: string }; verifications?: VerificationMap }) {
  if (!verifications) return null
  const verified = verificationFor(item, verifications)
  if (!verified && verifications.has(item.id)) {
    return <span className="badge border-dashed whitespace-nowrap">Edited · needs re-verification</span>
  }
  return <VerifiedBadge verification={verified} />
}

function RemoveButton({ onClick, label }: { onClick: () => void; label: string }) {
  return (
    <button type="button" className="text-xs font-semibold underline" onClick={onClick} aria-label={label}>
      Remove
    </button>
  )
}

function AddButton({ onClick, children }: { onClick: () => void; children: ReactNode }) {
  return (
    <button type="button" className="btn-outline text-sm" onClick={onClick}>
      + {children}
    </button>
  )
}

export default function RecordForm({
  value,
  onChange,
  mode,
  verifications,
}: {
  value: StudentRecord
  onChange: (next: StudentRecord) => void
  mode: 'self' | 'teacher'
  verifications?: VerificationMap
}) {
  const set = (patch: Partial<StudentRecord>) => onChange({ ...value, ...patch })
  const [interestDraft, setInterestDraft] = useState('')
  const isAlumni = value.status === 'alumni'

  function addInterest(raw: string) {
    const interest = raw.trim()
    if (!interest || value.interests.some((i) => i.toLowerCase() === interest.toLowerCase())) return
    set({ interests: [...value.interests, interest] })
    setInterestDraft('')
  }

  const setInternship = (id: string, patch: Partial<Internship>) => set({ internships: patchItem(value.internships, id, patch) })
  const setStudy = (id: string, patch: Partial<HigherStudy>) => set({ higherStudies: patchItem(value.higherStudies, id, patch) })
  const setJob = (id: string, patch: Partial<Employment>) => set({ employment: patchItem(value.employment, id, patch) })
  const setExam = (id: string, patch: Partial<ExamResult>) => set({ exams: patchItem(value.exams, id, patch) })
  const setAchievement = (id: string, patch: Partial<Achievement>) => set({ achievements: patchItem(value.achievements, id, patch) })

  return (
    <div className="space-y-5">
      {/* 1. STUDENT DETAILS */}
      <SectionCard title="Student details" subtitle="Same fields as the paper Alumni Database form.">
        <div className="grid sm:grid-cols-2 gap-4">
          <Field label="Student name">
            <input className="input" required value={value.name} onChange={(e) => set({ name: e.target.value })} />
          </Field>
          <Field label="Examination roll no.">
            <input className="input" inputMode="numeric" value={value.rollNo} onChange={(e) => set({ rollNo: e.target.value })} />
          </Field>
          <Field label="Course name">
            <ProgrammeInput value={value.programme} onChange={(programme) => set({ programme })} />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Admission year">
              <YearSelect value={value.admissionYear} onChange={(admissionYear) => set({ admissionYear })} />
            </Field>
            <Field label="Graduation year (batch)">
              <YearSelect value={value.graduationYear} onChange={(graduationYear) => set({ graduationYear })} />
            </Field>
          </div>
          <Field label="Status" className="sm:col-span-2" group>
            <Choice
              name="Status"
              value={value.status}
              onChange={(status) => set({ status })}
              options={[
                { value: 'current', label: 'Current student' },
                { value: 'alumni', label: 'Alumni (graduated)' },
              ]}
            />
          </Field>
          <Field label="College email">
            <input className="input" type="email" value={value.collegeEmail} onChange={(e) => set({ collegeEmail: e.target.value })} />
          </Field>
          <Field label="Personal email" hint="College mailboxes stop working after graduation — this keeps the department in touch.">
            <input className="input" type="email" value={value.personalEmail} onChange={(e) => set({ personalEmail: e.target.value })} />
          </Field>
          <Field label="Mobile no.">
            <input className="input" type="tel" value={value.mobile} onChange={(e) => set({ mobile: e.target.value })} />
          </Field>
        </div>
      </SectionCard>

      {/* 2. INTERNSHIPS */}
      <SectionCard
        title="Internships during graduation"
        subtitle="Attach the certificate under Documents so a teacher can verify it."
        actions={
          value.hadInternships === 'yes' && (
            <AddButton onClick={() => set({ internships: [...value.internships, emptyInternship()] })}>Add internship</AddButton>
          )
        }
      >
        <Field label="Did you do any internship during graduation? (Y/N)" group>
          <Choice
            name="Internships done"
            value={value.hadInternships}
            onChange={(hadInternships) =>
              set({
                hadInternships,
                internships: hadInternships === 'yes' && value.internships.length === 0 ? [emptyInternship()] : value.internships,
              })
            }
            options={[
              { value: 'yes', label: 'Yes' },
              { value: 'no', label: 'No' },
            ]}
          />
        </Field>

        {value.hadInternships === 'yes' && (
          <div className="space-y-3 mt-4">
            <p className="text-sm font-semibold">Number of internships: {value.internships.length}</p>
            {value.internships.map((item, i) => (
              <EntryCard
                key={item.id}
                aside={
                  <>
                    <EntryStatus item={item} verifications={verifications} />
                    <RemoveButton
                      label={`Remove internship ${i + 1}`}
                      onClick={() => set({ internships: value.internships.filter((x) => x.id !== item.id) })}
                    />
                  </>
                }
              >
                <div className="grid sm:grid-cols-2 gap-3">
                  <Field label="Programme / role / project title">
                    <input className="input" placeholder="Summer Internship Programme — project title" value={item.title} onChange={(e) => setInternship(item.id, { title: e.target.value })} />
                  </Field>
                  <Field label="Where (organisation)">
                    <input className="input" placeholder="Centre for Research, Maitreyi College" value={item.organisation} onChange={(e) => setInternship(item.id, { organisation: e.target.value })} />
                  </Field>
                  <Field label="From">
                    <input className="input" type="date" value={item.startDate} onChange={(e) => setInternship(item.id, { startDate: e.target.value })} />
                  </Field>
                  <Field label="To" hint={durationLabel(item.startDate, item.endDate) && `Duration: ${durationLabel(item.startDate, item.endDate)}`}>
                    <input className="input" type="date" value={item.endDate} onChange={(e) => setInternship(item.id, { endDate: e.target.value })} />
                  </Field>
                  <Field label="Mode">
                    <select className="input" value={item.mode} onChange={(e) => setInternship(item.id, { mode: e.target.value as Internship['mode'] })}>
                      <option value="">Select</option>
                      <option>On-site</option>
                      <option>Remote</option>
                      <option>Hybrid</option>
                    </select>
                  </Field>
                  <Field label="What did you work on? (optional)">
                    <input className="input" value={item.description} onChange={(e) => setInternship(item.id, { description: e.target.value })} />
                  </Field>
                </div>
              </EntryCard>
            ))}
          </div>
        )}
      </SectionCard>

      {/* 3. CURRENT STATUS */}
      <SectionCard
        title={isAlumni ? 'Current status' : 'After graduation'}
        subtitle={
          isAlumni
            ? 'What are you doing now? Add higher studies, a job, or both. Upload the admission or offer letter as proof.'
            : 'Already have an admission or job offer for after graduation? Add it here.'
        }
      >
        <div className="space-y-5">
          <div>
            <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
              <h4 className="font-bold">Higher studies (M.A./M.Com/M.Sc./Ph.D/MBA/B.Ed/other)</h4>
              <AddButton onClick={() => set({ higherStudies: [...value.higherStudies, emptyHigherStudy()] })}>Add course</AddButton>
            </div>
            <div className="space-y-3">
              {value.higherStudies.map((item, i) => (
                <EntryCard
                  key={item.id}
                  aside={
                    <>
                      <EntryStatus item={item} verifications={verifications} />
                      <RemoveButton label={`Remove course ${i + 1}`} onClick={() => set({ higherStudies: value.higherStudies.filter((x) => x.id !== item.id) })} />
                    </>
                  }
                >
                  <div className="grid sm:grid-cols-2 gap-3">
                    <Field label="Course">
                      <input className="input" placeholder="M.Sc. Applied Mathematics" value={item.course} onChange={(e) => setStudy(item.id, { course: e.target.value })} />
                    </Field>
                    <Field label="University / institute">
                      <input className="input" placeholder="NIT Warangal" value={item.institution} onChange={(e) => setStudy(item.id, { institution: e.target.value })} />
                    </Field>
                    <Field label="City / country">
                      <input className="input" value={item.location} onChange={(e) => setStudy(item.id, { location: e.target.value })} />
                    </Field>
                    <Field label="Start year">
                      <YearSelect value={item.startYear} onChange={(startYear) => setStudy(item.id, { startYear })} />
                    </Field>
                    <Field label="Status">
                      <select className="input" value={item.status} onChange={(e) => setStudy(item.id, { status: e.target.value as HigherStudy['status'] })}>
                        {Object.entries(HIGHER_STUDY_STATUS_LABEL).map(([key, label]) => (
                          <option key={key} value={key}>{label}</option>
                        ))}
                      </select>
                    </Field>
                    <Field label="Admitted via (optional)">
                      <input className="input" placeholder="IIT JAM 2026 · CCMN counselling" value={item.admittedVia} onChange={(e) => setStudy(item.id, { admittedVia: e.target.value })} />
                    </Field>
                  </div>
                </EntryCard>
              ))}
              {value.higherStudies.length === 0 && <p className="text-sm text-ink-muted">No higher studies added.</p>}
            </div>
          </div>

          <div className="divider-dashed" />

          <div>
            <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
              <h4 className="font-bold">Job</h4>
              <AddButton onClick={() => set({ employment: [...value.employment, emptyEmployment()] })}>Add job</AddButton>
            </div>
            <div className="space-y-3">
              {value.employment.map((item, i) => (
                <EntryCard
                  key={item.id}
                  aside={
                    <>
                      <EntryStatus item={item} verifications={verifications} />
                      <RemoveButton label={`Remove job ${i + 1}`} onClick={() => set({ employment: value.employment.filter((x) => x.id !== item.id) })} />
                    </>
                  }
                >
                  <div className="grid sm:grid-cols-2 gap-3">
                    <Field label="Designation">
                      <input className="input" value={item.designation} onChange={(e) => setJob(item.id, { designation: e.target.value })} />
                    </Field>
                    <Field label="Company name">
                      <input className="input" value={item.company} onChange={(e) => setJob(item.id, { company: e.target.value })} />
                    </Field>
                    <Field label="Location">
                      <input className="input" value={item.location} onChange={(e) => setJob(item.id, { location: e.target.value })} />
                    </Field>
                    <Field label="Annual package (₹ lakh per annum)" hint="Used only as a batch median in reports.">
                      <input className="input" inputMode="decimal" placeholder="e.g. 6.5" value={item.annualPackageLPA} onChange={(e) => setJob(item.id, { annualPackageLPA: e.target.value })} />
                    </Field>
                    <Field label="Joined on">
                      <input className="input" type="date" value={item.startDate} onChange={(e) => setJob(item.id, { startDate: e.target.value })} />
                    </Field>
                    <Field label="Left on">
                      <input className="input" type="date" disabled={item.current} value={item.current ? '' : item.endDate} onChange={(e) => setJob(item.id, { endDate: e.target.value })} />
                    </Field>
                  </div>
                  <label className="flex items-center gap-2 text-sm font-medium mt-3">
                    <input type="checkbox" checked={item.current} onChange={(e) => setJob(item.id, { current: e.target.checked, endDate: e.target.checked ? '' : item.endDate })} />
                    I currently work here
                  </label>
                </EntryCard>
              ))}
              {value.employment.length === 0 && <p className="text-sm text-ink-muted">No jobs added.</p>}
            </div>
          </div>

          {isAlumni && (
            <>
              <div className="divider-dashed" />
              <div className="grid sm:grid-cols-2 gap-3">
                <Field label="Not studying or working right now?">
                  <select className="input" value={value.activity} onChange={(e) => set({ activity: e.target.value as CurrentActivity })}>
                    <option value="">—</option>
                    {Object.entries(ACTIVITY_LABEL).map(([key, label]) => (
                      <option key={key} value={key}>{label}</option>
                    ))}
                  </select>
                </Field>
                {value.activity && (
                  <Field label="Tell us a little more (optional)">
                    <input className="input" placeholder="e.g. Preparing for UPSC CSE 2027" value={value.activityNote} onChange={(e) => set({ activityNote: e.target.value })} />
                  </Field>
                )}
              </div>
            </>
          )}
        </div>
      </SectionCard>

      {/* 4. COMPETITIVE EXAMS */}
      <SectionCard
        title="Competitive exams"
        subtitle="Tick every exam you have appeared in or passed. Add the scorecard under Documents."
      >
        <div className="flex flex-wrap gap-2 mb-4">
          {EXAM_NAMES.map((exam) => (
            <button key={exam} type="button" className="pill-tab pill-tab-idle text-xs" onClick={() => set({ exams: [...value.exams, emptyExam(exam)] })}>
              + {exam}
            </button>
          ))}
        </div>
        <div className="space-y-3">
          {value.exams.map((item, i) => (
            <EntryCard
              key={item.id}
              aside={
                <>
                  <EntryStatus item={item} verifications={verifications} />
                  <RemoveButton label={`Remove exam ${i + 1}`} onClick={() => set({ exams: value.exams.filter((x) => x.id !== item.id) })} />
                </>
              }
            >
              <div className="grid sm:grid-cols-4 gap-3">
                <Field label="Exam">
                  <select className="input" value={item.exam} onChange={(e) => setExam(item.id, { exam: e.target.value as ExamResult['exam'] })}>
                    {EXAM_NAMES.map((exam) => (
                      <option key={exam} value={exam}>{exam}</option>
                    ))}
                  </select>
                </Field>
                {item.exam === 'OTHERS' && (
                  <Field label="Exam name">
                    <input className="input" placeholder="e.g. GRE" value={item.otherName} onChange={(e) => setExam(item.id, { otherName: e.target.value })} />
                  </Field>
                )}
                <Field label="Result" group>
                  <Choice
                    name="Exam result"
                    value={item.result}
                    onChange={(result) => setExam(item.id, { result })}
                    options={[
                      { value: 'appeared', label: 'Appeared' },
                      { value: 'qualified', label: 'Passed' },
                    ]}
                  />
                </Field>
                <Field label="Year">
                  <YearSelect value={item.year} onChange={(year) => setExam(item.id, { year })} />
                </Field>
                <Field label="Score / rank (optional)">
                  <input className="input" value={item.score} onChange={(e) => setExam(item.id, { score: e.target.value })} />
                </Field>
              </div>
            </EntryCard>
          ))}
          {value.exams.length === 0 && <p className="text-sm text-ink-muted">No exams added.</p>}
        </div>
      </SectionCard>

      {/* 5. ACHIEVEMENTS */}
      <SectionCard
        title="Achievements & areas"
        subtitle="Helps the department see where each student shines — research, sports, cultural, leadership and more."
        actions={<AddButton onClick={() => set({ achievements: [...value.achievements, emptyAchievement()] })}>Add achievement</AddButton>}
      >
        <div className="space-y-3">
          {value.achievements.map((item, i) => (
            <EntryCard
              key={item.id}
              aside={
                <>
                  <EntryStatus item={item} verifications={verifications} />
                  <RemoveButton label={`Remove achievement ${i + 1}`} onClick={() => set({ achievements: value.achievements.filter((x) => x.id !== item.id) })} />
                </>
              }
            >
              <div className="grid sm:grid-cols-4 gap-3">
                <Field label="Achievement" className="sm:col-span-2">
                  <input className="input" placeholder="e.g. First prize, inter-college debate" value={item.title} onChange={(e) => setAchievement(item.id, { title: e.target.value })} />
                </Field>
                <Field label="Area">
                  <select className="input" value={item.area} onChange={(e) => setAchievement(item.id, { area: e.target.value as Achievement['area'] })}>
                    {ACHIEVEMENT_AREAS.map((a) => (
                      <option key={a}>{a}</option>
                    ))}
                  </select>
                </Field>
                <Field label="Level">
                  <select className="input" value={item.level} onChange={(e) => setAchievement(item.id, { level: e.target.value as Achievement['level'] })}>
                    {ACHIEVEMENT_LEVELS.map((l) => (
                      <option key={l}>{l}</option>
                    ))}
                  </select>
                </Field>
                <Field label="Date">
                  <input className="input" type="date" value={item.date} onChange={(e) => setAchievement(item.id, { date: e.target.value })} />
                </Field>
                <Field label="Details (optional)" className="sm:col-span-3">
                  <input className="input" value={item.description} onChange={(e) => setAchievement(item.id, { description: e.target.value })} />
                </Field>
              </div>
            </EntryCard>
          ))}
          {value.achievements.length === 0 && <p className="text-sm text-ink-muted">No achievements added yet.</p>}
        </div>

        <div className="divider-dashed my-4" />

        <Field label="Areas of interest" hint="Press Enter to add. Used to match juniors with alumni mentors." group>
          <div className="flex flex-wrap gap-2 mb-2">
            {value.interests.map((interest) => (
              <span key={interest} className="badge bg-butter border-ink text-ink inline-flex items-center gap-1">
                {interest}
                <button
                  type="button"
                  aria-label={`Remove ${interest}`}
                  className="font-bold"
                  onClick={(e) => {
                    e.preventDefault()
                    set({ interests: value.interests.filter((i) => i !== interest) })
                  }}
                >
                  ×
                </button>
              </span>
            ))}
          </div>
          <input
            className="input"
            placeholder="e.g. Data science"
            value={interestDraft}
            onChange={(e) => setInterestDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ',') {
                e.preventDefault()
                addInterest(interestDraft)
              }
            }}
            onBlur={() => addInterest(interestDraft)}
          />
        </Field>
        <div className="flex flex-wrap gap-1.5 mt-2">
          {INTEREST_SUGGESTIONS.filter((s) => !value.interests.includes(s)).slice(0, 8).map((suggestion) => (
            <button key={suggestion} type="button" className="text-xs px-2.5 py-1 rounded-full border border-ink/40 hover:bg-butter/60" onClick={() => addInterest(suggestion)}>
              + {suggestion}
            </button>
          ))}
        </div>
      </SectionCard>

      {/* 6. DECLARATION */}
      <SectionCard
        title={mode === 'self' ? 'Declaration & privacy' : 'Consent'}
        subtitle={mode === 'self' ? 'This replaces the signature on the paper form.' : 'Only mark consent if the student signed the paper form or agreed in writing.'}
      >
        <div className="space-y-3">
          <label className="flex items-start gap-3 text-sm">
            <input type="checkbox" className="mt-1" checked={value.consent} onChange={(e) => set({ consent: e.target.checked })} />
            <span>
              {mode === 'self'
                ? 'I confirm the information above is correct, and I consent to Maitreyi College keeping this record for alumni relations and institutional reporting (NIRF / NAAC), and contacting me to keep it up to date.'
                : 'Consent on file — the student signed the paper Alumni Database form or agreed in writing.'}
            </span>
          </label>

          {mode === 'self' ? (
            <>
              <label className="flex items-start gap-3 text-sm">
                <input
                  type="checkbox"
                  className="mt-1"
                  checked={value.directoryOptIn}
                  onChange={(e) => set({ directoryOptIn: e.target.checked, shareContact: e.target.checked && value.shareContact })}
                />
                <span>
                  Show me in the <b>Alumni network</b> (name, course, batch, what I'm doing now and my interests — never my phone, roll number or documents).
                </span>
              </label>
              {value.directoryOptIn && (
                <label className="flex items-start gap-3 text-sm ml-7">
                  <input type="checkbox" className="mt-1" checked={value.shareContact} onChange={(e) => set({ shareContact: e.target.checked })} />
                  <span>Also show my email so juniors can reach out for guidance.</span>
                </label>
              )}
            </>
          ) : (
            <p className="text-xs text-ink-muted">
              Only the student can list themselves in the alumni network
              {value.directoryOptIn ? ' — they have opted in.' : '.'}
            </p>
          )}
        </div>
      </SectionCard>
    </div>
  )
}

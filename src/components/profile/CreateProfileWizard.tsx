import { useState } from 'react'
import { useAuth } from '../../context/AuthContext'
import { useToast } from '../Shared'
import { actorOf, draftRecordForUser, saveRecord } from '../../services/recordsService'
import type { StudentRecord } from '../../types'
import { studyYearOf } from '../../utils/records'
import { AboutFields, ActivitiesFields, ConsentFields, DetailsFields, type SectionProps } from '../records/RecordForm'
import ProfileHeader from './ProfileHeader'

const STEPS = [
  { title: 'The basics', subtitle: 'Your course and batch — the same details as the college form.' },
  { title: 'About you', subtitle: "A line about yourself and what you're up to right now." },
  { title: 'Privacy', subtitle: 'Choose who can see your profile.' },
]

export default function CreateProfileWizard({ onCreated }: { onCreated: (profile: StudentRecord) => void }) {
  const { user } = useAuth()
  const { push } = useToast()
  const [draft, setDraft] = useState<StudentRecord>(() => draftRecordForUser(user!))
  const [step, setStep] = useState(0)
  const [saving, setSaving] = useState(false)

  const props: SectionProps = { value: draft, set: (patch) => setDraft((d) => ({ ...d, ...patch })), mode: 'self' }

  function problem(): string | null {
    if (step === 0) {
      if (!draft.name.trim()) return 'Please enter your name.'
      if (!draft.programme) return 'Please choose your course.'
      if (!draft.admissionYear || !draft.graduationYear) return 'Please choose the year you joined and the year you graduate.'
      if (Number(draft.graduationYear) <= Number(draft.admissionYear)) return 'Graduation year must be after the year you joined.'
    }
    if (step === 2 && !draft.consent) return 'Please tick the first box to create your profile.'
    return null
  }

  async function next() {
    const issue = problem()
    if (issue) {
      push(issue, 'error')
      return
    }
    if (step < STEPS.length - 1) {
      setStep(step + 1)
      window.scrollTo({ top: 0, behavior: 'smooth' })
      return
    }
    setSaving(true)
    try {
      const { record } = await saveRecord(draft, null, actorOf(user!))
      push('Your profile is ready! 🎉', 'success')
      onCreated(record)
    } catch (error) {
      console.error(error)
      push('Could not create your profile. Please try again.', 'error')
    } finally {
      setSaving(false)
    }
  }

  return (
    <main className="page-shell max-w-4xl">
      <section className="page-header">
        <div>
          <p className="eyebrow">Welcome, {user?.name?.split(' ')[0]}</p>
          <h1 className="page-title">Create your profile</h1>
          <p className="page-subtitle max-w-2xl">
            Your profile stays with you from first year to graduation and after — the same login throughout. Add what
            you're doing and what you achieve as you go; it replaces the paper alumni form.
          </p>
        </div>
      </section>

      <ol className="grid grid-cols-3 gap-2 mb-6" aria-label="Steps">
        {STEPS.map((s, i) => (
          <li
            key={s.title}
            aria-current={i === step ? 'step' : undefined}
            className={`rounded-full border px-4 py-2 text-sm ${
              i === step
                ? 'border-ink bg-ink text-cream-soft dark:bg-cream-soft dark:text-ink'
                : i < step
                  ? 'border-line bg-sage text-ink'
                  : 'border-line bg-cream-soft dark:bg-transparent dark:border-cream-soft/30'
            }`}
          >
            <span className="font-bold">{i < step ? '✓' : `${i + 1}.`}</span> {s.title}
          </li>
        ))}
      </ol>

      <section className="card">
        <h2 className="font-extrabold text-xl">{STEPS[step].title}</h2>
        <p className="text-sm text-ink-muted mt-1 mb-5">{STEPS[step].subtitle}</p>

        {step === 0 && <DetailsFields {...props} />}

        {step === 1 && (
          <div className="space-y-6">
            <AboutFields {...props} />
            <div>
              <h3 className="font-bold mb-1">What are you doing right now?</h3>
              <p className="text-sm text-ink-muted mb-3">Clubs, projects, a course you're taking, an exam you're preparing for — add as many as you like.</p>
              <ActivitiesFields {...props} />
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-5">
            <ConsentFields {...props} />
            <div>
              <p className="text-xs font-bold uppercase tracking-wide text-ink/50 mb-2">Preview</p>
              <ProfileHeader profile={draft} compact />
              <p className="text-xs text-ink-muted mt-2">
                {studyYearOf(draft).label} · you can add internships, exams, achievements and documents after this.
              </p>
            </div>
          </div>
        )}

        <div className="flex flex-wrap justify-between gap-2 mt-6">
          <button type="button" className="btn-outline" disabled={step === 0 || saving} onClick={() => setStep(step - 1)}>
            ← Back
          </button>
          <button type="button" className="btn-primary" disabled={saving} onClick={next}>
            {step < STEPS.length - 1 ? 'Continue →' : saving ? 'Creating…' : 'Create my profile'}
          </button>
        </div>
      </section>
    </main>
  )
}

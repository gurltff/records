import type { StudentRecord } from '../../types'
import { formatDate, journeyOf, monthLabel, verificationFor, type JourneyItem, type VerificationMap } from '../../utils/records'

const ICON: Record<JourneyItem['kind'], string> = {
  achievement: '🏆',
  internship: '💼',
  exam: '📝',
  activity: '✦',
  higherStudy: '🎓',
  employment: '🏢',
}

function dateText(date: string) {
  if (!date) return ''
  if (/^\d{4}$/.test(date)) return date
  if (/^\d{4}-\d{2}$/.test(date)) return monthLabel(date)
  return formatDate(date)
}

/* Achievements, internships, exams and activities grouped by year of study. */
export default function JourneyTimeline({ profile, verifications }: { profile: StudentRecord; verifications?: VerificationMap }) {
  const buckets = journeyOf(profile)
  if (buckets.length === 0) {
    return <p className="text-sm text-ink-muted">Nothing here yet. Add an achievement, internship or exam and it will appear under the year it happened.</p>
  }
  const all = [...profile.achievements, ...profile.internships, ...profile.exams, ...profile.higherStudies, ...profile.employment]
  const isVerified = (id: string) => {
    const item = all.find((x) => x.id === id)
    return Boolean(item && verifications && verificationFor(item, verifications))
  }

  return (
    <div className="space-y-5">
      {buckets.map((bucket) => (
        <div key={bucket.key}>
          <p className="inline-block rounded-full bg-ink text-cream-soft dark:bg-cream-soft dark:text-ink text-xs font-bold px-3 py-1 mb-3">
            {bucket.label}
          </p>
          <ol className="relative border-l-2 border-ink/15 dark:border-cream-soft/20 ml-3 space-y-3">
            {bucket.items.map((item) => (
              <li key={item.id} className="ml-5">
                <span
                  aria-hidden="true"
                  className="absolute -left-[13px] w-6 h-6 rounded-full bg-chip dark:bg-ink-soft border border-line dark:border-cream-soft/30 text-[12px] flex items-center justify-center"
                >
                  {ICON[item.kind]}
                </span>
                <p className="font-semibold leading-snug">
                  {item.title}
                  {isVerified(item.id) && (
                    <span className="ml-2 badge bg-sage text-ink align-middle" title="Verified by a teacher">
                      ✓ Verified
                    </span>
                  )}
                </p>
                <p className="text-xs text-ink-muted">
                  {[item.meta, item.kind === 'exam' || item.kind === 'higherStudy' ? item.date.slice(0, 4) : dateText(item.date)].filter(Boolean).join(' · ')}
                </p>
              </li>
            ))}
          </ol>
        </div>
      ))}
    </div>
  )
}

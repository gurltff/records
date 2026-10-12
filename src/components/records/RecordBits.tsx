import type { ReactNode } from 'react'
import type { RecordVerification, StudentRecord } from '../../types'
import {
  OUTCOME_LABEL,
  formatDate,
  freshness,
  lastTouched,
  primaryOutcome,
  relativeDays,
  studyYearOf,
  type Freshness,
} from '../../utils/records'

export const TINTS = ['tint-butter', 'tint-blush', 'tint-sage', 'tint-sky']

const FRESHNESS_STYLE: Record<Freshness, { label: string; icon: string; className: string }> = {
  fresh: { label: 'Up to date', icon: '●', className: 'bg-sage' },
  due: { label: 'Update due', icon: '◐', className: 'bg-butter' },
  stale: { label: 'Out of date', icon: '○', className: 'bg-blush' },
}

export function FreshnessBadge({ record, showDate = false }: { record: StudentRecord; showDate?: boolean }) {
  const state = FRESHNESS_STYLE[freshness(record)]
  return (
    <span className="inline-flex flex-col gap-0.5">
      <span className={`badge text-ink whitespace-nowrap ${state.className}`}>
        <span aria-hidden="true">{state.icon}</span> {state.label}
      </span>
      {showDate && <span className="text-xs text-ink-muted">{relativeDays(lastTouched(record))}</span>}
    </span>
  )
}

export function OutcomeBadge({ record }: { record: StudentRecord }) {
  const outcome = primaryOutcome(record)
  return (
    <span className={`badge whitespace-nowrap ${outcome === 'unknown' ? 'border-dashed' : 'bg-cream-deep dark:bg-ink'}`}>
      {OUTCOME_LABEL[outcome]}
    </span>
  )
}

export function StatusBadge({ record }: { record: StudentRecord }) {
  const year = studyYearOf(record)
  return (
    <span className={`badge border-ink whitespace-nowrap ${year.index === 0 ? 'bg-ink text-cream-soft' : 'bg-sky text-ink'}`}>
      {year.label}
    </span>
  )
}

export function VerifiedBadge({ verification }: { verification: RecordVerification | null }) {
  if (!verification) {
    return <span className="badge border-dashed text-ink-muted whitespace-nowrap">Not verified</span>
  }
  return (
    <span
      className="badge bg-sage text-ink whitespace-nowrap"
      title={`Verified by ${verification.verifiedByName} on ${formatDate(verification.verifiedAt)}`}
    >
      ✓ Verified
    </span>
  )
}

/* Single-ratio meter: ink fill on a lighter step of the same grey ramp. */
export function Meter({ value, label }: { value: number; label?: string }) {
  const pct = Math.max(0, Math.min(100, value))
  return (
    <div
      className="w-full h-2.5 rounded-full bg-ink/10 dark:bg-cream-soft/15 overflow-hidden"
      role="meter"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(pct)}
      aria-label={label}
    >
      <div className="h-full rounded-full bg-ink dark:bg-cream-soft" style={{ width: `${pct}%` }} />
    </div>
  )
}

export function StatTile({
  label,
  value,
  note,
  tint,
}: {
  label: string
  value: ReactNode
  note?: ReactNode
  tint: string
}) {
  // `tint` is kept for callers but stat tiles share the neutral card surface.
  void tint
  return (
    <div className="card">
      <p className="text-sm font-semibold">{label}</p>
      <p className="text-3xl font-black mt-1">{value}</p>
      {note && <div className="text-xs text-ink-muted mt-1">{note}</div>}
    </div>
  )
}

/*
 * Wraps a single input in a <label>. Use group for button groups or
 * chip lists: clicking a <label> would otherwise press its first button.
 */
export function Field({
  label,
  hint,
  children,
  className = '',
  group = false,
}: {
  label: string
  hint?: ReactNode
  children: ReactNode
  className?: string
  group?: boolean
}) {
  const body = (
    <>
      <span className="text-sm font-medium">{label}</span>
      <div className="mt-1">{children}</div>
      {hint && <span className="block text-xs text-ink/60 mt-1">{hint}</span>}
    </>
  )
  return group ? (
    <div role="group" aria-label={label} className={`block ${className}`}>{body}</div>
  ) : (
    <label className={`block ${className}`}>{body}</label>
  )
}

export function SectionCard({
  title,
  subtitle,
  actions,
  children,
  id,
}: {
  title: string
  subtitle?: ReactNode
  actions?: ReactNode
  children: ReactNode
  id?: string
}) {
  return (
    <section className="card" id={id}>
      <div className="flex flex-wrap items-start justify-between gap-3 mb-4">
        <div>
          <h3 className="font-extrabold text-lg">{title}</h3>
          {subtitle && <p className="text-sm text-ink-muted mt-0.5">{subtitle}</p>}
        </div>
        {actions}
      </div>
      {children}
    </section>
  )
}

/* Bordered sub-card used for each repeatable entry (internship, job…). */
export function EntryCard({ children, aside }: { children: ReactNode; aside?: ReactNode }) {
  return (
    <div className="rounded-2xl border border-line dark:border-cream-soft/20 p-3 sm:p-4">
      {aside && <div className="flex flex-wrap items-center justify-end gap-2 mb-3">{aside}</div>}
      {children}
    </div>
  )
}

/* Horizontal single-series bar list (top employers, exams…). */
export function BarList({ items, unit = '' }: { items: { label: string; count: number }[]; unit?: string }) {
  const max = Math.max(1, ...items.map((i) => i.count))
  if (items.length === 0) return <p className="text-sm text-ink-muted">Nothing reported yet.</p>
  return (
    <ul className="space-y-2.5">
      {items.map((item) => (
        <li key={item.label} title={`${item.label}: ${item.count}${unit}`}>
          <div className="flex justify-between gap-3 text-sm">
            <span className="font-semibold truncate">{item.label}</span>
            <span className="tabular-nums text-ink-muted">{item.count}{unit}</span>
          </div>
          <div className="mt-1 h-3 rounded-r-[4px] bg-transparent">
            <div
              className="h-3 rounded-r-[4px] bg-ink dark:bg-cream-soft"
              style={{ width: `${Math.max(2, (item.count / max) * 100)}%` }}
            />
          </div>
        </li>
      ))}
    </ul>
  )
}

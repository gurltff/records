import type { ReactNode } from 'react'
import type { StudentRecord } from '../../types'
import { batchLabel, studyYearOf } from '../../utils/records'

export function initialsOf(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  return ((parts[0]?.[0] ?? '') + (parts.length > 1 ? parts[parts.length - 1][0] : '')).toUpperCase() || '?'
}

export function Avatar({ name, size = 'md' }: { name: string; size?: 'sm' | 'md' | 'lg' }) {
  const dims = size === 'lg' ? 'w-20 h-20 text-2xl' : size === 'md' ? 'w-12 h-12 text-base' : 'w-10 h-10 text-sm'
  return (
    <span aria-hidden="true" className={`${dims} shrink-0 rounded-full bg-ink-soft text-white dark:bg-cream-soft dark:text-ink font-black flex items-center justify-center`}>
      {initialsOf(name)}
    </span>
  )
}

/* The dark banner at the top of a profile. */
export default function ProfileHeader({
  profile,
  compact = false,
  actions,
  children,
}: {
  profile: StudentRecord
  compact?: boolean
  actions?: ReactNode
  children?: ReactNode
}) {
  const year = studyYearOf(profile)
  return (
    <section className="card p-5 sm:p-6">
      <div className="flex flex-wrap items-start gap-4">
        <span
          aria-hidden="true"
          className={`${compact ? 'w-14 h-14 text-lg' : 'w-14 h-14 text-lg sm:w-20 sm:h-20 sm:text-2xl'} shrink-0 rounded-full bg-ink-soft text-white dark:bg-cream-soft dark:text-ink font-black flex items-center justify-center`}
        >
          {initialsOf(profile.name)}
        </span>
        <div className="min-w-0 flex-1 basis-[200px]">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className={`${compact ? 'text-xl' : 'text-2xl sm:text-3xl'} font-black tracking-tight`}>{profile.name || 'Your name'}</h1>
            <span className="rounded-full bg-ink text-white dark:bg-cream-soft dark:text-ink text-xs font-bold px-2.5 py-1">{year.label}</span>
          </div>
          <p className="text-sm text-ink-muted mt-1">
            {profile.programme || 'Course'} · Batch {batchLabel(profile)}
          </p>
          <p className={`mt-2 ${profile.bio ? '' : 'text-ink-muted italic'}`}>{profile.bio || 'Add a one-line bio'}</p>
          {profile.interests.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mt-3">
              {profile.interests.map((interest) => (
                <span key={interest} className="rounded-full bg-chip dark:bg-cream-soft/10 border border-line dark:border-cream-soft/20 px-2.5 py-0.5 text-xs font-semibold">
                  {interest}
                </span>
              ))}
            </div>
          )}
        </div>
        {actions && <div className="flex flex-wrap gap-2 w-full sm:w-auto">{actions}</div>}
      </div>
      {children}
    </section>
  )
}

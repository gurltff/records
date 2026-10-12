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
    <span aria-hidden="true" className={`${dims} shrink-0 rounded-full bg-butter border-2 border-ink text-ink font-black flex items-center justify-center`}>
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
    <section className="rounded-3xl border-2 border-ink dark:border-cream-soft/40 bg-ink text-cream-soft p-5 sm:p-6 shadow-pop dark:shadow-none">
      <div className="flex flex-wrap items-start gap-4">
        <span
          aria-hidden="true"
          className={`${compact ? 'w-14 h-14 text-lg' : 'w-14 h-14 text-lg sm:w-20 sm:h-20 sm:text-2xl'} shrink-0 rounded-full bg-cream-soft text-ink font-black flex items-center justify-center`}
        >
          {initialsOf(profile.name)}
        </span>
        <div className="min-w-0 flex-1 basis-[200px]">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className={`${compact ? 'text-xl' : 'text-2xl sm:text-3xl'} font-black tracking-tight`}>{profile.name || 'Your name'}</h1>
            <span className="rounded-full bg-cream-soft text-ink text-xs font-bold px-2.5 py-1">{year.label}</span>
          </div>
          <p className="text-sm text-cream-soft/75 mt-1">
            {profile.programme || 'Course'} · Batch {batchLabel(profile)}
          </p>
          <p className={`mt-2 ${profile.bio ? '' : 'text-cream-soft/50 italic'}`}>{profile.bio || 'Add a one-line bio'}</p>
          {profile.interests.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mt-3">
              {profile.interests.map((interest) => (
                <span key={interest} className="rounded-full border border-cream-soft/40 px-2.5 py-0.5 text-xs font-semibold">
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

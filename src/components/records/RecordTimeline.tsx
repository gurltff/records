import type { RecordAction, RecordUpdate } from '../../types'
import { formatDate } from '../../utils/records'
import { SectionCard } from './RecordBits'

const ICON: Record<RecordAction, string> = {
  created: '✦',
  updated: '✎',
  confirmed: '✓',
  claimed: '🔗',
  imported: '⇪',
  verified: '✔',
  unverified: '↺',
  document_added: '📎',
  document_removed: '✕',
  graduated: '🎓',
}

export default function RecordTimeline({ updates, limit = 12 }: { updates: RecordUpdate[]; limit?: number }) {
  const items = updates.slice(0, limit)
  return (
    <SectionCard title="Update history" subtitle="Every change is logged with who made it and when.">
      {items.length === 0 ? (
        <p className="text-sm text-ink-muted">No history yet.</p>
      ) : (
        <ol className="relative border-l-2 border-ink/15 dark:border-cream-soft/20 ml-3 space-y-4">
          {items.map((item) => (
            <li key={item.id} className="ml-5">
              <span
                aria-hidden="true"
                className="absolute -left-[13px] w-6 h-6 rounded-full bg-chip border border-line text-ink text-[11px] flex items-center justify-center"
              >
                {ICON[item.action]}
              </span>
              <p className="text-sm font-semibold">{item.summary}</p>
              <p className="text-xs text-ink-muted">
                {item.actorName} ({item.actorRole === 'cr' ? 'CR' : item.actorRole}) · {formatDate(item.at)}
              </p>
            </li>
          ))}
        </ol>
      )}
      {updates.length > limit && <p className="text-xs text-ink-muted mt-3">Showing the latest {limit} of {updates.length} changes.</p>}
    </SectionCard>
  )
}

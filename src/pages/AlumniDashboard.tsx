import { useState } from 'react'
import { useAuth } from '../context/AuthContext'
import MyRecord from '../components/records/MyRecord'
import AlumniNetwork from '../components/records/AlumniNetwork'

type Tab = 'record' | 'network'

export default function AlumniDashboard() {
  const { user } = useAuth()
  const [tab, setTab] = useState<Tab>('record')
  const programme = user?.enrolledCourseIds?.[0]

  const tabs: { key: Tab; label: string }[] = [
    { key: 'record', label: 'My record' },
    { key: 'network', label: 'Alumni network' },
  ]

  return (
    <main className="page-shell">
      <section className="page-header">
        <div>
          <p className="eyebrow">Alumni</p>
          <h1 className="page-title">Hi {user?.name?.split(' ')[0]} 👋</h1>
          <p className="page-subtitle">
            {programme ?? 'Maitreyi College'}
            {user?.graduationYear ? ` · Batch of ${user.graduationYear}` : ''}
          </p>
        </div>
        <div className="rounded-2xl border-2 border-ink bg-butter text-ink px-5 py-4 max-w-sm">
          <p className="text-sm font-semibold">Stay connected</p>
          <p className="text-sm mt-1">
            Keep your record current — new course, new job, an exam cleared. It takes two minutes and helps juniors find
            mentors.
          </p>
        </div>
      </section>

      <div className="flex gap-2 mb-6 overflow-x-auto">
        {tabs.map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => setTab(t.key)}
            className={`btn-outline whitespace-nowrap ${tab === t.key ? 'is-active' : ''}`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'record' && <MyRecord />}
      {tab === 'network' && <AlumniNetwork />}
    </main>
  )
}

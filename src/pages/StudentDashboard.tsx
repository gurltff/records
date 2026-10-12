import { useEffect, useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { getWhere, put } from '../services/store'
import { getProgramCourses } from '../data/scheduleData'
import type { AttendanceRecord, Course, UserProfile } from '../types'
import Overview from '../components/student/Overview'
import AutoTimetable from '../components/student/AutoTimetable'
import MarkPresence from '../components/student/MarkPresence'
import History from '../components/student/History'
import ProfileGate, { useMyProfile } from '../components/profile/ProfileGate'
import MyProfile from '../components/profile/MyProfile'
import Explore from '../components/profile/Explore'

type Tab = 'profile' | 'overview' | 'timetable' | 'mark' | 'history' | 'explore'

export default function StudentDashboard() {
  return (
    <ProfileGate>
      <StudentHome />
    </ProfileGate>
  )
}

function StudentHome() {
  const { user, setUser } = useAuth()
  const { profile } = useMyProfile()
  const graduated = profile.status === 'alumni'
  const [tab, setTab] = useState<Tab>('profile')
  const [records, setRecords] = useState<AttendanceRecord[]>([])

  async function refreshRecords() {
    if (!user) return
    setRecords(await getWhere<AttendanceRecord>('attendanceRecords', 'studentId', user.uid))
  }

  useEffect(() => {
    refreshRecords()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user])

  // Graduated students keep their login; attendance no longer applies to them.
  const tabs: { key: Tab; label: string }[] = graduated
    ? [
        { key: 'profile', label: 'My Profile' },
        { key: 'explore', label: 'Explore' },
      ]
    : [
        { key: 'profile', label: 'My Profile' },
        { key: 'overview', label: 'Attendance' },
        { key: 'timetable', label: 'Timetable' },
        { key: 'mark', label: 'Mark My Presence' },
        { key: 'history', label: 'History' },
        { key: 'explore', label: 'Explore' },
      ]

  const programName = user?.enrolledCourseIds?.[0]

  // Real courses come from the student's actual timetable (programme + year),
  // not a generic placeholder list — so they line up with what's on their schedule.
  const courses: Course[] = getProgramCourses(programName, user?.year).map((c) => ({
    id: c.id,
    name: c.name,
    code: '',
    category: 'GE_5',
    maxAttendanceMarks: 5,
  }))

  async function handleYearChange(year: string) {
    if (!user) return
    const updated: UserProfile = { ...user, year }
    await put<UserProfile & { id: string }>('users', { ...updated, id: user.uid })
    setUser(updated)
  }

  return (
    <main className="page-shell">
      <div className="flex gap-2 mb-6 overflow-x-auto pb-1">
        {tabs.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`btn-outline whitespace-nowrap ${tab === t.key ? 'is-active' : ''}`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'profile' && <MyProfile />}
      {tab === 'overview' && (
        <Overview courses={courses} records={records} programName={programName} year={user?.year} />
      )}
      {tab === 'timetable' && (
        <AutoTimetable programName={programName} savedYear={user?.year} onYearChange={handleYearChange} />
      )}
      {tab === 'mark' && <MarkPresence courses={courses} onSaved={refreshRecords} />}
      {tab === 'history' && <History records={records} courses={courses} />}
      {tab === 'explore' && <Explore />}
    </main>
  )
}
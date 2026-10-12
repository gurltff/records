export type Role =
  | 'student'
  | 'teacher'
  | 'cr'
  /* Records office / IQAC: sees every student's profile. Assigned, never self-registered. */
  | 'admin'

export interface UserProfile {
  uid: string
  name: string
  email: string
  role: Role

  enrolledCourseIds?: string[]
  assignedCourseIds?: string[]

  year?: string

  /*
   * Set once a student's batch has graduated (e.g. "2026").
   * They keep the same student login.
   */
  graduationYear?: string

  createdAt: number
}

export type CourseCategory =
  | 'DSC_MAIN_6'
  | 'DSC_MAIN_5'
  | 'SEC_2'
  | 'GE_5'

export interface Course {
  id: string
  name: string
  code: string
  category: CourseCategory

  maxAttendanceMarks:
    | 6
    | 5
    | 2

  teacherId?: string
}

export type AnnouncementCategory =
  | 'Academic'
  | 'Event'
  | 'Exam'
  | 'Holiday'
  | 'Urgent'

export interface Announcement {
  id: string

  title: string
  message: string

  category: AnnouncementCategory

  isUrgent: boolean

  authorId: string
  authorName: string

  createdAt: number

  expiresAt?: number

  isActive: boolean
}

export interface GeoTag {
  latitude: number
  longitude: number
  accuracy?: number
}

export type LocationStatus =
  | 'captured'
  | 'unavailable'
  | 'denied'

export type AttendanceSource =
  | 'teacher_marked'
  | 'student_self_checkin'

export type AttendanceStatus =
  | 'present'
  | 'absent'

export interface AttendanceRecord {
  id: string

  studentId: string
  studentName: string

  courseId: string
  courseName: string

  /*
   * Composite key:
   *
   * programme::year::subject
   *
   * Example:
   * B.Sc. (Hons) Physics::Second Year::Quantum Mechanics
   */
  courseKey?: string

  /*
   * The teacher who marked the attendance.
   */
  teacherId?: string

  date: string

  status: AttendanceStatus

  source: AttendanceSource

  photoUrl?: string
  photoTimestamp?: number

  geoTag?: GeoTag

  locationStatus: LocationStatus

  createdAt: number
}

export interface TimetableEntry {
  id: string

  studentId: string

  day:
    | 'Mon'
    | 'Tue'
    | 'Wed'
    | 'Thu'
    | 'Fri'
    | 'Sat'

  startTime: string
  endTime: string

  courseId: string
  courseName: string

  category: CourseCategory
}

export interface AttendanceSession {
  id: string

  teacherId: string

  courseId: string
  courseName: string

  /*
   * Composite class/subject key.
   */
  courseKey?: string

  date: string

  createdAt: number
}
export * from './records'

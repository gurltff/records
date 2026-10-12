import { SCHEDULE_DATA } from './scheduleData'
import type {
  AchievementArea,
  ActivityKind,
  AchievementLevel,
  CurrentActivity,
  DocumentKind,
  ExamName,
  HigherStudyStatus,
} from '../types'

/*
 * Programmes offered at the college. The department can edit this list;
 * anything not listed can still be typed in via "Other".
 */
const BASE_PROGRAMMES = [
  'B.A. (Hons) Economics',
  'B.A. (Hons) English',
  'B.A. (Hons) Hindi',
  'B.A. (Hons) History',
  'B.A. (Hons) Political Science',
  'B.A. (Hons) Sanskrit',
  'B.A. Programme',
  'B.Com (Hons)',
  'B.Com',
  'B.Sc. (Hons) Botany',
  'B.Sc. (Hons) Chemistry',
  'B.Sc. (Hons) Mathematics',
  'B.Sc. (Hons) Physics',
  'B.Sc. (Hons) Zoology',
  'B.Sc. Life Science',
  'B.Sc. Physical Science with Chemistry',
  'B.Sc. Physical Science with Computer Science',
]

export const RECORD_PROGRAMMES = Array.from(
  new Set([...BASE_PROGRAMMES, ...Object.keys(SCHEDULE_DATA)]),
).sort()

export const EXAM_NAMES: ExamName[] = [
  'NET',
  'SET/SLET',
  'GATE',
  'CAT',
  'IAS/IPS',
  'STATE PSC',
  'UPSC',
  'JAM',
  'CUET-PG',
  'OTHERS',
]

export const ACHIEVEMENT_AREAS: AchievementArea[] = [
  'Academics',
  'Research',
  'Sports',
  'Cultural',
  'Leadership',
  'Entrepreneurship',
  'Social service',
  'Certification',
  'Competition',
]

export const ACTIVITY_KINDS: ActivityKind[] = [
  'Club / society',
  'Project',
  'Course / certification',
  'Exam preparation',
  'Volunteering',
  'Part-time work',
  'Startup / venture',
  'Other',
]

export const ACTIVITY_ICON: Record<ActivityKind, string> = {
  'Club / society': '🎭',
  Project: '🛠',
  'Course / certification': '📘',
  'Exam preparation': '🎯',
  Volunteering: '🤝',
  'Part-time work': '💼',
  'Startup / venture': '🚀',
  Other: '✦',
}

export const ACHIEVEMENT_LEVELS: AchievementLevel[] = [
  'College',
  'University',
  'State',
  'National',
  'International',
]

export const HIGHER_STUDY_STATUS_LABEL: Record<HigherStudyStatus, string> = {
  admitted: 'Admitted / seat allotted',
  pursuing: 'Pursuing',
  completed: 'Completed',
  discontinued: 'Discontinued',
}

export const ACTIVITY_LABEL: Record<Exclude<CurrentActivity, ''>, string> = {
  preparing: 'Preparing for competitive exams',
  entrepreneur: 'Entrepreneur / self-employed',
  break: 'Taking a break',
  other: 'Other',
}

export const DOCUMENT_KIND_LABEL: Record<DocumentKind, string> = {
  offer_letter: 'Offer / appointment letter',
  admission_letter: 'Admission / seat allotment letter',
  internship_certificate: 'Internship certificate',
  exam_scorecard: 'Exam scorecard',
  achievement_certificate: 'Achievement certificate',
  marksheet: 'Marksheet / degree',
  other: 'Other document',
}

export const INTEREST_SUGGESTIONS = [
  'Data science',
  'Finance',
  'Teaching',
  'Research',
  'Civil services',
  'Software',
  'Consulting',
  'Public policy',
  'Writing & media',
  'Design',
  'Law',
  'Healthcare',
]

export function graduationYearOptions(now = new Date()) {
  const latest = now.getFullYear() + 4
  const years: string[] = []
  for (let y = latest; y >= 1970; y--) years.push(String(y))
  return years
}

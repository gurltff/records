import { Route, Routes } from 'react-router-dom'

import {
  AuthenticatedRoute,
  Navbar,
  ProtectedRoute,
  ToastProvider,
} from './components/Shared'

import AlumniDashboard from './pages/AlumniDashboard'
import AuthPage from './pages/AuthPage'
import CRDashboard from './pages/CRDashboard'
import PrintRecord from './pages/PrintRecord'
import StudentDashboard from './pages/StudentDashboard'
import TeacherDashboard from './pages/TeacherDashboard'
import TeacherClassOverview from './pages/TeacherClassOverview'
import TeacherRecords from './pages/TeacherRecords'
import TimetablePage from './pages/TimetablePage'

export default function App() {
  return (
    <ToastProvider>

      {/* 
        Navbar is rendered through a portal directly into
        document.body, so it stays fixed to the browser viewport.
      */}
      <Navbar />

      <main className="app-main">
        <Routes>

          {/* LOGIN / REGISTRATION */}
          <Route
            path="/"
            element={<AuthPage />}
          />

          {/* STUDENT */}
          <Route
            path="/student"
            element={
              <ProtectedRoute role="student">
                <StudentDashboard />
              </ProtectedRoute>
            }
          />

          {/* TEACHER */}
          <Route
            path="/teacher"
            element={
              <ProtectedRoute role="teacher">
                <TeacherDashboard />
              </ProtectedRoute>
            }
          />

          {/* TEACHER - MANAGE CLASSES */}
          <Route
            path="/teacher/classes"
            element={
              <ProtectedRoute role="teacher">
                <TeacherClassOverview />
              </ProtectedRoute>
            }
          />

          {/* TEACHER - STUDENT & ALUMNI RECORDS */}
          <Route
            path="/teacher/records"
            element={
              <ProtectedRoute role="teacher">
                <TeacherRecords />
              </ProtectedRoute>
            }
          />

          {/* ALUMNI */}
          <Route
            path="/alumni"
            element={
              <ProtectedRoute role="alumni">
                <AlumniDashboard />
              </ProtectedRoute>
            }
          />

          {/* PRINTABLE ALUMNI DATABASE FORM */}
          <Route
            path="/records/:id/print"
            element={
              <AuthenticatedRoute>
                <PrintRecord />
              </AuthenticatedRoute>
            }
          />

          {/* CLASS REPRESENTATIVE */}
          <Route
            path="/cr"
            element={
              <ProtectedRoute role="cr">
                <CRDashboard />
              </ProtectedRoute>
            }
          />

          {/* TIMETABLE */}
          <Route
            path="/timetable"
            element={
              <AuthenticatedRoute>
                <TimetablePage />
              </AuthenticatedRoute>
            }
          />

        </Routes>
      </main>
    </ToastProvider>
  )
}
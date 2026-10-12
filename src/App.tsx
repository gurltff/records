import { Navigate, Route, Routes } from 'react-router-dom'

import {
  AuthenticatedRoute,
  Navbar,
  ProtectedRoute,
  ToastProvider,
} from './components/Shared'

import AuthPage from './pages/AuthPage'
import CRDashboard from './pages/CRDashboard'
import PrintRecord from './pages/PrintRecord'
import StudentDashboard from './pages/StudentDashboard'
import TeacherDashboard from './pages/TeacherDashboard'
import TeacherClassOverview from './pages/TeacherClassOverview'
import AdminDashboard from './pages/AdminDashboard'
import AdminDemo from './pages/AdminDemo'
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

          {/* Student profiles moved from teachers to the admin console. */}
          <Route
            path="/teacher/records"
            element={<Navigate to="/teacher" replace />}
          />

          {/* ADMIN CONSOLE */}
          <Route
            path="/admin"
            element={
              <ProtectedRoute role="admin">
                <AdminDashboard />
              </ProtectedRoute>
            }
          />

          {/* One-click demo: sets up demo data and opens the admin console. */}
          <Route
            path="/admin-demo"
            element={<AdminDemo />}
          />

          {/* Old link from the alumni-login version: graduates use /student. */}
          <Route
            path="/alumni"
            element={<Navigate to="/student" replace />}
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
# Maitreyi Smart Campus

A prototype for Maitreyi College: the **Smart Attendance Tracker** plus a **student profile** that every student builds from first year and keeps after graduation — on the same login.

The profile holds everything on the paper *Alumni Database form* (course, batch, internships, higher studies, job, competitive exams) and much more: what the student is doing right now (clubs, projects, courses, exam preparation) and their achievements, laid out year by year. Teachers can see what each year is doing, verify entries against offer letters and certificates, and export NIRF / NAAC reports — instead of filing paper forms and photocopies. It is the college's own record, independent of LinkedIn.

Built with React + TypeScript + Vite, Tailwind CSS, React Router and Firebase (Auth + Firestore). Without a Firebase config it runs entirely in the browser on demo data.

---

## How it works

**One login, for life.** There is no separate alumni account. A student signs up once; when their batch graduates, the same login keeps working and their profile is marked *Graduated*.

**Students** must create their profile the first time they log in (three short steps: basics → about you and what you're doing now → privacy). After that, **My Profile** is the first tab:
- A header with their name, year, course, bio, interests, counts (achievements, internships, exams cleared, entries verified) and how complete the profile is.
- **Doing now** — clubs, projects, courses, exam preparation, part-time work; for graduates, their current course or job.
- **My journey** — achievements, internships, exams and activities grouped under *First Year*, *Second Year*, *Third Year* and *After graduation*.
- Cards for internships, competitive exams, plans after graduation, details & privacy, plus **Documents** (offer / admission letters, certificates) and the change history.
- Every section has its own **Edit / + Add** button that opens just that section.

**Explore** lets students browse the profiles of classmates and seniors who chose to be visible — filter by 1st / 2nd / 3rd year / graduated, course or achievement area — and email those who shared contact details.

**Graduated students** see only *My Profile* and *Explore* (attendance no longer applies). They get banners when the department asks for an update and can confirm "nothing changed" in one click.

**Teachers** get **Student profiles** (button on the teacher dashboard):
- Profiles filtered by **1st year / 2nd year / 3rd year / graduated**, course, batch, what they're doing, achievement area and how recently they were updated; CSV export.
- A profile view with bio, doing now, the year-by-year journey, every entry with its proof and a **Verify** button, attendance in the teacher's own subjects, history, edit, print and "request update".
- **Verification queue**, **Update requests** (to graduates, current students or everyone, with response tracking), and **Batch outcomes**: what each current year is doing, and per graduating batch the share in higher studies / placed, median package, internships and exams cleared — exportable for NIRF.
- **Mark batch as graduated** when a batch's final session ends, **Add from paper form** to digitise old forms, and **Import CSV** for existing spreadsheets (a student's profile links automatically when they sign up with the same email).
- **Print as college form** reproduces the paper Alumni Database form for physical files.

## How profiles stay up to date

1. Students update their own profile whenever something happens — every change is logged.
2. Update requests show a banner until the student updates or confirms; teachers see who hasn't responded.
3. Profiles untouched for 6 months are flagged *Update due*, after a year *Out of date*.
4. A teacher's verification stores a fingerprint of the entry; if the student edits it later, it becomes unverified and returns to the queue.
5. Personal email is asked for, because college mailboxes expire after graduation.

---

## Try the demo (no Firebase needed)

```bash
npm install
npm run dev
```

On the login page click **Set up demo data**, then click a name (password for all: `Demo@1234`):

| Account | What to look at |
|---|---|
| **Rohan Verma** — 2nd year, no profile yet | The first-login "Create your profile" steps |
| **Priya Nair** — 2nd year | A filled-in profile, **Explore** |
| **Aarav Sharma** — 2nd year, class rep | CR dashboard → **My Profile** |
| **Ananya Iyer** — graduated 2025 | Same student login after graduation; update-request banner; verified internship |
| **Kavya Menon** — graduated 2024 | Graduate with a job |
| **Dr. Mehta** / **Ms. Kapoor** — teachers | Teacher dashboard → **🎓 Student profiles** |

The demo also creates 1st, 2nd and 3rd-year students, a batch that has just finished, and digitised paper forms of earlier graduates — all fictional people and placeholder companies. Demo data lives only in this browser's `localStorage`.

**A five-minute walkthrough for presenting:**
1. Log in as **Rohan** → create the profile in three steps → add an achievement → see it appear under *Second Year*.
2. Open **Explore** and switch between 1st / 2nd / 3rd year / graduated.
3. Log in as **Dr. Mehta** → *Student profiles* → click **1st year** → open a profile → **Verify** an entry.
4. Open **Batch outcomes** → *What each year is doing*, then **Mark batch 2026 as graduated** on the Profiles tab.
5. Open any profile → **Print form** to show the paper-form layout.

## Run on Firebase

1. Create a Firebase project; enable **Authentication → Email/Password** and **Firestore**. (Storage is not needed: documents are compressed and stored on Firestore documents, so the free Spark plan works.)
2. Copy `.env.example` to `.env` and fill in the web-app config.
3. Deploy the rules: `firebase deploy --only firestore:rules`. Test them in the Firestore emulator before real data goes in, especially the record-owner rules that use `get()`.

Real sign-ups need a verified email. Students and teachers register from the login page; CRs are promoted by a teacher, as before.

## Data model (Firestore collections)

| Collection | Holds | Who can read / write |
|---|---|---|
| `studentRecords` | One profile per student (`src/types/records.ts`) | Owner and teachers; an unclaimed (digitised) profile can be claimed by the verified email on it |
| `recordDocuments` | Proof files as compressed data URLs, optionally linked to an entry | Record owner and teachers |
| `recordVerifications` | Teacher verification + content fingerprint per entry | Written by teachers only |
| `recordUpdates` | Append-only change history | Readable by owner and teachers; never edited |
| `updateDrives` | Update requests and their audience | Created by teachers |
| `directoryProfiles` | Opt-in Explore card (no phone, roll no. or documents) | Any signed-in user reads; only the owner writes |

The attendance collections (`users`, `attendanceRecords`, `attendanceSessions`, `announcements`, `timetableEntries`) are unchanged; `users` gains `graduationYear` once a student's batch graduates.

## Privacy and security

- Students give consent when creating their profile, and appearing on **Explore** is **opt-in**, with contact details shown only if they choose. Teachers cannot make someone visible.
- Classmates never read profiles directly — Explore uses a separate collection with only public fields.
- Verification is teacher-only in the rules, and any edit voids it.
- Uploaded files are re-encoded to JPEG, or must be a PDF under 650 KB, and are only ever rendered as PDF/JPEG/PNG/WebP. Anything else downloads instead of opening, so a crafted file can't run script in the app.
- CSV exports neutralise spreadsheet formulas.
- Before using real student data, check with the college about consent wording, retention and deletion requests under India's Digital Personal Data Protection Act, 2023.

## Development

```bash
npm run dev      # local dev server
npm run test     # unit tests (attendance marks, record logic, CSV, document types)
npm run build    # type-check + production build
npm run deploy   # GitHub Pages (base path /records/)
```

Camera and geolocation (attendance self check-in) need HTTPS or `localhost`.

## What to work on next

- **Email/WhatsApp reminders** for update requests (a Cloud Function on a schedule) — today teachers copy pending emails.
- **Move documents to Firebase Storage** once the college has a Blaze plan; the teacher view currently loads every document to build the verification queue.
- **Department scoping and an admin role**, so each department sees its own students and an IQAC/NIRF coordinator sees all.
- **Profile photos** and a public, shareable profile link students can put on their CV.
- **Bulk digitisation**: photograph a stack of paper forms and pre-fill records with OCR, with a teacher confirming each one.
- **Reports over time** (outcomes per year, response rates) and NAAC criterion-5 templates.
- **Duplicate merging** when an imported record and a self-created one belong to the same person.

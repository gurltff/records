# Demo accounts

All demo accounts use the password `Demo@1234`. Click **Set up demo data** on the login page first.

- Aarav Sharma — aarav.demo@example.com (student, starts as CR)
- Priya Nair — priya.demo@example.com (student)
- Rohan Verma — rohan.demo@example.com (student)
- Dr. Mehta — mehta.demo@example.com (teacher)
- Ms. Kapoor — kapoor.demo@example.com (teacher)
- Ananya Iyer — ananya.demo@example.com (student, graduated 2025)
- Kavya Menon — kavya.demo@example.com (student, graduated 2024)

Rohan starts without a profile, to show the first-login "Create your profile" steps.

The teacher can promote any student to CR from Manage Classes. Only the current CR receives the CR dashboard.

## Important implementation detail
Demo accounts and demo data are stored locally so demo setup never signs into or replaces a real Firebase session. Real email/password accounts still use Firebase Authentication and Firestore.

See README.md for the student profile features.

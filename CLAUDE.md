# Clinical – Project Context (simple version)

Clinical is a CS508 graduation project: a clinic appointment booking website, built by 5 students.
**Two goals, in this order:**
1. **A clear, friendly user experience and clean screens.** Every user should know what to do on every page without help.
2. **Simple code.** Students must be able to read, explain and change every file.
Choose the simplest working solution, with no extra layers, patterns or libraries. Clear code beats clever code.
The documentation is in `docs/` (`Project Graduation 2026-2027 - Clinical v3.pdf`). Follow its features and database, and **never edit it**.
The screens in chapter 5 (Design Scenarios) are the visual reference for the UI.

## Roles
- **Visitor** (not logged in): search doctors, view a doctor profile, register **as a patient only**.
- **Patient**: book, cancel, join the waiting list, see diagnoses, rate the doctor.
- **Doctor**: does **not** register. The admin creates his account after checking his syndicate card.
- **Admin**: adds / edits / removes doctors (uploads a copy of the syndicate card), blocks patients, manages specialties, sees simple statistics. One admin is created by the seed.

## Stack (only these)
- **Two repos**: this folder (`Clinical`) is the website only. The API is in `../Clinical-backend`.
- **Client**: React + Vite, React Router, Axios, Tailwind CSS, **shadcn/ui** (components in `src/components/ui`), react-leaflet (show the clinic on a map), react-chartjs-2 (one chart for reports).
- **Server**: Node.js + Express, Prisma 6 + PostgreSQL on Supabase, bcryptjs, jsonwebtoken, multer, nodemailer, node-cron, cors, dotenv.
- **Language**: JavaScript only (ES modules). No TypeScript.
- **Not used, to keep it simple**: Redux, React Query, Socket.io, PDF libraries, Docker, microservices, repository/service layers.
- **Arabic / English**: i18next + react-i18next. The words live in `public/locales/en/translation.json` and `public/locales/ar/translation.json` (always add a key to both). The language toggle is in the Navbar; `App.jsx` sets `<html dir="rtl">` for Arabic. Use logical Tailwind classes (`ms-`, `pe-`, `start-`, `end-`) so both directions work.

## Folder structure
```
Clinical/  (website)
  public/locales/        en/translation.json, ar/translation.json
  src/services/api.js    axios instance (adds the token from localStorage)
  src/context/AuthContext.jsx   current user + login/logout
  src/hooks/useFetch.js  { data, loading, error, reload }
  src/lib/format.js      friendly dates, times, money
  src/i18n/i18n.js       i18next setup
  src/routes/router.jsx  all pages + ProtectedRoute per role
  src/components/ui/     shadcn components
  src/components/layout/ Navbar, NotificationBell, LanguageToggle, Footer, AppLayout
  src/components/shared/ ProtectedRoute, PageHeader, EmptyState, StatusBadge, ConfirmDialog, DoctorCard, BookingPanel, ...
  src/pages/             Home, Login, Register, Search, DoctorProfile, MyAppointments, MyRecords, Profile,
                         doctor/ (Dashboard, Clinic, Schedule, Diagnosis, Reports),
                         admin/  (Doctors, AddDoctor, Patients, Specialties, Stats)
Clinical-backend/  (API)
  prisma/schema.prisma, prisma/seed.js
  src/index.js           express app + routes + error handler
  src/middleware/        auth.js (verifyToken, allowRoles), upload.js (multer)
  src/utils/             email.js, slots.js, notify.js
  src/routes/            one file per module: auth, admin, doctors, appointments, records, notifications
  src/controllers/       one file per module, same names
  uploads/               uploaded files (served as static)
  tests/api.test.js      Jest + Supertest
  docs/                  Postman collection
```
Flow: **route → controller → prisma**. Put shared logic in `utils/`. Each controller function is short and has a one-line comment.

## Modules (one per team member)
| # | Module | Files | Endpoints |
|---|---|---|---|
| 1 | Auth + Admin | auth.*, admin.* | POST /api/auth/register · POST /api/auth/login · GET/PUT /api/auth/me · POST /api/admin/doctors (form-data with card) · GET /api/admin/doctors · PUT/DELETE /api/admin/doctors/:id · GET /api/admin/patients · PATCH /api/admin/patients/:id/block · GET/POST/DELETE /api/specialties · GET /api/admin/stats |
| 2 | Doctors | doctors.* | GET /api/doctors?specialty=&name=&area= · GET /api/doctors/:id · GET /api/doctors/:id/slots?date= · PUT /api/doctors/me/clinic · PUT /api/doctors/me/schedule |
| 3 | Appointments | appointments.* | POST /api/appointments · GET /api/appointments/me · PATCH /api/appointments/:id/cancel · GET /api/doctors/:id/alternatives?date= · POST /api/waiting-list · GET /api/waiting-list/me |
| 4 | Records | records.* | GET /api/patients/:id/history · POST /api/diagnoses (form-data with files) · GET /api/records/me · POST /api/reviews |
| 5 | Notifications + Dashboard | notifications.* | GET /api/notifications · PATCH /api/notifications/:id/read · GET /api/doctors/me/appointments?date= · PATCH /api/appointments/:id/status · GET /api/doctors/me/stats · reminder cron |

## Database (12 tables, same as the documentation mapping)
users (id, name, email unique, password, phone, role: patient|doctor|admin, status: active|blocked) ·
patients (userId, dateOfBirth, gender) · doctors (userId, specialtyId, bio, fee, dailyLimit, syndicateCard, addedById, addedAt) ·
specialties (id, name) · clinics (id, doctorId unique, name, address, latitude, longitude, phone, whatsapp, facebook, instagram) ·
schedules (id, doctorId, dayOfWeek, startTime "09:00", endTime "17:00", slotMinutes) ·
appointments (id, patientId, doctorId, date, time, status: confirmed|completed|cancelled|no_show, bookingType: online|contact_clinic, createdAt; unique doctorId+date+time) ·
waitingList (patientId, doctorId, date, position, status: waiting|notified|booked|expired) ·
diagnoses (id, appointmentId unique, description, prescription, notes) · attachments (id, diagnosisId, fileName, filePath, fileType) ·
reviews (id, appointmentId unique, rating 1-5, comment) · notifications (id, userId, title, message, isRead, createdAt)

Keep time values as strings ("09:00") and dates as "YYYY-MM-DD" strings, so they are easy to compare and explain.

## Rules (simple versions)
1. **Register** creates a patient only. **POST /api/admin/doctors** (admin only) creates the doctor:
   - It requires a syndicate card file (pdf/jpg/png, max 10 MB) and a specialty.
   - It generates a random 8-character password and e-mails it with `utils/email.js` (nodemailer). In development the e-mail is only logged to the console.
2. **Login** returns a JWT with `{ id, role }`. Blocked users cannot log in. `allowRoles('admin')` and similar protect the routes.
3. **Slots** (`utils/slots.js`): build times from startTime to endTime every slotMinutes for that weekday, then remove booked times. If the booked count has reached dailyLimit, return an empty list with `full: true`.
4. **Booking**:
   - Check that the slot is free and the day is not full, then create the appointment.
   - The unique key on doctorId+date+time also prevents double booking; catch its error and return "slot already taken".
   - When the booking succeeds, call `notify()` for the patient and the doctor.
5. **When the day is full**:
   - Return up to 5 doctors of the same specialty who have free slots that day.
   - The patient can also join the waiting list (position = count + 1).
6. **Waiting list**:
   - On a cancellation, the first waiting patient gets a notification and status `notified`.
   - He books the normal way within 30 minutes.
   - The expiry is checked when he tries to book, so no extra cron is needed for it.
7. **History**: a doctor sees a patient's history only if that patient has an appointment with him; otherwise return 403.
8. **Diagnosis**: save it with the attachments (multer, files in /uploads), set the appointment to `completed`, and notify the patient.
9. **Review**: the patient can rate only his own completed appointment, and only once.
10. **Notifications**:
    - `notify(userId, title, message)` inserts a row.
    - The client checks `/api/notifications` every 30 seconds (polling, no websockets).
    - Booking confirmations and reminders are also e-mailed.
11. **One cron job** (node-cron, every day at 8 pm): e-mail and notify patients who have an appointment tomorrow.
12. **Export medical history**: a "Print / Save as PDF" button that calls `window.print()` on the records page.

## UI / UX (most important)
**Look**
- **Font:** Cairo from Google Fonts; it supports Arabic and English.
- **Colors (Tailwind):**
  - primary `blue-600`, background `slate-50`, cards `white`, text `slate-800` / `slate-500`
  - success `green-600`, warning `amber-500`, danger `red-600`
- **Cards:** white, `rounded-xl shadow-sm border border-slate-200 p-5`.
- **Layout:** page container `max-w-6xl mx-auto px-4 py-6`.
- **Spacing:** plenty of space and one clear visual hierarchy per page: a big title, then a short helper sentence, then the content.
- **Status badges:** always the same colors everywhere.

  | Status | Color |
  |---|---|
  | confirmed | blue |
  | completed | green |
  | cancelled | gray |
  | no_show | amber |
  | blocked | red |
  | waiting | purple |

**Shared components** (shadcn in `components/ui/`, our small wrappers in `components/shared/`; reuse them everywhere):
Button (primary / secondary / danger, with a loading state) · Input, Select and Textarea (with label and error text) · Card · Badge · Modal (for confirmations) · Toast (success / error messages) · Spinner · EmptyState (icon + message + action button) · PageHeader (title + subtitle + main action).

**Rules for every page**
- One clear primary action per page, placed where the eye goes first.
- Show three states:
  - **Loading:** a spinner or skeleton.
  - **Empty:** a friendly message plus the next step, e.g. "No appointments yet – Find a doctor".
  - **Error:** a clear message plus a retry button.
- **Forms:**
  - A label above each field, a helpful placeholder, and the error under the field in plain words.
  - Disable the submit button while sending and show a spinner on it.
  - Keep the entered data if the request fails.
- **Results:** after every action, show a toast ("Appointment booked for Sun 15 Nov, 10:20") and move the user to the logical next page.
- **Dangerous actions** (cancel, delete, block) always open a confirmation modal that explains the result.
- **Dates and times** are shown in a friendly format (Sun, 15 Nov · 10:20 AM), never in the raw database format.
- **Mobile-first:** the Navbar collapses into a menu, tables become stacked cards on small screens, and buttons are at least 44 px high.
- **Accessibility:** every input has a label, focus rings are visible, the contrast is good, and icons have text next to them.

**Key flows (make these feel easy)**
- **Home (visitor):**
  - A big search box (specialty + area) with one "Find a doctor" button.
  - Specialty shortcuts below it, and a short "How it works" in 3 steps.
- **Search results:**
  - Doctor cards with photo placeholder, specialty, fee, rating, area and "next free day".
  - Filters on the side (on mobile: on top). Clicking a card opens the profile.
- **Doctor profile:**
  - **Left side:** info, the map and contact buttons (Call / WhatsApp / Facebook / Instagram), always visible. This is the second booking type.
  - **Right side:** booking in **3 clear steps** with a step indicator:
    1. pick a date (next 7 days as chips)
    2. pick a time (slot chips; taken slots look disabled)
    3. confirm with a summary card
  - A visitor who presses Book is sent to login and comes back to the same doctor afterwards.
- **Fully booked day:**
  - Never a dead end. Show a notice card: "Dr. X is fully booked on this day."
  - Below it: alternative doctors of the same specialty (as cards with a Book button) and a "Join waiting list" button that shows the position after joining.
- **Patient:**
  - "My appointments" with Upcoming / Past tabs, a status badge, Cancel (with confirmation) and Rate after completion.
  - "My records" with a timeline of visits, the diagnosis, file downloads and a Print button.
- **Doctor:**
  - The dashboard is the home page after login: today's counters plus today's list in time order, with "Open history" and "Write diagnosis".
  - The diagnosis page shows the patient history on the left and the form on the right.
  - The clinic and schedule pages have simple forms: a day toggle plus from/to time per day, the slot length and the daily limit.
- **Admin:**
  - The home page shows statistics cards.
  - "Add doctor" is a simple form plus card upload, with a checkbox "I checked the syndicate card".
  - Doctors and patients are searchable lists with Block / Remove actions behind confirmations.
- **Notifications:** a bell in the Navbar with an unread count and a dropdown list; clicking an item marks it read and opens the related page.
- **After login,** each role lands on its own home page:

  | Role | Home page |
  |---|---|
  | patient | search |
  | doctor | dashboard |
  | admin | statistics |

## Conventions
- **Responses**:
  - Success: `res.json({ data })`.
  - Errors: `res.status(code).json({ message })`, plus one error handler in index.js.
  - Validation is manual `if` checks at the top of each controller. Keep it readable.
- **Config**: use `.env` with DATABASE_URL (Supabase pooled, port 6543), DIRECT_URL (Supabase direct, port 5432, for migrations), JWT_SECRET, SMTP_*, CLIENT_URL, and keep a matching `.env.example`.
- **UI**: follow the UI / UX section above.
- **Git**: one branch per task (`feature/<module>-<task>`), small commits, never push to `main` directly.
- **Testing**: a Postman collection in `docs/` for every endpoint. Add a few simple Jest + Supertest tests only for login, booking and the history rule.

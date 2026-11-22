# Clinical – Backend (API)

The API of **Clinical**, a clinic appointment booking website (CS508 graduation project).
The website itself lives in the `Clinical` folder.

**Stack:** Node.js + Express 5, Prisma + PostgreSQL (Supabase), bcryptjs, jsonwebtoken, multer, nodemailer, node-cron, cors, dotenv. JavaScript (ES modules) only.

## Run it

1. Copy `.env.example` to `.env`. From Supabase (Project Settings → Database → Connection string) fill in:
   - `DATABASE_URL`: the pooled connection (port 6543, ends with `?pgbouncer=true`), used by the app.
   - `DIRECT_URL`: the direct connection (port 5432), used by migrations.
2. Install, create the tables and add the first data:

```bash
npm install
npx prisma migrate deploy   # creates the 12 tables
npm run db:seed             # admin, specialties and demo data
npm run dev                 # http://localhost:5001/api/health
```

The tables already exist on the team's Supabase project, so usually only `npm install` and `npm run dev` are needed.

## Deploy on Vercel

This repository is ready to deploy as a Vercel Serverless Function. The API health-check URL is:

```
https://YOUR-PROJECT.vercel.app/api/health
```

Before redeploying, add these **Production** environment variables in Vercel →
Project → Settings → Environment Variables. Do not commit their values to Git:

| Variable | Value |
|---|---|
| `DATABASE_URL` | Supabase pooled connection string (port `6543`, with `pgbouncer=true`) |
| `DIRECT_URL` | Supabase direct connection string (port `5432`) |
| `JWT_SECRET` | a long, random secret |
| `CLIENT_URL` | the deployed frontend URL, without a trailing slash; use commas to allow more than one origin |
| `CRON_SECRET` | a different long, random secret |
| `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM` | production mail provider values, if e-mail is enabled |

`vercel.json` runs the reminder task at 18:00 UTC every day (20:00 in Cairo
while Egypt is UTC+2). Vercel calls the protected `/api/cron/reminders` endpoint;
do not call it from the frontend.

### Important: uploaded files

Vercel Functions have no persistent writable `uploads/` directory. The current
Multer disk storage is suitable for local development only. Before enabling
doctor-card or diagnosis-file uploads in production, move those uploads to
durable object storage (for example a private Vercel Blob, Supabase Storage, or
S3) and store the resulting URL/key in the database. Do not store medical files
in a public bucket.

The seed creates these accounts:

| Role | E-mail | Password |
|---|---|---|
| Admin | admin@clinical.com | Admin@123 |
| Doctor (demo) | doctor@clinical.com | Doctor@123 |
| Patient (demo) | patient@clinical.com | Patient@123 |

In development `SMTP_HOST` is empty, so e-mails (doctor passwords, booking confirmations, reminders) are **printed in the console**.

## Scripts

| Command | What it does |
|---|---|
| `npm run dev` | start with auto-reload (nodemon) |
| `npm start` | start normally |
| `npm run db:migrate` | after changing `prisma/schema.prisma`: create and apply a new migration |
| `npm run db:seed` | add the admin, specialties and demo data |
| `npm run db:reset` | delete everything and start again (**deletes all Supabase data**) |
| `npm test` | Jest + Supertest tests: login, booking, history rule (needs the seeded database; they add and then remove one booking) |

## Folders

```
prisma/
  schema.prisma        the 12 tables
  seed.js              admin + specialties + demo doctors / patient
src/
  index.js             express app, routes, one error handler, starts the reminder job
  prisma.js            the Prisma client
  middleware/          auth.js (verifyToken, allowRoles), upload.js (multer)
  utils/               email.js, notify.js, slots.js (dates, times and free slots)
  routes/              one file per module
  controllers/         one file per module (same names)
uploads/               uploaded files, served at /uploads
tests/                 api.test.js
docs/                  Clinical.postman_collection.json
```

Flow: **route → controller → prisma**. Success responses are `{ data }`, errors are `{ message }` with the right status code.

## Modules

| # | Module | Files |
|---|---|---|
| 1 | Auth + Admin | `auth.*`, `admin.*` |
| 2 | Doctors | `doctors.*` |
| 3 | Appointments + waiting list | `appointments.*` |
| 4 | Records (history, diagnoses, reviews) | `records.*` |
| 5 | Notifications + doctor dashboard + reminder cron | `notifications.*` |

Import `docs/Clinical.postman_collection.json` into Postman to try every endpoint. Run the three "Login as …" requests first: they save the tokens.

## Small notes

- Row Level Security is turned on for every table (see the first migration). The backend connects as the `postgres` user, which is not limited by RLS, but Supabase's public Data API (anon key) cannot read the tables. Keep RLS on for any new table.
- Text search uses `mode: "insensitive"`, because PostgreSQL compares text with upper / lower case.
- Dates are `"YYYY-MM-DD"` strings and times are `"HH:MM"` strings.
- A cancelled appointment frees its time: when someone books that time again, the old cancelled row is removed so the unique key (doctorId + date + time) allows the new booking.
- Two small additions to the documented tables: `notifications.link` (the page that opens when the notification is clicked) and `waitingList.notifiedAt` (to check the 30-minute window).

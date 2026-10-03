# School Equipment Reservation System

A full-stack reservation app for school equipment (projectors, microphones,
speakers, laptops, extension cords): teachers book items for a date, time
window and room; the system refuses anything that would double-book the same
equipment or room; admins manage the inventory, rooms, and accounts.

**Stack:** Next.js 14 (App Router, TypeScript) · Prisma · PostgreSQL · bcrypt
password hashing · signed httpOnly JWT session cookies · Tailwind CSS.

---

## 1. Prerequisites

- **Node.js 18.18+** (check with `node -v`)
- **A PostgreSQL database.** Any of these work and all have a free tier:
  - [Neon](https://neon.tech) or [Supabase](https://supabase.com) (hosted, zero local setup)
  - [Railway](https://railway.app)
  - A local Postgres install (`createdb school_equipment`)

## 2. Setup

```bash
# 1. Install dependencies
npm install

# 2. Configure environment variables
cp .env.example .env
```

Open `.env` and fill in two values:

```bash
DATABASE_URL="postgresql://user:password@host:5432/school_equipment?schema=public"
SESSION_SECRET="paste a long random string here"
```

Generate a `SESSION_SECRET` with:
```bash
openssl rand -base64 32
```

```bash
# 3. Create the database tables
npm run db:push

# 4. Load demo data (accounts, equipment, rooms, sample bookings)
npm run db:seed

# 5. Start the dev server
npm run dev
```

Open **http://localhost:3000** — you'll land on the sign-in screen.

### Demo accounts (all seeded by step 4)

| Role          | Email                   | Password      |
|---------------|-------------------------|----------------|
| Administrator | admin@school.edu        | admin123       |
| Teacher       | santos@school.edu       | teacher123     |
| Teacher       | cruz@school.edu         | teacher123     |
| Teacher       | garcia@school.edu       | teacher123     |
| Teacher       | villanueva@school.edu   | teacher123     |

## 3. Opening it in VS Code

```bash
code .
```

Everything is plain TypeScript/React — no special VS Code extensions
required, though the built-in Tailwind CSS IntelliSense extension is a nice
addition for editing `app/globals.css` and the component class names.

Useful folders:
- `app/` — pages (`app/(auth)/...`, `app/(app)/...`) and API routes (`app/api/...`)
- `components/` — the actual UI: calendar, reservation wizard, admin screens
- `lib/` — the backend logic: `conflicts.ts` (double-booking prevention),
  `auth.ts`/`session.ts` (login), `datetime.ts` (timezone-safe date handling),
  `validators.ts` (server-side input validation)
- `prisma/schema.prisma` — the database model
- `prisma/seed.ts` — the demo data

## 4. How double-booking prevention works

This is the one requirement that has to be bulletproof, so it isn't just a
frontend check. Every create/edit goes through `lib/conflicts.ts`, which:

1. Re-reads any reservations that overlap the requested time window directly
   from the database at the moment of saving (not from whatever the browser
   last fetched).
2. Runs inside a Postgres **SERIALIZABLE transaction**, so if two teachers
   submit overlapping requests at the exact same instant, Postgres itself
   aborts one of them with a serialization error — which is caught and
   retried once as a fresh conflict check, rather than silently letting both
   through.
3. Returns the same kind of message the brief asks for, e.g. *"Projector 01
   is already reserved from 9:00 AM to 11:00 AM on September 23, 2026."*

Rooms get the identical treatment. Editing a reservation excludes that
reservation's own previous slot from the conflict check, so moving a booking
(or not moving it) never flags itself.

## 5. Timezone handling

Dates/times are combined and read back using a fixed Asia/Manila (UTC+8, no
DST) offset defined once in `lib/datetime.ts`, rather than relying on
whichever timezone the Node server process or a viewer's browser happens to
be set to — those frequently differ (e.g. a server deployed to a US region)
and would otherwise silently shift displayed times. If deploying for a school
in a timezone that *does* observe daylight saving, replace
`SCHOOL_TZ_OFFSET_MINUTES` in that file with a proper IANA-zone lookup (e.g.
via the `luxon` or `date-fns-tz` packages) — everything else stays the same.

## 6. Deploying

**Vercel** (simplest): push this to a GitHub repo, import it in Vercel, add
`DATABASE_URL` and `SESSION_SECRET` as environment variables, deploy. Run
`npx prisma migrate deploy` (or `db push`) and `npm run db:seed` once against
the production database — Vercel's deploy shell or a local `.env.production`
pointed at the hosted DB both work.

**Any Node host** (Railway, Render, your own server): `npm run build` then
`npm run start`, with the same two environment variables set.

## 7. Known simplifications (documented, not hidden)

- **Password reset** (`app/api/auth/reset/route.ts`) sets a new password as
  soon as the email is confirmed, with no verification step — there's no
  email-sending infrastructure wired up. A real deployment should email a
  signed, expiring, single-use link instead and only accept a new password
  once that link is opened; the comment in that file marks exactly where to
  swap the logic.
- **Email notifications** generally aren't sent (only in-app toasts) for the
  same reason — see `app/(app)/admin/settings/page.tsx` for the full list of
  what is/isn't wired up.
- Reservations store the activity name and purpose as one combined
  `purpose` field (`"Activity — Purpose"`), split back apart for display in
  `lib/types.ts`'s `splitPurpose()`. A dedicated `activity` column would be
  a cleaner schema if extending this further.

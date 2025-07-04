# Reordr MVP Backlog

Below is a ready-to-paste backlog for the Reordr MVP.  
I grouped stories under six lightweight epics, included acceptance criteria, and flagged clear dependencies.  
If you assign story points, the bracketed `[ ]` column is left blank for your team.

## Epic A — Project Bootstrap & Dev Infrastructure

- **A-1 Create Next.js repo & CI** `[ ]`
  - Scaffold repo with `pnpm create next-app --ts --tailwind`.
  - Set up GitHub ⇢ Vercel auto-deploy.
  - **AC:** Push to `main` triggers Vercel preview build; default home page loads.
- **A-2 Set env-var scheme** `[ ]`
  - Define `.env.local.example` keys: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `GOOGLE_MAPS_API_KEY`, etc.
  - **AC:** `pnpm dev` fails fast if any required var is missing.
- **A-3 Add ESLint + Prettier + Husky** `[ ]`
  - Pre-commit hook runs lint & format.
  - **AC:** A failing lint blocks commit; passing commit auto-formats.

## Epic B — Supabase Auth & User Context

- **B-1 Provision Supabase project** `[ ]`
  - Create project, enable email+password & magic-link auth.
  - **AC:** Console shows Auth tab configured; no social providers enabled.
- **B-2 User provider wrapper** `[ ]`
  - Wrap App Router with `<SessionContextProvider>` (supabase-auth-helpers).
  - **AC:** `useUser()` returns user object after login.
- **B-3 Auth UI** `[ ]`
  - `/login` screen: email+password sign-up/login & magic-link.
  - **AC:** Invalid creds show error; magic-link email arrives via Supabase.

## Epic C — Google Places Integration

- **C-1 Nearby search API route** `[ ]`
  - POST `/api/places/nearby` accepts `{ lat, lng }`; proxies to Google Places; returns top 10.
  - **AC:** Unit test returns array of place objects with `place_id`, `name`, `lat`, `lng`.
- **C-2 Place picker component** `[ ]`
  - Autocomplete dropdown fed by C-1.
  - **AC:** Typing "piz" near `40.73/-73.99` lists "Prince St Pizza" etc.; selecting item populates form.

## Epic D — Check-In CRUD

- **D-1 DB schema migration** `[ ]`
  - Create `check_ins` table per PRD (100/500 char limits).
  - **AC:** Supabase migration runs idempotently on empty DB.
- **D-2 Create Check-In API route** `[ ]`
  - POST `/api/checkins` validates body & inserts row.
  - **AC:** Returns 201 + new record; rejects unauthenticated.
- **D-3 Edit/Delete Check-In routes** `[ ]`
  - PUT `/api/checkins/:id`, DELETE `/api/checkins/:id` (owners only).
  - **AC:** Editing updates `updated_at`; deleting removes row.
- **D-4 Check-In form UI** `[ ]`
  - Page `/check-in` with: Place picker → Dish text (countdown 100) → Note textarea (countdown 500) → Submit.
  - **AC:** Success toast, redirect to History. Required fields enforced client- & server-side.

## Epic E — Personal History & Venue Pages

- **E-1 History list screen** `[ ]`
  - `/history`: paginated reverse-chron list; search by venue name.
  - **AC:** New check-ins appear instantly (SWR or live query).
- **E-2 Edit/Delete from history** `[ ]`
  - Inline kebab menu → Edit modal (dish/note), Delete confirm.
  - **AC:** Updates persist and list rerenders without full refresh.
- **E-3 Venue detail page** `[ ]`
  - Route `/venue/[place_id]` shows chips for each dish ordered, notes, timestamps.
  - **AC:** Only current user's data visible; link back to Google Maps.

## Epic F — Analytics & Deployment

- **F-1 PostHog self-host setup** `[ ]`
  - Run PostHog via Supabase "functions" addon or Docker on Free Tier.
  - **AC:** Frontend captures `app_loaded`, `check_in_created` events.
- **F-2 Production deploy & domain** `[ ]`
  - Attach chosen domain (e.g., reordr.app) to Vercel; set prod env vars.
  - **AC:** `https://reordr.app` resolves + SSL grade A.

---

### Dependencies / Sequencing

1. B-1 before any route requiring auth.
2. C-1 before Place picker UI.
3. D-1 before API CRUD stories.
4. D-2 / D-3 before E-1 list renders real data.

### Nice-to-Haves (icebox)

- Photo upload (Supabase Storage).
- PWA install banner & offline form caching.
- Auto-refresh Places name/address on edit.

Copy these stories into Jira/Linear/Clubhouse, slot point estimates, and you're ready to sprint.  
Ping me whenever you need detail wireframes, code snippets, or test cases — happy building!

✅ Updated PRD — Reordr (v1)

Section	Detail
Tag-line	“Remember the dish you loved—so you can re-order it.”
Problem	Venue-level ratings & long reviews don’t help diners recall exactly what they ordered last time.
Solution (MVP)	Private web app: GPS → pick venue (Google Places) → type dish + note → personal history & venue pages. Everything stays private until later social phases.


⸻

1. Goals & Success Metrics

Objective	Metric	90-day Target
Capture meal moments	Dish check-ins / WAU	≥ 1.5
Encourage reuse	Return-visit rate	≥ 15 %


⸻

2. Core User Flows (MVP)
	1.	Auth & Onboarding – Supabase email + password & magic-link.
	2.	Check-In – browser geo → Google Places Nearby → select venue → enter Dish (≤ 100 chars) + Note (≤ 500 chars).
	3.	History & Search – list, search filter, venue pages.
Data is 100 % private; edits allowed anytime (full timestamp history).

⸻

3. Functional Requirements

#	Requirement
FR-1	Supabase Auth
FR-2	Google Places Nearby search
FR-3	CRUD check-ins table (schema below)
FR-4	My History page
FR-5	Venue Detail page (user-scoped)


⸻

4. Tech & Ops

Layer	Choice
Frontend	Next.js 19 (App Router, React)
Backend	Next.js Route Handlers
DB/Auth	Supabase Postgres + Auth
Third-party	Google Places
Hosting	Vercel + Supabase
Analytics	PostHog self-hosted in Supabase


⸻

5. Data Model

-- users
id uuid primary key
email text
created_at timestamptz default now()

-- check_ins
id uuid primary key
user_id uuid references users(id)
place_id text
place_name text
lat float8
lng float8
dish_text varchar(100)
note_text varchar(500)
visit_datetime timestamptz
created_at timestamptz default now()
updated_at timestamptz default now()

(Optional places cache table updated lazily on new check-ins.)

⸻

6. “Ship-Tonight” Task List

Step	Notes
0. Bootstrap repo	pnpm create next-app@latest --ts --tailwind
1. Supabase project & .env	URL, anon key, service key
2. DB migration	Supabase SQL editor or drizzle
3. Auth wiring	<Auth.UserProvider>; email + pwd + magic-link
4. Google Places util	/api/places?lat=…&lng=…
5. Check-In form	Insert into check_ins
6. History page	/history list & venue filter
7. Deploy to Vercel	set env vars
8. Dog-food & iterate	open GitHub issues for polish


⸻


Everything else is locked. Once you’ve pushed the first commit and stood up the Supabase project, we can iterate rapidly on UX polish, PostHog event tracking, and (next phase) photo uploads.

Ping me whenever you need code snippets, schema tweaks, or roadmap adjustments—happy building!

# Fivesquare Backlog

**Product thesis:** Yelp/Foursquare remember _places_; Fivesquare remembers _what you ordered there and whether you'd order it again_. The core question the app must answer instantly: _"I'm at (or near) this place — what did I get last time, and was it good?"_

**Secondary goal:** use the problem to explore geographic data modeling (place normalization, PostGIS, spatial indexing) — but only when a user-facing feature needs it.

**How to work this backlog:**

- One story = one PR. Ship in order; each story assumes the previous ones landed.
- Every story states its user-visible outcome. If you finish a story and the user experiences nothing new, the story was done wrong (exception: S3, an explicitly infra PR).
- Existing conventions: Next.js 15 App Router, REST route handlers (no server actions), Drizzle + Neon, NextAuth v5 credentials/JWT, Vitest colocated tests, pnpm. Match them.
- Every story includes tests (route handlers and lib logic at minimum) and must pass the existing CI gates: `tsc`, lint, prettier, `test:run`, `build`.
- Schema changes go through drizzle-kit migrations committed to `drizzle/`.

**Current state (baseline):** working slice of register/login → check-in (Google Places nearby search + free-text dish + note) → history with edit/delete. Single `check_ins` table with denormalized `place_id`/`place_name`/`lat`/`lng`. No rating, no places table, no photos, no map.

---

## Phase 1 — Core loop: verdicts

### S1 · Identity & honesty pass

**User sees:** The app is called Fivesquare everywhere — browser tab, landing page, login. The landing page describes what the app actually does today (no photos claim).

**Scope**

- Rename package from `nextjs-temp`; set real `metadata` (title, description) in the root layout; favicon if trivial.
- Rewrite landing copy around the real pitch ("remember what you ordered and whether you'd order it again"). Remove the photos claim until S9 ships.
- Sweep any remaining scaffold text.

**Not in scope:** logo design, custom fonts, redesign. Copy and metadata only.

**Acceptance**

- Tab title reads Fivesquare on every page; landing page makes no false claims.

---

### S2 · "Order again?" verdict

**User sees:** Every check-in records a verdict — **Yes / Maybe / No** to "Would you order this again?" — chosen at check-in time, editable later, and displayed prominently in history.

This is the heart of the product. The verdict is decision-shaped on purpose (not stars): it answers the diner question directly and later powers "% would order again" rankings.

**Scope**

- Schema: `verdict` column on `check_ins`, Postgres enum (`yes` | `maybe` | `no`), **nullable** (historic rows have no verdict; the form requires it going forward).
- While touching the table: convert `visit_datetime`, `created_at`, `updated_at` to `timestamptz`. Do it now while the table is small — it bites later when travel/near-me features arrive.
- Check-in form: verdict as a required, large, three-option segmented control — this is the most important input on the form, style it that way (color-code: green/amber/red or similar within Tailwind idiom).
- History: verdict badge on each item; edit modal can set/change it.
- API: create/update routes accept and validate the verdict; GET returns it.

**Acceptance**

- New check-in requires a verdict; history shows it; editing an old (null-verdict) check-in lets you add one.
- Route tests cover validation (rejects bad values, allows null only via legacy rows).

---

## Phase 2 — Places become real

### S3 · Migrate to Google Places API (New) — infra PR

**User sees:** Nothing changes (search behaves the same or slightly better). This is the backlog's one honest infrastructure PR, and it's sequenced _before_ the places table so we don't build persistent data on an endpoint we're abandoning.

**Why now:** the app uses the legacy `nearbysearch/json` endpoint, which Google has deprecated. S4 will start persisting place data enriched at insert time; do the provider swap first so places are created rich once, instead of backfilled then re-enriched.

**Scope**

- Swap `google-provider.ts` to Places API (New) (`places:searchNearby` / `searchText`, field masks). The provider abstraction in `src/lib/places/` should contain the change.
- Extend the provider's returned shape with fields S5 will want: formatted address, primary type/category. Keep the existing ranking logic (70% proximity / 30% relevance) working.
- Update provider tests; verify API key restrictions/billing for the new API (note any manual console steps in the PR description).

**Acceptance**

- Place search works end-to-end on the new API; legacy endpoint code deleted; tests updated.

---

### S4 · Places table + place pages (minimal)

**User sees:** Place names in history are now links. Clicking one opens `/places/[id]` — a page for that place listing every visit there: date, dish, verdict, note. First real payoff of the app: your history _at a place_.

**Scope**

- Schema: `places` table — **internal UUID PK**, `google_place_id` (unique, not null), `name`, `formatted_address`, `primary_type`, `lat`, `lng`, timestamps. Never use the Google ID as PK (provider independence, Google's place-ID churn, future manual places).
- `check_ins.place_uuid` FK → places. Backfill migration: dedupe existing check-ins by `google_place_id`, take the most recent name/coords per place, insert, link. Keep the old denormalized columns for one release as a safety net; note their removal in S5.
- Write path: check-in creation upserts the place (by `google_place_id`) then references it.
- `/places/[id]`: auth-gated, server component; place name + address, reverse-chron visit list (date, dish, verdict badge, note), Google Maps deep link.
- **Seed script** (`pnpm db:seed`): fake user + ~20 check-ins across ~6 places with mixed verdicts. Not a story of its own — build it here; it pays for itself on every subsequent schema change.

**Acceptance**

- Backfill migration is idempotent and tested against duplicate-place_id fixtures with drifting names.
- New check-ins create/reuse places correctly; place page renders visits; history links to it.

---

### S5 · Dish rollup on place pages

**User sees:** The place page leads with a **dish summary**: each dish you've ordered there, grouped, with visit count and latest verdict — "Club sandwich · 3 visits · You'd order it again ✅". The visit log moves below it. This is the "should I get the club sandwich?" screen.

**Scope**

- Grouping is **read-time only** — a pure function in `src/lib/dishes/` (lowercase, trim, collapse whitespace, strip trailing punctuation). **No `dishes` table, no stored slug** — canonicalization rules aren't knowable until real data exists; a read-time function is trivially changeable and becomes the seed of dish-entity work at the horizon.
- Unit-test the grouping function hard (casing, whitespace, punctuation variants map together; distinct dishes don't).
- Verdict per group: latest visit's verdict wins; show count of visits.
- Drop the deprecated denormalized place columns from `check_ins` (follow-through from S4).

**Acceptance**

- "Club Sandwich" and "club sandwich " group together; place page shows dish summary above visit log.

---

## Phase 3 — Geo (the marquee)

### S6 · PostGIS + "Near me" home screen

**User sees:** The app's front door (post-login landing, replacing the bare redirect to history) becomes: **"Places you've been near you"** — your places sorted by distance from current location, each with its top dish and verdict. Walk down a street, open the app, instantly know "that's the place with the good burger." This is the marquee feature — the whole product in one screen — not a PostGIS learning exercise. It's also the geo-learning payload: real spatial queries with real motivation.

**Scope**

- Enable PostGIS on Neon (`CREATE EXTENSION postgis` migration).
- `places.location` as `geography(Point, 4326)`, populated from lat/lng (keep the scalar columns), **GiST index**. Write path sets both.
- Query: user's places within a radius (start ~2km, widen if empty) ordered by `ST_Distance`, joined to their latest-dish/verdict summary. Use Drizzle `sql` fragments where the ORM lacks PostGIS support.
- Client geolocation with a graceful denied-permission fallback (fall back to history-style list with a prompt to enable location).
- `/history` remains at its route; nav links Home / Check in / History.

**Not in scope:** enriching the near-me cards beyond place + distance + top dish/verdict. Resist. Keep the PR small.

**Acceptance**

- With seeded places, near-me returns distance-ordered results using the GiST index (verify with `EXPLAIN` during dev); denied geolocation degrades gracefully.

---

### S7 · Map view

**User sees:** A map of everywhere they've been — pins for each place, colored by verdict of your top dish there; tap a pin for a popup (place name, top dish, verdict) linking to the place page. Toggle between list and map on the home screen.

**Scope**

- **MapLibre GL JS** with a free tile source (e.g. OpenFreeMap or Protomaps) — no Google Maps JS SDK, no token-metered vendor lock.
- Reuse the S6 places-with-summary query; add a bounding-box variant (`ST_MakeEnvelope` / `&&` operator) so the map fetches by viewport.
- Client-only component (dynamic import, no SSR); cluster or dedupe overlapping pins only if trivial with the chosen lib.

**Acceptance**

- Map renders user's places, pins reflect verdicts, popups link to place pages; works on mobile viewport.

---

## Phase 4 — Memory gets richer

### S8 · History search & filters

**User sees:** History (and place pages get it free if the queries are shared) is searchable — text search over dish and place name, filter chips by verdict, filter by place. "Where was that great pad thai?" is now answerable.

**Scope**

- Server-side filtering on `GET /api/checkins` (query params: `q`, `verdict`, `placeId`). Postgres `ILIKE` is sufficient at this scale — do not reach for full-text search or embeddings.
- Debounced search input + verdict filter chips on history; empty-state copy.

**Acceptance**

- Search matches dish and place name case-insensitively; filters compose; URL reflects filter state (shareable/back-button-safe).

---

### S9 · Dish photos (Cloudflare R2)

**User sees:** Add a photo when checking in; photos appear as thumbnails in history and on place-page visit entries, tap to view full-size. Restore the photos claim to the landing page.

**Scope**

- **Cloudflare R2** (S3-compatible, zero egress fees): bucket + presigned-PUT upload flow. API route issues presigned URLs (auth-gated, content-type/size limits — e.g. images only, ≤10MB); client uploads directly to R2; check-in stores the object key.
- Schema: `photo_key` (nullable text) on `check_ins`. One photo per check-in for now — resist galleries.
- Serving: public bucket via R2 custom domain or `r2.dev`, or presigned GETs — pick the simplest that works and document the choice.
- Client-side downscale before upload (canvas, max ~2000px) to keep objects small.
- **Orphan policy (decide, don't drift):** deleting a check-in deletes the R2 object; abandoned uploads (form never submitted) are accepted garbage at solo scale — write this down in the code near the upload route.

**Acceptance**

- Photo upload → visible in history and place page; check-in delete removes the object; upload rejects non-images/oversize.

---

## Phase 5 — Horizon (sketched, not specified)

Not fully spec'd; each needs its own design pass when its time comes. Sequencing intent only. **Standing design constraint until then:** nothing in Phases 1–4 may assume check-ins are private-forever (e.g., don't bake `userId = session.user` into deep query layers where a visibility check can't later be inserted).

- **H1 · Visibility + profiles.** `visibility` enum on check-ins (`private` default | `friends` | `public`); minimal public profile page.
- **H2 · Friends + feed.** Follow model, reverse-chron friend feed of non-private check-ins. First real multi-user surface; revisit auth (add Google OAuth — email is already the unique key, so linking is tractable; **don't build password reset before this** — that effort dies when OAuth arrives).
- **H3 · Dish canonicalization → rankings.** Promote the S5 read-time grouping into a real dish entity informed by a year of actual data; then the payoff: **"Best burger near you"** — dishes ranked by % would-order-again across users, spatially filtered. The Foursquare-beating feature, and the reason the verdict is a verdict and not stars.

---

## Standing engineering notes

- **Google Places ToS:** `place_id` may be cached indefinitely; other place details (address, hours, types) are contractually cacheable ~30 days. Treat stored place details as refreshable-with-TTL, not permanent truth. Hobby-scale risk is low; design as if it isn't.
- **Dead code cleanup, opportunistic:** `accounts`/`sessions`/`verificationTokens` tables are unused under credentials+JWT — keep them (OAuth arrives in H2) but remove the unused `@auth/pg-adapter` dependency whenever convenient.
- **PostHog** stays out until there's a question analytics would answer.

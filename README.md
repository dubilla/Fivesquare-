# The Usual

_"I'll have the usual."_ A personal food-memory app: remember what you ordered at each place and whether you'd order it again.

Brand: **The Usual**. "Fivesquare" remains the in-house project/repo codename.

## Features

- Check in at a place and record the dish you ordered
- Add personal notes about your experience
- View history of check-ins and venue visits
- Search places with Google Places integration

## Tech Stack

- **Framework**: Next.js 15 with App Router
- **Language**: TypeScript
- **Styling**: Tailwind CSS
- **Database**: Neon (Postgres)
- **Authentication**: TBD
- **Maps**: Google Places API
- **Analytics**: PostHog

## Getting Started

1. Install dependencies:

   ```bash
   pnpm install
   ```

2. Copy environment variables:

   ```bash
   cp .env.local.example .env.local
   ```

3. Set up your environment variables in `.env.local`:
   - `DATABASE_URL` (your Neon connection string)
   - `GOOGLE_MAPS_API_KEY`

4. Run the development server:

   ```bash
   pnpm dev
   ```

5. Open [http://localhost:3000](http://localhost:3000) in your browser.

## Development

This project follows the roadmap in `BACKLOG.md` — one story per PR, shipped in order.

## Deployment

Hosted on **Vercel** (project `fivesquareapp`), backed by **Neon** Postgres. Deploys are driven by the Vercel GitHub integration:

- **Open a PR** → preview deployment.
- **Merge to `main`** → production deployment.

**Database migrations run automatically on production deploys.** The `vercel-build` script runs `scripts/migrate-on-deploy.mjs` (which applies pending Drizzle migrations via `drizzle-kit migrate`) before `next build`. Migrations only run when `VERCEL_ENV=production`; preview and local builds skip them, so a preview never mutates the production database.

Because migrations run inside the production build, keep them **backward-compatible** (expand-only: add nullable columns, widen types) so the currently-live version keeps working while the new build is created and promoted. Destructive changes (dropping a column) should be split across two deploys.

To apply migrations manually against any database:

```bash
DATABASE_URL="<connection-string>" pnpm exec drizzle-kit migrate
```

## License

Private project.

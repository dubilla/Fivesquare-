# Reordr

A personal food tracking app that helps you remember what you've ordered at different venues.

## Features

- Track dishes ordered at restaurants and venues
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

This project follows the MVP roadmap outlined in `Backlog.md`. See `PRD.md` for detailed product requirements.

## License

Private project.

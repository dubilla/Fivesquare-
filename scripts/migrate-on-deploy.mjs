// Applies pending Drizzle migrations as part of a Vercel *production* deploy,
// so schema changes ship atomically with the code that needs them instead of
// requiring a manual `pnpm db:migrate`. Wired into the `vercel-build` script.
//
// Only production runs migrations. Preview/development builds skip — they must
// never mutate the production database. (Once previews get their own Neon
// branch, this gate can be relaxed to migrate previews too.)
//
// Our migrations are expand-only/backward-compatible, so running them before
// the new code serves traffic is safe even for the currently-live version.
import { execSync } from 'node:child_process';

const vercelEnv = process.env.VERCEL_ENV ?? 'local';

if (vercelEnv !== 'production') {
  console.log(
    `[migrate-on-deploy] VERCEL_ENV=${vercelEnv}; skipping migrations (production only).`
  );
  process.exit(0);
}

if (!process.env.DATABASE_URL) {
  console.error(
    '[migrate-on-deploy] DATABASE_URL is not set; refusing to build without it.'
  );
  process.exit(1);
}

console.log('[migrate-on-deploy] Applying pending migrations…');
// Fails the build (and thus the deploy) if a migration errors, so broken
// schema never reaches production alongside the new code.
execSync('pnpm exec drizzle-kit migrate', { stdio: 'inherit' });
console.log('[migrate-on-deploy] Migrations up to date.');

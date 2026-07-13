// Seeds a fake user with ~20 check-ins across 6 places and mixed verdicts, so
// place pages, dish rollups (S5) and near-me (S6) have realistic data to render
// locally. Idempotent: fixed IDs + ON CONFLICT DO NOTHING, safe to re-run.
//
//   DATABASE_URL=... pnpm db:seed   (or set it in .env.local)
//
// Points at whatever DATABASE_URL resolves to — never run against production.
import { neon } from '@neondatabase/serverless';
import bcrypt from 'bcrypt';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

if (!process.env.DATABASE_URL) {
  console.error('[seed] DATABASE_URL is not set.');
  process.exit(1);
}

const sql = neon(process.env.DATABASE_URL);

const USER_ID = 'seed-user-1';
const USER_EMAIL = 'seed@theusual.app';

// Six real SF places; coords are approximate. `type` feeds places.primary_type.
const PLACES = [
  ['seed-place-1', 'Tartine Bakery', '600 Guerrero St, San Francisco', 'bakery', 37.7614, -122.4241], // prettier-ignore
  ['seed-place-2', 'Zuni Café', '1658 Market St, San Francisco', 'restaurant', 37.7734, -122.4213], // prettier-ignore
  ['seed-place-3', 'Blue Bottle Coffee', '66 Mint St, San Francisco', 'cafe', 37.7825, -122.4079], // prettier-ignore
  ['seed-place-4', 'La Taqueria', '2889 Mission St, San Francisco', 'mexican_restaurant', 37.7509, -122.4181], // prettier-ignore
  ['seed-place-5', 'Swan Oyster Depot', '1517 Polk St, San Francisco', 'seafood_restaurant', 37.7907, -122.4207], // prettier-ignore
  ['seed-place-6', 'House of Prime Rib', '1906 Van Ness Ave, San Francisco', 'restaurant', 37.7946, -122.4239], // prettier-ignore
];

// [placeIndex, dish, verdict, note, daysAgo]. Repeated dishes (incl. casing
// variants) are intentional — they exercise the S5 read-time dish rollup.
const CHECK_INS = [
  [0, 'Morning bun', 'yes', 'Worth the line every time.', 40],
  [0, 'Morning Bun', 'yes', null, 12],
  [0, 'Quiche', 'maybe', 'Good, not transcendent.', 25],
  [0, 'Country bread', 'yes', null, 5],
  [1, 'Roast chicken for two', 'yes', 'The one to order.', 60],
  [1, 'roast chicken for two', 'yes', 'Still the one.', 8],
  [1, 'Caesar salad', 'maybe', null, 33],
  [1, 'Burger', 'no', 'Only served at the bar; underwhelming.', 21],
  [2, 'Cappuccino', 'yes', null, 3],
  [2, 'Cappuccino', 'yes', 'Consistent.', 30],
  [2, 'Cold brew', 'maybe', null, 15],
  [3, 'Carnitas burrito', 'yes', 'No rice, dorado tortilla.', 45],
  [3, 'Carnitas burrito', 'yes', null, 10],
  [3, 'Al pastor tacos', 'maybe', null, 22],
  [4, 'Combination seafood salad', 'yes', 'Cash only, get there early.', 50],
  [4, 'Oysters', 'yes', null, 18],
  [5, 'Prime rib (King Henry VIII cut)', 'yes', 'Big night out.', 70],
  [5, 'Prime rib (English cut)', 'maybe', null, 35],
  [5, 'Creamed spinach', 'no', 'Skip it next time.', 35],
  [3, 'Horchata', 'maybe', null, 2],
];

async function main() {
  const passwordHash = await bcrypt.hash('password123', 10);

  await sql`
    INSERT INTO users (id, email, name, password_hash)
    VALUES (${USER_ID}, ${USER_EMAIL}, ${'Seed User'}, ${passwordHash})
    ON CONFLICT (email) DO NOTHING
  `;

  for (const [id, name, address, type, lat, lng] of PLACES) {
    await sql`
      INSERT INTO places (id, google_place_id, name, formatted_address, primary_type, lat, lng)
      VALUES (${id}, ${id}, ${name}, ${address}, ${type}, ${lat}, ${lng})
      ON CONFLICT (google_place_id) DO NOTHING
    `;
  }

  const now = Date.now();
  const DAY_MS = 24 * 60 * 60 * 1000;

  for (let i = 0; i < CHECK_INS.length; i++) {
    const [placeIdx, dish, verdict, note, daysAgo] = CHECK_INS[i];
    const place = PLACES[placeIdx];
    const [placeId, placeName, , , lat, lng] = place;
    const visitDatetime = new Date(now - daysAgo * DAY_MS).toISOString();

    await sql`
      INSERT INTO check_ins
        (id, user_id, place_uuid, place_id, place_name, lat, lng, dish_text, note_text, verdict, visit_datetime)
      VALUES
        (${`seed-checkin-${i + 1}`}, ${USER_ID}, ${placeId}, ${placeId}, ${placeName},
         ${lat}, ${lng}, ${dish}, ${note}, ${verdict}, ${visitDatetime})
      ON CONFLICT (id) DO NOTHING
    `;
  }

  console.log(
    `[seed] Done. User ${USER_EMAIL} (password: password123), ` +
      `${PLACES.length} places, ${CHECK_INS.length} check-ins.`
  );
}

main().catch(err => {
  console.error('[seed] Failed:', err);
  process.exit(1);
});

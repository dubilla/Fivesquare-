import {
  pgTable,
  pgEnum,
  text,
  timestamp,
  integer,
  primaryKey,
  doublePrecision,
  varchar,
} from 'drizzle-orm/pg-core';
import { VERDICTS } from '@/lib/verdict';

// "Would you order this again?" — the heart of the product (S2).
// Nullable on the table: historic rows predate the verdict; the form
// requires it going forward. Values come from the DB-free source of truth.
export const verdictEnum = pgEnum('verdict', VERDICTS);

export const users = pgTable('users', {
  id: text('id')
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  name: text('name'),
  email: text('email').notNull().unique(),
  emailVerified: timestamp('email_verified', { mode: 'date' }),
  image: text('image'),
  passwordHash: text('password_hash'),
  createdAt: timestamp('created_at', { mode: 'date' }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { mode: 'date' }).defaultNow().notNull(),
});

export const accounts = pgTable(
  'accounts',
  {
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    type: text('type').notNull(),
    provider: text('provider').notNull(),
    providerAccountId: text('provider_account_id').notNull(),
    refreshToken: text('refresh_token'),
    accessToken: text('access_token'),
    expiresAt: integer('expires_at'),
    tokenType: text('token_type'),
    scope: text('scope'),
    idToken: text('id_token'),
    sessionState: text('session_state'),
  },
  table => ({
    pk: primaryKey({ columns: [table.provider, table.providerAccountId] }),
  })
);

export const sessions = pgTable('sessions', {
  sessionToken: text('session_token').primaryKey(),
  userId: text('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  expires: timestamp('expires', { mode: 'date' }).notNull(),
});

export const verificationTokens = pgTable(
  'verification_tokens',
  {
    identifier: text('identifier').notNull(),
    token: text('token').notNull(),
    expires: timestamp('expires', { mode: 'date' }).notNull(),
  },
  table => ({
    pk: primaryKey({ columns: [table.identifier, table.token] }),
  })
);

// Normalized place (S4). Internal UUID PK — never the Google ID (provider
// independence, Google place-ID churn, future manually-created places). The
// Google ID is a unique lookup key. Address/type are nullable: rows backfilled
// from legacy check-ins never captured them, and Google details are
// contractually cacheable only ~30 days, so treat them as refreshable.
export const places = pgTable('places', {
  id: text('id')
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  googlePlaceId: text('google_place_id').notNull().unique(),
  name: text('name').notNull(),
  formattedAddress: text('formatted_address'),
  primaryType: text('primary_type'),
  lat: doublePrecision('lat').notNull(),
  lng: doublePrecision('lng').notNull(),
  createdAt: timestamp('created_at', { mode: 'date', withTimezone: true })
    .defaultNow()
    .notNull(),
  updatedAt: timestamp('updated_at', { mode: 'date', withTimezone: true })
    .defaultNow()
    .notNull(),
});

export const checkIns = pgTable('check_ins', {
  id: text('id')
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  userId: text('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  // FK to the normalized place (S4). Nullable for one release: the migration is
  // expand-only (backfilled from the denormalized columns below), and the
  // previously-deployed version keeps writing check-ins without it during the
  // migrate-on-deploy window. New writes always set it. S5 drops the
  // denormalized place_id/place_name/lat/lng once this is the source of truth.
  //
  // S5 OBLIGATION: check-ins written by the old code during the S4 deploy
  // window land with place_uuid = NULL and are never re-linked (0003 runs once).
  // Before S5 drops the denormalized columns, its migration MUST re-run the
  // 0003 backfill block (insert missing places + UPDATE ... WHERE place_uuid IS
  // NULL) or those rows lose their place identity permanently.
  placeUuid: text('place_uuid').references(() => places.id),
  placeId: text('place_id').notNull(),
  placeName: text('place_name').notNull(),
  lat: doublePrecision('lat').notNull(),
  lng: doublePrecision('lng').notNull(),
  dishText: varchar('dish_text', { length: 100 }).notNull(),
  noteText: varchar('note_text', { length: 500 }),
  verdict: verdictEnum('verdict'),
  visitDatetime: timestamp('visit_datetime', {
    mode: 'date',
    withTimezone: true,
  }).notNull(),
  createdAt: timestamp('created_at', { mode: 'date', withTimezone: true })
    .defaultNow()
    .notNull(),
  updatedAt: timestamp('updated_at', { mode: 'date', withTimezone: true })
    .defaultNow()
    .notNull(),
});

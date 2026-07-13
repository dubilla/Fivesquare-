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
  // FK to the normalized place — the source of truth for place data as of S5.
  // Application code reads place name/coords via this join and no longer touches
  // the denormalized columns below. Still nullable only because rows written by
  // old code during the S4 deploy window predate it; the S5 migration re-links
  // those, so in practice every row is linked.
  placeUuid: text('place_uuid').references(() => places.id),
  // DEPRECATED denormalized place columns (S4 → removed at S5b). As of S5 no
  // code reads or writes these — reads come from the places join, writes stopped
  // — so they're nullable and inert, kept one release as a safety net. The S5b
  // migration DROPs them; because S5 code already ignores them, that drop is
  // safe to run while S5 is still serving (nothing SELECTs or INSERTs them).
  placeId: text('place_id'),
  placeName: text('place_name'),
  lat: doublePrecision('lat'),
  lng: doublePrecision('lng'),
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

// Places-with-summary spatial queries: the user's own places, each with its top
// dish and verdict — the data behind the home screen. Two shapes share one
// rollup: "near me" (nearest-first within a radius, the list view) and "in
// bounds" (everything in a map viewport, the map view).
//
// Distance/containment run in Postgres via PostGIS against the GiST index on
// places.location: ST_DWithin filters to a radius, ST_Distance orders, and the
// geography `&&` operator does index-backed bounding-box overlap for the map.
// The dish rollup stays in JS — it reuses the read-time grouping so "top dish"
// means exactly what it does on the place page.
import { and, eq, inArray, sql } from 'drizzle-orm';
import { db } from '@/lib/db/client';
import { checkIns, places } from '@/lib/db/schema';
import { rollupDishes, type DishVisit } from '@/lib/dishes/rollup';
import type { Verdict } from '@/lib/verdict';

/** A place summarized by its headline dish + verdict — shared by both queries. */
interface PlaceSummary {
  topDish: string | null;
  topVerdict: Verdict | null;
}

export interface NearbyPlace extends PlaceSummary {
  id: string;
  name: string;
  formattedAddress: string | null;
  /** Great-circle distance from the user, in whole meters. */
  distanceMeters: number;
}

export interface MapPlace extends PlaceSummary {
  id: string;
  name: string;
  formattedAddress: string | null;
  lat: number;
  lng: number;
}

/** A map viewport, as returned by MapLibre's `getBounds()`. */
export interface Bounds {
  minLat: number;
  minLng: number;
  maxLat: number;
  maxLng: number;
}

// Widen the search if the smaller radius is empty, so someone whose places are
// across town — or who's traveling — still sees their history instead of a void.
// Meters. Stops at the first radius that returns anything.
export const RADIUS_LADDER_METERS = [2000, 10000, 50000] as const;

/**
 * Reduce a place's visits to its headline dish + verdict using the S5 rollup:
 * the most-ordered dish wins, and its latest verdict is shown. Pure — unit
 * tested without a database.
 */
export function summarizeTopDish(visits: readonly DishVisit[]): {
  topDish: string | null;
  topVerdict: Verdict | null;
} {
  const top = rollupDishes(visits)[0];
  return {
    topDish: top?.displayName ?? null,
    topVerdict: top?.latestVerdict ?? null,
  };
}

/**
 * Places the signed-in user has checked into near a point, nearest-first, each
 * summarized with its top dish/verdict. Empty array if the user has no places
 * within the widest radius.
 */
export async function findPlacesNearUser({
  userId,
  lat,
  lng,
}: {
  userId: string;
  lat: number;
  lng: number;
}): Promise<NearbyPlace[]> {
  // Longitude-first — the standard PostGIS gotcha.
  const point = sql`ST_MakePoint(${lng}, ${lat})::geography`;
  const distance = sql<number>`ST_Distance(${places.location}, ${point})`;

  // Only the user's own places count. EXISTS keeps this to one row per place
  // (vs. a join that would multiply by visit count) and lets the planner use
  // the GiST index for the ST_DWithin bound.
  const ownedByUser = sql`EXISTS (
    SELECT 1 FROM ${checkIns}
    WHERE ${checkIns.placeUuid} = ${places.id}
      AND ${checkIns.userId} = ${userId}
  )`;

  let rows: {
    id: string;
    name: string;
    formattedAddress: string | null;
    distanceMeters: number;
  }[] = [];

  for (const radius of RADIUS_LADDER_METERS) {
    rows = await db
      .select({
        id: places.id,
        name: places.name,
        formattedAddress: places.formattedAddress,
        distanceMeters: distance,
      })
      .from(places)
      .where(
        and(
          sql`ST_DWithin(${places.location}, ${point}, ${radius})`,
          ownedByUser
        )
      )
      // Tiebreaker keeps ordering stable across refreshes when two places sit
      // at the same distance (or tie after float rounding).
      .orderBy(distance, places.id);
    if (rows.length > 0) break;
  }

  if (rows.length === 0) return [];

  const summaries = await summarizePlaceVisits(
    userId,
    rows.map(r => r.id)
  );

  return rows.map(row => ({
    id: row.id,
    name: row.name,
    formattedAddress: row.formattedAddress,
    // ST_Distance can arrive as a string over the wire; coerce before rounding.
    distanceMeters: Math.round(Number(row.distanceMeters)),
    ...(summaries.get(row.id) ?? { topDish: null, topVerdict: null }),
  }));
}

/**
 * The signed-in user's places for the map, each summarized with its top
 * dish/verdict. With `bounds`, only places inside that viewport; with `null`,
 * all of them (the map opens framed to everywhere you've been, then narrows to
 * the viewport as you explore). Unordered — the map places pins, it doesn't
 * rank. Empty array if there are no matching places.
 */
export async function findPlacesInBounds({
  userId,
  bounds,
}: {
  userId: string;
  bounds: Bounds | null;
}): Promise<MapPlace[]> {
  // Only the user's own places — same EXISTS pattern as near-me: one row per
  // place, and it lets the planner use the GiST index for the && bound.
  const ownedByUser = sql`EXISTS (
    SELECT 1 FROM ${checkIns}
    WHERE ${checkIns.placeUuid} = ${places.id}
      AND ${checkIns.userId} = ${userId}
  )`;

  // Geography `&&` bounding-box overlap, index-backed by the GiST index on
  // places.location. ST_MakeEnvelope wants (minLng, minLat, maxLng, maxLat) and
  // returns geometry(4326); cast to geography so both sides match and the
  // geography operator/index apply. Omitted for the "all places" case — a
  // whole-globe envelope is degenerate in geography (its edges are great-circle
  // arcs, and ±180° lng coincide), so "everything" must be no predicate, not a
  // world-sized box.
  const inViewport = bounds
    ? sql`${places.location} && ST_MakeEnvelope(${bounds.minLng}, ${bounds.minLat}, ${bounds.maxLng}, ${bounds.maxLat}, 4326)::geography`
    : undefined;

  const rows = await db
    .select({
      id: places.id,
      name: places.name,
      formattedAddress: places.formattedAddress,
      lat: places.lat,
      lng: places.lng,
    })
    .from(places)
    .where(inViewport ? and(inViewport, ownedByUser) : ownedByUser);

  if (rows.length === 0) return [];

  const summaries = await summarizePlaceVisits(
    userId,
    rows.map(r => r.id)
  );

  return rows.map(row => ({
    id: row.id,
    name: row.name,
    formattedAddress: row.formattedAddress,
    lat: row.lat,
    lng: row.lng,
    ...(summaries.get(row.id) ?? { topDish: null, topVerdict: null }),
  }));
}

/**
 * Batch-fetch the user's visits for a set of places and roll each place up to
 * its top dish/verdict. One query total (not one per place); returns a map
 * keyed by place id. Shared by both spatial queries.
 */
async function summarizePlaceVisits(
  userId: string,
  placeIds: string[]
): Promise<Map<string, PlaceSummary>> {
  const visits = await db
    .select({
      placeUuid: checkIns.placeUuid,
      dishText: checkIns.dishText,
      verdict: checkIns.verdict,
      visitDatetime: checkIns.visitDatetime,
    })
    .from(checkIns)
    .where(
      and(eq(checkIns.userId, userId), inArray(checkIns.placeUuid, placeIds))
    );

  const visitsByPlace = new Map<string, DishVisit[]>();
  for (const v of visits) {
    if (!v.placeUuid) continue;
    const bucket = visitsByPlace.get(v.placeUuid);
    if (bucket) bucket.push(v);
    else visitsByPlace.set(v.placeUuid, [v]);
  }

  const summaries = new Map<string, PlaceSummary>();
  for (const id of placeIds) {
    summaries.set(id, summarizeTopDish(visitsByPlace.get(id) ?? []));
  }
  return summaries;
}

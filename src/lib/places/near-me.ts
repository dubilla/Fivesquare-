// "Near me" spatial query (S6): the user's own places, nearest-first, each with
// its top dish and verdict — the data behind the home screen. Factored as a lib
// because S7 (map) reuses it with a bounding-box variant.
//
// Distance/containment run in Postgres via PostGIS: ST_DWithin (index-backed by
// the GiST index on places.location) filters to a radius, ST_Distance orders.
// The dish rollup stays in JS — it reuses the S5 read-time grouping so "top
// dish" means exactly what it does on the place page.
import { and, eq, inArray, sql } from 'drizzle-orm';
import { db } from '@/lib/db/client';
import { checkIns, places } from '@/lib/db/schema';
import { rollupDishes, type DishVisit } from '@/lib/dishes/rollup';
import type { Verdict } from '@/lib/verdict';

export interface NearbyPlace {
  id: string;
  name: string;
  formattedAddress: string | null;
  /** Great-circle distance from the user, in whole meters. */
  distanceMeters: number;
  /** The user's usual here (most-ordered dish); null if somehow no visits. */
  topDish: string | null;
  /** That dish's latest verdict; null for legacy visits without one. */
  topVerdict: Verdict | null;
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

  // Batch-fetch the user's visits for the returned places, then roll up per
  // place in JS. One extra query total (not one per place).
  const placeIds = rows.map(r => r.id);
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

  return rows.map(row => ({
    id: row.id,
    name: row.name,
    formattedAddress: row.formattedAddress,
    // ST_Distance can arrive as a string over the wire; coerce before rounding.
    distanceMeters: Math.round(Number(row.distanceMeters)),
    ...summarizeTopDish(visitsByPlace.get(row.id) ?? []),
  }));
}

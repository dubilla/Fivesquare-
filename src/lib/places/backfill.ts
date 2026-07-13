// The dedupe *rule* the S4 backfill migration implements in SQL
// (drizzle/0003_*.sql): one place per Google place ID, most-recent visit wins.
// Kept here as a pure, unit-tested function because the migration runs against a
// live database we can't exercise in CI — this documents the behavior the raw
// `DISTINCT ON` relies on. (The SQL adds an `id DESC` tiebreaker for full
// determinism when two visits share a timestamp; on such ties this function
// keeps the first row seen. Immaterial to the backfill — either name is valid.)
//
// Given the denormalized place columns copied onto every check-in, collapse
// them to one place per Google place ID, taking the most recent visit's
// name/coords (names and even coordinates drift over time, so newest wins).

export interface CheckInPlaceRow {
  placeId: string;
  placeName: string;
  lat: number;
  lng: number;
  /** When the visit happened; the latest one wins ties-free. */
  visitDatetime: Date;
}

export interface DedupedPlace {
  googlePlaceId: string;
  name: string;
  lat: number;
  lng: number;
}

/**
 * Collapse check-in rows into one place per `placeId`, using the most recent
 * visit's name and coordinates. Mirrors the migration's
 * `DISTINCT ON (place_id) ... ORDER BY place_id, visit_datetime DESC`.
 */
export function dedupePlacesFromCheckIns(
  rows: readonly CheckInPlaceRow[]
): DedupedPlace[] {
  const latestByPlace = new Map<string, CheckInPlaceRow>();

  for (const row of rows) {
    const current = latestByPlace.get(row.placeId);
    if (!current || row.visitDatetime > current.visitDatetime) {
      latestByPlace.set(row.placeId, row);
    }
  }

  return Array.from(latestByPlace.values()).map(row => ({
    googlePlaceId: row.placeId,
    name: row.placeName,
    lat: row.lat,
    lng: row.lng,
  }));
}

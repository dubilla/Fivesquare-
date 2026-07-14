import { describe, it, expect, vi, beforeEach, type Mock } from 'vitest';

// findPlacesNearUser imports the db client (which throws without DATABASE_URL);
// mock it. The tests below stub the query builder to cover the control flow
// (radius-widening ladder, empty short-circuit, per-place visit bucketing) — the
// actual PostGIS SQL (ST_DWithin/ST_Distance/GiST) is exercised against a real
// DB in the S6 verification step, not here.
vi.mock('@/lib/db/client', () => ({ db: { select: vi.fn() } }));

import {
  summarizeTopDish,
  findPlacesNearUser,
  RADIUS_LADDER_METERS,
} from './near-me';
import { db } from '@/lib/db/client';
import type { DishVisit } from '@/lib/dishes/rollup';

// A stubbed drizzle query builder: chainable and awaitable, resolving to `result`
// whether the caller ends the chain at `.orderBy()` (the places query) or awaits
// after `.where()` (the visits query).
function stubQuery(result: unknown) {
  const q: Record<string, unknown> = {
    from: () => q,
    where: () => q,
    orderBy: () => Promise.resolve(result),
    then: (onF: (v: unknown) => unknown, onR?: (e: unknown) => unknown) =>
      Promise.resolve(result).then(onF, onR),
  };
  return q;
}

function visit(
  dishText: string,
  verdict: DishVisit['verdict'],
  daysAgo: number
): DishVisit {
  return {
    dishText,
    verdict,
    visitDatetime: new Date(Date.now() - daysAgo * 86_400_000),
  };
}

describe('summarizeTopDish', () => {
  it('returns nulls for a place with no visits', () => {
    expect(summarizeTopDish([])).toEqual({ topDish: null, topVerdict: null });
  });

  it('picks the most-ordered dish as the top dish', () => {
    const visits = [
      visit('Burger', 'yes', 30),
      visit('Burger', 'yes', 10),
      visit('Salad', 'no', 5),
    ];
    expect(summarizeTopDish(visits).topDish).toBe('Burger');
  });

  it('uses the latest verdict for the top dish, not the oldest', () => {
    const visits = [
      visit('Burger', 'yes', 30),
      visit('Burger', 'no', 2), // most recent — verdict changed to no
      visit('Burger', 'yes', 15),
    ];
    expect(summarizeTopDish(visits)).toEqual({
      topDish: 'Burger',
      topVerdict: 'no',
    });
  });

  it('groups casing/whitespace variants together via the S5 rollup', () => {
    const visits = [
      visit('Club Sandwich', 'yes', 20),
      visit('club sandwich ', 'maybe', 4),
      visit('Fries', 'yes', 8),
    ];
    // Three raw rows but "Club Sandwich" wins with 2 grouped visits.
    expect(summarizeTopDish(visits).topDish).toBe('club sandwich ');
  });

  it('surfaces a null verdict (legacy visit) without crashing', () => {
    expect(summarizeTopDish([visit('Toast', null, 1)])).toEqual({
      topDish: 'Toast',
      topVerdict: null,
    });
  });
});

describe('RADIUS_LADDER_METERS', () => {
  it('is strictly widening, starting local (~2km)', () => {
    expect(RADIUS_LADDER_METERS[0]).toBe(2000);
    for (let i = 1; i < RADIUS_LADDER_METERS.length; i++) {
      expect(RADIUS_LADDER_METERS[i]).toBeGreaterThan(
        RADIUS_LADDER_METERS[i - 1]
      );
    }
  });
});

describe('findPlacesNearUser (control flow, db stubbed)', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns [] and never queries visits when all radii are empty', async () => {
    (db.select as Mock).mockReturnValue(stubQuery([]));

    const result = await findPlacesNearUser({
      userId: 'u1',
      lat: 37.77,
      lng: -122.42,
    });

    expect(result).toEqual([]);
    // One select per radius rung, and no visits query (short-circuited).
    expect((db.select as Mock).mock.calls).toHaveLength(
      RADIUS_LADDER_METERS.length
    );
  });

  it('stops widening at the first radius that returns places', async () => {
    const placeRow = {
      id: 'p1',
      name: 'Tartine',
      formattedAddress: '600 Guerrero St',
      distanceMeters: '42.4', // string, as the driver may return it
    };
    (db.select as Mock)
      .mockReturnValueOnce(stubQuery([])) // 2km: empty
      .mockReturnValueOnce(stubQuery([placeRow])) // 10km: hit — stop here
      .mockReturnValueOnce(
        stubQuery([
          {
            placeUuid: 'p1',
            dishText: 'Morning bun',
            verdict: 'yes',
            visitDatetime: new Date(),
          },
        ])
      ); // visits

    const result = await findPlacesNearUser({
      userId: 'u1',
      lat: 37.77,
      lng: -122.42,
    });

    // 2 place queries (empty, then hit) + 1 visits query = 3, NOT the full ladder.
    expect((db.select as Mock).mock.calls).toHaveLength(3);
    expect(result).toEqual([
      {
        id: 'p1',
        name: 'Tartine',
        formattedAddress: '600 Guerrero St',
        distanceMeters: 42, // Number()-coerced and rounded
        topDish: 'Morning bun',
        topVerdict: 'yes',
      },
    ]);
  });

  it('buckets visits to the right place for the top-dish summary', async () => {
    const places = [
      { id: 'p1', name: 'A', formattedAddress: null, distanceMeters: 10 },
      { id: 'p2', name: 'B', formattedAddress: null, distanceMeters: 20 },
    ];
    const visits = [
      {
        placeUuid: 'p1',
        dishText: 'Burger',
        verdict: 'yes',
        visitDatetime: new Date(Date.now() - 1000),
      },
      {
        placeUuid: 'p1',
        dishText: 'Burger',
        verdict: 'no',
        visitDatetime: new Date(),
      },
      {
        placeUuid: 'p2',
        dishText: 'Salad',
        verdict: 'maybe',
        visitDatetime: new Date(),
      },
    ];
    (db.select as Mock)
      .mockReturnValueOnce(stubQuery(places)) // 2km hit
      .mockReturnValueOnce(stubQuery(visits));

    const result = await findPlacesNearUser({
      userId: 'u1',
      lat: 0,
      lng: 0,
    });

    expect(result.map(p => [p.id, p.topDish, p.topVerdict])).toEqual([
      ['p1', 'Burger', 'no'], // latest verdict wins
      ['p2', 'Salad', 'maybe'],
    ]);
  });
});

// Read-time dish grouping (S5). Deliberately NOT a table or stored slug:
// canonicalization rules ("Coke" == "Coca-Cola"? "fries" == "french fries"?)
// aren't knowable until real data exists. A pure function is trivially
// changeable and becomes the seed of the dish-entity work at the horizon (H3).
//
// The rule today is intentionally conservative — only collapse variants that are
// unambiguously the same order: case, surrounding/internal whitespace, and
// trailing punctuation. Nothing semantic.

import type { Verdict } from '@/lib/verdict';

export interface DishVisit {
  dishText: string;
  verdict: Verdict | null;
  visitDatetime: Date;
}

export interface DishGroup {
  /** Normalized grouping key — an implementation detail, not shown to users. */
  key: string;
  /** The most recent visit's original spelling, shown as the dish name. */
  displayName: string;
  /** How many visits ordered this dish. */
  count: number;
  /** The most recent visit's verdict (may be null for legacy visits). */
  latestVerdict: Verdict | null;
}

/**
 * Normalize a dish name into its grouping key: lowercase, trim, collapse
 * internal whitespace to single spaces, strip trailing punctuation. Two names
 * that differ only in those respects share a key and group together.
 */
export function normalizeDishKey(dish: string): string {
  const base = dish.toLowerCase().replace(/\s+/g, ' ').trim();
  const stripped = base.replace(/[\s.,!?;:]+$/, '').trim();
  // Fall back to the un-stripped form for all-punctuation names ("???") so they
  // don't all collapse into one empty-key group.
  return stripped || base;
}

/**
 * Group a place's visits by normalized dish, newest-first within each group so
 * the display name and verdict reflect the latest order. Groups are returned
 * ordered by visit count (your usual first), ties broken by most recent visit.
 */
export function rollupDishes(visits: readonly DishVisit[]): DishGroup[] {
  const groups = new Map<string, DishVisit[]>();

  for (const visit of visits) {
    const key = normalizeDishKey(visit.dishText);
    const bucket = groups.get(key);
    if (bucket) {
      bucket.push(visit);
    } else {
      groups.set(key, [visit]);
    }
  }

  const entries: { latestVisit: Date; group: DishGroup }[] = [];
  for (const [key, bucket] of groups) {
    const latest = bucket.reduce((a, b) =>
      b.visitDatetime > a.visitDatetime ? b : a
    );
    entries.push({
      latestVisit: latest.visitDatetime,
      group: {
        key,
        displayName: latest.dishText,
        count: bucket.length,
        latestVerdict: latest.verdict,
      },
    });
  }

  // Your usual first: most visits, ties broken by most recent visit.
  entries.sort(
    (a, b) =>
      b.group.count - a.group.count ||
      b.latestVisit.getTime() - a.latestVisit.getTime()
  );

  return entries.map(entry => entry.group);
}

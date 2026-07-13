import { describe, it, expect } from 'vitest';
import { normalizeDishKey, rollupDishes, type DishVisit } from './rollup';

describe('normalizeDishKey', () => {
  it('lowercases', () => {
    expect(normalizeDishKey('Club Sandwich')).toBe('club sandwich');
  });

  it('trims surrounding whitespace', () => {
    expect(normalizeDishKey('  club sandwich  ')).toBe('club sandwich');
  });

  it('collapses internal whitespace', () => {
    expect(normalizeDishKey('club\t sandwich')).toBe('club sandwich');
    expect(normalizeDishKey('club   sandwich')).toBe('club sandwich');
  });

  it('strips trailing punctuation', () => {
    expect(normalizeDishKey('Club Sandwich.')).toBe('club sandwich');
    expect(normalizeDishKey('Club Sandwich!!!')).toBe('club sandwich');
    expect(normalizeDishKey('Club Sandwich ...')).toBe('club sandwich');
  });

  it('maps casing/whitespace/punctuation variants to one key', () => {
    const variants = [
      'Club Sandwich',
      'club sandwich ',
      '  CLUB   SANDWICH',
      'club sandwich.',
    ];
    const keys = new Set(variants.map(normalizeDishKey));
    expect(keys.size).toBe(1);
  });

  it('keeps genuinely distinct dishes distinct', () => {
    expect(normalizeDishKey('Club Sandwich')).not.toBe(
      normalizeDishKey('Turkey Club')
    );
  });

  it('does not strip internal punctuation', () => {
    // Meaningful punctuation mid-name must survive.
    expect(normalizeDishKey('Fish & Chips')).toBe('fish & chips');
    expect(normalizeDishKey('PB&J')).toBe('pb&j');
  });

  it('does not collapse all-punctuation names to one empty key', () => {
    expect(normalizeDishKey('???')).toBe('???');
    expect(normalizeDishKey('...')).not.toBe(normalizeDishKey('!!!'));
  });
});

describe('rollupDishes', () => {
  const visit = (
    dishText: string,
    verdict: DishVisit['verdict'],
    iso: string
  ): DishVisit => ({ dishText, verdict, visitDatetime: new Date(iso) });

  it('groups variant spellings and counts visits', () => {
    const groups = rollupDishes([
      visit('Club Sandwich', 'yes', '2025-01-01'),
      visit('club sandwich ', 'maybe', '2025-02-01'),
      visit('CLUB SANDWICH.', 'no', '2025-03-01'),
    ]);

    expect(groups).toHaveLength(1);
    expect(groups[0].count).toBe(3);
  });

  it('uses the most recent visit for display name and verdict', () => {
    const groups = rollupDishes([
      visit('club sandwich', 'no', '2025-01-01'),
      visit('Club Sandwich', 'yes', '2025-06-01'), // latest
      visit('CLUB SANDWICH', 'maybe', '2025-03-01'),
    ]);

    expect(groups[0].displayName).toBe('Club Sandwich');
    expect(groups[0].latestVerdict).toBe('yes');
  });

  it('separates distinct dishes', () => {
    const groups = rollupDishes([
      visit('Club Sandwich', 'yes', '2025-01-01'),
      visit('Caesar Salad', 'maybe', '2025-01-02'),
      visit('Club Sandwich', 'yes', '2025-01-03'),
    ]);

    expect(groups).toHaveLength(2);
    const club = groups.find(g => g.key === 'club sandwich');
    const caesar = groups.find(g => g.key === 'caesar salad');
    expect(club?.count).toBe(2);
    expect(caesar?.count).toBe(1);
  });

  it('orders by visit count, then most recent visit', () => {
    const groups = rollupDishes([
      visit('Burger', 'yes', '2025-05-01'), // 1 visit, recent
      visit('Fries', 'yes', '2025-01-01'), // 3 visits, older
      visit('Fries', 'yes', '2025-01-02'),
      visit('Fries', 'yes', '2025-01-03'),
      visit('Shake', 'maybe', '2025-06-01'), // 1 visit, most recent
    ]);

    expect(groups.map(g => g.displayName)).toEqual([
      'Fries', // most visits
      'Shake', // tie on count(1) with Burger, more recent
      'Burger',
    ]);
  });

  it('handles a null verdict on the latest visit', () => {
    const groups = rollupDishes([
      visit('Tea', 'yes', '2025-01-01'),
      visit('Tea', null, '2025-02-01'),
    ]);

    expect(groups[0].latestVerdict).toBeNull();
  });

  it('returns an empty array for no visits', () => {
    expect(rollupDishes([])).toEqual([]);
  });
});

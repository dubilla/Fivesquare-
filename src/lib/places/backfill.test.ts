import { describe, it, expect } from 'vitest';
import { dedupePlacesFromCheckIns } from './backfill';

describe('dedupePlacesFromCheckIns', () => {
  it('returns one place per google place id', () => {
    const result = dedupePlacesFromCheckIns([
      {
        placeId: 'g-1',
        placeName: 'Joe’s',
        lat: 1,
        lng: 2,
        visitDatetime: new Date('2025-01-01'),
      },
      {
        placeId: 'g-1',
        placeName: 'Joe’s',
        lat: 1,
        lng: 2,
        visitDatetime: new Date('2025-02-01'),
      },
      {
        placeId: 'g-2',
        placeName: 'Ada’s',
        lat: 3,
        lng: 4,
        visitDatetime: new Date('2025-01-01'),
      },
    ]);

    expect(result).toHaveLength(2);
    expect(result.map(p => p.googlePlaceId).sort()).toEqual(['g-1', 'g-2']);
  });

  it('takes the most recent visit’s name and coords when they drift', () => {
    const result = dedupePlacesFromCheckIns([
      {
        placeId: 'g-1',
        placeName: 'Old Name',
        lat: 10.0,
        lng: 20.0,
        visitDatetime: new Date('2025-01-01T12:00:00Z'),
      },
      {
        placeId: 'g-1',
        placeName: 'New Name',
        lat: 10.5,
        lng: 20.5,
        visitDatetime: new Date('2025-06-01T12:00:00Z'),
      },
      {
        placeId: 'g-1',
        placeName: 'Middle Name',
        lat: 10.2,
        lng: 20.2,
        visitDatetime: new Date('2025-03-01T12:00:00Z'),
      },
    ]);

    expect(result).toEqual([
      { googlePlaceId: 'g-1', name: 'New Name', lat: 10.5, lng: 20.5 },
    ]);
  });

  it('is order-independent (unsorted input, newest still wins)', () => {
    const result = dedupePlacesFromCheckIns([
      {
        placeId: 'g-1',
        placeName: 'Newest',
        lat: 1,
        lng: 1,
        visitDatetime: new Date('2025-12-01'),
      },
      {
        placeId: 'g-1',
        placeName: 'Oldest',
        lat: 2,
        lng: 2,
        visitDatetime: new Date('2025-01-01'),
      },
    ]);

    expect(result).toHaveLength(1);
    expect(result[0].name).toBe('Newest');
  });

  it('returns an empty array for no check-ins', () => {
    expect(dedupePlacesFromCheckIns([])).toEqual([]);
  });
});

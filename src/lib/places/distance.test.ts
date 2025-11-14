import { describe, it, expect } from 'vitest';
import { calculateDistance, formatDistance } from './distance';

describe('calculateDistance', () => {
  it('should calculate distance between two points', () => {
    const point1 = { lat: 40.7128, lng: -74.006 }; // New York
    const point2 = { lat: 40.7614, lng: -73.9776 }; // Times Square

    const distance = calculateDistance(point1, point2);

    expect(distance).toBeGreaterThan(0);
    expect(distance).toBeLessThan(10000); // Should be less than 10km
    expect(distance).toBeCloseTo(5910, -2); // Approximately 5.9km
  });

  it('should return 0 for same location', () => {
    const point = { lat: 40.7128, lng: -74.006 };

    const distance = calculateDistance(point, point);

    expect(distance).toBe(0);
  });

  it('should handle nearby locations (< 1km)', () => {
    const point1 = { lat: 40.7128, lng: -74.006 };
    const point2 = { lat: 40.7138, lng: -74.005 }; // Very close

    const distance = calculateDistance(point1, point2);

    expect(distance).toBeGreaterThan(0);
    expect(distance).toBeLessThan(1000);
  });

  it('should calculate distance across longitude changes', () => {
    const point1 = { lat: 0, lng: 0 };
    const point2 = { lat: 0, lng: 1 };

    const distance = calculateDistance(point1, point2);

    expect(distance).toBeGreaterThan(0);
    expect(distance).toBeCloseTo(111195, -2); // ~111km at equator
  });

  it('should calculate distance across latitude changes', () => {
    const point1 = { lat: 0, lng: 0 };
    const point2 = { lat: 1, lng: 0 };

    const distance = calculateDistance(point1, point2);

    expect(distance).toBeGreaterThan(0);
    expect(distance).toBeCloseTo(111195, -2); // ~111km
  });
});

describe('formatDistance', () => {
  it('should format meters correctly', () => {
    expect(formatDistance(0)).toBe('0m');
    expect(formatDistance(250)).toBe('250m');
    expect(formatDistance(999)).toBe('999m');
  });

  it('should format kilometers correctly', () => {
    expect(formatDistance(1000)).toBe('1.0km');
    expect(formatDistance(1500)).toBe('1.5km');
    expect(formatDistance(2450)).toBe('2.5km');
    expect(formatDistance(10000)).toBe('10.0km');
  });

  it('should round to one decimal place for km', () => {
    expect(formatDistance(1234)).toBe('1.2km');
    expect(formatDistance(1567)).toBe('1.6km');
  });
});

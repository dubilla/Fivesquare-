import { describe, it, expect, vi, beforeEach, type Mock } from 'vitest';
import { NextRequest } from 'next/server';

vi.mock('@/auth', () => ({ auth: vi.fn() }));
vi.mock('@/lib/places/near-me', () => ({ findPlacesInBounds: vi.fn() }));

import { GET } from './route';
import { auth } from '@/auth';
import { findPlacesInBounds } from '@/lib/places/near-me';

const authed = () =>
  (auth as Mock).mockResolvedValue({
    user: { id: 'user-123', email: 'test@example.com' },
    expires: '',
  });

function req(query: string) {
  return new NextRequest(`http://localhost/api/places/in-bounds${query}`);
}

const validBounds = '?minLat=37.7&minLng=-122.5&maxLat=37.8&maxLng=-122.4';

describe('GET /api/places/in-bounds', () => {
  beforeEach(() => vi.clearAllMocks());

  it('rejects unauthenticated requests', async () => {
    (auth as Mock).mockResolvedValue(null);
    const res = await GET(req(validBounds));
    expect(res.status).toBe(401);
    expect(findPlacesInBounds).not.toHaveBeenCalled();
  });

  it('rejects missing bounds', async () => {
    authed();
    const res = await GET(req(''));
    expect(res.status).toBe(400);
    expect(findPlacesInBounds).not.toHaveBeenCalled();
  });

  it('rejects out-of-range latitude', async () => {
    authed();
    const res = await GET(
      req('?minLat=-91&minLng=-122.5&maxLat=37.8&maxLng=-122.4')
    );
    const data = await res.json();
    expect(res.status).toBe(400);
    expect(data.error).toContain('Lat');
  });

  it('rejects inverted bounds (min > max)', async () => {
    authed();
    const res = await GET(
      req('?minLat=37.8&minLng=-122.5&maxLat=37.7&maxLng=-122.4')
    );
    const data = await res.json();
    expect(res.status).toBe(400);
    expect(data.error).toContain('Lat');
  });

  it('returns places within the viewport for valid bounds', async () => {
    authed();
    const places = [
      {
        id: 'p1',
        name: 'Blue Bottle',
        formattedAddress: '66 Mint St',
        lat: 37.78,
        lng: -122.42,
        topDish: 'Cappuccino',
        topVerdict: 'yes',
      },
    ];
    (findPlacesInBounds as Mock).mockResolvedValue(places);

    const res = await GET(req(validBounds));
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.places).toEqual(places);
    expect(findPlacesInBounds).toHaveBeenCalledWith({
      userId: 'user-123',
      bounds: { minLat: 37.7, minLng: -122.5, maxLat: 37.8, maxLng: -122.4 },
    });
  });

  it('requests all places (no bounds) when all=1', async () => {
    authed();
    (findPlacesInBounds as Mock).mockResolvedValue([]);

    const res = await GET(req('?all=1'));

    expect(res.status).toBe(200);
    expect(findPlacesInBounds).toHaveBeenCalledWith({
      userId: 'user-123',
      bounds: null,
    });
  });

  it('surfaces query failures as 500', async () => {
    authed();
    (findPlacesInBounds as Mock).mockRejectedValue(new Error('PostGIS down'));
    const res = await GET(req(validBounds));
    const data = await res.json();
    expect(res.status).toBe(500);
    expect(data.error).toBe('PostGIS down');
  });
});

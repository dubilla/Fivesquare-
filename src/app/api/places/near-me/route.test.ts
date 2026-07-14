import { describe, it, expect, vi, beforeEach, type Mock } from 'vitest';
import { NextRequest } from 'next/server';

vi.mock('@/auth', () => ({ auth: vi.fn() }));
vi.mock('@/lib/places/near-me', () => ({ findPlacesNearUser: vi.fn() }));

import { GET } from './route';
import { auth } from '@/auth';
import { findPlacesNearUser } from '@/lib/places/near-me';

const authed = () =>
  (auth as Mock).mockResolvedValue({
    user: { id: 'user-123', email: 'test@example.com' },
    expires: '',
  });

function req(query: string) {
  return new NextRequest(`http://localhost/api/places/near-me${query}`);
}

describe('GET /api/places/near-me', () => {
  beforeEach(() => vi.clearAllMocks());

  it('rejects unauthenticated requests', async () => {
    (auth as Mock).mockResolvedValue(null);
    const res = await GET(req('?lat=37.77&lng=-122.42'));
    expect(res.status).toBe(401);
    expect(findPlacesNearUser).not.toHaveBeenCalled();
  });

  it('rejects missing coordinates', async () => {
    authed();
    const res = await GET(req(''));
    const data = await res.json();
    expect(res.status).toBe(400);
    expect(data.error).toContain('lat');
  });

  it('rejects out-of-range latitude', async () => {
    authed();
    const res = await GET(req('?lat=91&lng=-122.42'));
    const data = await res.json();
    expect(res.status).toBe(400);
    expect(data.error).toContain('lat');
  });

  it('rejects out-of-range longitude', async () => {
    authed();
    const res = await GET(req('?lat=37.77&lng=200'));
    const data = await res.json();
    expect(res.status).toBe(400);
    expect(data.error).toContain('lng');
  });

  it('returns distance-ordered places for valid coords', async () => {
    authed();
    const places = [
      {
        id: 'p1',
        name: 'Blue Bottle',
        formattedAddress: '66 Mint St',
        distanceMeters: 120,
        topDish: 'Cappuccino',
        topVerdict: 'yes',
      },
    ];
    (findPlacesNearUser as Mock).mockResolvedValue(places);

    const res = await GET(req('?lat=37.77&lng=-122.42'));
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.places).toEqual(places);
    expect(findPlacesNearUser).toHaveBeenCalledWith({
      userId: 'user-123',
      lat: 37.77,
      lng: -122.42,
    });
  });

  it('surfaces query failures as 500', async () => {
    authed();
    (findPlacesNearUser as Mock).mockRejectedValue(new Error('PostGIS down'));
    const res = await GET(req('?lat=37.77&lng=-122.42'));
    const data = await res.json();
    expect(res.status).toBe(500);
    expect(data.error).toBe('PostGIS down');
  });
});

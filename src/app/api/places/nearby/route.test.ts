import { describe, it, expect, vi, beforeEach, type Mock } from 'vitest';
import { POST } from './route';
import { NextRequest } from 'next/server';

// Mock dependencies
vi.mock('@/auth', () => ({
  auth: vi.fn(),
}));

vi.mock('@/lib/places', () => ({
  getPlacesProvider: vi.fn(),
}));

import { auth } from '@/auth';
import { getPlacesProvider } from '@/lib/places';

describe('POST /api/places/nearby', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should return 401 if user is not authenticated', async () => {
    (auth as Mock).mockResolvedValueOnce(null);

    const request = new NextRequest('http://localhost:3000/api/places/nearby', {
      method: 'POST',
      body: JSON.stringify({ lat: 40.73, lng: -73.99 }),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(401);
    expect(data.error).toBe('Unauthorized');
  });

  it('should return 400 if lat or lng are missing', async () => {
    (auth as Mock).mockResolvedValueOnce({
      user: { id: '1', email: 'test@example.com' },
    });

    const request = new NextRequest('http://localhost:3000/api/places/nearby', {
      method: 'POST',
      body: JSON.stringify({ lat: 40.73 }),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toContain('lat and lng must be numbers');
  });

  it('should return 400 if lat or lng are not numbers', async () => {
    (auth as Mock).mockResolvedValueOnce({
      user: { id: '1', email: 'test@example.com' },
    });

    const request = new NextRequest('http://localhost:3000/api/places/nearby', {
      method: 'POST',
      body: JSON.stringify({ lat: 'invalid', lng: -73.99 }),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toContain('lat and lng must be numbers');
  });

  it('should return 400 if coordinates are out of range', async () => {
    (auth as Mock).mockResolvedValueOnce({
      user: { id: '1', email: 'test@example.com' },
    });

    const request = new NextRequest('http://localhost:3000/api/places/nearby', {
      method: 'POST',
      body: JSON.stringify({ lat: 100, lng: -73.99 }),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toContain('Invalid coordinates');
  });

  it('should return array of places with place_id, name, lat, lng', async () => {
    (auth as Mock).mockResolvedValueOnce({
      user: { id: '1', email: 'test@example.com' },
    });

    const mockPlaces = [
      {
        place_id: 'ChIJN1t_tDeuEmsRUsoyG83frY4',
        name: 'Prince St Pizza',
        lat: 40.7229,
        lng: -73.9949,
        address: '27 Prince St, New York',
      },
      {
        place_id: 'ChIJrTLr-GyuEmsRBfy61i59si0',
        name: "Joe's Pizza",
        lat: 40.7308,
        lng: -74.0022,
        address: '7 Carmine St, New York',
      },
    ];

    const mockProvider = {
      searchNearby: vi.fn().mockResolvedValueOnce(mockPlaces),
    };

    (getPlacesProvider as Mock).mockReturnValueOnce(mockProvider);

    const request = new NextRequest('http://localhost:3000/api/places/nearby', {
      method: 'POST',
      body: JSON.stringify({ lat: 40.73, lng: -73.99 }),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.places).toHaveLength(2);
    expect(data.places[0]).toHaveProperty('place_id');
    expect(data.places[0]).toHaveProperty('name');
    expect(data.places[0]).toHaveProperty('lat');
    expect(data.places[0]).toHaveProperty('lng');
    expect(data.places[0].name).toBe('Prince St Pizza');
  });

  it('should pass optional parameters to the provider', async () => {
    (auth as Mock).mockResolvedValueOnce({
      user: { id: '1', email: 'test@example.com' },
    });

    const mockProvider = {
      searchNearby: vi.fn().mockResolvedValueOnce([]),
    };

    (getPlacesProvider as Mock).mockReturnValueOnce(mockProvider);

    const request = new NextRequest('http://localhost:3000/api/places/nearby', {
      method: 'POST',
      body: JSON.stringify({
        lat: 40.73,
        lng: -73.99,
        radius: 2000,
        type: 'restaurant',
        keyword: 'pizza',
      }),
    });

    await POST(request);

    expect(mockProvider.searchNearby).toHaveBeenCalledWith({
      location: { lat: 40.73, lng: -73.99 },
      radius: 2000,
      type: 'restaurant',
      keyword: 'pizza',
    });
  });

  it('should handle provider errors and return 500', async () => {
    (auth as Mock).mockResolvedValueOnce({
      user: { id: '1', email: 'test@example.com' },
    });

    const mockProvider = {
      searchNearby: vi.fn().mockRejectedValueOnce(new Error('Provider error')),
    };

    (getPlacesProvider as Mock).mockReturnValueOnce(mockProvider);

    const request = new NextRequest('http://localhost:3000/api/places/nearby', {
      method: 'POST',
      body: JSON.stringify({ lat: 40.73, lng: -73.99 }),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data.error).toBe('Provider error');
  });
});

import { describe, it, expect, vi, beforeEach, type Mock } from 'vitest';
import { GooglePlacesProvider } from './google-provider';

// Mock fetch globally
global.fetch = vi.fn() as Mock;

describe('GooglePlacesProvider', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should throw error if API key is not provided', () => {
    expect(() => new GooglePlacesProvider('')).toThrow(
      'Google Maps API key is required'
    );
  });

  it('should search nearby places and return top 10 results', async () => {
    const mockResponse = {
      status: 'OK',
      results: Array.from({ length: 15 }, (_, i) => ({
        place_id: `place_${i}`,
        name: `Place ${i}`,
        geometry: {
          location: {
            lat: 40.73 + i * 0.01,
            lng: -73.99 + i * 0.01,
          },
        },
        vicinity: `Address ${i}`,
        types: ['restaurant', 'food'],
      })),
    };

    (global.fetch as Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => mockResponse,
    });

    const provider = new GooglePlacesProvider('test-api-key');
    const places = await provider.searchNearby({
      location: { lat: 40.73, lng: -73.99 },
      radius: 1500,
    });

    expect(places).toHaveLength(10); // Should only return top 10
    expect(places[0]).toEqual({
      place_id: 'place_0',
      name: 'Place 0',
      lat: 40.73,
      lng: -73.99,
      address: 'Address 0',
      types: ['restaurant', 'food'],
    });

    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining(
        'maps.googleapis.com/maps/api/place/nearbysearch/json'
      )
    );
  });

  it('should include optional parameters in the request', async () => {
    const mockResponse = {
      status: 'OK',
      results: [],
    };

    (global.fetch as Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => mockResponse,
    });

    const provider = new GooglePlacesProvider('test-api-key');
    await provider.searchNearby({
      location: { lat: 40.73, lng: -73.99 },
      radius: 2000,
      type: 'restaurant',
      keyword: 'pizza',
    });

    const callUrl = (global.fetch as Mock).mock.calls[0][0] as string;
    expect(callUrl).toContain('radius=2000');
    expect(callUrl).toContain('type=restaurant');
    expect(callUrl).toContain('keyword=pizza');
  });

  it('should handle ZERO_RESULTS status', async () => {
    const mockResponse = {
      status: 'ZERO_RESULTS',
      results: [],
    };

    (global.fetch as Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => mockResponse,
    });

    const provider = new GooglePlacesProvider('test-api-key');
    const places = await provider.searchNearby({
      location: { lat: 40.73, lng: -73.99 },
    });

    expect(places).toEqual([]);
  });

  it('should throw error on API failure', async () => {
    const mockResponse = {
      status: 'REQUEST_DENIED',
      error_message: 'Invalid API key',
    };

    (global.fetch as Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => mockResponse,
    });

    const provider = new GooglePlacesProvider('test-api-key');

    await expect(
      provider.searchNearby({
        location: { lat: 40.73, lng: -73.99 },
      })
    ).rejects.toThrow('Google Places API error: REQUEST_DENIED');
  });

  it('should throw error on network failure', async () => {
    (global.fetch as Mock).mockResolvedValueOnce({
      ok: false,
      statusText: 'Internal Server Error',
    });

    const provider = new GooglePlacesProvider('test-api-key');

    await expect(
      provider.searchNearby({
        location: { lat: 40.73, lng: -73.99 },
      })
    ).rejects.toThrow('Google Places API error: Internal Server Error');
  });

  it('should handle fetch exception', async () => {
    (global.fetch as Mock).mockRejectedValueOnce(new Error('Network error'));

    const provider = new GooglePlacesProvider('test-api-key');

    await expect(
      provider.searchNearby({
        location: { lat: 40.73, lng: -73.99 },
      })
    ).rejects.toThrow('Failed to search nearby places: Network error');
  });
});

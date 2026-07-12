import { describe, it, expect, vi, beforeEach, type Mock } from 'vitest';
import { GooglePlacesProvider } from './google-provider';

// Mock fetch globally
global.fetch = vi.fn() as Mock;

// Build a Places API (New) place resource for the fields we request.
function newApiPlace(overrides: {
  id: string;
  name: string;
  lat: number;
  lng: number;
  formattedAddress?: string;
  primaryType?: string;
  types?: string[];
}) {
  return {
    id: overrides.id,
    displayName: { text: overrides.name, languageCode: 'en' },
    formattedAddress: overrides.formattedAddress,
    location: { latitude: overrides.lat, longitude: overrides.lng },
    primaryType: overrides.primaryType,
    types: overrides.types,
  };
}

// Parse the JSON body from the most recent fetch call.
function lastRequestBody() {
  const call = (global.fetch as Mock).mock.calls.at(-1)!;
  return JSON.parse(call[1].body as string);
}

function lastRequestInit() {
  return (global.fetch as Mock).mock.calls.at(-1)![1] as RequestInit;
}

describe('GooglePlacesProvider', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should throw error if API key is not provided', () => {
    expect(() => new GooglePlacesProvider('')).toThrow(
      'Google Maps API key is required'
    );
  });

  it('should search via Text Search and return the top 10 results', async () => {
    const mockResponse = {
      places: Array.from({ length: 15 }, (_, i) =>
        newApiPlace({
          id: `place_${i}`,
          name: `Place ${i}`,
          lat: 40.73 + i * 0.01,
          lng: -73.99 + i * 0.01,
          formattedAddress: `Address ${i}`,
          primaryType: 'restaurant',
          types: ['restaurant', 'food'],
        })
      ),
    };

    (global.fetch as Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => mockResponse,
    });

    const provider = new GooglePlacesProvider('test-api-key');
    const places = await provider.searchNearby({
      location: { lat: 40.73, lng: -73.99 },
      radius: 1500,
      keyword: 'pizza',
    });

    expect(places).toHaveLength(10); // top 10 only
    expect(places[0]).toEqual({
      place_id: 'place_0',
      name: 'Place 0',
      lat: 40.73,
      lng: -73.99,
      formattedAddress: 'Address 0',
      primaryType: 'restaurant',
      types: ['restaurant', 'food'],
      distance: 0,
    });

    // Hits the new Text Search endpoint with the key + field mask headers.
    const [url, init] = (global.fetch as Mock).mock.calls[0];
    expect(url).toBe('https://places.googleapis.com/v1/places:searchText');
    const headers = (init as RequestInit).headers as Record<string, string>;
    expect(headers['X-Goog-Api-Key']).toBe('test-api-key');
    expect(headers['X-Goog-FieldMask']).toContain('places.id');
    expect(headers['X-Goog-FieldMask']).toContain('places.primaryType');
  });

  it('should send textQuery, includedType and a location bias circle', async () => {
    (global.fetch as Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ places: [] }),
    });

    const provider = new GooglePlacesProvider('test-api-key');
    await provider.searchNearby({
      location: { lat: 40.73, lng: -73.99 },
      radius: 2000,
      type: 'restaurant',
      keyword: 'pizza',
    });

    const body = lastRequestBody();
    expect(body.textQuery).toBe('pizza');
    expect(body.includedType).toBe('restaurant');
    expect(body.locationBias.circle.center).toEqual({
      latitude: 40.73,
      longitude: -73.99,
    });
    expect(body.locationBias.circle.radius).toBe(2000);
  });

  it('should use Nearby Search when no keyword is provided', async () => {
    (global.fetch as Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ places: [] }),
    });

    const provider = new GooglePlacesProvider('test-api-key');
    await provider.searchNearby({
      location: { lat: 40.73, lng: -73.99 },
      radius: 1000,
      type: 'cafe',
    });

    const [url] = (global.fetch as Mock).mock.calls[0];
    expect(url).toBe('https://places.googleapis.com/v1/places:searchNearby');
    const body = lastRequestBody();
    expect(body.includedTypes).toEqual(['cafe']);
    expect(body.rankPreference).toBe('DISTANCE');
    expect(body.locationRestriction.circle.radius).toBe(1000);
  });

  it('should handle a zero-result response (no places field)', async () => {
    (global.fetch as Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => ({}),
    });

    const provider = new GooglePlacesProvider('test-api-key');
    const places = await provider.searchNearby({
      location: { lat: 40.73, lng: -73.99 },
      keyword: 'pizza',
    });

    expect(places).toEqual([]);
  });

  it('should throw with the API error message on a non-ok response', async () => {
    (global.fetch as Mock).mockResolvedValueOnce({
      ok: false,
      statusText: 'Forbidden',
      json: async () => ({
        error: {
          code: 403,
          message: 'API key not valid',
          status: 'PERMISSION_DENIED',
        },
      }),
    });

    const provider = new GooglePlacesProvider('test-api-key');

    await expect(
      provider.searchNearby({
        location: { lat: 40.73, lng: -73.99 },
        keyword: 'pizza',
      })
    ).rejects.toThrow('API key not valid');
  });

  it('should throw on network failure', async () => {
    (global.fetch as Mock).mockRejectedValueOnce(new Error('Network error'));

    const provider = new GooglePlacesProvider('test-api-key');

    await expect(
      provider.searchNearby({
        location: { lat: 40.73, lng: -73.99 },
        keyword: 'pizza',
      })
    ).rejects.toThrow('Failed to search nearby places: Network error');
  });

  it('should rank results by hybrid score (proximity + relevance)', async () => {
    const mockResponse = {
      places: [
        newApiPlace({
          id: 'far_but_relevant',
          name: 'Far But Relevant',
          lat: 40.74,
          lng: -73.98, // ~1.4km away
          types: ['restaurant'],
        }),
        newApiPlace({
          id: 'very_close',
          name: 'Very Close',
          lat: 40.7301,
          lng: -73.9901, // ~100m away
          types: ['restaurant'],
        }),
        newApiPlace({
          id: 'medium_distance',
          name: 'Medium Distance',
          lat: 40.735,
          lng: -73.985, // ~500m away
          types: ['restaurant'],
        }),
      ],
    };

    (global.fetch as Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => mockResponse,
    });

    const provider = new GooglePlacesProvider('test-api-key');
    const places = await provider.searchNearby({
      location: { lat: 40.73, lng: -73.99 },
      radius: 1500,
      keyword: 'food',
    });

    // "Very Close" outranks a more-relevant-but-farther result (70% proximity).
    expect(places[0].place_id).toBe('very_close');
    expect(places[0].distance).toBeLessThan(200);
  });

  it('should send JSON content-type', async () => {
    (global.fetch as Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ places: [] }),
    });

    const provider = new GooglePlacesProvider('test-api-key');
    await provider.searchNearby({
      location: { lat: 40.73, lng: -73.99 },
      keyword: 'pizza',
    });

    const init = lastRequestInit();
    expect(init.method).toBe('POST');
    expect((init.headers as Record<string, string>)['Content-Type']).toBe(
      'application/json'
    );
  });
});

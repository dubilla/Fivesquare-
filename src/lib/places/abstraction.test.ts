import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { getPlacesProvider } from './index';
import type { PlacesProvider, NearbySearchParams, Place } from './types';

// Mock environment variable
const originalEnv = process.env.GOOGLE_MAPS_API_KEY;

describe('Places Provider Abstraction Layer', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    process.env.GOOGLE_MAPS_API_KEY = originalEnv;
  });

  it('should throw error if GOOGLE_MAPS_API_KEY is not set', () => {
    delete process.env.GOOGLE_MAPS_API_KEY;

    expect(() => getPlacesProvider()).toThrow(
      'GOOGLE_MAPS_API_KEY environment variable is not set'
    );
  });

  it('should return a provider that implements PlacesProvider interface', () => {
    process.env.GOOGLE_MAPS_API_KEY = 'test-key';

    const provider = getPlacesProvider();

    expect(provider).toBeDefined();
    expect(typeof provider.searchNearby).toBe('function');
  });

  it('should allow swapping providers - mock provider example', async () => {
    // Create a mock provider that implements the PlacesProvider interface
    class MockPlacesProvider implements PlacesProvider {
      async searchNearby(params: NearbySearchParams): Promise<Place[]> {
        return [
          {
            place_id: 'mock-1',
            name: 'Mock Restaurant',
            lat: params.location.lat,
            lng: params.location.lng,
            address: 'Mock Address',
          },
        ];
      }
    }

    const mockProvider = new MockPlacesProvider();

    // Test that our mock provider works with the same interface
    const results = await mockProvider.searchNearby({
      location: { lat: 40.73, lng: -73.99 },
    });

    expect(results).toHaveLength(1);
    expect(results[0].place_id).toBe('mock-1');
    expect(results[0].name).toBe('Mock Restaurant');
    expect(results[0].lat).toBe(40.73);
    expect(results[0].lng).toBe(-73.99);
  });

  it('should enforce PlacesProvider contract - all providers must implement searchNearby', () => {
    // This is a compile-time test that any provider must implement searchNearby
    // If this compiles, the abstraction is working

    class CustomProvider implements PlacesProvider {
      async searchNearby(params: NearbySearchParams): Promise<Place[]> {
        // Custom implementation
        return [
          {
            place_id: 'custom-1',
            name: 'Custom Place',
            lat: params.location.lat,
            lng: params.location.lng,
          },
        ];
      }
    }

    const provider = new CustomProvider();
    expect(provider).toBeDefined();
    expect(typeof provider.searchNearby).toBe('function');
  });

  it('should work with different provider implementations - Mapbox example', async () => {
    // Example: If we wanted to swap to Mapbox, this shows how it would work
    class MapboxPlacesProvider implements PlacesProvider {
      private apiKey: string;

      constructor(apiKey: string) {
        this.apiKey = apiKey;
      }

      async searchNearby(params: NearbySearchParams): Promise<Place[]> {
        // Simulating how a Mapbox implementation would work
        // In real code, this would call Mapbox API
        return [
          {
            place_id: `mapbox-${this.apiKey}`,
            name: 'Mapbox Place',
            lat: params.location.lat,
            lng: params.location.lng,
            address: 'Mapbox Address',
          },
        ];
      }
    }

    const mapboxProvider = new MapboxPlacesProvider('mapbox-test-key');
    const results = await mapboxProvider.searchNearby({
      location: { lat: 40.73, lng: -73.99 },
    });

    // Same interface, different implementation
    expect(results).toHaveLength(1);
    expect(results[0]).toHaveProperty('place_id');
    expect(results[0]).toHaveProperty('name');
    expect(results[0]).toHaveProperty('lat');
    expect(results[0]).toHaveProperty('lng');
  });

  it('should support optional parameters in the interface', async () => {
    class TestProvider implements PlacesProvider {
      async searchNearby(params: NearbySearchParams): Promise<Place[]> {
        // Verify optional params are accessible
        const { location, radius, type, keyword } = params;

        return [
          {
            place_id: 'test-1',
            name: `${keyword || 'default'} - ${type || 'any'}`,
            lat: location.lat,
            lng: location.lng,
            address: `Radius: ${radius || 'default'}`,
          },
        ];
      }
    }

    const provider = new TestProvider();

    // Test with all optional params
    const results = await provider.searchNearby({
      location: { lat: 40.73, lng: -73.99 },
      radius: 5000,
      type: 'restaurant',
      keyword: 'pizza',
    });

    expect(results[0].name).toBe('pizza - restaurant');
    expect(results[0].address).toBe('Radius: 5000');
  });

  it('should return consistent Place object structure across providers', async () => {
    class Provider1 implements PlacesProvider {
      async searchNearby(params: NearbySearchParams): Promise<Place[]> {
        return [
          {
            place_id: '1',
            name: 'Place 1',
            lat: params.location.lat,
            lng: params.location.lng,
          },
        ];
      }
    }

    class Provider2 implements PlacesProvider {
      async searchNearby(params: NearbySearchParams): Promise<Place[]> {
        return [
          {
            place_id: '2',
            name: 'Place 2',
            lat: params.location.lat,
            lng: params.location.lng,
            address: 'Optional address',
            types: ['restaurant'],
          },
        ];
      }
    }

    const provider1 = new Provider1();
    const provider2 = new Provider2();

    const results1 = await provider1.searchNearby({
      location: { lat: 40.73, lng: -73.99 },
    });
    const results2 = await provider2.searchNearby({
      location: { lat: 40.73, lng: -73.99 },
    });

    // Both should have the required fields
    expect(results1[0]).toHaveProperty('place_id');
    expect(results1[0]).toHaveProperty('name');
    expect(results1[0]).toHaveProperty('lat');
    expect(results1[0]).toHaveProperty('lng');

    expect(results2[0]).toHaveProperty('place_id');
    expect(results2[0]).toHaveProperty('name');
    expect(results2[0]).toHaveProperty('lat');
    expect(results2[0]).toHaveProperty('lng');
  });
});

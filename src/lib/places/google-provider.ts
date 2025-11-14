import type { PlacesProvider, NearbySearchParams, Place } from './types';
import { calculateDistance } from './distance';
import { calculateHybridScore } from './ranking';

export class GooglePlacesProvider implements PlacesProvider {
  private apiKey: string;

  constructor(apiKey: string) {
    if (!apiKey) {
      throw new Error('Google Maps API key is required');
    }
    this.apiKey = apiKey;
  }

  async searchNearby(params: NearbySearchParams): Promise<Place[]> {
    const { location, radius = 1500, type, keyword } = params;

    // Build the query parameters
    const queryParams = new URLSearchParams({
      location: `${location.lat},${location.lng}`,
      radius: radius.toString(),
      key: this.apiKey,
    });

    if (type) {
      queryParams.append('type', type);
    }

    if (keyword) {
      queryParams.append('keyword', keyword);
    }

    try {
      const response = await fetch(
        `https://maps.googleapis.com/maps/api/place/nearbysearch/json?${queryParams.toString()}`
      );

      if (!response.ok) {
        throw new Error(`Google Places API error: ${response.statusText}`);
      }

      const data = await response.json();

      if (data.status !== 'OK' && data.status !== 'ZERO_RESULTS') {
        throw new Error(`Google Places API error: ${data.status}`);
      }

      // Map Google Places results to our common Place interface with ranking
      const placesWithScores = (data.results || []).map(
        (
          result: {
            place_id: string;
            name: string;
            geometry: { location: { lat: number; lng: number } };
            vicinity?: string;
            types?: string[];
          },
          index: number
        ) => {
          const placeLocation = {
            lat: result.geometry.location.lat,
            lng: result.geometry.location.lng,
          };
          const distance = calculateDistance(location, placeLocation);

          // Calculate hybrid score (70% proximity, 30% Google relevance)
          const hybridScore = calculateHybridScore(
            distance,
            index,
            data.results.length,
            radius || 1500
          );

          return {
            place_id: result.place_id,
            name: result.name,
            lat: placeLocation.lat,
            lng: placeLocation.lng,
            address: result.vicinity,
            types: result.types,
            distance,
            hybridScore,
          };
        }
      );

      // Sort by hybrid score (highest first) and take top 10
      const places: Place[] = placesWithScores
        .sort((a, b) => b.hybridScore - a.hybridScore)
        .slice(0, 10)
        .map(
          ({ place_id, name, lat, lng, address, types, distance }): Place => ({
            place_id,
            name,
            lat,
            lng,
            address,
            types,
            distance,
          })
        );

      return places;
    } catch (error) {
      if (error instanceof Error) {
        throw new Error(`Failed to search nearby places: ${error.message}`);
      }
      throw new Error('Failed to search nearby places');
    }
  }
}

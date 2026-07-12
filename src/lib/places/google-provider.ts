import type {
  PlacesProvider,
  NearbySearchParams,
  Place,
  Location,
} from './types';
import { calculateDistance } from './distance';
import { calculateHybridScore } from './ranking';

// Places API (New) — https://developers.google.com/maps/documentation/places/web-service/op-overview
// The legacy nearbysearch/json endpoint this replaced is deprecated.
const PLACES_API_BASE = 'https://places.googleapis.com/v1';

// Only request the fields we use — the field mask is required by the new API
// and drives billing. `id` is cacheable indefinitely; the rest are the fields
// S4/S5 persist (name, address, category, coords).
const FIELD_MASK = [
  'places.id',
  'places.displayName',
  'places.formattedAddress',
  'places.location',
  'places.primaryType',
  'places.types',
].join(',');

// The subset of a Places API (New) place resource we request via the mask.
interface GooglePlaceResult {
  id: string;
  displayName?: { text: string; languageCode?: string };
  formattedAddress?: string;
  location: { latitude: number; longitude: number };
  primaryType?: string;
  types?: string[];
}

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
    const center = {
      latitude: location.lat,
      longitude: location.lng,
    };

    try {
      // A free-text query (the check-in place picker) maps to Text Search;
      // a type-only query maps to Nearby Search. Both return the same shape.
      const results = keyword
        ? await this.request('places:searchText', {
            textQuery: keyword,
            ...(type ? { includedType: type } : {}),
            locationBias: { circle: { center, radius } },
            maxResultCount: 20,
          })
        : await this.request('places:searchNearby', {
            includedTypes: [type ?? 'restaurant'],
            rankPreference: 'DISTANCE',
            locationRestriction: { circle: { center, radius } },
            maxResultCount: 20,
          });

      return this.rankAndMap(results, location, radius);
    } catch (error) {
      if (error instanceof Error) {
        throw new Error(`Failed to search nearby places: ${error.message}`);
      }
      throw new Error('Failed to search nearby places');
    }
  }

  private async request(
    endpoint: string,
    body: Record<string, unknown>
  ): Promise<GooglePlaceResult[]> {
    const response = await fetch(`${PLACES_API_BASE}/${endpoint}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Goog-Api-Key': this.apiKey,
        'X-Goog-FieldMask': FIELD_MASK,
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      // The new API returns errors as { error: { message, status } }.
      let message = response.statusText;
      try {
        const data = await response.json();
        message = data?.error?.message ?? message;
      } catch {
        // Non-JSON error body; fall back to the status text.
      }
      throw new Error(`Google Places API error: ${message}`);
    }

    const data = await response.json();
    // A zero-result response omits the `places` field entirely.
    return (data.places ?? []) as GooglePlaceResult[];
  }

  private rankAndMap(
    results: GooglePlaceResult[],
    origin: Location,
    radius: number
  ): Place[] {
    type PlaceWithScore = Place & { hybridScore: number };

    const scored: PlaceWithScore[] = results.map((result, index) => {
      const placeLocation = {
        lat: result.location.latitude,
        lng: result.location.longitude,
      };
      const distance = calculateDistance(origin, placeLocation);

      // Preserve the existing ranking: 70% proximity, 30% provider relevance
      // (the provider returns results in relevance order, so index is rank).
      const hybridScore = calculateHybridScore(
        distance,
        index,
        results.length,
        radius
      );

      return {
        place_id: result.id,
        name: result.displayName?.text ?? '',
        lat: placeLocation.lat,
        lng: placeLocation.lng,
        formattedAddress: result.formattedAddress,
        primaryType: result.primaryType,
        types: result.types,
        distance,
        hybridScore,
      };
    });

    // Sort by hybrid score (highest first), take top 10, drop the internal score.
    return scored
      .sort((a, b) => b.hybridScore - a.hybridScore)
      .slice(0, 10)
      .map(({ hybridScore: _hybridScore, ...place }) => place);
  }
}

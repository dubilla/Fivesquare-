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
            // A soft bias toward the search radius, not a hard restriction:
            // Text Search only restricts by rectangle, and hard-filtering would
            // surprise users with empty results when their spot sits just
            // outside the radius. The hybrid proximity score sinks far matches.
            locationBias: { circle: { center, radius } },
            pageSize: 20,
          })
        : await this.request('places:searchNearby', {
            // includedTypes is optional; omit it (rather than defaulting to
            // restaurants) so a bare search returns all nearby place types,
            // matching the legacy endpoint's no-type behavior.
            ...(type ? { includedTypes: [type] } : {}),
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
    const scored = results.map((result, index) => {
      const place: Place = {
        place_id: result.id,
        name: result.displayName?.text ?? '',
        lat: result.location.latitude,
        lng: result.location.longitude,
        formattedAddress: result.formattedAddress,
        primaryType: result.primaryType,
        types: result.types,
        distance: calculateDistance(origin, {
          lat: result.location.latitude,
          lng: result.location.longitude,
        }),
      };

      // Preserve the existing 70% proximity / 30% relevance ranking. The
      // result index is the provider's own rank — relevance order for Text
      // Search, distance order for Nearby Search — used as the relevance term.
      const hybridScore = calculateHybridScore(
        place.distance!,
        index,
        results.length,
        radius
      );

      return { place, hybridScore };
    });

    // Sort by hybrid score (highest first), take top 10.
    return scored
      .sort((a, b) => b.hybridScore - a.hybridScore)
      .slice(0, 10)
      .map(({ place }) => place);
  }
}

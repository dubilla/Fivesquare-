import type { NearbySearchParams, Place, PlacesProvider } from './types';

/**
 * Fixed places for local/dev when GOOGLE_MAPS_API_KEY=local-dev.
 * Lets the check-in form (and photo upload) be exercised without Google.
 */
const LOCAL_PLACES: Place[] = [
  {
    place_id: 'local-tartine',
    name: 'Tartine Bakery',
    lat: 37.7614,
    lng: -122.4241,
    formattedAddress: '600 Guerrero St, San Francisco',
    primaryType: 'bakery',
  },
  {
    place_id: 'local-zuni',
    name: 'Zuni Café',
    lat: 37.7734,
    lng: -122.4213,
    formattedAddress: '1658 Market St, San Francisco',
    primaryType: 'restaurant',
  },
  {
    place_id: 'local-la-taqueria',
    name: 'La Taqueria',
    lat: 37.7509,
    lng: -122.4181,
    formattedAddress: '2889 Mission St, San Francisco',
    primaryType: 'mexican_restaurant',
  },
];

export class LocalDevPlacesProvider implements PlacesProvider {
  async searchNearby(params: NearbySearchParams): Promise<Place[]> {
    const keyword = params.keyword?.trim().toLowerCase();
    const filtered = keyword
      ? LOCAL_PLACES.filter(p => p.name.toLowerCase().includes(keyword))
      : LOCAL_PLACES;

    return filtered.map(p => ({
      ...p,
      distance: Math.round(
        Math.hypot(p.lat - params.location.lat, p.lng - params.location.lng) *
          111_000
      ),
    }));
  }
}

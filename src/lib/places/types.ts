// Common types for place search across different providers

export interface Location {
  lat: number;
  lng: number;
}

export interface Place {
  place_id: string;
  name: string;
  lat: number;
  lng: number;
  address?: string;
  types?: string[];
  distance?: number; // Distance in meters from search origin
}

export interface NearbySearchParams {
  location: Location;
  radius?: number;
  type?: string;
  keyword?: string;
}

export interface PlacesProvider {
  searchNearby(params: NearbySearchParams): Promise<Place[]>;
}

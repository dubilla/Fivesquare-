import { GooglePlacesProvider } from './google-provider';
import { LocalDevPlacesProvider } from './local-dev-provider';
import type { PlacesProvider } from './types';

export * from './types';

/**
 * Get the configured places provider.
 * This abstraction makes it easy to swap providers in the future.
 */
export function getPlacesProvider(): PlacesProvider {
  const apiKey = process.env.GOOGLE_MAPS_API_KEY;

  if (!apiKey) {
    throw new Error('GOOGLE_MAPS_API_KEY environment variable is not set');
  }

  // Local/agent testing without a real Google key.
  if (apiKey === 'local-dev') {
    return new LocalDevPlacesProvider();
  }

  // Currently using Google Places, but this can be easily swapped
  // for another provider (Mapbox, HERE, etc.) in the future
  return new GooglePlacesProvider(apiKey);
}

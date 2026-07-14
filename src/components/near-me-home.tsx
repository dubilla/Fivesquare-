'use client';

import { useCallback, useEffect, useState } from 'react';
import dynamic from 'next/dynamic';
import { VerdictBadge } from '@/components/verdict-badge';
import { formatDistance } from '@/lib/places/distance';
import type { Verdict } from '@/lib/verdict';

// MapLibre touches window/WebGL, so the map is client-only — never server-render
// it. Loaded lazily so its weight lands only when the user opens the map view.
const PlacesMap = dynamic(
  () => import('@/components/places-map').then(m => m.PlacesMap),
  {
    ssr: false,
    loading: () => (
      <div className="h-[70vh] w-full rounded-lg bg-gray-100 dark:bg-gray-800 animate-pulse" />
    ),
  }
);

type View = 'list' | 'map';

interface NearbyPlace {
  id: string;
  name: string;
  formattedAddress: string | null;
  distanceMeters: number;
  topDish: string | null;
  topVerdict: Verdict | null;
}

type State =
  | { status: 'locating' } // asking the browser for the user's position
  | { status: 'loading' } // have coords, fetching nearby places
  | { status: 'ready'; places: NearbyPlace[] }
  | { status: 'fallback'; reason: 'denied' | 'unavailable' | 'failed' }
  | { status: 'error'; message: string };

// The signed-in home screen (S6): "Places you've been, near you." Geolocation is
// client-only, so this component owns the whole flow — ask for position, fetch
// the near-me API, and degrade gracefully to a history link if location is
// unavailable or denied (never a dead screen).
export function NearMeHome() {
  const [state, setState] = useState<State>({ status: 'locating' });
  const [view, setView] = useState<View>('list');
  // Remembered so the map can open centered on the user when we have a fix.
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(
    null
  );

  const locate = useCallback(() => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      setState({ status: 'fallback', reason: 'unavailable' });
      return;
    }

    setState({ status: 'locating' });
    navigator.geolocation.getCurrentPosition(
      async position => {
        setState({ status: 'loading' });
        try {
          const { latitude, longitude } = position.coords;
          setCoords({ lat: latitude, lng: longitude });
          const res = await fetch(
            `/api/places/near-me?lat=${latitude}&lng=${longitude}`
          );
          if (!res.ok) {
            const data = await res.json();
            throw new Error(data.error || 'Failed to load nearby places');
          }
          const data = await res.json();
          setState({ status: 'ready', places: data.places });
        } catch (err) {
          setState({
            status: 'error',
            message:
              err instanceof Error
                ? err.message
                : 'Failed to load nearby places',
          });
        }
      },
      error => {
        // Permission denied gets a "turn it on" nudge; other failures (position
        // unavailable, timeout) get a generic retry — both fall back to history.
        setState({
          status: 'fallback',
          reason: error.code === error.PERMISSION_DENIED ? 'denied' : 'failed',
        });
      },
      // Without a timeout the default is infinite: on a machine whose location
      // fix stalls, the callback never fires and the spinner hangs forever. Cap
      // it so a stall degrades to the retry fallback instead.
      { timeout: 10_000, maximumAge: 60_000 }
    );
  }, []);

  useEffect(() => {
    locate();
  }, [locate]);

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 py-8 px-4">
      <div className="max-w-4xl mx-auto">
        <div className="flex justify-between items-center mb-8 gap-4">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
            Near you
          </h1>
          <div className="flex items-center gap-3">
            <ViewToggle view={view} onChange={setView} />
            <a
              href="/check-in"
              className="bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-4 rounded-lg transition-colors whitespace-nowrap"
            >
              New Check-In
            </a>
          </div>
        </div>

        {/* Map view stands alone: it frames all your places by viewport, so it
            works even when the list's geolocation was denied or is still
            resolving. */}
        {view === 'map' && <PlacesMap center={coords ?? undefined} />}

        {view === 'list' &&
          (state.status === 'locating' || state.status === 'loading') && (
            <div className="text-center py-12">
              <div className="animate-spin h-12 w-12 border-4 border-blue-600 border-t-transparent rounded-full mx-auto"></div>
              <p className="mt-4 text-gray-600 dark:text-gray-400">
                {state.status === 'locating'
                  ? 'Finding your location…'
                  : 'Looking for your places nearby…'}
              </p>
            </div>
          )}

        {view === 'list' && state.status === 'error' && (
          <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-6">
            <p className="text-red-600 dark:text-red-400 mb-4">
              {state.message}
            </p>
            <button
              onClick={locate}
              className="text-sm font-medium text-blue-600 dark:text-blue-400 hover:underline"
            >
              Try again
            </button>
          </div>
        )}

        {view === 'list' && state.status === 'fallback' && (
          <LocationFallback onRetry={locate} />
        )}

        {view === 'list' &&
          state.status === 'ready' &&
          (state.places.length === 0 ? (
            // Reached only after the widest radius came back empty — the user may
            // have places, just none within range (e.g. traveling). Offer both
            // "check in" and the full history so this never reads as "you have
            // nothing."
            <div className="text-center py-12 bg-white dark:bg-gray-800 rounded-lg shadow px-6">
              <p className="text-gray-600 dark:text-gray-400 mb-6">
                No places within 50&nbsp;km. Your spots may just be further
                afield.
              </p>
              <div className="flex flex-col sm:flex-row gap-3 justify-center">
                <a
                  href="/check-in"
                  className="inline-flex items-center justify-center bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-4 rounded-lg transition-colors"
                >
                  Check in somewhere
                </a>
                <a
                  href="/history"
                  className="inline-flex items-center justify-center py-2 px-4 rounded-lg font-medium text-gray-700 dark:text-gray-300 border border-gray-300 dark:border-gray-600 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                >
                  View all your places
                </a>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              {state.places.map(place => (
                <a
                  key={place.id}
                  href={`/places/${place.id}`}
                  className="block bg-white dark:bg-gray-800 rounded-lg shadow p-5 hover:shadow-md transition-shadow"
                >
                  <div className="flex justify-between items-start gap-4">
                    <div className="min-w-0">
                      <h2 className="text-xl font-semibold text-gray-900 dark:text-white truncate">
                        {place.name}
                      </h2>
                      {place.formattedAddress && (
                        <p className="text-sm text-gray-500 dark:text-gray-400 truncate">
                          {place.formattedAddress}
                        </p>
                      )}
                      {place.topDish && (
                        <div className="mt-2 flex items-center gap-2 flex-wrap">
                          <span className="text-gray-700 dark:text-gray-300">
                            {place.topDish}
                          </span>
                          {place.topVerdict && (
                            <VerdictBadge verdict={place.topVerdict} />
                          )}
                        </div>
                      )}
                    </div>
                    <span className="text-sm text-gray-500 dark:text-gray-400 whitespace-nowrap">
                      {formatDistance(place.distanceMeters)}
                    </span>
                  </div>
                </a>
              ))}
            </div>
          ))}
      </div>
    </div>
  );
}

// Segmented List / Map switch for the home screen. The two views share the same
// places; the map just plots what the list ranks.
function ViewToggle({
  view,
  onChange,
}: {
  view: View;
  onChange: (view: View) => void;
}) {
  const base =
    'px-3 py-1.5 text-sm font-medium rounded-md transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500';
  const active =
    'bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm';
  const inactive =
    'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white';
  return (
    <div
      role="group"
      aria-label="Choose list or map view"
      className="inline-flex gap-1 p-1 bg-gray-200 dark:bg-gray-800 rounded-lg"
    >
      {(['list', 'map'] as const).map(v => (
        <button
          key={v}
          type="button"
          aria-pressed={view === v}
          onClick={() => onChange(v)}
          className={`${base} ${view === v ? active : inactive}`}
        >
          {v === 'list' ? 'List' : 'Map'}
        </button>
      ))}
    </div>
  );
}

// Graceful degrade when we can't use location: explain, offer a retry, and keep
// the app usable via full history (backlog-specified fallback).
function LocationFallback({ onRetry }: { onRetry: () => void }) {
  return (
    <div className="text-center py-12 bg-white dark:bg-gray-800 rounded-lg shadow px-6">
      <div className="text-3xl mb-3">📍</div>
      <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
        Turn on location to see places near you
      </h2>
      <p className="text-gray-600 dark:text-gray-400 mb-6 max-w-md mx-auto">
        Allow location access and we&apos;ll sort your places by distance so you
        can spot the good one nearby. Until then, everything&apos;s in your
        history.
      </p>
      <div className="flex flex-col sm:flex-row gap-3 justify-center">
        <button
          onClick={onRetry}
          className="bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-4 rounded-lg transition-colors"
        >
          Enable location
        </button>
        <a
          href="/history"
          className="inline-flex items-center justify-center py-2 px-4 rounded-lg font-medium text-gray-700 dark:text-gray-300 border border-gray-300 dark:border-gray-600 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
        >
          View your history
        </a>
      </div>
    </div>
  );
}

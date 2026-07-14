'use client';

import { useEffect, useRef, useState } from 'react';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { verdictStyles, type Verdict } from '@/lib/verdict';
// Type-only — erased at compile time, so importing from the server-side lib
// doesn't pull Drizzle/db into this client bundle. Keeps the shape in one place.
import type { MapPlace } from '@/lib/places/near-me';

// Free, keyless vector tiles — no Google Maps SDK, no token-metered vendor lock.
const TILE_STYLE = 'https://tiles.openfreemap.org/styles/liberty';

// Pin color = the verdict of the place's top dish, so the map reads at a glance:
// green = order again, amber = on the fence, red = skip, gray = no verdict yet.
const VERDICT_PIN_COLOR: Record<Verdict, string> = {
  yes: '#16a34a', // green-600
  maybe: '#f59e0b', // amber-500
  no: '#dc2626', // red-600
};
const NO_VERDICT_PIN_COLOR = '#6b7280'; // gray-500

function pinColor(verdict: Verdict | null): string {
  return verdict ? VERDICT_PIN_COLOR[verdict] : NO_VERDICT_PIN_COLOR;
}

// Popup content is built as an HTML string, so anything place-derived (name,
// dish) must be escaped — these come from Google/user input, not our control.
function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function popupHtml(place: MapPlace): string {
  const name = escapeHtml(place.name);
  const dishLine = place.topDish
    ? `<div style="margin-top:2px">${escapeHtml(place.topDish)}${
        place.topVerdict
          ? ` · <strong>${escapeHtml(verdictStyles[place.topVerdict].label)}</strong>`
          : ''
      }</div>`
    : '';
  return `<div style="font:14px system-ui,sans-serif;line-height:1.35">
    <div style="font-weight:600">${name}</div>
    ${dishLine}
    <a href="/places/${encodeURIComponent(place.id)}" style="display:inline-block;margin-top:6px;color:#2563eb;font-weight:500">View place →</a>
  </div>`;
}

interface PlacesMapProps {
  /** Where to center initially — the user's location when we have it. */
  center?: { lat: number; lng: number };
}

// The map view of everywhere you've been: one pin per place, colored by the
// verdict of your top dish there, tap for a popup linking to the place page.
// Client-only (MapLibre touches window/WebGL) — imported with ssr:false. Fetches
// by viewport on every pan/zoom so it scales past a single page of places.
export function PlacesMap({ center }: PlacesMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const markersRef = useRef<maplibregl.Marker[]>([]);
  // center is initial-only: read once at mount so a later geolocation fix (or a
  // retry producing a new coords object) doesn't tear down and rebuild the map,
  // losing the user's pan/zoom. The `load` handler frames all places anyway.
  const centerRef = useRef(center);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const initialCenter = centerRef.current;
    const map = new maplibregl.Map({
      container,
      style: TILE_STYLE,
      center: initialCenter
        ? [initialCenter.lng, initialCenter.lat]
        : [-98.5, 39.8], // US-ish fallback until we frame the user's places
      zoom: initialCenter ? 12 : 3,
      attributionControl: { compact: true },
    });
    map.addControl(new maplibregl.NavigationControl(), 'top-right');

    let disposed = false;
    let debounce: ReturnType<typeof setTimeout> | undefined;
    // Monotonic request token: only the newest fetch may render, so a slow
    // response from an earlier viewport can't overwrite pins for the current one.
    let latestRequest = 0;

    const render = (places: MapPlace[]) => {
      markersRef.current.forEach(m => m.remove());
      markersRef.current = places.map(place => {
        const popup = new maplibregl.Popup({ offset: 24 }).setHTML(
          popupHtml(place)
        );
        return new maplibregl.Marker({ color: pinColor(place.topVerdict) })
          .setLngLat([place.lng, place.lat])
          .setPopup(popup)
          .addTo(map);
      });
    };

    const fetchPlaces = async (query: string): Promise<MapPlace[]> => {
      const res = await fetch(`/api/places/in-bounds?${query}`);
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'Failed to load places');
      }
      const data = await res.json();
      return data.places as MapPlace[];
    };

    // Build the query for the current viewport. MapLibre's getBounds() can
    // return unwrapped/over-wide longitudes (panned past the antimeridian, or a
    // zoomed-out wide screen); clamp to valid coords, and if the viewport spans
    // the whole globe, ask for everything rather than an invalid box.
    const viewportQuery = (): string => {
      const b = map.getBounds();
      const sw = b.getSouthWest();
      const ne = b.getNorthEast();
      if (ne.lng - sw.lng >= 360) return 'all=1';
      const clampLat = (v: number) => Math.max(-90, Math.min(90, v));
      const clampLng = (v: number) => Math.max(-180, Math.min(180, v));
      return new URLSearchParams({
        minLat: String(clampLat(sw.lat)),
        maxLat: String(clampLat(ne.lat)),
        minLng: String(clampLng(sw.lng)),
        maxLng: String(clampLng(ne.lng)),
      }).toString();
    };

    const load = async (query: string, onPlaces?: (p: MapPlace[]) => void) => {
      const token = ++latestRequest;
      try {
        const places = await fetchPlaces(query);
        if (disposed || token !== latestRequest) return;
        setError(null);
        onPlaces?.(places);
        render(places);
      } catch (err) {
        if (disposed || token !== latestRequest) return;
        setError(err instanceof Error ? err.message : 'Failed to load places');
      }
    };

    const refresh = () => {
      clearTimeout(debounce);
      // Debounce so a pan/zoom gesture fires one request when it settles.
      debounce = setTimeout(() => load(viewportQuery()), 250);
    };

    map.on('load', () => {
      // Open framed to everywhere you've been (the whole point of the map), then
      // let viewport fetches take over as the user explores. fitBounds emits a
      // moveend that refetches the (now-framed) viewport — harmless, self-heals.
      load('all=1', all => {
        if (all.length === 0) return;
        const b = new maplibregl.LngLatBounds();
        all.forEach(p => b.extend([p.lng, p.lat]));
        map.fitBounds(b, { padding: 64, maxZoom: 14, animate: false });
      });
    });

    map.on('moveend', refresh);

    return () => {
      disposed = true;
      clearTimeout(debounce);
      markersRef.current.forEach(m => m.remove());
      markersRef.current = [];
      map.remove();
    };
  }, []);

  return (
    <div className="relative">
      <div
        ref={containerRef}
        className="h-[70vh] w-full rounded-lg overflow-hidden shadow"
        aria-label="Map of your places"
      />
      {error && (
        <div className="absolute top-3 left-1/2 -translate-x-1/2 bg-red-50 dark:bg-red-900/40 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300 text-sm rounded-lg px-4 py-2 shadow">
          {error}
        </div>
      )}
    </div>
  );
}

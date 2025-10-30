'use client';

import { useState, useEffect, useRef } from 'react';
import type { Place } from '@/lib/places';

interface PlacePickerProps {
  onPlaceSelect?: (place: Place) => void;
  defaultLocation?: { lat: number; lng: number };
}

export function PlacePicker({
  onPlaceSelect,
  defaultLocation,
}: PlacePickerProps) {
  const [query, setQuery] = useState('');
  const [places, setPlaces] = useState<Place[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedPlace, setSelectedPlace] = useState<Place | null>(null);
  const [showDropdown, setShowDropdown] = useState(false);
  const [location, setLocation] = useState(defaultLocation);
  const inputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Handle clicking outside to close dropdown
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node) &&
        !inputRef.current?.contains(event.target as Node)
      ) {
        setShowDropdown(false);
      }
    }

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Get user's location
  const getUserLocation = () => {
    setLoading(true);
    setError(null);

    if (!navigator.geolocation) {
      setError('Geolocation is not supported by your browser');
      setLoading(false);
      return;
    }

    navigator.geolocation.getCurrentPosition(
      position => {
        const newLocation = {
          lat: position.coords.latitude,
          lng: position.coords.longitude,
        };
        setLocation(newLocation);
        setLoading(false);

        // Auto-search if there's a query
        if (query.trim()) {
          searchPlaces(query, newLocation);
        }
      },
      error => {
        setError(`Failed to get location: ${error.message}`);
        setLoading(false);
      }
    );
  };

  const searchPlaces = async (
    searchQuery: string,
    searchLocation?: { lat: number; lng: number }
  ) => {
    const loc = searchLocation || location;

    if (!loc) {
      setError('Please enable location access first');
      return;
    }

    if (!searchQuery.trim()) {
      setPlaces([]);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/places/nearby', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          lat: loc.lat,
          lng: loc.lng,
          keyword: searchQuery,
          radius: 5000, // 5km radius
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to search places');
      }

      const data = await response.json();
      setPlaces(data.places || []);
      setShowDropdown(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to search places');
      setPlaces([]);
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (value: string) => {
    setQuery(value);
    setSelectedPlace(null);

    // Debounce search
    const timeoutId = setTimeout(() => {
      searchPlaces(value);
    }, 300);

    return () => clearTimeout(timeoutId);
  };

  const handlePlaceSelect = (place: Place) => {
    setSelectedPlace(place);
    setQuery(place.name);
    setShowDropdown(false);
    onPlaceSelect?.(place);
  };

  return (
    <div className="w-full max-w-2xl">
      {/* Location button */}
      {!location && (
        <div className="mb-4">
          <button
            onClick={getUserLocation}
            disabled={loading}
            className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white font-medium py-2 px-4 rounded-lg transition-colors"
          >
            {loading ? 'Getting location...' : 'Use My Location'}
          </button>
        </div>
      )}

      {location && (
        <div className="mb-2 text-sm text-gray-600 dark:text-gray-400">
          Searching near: {location.lat.toFixed(4)}, {location.lng.toFixed(4)}
          <button
            onClick={getUserLocation}
            className="ml-2 text-blue-600 hover:underline"
          >
            Update location
          </button>
        </div>
      )}

      {/* Search input */}
      <div className="relative">
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={e => handleInputChange(e.target.value)}
          onFocus={() => {
            if (places.length > 0) {
              setShowDropdown(true);
            }
          }}
          placeholder="Search for a place (e.g., pizza, coffee, restaurant name)..."
          disabled={!location}
          className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-gray-100 disabled:cursor-not-allowed dark:bg-gray-700 dark:text-white"
        />

        {loading && (
          <div className="absolute right-3 top-3">
            <div className="animate-spin h-6 w-6 border-2 border-blue-600 border-t-transparent rounded-full"></div>
          </div>
        )}

        {/* Dropdown */}
        {showDropdown && places.length > 0 && (
          <div
            ref={dropdownRef}
            className="absolute z-10 w-full mt-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg shadow-lg max-h-96 overflow-y-auto"
          >
            {places.map(place => (
              <button
                key={place.place_id}
                onClick={() => handlePlaceSelect(place)}
                className="w-full text-left px-4 py-3 hover:bg-gray-100 dark:hover:bg-gray-700 border-b border-gray-200 dark:border-gray-700 last:border-b-0 transition-colors"
              >
                <div className="font-medium text-gray-900 dark:text-white">
                  {place.name}
                </div>
                {place.address && (
                  <div className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                    {place.address}
                  </div>
                )}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Error message */}
      {error && (
        <div className="mt-2 text-sm text-red-600 dark:text-red-400">
          {error}
        </div>
      )}

      {/* Selected place display */}
      {selectedPlace && (
        <div className="mt-4 p-4 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg">
          <div className="text-sm font-medium text-green-800 dark:text-green-200 mb-1">
            Selected Place:
          </div>
          <div className="font-semibold text-gray-900 dark:text-white">
            {selectedPlace.name}
          </div>
          {selectedPlace.address && (
            <div className="text-sm text-gray-600 dark:text-gray-400 mt-1">
              {selectedPlace.address}
            </div>
          )}
          <div className="text-xs text-gray-500 dark:text-gray-500 mt-2">
            Coordinates: {selectedPlace.lat.toFixed(6)},{' '}
            {selectedPlace.lng.toFixed(6)}
          </div>
        </div>
      )}
    </div>
  );
}

'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { PlacePicker } from '@/components/place-picker';
import type { Place } from '@/lib/places';

export default function CheckInPage() {
  const router = useRouter();
  const [selectedPlace, setSelectedPlace] = useState<Place | null>(null);
  const [dishText, setDishText] = useState('');
  const [noteText, setNoteText] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!selectedPlace) {
      setError('Please select a place');
      return;
    }

    if (!dishText.trim()) {
      setError('Please enter a dish name');
      return;
    }

    setLoading(true);

    try {
      const response = await fetch('/api/checkins', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          placeId: selectedPlace.place_id,
          placeName: selectedPlace.name,
          lat: selectedPlace.lat,
          lng: selectedPlace.lng,
          dishText: dishText.trim(),
          noteText: noteText.trim() || null,
          visitDatetime: new Date().toISOString(),
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to create check-in');
      }

      // Success! Redirect to history
      router.push('/history');
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Failed to create check-in'
      );
    } finally {
      setLoading(false);
    }
  };

  const dishCharsRemaining = 100 - dishText.length;
  const noteCharsRemaining = 500 - noteText.length;

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 py-8 px-4">
      <div className="max-w-2xl mx-auto">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-8">
          Check In
        </h1>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Place Picker */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Where did you eat? *
            </label>
            <PlacePicker onPlaceSelect={setSelectedPlace} />
          </div>

          {/* Dish Text */}
          <div>
            <label
              htmlFor="dish"
              className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2"
            >
              What did you order? *
            </label>
            <input
              id="dish"
              type="text"
              value={dishText}
              onChange={e => setDishText(e.target.value)}
              maxLength={100}
              placeholder="e.g., Margherita Pizza"
              className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-800 dark:text-white"
              required
            />
            <div className="mt-1 text-sm text-gray-500 dark:text-gray-400 text-right">
              {dishCharsRemaining} characters remaining
            </div>
          </div>

          {/* Note Text */}
          <div>
            <label
              htmlFor="note"
              className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2"
            >
              Notes (optional)
            </label>
            <textarea
              id="note"
              value={noteText}
              onChange={e => setNoteText(e.target.value)}
              maxLength={500}
              rows={4}
              placeholder="What did you think? Any details to remember for next time?"
              className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-800 dark:text-white resize-none"
            />
            <div className="mt-1 text-sm text-gray-500 dark:text-gray-400 text-right">
              {noteCharsRemaining} characters remaining
            </div>
          </div>

          {/* Error Message */}
          {error && (
            <div className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
              <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
            </div>
          )}

          {/* Submit Button */}
          <button
            type="submit"
            disabled={loading || !selectedPlace || !dishText.trim()}
            className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed text-white font-medium py-3 px-4 rounded-lg transition-colors"
          >
            {loading ? 'Saving...' : 'Save Check-In'}
          </button>
        </form>
      </div>
    </div>
  );
}

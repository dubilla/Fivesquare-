'use client';

import { useState, useEffect } from 'react';

interface CheckIn {
  id: string;
  placeId: string;
  placeName: string;
  lat: number;
  lng: number;
  dishText: string;
  noteText: string | null;
  visitDatetime: string;
  createdAt: string;
  updatedAt: string;
}

export default function HistoryPage() {
  const [checkIns, setCheckIns] = useState<CheckIn[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchCheckIns() {
      try {
        const response = await fetch('/api/checkins');

        if (!response.ok) {
          const data = await response.json();
          throw new Error(data.error || 'Failed to fetch check-ins');
        }

        const data = await response.json();
        setCheckIns(data.checkIns);
      } catch (err) {
        setError(
          err instanceof Error ? err.message : 'Failed to load check-ins'
        );
      } finally {
        setLoading(false);
      }
    }

    fetchCheckIns();
  }, []);

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return new Intl.DateTimeFormat('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    }).format(date);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 py-8 px-4">
        <div className="max-w-4xl mx-auto">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-8">
            Your Check-Ins
          </h1>
          <div className="text-center py-12">
            <div className="animate-spin h-12 w-12 border-4 border-blue-600 border-t-transparent rounded-full mx-auto"></div>
            <p className="mt-4 text-gray-600 dark:text-gray-400">
              Loading your check-ins...
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 py-8 px-4">
        <div className="max-w-4xl mx-auto">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-8">
            Your Check-Ins
          </h1>
          <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-6">
            <p className="text-red-600 dark:text-red-400">{error}</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 py-8 px-4">
      <div className="max-w-4xl mx-auto">
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
            Your Check-Ins
          </h1>
          <a
            href="/check-in"
            className="bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-4 rounded-lg transition-colors"
          >
            New Check-In
          </a>
        </div>

        {checkIns.length === 0 ? (
          <div className="text-center py-12 bg-white dark:bg-gray-800 rounded-lg shadow">
            <p className="text-gray-600 dark:text-gray-400 mb-4">
              No check-ins yet!
            </p>
            <a
              href="/check-in"
              className="inline-block bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-4 rounded-lg transition-colors"
            >
              Create your first check-in
            </a>
          </div>
        ) : (
          <div className="space-y-4">
            {checkIns.map(checkIn => (
              <div
                key={checkIn.id}
                className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 hover:shadow-md transition-shadow"
              >
                <div className="flex justify-between items-start mb-3">
                  <div>
                    <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
                      {checkIn.dishText}
                    </h2>
                    <p className="text-gray-600 dark:text-gray-400 mt-1">
                      {checkIn.placeName}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                      {formatDate(checkIn.visitDatetime)}
                    </p>
                  </div>
                </div>

                {checkIn.noteText && (
                  <p className="text-gray-700 dark:text-gray-300 mt-3">
                    {checkIn.noteText}
                  </p>
                )}

                <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
                  <a
                    href={`https://www.google.com/maps/search/?api=1&query=${checkIn.lat},${checkIn.lng}&query_place_id=${checkIn.placeId}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm text-blue-600 dark:text-blue-400 hover:underline"
                  >
                    View on Google Maps →
                  </a>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

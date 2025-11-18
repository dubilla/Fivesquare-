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
  const [editingCheckIn, setEditingCheckIn] = useState<CheckIn | null>(null);
  const [editDishText, setEditDishText] = useState('');
  const [editNoteText, setEditNoteText] = useState('');
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);

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

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this check-in?')) {
      return;
    }

    setDeleting(id);
    try {
      const response = await fetch(`/api/checkins/${id}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to delete check-in');
      }

      // Remove from state
      setCheckIns(checkIns.filter(c => c.id !== id));
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to delete check-in');
    } finally {
      setDeleting(null);
    }
  };

  const handleEditClick = (checkIn: CheckIn) => {
    setEditingCheckIn(checkIn);
    setEditDishText(checkIn.dishText);
    setEditNoteText(checkIn.noteText || '');
  };

  const handleCancelEdit = () => {
    setEditingCheckIn(null);
    setEditDishText('');
    setEditNoteText('');
  };

  const handleSaveEdit = async () => {
    if (!editingCheckIn) return;

    setSaving(true);
    try {
      const response = await fetch(`/api/checkins/${editingCheckIn.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          placeId: editingCheckIn.placeId,
          placeName: editingCheckIn.placeName,
          lat: editingCheckIn.lat,
          lng: editingCheckIn.lng,
          dishText: editDishText.trim(),
          noteText: editNoteText.trim() || null,
          visitDatetime: editingCheckIn.visitDatetime,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to update check-in');
      }

      const updated = await response.json();

      // Update in state
      setCheckIns(
        checkIns.map(c => (c.id === editingCheckIn.id ? updated : c))
      );

      handleCancelEdit();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to update check-in');
    } finally {
      setSaving(false);
    }
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

                <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700 flex justify-between items-center">
                  <a
                    href={`https://www.google.com/maps/search/?api=1&query=${checkIn.lat},${checkIn.lng}&query_place_id=${checkIn.placeId}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm text-blue-600 dark:text-blue-400 hover:underline"
                  >
                    View on Google Maps →
                  </a>
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleEditClick(checkIn)}
                      className="text-sm text-gray-600 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 font-medium"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => handleDelete(checkIn.id)}
                      disabled={deleting === checkIn.id}
                      className="text-sm text-gray-600 dark:text-gray-400 hover:text-red-600 dark:hover:text-red-400 font-medium disabled:opacity-50"
                    >
                      {deleting === checkIn.id ? 'Deleting...' : 'Delete'}
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Edit Modal */}
        {editingCheckIn && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-2xl w-full p-6">
              <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">
                Edit Check-In
              </h2>

              <div className="space-y-4">
                {/* Dish Text */}
                <div>
                  <label
                    htmlFor="edit-dish"
                    className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2"
                  >
                    What did you order? *
                  </label>
                  <input
                    id="edit-dish"
                    type="text"
                    value={editDishText}
                    onChange={e => setEditDishText(e.target.value)}
                    maxLength={100}
                    className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
                  />
                  <div className="mt-1 text-sm text-gray-500 dark:text-gray-400 text-right">
                    {100 - editDishText.length} characters remaining
                  </div>
                </div>

                {/* Note Text */}
                <div>
                  <label
                    htmlFor="edit-note"
                    className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2"
                  >
                    Notes (optional)
                  </label>
                  <textarea
                    id="edit-note"
                    value={editNoteText}
                    onChange={e => setEditNoteText(e.target.value)}
                    maxLength={500}
                    rows={4}
                    className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white resize-none"
                  />
                  <div className="mt-1 text-sm text-gray-500 dark:text-gray-400 text-right">
                    {500 - editNoteText.length} characters remaining
                  </div>
                </div>
              </div>

              {/* Modal Actions */}
              <div className="mt-6 flex justify-end gap-3">
                <button
                  onClick={handleCancelEdit}
                  disabled={saving}
                  className="px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg font-medium disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSaveEdit}
                  disabled={saving || !editDishText.trim()}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {saving ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

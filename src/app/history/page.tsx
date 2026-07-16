'use client';

import { useState, useEffect, useCallback, useRef, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { VerdictControl } from '@/components/verdict-control';
import { VerdictBadge } from '@/components/verdict-badge';
import { VERDICTS, verdictStyles, isVerdict } from '@/lib/verdict';
import type { Verdict } from '@/lib/verdict';

interface CheckIn {
  id: string;
  placeUuid: string | null;
  // Place fields come from the places join now and are null only for a row
  // that somehow never got linked (shouldn't happen post-S5 migration).
  placeId: string | null;
  placeName: string | null;
  lat: number | null;
  lng: number | null;
  dishText: string;
  noteText: string | null;
  verdict: Verdict | null;
  visitDatetime: string;
  createdAt: string;
  updatedAt: string;
}

function HistoryView() {
  const router = useRouter();
  const searchParams = useSearchParams();

  // Filter state is seeded from the URL so a shared/bookmarked link or the back
  // button restores exactly what you were looking at. History's job is
  // recall-by-dish, so the only filters here are search (q) and verdict;
  // place-scoped recall lives on the place page. The API also accepts a placeId
  // param, but this page deliberately doesn't wire it — nothing here reads or
  // writes it, so there's no invisible place filter to get stuck in.
  const initialVerdict = searchParams.get('verdict');
  const [search, setSearch] = useState(() => searchParams.get('q') ?? '');
  const [verdict, setVerdict] = useState<Verdict | null>(
    isVerdict(initialVerdict) ? initialVerdict : null
  );
  // Debounced mirror of `search` — what actually drives fetching + the URL, so
  // typing doesn't fire a request (or a history-replace) on every keystroke.
  const [debouncedSearch, setDebouncedSearch] = useState(search);

  const [checkIns, setCheckIns] = useState<CheckIn[]>([]);
  const [loading, setLoading] = useState(true);
  // Distinct from `loading` (first paint): true while a filter-change refetch is
  // in flight, so the list can dim instead of showing stale rows as if current.
  const [isFetching, setIsFetching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editingCheckIn, setEditingCheckIn] = useState<CheckIn | null>(null);
  const [editDishText, setEditDishText] = useState('');
  const [editNoteText, setEditNoteText] = useState('');
  const [editVerdict, setEditVerdict] = useState<Verdict | null>(null);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);

  const hasFilters = debouncedSearch.trim() !== '' || verdict !== null;

  // Debounce the search box (300ms) into debouncedSearch.
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(t);
  }, [search]);

  // Monotonic request token: a slow response for an earlier filter state must
  // not overwrite a newer one (out-of-order fetches). Only the latest wins.
  const requestToken = useRef(0);

  useEffect(() => {
    const q = debouncedSearch.trim();

    // Reflect filter state in the URL (shareable / back-button-safe). replace,
    // not push, so typing doesn't flood history.
    const params = new URLSearchParams();
    if (q) params.set('q', q);
    if (verdict) params.set('verdict', verdict);
    const qs = params.toString();
    router.replace(qs ? `/history?${qs}` : '/history', { scroll: false });

    const token = ++requestToken.current;
    setIsFetching(true);
    async function fetchCheckIns() {
      try {
        const response = await fetch(`/api/checkins${qs ? `?${qs}` : ''}`);

        if (!response.ok) {
          const data = await response.json();
          throw new Error(data.error || 'Failed to fetch check-ins');
        }

        const data = await response.json();
        if (token !== requestToken.current) return; // stale response
        setCheckIns(data.checkIns);
        setError(null);
      } catch (err) {
        if (token !== requestToken.current) return;
        setError(
          err instanceof Error ? err.message : 'Failed to load check-ins'
        );
      } finally {
        if (token === requestToken.current) {
          setLoading(false);
          setIsFetching(false);
        }
      }
    }

    fetchCheckIns();
  }, [debouncedSearch, verdict, router]);

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
    setEditVerdict(checkIn.verdict);
  };

  const handleCancelEdit = () => {
    setEditingCheckIn(null);
    setEditDishText('');
    setEditNoteText('');
    setEditVerdict(null);
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
          dishText: editDishText.trim(),
          noteText: editNoteText.trim() || null,
          verdict: editVerdict,
          visitDatetime: editingCheckIn.visitDatetime,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to update check-in');
      }

      const updated = await response.json();

      // Merge the update over the existing row: the PUT response carries only
      // the check-in's own fields (dish/note/verdict/…), so keep the place data
      // we already have — editing never changes the place.
      setCheckIns(
        checkIns.map(c =>
          c.id === editingCheckIn.id ? { ...c, ...updated } : c
        )
      );

      handleCancelEdit();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to update check-in');
    } finally {
      setSaving(false);
    }
  };

  const clearFilters = useCallback(() => {
    setSearch('');
    // Skip the 300ms search debounce so Clear refetches immediately.
    setDebouncedSearch('');
    setVerdict(null);
  }, []);

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

        {/* Filter bar (S8). History's job is recall-by-dish — "where was that
            great pad thai?" — so it filters by what you ate (search) and
            whether you'd reorder (verdict chips). Place-scoped recall is the
            place page's job, so there's deliberately no place control here. */}
        <div className="mb-6 space-y-3">
          <input
            type="search"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search your dishes and places…"
            aria-label="Search check-ins"
            className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-800 dark:text-white"
          />
          <div
            role="group"
            aria-label="Filter by reorder verdict"
            className="flex items-center gap-2 flex-wrap"
          >
            <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
              Reorder?
            </span>
            {VERDICTS.map(v => {
              const active = verdict === v;
              return (
                <button
                  key={v}
                  type="button"
                  aria-pressed={active}
                  onClick={() => setVerdict(active ? null : v)}
                  className={`min-h-[44px] px-4 py-2 rounded-full border text-sm font-medium transition-colors ${
                    active
                      ? verdictStyles[v].selected
                      : 'bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700'
                  }`}
                >
                  {verdictStyles[v].label}
                </button>
              );
            })}
            {hasFilters && (
              <button
                type="button"
                onClick={clearFilters}
                className="min-h-[44px] px-3 text-sm font-medium text-gray-500 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400"
              >
                Clear
              </button>
            )}
          </div>
        </div>

        {checkIns.length === 0 ? (
          hasFilters ? (
            <div className="text-center py-12 bg-white dark:bg-gray-800 rounded-lg shadow">
              <p className="text-gray-600 dark:text-gray-400 mb-4">
                No check-ins match your filters.
              </p>
              <button
                type="button"
                onClick={clearFilters}
                className="inline-block bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-4 rounded-lg transition-colors"
              >
                Clear filters
              </button>
            </div>
          ) : (
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
          )
        ) : (
          <div
            aria-busy={isFetching}
            className={`space-y-4 transition-opacity ${
              isFetching ? 'opacity-50' : 'opacity-100'
            }`}
          >
            {checkIns.map(checkIn => (
              <div
                key={checkIn.id}
                className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 hover:shadow-md transition-shadow"
              >
                <div className="flex justify-between items-start mb-3">
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
                        {checkIn.dishText}
                      </h2>
                      {checkIn.verdict && (
                        <VerdictBadge verdict={checkIn.verdict} />
                      )}
                    </div>
                    {checkIn.placeUuid ? (
                      <a
                        href={`/places/${checkIn.placeUuid}`}
                        className="text-gray-600 dark:text-gray-400 mt-1 inline-block hover:text-blue-600 dark:hover:text-blue-400 hover:underline"
                      >
                        {checkIn.placeName}
                      </a>
                    ) : (
                      <p className="text-gray-600 dark:text-gray-400 mt-1">
                        {checkIn.placeName ?? 'Unknown place'}
                      </p>
                    )}
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
                  {checkIn.lat != null &&
                  checkIn.lng != null &&
                  checkIn.placeId ? (
                    <a
                      href={`https://www.google.com/maps/search/?api=1&query=${checkIn.lat},${checkIn.lng}&query_place_id=${checkIn.placeId}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm text-blue-600 dark:text-blue-400 hover:underline"
                    >
                      View on Google Maps →
                    </a>
                  ) : (
                    <span />
                  )}
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

                {/* Verdict */}
                <div>
                  <span className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Would you order this again?
                  </span>
                  <VerdictControl
                    value={editVerdict}
                    onChange={setEditVerdict}
                  />
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

// useSearchParams requires a Suspense boundary during prerender (Next app
// router). The wrapper keeps the page a client component while satisfying that.
export default function HistoryPage() {
  return (
    <Suspense>
      <HistoryView />
    </Suspense>
  );
}

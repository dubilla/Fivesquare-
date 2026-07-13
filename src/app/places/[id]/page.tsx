import { notFound, redirect } from 'next/navigation';
import { and, desc, eq } from 'drizzle-orm';
import { auth } from '@/auth';
import { db } from '@/lib/db/client';
import { checkIns, places } from '@/lib/db/schema';
import { VerdictBadge } from '@/components/verdict-badge';

// A place's page (S4): every visit *you* logged here, newest first. The first
// real payoff of normalizing places — your history at a single place.
// Auth-gated and scoped to the signed-in user; a place you've never visited
// 404s rather than leaking that it exists.

function formatDate(date: Date) {
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(date);
}

export default async function PlacePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await auth();
  if (!session?.user?.id) {
    redirect('/login');
  }

  const { id } = await params;

  const [place] = await db
    .select()
    .from(places)
    .where(eq(places.id, id))
    .limit(1);

  if (!place) {
    notFound();
  }

  const visits = await db
    .select()
    .from(checkIns)
    .where(
      and(eq(checkIns.placeUuid, id), eq(checkIns.userId, session.user.id))
    )
    .orderBy(desc(checkIns.visitDatetime));

  // Don't reveal places the user has never checked into.
  if (visits.length === 0) {
    notFound();
  }

  const mapsUrl = `https://www.google.com/maps/search/?api=1&query=${place.lat},${place.lng}&query_place_id=${place.googlePlaceId}`;

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 py-8 px-4">
      <div className="max-w-4xl mx-auto">
        <a
          href="/history"
          className="text-sm text-blue-600 dark:text-blue-400 hover:underline"
        >
          ← Back to history
        </a>

        <div className="mt-4 mb-8">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
            {place.name}
          </h1>
          {place.formattedAddress && (
            <p className="text-gray-600 dark:text-gray-400 mt-1">
              {place.formattedAddress}
            </p>
          )}
          <a
            href={mapsUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-block mt-3 text-sm text-blue-600 dark:text-blue-400 hover:underline"
          >
            View on Google Maps →
          </a>
        </div>

        <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400 mb-4">
          {visits.length} {visits.length === 1 ? 'visit' : 'visits'}
        </h2>

        <div className="space-y-4">
          {visits.map(visit => (
            <div
              key={visit.id}
              className="bg-white dark:bg-gray-800 rounded-lg shadow p-6"
            >
              <div className="flex justify-between items-start mb-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <h3 className="text-xl font-semibold text-gray-900 dark:text-white">
                    {visit.dishText}
                  </h3>
                  {visit.verdict && <VerdictBadge verdict={visit.verdict} />}
                </div>
                <p className="text-sm text-gray-500 dark:text-gray-400 whitespace-nowrap ml-2">
                  {formatDate(visit.visitDatetime)}
                </p>
              </div>
              {visit.noteText && (
                <p className="text-gray-700 dark:text-gray-300 mt-3">
                  {visit.noteText}
                </p>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

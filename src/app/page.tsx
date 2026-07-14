import { auth } from '@/auth';
import { NearMeHome } from '@/components/near-me-home';

export default async function Home() {
  const session = await auth();

  // Signed-in users land on their "near me" home (S6) — the app's front door,
  // their places sorted by distance — instead of the bare history redirect.
  if (session?.user) {
    return <NearMeHome />;
  }

  // Landing page for signed-out users
  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-800">
      <div className="max-w-4xl mx-auto px-4 py-16 sm:px-6 lg:px-8">
        <div className="text-center">
          <h1 className="text-5xl font-bold text-gray-900 dark:text-white mb-6">
            The Usual
          </h1>
          <p className="text-xl text-gray-600 dark:text-gray-300 mb-4">
            &quot;I&apos;ll have the usual.&quot;
          </p>
          <p className="text-lg text-gray-500 dark:text-gray-400 mb-12 max-w-2xl mx-auto">
            Remember what you ordered and whether you&apos;d order it again.
            Find your usual.
          </p>

          <div className="flex flex-col sm:flex-row gap-4 justify-center mb-16">
            <a
              href="/login"
              className="bg-blue-600 hover:bg-blue-700 text-white font-medium py-3 px-8 rounded-lg transition-colors text-lg"
            >
              Get Started
            </a>
          </div>

          <div className="grid md:grid-cols-3 gap-8 mt-16">
            <div className="bg-white dark:bg-gray-800 rounded-lg p-6 shadow-sm">
              <div className="text-3xl mb-3">📍</div>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                Log what you got
              </h3>
              <p className="text-gray-600 dark:text-gray-400 text-sm">
                Check in at a place and record the dish you ordered, with a note
                to jog your memory.
              </p>
            </div>

            <div className="bg-white dark:bg-gray-800 rounded-lg p-6 shadow-sm">
              <div className="text-3xl mb-3">🍽️</div>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                Find your usual
              </h3>
              <p className="text-gray-600 dark:text-gray-400 text-sm">
                Never wonder &quot;what was that great thing I had here?&quot;
                again.
              </p>
            </div>

            <div className="bg-white dark:bg-gray-800 rounded-lg p-6 shadow-sm">
              <div className="text-3xl mb-3">📝</div>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                Keep your history
              </h3>
              <p className="text-gray-600 dark:text-gray-400 text-sm">
                See everywhere you&apos;ve been and everything you&apos;ve
                ordered in one place.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

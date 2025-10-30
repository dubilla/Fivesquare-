import { auth } from '@/auth';
import { redirect } from 'next/navigation';
import { PlacePicker } from '@/components/place-picker';

export default async function HomePage() {
  const session = await auth();

  if (!session?.user) {
    redirect('/login');
  }

  return (
    <div className="min-h-screen p-8">
      <div className="max-w-2xl mx-auto">
        <header className="mb-8">
          <h1 className="text-3xl font-bold mb-2">Welcome to Reordr</h1>
          <p className="text-gray-600 dark:text-gray-400">
            Logged in as {session.user.email}
          </p>
        </header>

        <main className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6">
          <h2 className="text-xl font-semibold mb-4">Find a Place</h2>
          <p className="text-gray-600 dark:text-gray-400 mb-4">
            Test the Google Places API integration below.
          </p>

          <PlacePicker />
        </main>
      </div>
    </div>
  );
}

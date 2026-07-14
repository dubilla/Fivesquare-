import { auth } from '@/auth';
import Link from 'next/link';
import { SignOutButton } from './sign-out-button';

export async function Navbar() {
  const session = await auth();

  return (
    <nav className="bg-white shadow-sm border-b border-gray-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16 items-center">
          <div className="flex items-center">
            <Link href="/" className="text-xl font-bold text-gray-900">
              The Usual
            </Link>
          </div>

          <div className="flex items-center gap-4">
            {session?.user ? (
              <>
                <div className="flex items-center gap-4">
                  <Link
                    href="/"
                    className="text-sm font-medium text-gray-700 hover:text-gray-900"
                  >
                    Home
                  </Link>
                  <Link
                    href="/check-in"
                    className="text-sm font-medium text-gray-700 hover:text-gray-900"
                  >
                    Check in
                  </Link>
                  <Link
                    href="/history"
                    className="text-sm font-medium text-gray-700 hover:text-gray-900"
                  >
                    History
                  </Link>
                </div>
                <span className="hidden text-sm text-gray-700 sm:inline">
                  {session.user.email}
                </span>
                <SignOutButton />
              </>
            ) : (
              <>
                <Link
                  href="/login"
                  className="text-sm font-medium text-gray-700 hover:text-gray-900"
                >
                  Sign In
                </Link>
                <Link
                  href="/login"
                  className="text-sm font-medium bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700"
                >
                  Sign Up
                </Link>
              </>
            )}
          </div>
        </div>
      </div>
    </nav>
  );
}

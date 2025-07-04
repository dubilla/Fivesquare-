'use client';

import { useUser } from '@/lib/auth';

export function UserStatus() {
  const { user, loading } = useUser();

  if (loading) {
    return (
      <div className="p-4 border rounded-lg bg-gray-50 dark:bg-gray-800">
        <p className="text-sm">Loading user...</p>
      </div>
    );
  }

  return (
    <div className="p-4 border rounded-lg bg-gray-50 dark:bg-gray-800">
      <h3 className="font-semibold mb-2">User Status</h3>
      {user ? (
        <div className="text-sm space-y-1">
          <p>✅ User authenticated</p>
          <p>
            <strong>Email:</strong> {user.email}
          </p>
          <p>
            <strong>ID:</strong> {user.id}
          </p>
          <p>
            <strong>Last sign in:</strong>{' '}
            {user.last_sign_in_at
              ? new Date(user.last_sign_in_at).toLocaleString()
              : 'Unknown'}
          </p>
        </div>
      ) : (
        <div className="text-sm">
          <p>❌ No user authenticated</p>
          <p className="text-gray-600 dark:text-gray-400 mt-1">
            Set up environment variables and Supabase project to test authentication
          </p>
        </div>
      )}
    </div>
  );
}
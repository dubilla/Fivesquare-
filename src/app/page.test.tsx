import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import Home from './page';
import type { Session } from 'next-auth';

// Mock next/navigation
const mockRedirect = vi.fn();
vi.mock('next/navigation', () => ({
  redirect: (path: string) => mockRedirect(path),
}));

// Mock auth
vi.mock('@/auth', () => ({
  auth: vi.fn(),
}));

import { auth } from '@/auth';

describe('Home (Landing Page)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should redirect authenticated users to /history', async () => {
    // @ts-expect-error - mocking NextAuth function
    vi.mocked(auth).mockResolvedValue({
      user: { id: 'user-123', email: 'test@example.com' },
      expires: '',
    } as Session);

    try {
      await Home();
    } catch {
      // Redirect throws, which is expected
    }

    expect(mockRedirect).toHaveBeenCalledWith('/history');
  });

  it('should show landing page for unauthenticated users', async () => {
    // @ts-expect-error - mocking NextAuth function
    vi.mocked(auth).mockResolvedValue(null);

    const component = await Home();
    render(component);

    expect(screen.getByText('Reordr')).toBeInTheDocument();
    expect(
      screen.getByText('Never forget what you ordered')
    ).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Get Started' })).toHaveAttribute(
      'href',
      '/login'
    );
  });

  it('should display feature cards', async () => {
    // @ts-expect-error - mocking NextAuth function
    vi.mocked(auth).mockResolvedValue(null);

    const component = await Home();
    render(component);

    expect(screen.getByText('Track Dishes')).toBeInTheDocument();
    expect(screen.getByText('Remember Favorites')).toBeInTheDocument();
    expect(screen.getByText('Build History')).toBeInTheDocument();
  });

  it('should have Get Started button linking to login', async () => {
    // @ts-expect-error - mocking NextAuth function
    vi.mocked(auth).mockResolvedValue(null);

    const component = await Home();
    render(component);

    const getStartedButton = screen.getByRole('link', { name: 'Get Started' });
    expect(getStartedButton).toBeInTheDocument();
    expect(getStartedButton).toHaveAttribute('href', '/login');
  });
});

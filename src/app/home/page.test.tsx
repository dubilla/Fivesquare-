import { describe, it, expect, vi, beforeEach, type Mock } from 'vitest';
import { render, screen } from '@testing-library/react';
import HomePage from './page';
import type { Session } from 'next-auth';

// Mock dependencies
vi.mock('@/auth', () => ({
  auth: vi.fn(),
}));

vi.mock('next/navigation', () => ({
  redirect: vi.fn(),
}));

vi.mock('@/components/place-picker', () => ({
  PlacePicker: () => <div data-testid="place-picker">Place Picker Mock</div>,
}));

import { auth } from '@/auth';
import { redirect } from 'next/navigation';

describe('HomePage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should redirect to /login when user is not authenticated', async () => {
    (auth as Mock).mockResolvedValueOnce(null);
    // redirect throws in Next.js to halt execution
    vi.mocked(redirect).mockImplementationOnce(() => {
      throw new Error('NEXT_REDIRECT');
    });

    await expect(HomePage()).rejects.toThrow('NEXT_REDIRECT');
    expect(redirect).toHaveBeenCalledWith('/login');
  });

  it('should redirect to /login when session exists but no user', async () => {
    (auth as Mock).mockResolvedValueOnce({
      user: undefined,
      expires: '',
    } as Session);
    // redirect throws in Next.js to halt execution
    vi.mocked(redirect).mockImplementationOnce(() => {
      throw new Error('NEXT_REDIRECT');
    });

    await expect(HomePage()).rejects.toThrow('NEXT_REDIRECT');
    expect(redirect).toHaveBeenCalledWith('/login');
  });

  it('should render welcome message with user email when authenticated', async () => {
    (auth as Mock).mockResolvedValueOnce({
      user: { id: '1', email: 'test@example.com' },
      expires: '',
    } as Session);

    const component = await HomePage();
    render(component);

    expect(screen.getByText('Welcome to Reordr')).toBeInTheDocument();
    expect(
      screen.getByText(/Logged in as test@example\.com/)
    ).toBeInTheDocument();
  });

  it('should render PlacePicker component when authenticated', async () => {
    (auth as Mock).mockResolvedValueOnce({
      user: { id: '1', email: 'test@example.com' },
      expires: '',
    } as Session);

    const component = await HomePage();
    render(component);

    expect(screen.getByTestId('place-picker')).toBeInTheDocument();
  });

  it('should display "Find a Place" heading when authenticated', async () => {
    (auth as Mock).mockResolvedValueOnce({
      user: { id: '1', email: 'user@example.com' },
      expires: '',
    } as Session);

    const component = await HomePage();
    render(component);

    expect(screen.getByText('Find a Place')).toBeInTheDocument();
    expect(
      screen.getByText(/Test the Google Places API integration/)
    ).toBeInTheDocument();
  });
});

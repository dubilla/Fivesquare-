import { describe, it, expect, vi, beforeEach, type Mock } from 'vitest';
import { render, screen } from '@testing-library/react';
import PlacePage from './page';

vi.mock('@/auth', () => ({ auth: vi.fn() }));

vi.mock('@/lib/db/client', () => ({ db: { select: vi.fn() } }));

// redirect/notFound throw in real Next to halt rendering — mirror that so the
// page's control flow (no early return after redirect) is exercised faithfully.
vi.mock('next/navigation', () => ({
  redirect: vi.fn(() => {
    throw new Error('REDIRECT');
  }),
  notFound: vi.fn(() => {
    throw new Error('NOT_FOUND');
  }),
}));

import { auth } from '@/auth';
import { db } from '@/lib/db/client';
import { redirect, notFound } from 'next/navigation';

const place = {
  id: 'place-uuid-1',
  googlePlaceId: 'g-1',
  name: 'Tartine Bakery',
  formattedAddress: '600 Guerrero St',
  primaryType: 'bakery',
  lat: 37.7614,
  lng: -122.4241,
};

function mockPlaceQuery(placeRows: unknown[]) {
  return {
    from: vi.fn().mockReturnValue({
      where: vi.fn().mockReturnValue({
        limit: vi.fn().mockResolvedValue(placeRows),
      }),
    }),
  };
}

function mockVisitsQuery(visitRows: unknown[]) {
  return {
    from: vi.fn().mockReturnValue({
      where: vi.fn().mockReturnValue({
        orderBy: vi.fn().mockResolvedValue(visitRows),
      }),
    }),
  };
}

const params = Promise.resolve({ id: 'place-uuid-1' });

describe('PlacePage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('redirects to /login when unauthenticated', async () => {
    (auth as Mock).mockResolvedValue(null);

    await expect(PlacePage({ params })).rejects.toThrow('REDIRECT');
    expect(redirect).toHaveBeenCalledWith('/login');
  });

  it('404s when the place does not exist', async () => {
    (auth as Mock).mockResolvedValue({ user: { id: 'user-1' }, expires: '' });
    (db.select as Mock).mockReturnValueOnce(mockPlaceQuery([]));

    await expect(PlacePage({ params })).rejects.toThrow('NOT_FOUND');
    expect(notFound).toHaveBeenCalled();
  });

  it('404s when the user has never visited the place (no leak)', async () => {
    (auth as Mock).mockResolvedValue({ user: { id: 'user-1' }, expires: '' });
    (db.select as Mock)
      .mockReturnValueOnce(mockPlaceQuery([place]))
      .mockReturnValueOnce(mockVisitsQuery([]));

    await expect(PlacePage({ params })).rejects.toThrow('NOT_FOUND');
    expect(notFound).toHaveBeenCalled();
  });

  it('renders the place and the user’s visits when authorized', async () => {
    (auth as Mock).mockResolvedValue({ user: { id: 'user-1' }, expires: '' });
    (db.select as Mock)
      .mockReturnValueOnce(mockPlaceQuery([place]))
      .mockReturnValueOnce(
        mockVisitsQuery([
          {
            id: 'checkin-1',
            dishText: 'Morning bun',
            noteText: 'Worth the line.',
            verdict: 'yes',
            visitDatetime: new Date('2025-06-01T12:00:00Z'),
          },
        ])
      );

    render(await PlacePage({ params }));

    expect(screen.getByText('Tartine Bakery')).toBeInTheDocument();
    expect(screen.getByText('600 Guerrero St')).toBeInTheDocument();
    expect(screen.getByText('Morning bun')).toBeInTheDocument();
    expect(screen.getByText('Worth the line.')).toBeInTheDocument();
    expect(notFound).not.toHaveBeenCalled();
  });
});

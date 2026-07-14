import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { NearMeHome } from './near-me-home';

// PlacesMap pulls in MapLibre (WebGL, no jsdom support), so stub it — these
// tests exercise the toggle wiring, not the map itself.
vi.mock('@/components/places-map', () => ({
  PlacesMap: () => <div data-testid="places-map">map</div>,
}));

// NearMeHome owns the geolocation → fetch flow. These tests cover the graceful
// paths (unavailable / denied / success) without a real browser or DB.

describe('NearMeHome', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    // Reset geolocation between tests.
    delete (navigator as unknown as { geolocation?: unknown }).geolocation;
  });

  it('falls back (not a crash) when geolocation is unavailable', async () => {
    // jsdom has no navigator.geolocation by default; component must degrade.
    render(<NearMeHome />);

    expect(
      await screen.findByText('Turn on location to see places near you')
    ).toBeInTheDocument();
    // The history escape hatch is offered.
    expect(
      screen.getByRole('link', { name: 'View your history' })
    ).toHaveAttribute('href', '/history');
  });

  it('shows the enable-location prompt when permission is denied', async () => {
    const getCurrentPosition = vi.fn((_success, error) => {
      error({ code: 1, PERMISSION_DENIED: 1 });
    });
    // @ts-expect-error - stub geolocation
    navigator.geolocation = { getCurrentPosition };

    render(<NearMeHome />);

    expect(
      await screen.findByText('Turn on location to see places near you')
    ).toBeInTheDocument();
  });

  it('renders distance-ordered place cards on success', async () => {
    const getCurrentPosition = vi.fn(success => {
      success({ coords: { latitude: 37.77, longitude: -122.42 } });
    });
    // @ts-expect-error - stub geolocation
    navigator.geolocation = { getCurrentPosition };

    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          places: [
            {
              id: 'p1',
              name: 'Blue Bottle Coffee',
              formattedAddress: '66 Mint St',
              distanceMeters: 120,
              topDish: 'Cappuccino',
              topVerdict: 'yes',
            },
          ],
        }),
      })
    );

    render(<NearMeHome />);

    expect(await screen.findByText('Blue Bottle Coffee')).toBeInTheDocument();
    expect(screen.getByText('Cappuccino')).toBeInTheDocument();
    expect(screen.getByText('120m')).toBeInTheDocument();
    // Card links to the place page.
    expect(
      screen.getByRole('link', { name: /Blue Bottle Coffee/ })
    ).toHaveAttribute('href', '/places/p1');
  });

  it('shows the empty state when there are no nearby places', async () => {
    const getCurrentPosition = vi.fn(success => {
      success({ coords: { latitude: 37.77, longitude: -122.42 } });
    });
    // @ts-expect-error - stub geolocation
    navigator.geolocation = { getCurrentPosition };

    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValue({ ok: true, json: async () => ({ places: [] }) })
    );

    render(<NearMeHome />);

    // Empty within the widest radius must still offer the history escape hatch,
    // not read as "you have no places".
    await waitFor(() =>
      expect(screen.getByText(/No places within 50/)).toBeInTheDocument()
    );
    expect(
      screen.getByRole('link', { name: 'View all your places' })
    ).toHaveAttribute('href', '/history');
  });

  it('switches to the map view — and back — via the toggle', async () => {
    const user = userEvent.setup();
    // Map view must work regardless of geolocation, so leave it unavailable.
    render(<NearMeHome />);

    // Defaults to the list: the location fallback shows, no map.
    expect(
      await screen.findByText('Turn on location to see places near you')
    ).toBeInTheDocument();
    expect(screen.queryByTestId('places-map')).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Map' }));

    // Map appears; the list's location fallback is gone.
    expect(await screen.findByTestId('places-map')).toBeInTheDocument();
    expect(
      screen.queryByText('Turn on location to see places near you')
    ).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'List' }));
    expect(screen.queryByTestId('places-map')).not.toBeInTheDocument();
    expect(
      screen.getByText('Turn on location to see places near you')
    ).toBeInTheDocument();
  });
});

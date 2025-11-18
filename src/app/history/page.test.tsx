import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import HistoryPage from './page';

// Mock fetch
global.fetch = vi.fn();

describe('HistoryPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should show loading state initially', () => {
    vi.mocked(fetch).mockImplementation(
      () => new Promise(() => {}) // Never resolves
    );

    render(<HistoryPage />);

    expect(screen.getByText('Your Check-Ins')).toBeInTheDocument();
    expect(screen.getByText('Loading your check-ins...')).toBeInTheDocument();

    const spinner = document.querySelector('.animate-spin');
    expect(spinner).toBeInTheDocument();
  });

  it('should display error state when fetch fails', async () => {
    vi.mocked(fetch).mockResolvedValue({
      ok: false,
      json: async () => ({ error: 'Failed to fetch' }),
    } as Response);

    render(<HistoryPage />);

    await waitFor(() => {
      expect(screen.getByText('Failed to fetch')).toBeInTheDocument();
    });
  });

  it('should display empty state when no check-ins exist', async () => {
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      json: async () => ({ checkIns: [] }),
    } as Response);

    render(<HistoryPage />);

    await waitFor(() => {
      expect(screen.getByText('No check-ins yet!')).toBeInTheDocument();
      expect(
        screen.getByRole('link', { name: 'Create your first check-in' })
      ).toHaveAttribute('href', '/check-in');
    });
  });

  it('should display check-ins when fetch succeeds', async () => {
    const mockCheckIns = [
      {
        id: 'checkin-1',
        placeId: 'place-1',
        placeName: 'Test Restaurant',
        lat: 40.73,
        lng: -73.99,
        dishText: 'Margherita Pizza',
        noteText: 'Amazing crust!',
        visitDatetime: '2025-01-15T18:00:00Z',
        createdAt: '2025-01-15T18:00:00Z',
        updatedAt: '2025-01-15T18:00:00Z',
      },
      {
        id: 'checkin-2',
        placeId: 'place-2',
        placeName: 'Another Place',
        lat: 40.74,
        lng: -73.98,
        dishText: 'Caesar Salad',
        noteText: null,
        visitDatetime: '2025-01-14T12:00:00Z',
        createdAt: '2025-01-14T12:00:00Z',
        updatedAt: '2025-01-14T12:00:00Z',
      },
    ];

    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      json: async () => ({ checkIns: mockCheckIns }),
    } as Response);

    render(<HistoryPage />);

    await waitFor(() => {
      expect(screen.getByText('Margherita Pizza')).toBeInTheDocument();
      expect(screen.getByText('Test Restaurant')).toBeInTheDocument();
      expect(screen.getByText('Amazing crust!')).toBeInTheDocument();

      expect(screen.getByText('Caesar Salad')).toBeInTheDocument();
      expect(screen.getByText('Another Place')).toBeInTheDocument();
      expect(screen.queryByText('No notes')).not.toBeInTheDocument();
    });
  });

  it('should render Google Maps links for each check-in', async () => {
    const mockCheckIns = [
      {
        id: 'checkin-1',
        placeId: 'place-abc',
        placeName: 'Test Restaurant',
        lat: 40.73,
        lng: -73.99,
        dishText: 'Pizza',
        noteText: null,
        visitDatetime: '2025-01-15T18:00:00Z',
        createdAt: '2025-01-15T18:00:00Z',
        updatedAt: '2025-01-15T18:00:00Z',
      },
    ];

    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      json: async () => ({ checkIns: mockCheckIns }),
    } as Response);

    render(<HistoryPage />);

    await waitFor(() => {
      const mapLink = screen.getByRole('link', {
        name: 'View on Google Maps →',
      });
      expect(mapLink).toHaveAttribute(
        'href',
        'https://www.google.com/maps/search/?api=1&query=40.73,-73.99&query_place_id=place-abc'
      );
      expect(mapLink).toHaveAttribute('target', '_blank');
      expect(mapLink).toHaveAttribute('rel', 'noopener noreferrer');
    });
  });

  it('should render New Check-In button in header', async () => {
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      json: async () => ({ checkIns: [] }),
    } as Response);

    render(<HistoryPage />);

    await waitFor(() => {
      const newCheckInButton = screen.getByRole('link', {
        name: 'New Check-In',
      });
      expect(newCheckInButton).toHaveAttribute('href', '/check-in');
    });
  });

  it('should format dates correctly', async () => {
    const mockCheckIns = [
      {
        id: 'checkin-1',
        placeId: 'place-1',
        placeName: 'Test Restaurant',
        lat: 40.73,
        lng: -73.99,
        dishText: 'Pizza',
        noteText: null,
        visitDatetime: '2025-01-15T18:00:00Z',
        createdAt: '2025-01-15T18:00:00Z',
        updatedAt: '2025-01-15T18:00:00Z',
      },
    ];

    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      json: async () => ({ checkIns: mockCheckIns }),
    } as Response);

    render(<HistoryPage />);

    await waitFor(() => {
      // Date format should be "Jan 15, 2025" or similar
      expect(screen.getByText(/Jan 15, 2025/i)).toBeInTheDocument();
    });
  });

  it('should handle network errors gracefully', async () => {
    vi.mocked(fetch).mockRejectedValue(new Error('Network error'));

    render(<HistoryPage />);

    await waitFor(() => {
      expect(screen.getByText('Network error')).toBeInTheDocument();
    });
  });

  it('should show edit and delete buttons for each check-in', async () => {
    const mockCheckIns = [
      {
        id: 'checkin-1',
        placeId: 'place-1',
        placeName: 'Test Restaurant',
        lat: 40.73,
        lng: -73.99,
        dishText: 'Pizza',
        noteText: null,
        visitDatetime: '2025-01-15T18:00:00Z',
        createdAt: '2025-01-15T18:00:00Z',
        updatedAt: '2025-01-15T18:00:00Z',
      },
    ];

    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      json: async () => ({ checkIns: mockCheckIns }),
    } as Response);

    render(<HistoryPage />);

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Edit' })).toBeInTheDocument();
      expect(
        screen.getByRole('button', { name: 'Delete' })
      ).toBeInTheDocument();
    });
  });

  it('should delete check-in when delete button is clicked', async () => {
    const user = userEvent.setup();
    const mockCheckIns = [
      {
        id: 'checkin-1',
        placeId: 'place-1',
        placeName: 'Test Restaurant',
        lat: 40.73,
        lng: -73.99,
        dishText: 'Pizza',
        noteText: null,
        visitDatetime: '2025-01-15T18:00:00Z',
        createdAt: '2025-01-15T18:00:00Z',
        updatedAt: '2025-01-15T18:00:00Z',
      },
    ];

    // Initial fetch
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ checkIns: mockCheckIns }),
    } as Response);

    // Delete fetch
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ success: true }),
    } as Response);

    // Mock confirm
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true);

    render(<HistoryPage />);

    await waitFor(() => {
      expect(screen.getByText('Pizza')).toBeInTheDocument();
    });

    const deleteButton = screen.getByRole('button', { name: 'Delete' });
    await user.click(deleteButton);

    expect(confirmSpy).toHaveBeenCalledWith(
      'Are you sure you want to delete this check-in?'
    );

    await waitFor(() => {
      expect(screen.queryByText('Pizza')).not.toBeInTheDocument();
    });

    confirmSpy.mockRestore();
  });

  it('should not delete if user cancels confirmation', async () => {
    const user = userEvent.setup();
    const mockCheckIns = [
      {
        id: 'checkin-1',
        placeId: 'place-1',
        placeName: 'Test Restaurant',
        lat: 40.73,
        lng: -73.99,
        dishText: 'Pizza',
        noteText: null,
        visitDatetime: '2025-01-15T18:00:00Z',
        createdAt: '2025-01-15T18:00:00Z',
        updatedAt: '2025-01-15T18:00:00Z',
      },
    ];

    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      json: async () => ({ checkIns: mockCheckIns }),
    } as Response);

    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(false);

    render(<HistoryPage />);

    await waitFor(() => {
      expect(screen.getByText('Pizza')).toBeInTheDocument();
    });

    const deleteButton = screen.getByRole('button', { name: 'Delete' });
    await user.click(deleteButton);

    // Should still be there
    expect(screen.getByText('Pizza')).toBeInTheDocument();

    confirmSpy.mockRestore();
  });

  it('should open edit modal when edit button is clicked', async () => {
    const user = userEvent.setup();
    const mockCheckIns = [
      {
        id: 'checkin-1',
        placeId: 'place-1',
        placeName: 'Test Restaurant',
        lat: 40.73,
        lng: -73.99,
        dishText: 'Pizza',
        noteText: 'Great!',
        visitDatetime: '2025-01-15T18:00:00Z',
        createdAt: '2025-01-15T18:00:00Z',
        updatedAt: '2025-01-15T18:00:00Z',
      },
    ];

    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      json: async () => ({ checkIns: mockCheckIns }),
    } as Response);

    render(<HistoryPage />);

    await waitFor(() => {
      expect(screen.getByText('Pizza')).toBeInTheDocument();
    });

    const editButton = screen.getByRole('button', { name: 'Edit' });
    await user.click(editButton);

    // Modal should be visible
    expect(screen.getByText('Edit Check-In')).toBeInTheDocument();
    expect(screen.getByDisplayValue('Pizza')).toBeInTheDocument();
    expect(screen.getByDisplayValue('Great!')).toBeInTheDocument();
  });

  it('should close edit modal when cancel is clicked', async () => {
    const user = userEvent.setup();
    const mockCheckIns = [
      {
        id: 'checkin-1',
        placeId: 'place-1',
        placeName: 'Test Restaurant',
        lat: 40.73,
        lng: -73.99,
        dishText: 'Pizza',
        noteText: null,
        visitDatetime: '2025-01-15T18:00:00Z',
        createdAt: '2025-01-15T18:00:00Z',
        updatedAt: '2025-01-15T18:00:00Z',
      },
    ];

    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      json: async () => ({ checkIns: mockCheckIns }),
    } as Response);

    render(<HistoryPage />);

    await waitFor(() => {
      expect(screen.getByText('Pizza')).toBeInTheDocument();
    });

    // Open modal
    const editButton = screen.getByRole('button', { name: 'Edit' });
    await user.click(editButton);

    expect(screen.getByText('Edit Check-In')).toBeInTheDocument();

    // Close modal
    const cancelButton = screen.getByRole('button', { name: 'Cancel' });
    await user.click(cancelButton);

    expect(screen.queryByText('Edit Check-In')).not.toBeInTheDocument();
  });

  it('should save edited check-in when save is clicked', async () => {
    const user = userEvent.setup();
    const mockCheckIns = [
      {
        id: 'checkin-1',
        placeId: 'place-1',
        placeName: 'Test Restaurant',
        lat: 40.73,
        lng: -73.99,
        dishText: 'Pizza',
        noteText: 'Great!',
        visitDatetime: '2025-01-15T18:00:00Z',
        createdAt: '2025-01-15T18:00:00Z',
        updatedAt: '2025-01-15T18:00:00Z',
      },
    ];

    const updatedCheckIn = {
      ...mockCheckIns[0],
      dishText: 'Updated Pizza',
      noteText: 'Even better!',
      updatedAt: '2025-01-15T19:00:00Z',
    };

    // Initial fetch
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ checkIns: mockCheckIns }),
    } as Response);

    // Update fetch
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => updatedCheckIn,
    } as Response);

    render(<HistoryPage />);

    await waitFor(() => {
      expect(screen.getByText('Pizza')).toBeInTheDocument();
    });

    // Open modal
    const editButton = screen.getByRole('button', { name: 'Edit' });
    await user.click(editButton);

    // Edit fields
    const dishInput = screen.getByDisplayValue('Pizza');
    await user.clear(dishInput);
    await user.type(dishInput, 'Updated Pizza');

    const noteInput = screen.getByDisplayValue('Great!');
    await user.clear(noteInput);
    await user.type(noteInput, 'Even better!');

    // Save
    const saveButton = screen.getByRole('button', { name: 'Save Changes' });
    await user.click(saveButton);

    // Should show updated content
    await waitFor(() => {
      expect(screen.getByText('Updated Pizza')).toBeInTheDocument();
      expect(screen.getByText('Even better!')).toBeInTheDocument();
      expect(screen.queryByText('Edit Check-In')).not.toBeInTheDocument();
    });
  });
});

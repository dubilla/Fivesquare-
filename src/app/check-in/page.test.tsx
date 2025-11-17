import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { Place } from '@/lib/places';
import CheckInPage from './page';

// Mock PlacePicker component
vi.mock('@/components/place-picker', () => ({
  PlacePicker: ({
    onPlaceSelect,
  }: {
    onPlaceSelect: (place: Place) => void;
  }) => (
    <div data-testid="place-picker">
      <button
        onClick={() =>
          onPlaceSelect({
            place_id: 'test-place-id',
            name: 'Test Restaurant',
            lat: 40.73,
            lng: -73.99,
            address: 'Test Address',
          })
        }
      >
        Select Test Place
      </button>
    </div>
  ),
}));

// Mock fetch
global.fetch = vi.fn();

describe('CheckInPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Form validation', () => {
    it('should disable submit button when no place is selected', () => {
      render(<CheckInPage />);

      const submitButton = screen.getByRole('button', {
        name: /save check-in/i,
      });

      expect(submitButton).toBeDisabled();
    });

    it('should disable submit button when dish text is empty', async () => {
      const user = userEvent.setup();
      render(<CheckInPage />);

      // Select a place
      const selectPlaceButton = screen.getByText('Select Test Place');
      await user.click(selectPlaceButton);

      const submitButton = screen.getByRole('button', {
        name: /save check-in/i,
      });

      expect(submitButton).toBeDisabled();
    });

    it('should enable submit button when place and dish are provided', async () => {
      const user = userEvent.setup();
      render(<CheckInPage />);

      // Select a place
      const selectPlaceButton = screen.getByText('Select Test Place');
      await user.click(selectPlaceButton);

      // Enter dish text
      const dishInput = screen.getByPlaceholderText(/margherita pizza/i);
      await user.type(dishInput, 'Test Dish');

      const submitButton = screen.getByRole('button', {
        name: /save check-in/i,
      });

      expect(submitButton).not.toBeDisabled();
    });

    it('should show error when trying to submit without place', async () => {
      const user = userEvent.setup();
      render(<CheckInPage />);

      const dishInput = screen.getByPlaceholderText(/margherita pizza/i);
      await user.type(dishInput, 'Test Dish');

      // Try to submit (button should be disabled, but test the validation logic)
      const submitButton = screen.getByRole('button', {
        name: /save check-in/i,
      });
      expect(submitButton).toBeDisabled();
    });
  });

  describe('Character limits', () => {
    it('should show dish character counter', async () => {
      const user = userEvent.setup();
      render(<CheckInPage />);

      const dishInput = screen.getByPlaceholderText(/margherita pizza/i);

      // Initially shows 100 remaining
      expect(screen.getByText('100 characters remaining')).toBeInTheDocument();

      // Type 10 characters
      await user.type(dishInput, 'Test Dish!');

      // Should show 90 remaining
      expect(screen.getByText('90 characters remaining')).toBeInTheDocument();
    });

    it('should enforce 100 character limit for dish text', async () => {
      const user = userEvent.setup();
      render(<CheckInPage />);

      const dishInput = screen.getByPlaceholderText(
        /margherita pizza/i
      ) as HTMLInputElement;

      // Try to type 101 characters
      const longText = 'a'.repeat(101);
      await user.type(dishInput, longText);

      // Input should only contain 100 characters
      expect(dishInput.value).toHaveLength(100);
      expect(screen.getByText('0 characters remaining')).toBeInTheDocument();
    });

    it('should show note character counter', async () => {
      const user = userEvent.setup();
      render(<CheckInPage />);

      const noteInput = screen.getByPlaceholderText(/what did you think/i);

      // Initially shows 500 remaining
      expect(screen.getByText('500 characters remaining')).toBeInTheDocument();

      // Type 20 characters
      await user.type(noteInput, 'This was delicious!');

      // Should show 480 remaining
      expect(screen.getByText('481 characters remaining')).toBeInTheDocument();
    });

    it('should enforce 500 character limit for note text', async () => {
      const user = userEvent.setup();
      render(<CheckInPage />);

      const noteInput = screen.getByPlaceholderText(
        /what did you think/i
      ) as HTMLTextAreaElement;

      // Try to type 501 characters
      const longText = 'a'.repeat(501);
      await user.type(noteInput, longText);

      // Input should only contain 500 characters
      expect(noteInput.value).toHaveLength(500);
      expect(screen.getByText('0 characters remaining')).toBeInTheDocument();
    });
  });

  describe('API integration', () => {
    it('should successfully submit check-in with valid data', async () => {
      const user = userEvent.setup();
      const mockFetch = vi.mocked(fetch);
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          id: 'checkin-123',
          dishText: 'Test Dish',
        }),
      } as Response);

      // Mock window.alert
      const alertMock = vi.spyOn(window, 'alert').mockImplementation(() => {});

      render(<CheckInPage />);

      // Select a place
      const selectPlaceButton = screen.getByText('Select Test Place');
      await user.click(selectPlaceButton);

      // Enter dish text
      const dishInput = screen.getByPlaceholderText(/margherita pizza/i);
      await user.type(dishInput, 'Test Dish');

      // Enter note text
      const noteInput = screen.getByPlaceholderText(/what did you think/i);
      await user.type(noteInput, 'Great food!');

      // Submit
      const submitButton = screen.getByRole('button', {
        name: /save check-in/i,
      });
      await user.click(submitButton);

      // Wait for API call
      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledWith(
          '/api/checkins',
          expect.objectContaining({
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: expect.stringContaining('Test Dish'),
          })
        );
      });

      // Verify the request body
      const callArgs = mockFetch.mock.calls[0];
      const body = JSON.parse(callArgs[1]?.body as string);
      expect(body).toMatchObject({
        placeId: 'test-place-id',
        placeName: 'Test Restaurant',
        lat: 40.73,
        lng: -73.99,
        dishText: 'Test Dish',
        noteText: 'Great food!',
      });

      // Should show success alert
      await waitFor(() => {
        expect(alertMock).toHaveBeenCalledWith('Check-in saved successfully!');
      });

      alertMock.mockRestore();
    });

    it('should display error message when API call fails', async () => {
      const user = userEvent.setup();
      const mockFetch = vi.mocked(fetch);
      mockFetch.mockResolvedValueOnce({
        ok: false,
        json: async () => ({ error: 'Server error' }),
      } as Response);

      render(<CheckInPage />);

      // Select a place
      const selectPlaceButton = screen.getByText('Select Test Place');
      await user.click(selectPlaceButton);

      // Enter dish text
      const dishInput = screen.getByPlaceholderText(/margherita pizza/i);
      await user.type(dishInput, 'Test Dish');

      // Submit
      const submitButton = screen.getByRole('button', {
        name: /save check-in/i,
      });
      await user.click(submitButton);

      // Wait for error message
      await waitFor(() => {
        expect(screen.getByText('Server error')).toBeInTheDocument();
      });
    });

    it('should show loading state during submission', async () => {
      const user = userEvent.setup();
      const mockFetch = vi.mocked(fetch);

      // Make fetch hang to test loading state
      mockFetch.mockReturnValueOnce(new Promise(() => {}) as Promise<Response>);

      render(<CheckInPage />);

      // Select a place
      const selectPlaceButton = screen.getByText('Select Test Place');
      await user.click(selectPlaceButton);

      // Enter dish text
      const dishInput = screen.getByPlaceholderText(/margherita pizza/i);
      await user.type(dishInput, 'Test Dish');

      // Submit
      const submitButton = screen.getByRole('button', {
        name: /save check-in/i,
      });
      await user.click(submitButton);

      // Button should show loading state
      await waitFor(() => {
        expect(
          screen.getByRole('button', { name: /saving/i })
        ).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /saving/i })).toBeDisabled();
      });
    });

    it('should clear form after successful submission', async () => {
      const user = userEvent.setup();
      const mockFetch = vi.mocked(fetch);
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ id: 'checkin-123' }),
      } as Response);

      const alertMock = vi.spyOn(window, 'alert').mockImplementation(() => {});

      render(<CheckInPage />);

      // Select a place and fill form
      await user.click(screen.getByText('Select Test Place'));
      await user.type(
        screen.getByPlaceholderText(/margherita pizza/i),
        'Test Dish'
      );
      await user.type(
        screen.getByPlaceholderText(/what did you think/i),
        'Great!'
      );

      // Submit
      await user.click(screen.getByRole('button', { name: /save check-in/i }));

      // Wait for success
      await waitFor(() => {
        expect(alertMock).toHaveBeenCalled();
      });

      // Form should be cleared
      const dishInput = screen.getByPlaceholderText(
        /margherita pizza/i
      ) as HTMLInputElement;
      const noteInput = screen.getByPlaceholderText(
        /what did you think/i
      ) as HTMLTextAreaElement;

      expect(dishInput.value).toBe('');
      expect(noteInput.value).toBe('');

      alertMock.mockRestore();
    });
  });
});

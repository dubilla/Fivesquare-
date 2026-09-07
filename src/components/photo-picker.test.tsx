import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { PhotoPicker } from './photo-picker';

vi.mock('@/lib/storage/downscale', () => ({
  isAllowedImageFile: (file: File) => file.type.startsWith('image/'),
  downscaleImage: async (file: File) => ({
    blob: file,
    contentType: file.type as 'image/jpeg',
  }),
}));

describe('PhotoPicker', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    global.fetch = vi.fn();
    URL.createObjectURL = vi.fn(() => 'blob:preview');
    URL.revokeObjectURL = vi.fn();
  });

  it('exposes a library file input without a capture attribute', () => {
    render(<PhotoPicker value={null} onChange={vi.fn()} />);

    const input = screen.getByLabelText(/photo \(optional\)/i);
    expect(input).toHaveAttribute('type', 'file');
    expect(input).toHaveAttribute(
      'accept',
      'image/jpeg,image/png,image/webp,image/gif'
    );
    // `capture` forces camera-only on mobile and blocks the photo library.
    expect(input).not.toHaveAttribute('capture');
    expect(
      screen.getByText(/choose a photo from your library/i)
    ).toBeInTheDocument();
  });

  it('uploads a chosen library image and returns the photo key', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();

    vi.mocked(global.fetch)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          uploadUrl: '/api/uploads/local?key=checkins%2Fu1%2Fphoto.jpg',
          photoKey: 'checkins/u1/photo.jpg',
        }),
      } as Response)
      .mockResolvedValueOnce({ ok: true } as Response);

    render(<PhotoPicker value={null} onChange={onChange} />);

    const file = new File(['dish-bytes'], 'ramen.jpg', { type: 'image/jpeg' });
    const input = screen.getByLabelText(/photo \(optional\)/i);
    await user.upload(input, file);

    await waitFor(() => {
      expect(onChange).toHaveBeenCalledWith({
        photoKey: 'checkins/u1/photo.jpg',
        previewUrl: 'blob:preview',
      });
    });

    expect(global.fetch).toHaveBeenNthCalledWith(
      1,
      '/api/uploads/presign',
      expect.objectContaining({ method: 'POST' })
    );
    expect(global.fetch).toHaveBeenNthCalledWith(
      2,
      '/api/uploads/local?key=checkins%2Fu1%2Fphoto.jpg',
      expect.objectContaining({ method: 'PUT' })
    );
  });

  it('rejects non-image files without uploading', async () => {
    const onChange = vi.fn();

    render(<PhotoPicker value={null} onChange={onChange} />);

    const file = new File(['not-an-image'], 'notes.txt', {
      type: 'text/plain',
    });
    const input = screen.getByLabelText(
      /photo \(optional\)/i
    ) as HTMLInputElement;
    fireEvent.change(input, { target: { files: [file] } });

    expect(
      await screen.findByText(/jpeg, png, webp, or gif/i)
    ).toBeInTheDocument();
    expect(global.fetch).not.toHaveBeenCalled();
    expect(onChange).not.toHaveBeenCalled();
  });
});

import { describe, it, expect, vi, beforeEach, type Mock } from 'vitest';
import { POST } from './route';
import { NextRequest } from 'next/server';

vi.mock('@/auth', () => ({
  auth: vi.fn(),
}));

vi.mock('@/lib/storage/photos', () => ({
  PHOTO_MAX_BYTES: 10 * 1024 * 1024,
  isPhotoContentType: (v: string) =>
    ['image/jpeg', 'image/png', 'image/webp', 'image/gif'].includes(v),
  createPresignedUpload: vi.fn(),
  storageDriver: vi.fn(() => 'local'),
}));

import { auth } from '@/auth';
import { createPresignedUpload } from '@/lib/storage/photos';

describe('POST /api/uploads/presign', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('rejects unauthenticated requests', async () => {
    (auth as Mock).mockResolvedValue(null);

    const response = await POST(
      new NextRequest('http://localhost/api/uploads/presign', {
        method: 'POST',
        body: JSON.stringify({
          contentType: 'image/jpeg',
          contentLength: 1000,
        }),
      })
    );

    expect(response.status).toBe(401);
  });

  it('rejects non-image content types', async () => {
    (auth as Mock).mockResolvedValue({
      user: { id: 'user-1', email: 'a@b.com' },
      expires: '',
    });

    const response = await POST(
      new NextRequest('http://localhost/api/uploads/presign', {
        method: 'POST',
        body: JSON.stringify({
          contentType: 'application/pdf',
          contentLength: 1000,
        }),
      })
    );
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toMatch(/contentType/i);
  });

  it('rejects oversize contentLength', async () => {
    (auth as Mock).mockResolvedValue({
      user: { id: 'user-1', email: 'a@b.com' },
      expires: '',
    });

    const response = await POST(
      new NextRequest('http://localhost/api/uploads/presign', {
        method: 'POST',
        body: JSON.stringify({
          contentType: 'image/jpeg',
          contentLength: 20 * 1024 * 1024,
        }),
      })
    );
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toMatch(/contentLength/i);
  });

  it('returns an upload URL for a valid image', async () => {
    (auth as Mock).mockResolvedValue({
      user: { id: 'user-1', email: 'a@b.com' },
      expires: '',
    });
    (createPresignedUpload as Mock).mockResolvedValue({
      uploadUrl:
        'http://localhost/api/uploads/local?key=checkins%2Fuser-1%2Fx.jpg',
      photoKey: 'checkins/user-1/x.jpg',
      publicUrl: '/api/uploads/local?key=checkins%2Fuser-1%2Fx.jpg',
    });

    const response = await POST(
      new NextRequest('http://localhost/api/uploads/presign', {
        method: 'POST',
        body: JSON.stringify({
          contentType: 'image/jpeg',
          contentLength: 12345,
        }),
      })
    );
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.photoKey).toBe('checkins/user-1/x.jpg');
    expect(data.uploadUrl).toContain('/api/uploads/local');
    expect(createPresignedUpload).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'user-1',
        contentType: 'image/jpeg',
      })
    );
  });
});

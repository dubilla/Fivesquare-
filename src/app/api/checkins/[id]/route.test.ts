import { describe, it, expect, vi, beforeEach, type Mock } from 'vitest';
import { DELETE, PUT } from './route';
import { NextRequest } from 'next/server';

vi.mock('@/auth', () => ({
  auth: vi.fn(),
}));

vi.mock('@/lib/db/client', () => ({
  db: {
    select: vi.fn(),
    delete: vi.fn(),
    update: vi.fn(),
  },
}));

import { auth } from '@/auth';
import { db } from '@/lib/db/client';

describe('DELETE /api/checkins/[id]', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should reject unauthenticated requests', async () => {
    (auth as Mock).mockResolvedValue(null);

    const response = await DELETE(
      new NextRequest('http://localhost/api/checkins/123'),
      { params: Promise.resolve({ id: 'checkin-123' }) }
    );
    const data = await response.json();

    expect(response.status).toBe(401);
    expect(data.error).toBe('Unauthorized');
  });

  it('should return 404 when check-in does not exist', async () => {
    (auth as Mock).mockResolvedValue({
      user: { id: 'user-123', email: 'test@example.com' },
      expires: '',
    });

    const mockSelect = {
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          limit: vi.fn().mockResolvedValue([]), // No results
        }),
      }),
    };
    (db.select as Mock).mockReturnValue(mockSelect);

    const response = await DELETE(
      new NextRequest('http://localhost/api/checkins/123'),
      { params: Promise.resolve({ id: 'checkin-123' }) }
    );
    const data = await response.json();

    expect(response.status).toBe(404);
    expect(data.error).toBe('Check-in not found');
  });

  it('should return 404 when check-in belongs to different user', async () => {
    (auth as Mock).mockResolvedValue({
      user: { id: 'user-123', email: 'test@example.com' },
      expires: '',
    });

    const mockSelect = {
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          limit: vi.fn().mockResolvedValue([]), // User check returns empty
        }),
      }),
    };
    (db.select as Mock).mockReturnValue(mockSelect);

    const response = await DELETE(
      new NextRequest('http://localhost/api/checkins/123'),
      { params: Promise.resolve({ id: 'checkin-123' }) }
    );
    const data = await response.json();

    expect(response.status).toBe(404);
    expect(data.error).toBe('Check-in not found');
  });

  it('should successfully delete check-in when user is owner', async () => {
    (auth as Mock).mockResolvedValue({
      user: { id: 'user-123', email: 'test@example.com' },
      expires: '',
    });

    const mockCheckIn = {
      id: 'checkin-123',
      userId: 'user-123',
      placeId: 'place-abc',
      placeName: 'Test Restaurant',
      lat: 40.73,
      lng: -73.99,
      dishText: 'Pizza',
      noteText: null,
      visitDatetime: new Date(),
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const mockSelect = {
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          limit: vi.fn().mockResolvedValue([mockCheckIn]),
        }),
      }),
    };
    (db.select as Mock).mockReturnValue(mockSelect);

    const mockDelete = {
      where: vi.fn().mockResolvedValue(undefined),
    };
    (db.delete as Mock).mockReturnValue(mockDelete);

    const response = await DELETE(
      new NextRequest('http://localhost/api/checkins/123'),
      { params: Promise.resolve({ id: 'checkin-123' }) }
    );
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(mockDelete.where).toHaveBeenCalled();
  });

  it('should handle database errors', async () => {
    (auth as Mock).mockResolvedValue({
      user: { id: 'user-123', email: 'test@example.com' },
      expires: '',
    });

    const mockSelect = {
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          limit: vi.fn().mockRejectedValue(new Error('DB error')),
        }),
      }),
    };
    (db.select as Mock).mockReturnValue(mockSelect);

    const response = await DELETE(
      new NextRequest('http://localhost/api/checkins/123'),
      { params: Promise.resolve({ id: 'checkin-123' }) }
    );
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data.error).toBe('DB error');
  });
});

describe('PUT /api/checkins/[id]', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should reject unauthenticated requests', async () => {
    (auth as Mock).mockResolvedValue(null);

    const request = new NextRequest('http://localhost/api/checkins/123', {
      method: 'PUT',
      body: JSON.stringify({}),
    });

    const response = await PUT(request, {
      params: Promise.resolve({ id: 'checkin-123' }),
    });
    const data = await response.json();

    expect(response.status).toBe(401);
    expect(data.error).toBe('Unauthorized');
  });

  it('should return 404 when check-in does not exist', async () => {
    (auth as Mock).mockResolvedValue({
      user: { id: 'user-123', email: 'test@example.com' },
      expires: '',
    });

    const mockSelect = {
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          limit: vi.fn().mockResolvedValue([]),
        }),
      }),
    };
    (db.select as Mock).mockReturnValue(mockSelect);

    const request = new NextRequest('http://localhost/api/checkins/123', {
      method: 'PUT',
      body: JSON.stringify({
        placeId: 'place-abc',
        placeName: 'Test Restaurant',
        lat: 40.73,
        lng: -73.99,
        dishText: 'Updated Pizza',
      }),
    });

    const response = await PUT(request, {
      params: Promise.resolve({ id: 'checkin-123' }),
    });
    const data = await response.json();

    expect(response.status).toBe(404);
    expect(data.error).toBe('Check-in not found');
  });

  it('should successfully update check-in when user is owner', async () => {
    (auth as Mock).mockResolvedValue({
      user: { id: 'user-123', email: 'test@example.com' },
      expires: '',
    });

    const existingCheckIn = {
      id: 'checkin-123',
      userId: 'user-123',
      placeId: 'place-abc',
      placeName: 'Test Restaurant',
      lat: 40.73,
      lng: -73.99,
      dishText: 'Pizza',
      noteText: null,
      visitDatetime: new Date('2025-01-15'),
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const updatedCheckIn = {
      ...existingCheckIn,
      dishText: 'Updated Pizza',
      noteText: 'Great!',
      updatedAt: new Date(),
    };

    const mockSelect = {
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          limit: vi.fn().mockResolvedValue([existingCheckIn]),
        }),
      }),
    };
    (db.select as Mock).mockReturnValue(mockSelect);

    const mockUpdate = {
      set: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          returning: vi.fn().mockResolvedValue([updatedCheckIn]),
        }),
      }),
    };
    (db.update as Mock).mockReturnValue(mockUpdate);

    const request = new NextRequest('http://localhost/api/checkins/123', {
      method: 'PUT',
      body: JSON.stringify({
        placeId: 'place-abc',
        placeName: 'Test Restaurant',
        lat: 40.73,
        lng: -73.99,
        dishText: 'Updated Pizza',
        noteText: 'Great!',
        visitDatetime: '2025-01-15T18:00:00Z',
      }),
    });

    const response = await PUT(request, {
      params: Promise.resolve({ id: 'checkin-123' }),
    });
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.dishText).toBe('Updated Pizza');
    expect(data.noteText).toBe('Great!');
  });

  it('should require placeId', async () => {
    (auth as Mock).mockResolvedValue({
      user: { id: 'user-123', email: 'test@example.com' },
      expires: '',
    });

    const mockSelect = {
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          limit: vi.fn().mockResolvedValue([{ id: 'checkin-123' }]),
        }),
      }),
    };
    (db.select as Mock).mockReturnValue(mockSelect);

    const request = new NextRequest('http://localhost/api/checkins/123', {
      method: 'PUT',
      body: JSON.stringify({
        placeName: 'Test Restaurant',
        lat: 40.73,
        lng: -73.99,
        dishText: 'Pizza',
      }),
    });

    const response = await PUT(request, {
      params: Promise.resolve({ id: 'checkin-123' }),
    });
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toContain('placeId');
  });

  it('should enforce dishText length limit (100 chars)', async () => {
    (auth as Mock).mockResolvedValue({
      user: { id: 'user-123', email: 'test@example.com' },
      expires: '',
    });

    const mockSelect = {
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          limit: vi.fn().mockResolvedValue([{ id: 'checkin-123' }]),
        }),
      }),
    };
    (db.select as Mock).mockReturnValue(mockSelect);

    const request = new NextRequest('http://localhost/api/checkins/123', {
      method: 'PUT',
      body: JSON.stringify({
        placeId: 'place-abc',
        placeName: 'Test Restaurant',
        lat: 40.73,
        lng: -73.99,
        dishText: 'a'.repeat(101),
      }),
    });

    const response = await PUT(request, {
      params: Promise.resolve({ id: 'checkin-123' }),
    });
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toContain('100 characters');
  });

  it('should enforce noteText length limit (500 chars)', async () => {
    (auth as Mock).mockResolvedValue({
      user: { id: 'user-123', email: 'test@example.com' },
      expires: '',
    });

    const mockSelect = {
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          limit: vi.fn().mockResolvedValue([{ id: 'checkin-123' }]),
        }),
      }),
    };
    (db.select as Mock).mockReturnValue(mockSelect);

    const request = new NextRequest('http://localhost/api/checkins/123', {
      method: 'PUT',
      body: JSON.stringify({
        placeId: 'place-abc',
        placeName: 'Test Restaurant',
        lat: 40.73,
        lng: -73.99,
        dishText: 'Pizza',
        noteText: 'a'.repeat(501),
      }),
    });

    const response = await PUT(request, {
      params: Promise.resolve({ id: 'checkin-123' }),
    });
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toContain('500 characters');
  });

  it('should validate coordinates', async () => {
    (auth as Mock).mockResolvedValue({
      user: { id: 'user-123', email: 'test@example.com' },
      expires: '',
    });

    const mockSelect = {
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          limit: vi.fn().mockResolvedValue([{ id: 'checkin-123' }]),
        }),
      }),
    };
    (db.select as Mock).mockReturnValue(mockSelect);

    const request = new NextRequest('http://localhost/api/checkins/123', {
      method: 'PUT',
      body: JSON.stringify({
        placeId: 'place-abc',
        placeName: 'Test Restaurant',
        lat: 91, // Invalid
        lng: -73.99,
        dishText: 'Pizza',
      }),
    });

    const response = await PUT(request, {
      params: Promise.resolve({ id: 'checkin-123' }),
    });
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toContain('lat');
  });

  it('should update updatedAt timestamp', async () => {
    (auth as Mock).mockResolvedValue({
      user: { id: 'user-123', email: 'test@example.com' },
      expires: '',
    });

    const existingCheckIn = {
      id: 'checkin-123',
      userId: 'user-123',
      placeId: 'place-abc',
      placeName: 'Test Restaurant',
      lat: 40.73,
      lng: -73.99,
      dishText: 'Pizza',
      noteText: null,
      visitDatetime: new Date('2025-01-15'),
      createdAt: new Date('2025-01-15T10:00:00Z'),
      updatedAt: new Date('2025-01-15T10:00:00Z'),
    };

    const mockSelect = {
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          limit: vi.fn().mockResolvedValue([existingCheckIn]),
        }),
      }),
    };
    (db.select as Mock).mockReturnValue(mockSelect);

    const mockUpdate = {
      set: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          returning: vi.fn().mockResolvedValue([
            {
              ...existingCheckIn,
              dishText: 'Updated Pizza',
              updatedAt: new Date(),
            },
          ]),
        }),
      }),
    };
    (db.update as Mock).mockReturnValue(mockUpdate);

    const request = new NextRequest('http://localhost/api/checkins/123', {
      method: 'PUT',
      body: JSON.stringify({
        placeId: 'place-abc',
        placeName: 'Test Restaurant',
        lat: 40.73,
        lng: -73.99,
        dishText: 'Updated Pizza',
      }),
    });

    await PUT(request, {
      params: Promise.resolve({ id: 'checkin-123' }),
    });

    // Verify that set was called with updatedAt
    expect(mockUpdate.set).toHaveBeenCalledWith(
      expect.objectContaining({
        dishText: 'Updated Pizza',
        updatedAt: expect.any(Date),
      })
    );
  });
});

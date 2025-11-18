import { describe, it, expect, vi, beforeEach, type Mock } from 'vitest';
import { GET, POST } from './route';
import { NextRequest } from 'next/server';

vi.mock('@/auth', () => ({
  auth: vi.fn(),
}));

vi.mock('@/lib/db/client', () => ({
  db: {
    insert: vi.fn(),
    select: vi.fn(),
  },
}));

import { auth } from '@/auth';
import { db } from '@/lib/db/client';

describe('GET /api/checkins', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should reject unauthenticated requests', async () => {
    (auth as Mock).mockResolvedValue(null);

    const response = await GET();
    const data = await response.json();

    expect(response.status).toBe(401);
    expect(data.error).toBe('Unauthorized');
  });

  it('should return user check-ins in reverse chronological order', async () => {
    (auth as Mock).mockResolvedValue({
      user: { id: 'user-123', email: 'test@example.com' },
      expires: '',
    });

    const mockCheckIns = [
      {
        id: 'checkin-2',
        userId: 'user-123',
        placeId: 'place-2',
        placeName: 'Restaurant 2',
        lat: 40.74,
        lng: -73.98,
        dishText: 'Pasta',
        noteText: 'Great!',
        visitDatetime: new Date('2025-01-16'),
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        id: 'checkin-1',
        userId: 'user-123',
        placeId: 'place-1',
        placeName: 'Restaurant 1',
        lat: 40.73,
        lng: -73.99,
        dishText: 'Pizza',
        noteText: 'Amazing',
        visitDatetime: new Date('2025-01-15'),
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ];

    const mockSelect = {
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          orderBy: vi.fn().mockResolvedValue(mockCheckIns),
        }),
      }),
    };
    (db.select as Mock).mockReturnValue(mockSelect);

    const response = await GET();
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.checkIns).toHaveLength(2);
    expect(data.checkIns[0].dishText).toBe('Pasta');
    expect(data.checkIns[1].dishText).toBe('Pizza');
  });

  it('should return empty array when user has no check-ins', async () => {
    (auth as Mock).mockResolvedValue({
      user: { id: 'user-123', email: 'test@example.com' },
      expires: '',
    });

    const mockSelect = {
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          orderBy: vi.fn().mockResolvedValue([]),
        }),
      }),
    };
    (db.select as Mock).mockReturnValue(mockSelect);

    const response = await GET();
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.checkIns).toEqual([]);
  });

  it('should handle database errors', async () => {
    (auth as Mock).mockResolvedValue({
      user: { id: 'user-123', email: 'test@example.com' },
      expires: '',
    });

    const mockSelect = {
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          orderBy: vi.fn().mockRejectedValue(new Error('DB connection failed')),
        }),
      }),
    };
    (db.select as Mock).mockReturnValue(mockSelect);

    const response = await GET();
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data.error).toBe('DB connection failed');
  });
});

describe('POST /api/checkins', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should reject unauthenticated requests', async () => {
    (auth as Mock).mockResolvedValue(null);

    const request = new NextRequest('http://localhost/api/checkins', {
      method: 'POST',
      body: JSON.stringify({}),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(401);
    expect(data.error).toBe('Unauthorized');
  });

  it('should create a check-in with valid data', async () => {
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
      dishText: 'Margherita Pizza',
      noteText: 'Amazing crust',
      visitDatetime: new Date('2025-01-15T18:00:00Z'),
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const mockInsert = {
      values: vi.fn().mockReturnValue({
        returning: vi.fn().mockResolvedValue([mockCheckIn]),
      }),
    };
    (db.insert as Mock).mockReturnValue(mockInsert);

    const request = new NextRequest('http://localhost/api/checkins', {
      method: 'POST',
      body: JSON.stringify({
        placeId: 'place-abc',
        placeName: 'Test Restaurant',
        lat: 40.73,
        lng: -73.99,
        dishText: 'Margherita Pizza',
        noteText: 'Amazing crust',
        visitDatetime: '2025-01-15T18:00:00Z',
      }),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(201);
    expect(data.id).toBe('checkin-123');
    expect(data.dishText).toBe('Margherita Pizza');
  });

  it('should require placeId', async () => {
    (auth as Mock).mockResolvedValue({
      user: { id: 'user-123', email: 'test@example.com' },
      expires: '',
    });

    const request = new NextRequest('http://localhost/api/checkins', {
      method: 'POST',
      body: JSON.stringify({
        placeName: 'Test Restaurant',
        lat: 40.73,
        lng: -73.99,
        dishText: 'Pizza',
      }),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toContain('placeId');
  });

  it('should enforce dishText length limit (100 chars)', async () => {
    (auth as Mock).mockResolvedValue({
      user: { id: 'user-123', email: 'test@example.com' },
      expires: '',
    });

    const request = new NextRequest('http://localhost/api/checkins', {
      method: 'POST',
      body: JSON.stringify({
        placeId: 'place-abc',
        placeName: 'Test Restaurant',
        lat: 40.73,
        lng: -73.99,
        dishText: 'a'.repeat(101), // 101 characters
      }),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toContain('100 characters');
  });

  it('should enforce noteText length limit (500 chars)', async () => {
    (auth as Mock).mockResolvedValue({
      user: { id: 'user-123', email: 'test@example.com' },
      expires: '',
    });

    const request = new NextRequest('http://localhost/api/checkins', {
      method: 'POST',
      body: JSON.stringify({
        placeId: 'place-abc',
        placeName: 'Test Restaurant',
        lat: 40.73,
        lng: -73.99,
        dishText: 'Pizza',
        noteText: 'a'.repeat(501), // 501 characters
      }),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toContain('500 characters');
  });

  it('should validate coordinates', async () => {
    (auth as Mock).mockResolvedValue({
      user: { id: 'user-123', email: 'test@example.com' },
      expires: '',
    });

    const request = new NextRequest('http://localhost/api/checkins', {
      method: 'POST',
      body: JSON.stringify({
        placeId: 'place-abc',
        placeName: 'Test Restaurant',
        lat: 91, // Invalid: > 90
        lng: -73.99,
        dishText: 'Pizza',
      }),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toContain('lat');
  });

  it('should allow optional noteText', async () => {
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

    const mockInsert = {
      values: vi.fn().mockReturnValue({
        returning: vi.fn().mockResolvedValue([mockCheckIn]),
      }),
    };
    (db.insert as Mock).mockReturnValue(mockInsert);

    const request = new NextRequest('http://localhost/api/checkins', {
      method: 'POST',
      body: JSON.stringify({
        placeId: 'place-abc',
        placeName: 'Test Restaurant',
        lat: 40.73,
        lng: -73.99,
        dishText: 'Pizza',
        // noteText omitted
      }),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(201);
    expect(data.noteText).toBeNull();
  });
});

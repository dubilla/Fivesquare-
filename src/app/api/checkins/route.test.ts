import { describe, it, expect, vi, beforeEach, type Mock } from 'vitest';
import { POST } from './route';
import { NextRequest } from 'next/server';

vi.mock('@/auth', () => ({
  auth: vi.fn(),
}));

vi.mock('@/lib/db/client', () => ({
  db: {
    insert: vi.fn(),
  },
}));

import { auth } from '@/auth';
import { db } from '@/lib/db/client';

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

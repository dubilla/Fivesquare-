/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { registerUser } from './register';
import * as dbClient from '@/lib/db/client';
import bcrypt from 'bcrypt';

vi.mock('@/lib/db/client', () => ({
  db: {
    select: vi.fn(),
    insert: vi.fn(),
  },
}));

vi.mock('bcrypt', () => ({
  default: {
    hash: vi.fn(),
  },
}));

describe('registerUser', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should successfully register a new user', async () => {
    const mockEmail = 'test@example.com';
    const mockPassword = 'password123';
    const mockName = 'Test User';
    const mockHashedPassword = 'hashed_password_123';
    const mockUserId = 'user-123';

    const mockSelect = vi.fn().mockReturnThis();
    const mockFrom = vi.fn().mockReturnThis();
    const mockWhere = vi.fn().mockReturnThis();
    const mockLimit = vi.fn().mockResolvedValue([]);

    (dbClient.db.select as any) = mockSelect;
    mockSelect.mockReturnValue({
      from: mockFrom,
    });
    mockFrom.mockReturnValue({
      where: mockWhere,
    });
    mockWhere.mockReturnValue({
      limit: mockLimit,
    });

    const mockInsert = vi.fn().mockReturnThis();
    const mockValues = vi.fn().mockReturnThis();
    const mockReturning = vi.fn().mockResolvedValue([
      {
        id: mockUserId,
        email: mockEmail,
        name: mockName,
        passwordHash: mockHashedPassword,
      },
    ]);

    (dbClient.db.insert as any) = mockInsert;
    mockInsert.mockReturnValue({
      values: mockValues,
    });
    mockValues.mockReturnValue({
      returning: mockReturning,
    });

    (bcrypt.hash as any).mockResolvedValue(mockHashedPassword);

    const result = await registerUser(mockEmail, mockPassword, mockName);

    expect(bcrypt.hash).toHaveBeenCalledWith(mockPassword, 10);
    expect(result).toEqual({
      id: mockUserId,
      email: mockEmail,
      name: mockName,
    });
  });

  it('should register user without name', async () => {
    const mockEmail = 'test@example.com';
    const mockPassword = 'password123';
    const mockHashedPassword = 'hashed_password_123';
    const mockUserId = 'user-123';

    const mockSelect = vi.fn().mockReturnThis();
    const mockFrom = vi.fn().mockReturnThis();
    const mockWhere = vi.fn().mockReturnThis();
    const mockLimit = vi.fn().mockResolvedValue([]);

    (dbClient.db.select as any) = mockSelect;
    mockSelect.mockReturnValue({
      from: mockFrom,
    });
    mockFrom.mockReturnValue({
      where: mockWhere,
    });
    mockWhere.mockReturnValue({
      limit: mockLimit,
    });

    const mockInsert = vi.fn().mockReturnThis();
    const mockValues = vi.fn().mockReturnThis();
    const mockReturning = vi.fn().mockResolvedValue([
      {
        id: mockUserId,
        email: mockEmail,
        name: null,
        passwordHash: mockHashedPassword,
      },
    ]);

    (dbClient.db.insert as any) = mockInsert;
    mockInsert.mockReturnValue({
      values: mockValues,
    });
    mockValues.mockReturnValue({
      returning: mockReturning,
    });

    (bcrypt.hash as any).mockResolvedValue(mockHashedPassword);

    const result = await registerUser(mockEmail, mockPassword);

    expect(result).toEqual({
      id: mockUserId,
      email: mockEmail,
      name: null,
    });
  });

  it('should throw error if user with email already exists', async () => {
    const mockEmail = 'existing@example.com';
    const mockPassword = 'password123';

    const mockSelect = vi.fn().mockReturnThis();
    const mockFrom = vi.fn().mockReturnThis();
    const mockWhere = vi.fn().mockReturnThis();
    const mockLimit = vi.fn().mockResolvedValue([
      {
        id: 'existing-user-id',
        email: mockEmail,
        name: 'Existing User',
      },
    ]);

    (dbClient.db.select as any) = mockSelect;
    mockSelect.mockReturnValue({
      from: mockFrom,
    });
    mockFrom.mockReturnValue({
      where: mockWhere,
    });
    mockWhere.mockReturnValue({
      limit: mockLimit,
    });

    await expect(registerUser(mockEmail, mockPassword)).rejects.toThrow(
      'User with this email already exists'
    );
  });

  it('should hash password with correct salt rounds', async () => {
    const mockEmail = 'test@example.com';
    const mockPassword = 'password123';
    const mockHashedPassword = 'hashed_password_123';

    const mockSelect = vi.fn().mockReturnThis();
    const mockFrom = vi.fn().mockReturnThis();
    const mockWhere = vi.fn().mockReturnThis();
    const mockLimit = vi.fn().mockResolvedValue([]);

    (dbClient.db.select as any) = mockSelect;
    mockSelect.mockReturnValue({
      from: mockFrom,
    });
    mockFrom.mockReturnValue({
      where: mockWhere,
    });
    mockWhere.mockReturnValue({
      limit: mockLimit,
    });

    const mockInsert = vi.fn().mockReturnThis();
    const mockValues = vi.fn().mockReturnThis();
    const mockReturning = vi.fn().mockResolvedValue([
      {
        id: 'user-123',
        email: mockEmail,
        name: null,
        passwordHash: mockHashedPassword,
      },
    ]);

    (dbClient.db.insert as any) = mockInsert;
    mockInsert.mockReturnValue({
      values: mockValues,
    });
    mockValues.mockReturnValue({
      returning: mockReturning,
    });

    (bcrypt.hash as any).mockResolvedValue(mockHashedPassword);

    await registerUser(mockEmail, mockPassword);

    expect(bcrypt.hash).toHaveBeenCalledWith(mockPassword, 10);
  });
});

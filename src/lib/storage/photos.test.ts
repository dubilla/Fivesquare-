import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  buildPhotoKey,
  isPhotoContentType,
  photoPublicUrl,
  writeLocalPhoto,
  readLocalPhoto,
  deletePhotoObject,
  createPresignedUpload,
} from './photos';
import { mkdir, rm } from 'fs/promises';
import path from 'path';

const putObjectInputs: unknown[] = [];

vi.mock('@aws-sdk/client-s3', () => {
  class PutObjectCommand {
    input: unknown;
    constructor(input: unknown) {
      this.input = input;
      putObjectInputs.push(input);
    }
  }
  class DeleteObjectCommand {
    input: unknown;
    constructor(input: unknown) {
      this.input = input;
    }
  }
  class S3Client {
    send = vi.fn();
  }
  return { PutObjectCommand, DeleteObjectCommand, S3Client };
});

vi.mock('@aws-sdk/s3-request-presigner', () => ({
  getSignedUrl: vi.fn(async () => 'https://r2.example/presigned-put'),
}));

describe('photo storage helpers', () => {
  beforeEach(() => {
    putObjectInputs.length = 0;
  });

  afterEach(() => {
    delete process.env.R2_ACCOUNT_ID;
    delete process.env.R2_ACCESS_KEY_ID;
    delete process.env.R2_SECRET_ACCESS_KEY;
    delete process.env.R2_BUCKET;
    delete process.env.R2_PUBLIC_URL;
  });

  it('accepts only image content types', () => {
    expect(isPhotoContentType('image/jpeg')).toBe(true);
    expect(isPhotoContentType('image/png')).toBe(true);
    expect(isPhotoContentType('application/pdf')).toBe(false);
  });

  it('builds a user-scoped photo key', () => {
    const key = buildPhotoKey('user-abc', 'image/jpeg');
    expect(key.startsWith('checkins/user-abc/')).toBe(true);
    expect(key.endsWith('.jpg')).toBe(true);
  });

  it('builds a local public URL when R2 is not configured', () => {
    expect(photoPublicUrl('checkins/u/1.jpg')).toBe(
      '/api/uploads/local?key=checkins%2Fu%2F1.jpg'
    );
    expect(photoPublicUrl(null)).toBeNull();
  });

  it('signs ContentLength into R2 PutObject so size cannot be bypassed', async () => {
    process.env.R2_ACCOUNT_ID = 'acct';
    process.env.R2_ACCESS_KEY_ID = 'key';
    process.env.R2_SECRET_ACCESS_KEY = 'secret';
    process.env.R2_BUCKET = 'photos';
    process.env.R2_PUBLIC_URL = 'https://cdn.example';

    const result = await createPresignedUpload({
      userId: 'user-1',
      contentType: 'image/jpeg',
      contentLength: 4096,
      origin: 'http://localhost:3000',
    });

    expect(result.uploadUrl).toBe('https://r2.example/presigned-put');
    expect(putObjectInputs).toHaveLength(1);
    expect(putObjectInputs[0]).toEqual(
      expect.objectContaining({
        Bucket: 'photos',
        ContentType: 'image/jpeg',
        ContentLength: 4096,
      })
    );
  });

  it('writes, reads, and deletes local photo objects', async () => {
    const uploadDir = path.join(process.cwd(), '.uploads');
    await mkdir(uploadDir, { recursive: true });

    const photoKey = 'checkins/user-test/test-photo.jpg';
    const body = Buffer.from([0xff, 0xd8, 0xff, 0xd9]); // minimal jpeg-ish

    await writeLocalPhoto({
      photoKey,
      contentType: 'image/jpeg',
      body,
      userId: 'user-test',
    });

    const read = await readLocalPhoto(photoKey);
    expect(read?.contentType).toBe('image/jpeg');
    expect(read?.body.equals(body)).toBe(true);

    await deletePhotoObject(photoKey);
    expect(await readLocalPhoto(photoKey)).toBeNull();

    // Cleanup leftover dirs from this test
    await rm(path.join(uploadDir, 'checkins', 'user-test'), {
      recursive: true,
      force: true,
    });
  });

  it('rejects local writes outside the user prefix', async () => {
    await expect(
      writeLocalPhoto({
        photoKey: 'checkins/other-user/x.jpg',
        contentType: 'image/jpeg',
        body: Buffer.from('x'),
        userId: 'user-test',
      })
    ).rejects.toThrow(/Invalid photo key/);
  });
});

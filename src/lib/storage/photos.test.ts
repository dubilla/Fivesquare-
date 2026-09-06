import { describe, it, expect } from 'vitest';
import {
  buildPhotoKey,
  isPhotoContentType,
  photoPublicUrl,
  writeLocalPhoto,
  readLocalPhoto,
  deletePhotoObject,
} from './photos';
import { mkdir, rm } from 'fs/promises';
import path from 'path';

describe('photo storage helpers', () => {
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
    const prev = { ...process.env };
    delete process.env.R2_ACCOUNT_ID;
    delete process.env.R2_ACCESS_KEY_ID;
    delete process.env.R2_SECRET_ACCESS_KEY;
    delete process.env.R2_BUCKET;
    delete process.env.R2_PUBLIC_URL;

    expect(photoPublicUrl('checkins/u/1.jpg')).toBe(
      '/api/uploads/local?key=checkins%2Fu%2F1.jpg'
    );
    expect(photoPublicUrl(null)).toBeNull();

    process.env = prev;
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

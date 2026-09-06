/**
 * Dish photo storage (S9).
 *
 * Production: Cloudflare R2 (S3-compatible). Set R2_ACCOUNT_ID,
 * R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET, and R2_PUBLIC_URL
 * (custom domain or https://pub-….r2.dev). Serving is public-read via
 * R2_PUBLIC_URL — simplest option; no presigned GETs.
 *
 * Local/dev without R2: files land under `.uploads/` and are served by
 * `/api/uploads/local`. Same client flow (presign → PUT → store key).
 *
 * Orphan policy: deleting a check-in deletes its object. Abandoned uploads
 * (presigned + PUT, form never submitted) are accepted garbage at solo scale.
 */

import {
  DeleteObjectCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { mkdir, writeFile, unlink, readFile } from 'fs/promises';
import path from 'path';
import { randomUUID } from 'crypto';
import { PHOTO_MAX_BYTES } from './photos-limits';

export { PHOTO_MAX_BYTES };
export const PHOTO_ALLOWED_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
] as const;

export type PhotoContentType = (typeof PHOTO_ALLOWED_TYPES)[number];

const LOCAL_UPLOAD_DIR = path.join(process.cwd(), '.uploads');

function r2Configured() {
  return Boolean(
    process.env.R2_ACCOUNT_ID &&
      process.env.R2_ACCESS_KEY_ID &&
      process.env.R2_SECRET_ACCESS_KEY &&
      process.env.R2_BUCKET &&
      process.env.R2_PUBLIC_URL
  );
}

function getR2Client() {
  const accountId = process.env.R2_ACCOUNT_ID!;
  return new S3Client({
    region: 'auto',
    endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: process.env.R2_ACCESS_KEY_ID!,
      secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
    },
  });
}

function extensionFor(contentType: PhotoContentType) {
  switch (contentType) {
    case 'image/jpeg':
      return 'jpg';
    case 'image/png':
      return 'png';
    case 'image/webp':
      return 'webp';
    case 'image/gif':
      return 'gif';
  }
}

export function isPhotoContentType(value: string): value is PhotoContentType {
  return (PHOTO_ALLOWED_TYPES as readonly string[]).includes(value);
}

/** Build an object key scoped to the uploading user. */
export function buildPhotoKey(
  userId: string,
  contentType: PhotoContentType
): string {
  return `checkins/${userId}/${randomUUID()}.${extensionFor(contentType)}`;
}

/** Public URL for a stored key, or null when there is no photo. */
export function photoPublicUrl(
  photoKey: string | null | undefined
): string | null {
  if (!photoKey) return null;
  if (r2Configured()) {
    const base = process.env.R2_PUBLIC_URL!.replace(/\/$/, '');
    return `${base}/${photoKey}`;
  }
  // Local driver: served by GET /api/uploads/local?key=…
  return `/api/uploads/local?key=${encodeURIComponent(photoKey)}`;
}

export async function createPresignedUpload(options: {
  userId: string;
  contentType: PhotoContentType;
  /** Absolute origin for local-driver upload URLs (e.g. http://localhost:3000). */
  origin: string;
}): Promise<{ uploadUrl: string; photoKey: string; publicUrl: string }> {
  const photoKey = buildPhotoKey(options.userId, options.contentType);

  if (r2Configured()) {
    const client = getR2Client();
    const command = new PutObjectCommand({
      Bucket: process.env.R2_BUCKET!,
      Key: photoKey,
      ContentType: options.contentType,
      // Enforce size on the signed request when the client sends Content-Length.
      // R2 still accepts smaller bodies; oversize is rejected client-side first.
    });
    const uploadUrl = await getSignedUrl(client, command, {
      expiresIn: 60 * 5,
    });
    return {
      uploadUrl,
      photoKey,
      publicUrl: photoPublicUrl(photoKey)!,
    };
  }

  // Local fallback — same shape as R2 so the client path is identical.
  const uploadUrl = `${options.origin}/api/uploads/local?key=${encodeURIComponent(photoKey)}`;
  return {
    uploadUrl,
    photoKey,
    publicUrl: photoPublicUrl(photoKey)!,
  };
}

export async function deletePhotoObject(photoKey: string): Promise<void> {
  if (r2Configured()) {
    const client = getR2Client();
    await client.send(
      new DeleteObjectCommand({
        Bucket: process.env.R2_BUCKET!,
        Key: photoKey,
      })
    );
    return;
  }

  const filePath = path.join(LOCAL_UPLOAD_DIR, photoKey);
  try {
    await unlink(filePath);
  } catch (err) {
    // Missing file is fine — already gone or never written.
    if ((err as NodeJS.ErrnoException).code !== 'ENOENT') throw err;
  }
}

/** Persist a local-driver upload. Validates key shape, type, and size. */
export async function writeLocalPhoto(options: {
  photoKey: string;
  contentType: string;
  body: Buffer;
  userId: string;
}): Promise<void> {
  if (!options.photoKey.startsWith(`checkins/${options.userId}/`)) {
    throw new Error('Invalid photo key');
  }
  if (options.photoKey.includes('..') || path.isAbsolute(options.photoKey)) {
    throw new Error('Invalid photo key');
  }
  if (!isPhotoContentType(options.contentType)) {
    throw new Error('Unsupported content type');
  }
  if (
    options.body.byteLength === 0 ||
    options.body.byteLength > PHOTO_MAX_BYTES
  ) {
    throw new Error('Photo must be between 1 byte and 10MB');
  }

  const filePath = path.join(LOCAL_UPLOAD_DIR, options.photoKey);
  await mkdir(path.dirname(filePath), { recursive: true });
  await writeFile(filePath, options.body);
}

export async function readLocalPhoto(
  photoKey: string
): Promise<{ body: Buffer; contentType: PhotoContentType } | null> {
  if (photoKey.includes('..') || path.isAbsolute(photoKey)) {
    return null;
  }
  if (!photoKey.startsWith('checkins/')) {
    return null;
  }

  const filePath = path.join(LOCAL_UPLOAD_DIR, photoKey);
  try {
    const body = await readFile(filePath);
    const ext = path.extname(photoKey).toLowerCase();
    const contentType: PhotoContentType =
      ext === '.png'
        ? 'image/png'
        : ext === '.webp'
          ? 'image/webp'
          : ext === '.gif'
            ? 'image/gif'
            : 'image/jpeg';
    return { body, contentType };
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') return null;
    throw err;
  }
}

export function storageDriver(): 'r2' | 'local' {
  return r2Configured() ? 'r2' : 'local';
}

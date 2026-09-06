/**
 * Client-side image downscale before upload (S9).
 * Caps the long edge at ~2000px via canvas to keep R2 objects small.
 */

const MAX_EDGE = 2000;
const JPEG_QUALITY = 0.85;

export type UploadableImageType =
  | 'image/jpeg'
  | 'image/png'
  | 'image/webp'
  | 'image/gif';

export async function downscaleImage(file: File): Promise<{
  blob: Blob;
  contentType: UploadableImageType;
}> {
  // GIFs: keep as-is (canvas would flatten animation). Size is still enforced
  // by the presign + upload routes (≤10MB).
  if (file.type === 'image/gif') {
    return { blob: file, contentType: 'image/gif' };
  }

  const bitmap = await createImageBitmap(file);
  try {
    const longEdge = Math.max(bitmap.width, bitmap.height);
    const scale = longEdge > MAX_EDGE ? MAX_EDGE / longEdge : 1;
    const width = Math.round(bitmap.width * scale);
    const height = Math.round(bitmap.height * scale);

    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      throw new Error('Could not get canvas context');
    }
    ctx.drawImage(bitmap, 0, 0, width, height);

    // Prefer webp when the browser can encode it; fall back to jpeg.
    const tryTypes: Array<{
      type: 'image/webp' | 'image/jpeg';
      quality: number;
    }> = [
      { type: 'image/webp', quality: JPEG_QUALITY },
      { type: 'image/jpeg', quality: JPEG_QUALITY },
    ];

    for (const { type, quality } of tryTypes) {
      const blob = await new Promise<Blob | null>(resolve =>
        canvas.toBlob(resolve, type, quality)
      );
      if (blob && blob.size > 0) {
        return { blob, contentType: type };
      }
    }

    const fallbackType: UploadableImageType =
      file.type === 'image/png'
        ? 'image/png'
        : file.type === 'image/webp'
          ? 'image/webp'
          : 'image/jpeg';
    return { blob: file, contentType: fallbackType };
  } finally {
    bitmap.close();
  }
}

/** True when the file is an allowed image type under the upload policy. */
export function isAllowedImageFile(file: File): boolean {
  return (
    file.type === 'image/jpeg' ||
    file.type === 'image/png' ||
    file.type === 'image/webp' ||
    file.type === 'image/gif'
  );
}

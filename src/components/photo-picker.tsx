'use client';

import { useEffect, useId, useRef, useState } from 'react';
import { downscaleImage, isAllowedImageFile } from '@/lib/storage/downscale';
import { PHOTO_MAX_BYTES } from '@/lib/storage/photos-limits';

export interface PhotoSelection {
  /** Object key returned by the presign route — send this as photoKey on create. */
  photoKey: string;
  /** Local object URL for preview (revoke on clear). */
  previewUrl: string;
}

interface PhotoPickerProps {
  value: PhotoSelection | null;
  onChange: (photo: PhotoSelection | null) => void;
  disabled?: boolean;
}

/**
 * Optional single-photo picker for a check-in. Downscales, asks the API for a
 * presigned/local upload URL, PUTs the blob, then surfaces the storage key.
 */
export function PhotoPicker({ value, onChange, disabled }: PhotoPickerProps) {
  const inputId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Keep the latest preview URL so we can revoke it on replace/unmount.
  const previewRef = useRef<string | null>(null);

  useEffect(() => {
    previewRef.current = value?.previewUrl ?? null;
  }, [value]);

  useEffect(() => {
    return () => {
      if (previewRef.current) URL.revokeObjectURL(previewRef.current);
    };
  }, []);

  const clear = () => {
    if (value?.previewUrl) URL.revokeObjectURL(value.previewUrl);
    onChange(null);
    setError(null);
    if (inputRef.current) inputRef.current.value = '';
  };

  const handleFile = async (file: File | undefined) => {
    if (!file) return;
    setError(null);

    if (!isAllowedImageFile(file)) {
      setError('Please choose a JPEG, PNG, WebP, or GIF image.');
      return;
    }

    if (file.size > PHOTO_MAX_BYTES) {
      setError('Photo must be 10MB or smaller.');
      return;
    }

    setUploading(true);
    try {
      const { blob, contentType } = await downscaleImage(file);

      if (blob.size > PHOTO_MAX_BYTES) {
        setError(
          'Photo is still over 10MB after resizing. Try a smaller image.'
        );
        return;
      }

      const presignResponse = await fetch('/api/uploads/presign', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contentType,
          contentLength: blob.size,
        }),
      });

      if (!presignResponse.ok) {
        const data = await presignResponse.json().catch(() => ({}));
        throw new Error(data.error || 'Failed to start upload');
      }

      const { uploadUrl, photoKey } = (await presignResponse.json()) as {
        uploadUrl: string;
        photoKey: string;
      };

      const putResponse = await fetch(uploadUrl, {
        method: 'PUT',
        headers: { 'Content-Type': contentType },
        body: blob,
      });

      if (!putResponse.ok) {
        throw new Error('Failed to upload photo');
      }

      if (value?.previewUrl) URL.revokeObjectURL(value.previewUrl);
      const previewUrl = URL.createObjectURL(blob);
      onChange({ photoKey, previewUrl });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to upload photo');
      onChange(null);
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = '';
    }
  };

  return (
    <div>
      <label
        htmlFor={inputId}
        className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2"
      >
        Photo (optional)
      </label>

      {value ? (
        <div className="relative inline-block">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={value.previewUrl}
            alt="Dish preview"
            className="h-40 w-40 object-cover rounded-lg border border-gray-200 dark:border-gray-700"
          />
          <button
            type="button"
            onClick={clear}
            disabled={disabled || uploading}
            className="absolute top-2 right-2 bg-black/60 hover:bg-black/80 text-white text-xs font-medium px-2 py-1 rounded disabled:opacity-50"
          >
            Remove
          </button>
        </div>
      ) : (
        <div className="flex items-center gap-3">
          <input
            ref={inputRef}
            id={inputId}
            type="file"
            accept="image/jpeg,image/png,image/webp,image/gif"
            capture="environment"
            disabled={disabled || uploading}
            onChange={e => void handleFile(e.target.files?.[0])}
            className="block w-full text-sm text-gray-600 dark:text-gray-400
              file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0
              file:text-sm file:font-medium file:bg-blue-50 file:text-blue-700
              hover:file:bg-blue-100 dark:file:bg-gray-700 dark:file:text-gray-200
              disabled:opacity-50"
          />
          {uploading && (
            <span className="text-sm text-gray-500 dark:text-gray-400 whitespace-nowrap">
              Uploading…
            </span>
          )}
        </div>
      )}

      {error && (
        <p className="mt-2 text-sm text-red-600 dark:text-red-400">{error}</p>
      )}
    </div>
  );
}

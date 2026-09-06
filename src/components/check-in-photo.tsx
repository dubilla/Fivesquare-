'use client';

import { useEffect, useState } from 'react';

interface CheckInPhotoProps {
  src: string;
  alt: string;
  /** Thumbnail size class — default is a compact history/place thumb. */
  className?: string;
}

/**
 * Thumbnail that opens a full-size lightbox on tap (S9).
 */
export function CheckInPhoto({
  src,
  alt,
  className = 'h-20 w-20 object-cover rounded-md',
}: CheckInPhotoProps) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="block shrink-0 focus:outline-none focus:ring-2 focus:ring-blue-500 rounded-md"
        aria-label={`View photo: ${alt}`}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={src} alt={alt} className={className} />
      </button>

      {open && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={alt}
          className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4"
          onClick={() => setOpen(false)}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={src}
            alt={alt}
            className="max-h-full max-w-full object-contain rounded shadow-lg"
            onClick={e => e.stopPropagation()}
          />
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="absolute top-4 right-4 text-white bg-black/50 hover:bg-black/70 rounded-full w-10 h-10 text-xl"
            aria-label="Close photo"
          >
            ×
          </button>
        </div>
      )}
    </>
  );
}

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import {
  PHOTO_MAX_BYTES,
  createPresignedUpload,
  isPhotoContentType,
  storageDriver,
} from '@/lib/storage/photos';

/**
 * Issue a short-lived upload URL for a dish photo (S9).
 *
 * Orphan policy (decide, don't drift): a client may PUT an object and then
 * never submit the check-in form. At solo scale those abandoned objects are
 * accepted garbage — we do not track or sweep them. Deleting a check-in that
 * *did* store a photo_key deletes the object (see DELETE /api/checkins/[id]).
 */
export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { contentType, contentLength } = body as {
      contentType?: unknown;
      contentLength?: unknown;
    };

    if (typeof contentType !== 'string' || !isPhotoContentType(contentType)) {
      return NextResponse.json(
        {
          error:
            'contentType must be one of: image/jpeg, image/png, image/webp, image/gif',
        },
        { status: 400 }
      );
    }

    if (
      typeof contentLength !== 'number' ||
      !Number.isInteger(contentLength) ||
      contentLength <= 0 ||
      contentLength > PHOTO_MAX_BYTES
    ) {
      return NextResponse.json(
        {
          error: 'contentLength must be a number between 1 and 10485760 (10MB)',
        },
        { status: 400 }
      );
    }

    const origin = request.nextUrl.origin;
    const result = await createPresignedUpload({
      userId: session.user.id,
      contentType,
      contentLength,
      origin,
    });

    return NextResponse.json(
      {
        ...result,
        maxBytes: PHOTO_MAX_BYTES,
        driver: storageDriver(),
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('Error creating upload URL:', error);
    if (error instanceof Error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

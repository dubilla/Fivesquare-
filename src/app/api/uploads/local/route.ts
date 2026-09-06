import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import {
  PHOTO_MAX_BYTES,
  readLocalPhoto,
  writeLocalPhoto,
} from '@/lib/storage/photos';

/**
 * Local-only photo PUT/GET when R2 env vars are not configured.
 * Production uses R2 presigned URLs directly — this route is unused there.
 */

export async function PUT(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const photoKey = request.nextUrl.searchParams.get('key');
  if (!photoKey) {
    return NextResponse.json({ error: 'key is required' }, { status: 400 });
  }

  const contentType = request.headers.get('content-type') || '';
  const buffer = Buffer.from(await request.arrayBuffer());

  if (buffer.byteLength > PHOTO_MAX_BYTES) {
    return NextResponse.json(
      { error: 'Photo exceeds 10MB limit' },
      { status: 400 }
    );
  }

  try {
    await writeLocalPhoto({
      photoKey,
      contentType,
      body: buffer,
      userId: session.user.id,
    });
    return new NextResponse(null, { status: 204 });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Upload failed';
    const status =
      message.includes('Invalid') || message.includes('Unsupported')
        ? 400
        : 500;
    return NextResponse.json({ error: message }, { status });
  }
}

export async function GET(request: NextRequest) {
  const photoKey = request.nextUrl.searchParams.get('key');
  if (!photoKey) {
    return NextResponse.json({ error: 'key is required' }, { status: 400 });
  }

  try {
    const file = await readLocalPhoto(photoKey);
    if (!file) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    return new NextResponse(new Uint8Array(file.body), {
      status: 200,
      headers: {
        'Content-Type': file.contentType,
        'Cache-Control': 'public, max-age=31536000, immutable',
      },
    });
  } catch (error) {
    console.error('Error reading local photo:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

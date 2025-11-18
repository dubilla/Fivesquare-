import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { db } from '@/lib/db/client';
import { checkIns } from '@/lib/db/schema';
import { eq, and } from 'drizzle-orm';

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { id } = await params;

    // Check if check-in exists and belongs to user
    const existing = await db
      .select()
      .from(checkIns)
      .where(and(eq(checkIns.id, id), eq(checkIns.userId, session.user.id)))
      .limit(1);

    if (existing.length === 0) {
      return NextResponse.json(
        { error: 'Check-in not found' },
        { status: 404 }
      );
    }

    // Delete the check-in
    await db
      .delete(checkIns)
      .where(and(eq(checkIns.id, id), eq(checkIns.userId, session.user.id)));

    return NextResponse.json({ success: true }, { status: 200 });
  } catch (error) {
    console.error('Error deleting check-in:', error);

    if (error instanceof Error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { id } = await params;
    const body = await request.json();
    const { placeId, placeName, lat, lng, dishText, noteText, visitDatetime } =
      body;

    // Check if check-in exists and belongs to user
    const existing = await db
      .select()
      .from(checkIns)
      .where(and(eq(checkIns.id, id), eq(checkIns.userId, session.user.id)))
      .limit(1);

    if (existing.length === 0) {
      return NextResponse.json(
        { error: 'Check-in not found' },
        { status: 404 }
      );
    }

    // Validate required fields
    if (!placeId || typeof placeId !== 'string') {
      return NextResponse.json(
        { error: 'placeId is required and must be a string' },
        { status: 400 }
      );
    }

    if (!placeName || typeof placeName !== 'string') {
      return NextResponse.json(
        { error: 'placeName is required and must be a string' },
        { status: 400 }
      );
    }

    if (typeof lat !== 'number' || lat < -90 || lat > 90) {
      return NextResponse.json(
        { error: 'lat is required and must be a number between -90 and 90' },
        { status: 400 }
      );
    }

    if (typeof lng !== 'number' || lng < -180 || lng > 180) {
      return NextResponse.json(
        { error: 'lng is required and must be a number between -180 and 180' },
        { status: 400 }
      );
    }

    if (!dishText || typeof dishText !== 'string') {
      return NextResponse.json(
        { error: 'dishText is required and must be a string' },
        { status: 400 }
      );
    }

    if (dishText.length > 100) {
      return NextResponse.json(
        { error: 'dishText must be 100 characters or less' },
        { status: 400 }
      );
    }

    if (noteText !== null && noteText !== undefined) {
      if (typeof noteText !== 'string') {
        return NextResponse.json(
          { error: 'noteText must be a string' },
          { status: 400 }
        );
      }
      if (noteText.length > 500) {
        return NextResponse.json(
          { error: 'noteText must be 500 characters or less' },
          { status: 400 }
        );
      }
    }

    const visitDate = visitDatetime ? new Date(visitDatetime) : new Date();
    if (isNaN(visitDate.getTime())) {
      return NextResponse.json(
        { error: 'visitDatetime must be a valid date' },
        { status: 400 }
      );
    }

    // Update the check-in
    const [updated] = await db
      .update(checkIns)
      .set({
        placeId,
        placeName,
        lat,
        lng,
        dishText,
        noteText: noteText || null,
        visitDatetime: visitDate,
        updatedAt: new Date(),
      })
      .where(and(eq(checkIns.id, id), eq(checkIns.userId, session.user.id)))
      .returning();

    return NextResponse.json(updated, { status: 200 });
  } catch (error) {
    console.error('Error updating check-in:', error);

    if (error instanceof Error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

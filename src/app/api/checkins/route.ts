import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { db } from '@/lib/db/client';
import { checkIns } from '@/lib/db/schema';
import { eq, desc } from 'drizzle-orm';

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const userCheckIns = await db
      .select()
      .from(checkIns)
      .where(eq(checkIns.userId, session.user.id))
      .orderBy(desc(checkIns.visitDatetime));

    return NextResponse.json({ checkIns: userCheckIns }, { status: 200 });
  } catch (error) {
    console.error('Error fetching check-ins:', error);

    if (error instanceof Error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { placeId, placeName, lat, lng, dishText, noteText, visitDatetime } =
      body;

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

    const [newCheckIn] = await db
      .insert(checkIns)
      .values({
        userId: session.user.id,
        placeId,
        placeName,
        lat,
        lng,
        dishText,
        noteText: noteText || null,
        visitDatetime: visitDate,
      })
      .returning();

    return NextResponse.json(newCheckIn, { status: 201 });
  } catch (error) {
    console.error('Error creating check-in:', error);

    if (error instanceof Error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

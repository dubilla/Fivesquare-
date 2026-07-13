import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { db } from '@/lib/db/client';
import { checkIns, places } from '@/lib/db/schema';
import { VERDICTS, isVerdict } from '@/lib/verdict';
import { eq, desc } from 'drizzle-orm';

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    // Place data (name/coords/Google ID) comes from the places join now, not the
    // deprecated denormalized check_ins columns (removed at S5b). Explicit column
    // list so this query never references those columns — that's what makes the
    // S5b DROP safe to run while this version is still serving. leftJoin so a
    // (should-not-exist post-migration) unlinked row still returns.
    const userCheckIns = await db
      .select({
        id: checkIns.id,
        placeUuid: checkIns.placeUuid,
        placeName: places.name,
        placeId: places.googlePlaceId,
        lat: places.lat,
        lng: places.lng,
        dishText: checkIns.dishText,
        noteText: checkIns.noteText,
        verdict: checkIns.verdict,
        visitDatetime: checkIns.visitDatetime,
        createdAt: checkIns.createdAt,
        updatedAt: checkIns.updatedAt,
      })
      .from(checkIns)
      .leftJoin(places, eq(checkIns.placeUuid, places.id))
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
    const {
      placeId,
      placeName,
      lat,
      lng,
      formattedAddress,
      primaryType,
      dishText,
      noteText,
      verdict,
      visitDatetime,
    } = body;

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

    // `places` is a shared table (one row per Google place, across all users),
    // and this route rewrites name/address/type on it. Bound the client-supplied
    // strings so a single POST can't pollute the place as it renders on every
    // other user's place page. Generous caps — real Google values are short.
    if (placeName.length > 200) {
      return NextResponse.json(
        { error: 'placeName must be 200 characters or less' },
        { status: 400 }
      );
    }

    if (formattedAddress !== null && formattedAddress !== undefined) {
      if (typeof formattedAddress !== 'string') {
        return NextResponse.json(
          { error: 'formattedAddress must be a string' },
          { status: 400 }
        );
      }
      if (formattedAddress.length > 300) {
        return NextResponse.json(
          { error: 'formattedAddress must be 300 characters or less' },
          { status: 400 }
        );
      }
    }

    if (primaryType !== null && primaryType !== undefined) {
      if (typeof primaryType !== 'string') {
        return NextResponse.json(
          { error: 'primaryType must be a string' },
          { status: 400 }
        );
      }
      if (primaryType.length > 100) {
        return NextResponse.json(
          { error: 'primaryType must be 100 characters or less' },
          { status: 400 }
        );
      }
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

    // Verdict is required on new check-ins going forward (legacy rows are null).
    if (!isVerdict(verdict)) {
      return NextResponse.json(
        {
          error: `verdict is required and must be one of: ${VERDICTS.join(', ')}`,
        },
        { status: 400 }
      );
    }

    const visitDate = visitDatetime ? new Date(visitDatetime) : new Date();
    if (isNaN(visitDate.getTime())) {
      return NextResponse.json(
        { error: 'visitDatetime must be a valid date' },
        { status: 400 }
      );
    }

    // Upsert the normalized place (S4), keyed on the Google place ID. Name and
    // coords are refreshed from this check-in; address/type are only touched
    // when the client supplies them so we never null out prior enrichment.
    //
    // Not atomic with the check-in insert below: the neon-http driver has no
    // multi-statement transaction, and the check-in needs this row's id anyway.
    // Accepted tradeoff at solo/hobby scale — if the check-in insert fails, the
    // place upsert has already committed, leaving at worst an orphan place row
    // (its page 404s with zero visits) or a name/coord refresh from a request
    // that errored. Both are self-healing on the user's retry.
    const placeUpdate: {
      name: string;
      lat: number;
      lng: number;
      updatedAt: Date;
      formattedAddress?: string;
      primaryType?: string;
    } = { name: placeName, lat, lng, updatedAt: new Date() };
    if (typeof formattedAddress === 'string') {
      placeUpdate.formattedAddress = formattedAddress;
    }
    if (typeof primaryType === 'string') {
      placeUpdate.primaryType = primaryType;
    }

    const [place] = await db
      .insert(places)
      .values({
        googlePlaceId: placeId,
        name: placeName,
        lat,
        lng,
        formattedAddress:
          typeof formattedAddress === 'string' ? formattedAddress : null,
        primaryType: typeof primaryType === 'string' ? primaryType : null,
      })
      .onConflictDoUpdate({ target: places.googlePlaceId, set: placeUpdate })
      .returning();

    // The check-in points at the place via place_uuid only; the denormalized
    // place columns are no longer written (removed at S5b). Explicit returning so
    // this INSERT never names those columns — keeping the S5b DROP safe.
    const [newCheckIn] = await db
      .insert(checkIns)
      .values({
        userId: session.user.id,
        placeUuid: place.id,
        dishText,
        noteText: noteText || null,
        verdict,
        visitDatetime: visitDate,
      })
      .returning({
        id: checkIns.id,
        placeUuid: checkIns.placeUuid,
        dishText: checkIns.dishText,
        noteText: checkIns.noteText,
        verdict: checkIns.verdict,
        visitDatetime: checkIns.visitDatetime,
        createdAt: checkIns.createdAt,
        updatedAt: checkIns.updatedAt,
      });

    // Shape the response like GET's rows: place data from the place we upserted.
    return NextResponse.json(
      {
        ...newCheckIn,
        placeName: place.name,
        placeId: place.googlePlaceId,
        lat: place.lat,
        lng: place.lng,
      },
      { status: 201 }
    );
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

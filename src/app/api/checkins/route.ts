import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { db } from '@/lib/db/client';
import { checkIns, places } from '@/lib/db/schema';
import { VERDICTS, isVerdict } from '@/lib/verdict';
import { escapeLike } from '@/lib/db/like';
import { eq, desc, and, or, ilike, type SQL } from 'drizzle-orm';

export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    // S8 filters, all optional and composed onto the user scope with AND.
    // Invalid/absent params are ignored rather than 400'd so a hand-edited or
    // stale URL degrades to "no filter" instead of an error page.
    const { searchParams } = request.nextUrl;
    const conditions: SQL[] = [eq(checkIns.userId, session.user.id)];

    // Cap length before building the LIKE pattern — the POST side bounds every
    // string it stores, so don't let GET interpolate an unbounded term into two
    // ILIKE patterns. 200 comfortably exceeds a dish (100) or place name (200).
    const q = searchParams.get('q')?.trim().slice(0, 200);
    if (q) {
      // Case-insensitive substring match over dish and place name — the
      // "where was that great pad thai?" job. ILIKE is sufficient at this scale
      // (backlog: no full-text search / embeddings).
      const pattern = `%${escapeLike(q)}%`;
      conditions.push(
        or(ilike(checkIns.dishText, pattern), ilike(places.name, pattern))!
      );
    }

    const verdict = searchParams.get('verdict');
    if (isVerdict(verdict)) {
      conditions.push(eq(checkIns.verdict, verdict));
    }

    // Internal place UUID (the id place pages use). API-only in S8: the history
    // page deliberately doesn't wire this (place-scoped recall is the place
    // page's job), but the param is honored for programmatic/future callers.
    // place_uuid is a text column, so a malformed value is a plain no-match
    // (empty result), not a cast error — no validation needed to stay safe.
    const placeId = searchParams.get('placeId');
    if (placeId) {
      conditions.push(eq(checkIns.placeUuid, placeId));
    }

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
      .where(and(...conditions))
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

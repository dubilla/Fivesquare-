import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { findPlacesNearUser } from '@/lib/places/near-me';

// GET /api/places/near-me?lat=&lng= — the signed-in user's places nearest a
// point, each with its top dish and verdict. Backs the "near me" home screen
// (S6); coords come from the browser's geolocation, hence a query-param GET.
export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const latParam = searchParams.get('lat');
  const lngParam = searchParams.get('lng');

  // Parse explicitly: Number(null)/Number('') both coerce to 0 (a valid coord),
  // so a missing param would silently read as 0,0 — reject it up front.
  const lat = latParam === null || latParam === '' ? NaN : Number(latParam);
  const lng = lngParam === null || lngParam === '' ? NaN : Number(lngParam);

  // Reject missing/NaN/out-of-range coords — same bounds as the check-in route.
  if (!Number.isFinite(lat) || lat < -90 || lat > 90) {
    return NextResponse.json(
      { error: 'lat is required and must be a number between -90 and 90' },
      { status: 400 }
    );
  }
  if (!Number.isFinite(lng) || lng < -180 || lng > 180) {
    return NextResponse.json(
      { error: 'lng is required and must be a number between -180 and 180' },
      { status: 400 }
    );
  }

  try {
    const places = await findPlacesNearUser({
      userId: session.user.id,
      lat,
      lng,
    });
    return NextResponse.json({ places }, { status: 200 });
  } catch (error) {
    console.error('Error fetching nearby places:', error);
    if (error instanceof Error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

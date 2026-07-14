import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { findPlacesInBounds } from '@/lib/places/near-me';

// GET /api/places/in-bounds?minLat=&minLng=&maxLat=&maxLng= — the signed-in
// user's places inside a map viewport, each with its top dish and verdict.
// Backs the map view; the bounds come from MapLibre's getBounds() on every pan/
// zoom, hence a query-param GET.
export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);

  // `all=1` asks for every place (map opens framed to everywhere you've been);
  // otherwise a viewport is required and validated below.
  const wantsAll = searchParams.get('all') === '1';

  // Parse explicitly: Number(null)/Number('')/Number('  ') all coerce to 0 (a
  // valid coord), so a missing/blank param would silently read as 0 — trim then
  // reject up front.
  const parse = (name: string) => {
    const raw = searchParams.get(name)?.trim();
    return raw ? Number(raw) : NaN;
  };

  let bounds: {
    minLat: number;
    minLng: number;
    maxLat: number;
    maxLng: number;
  } | null = null;

  if (!wantsAll) {
    const minLat = parse('minLat');
    const maxLat = parse('maxLat');
    const minLng = parse('minLng');
    const maxLng = parse('maxLng');

    const latOk = (v: number) => Number.isFinite(v) && v >= -90 && v <= 90;
    const lngOk = (v: number) => Number.isFinite(v) && v >= -180 && v <= 180;

    if (!latOk(minLat) || !latOk(maxLat) || minLat > maxLat) {
      return NextResponse.json(
        { error: 'minLat/maxLat are required, between -90 and 90, min ≤ max' },
        { status: 400 }
      );
    }
    if (!lngOk(minLng) || !lngOk(maxLng) || minLng > maxLng) {
      return NextResponse.json(
        {
          error: 'minLng/maxLng are required, between -180 and 180, min ≤ max',
        },
        { status: 400 }
      );
    }
    bounds = { minLat, minLng, maxLat, maxLng };
  }

  try {
    const places = await findPlacesInBounds({
      userId: session.user.id,
      bounds,
    });
    return NextResponse.json({ places }, { status: 200 });
  } catch (error) {
    console.error('Error fetching places in bounds:', error);
    if (error instanceof Error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

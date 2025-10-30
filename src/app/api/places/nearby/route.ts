import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { getPlacesProvider } from '@/lib/places';

export async function POST(request: NextRequest) {
  // Check authentication
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { lat, lng, radius, type, keyword } = body;

    // Validate required parameters
    if (typeof lat !== 'number' || typeof lng !== 'number') {
      return NextResponse.json(
        { error: 'Invalid parameters: lat and lng must be numbers' },
        { status: 400 }
      );
    }

    if (lat < -90 || lat > 90 || lng < -180 || lng > 180) {
      return NextResponse.json(
        {
          error:
            'Invalid coordinates: lat must be between -90 and 90, lng must be between -180 and 180',
        },
        { status: 400 }
      );
    }

    // Get the places provider and search
    const provider = getPlacesProvider();
    const places = await provider.searchNearby({
      location: { lat, lng },
      radius,
      type,
      keyword,
    });

    return NextResponse.json({ places }, { status: 200 });
  } catch (error) {
    console.error('Error searching nearby places:', error);

    if (error instanceof Error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

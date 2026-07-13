import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { db } from '@/lib/db/client';
import { checkIns } from '@/lib/db/schema';
import { VERDICTS, isVerdict } from '@/lib/verdict';
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

    // Check if check-in exists and belongs to user. Explicit column so this
    // query doesn't reference the deprecated denormalized columns (dropped S5b).
    const existing = await db
      .select({ id: checkIns.id })
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
    // Editing changes only dish/note/verdict; place isn't editable in the
    // product, so place fields are neither read nor written here anymore.
    const { dishText, noteText, verdict, visitDatetime } = body;

    // Check if check-in exists and belongs to user. Explicit columns (no
    // denormalized place columns — dropped at S5b); verdict feeds the
    // preserve-on-edit logic below.
    const existing = await db
      .select({ verdict: checkIns.verdict })
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

    // Verdict is optional on edit: legacy rows can add one, but you aren't
    // forced to. A missing (undefined) or null verdict preserves the existing
    // value — the product has no "clear my verdict" affordance, so we never let
    // a null strip a verdict that's already there. Any other non-verdict value
    // is a client error.
    if (verdict !== undefined && verdict !== null && !isVerdict(verdict)) {
      return NextResponse.json(
        { error: `verdict must be one of: ${VERDICTS.join(', ')}` },
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

    // Update the check-in. Explicit returning (no denormalized place columns);
    // the client merges this over the row it already has, so place data it
    // already holds is preserved.
    const [updated] = await db
      .update(checkIns)
      .set({
        dishText,
        noteText: noteText || null,
        // Preserve the existing verdict unless a valid new one is supplied
        // (null/undefined never clears it).
        verdict: isVerdict(verdict) ? verdict : existing[0].verdict,
        visitDatetime: visitDate,
        updatedAt: new Date(),
      })
      .where(and(eq(checkIns.id, id), eq(checkIns.userId, session.user.id)))
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

import { syncFirebaseToSupabase } from '@/lib/firebase-sync';
import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
    const url = new URL(request.url);
    const collection = url.searchParams.get('collection') ?? undefined;
    // Run sync on server side. No progress callback for API.
    const result = await syncFirebaseToSupabase(undefined, collection);
    return NextResponse.json(result);
}

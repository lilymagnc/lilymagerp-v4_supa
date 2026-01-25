import { NextResponse } from 'next/server';
import { syncFirebaseToSupabase } from '@/lib/firebase-sync';

export async function GET(request: Request) {
    const url = new URL(request.url);
    const collection = url.searchParams.get('collection') ?? undefined;
    // Run sync on server side. No progress callback for API.
    const result = await syncFirebaseToSupabase(undefined, collection);
    return NextResponse.json(result);
}

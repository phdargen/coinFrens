import { NextResponse } from "next/server";

// Force dynamic rendering for this route
export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  return NextResponse.json(
    { 
      error: "This endpoint is deprecated. Use /api/generate-metadata followed by /api/create-coin instead.",
      deprecated: true
    },
    { status: 410 }
  );
} 
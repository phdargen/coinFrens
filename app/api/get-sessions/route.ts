import { NextResponse } from "next/server";
import { getActiveSessions } from "@/lib/session-client";

// Force dynamic rendering for this route
export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const sessions = await getActiveSessions();
    return NextResponse.json({ success: true, sessions });
  } catch (error) {
    console.error("Error getting active sessions:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
} 
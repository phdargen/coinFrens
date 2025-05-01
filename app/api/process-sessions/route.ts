import { NextResponse } from "next/server";
import { getActiveSessions } from "@/lib/session-client";
import { processCompletedSession } from "@/lib/generate-metadata";

// Force dynamic rendering for this route
export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    // Get all active sessions
    const sessions = await getActiveSessions();
    
    // Find sessions that have all participants but are still in pending status
    const readySessions = sessions.filter(
      (session) => 
        session.status === "pending" && 
        Object.keys(session.prompts).length >= session.maxParticipants
    );
    
    if (readySessions.length === 0) {
      return NextResponse.json({ message: "No sessions ready for processing" });
    }
    
    // Process each ready session
    const results = await Promise.all(
      readySessions.map(async (session) => {
        const processedSession = await processCompletedSession(session.id);
        return {
          sessionId: session.id,
          success: !!processedSession,
        };
      })
    );
    
    return NextResponse.json({ 
      message: `Processed ${results.filter(r => r.success).length} of ${results.length} ready sessions`,
      results 
    });
  } catch (error) {
    console.error("Error processing sessions:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
} 
import { NextResponse } from "next/server";
import { getSession, updateSessionStatus, updateSessionMetadata } from "@/lib/session-client";
import { generateCoinMetadata } from '@/lib/metadata-generator';

// Force dynamic rendering for this route
export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { sessionId } = body;

    if (!sessionId) {
      return NextResponse.json(
        { error: "Missing session ID" },
        { status: 400 }
      );
    }

    // Get session from database
    const session = await getSession(sessionId);

    if (!session) {
      return NextResponse.json(
        { error: "Session not found" },
        { status: 404 }
      );
    }

    // Check if the session is ready for generation
    const participantCount = Object.keys(session.participants || {}).length;
    if (participantCount < session.maxParticipants) {
      return NextResponse.json(
        { error: "Session is not full yet" },
        { status: 400 }
      );
    }

    if (session.status === "complete") {
      return NextResponse.json(
        { error: "Session already has metadata" },
        { status: 400 }
      );
    }

    // Get required environment variables
    const pinataJwt = process.env.PINATA_JWT;
    
    if (!pinataJwt) {
      throw new Error("PINATA_JWT is not set in environment variables");
    }

    // Update session status to generating
    await updateSessionStatus(sessionId, "generating");

    // Generate coin metadata using the metadata generator service
    console.log("Generating coin metadata...");
    const generatedMetadata = await generateCoinMetadata({
      participants: session.participants,
      sessionId,
      pinataJwt
    });

    console.log("Generated metadata:", generatedMetadata);

    // Update session with the generated metadata 
    await updateSessionMetadata(sessionId, generatedMetadata);
    
    console.log("Session after metadata update:", await getSession(sessionId));

    return NextResponse.json({ 
      success: true, 
      sessionId,
      metadata: generatedMetadata
    });
  } catch (error) {
    console.error("Error generating coin metadata:", error);
    return NextResponse.json(
      { error: "Failed to generate coin metadata" },
      { status: 500 }
    );
  }
} 
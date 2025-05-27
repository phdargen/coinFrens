import { NextResponse } from "next/server";
import { createSession as createSessionInDb } from "@/lib/session-client";
import { MAX_PROMPT_LENGTH } from "@/src/constants";

// Force dynamic rendering for this route
export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { creatorFid, creatorName, maxParticipants, prompt, address, pfpUrl } = body;

    if (!creatorFid) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    if (prompt && prompt.length > MAX_PROMPT_LENGTH) {
      return NextResponse.json(
        { error: `Prompt must be ${MAX_PROMPT_LENGTH} characters or less` },
        { status: 400 }
      );
    }

    console.log("Creating session:", {
      creatorFid,
      creatorName,
      maxParticipants: maxParticipants || 4,
      hasPrompt: !!prompt,
      promptLength: prompt?.length,
      hasAddress: !!address,
      hasPfp: !!pfpUrl
    });

    const session = await createSessionInDb(
      creatorFid, 
      creatorName, 
      maxParticipants || 4,
      prompt,
      address,
      pfpUrl
    );

    if (!session) {
      return NextResponse.json(
        { error: "Failed to create session" },
        { status: 500 }
      );
    }

    console.log("Session created successfully", {
      sessionId: session.id,
      participantCount: Object.keys(session.participants).length
    });

    return NextResponse.json({ success: true, session });
  } catch (error) {
    console.error("Error creating session:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
} 
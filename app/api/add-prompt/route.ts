import { NextResponse } from "next/server";
import { addPromptToSession } from "@/lib/session-client";
import { MAX_PROMPT_LENGTH } from "@/src/constants";

// Force dynamic rendering for this route
export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { sessionId, fid, prompt, username, address, pfpUrl } = body;

    console.log("Adding prompt to session:", { 
      sessionId, 
      fid, 
      promptLength: prompt?.length, 
      prompt: prompt?.substring(0, 50) + (prompt?.length > 50 ? "..." : ""),
      username,
      hasAddress: !!address,
      hasPfp: !!pfpUrl
    });

    if (!sessionId || !fid || !prompt) {
      console.error("Missing required fields:", { sessionId, fid, hasPrompt: !!prompt });
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    if (prompt.length > MAX_PROMPT_LENGTH) {
      console.error("Prompt too long:", { promptLength: prompt.length, maxLength: MAX_PROMPT_LENGTH });
      return NextResponse.json(
        { error: `Prompt must be ${MAX_PROMPT_LENGTH} characters or less` },
        { status: 400 }
      );
    }

    const session = await addPromptToSession(sessionId, fid, prompt, username, address, pfpUrl);

    if (!session) {
      console.error("Failed to add prompt to session:", sessionId);
      return NextResponse.json(
        { error: "Failed to add prompt to session" },
        { status: 404 }
      );
    }

    console.log("Successfully added prompt to session:", { 
      sessionId,
      participantCount: Object.keys(session.participants).length,
      maxParticipants: session.maxParticipants
    });

    return NextResponse.json({ success: true, session });
  } catch (error) {
    console.error("Error adding prompt:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
} 
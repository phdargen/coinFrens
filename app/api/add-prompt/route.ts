import { NextResponse } from "next/server";
import { addPromptToSession } from "@/lib/session-client";

// Force dynamic rendering for this route
export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { sessionId, fid, prompt, username } = body;

    console.log("Adding prompt to session:", { 
      sessionId, 
      fid, 
      promptLength: prompt?.length, 
      prompt: prompt?.substring(0, 50) + (prompt?.length > 50 ? "..." : ""),
      username 
    });

    if (!sessionId || !fid || !prompt) {
      console.error("Missing required fields:", { sessionId, fid, hasPrompt: !!prompt });
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    const session = await addPromptToSession(sessionId, fid, prompt, username);

    if (!session) {
      console.error("Failed to add prompt to session:", sessionId);
      return NextResponse.json(
        { error: "Failed to add prompt to session" },
        { status: 404 }
      );
    }

    console.log("Successfully added prompt to session:", { 
      sessionId,
      promptCount: Object.keys(session.prompts).length,
      participants: session.maxParticipants
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
import { NextResponse } from "next/server";
import { createSession as createSessionInDb } from "@/lib/session-client";

// Force dynamic rendering for this route
export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { creatorFid, creatorName, maxParticipants, prompt } = body;

    if (!creatorFid) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    console.log("Creating session:", {
      creatorFid,
      creatorName,
      maxParticipants: maxParticipants || 4,
      hasPrompt: !!prompt,
      promptLength: prompt?.length
    });

    const session = await createSessionInDb(
      creatorFid, 
      creatorName, 
      maxParticipants || 4,
      prompt
    );

    if (!session) {
      return NextResponse.json(
        { error: "Failed to create session" },
        { status: 500 }
      );
    }

    console.log("Session created successfully", {
      sessionId: session.id,
      promptsCount: Object.keys(session.prompts).length
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
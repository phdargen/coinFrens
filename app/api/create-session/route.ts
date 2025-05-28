import { NextResponse } from "next/server";
import { createSession as createSessionInDb } from "@/lib/session-client";
import { MAX_PROMPT_LENGTH, MAX_CUSTOM_STYLE_LENGTH, SESSION_STYLES } from "@/src/constants";
import { incrementCreatedSessions } from "@/lib/platform-stats";

// Force dynamic rendering for this route
export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const {
      creatorFid,
      creatorName,
      maxParticipants,
      prompt,
      address,
      pfpUrl,
      addPfps,
      style,
      allowedToJoin,
      minTalentScore,
    } = body;

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

    // Validate custom style length if the style is custom
    const isCustomStyle = !SESSION_STYLES.includes(style);
    if (isCustomStyle && style && typeof style === 'string' && style.length > MAX_CUSTOM_STYLE_LENGTH) {
      return NextResponse.json(
        { error: `Custom style description must be ${MAX_CUSTOM_STYLE_LENGTH} characters or less` },
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
      hasPfp: !!pfpUrl,
      addPfps,
      style,
      allowedToJoin,
      minTalentScore
    });

    const session = await createSessionInDb(
      creatorFid, 
      creatorName, 
      maxParticipants || 4,
      prompt,
      address,
      pfpUrl,
      addPfps,
      style,
      allowedToJoin,
      minTalentScore
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

    // Track session creation in platform stats
    await incrementCreatedSessions();

    return NextResponse.json({ success: true, session });
  } catch (error) {
    console.error("Error creating session:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
} 
import { NextResponse } from "next/server";
import { addPromptToSession, getSession } from "@/lib/session-client";
import { MAX_PROMPT_LENGTH } from "@/src/constants";
import { sendFrameNotification } from "@/lib/notification-client";

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

    // Get the session before adding the new participant to see existing participants
    const sessionBefore = await getSession(sessionId);
    if (!sessionBefore) {
      console.error("Session not found:", sessionId);
      return NextResponse.json(
        { error: "Session not found" },
        { status: 404 }
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

    const participantCount = Object.keys(session.participants).length;
    const existingParticipants = Object.values(sessionBefore.participants || {});
    
    // Send notifications to existing participants if this isn't the final spot
    if (participantCount < session.maxParticipants && existingParticipants.length > 0) {
      const joinerName = username || (fid.startsWith('wallet-') ? `${fid.slice(7, 13)}...` : `User ${fid}`);
      
      const notificationPromises = existingParticipants.map(async (participant) => {
        // Only send notifications to Farcaster users (not wallet-only users) and not to the person who just joined
        if (!participant.fid.startsWith('wallet-') && participant.fid !== fid) {
          try {
            const participantFid = Number(participant.fid);
            await sendFrameNotification({
              fid: participantFid,
              title: "🎉 New fren joined!",
              body: `${joinerName} joined your coin session! ${session.maxParticipants - participantCount} spots left.`,
            });
          } catch (error) {
            console.error(`Failed to send notification to participant ${participant.fid}:`, error);
            // Continue with other notifications even if one fails
          }
        }
      });
      
      // Send all notifications concurrently
      await Promise.allSettled(notificationPromises);
      console.log("Join notifications sent to existing participants");
    }

    console.log("Successfully added prompt to session:", { 
      sessionId,
      participantCount,
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
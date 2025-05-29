import { NextResponse } from "next/server";
import { z } from "zod";

// Force dynamic rendering for this route
export const dynamic = 'force-dynamic';

// Schema for Farcaster post request
const FarcasterPostCastSchema = z.object({
  castText: z.string(),
  embeds: z.array(z.object({
    url: z.string()
  })).optional(),
});

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { sessionId, coinAddress, coinName, coinSymbol, participants } = body;

    if (!sessionId || !coinAddress || !coinName || !coinSymbol) {
      return NextResponse.json(
        { error: "Missing required parameters" },
        { status: 400 }
      );
    }

    // Get environment variables
    const neynarApiKey = process.env.NEYNAR_API_KEY;
    const signerUuid = process.env.NEYNAR_MANAGER_SIGNER;

    if (!neynarApiKey || !signerUuid) {
      return NextResponse.json(
        { error: "Neynar API credentials not configured" },
        { status: 500 }
      );
    }

    // Create Zora URL with referrer
    const ZORA_REFERRER = process.env.INTEGRATOR_WALLET_ADDRESS;
    const zoraUrl = `https://zora.co/coin/base:${coinAddress}?referrer=${ZORA_REFERRER}`;

    // Format participant names for the cast
    let participantText = "";
    if (participants && Object.keys(participants).length > 0) {
      const participantNames = Object.values(participants)
        .map((p: any) => {
          const username = p.username || `User ${p.fid}`;
          // Add @ before usernames for Farcaster users (not wallet users)
          return p.fid && !p.fid.startsWith('wallet-') ? `@${username}` : username;
        });
      
      if (participantNames.length > 0) {
        let namesText;
        if (participantNames.length === 1) {
          namesText = participantNames[0];
        } else if (participantNames.length === 2) {
          namesText = `${participantNames[0]} and ${participantNames[1]}`;
        } else {
          // For 3 or more participants, join all but the last with commas, then add "and" before the last
          const allButLast = participantNames.slice(0, -1);
          const last = participantNames[participantNames.length - 1];
          namesText = `${allButLast.join(', ')} and ${last}`;
        }
        participantText = ` coined by ${namesText}`;
      }
    }

    // Create the cast text
    const castText = `${coinName} (${coinSymbol})${participantText} just launched 🚀`;

    // Prepare the cast data
    const castData = {
      castText,
      embeds: [{ url: zoraUrl }],
    };

    // Validate with schema
    const validatedData = FarcasterPostCastSchema.parse(castData);

    // Post to Farcaster using Neynar API
    const headers: HeadersInit = {
      api_key: neynarApiKey,
      "Content-Type": "application/json",
    };

    const response = await fetch("https://api.neynar.com/v2/farcaster/cast", {
      method: "POST",
      headers,
      body: JSON.stringify({
        signer_uuid: signerUuid,
        text: validatedData.castText,
        embeds: validatedData.embeds,
      }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => null);
      console.error("Neynar API error:", response.status, errorData);
      return NextResponse.json(
        { error: "Failed to post to Farcaster", details: errorData },
        { status: response.status }
      );
    }

    const data = await response.json();
    console.log("Successfully posted cast to Farcaster:", data);

    return NextResponse.json({
      success: true,
      message: "Successfully posted cast to Farcaster",
      data,
    });

  } catch (error) {
    console.error("Error posting to Farcaster:", error);
    return NextResponse.json(
      { 
        error: "Failed to post to Farcaster",
        details: error instanceof Error ? error.message : String(error)
      },
      { status: 500 }
    );
  }
} 
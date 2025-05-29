import { NextResponse } from "next/server";
import { z } from "zod";
import { TwitterApi } from 'twitter-api-v2';

// Force dynamic rendering for this route
export const dynamic = 'force-dynamic';

// Schema for Twitter post tweet
const TwitterPostTweetSchema = z.object({
  tweet: z.string().max(280),
  mediaIds: z.array(z.string()).optional(),
});

interface XVerification {
  fid: number;
  platform: string;
  platformId: string;
  platformUsername: string;
  verifiedAt: number;
}

interface WarpcastVerificationResponse {
  result: {
    verifications: XVerification[];
  };
}

async function getXUsername(fid: string): Promise<string | null> {
  try {
    // Skip wallet users
    if (fid.startsWith('wallet-')) {
      return null;
    }

    const numericFid = parseInt(fid);
    if (isNaN(numericFid)) {
      return null;
    }

    const response = await fetch(`https://api.warpcast.com/fc/account-verifications?fid=${numericFid}`);
    
    if (!response.ok) {
      console.warn(`Failed to fetch verifications for FID ${numericFid}:`, response.status);
      return null;
    }

    const data: WarpcastVerificationResponse = await response.json();
    
    // Find X verification
    const xVerification = data.result.verifications.find(
      (verification) => verification.platform === "x"
    );

    return xVerification ? xVerification.platformUsername : null;
  } catch (error) {
    console.warn(`Error fetching X verification for FID ${fid}:`, error);
    return null;
  }
}

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

    // Get environment variables for Twitter API
    const twitterApiKey = process.env.TWITTER_API_KEY;
    const twitterApiSecret = process.env.TWITTER_API_SECRET;
    const twitterAccessToken = process.env.TWITTER_ACCESS_TOKEN;
    const twitterAccessTokenSecret = process.env.TWITTER_ACCESS_TOKEN_SECRET;
    const twitterBearerToken = process.env.TWITTER_BEARER_TOKEN;

    if (!twitterApiKey || !twitterApiSecret || !twitterAccessToken || !twitterAccessTokenSecret) {
      return NextResponse.json(
        { error: "Twitter API credentials not configured" },
        { status: 500 }
      );
    }

    // Initialize Twitter client
    const twitterClient = new TwitterApi({
      appKey: twitterApiKey,
      appSecret: twitterApiSecret,
      accessToken: twitterAccessToken,
      accessSecret: twitterAccessTokenSecret,
    });

    // Create Zora URL with referrer
    const ZORA_REFERRER = process.env.INTEGRATOR_WALLET_ADDRESS;
    const zoraUrl = `https://zora.co/coin/base:${coinAddress}?referrer=${ZORA_REFERRER}`;

    // Format participant names for the tweet
    let participantText = "";
    if (participants && Object.keys(participants).length > 0) {
      const participantPromises = Object.values(participants)
        .map(async (p: any) => {
          const xUsername = await getXUsername(p.fid);
          
          if (xUsername) {
            // Use X username with @ tag
            return `@${xUsername}`;
          } else {
            // Use Farcaster username without @ tag
            return p.username || `User ${p.fid}`;
          }
        });
      
      const participantNames = await Promise.all(participantPromises);
      
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

    // Create the tweet text (include URL in tweet since Twitter auto-shortens)
    const tweetText = `${coinName} (${coinSymbol})${participantText} just launched 🚀 ${zoraUrl}`;

    // Validate tweet length
    if (tweetText.length > 280) {
      // If too long, truncate participant text
      const baseTweet = `${coinName} (${coinSymbol}) just launched 🚀 ${zoraUrl}`;
      if (baseTweet.length > 280) {
        return NextResponse.json(
          { error: "Tweet text too long even without participants" },
          { status: 400 }
        );
      }
      // Use the base tweet without participant names
      participantText = "";
    }

    const finalTweetText = `${coinName} (${coinSymbol})${participantText} just launched 🚀 ${zoraUrl}`;

    // Prepare the tweet data
    const tweetData = {
      tweet: finalTweetText,
    };

    // Validate with schema
    const validatedData = TwitterPostTweetSchema.parse(tweetData);

    // Actually post the tweet using Twitter API v2
    console.log("Posting tweet:", validatedData.tweet);
    
    const tweetOptions: any = {
      text: validatedData.tweet,
    };

    // Add media if provided
    if (validatedData.mediaIds && validatedData.mediaIds.length > 0) {
      tweetOptions.media = { media_ids: validatedData.mediaIds };
    }

    const response = await twitterClient.v2.tweet(tweetOptions);

    console.log("Successfully posted tweet to Twitter:", response);

    return NextResponse.json({
      success: true,
      message: "Successfully posted tweet to Twitter",
      data: response.data,
      tweetText: validatedData.tweet,
    });

  } catch (error) {
    console.error("Error posting to Twitter:", error);
    return NextResponse.json(
      { 
        error: "Failed to post to Twitter",
        details: error instanceof Error ? error.message : String(error)
      },
      { status: 500 }
    );
  }
} 
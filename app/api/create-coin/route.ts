import { NextResponse } from "next/server";
import { getSession, updateSessionStatus, updateSessionMetadata } from "@/lib/session-client";
import { createPublicClient, http, createWalletClient, Address } from 'viem';
import { base, baseSepolia } from 'viem/chains';
import { mnemonicToAccount } from 'viem/accounts';
import { PlatformFactory } from '@/lib/platform-factory';
import { PlatformType } from '@/lib/coin-platform-types';
import { getAllNotificationEnabledUsers } from "@/lib/notification";
import { sendBatchNotifications } from '@/lib/notification-client';
import { incrementCreatedCoins } from "@/lib/platform-stats";
import { GeneratedMetadata } from '@/lib/metadata-generator';

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

    // Check if the session has metadata
    if (!session.metadata) {
      return NextResponse.json(
        { error: "Session metadata not found. Generate metadata first." },
        { status: 400 }
      );
    }

    if (session.status === "complete") {
      return NextResponse.json(
        { error: "Session already complete" },
        { status: 400 }
      );
    }

    // Get required environment variables
    const mnemonic = process.env.MNEMONIC_PHRASE;
    
    if (!mnemonic) {
      throw new Error("MNEMONIC_PHRASE is not set in environment variables");
    }
    
    // Create account from mnemonic
    const account = mnemonicToAccount(mnemonic);
    console.log("Account created with address:", account.address);

    // Create public client
    const publicClient = createPublicClient({
      chain: base,
      transport: http()
    });

    // Create wallet client
    const walletClient = createWalletClient({
      account,
      chain: base,
      transport: http()
    });
    
    // Create the coin using platform service (default to Zora for now)
    const platformType: PlatformType = 'zora'; // This could be configurable in the future
    const platform = PlatformFactory.createPlatform(platformType);
    
    console.log(`Creating coin with ${platformType} platform...`);
    let coinResult;
    try {
      coinResult = await platform.createCoin(
        {
          metadata: session.metadata as GeneratedMetadata,
          creatorFid: session.creatorFid,
          participants: session.participants,
          creatorAddress: account.address as Address,
        },
        walletClient as any,
        publicClient as any
      );
    } catch (error) {
      console.error("Coin creation failed:", error);
      await updateSessionStatus(sessionId, "txFailed");
      throw error;
    }

    const { coinAddress, txHash, deployment, status } = coinResult;

    // Distribute tokens to participants if creation was successful
    if (status === "success" && session.participants) {
      try {
        await platform.distributeTokens(
          coinAddress,
          session.participants,
          walletClient as any,
          publicClient as any
        );
      } catch (error) {
        console.error("Error distributing tokens to participants:", error);
        // Continue with the process even if token distribution fails
      }
    }

    // Update session with final coin data
    await updateSessionMetadata(sessionId, {
      ...session.metadata,
      coinAddress,
      txHash,
      deployment,
    });
    
    // Update session status
    if (status === "success") {
      await updateSessionStatus(sessionId, "complete");
      
      // Track successful coin creation in platform stats
      await incrementCreatedCoins();
      
      // Send notifications to all participants about the successful coin creation
      if (session.participants) {
        // Get all notification-enabled users
        const notificationEnabledFids = await getAllNotificationEnabledUsers();
        
        // Filter for participants who have notifications enabled
        const eligibleFids = Object.values(session.participants)
          .filter(participant => 
            !participant.fid.startsWith('wallet-') // Only Farcaster users
          )
          .map(participant => Number(participant.fid))
          .filter(participantFid => 
            !isNaN(participantFid) && 
            notificationEnabledFids.includes(participantFid)
          );
        
        if (eligibleFids.length > 0) {
          const batchResult = await sendBatchNotifications({
            fids: eligibleFids,
            title: `"${session.metadata.symbol}" launched 🚀!`,
            body: `You coined "${session.metadata.name}" with your frens!`,
          });
          
          console.log("Launch notifications batch result:", {
            attempted: eligibleFids.length,
            success: batchResult.success,
            frequencyLimited: batchResult.frequencyLimited,
            notificationsDisabled: batchResult.notificationsDisabled,
            failed: batchResult.failed
          });
        }
      }

      // Post to Farcaster announcing the coin launch
      try {
        console.log("Posting coin launch announcement to Farcaster...");
        const farcasterResponse = await fetch("/api/post-to-farcaster", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            sessionId,
            coinAddress,
            coinName: session.metadata.name,
            coinSymbol: session.metadata.symbol,
            participants: session.participants,
          }),
        });

        if (farcasterResponse.ok) {
          const farcasterData = await farcasterResponse.json();
          console.log("Successfully posted to Farcaster:", farcasterData);
        } else {
          const error = await farcasterResponse.json().catch(() => null);
          console.error("Failed to post to Farcaster:", farcasterResponse.status, error);
        }
      } catch (farcasterError) {
        console.error("Error posting to Farcaster:", farcasterError);
        // Don't fail the entire coin creation process if Farcaster posting fails
      }
    } else {
      await updateSessionStatus(sessionId, "txFailed");
    }

    return NextResponse.json({ 
      success: true, 
      sessionId,
      metadata: {
        ...session.metadata,
        coinAddress,
      }
    });
  } catch (error) {
    console.error("Error creating coin:", error);
    return NextResponse.json(
      { error: "Failed to create coin" },
      { status: 500 }
    );
  }
} 
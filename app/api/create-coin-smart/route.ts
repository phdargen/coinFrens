import { NextResponse } from "next/server";
import { getSession, updateSessionStatus, updateSessionMetadata } from "@/lib/session-client";
import { CdpClient } from "@coinbase/cdp-sdk";
import { createPublicClient, http, Address, erc20Abi, encodeFunctionData, Hex } from "viem";
import { base } from "viem/chains";
import { createCoinCall, CreateConstants, getCoinCreateFromLogs, validateMetadataURIContent, ValidMetadataURI } from '@zoralabs/coins-sdk';
import { getAllNotificationEnabledUsers } from "@/lib/notification";
import { sendBatchNotifications } from '@/lib/notification-client';
import { incrementCreatedCoins } from "@/lib/platform-stats";
import { GeneratedMetadata } from '@/lib/metadata-generator';
import { Participant } from '@/lib/types';

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

    if (!session.participants) {
      return NextResponse.json(
        { error: "No participants found in session" },
        { status: 400 }
      );
    }

    console.log("Creating coin with CDP Smart Account...");

    // Check if the CDP_API_KEY_ID, CDP_API_KEY_SECRET, and CDP_WALLET_SECRET are set
    if (!process.env.CDP_API_KEY_ID || !process.env.CDP_API_KEY_SECRET || !process.env.CDP_WALLET_SECRET) {
      throw new Error("CDP_API_KEY_ID, CDP_API_KEY_SECRET, and CDP_WALLET_SECRET must be set in environment variables");
    }

    // Initialize CDP client
    const cdp = new CdpClient({
      apiKeyId: process.env.CDP_API_KEY_ID,
      apiKeySecret: process.env.CDP_API_KEY_SECRET,
      walletSecret: process.env.CDP_WALLET_SECRET,
    });
    console.log("CDP client initialized", cdp);

    // Get required environment variables
    const ownerName = process.env.SMART_ACCOUNT_OWNER_NAME;
    if (!ownerName) {
      throw new Error("SMART_ACCOUNT_OWNER_NAME is not set in environment variables");
    }

    const paymasterUrl = process.env.PAYMASTER_ENDPOINT;
    console.log("Paymaster URL:", paymasterUrl ? "configured" : "not configured");

    // Get or create the EOA owner account
    const ownerAccount = await cdp.evm.getOrCreateAccount({ name: ownerName });
    console.log("EOA Owner Account Address:", ownerAccount.address);

    // Get or create smart account
    let smartAccount;
    const existingSmartAccountAddress = process.env.SMART_ACCOUNT_ADDRESS;
    
    if (existingSmartAccountAddress) {
      console.log("Using existing smart account:", existingSmartAccountAddress);
      smartAccount = await cdp.evm.getSmartAccount({
        address: existingSmartAccountAddress as `0x${string}`,
        owner: ownerAccount,
      });
      console.log("Retrieved smart account:", smartAccount.address);
    } else {
      console.log("Creating new smart account...");
      smartAccount = await cdp.evm.createSmartAccount({ owner: ownerAccount });
      console.log("Created smart account:", smartAccount.address);
    }

    // Create public client for Base mainnet
    const publicClient = createPublicClient({
      chain: base,
      transport: http(),
    });

    // Step 1: Create Zora coin via smart account
    console.log("Creating Zora coin...");
    
    const metadata = session.metadata as GeneratedMetadata;
    await validateMetadataURIContent(metadata.zoraTokenUri as ValidMetadataURI);

    const coinParams = {
      name: metadata.name,
      symbol: metadata.symbol,
      metadata: { type: "RAW_URI" as const, uri:metadata.zoraTokenUri },
      creator: smartAccount.address,
      payoutRecipient: smartAccount.address,
      platformReferrer: smartAccount.address,
      currency: CreateConstants.ContentCoinCurrencies.ZORA,
      chainId: base.id,
    };

    let coinAddress: Address | null = null;
    let createCoinTxHash: string | null = null;
    let deployment: any = null;
    
    // Retry logic for coin creation
    const maxRetries = 3;
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        console.log(`Coin creation attempt ${attempt}/${maxRetries}...`);
        
        // Get coin creation call data
        const createCoinCalls = await createCoinCall(coinParams);
        const coinCreationCall = createCoinCalls[0];

        // Send user operation for coin creation
        console.log("Sending coin creation user operation...");
        const createCoinOptions: any = {
          network: "base",
          calls: [coinCreationCall],
        };
        
        if (paymasterUrl) {
          createCoinOptions.paymasterUrl = paymasterUrl;
          console.log("Using paymaster for coin creation");
        }
        
        const { userOpHash: createCoinUserOpHash } = await smartAccount.sendUserOperation(createCoinOptions);

        console.log("Waiting for coin creation to complete...");
        const createCoinResult = await smartAccount.waitForUserOperation({
          userOpHash: createCoinUserOpHash,
        });

        if (createCoinResult.status !== "complete") {
          console.error(`Coin creation attempt ${attempt} failed with status:`, createCoinResult.status);
          if (attempt === maxRetries) {
            await updateSessionStatus(sessionId, "txFailed");
            return NextResponse.json(
              { error: "Coin creation failed after retries", status: createCoinResult.status },
              { status: 500 }
            );
          }
          continue; // Try again
        }

        // Get the transaction receipt to extract coin address
        const createCoinTxReceipt = await publicClient.waitForTransactionReceipt({
          hash: createCoinResult.transactionHash as `0x${string}`,
        });

        const extractedDeployment = getCoinCreateFromLogs(createCoinTxReceipt);
        const extractedCoinAddress = extractedDeployment?.coin as Address;

        if (!extractedCoinAddress) {
          console.error(`Attempt ${attempt}: Failed to extract coin address from transaction logs. txHash:`, createCoinResult.transactionHash);
          if (attempt === maxRetries) {
            throw new Error("Failed to extract coin address from transaction logs after retries. txHash: " + createCoinResult.transactionHash);
          }
          continue; // Try again
        }

        // Success - store the results
        coinAddress = extractedCoinAddress;
        createCoinTxHash = createCoinResult.transactionHash;
        deployment = extractedDeployment;
        
        console.log("Coin created successfully:", coinAddress);
        console.log("Coin creation transaction:", createCoinTxHash);
        break; // Exit retry loop on success
        
      } catch (error) {
        console.error(`Coin creation attempt ${attempt} failed:`, error);
        if (attempt === maxRetries) {
          throw error; // Re-throw on final attempt
        }
        // Add a small delay before retry
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
    }

    if (!coinAddress || !createCoinTxHash) {
      throw new Error("Coin creation failed after all retry attempts");
    }

    // Step 2: Distribute tokens to participants in batched transaction
    console.log("Preparing token distribution...");
    
    const participants = Object.values(session.participants);
    const participantAddresses = participants
      .filter((p: Participant) => p.address)
      .map((p: Participant) => p.address as Address);

    if (participantAddresses.length === 0) {
      console.log("No valid participant addresses found for token distribution");
      // Still consider this a success since the coin was created
    } else {
      // Get smart account's token balance
      const balance = await publicClient.readContract({
        address: coinAddress,
        abi: erc20Abi,
        functionName: 'balanceOf',
        args: [smartAccount.address as Address]
      });

      console.log(`Smart account token balance: ${balance} tokens`);

      // Reserve 10% for the smart account, distribute 90% to participants
      const reserveAmount = balance / BigInt(10);
      const distributionAmount = balance - reserveAmount;
      const amountPerParticipant = distributionAmount / BigInt(participantAddresses.length);

      console.log(`Distributing ${amountPerParticipant} tokens to each of ${participantAddresses.length} participants`);

      // Prepare batched transfer calls
      const transferCalls = participantAddresses.map(participantAddress => ({
        to: coinAddress,
        data: encodeFunctionData({
          abi: erc20Abi,
          functionName: 'transfer',
          args: [participantAddress, amountPerParticipant],
        }) as Hex,
        value: BigInt(0),
      }));

      // Send batched token distribution user operation
      console.log("Sending batched token distribution user operation...");
      const distributeOptions: any = {
        network: "base",
        calls: transferCalls,
      };
      
      if (paymasterUrl) {
        distributeOptions.paymasterUrl = paymasterUrl;
        console.log("Using paymaster for token distribution");
      }
      
      const { userOpHash: distributeTokensUserOpHash } = await smartAccount.sendUserOperation(distributeOptions);

      console.log("Waiting for token distribution to complete...");
      const distributeTokensResult = await smartAccount.waitForUserOperation({
        userOpHash: distributeTokensUserOpHash,
      });

      if (distributeTokensResult.status !== "complete") {
        console.error("Token distribution failed:", distributeTokensResult.status);
        // Don't fail the entire operation since coin creation succeeded
        console.log("Continuing despite token distribution failure...");
      } else {
        console.log("Token distribution completed successfully");
        console.log("Distribution transaction:", distributeTokensResult.transactionHash);
      }
    }

    // Update session with final coin data
    await updateSessionMetadata(sessionId, {
      ...metadata,
      coinAddress,
      txHash: createCoinTxHash,
      deployment,
    });

    // Update session status to complete
    await updateSessionStatus(sessionId, "complete");

    // Track successful coin creation in platform stats
    await incrementCreatedCoins();

    // Send notifications to participants about successful coin creation
    if (session.participants) {
      console.log("DEBUG: All session participants:", Object.keys(session.participants), Object.values(session.participants).map(p => ({ fid: p.fid, username: p.username })));
      
      const notificationEnabledFids = await getAllNotificationEnabledUsers();
      console.log("DEBUG: All notification-enabled FIDs:", notificationEnabledFids);
      
      const eligibleFids = Object.values(session.participants)
        .filter(participant => 
          !participant.fid.startsWith('wallet-') // Only Farcaster users
        )
        .map(participant => Number(participant.fid))
        .filter(participantFid => 
          !isNaN(participantFid) && 
          notificationEnabledFids.includes(participantFid)
        );
      
      console.log("DEBUG: Eligible FIDs for notifications:", eligibleFids);
      
      if (eligibleFids.length > 0) {
        const batchResult = await sendBatchNotifications({
          fids: eligibleFids,
          title: `${metadata.symbol} launched 🚀!`,
          body: `You coined "${metadata.name}" with your frens!`,
        });
        
        console.log("Launch notifications batch result:", {
          attempted: eligibleFids.length,
          success: batchResult.success,
          frequencyLimited: batchResult.frequencyLimited,
          notificationsDisabled: batchResult.notificationsDisabled,
          failed: batchResult.failed
        });
      } else {
        console.log("DEBUG: No eligible FIDs found for notifications");
      }
    }

    return NextResponse.json({ 
      success: true, 
      sessionId,
      metadata: {
        ...metadata,
        coinAddress,
      },
      smartAccountAddress: smartAccount.address,
      txHash: createCoinTxHash,
      platform: 'zora-smart'
    });

  } catch (error) {
    console.error("Error creating coin with smart account:", error);
    
    // Try to update session status to failed if we have a sessionId
    const body = await request.json().catch(() => ({}));
    if (body.sessionId) {
      await updateSessionStatus(body.sessionId, "txFailed").catch(console.error);
    }
    
    return NextResponse.json(
      { 
        error: "Failed to create coin with smart account",
        details: error instanceof Error ? error.message : String(error)
      },
      { status: 500 }
    );
  }
} 
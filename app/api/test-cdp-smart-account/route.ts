import { NextResponse } from "next/server";
import { getSession } from "@/lib/session-client";
import { CdpClient } from "@coinbase/cdp-sdk";
import { createPublicClient, http, parseEther, Calls } from "viem";
import { baseSepolia } from "viem/chains";

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

    if (!session.participants) {
      return NextResponse.json(
        { error: "No participants found in session" },
        { status: 400 }
      );
    }

    console.log("Testing CDP Smart Account functionality...");

    // Initialize CDP client
    const cdp = new CdpClient({
      apiKeyId: process.env.CDP_API_KEY_ID,
      apiKeySecret: process.env.CDP_API_KEY_SECRET,
      walletSecret: process.env.CDP_WALLET_SECRET
    });

    // Get or create an account
    const name = "Account1";
    const account = await cdp.evm.getOrCreateAccount({ name });
    console.log("EVM Account Address: ", account.address);
    
    // Get or create smart account based on environment variable
    let smartAccount;
    const existingSmartAccountAddress = process.env.SMART_ACCOUNT_ADDRESS;
    
    if (existingSmartAccountAddress) {
      console.log("Using existing smart account:", existingSmartAccountAddress);
      smartAccount = await cdp.evm.getSmartAccount({
        address: existingSmartAccountAddress as `0x${string}`,
        owner: account,
      });
      console.log("Retrieved smart account:", smartAccount.address);
    } else {
      console.log("Creating new smart account...");
      smartAccount = await cdp.evm.createSmartAccount({ owner: account });
      console.log("Created smart account:", smartAccount.address);
    }

    // Request faucet funds on base-sepolia
    console.log("Requesting faucet funds...");
    const { transactionHash: faucetTxHash } = await smartAccount.requestFaucet({
      network: "base-sepolia",
      token: "eth",
    });

    // Create public client to wait for faucet transaction
    const publicClient = createPublicClient({
      chain: baseSepolia,
      transport: http(),
    });

    console.log("Waiting for faucet transaction to be confirmed...");
    const faucetTxReceipt = await publicClient.waitForTransactionReceipt({
      hash: faucetTxHash,
    });
    console.log("Faucet transaction confirmed:", faucetTxReceipt.transactionHash);

    // Extract participant addresses
    const participants = Object.values(session.participants);
    const destinationAddresses = participants
      .filter(participant => participant.address)
      .map(participant => participant.address)
      .filter(address => address !== undefined) as string[];

    if (destinationAddresses.length === 0) {
      return NextResponse.json(
        { error: "No valid participant addresses found" },
        { status: 400 }
      );
    }

    console.log(`Found ${destinationAddresses.length} participant addresses:`, destinationAddresses);

    // Create batched transfer calls
    const calls = destinationAddresses.map((destinationAddress) => ({
      to: destinationAddress,
      value: parseEther("0.000001"), // Send 0.000001 ETH to each participant
      data: "0x",
    }));

    console.log("Sending batched user operation to participants...");
    const { userOpHash } = await smartAccount.sendUserOperation({
      network: "base-sepolia",
      calls: calls as Calls<unknown[]>,
    });

    console.log("Waiting for user operation to be confirmed...");
    const userOperationResult = await smartAccount.waitForUserOperation({
      userOpHash,
    });

    if (userOperationResult.status === "complete") {
      const explorerLink = `https://sepolia.basescan.org/tx/${userOperationResult.transactionHash}`;
      console.log("User operation confirmed. Block explorer link:", explorerLink);
      
      return NextResponse.json({
        success: true,
        smartAccountAddress: smartAccount.address,
        faucetTxHash,
        userOpHash,
        transactionHash: userOperationResult.transactionHash,
        explorerLink,
        participantsCount: destinationAddresses.length,
        transferAmount: "0.000001 ETH",
        message: "Successfully sent batched ETH transfers to all participants"
      });
    } else {
      console.log("User operation failed.");
      return NextResponse.json(
        { 
          error: "User operation failed",
          smartAccountAddress: smartAccount.address,
          faucetTxHash,
          userOpHash,
          status: userOperationResult.status
        },
        { status: 500 }
      );
    }

  } catch (error) {
    console.error("Error testing CDP smart account:", error);
    return NextResponse.json(
      { 
        error: "Failed to test CDP smart account",
        details: error instanceof Error ? error.message : String(error)
      },
      { status: 500 }
    );
  }
} 
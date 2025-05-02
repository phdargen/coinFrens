import { NextResponse } from "next/server";
import { z } from "zod";
import { generateObject, experimental_generateImage as generateImage } from "ai";
import { openai } from "@ai-sdk/openai";
import { getSession, updateSessionStatus, updateSessionMetadata } from "@/lib/session-client";
import { CoinMetadata, Participant } from "@/lib/types";
import { createPublicClient, http, createWalletClient, parseEther, Address } from 'viem';
import { base, baseSepolia } from 'viem/chains';
import { mnemonicToAccount } from 'viem/accounts';
import { createCoin, validateMetadataJSON, validateMetadataURIContent } from '@zoralabs/coins-sdk';
import { generateZoraTokenUri } from '@/lib/pinata';

// Force dynamic rendering for this route
export const dynamic = 'force-dynamic';

/**
 * Verifies that IPFS content is accessible through public gateways
 * @param ipfsHash - The IPFS hash to verify
 * @param maxRetries - Maximum number of retries
 * @param retryDelay - Delay between retries in ms
 * @returns True if content is accessible, false otherwise
 */
async function verifyIpfsContentAccessible(
  ipfsHash: string,
  maxRetries = 5,
  retryDelay = 3000
): Promise<boolean> {
  // Clean the hash if it includes ipfs:// prefix
  const hash = ipfsHash.replace('ipfs://', '');
  
  // Try multiple gateways for better reliability
  const gateways = [
    'https://magic.decentralized-content.com/ipfs/',
    'https://ipfs.io/ipfs/',
    'https://gateway.pinata.cloud/ipfs/',
    'https://cloudflare-ipfs.com/ipfs/',
    'https://dweb.link/ipfs/',
  ];
  
  const checkAccessibility = async (): Promise<boolean> => {
    for (const gateway of gateways) {
      try {
        const response = await fetch(`${gateway}${hash}`);
        if (response.ok) {
          console.log(`IPFS content accessible via gateway: ${gateway}`);
          return true;
        }
      } catch (error) {
        console.warn(`Error checking gateway ${gateway} for ${hash}:`, error);
      }
    }
    return false;
  };
  
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    const isAccessible = await checkAccessibility();
    
    if (isAccessible) {
      console.log(`IPFS content ${hash} is accessible via public gateway after ${attempt + 1} attempts`);
      return true;
    }
    
    console.log(`IPFS content ${hash} not yet accessible, retrying in ${retryDelay}ms (${attempt + 1}/${maxRetries})`);
    
    if (attempt < maxRetries - 1) {
      await new Promise(resolve => setTimeout(resolve, retryDelay));
    }
  }
  
  console.error(`IPFS content ${hash} not accessible via public gateway after ${maxRetries} attempts`);
  return false;
}

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

    // Check if the session is ready for generation
    const participantCount = Object.keys(session.participants || {}).length;
    if (participantCount < session.maxParticipants) {
      return NextResponse.json(
        { error: "Session is not full yet" },
        { status: 400 }
      );
    }

    if (session.status === "complete") {
      return NextResponse.json(
        { error: "Session already has metadata" },
        { status: 400 }
      );
    }

    // Update session status to generating
    //await updateSessionStatus(sessionId, "generating");

    // Combine all prompts from participants
    const combinedPrompt = Object.values(session.participants)
      .map((participant: Participant) => participant.prompt)
      .join(" | ");

    console.log("Generating coin metadata using prompts:", combinedPrompt);

    // Define the coin metadata schema
    const coinMetadataSchema = z.object({
      name: z.string().describe("The name of the coin"),
      symbol: z.string().describe("The trading symbol for the coin (3-5 characters)"),
      description: z.string().describe("A short description of the coin"),
    //   imageUrl: z.string().describe("URL to the coin's image")
    });

    // Generate coin metadata using AI
    const aiResult = await generateObject({
      model: openai("gpt-4o-mini"),
      schema: coinMetadataSchema,
      prompt: `Create a zora meme coin based on the following combined prompts from multiple users: "${combinedPrompt}"

      Generate a creative and interesting:
      1. Name for the coin (should be catchy and relevant)
      2. Symbol for the coin (3-5 uppercase letters, no spaces)
      3. Description explaining the coin's concept (1-2 sentences)

      The name and description should reflect the themes or ideas in the combined prompts.
      Be creative and fun with the coin concept!
      Keep descrpition strictly about the combined user prompts, do not mention words like coin, meme, crypto, etc or introduce this as a coin, token. `,
    });

    // Log the raw result to understand its structure
    console.log("Raw AI result:", JSON.stringify(aiResult, null, 2));
    
    // The actual data is nested inside the 'object' property
    const resultData = aiResult.object || {};

    // Create the metadata with fallbacks
    const coinMetadata: CoinMetadata = {
      name: typeof resultData.name === 'string' ? resultData.name : "Unnamed Coin",
      symbol: typeof resultData.symbol === 'string' ? resultData.symbol : "COIN",
      description: typeof resultData.description === 'string' 
        ? `${resultData.description}\nCoinJoined by ${Object.keys(session.participants || {})
            .map(fid => `@${session.participants[fid].username || fid}`)
            .join(', ')}`
        : "A community-generated cryptocurrency",
      imageUrl: `https://api.dicebear.com/7.x/identicon/svg?seed=${typeof resultData.symbol === 'string' ? resultData.symbol : "COIN"}`
    };

    // Generate an AI image based on the combined prompt and metadata
    console.log("Generating AI image for the coin...");
    const imagePrompt = `Create a visually appealing image for ${coinMetadata.name} (${coinMetadata.symbol}). ${coinMetadata.description}. Based on these themes: ${combinedPrompt}. The image should have vibrant colors, be iconic, and represent a meme coin. Make it memorable and shareable. No text in the image.`;
    
    const imageResult = await generateImage({
      model: openai.image("dall-e-3"),
      prompt: imagePrompt,
      //size: "1024x1024",
    });
    
    console.log("AI image generated successfully");
    
    // Use the base64 image data directly
    const base64ImageData = imageResult.image.base64;
    const fileName = `coin-${sessionId}.png`;
    
    // Log information about the image data
    console.log(`Generated image data: ${base64ImageData ? "present" : "missing"}, length: ${base64ImageData?.length || 0}`);
    console.log(`Image data starts with: ${base64ImageData?.substring(0, 50)}...`);

    // Update imageUrl to use fileName
    coinMetadata.imageUrl = fileName;
    
    console.log("Final coin metadata to save:", coinMetadata);

    // Update session with the generated metadata 
    await updateSessionMetadata(sessionId, coinMetadata);
    
    console.log("Session after metadata update:", await getSession(sessionId));
    
    // Create the coin with Zora SDK
    const mnemonic = process.env.MNEMONIC_PHRASE;
    const pinataJwt = process.env.PINATA_JWT;
    
    if (!mnemonic) {
      throw new Error("MNEMONIC_PHRASE is not set in environment variables");
    }
    
    if (!pinataJwt) {
      throw new Error("PINATA_JWT is not set in environment variables");
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
    
    // Generate token URI using Pinata IPFS with base64 data directly
    console.log("Generating Zora token URI with Pinata IPFS...");
    const zoraUriResult = await generateZoraTokenUri({
      name: coinMetadata.name,
      symbol: coinMetadata.symbol,
      description: coinMetadata.description,
      base64Image: base64ImageData,
      fileName: fileName,
      mimeType: "image/png",
      pinataJwt
    });
    
    console.log("Zora token URI generated:", zoraUriResult);

    // Add delay to ensure IPFS content propagation
    console.log("Waiting for IPFS content to propagate...");
    await new Promise(resolve => setTimeout(resolve, 10000)); // 15 second delay
    
    // Verify metadata is accessible through a public gateway
    // const metadataAccessible = await verifyIpfsContentAccessible(zoraUriResult.metadataHash);
    // const imageAccessible = await verifyIpfsContentAccessible(zoraUriResult.imageHash);
    
    // if (!metadataAccessible || !imageAccessible) {
    //   console.error("IPFS content not accessible through public gateway");
    //   return NextResponse.json(
    //     { error: "IPFS content not accessible, please try again later" },
    //     { status: 500 }
    //   );
    // }
    
    // console.log("IPFS content verified accessible via public gateway");
    
    // Validate the metadata using Zora SDK validation functions
    // console.log("Validating metadata JSON and URI content...");
    
    // try {
    //   // Validate metadata structure
    //   validateMetadataJSON({
    //     name: coinMetadata.name,
    //     description: coinMetadata.description,
    //     image: `ipfs://${zoraUriResult.imageHash}`
    //   });
      
    //   // Validate the URI content
    //   const isUriValid = await validateMetadataURIContent(zoraUriResult.uri as any);
    //   console.log("Metadata URI validation successful:", isUriValid);
    // } catch (error) {
    //   console.error("Metadata validation failed:", error);
    //   return NextResponse.json(
    //     { error: "Metadata validation failed, please try again" },
    //     { status: 500 }
    //   );
    // }
    
    // Find creator address from participants
    const creatorParticipant = session.participants?.[session.creatorFid];
    const creatorAddress = creatorParticipant?.address;
    
    console.log(`Setting payout to creator: ${session.creatorFid}, address: ${creatorAddress || 'not found, using default'}`);
    
    // Define coin parameters
    const coinParams = {
      name: coinMetadata.name,
      symbol: coinMetadata.symbol,
      uri: zoraUriResult.uri.replace('ipfs://', 'https://ipfs.io/ipfs/'),
      payoutRecipient: account.address as Address,
      platformReferrer: account.address as Address,
      description: coinMetadata.description,
      initialPurchaseWei: BigInt(0) // No initial purchase
    };

    // Create the coin with retry logic
    console.log("Creating coin with Zora SDK...");
    
    const maxRetries = 5;
    const retryDelay = 10000; // 10 seconds between retries
    let lastError: any = null;
    let coinCreationResult;
    
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        console.log(`Attempting to create coin (attempt ${attempt}/${maxRetries})...`);
        
        if (attempt > 1) {
          console.log(`Waiting ${retryDelay/1000} seconds before retry...`);
          await new Promise(resolve => setTimeout(resolve, retryDelay));
        }
        
        // Create the coin
        coinCreationResult = await createCoin(coinParams, walletClient, publicClient);
        console.log("Coin created successfully:", coinCreationResult);
        break; // Success, exit the loop
      } catch (error: any) {
        console.error(`Error on attempt ${attempt}:`, error);
        lastError = error;
        
        // Check if error is related to metadata fetch
        const errorMessage = error instanceof Error ? error.message : String(error);
        if (!errorMessage.includes("Metadata fetch failed")) {
          // If it's not a metadata fetch issue, don't retry
          throw error;
        }
        
        // If this was the last attempt, throw the error
        if (attempt === maxRetries) {
          throw error;
        }
      }
    }
    
    if (!coinCreationResult) {
      throw lastError || new Error("Failed to create coin after multiple retries");
    }
    
    // Update session with coin address
    const status = coinCreationResult.receipt.status;
    const coinAddress = coinCreationResult.address;
    const txHash = coinCreationResult.hash;
    const deployment = coinCreationResult.deployment;

    // Distribute tokens to participants
    if (status === "success" && session.participants) {
      try {
        console.log("Distributing tokens to participants...");
        const participants = Object.values(session.participants);
        const participantAddresses = participants
          .filter((p: Participant) => p.address)
          .map((p: Participant) => p.address as Address);
        
        if (participantAddresses.length > 0) {
          // Define ERC20 ABI for token transfers
          const erc20Abi = [
            {
              "inputs": [
                {"name": "to", "type": "address"},
                {"name": "amount", "type": "uint256"}
              ],
              "name": "transfer",
              "outputs": [{"name": "", "type": "bool"}],
              "stateMutability": "nonpayable",
              "type": "function"
            },
            {
              "inputs": [{"name": "account", "type": "address"}],
              "name": "balanceOf",
              "outputs": [{"name": "", "type": "uint256"}],
              "stateMutability": "view",
              "type": "function"
            }
          ] as const;
          
          // Check account balance
          const balance = await publicClient.readContract({
            address: coinAddress as Address,
            abi: erc20Abi,
            functionName: 'balanceOf',
            args: [account.address as Address]
          });
          
          console.log(`Account balance: ${balance} tokens`);
          
          // Reserve 10% for the deployer account
          const reserveAmount = balance / BigInt(10); // 10% of the total
          const distributionAmount = balance - reserveAmount;
          
          console.log(`Reserving ${reserveAmount} tokens (10%) for the deployer account`);
          console.log(`Distributing ${distributionAmount} tokens (90%) to participants`);
          
          // Calculate amount per participant
          const amountPerParticipant = distributionAmount / BigInt(participantAddresses.length);
          console.log(`Distributing ${amountPerParticipant} tokens to each of ${participantAddresses.length} participants`);
          
          // Transfer tokens to each participant
          for (let i = 0; i < participantAddresses.length; i++) {
            const participantAddress = participantAddresses[i];
            console.log(`Transferring tokens to ${participantAddress}...`);
            
            try {
              // Send transaction with incremental gas price for each subsequent transfer
              const hash = await walletClient.writeContract({
                address: coinAddress as Address,
                abi: erc20Abi,
                functionName: 'transfer',
                args: [participantAddress, amountPerParticipant],
                // Add a small gas price increase for each subsequent transaction
                gas: BigInt(100000 + (i * 5000))
              });
              
              console.log(`Token transfer submitted. Transaction hash: ${hash}`);
              
              // Wait for transaction to be mined before proceeding to next transfer
              console.log('Waiting for transaction confirmation...');
              const receipt = await publicClient.waitForTransactionReceipt({ hash });
              console.log(`Transaction confirmed with status: ${receipt.status}`);
            } catch (error) {
              console.error(`Error transferring tokens to ${participantAddress}:`, error);
              // Continue with next participant even if current transfer fails
            }
          }
          
          console.log("Token distribution completed successfully");
        } else {
          console.log("No valid participant addresses found for token distribution");
        }
      } catch (error) {
        console.error("Error distributing tokens to participants:", error);
        // Continue with the process even if token distribution fails
      }
    }

    await updateSessionMetadata(sessionId, {
      ...coinMetadata,
      coinAddress,
      txHash,
      deployment,
      ipfsImageUri: `ipfs://${zoraUriResult.imageHash}`,
      ipfsMetadataUri: zoraUriResult.uri
    });
    
    if(status === "success") await updateSessionStatus(sessionId, "complete");

    return NextResponse.json({ 
      success: true, 
      sessionId,
      metadata: {
        ...coinMetadata,
        coinAddress,
        ipfsImageUri: `ipfs://${zoraUriResult.imageHash}`,
        ipfsMetadataUri: zoraUriResult.uri
      }
    });
  } catch (error) {
    console.error("Error generating coin metadata:", error);
    return NextResponse.json(
      { error: "Failed to generate coin metadata" },
      { status: 500 }
    );
  }
} 
import { z } from "zod";
import { generateObject, experimental_generateImage as generateImage } from "ai";
import { openai } from "@ai-sdk/openai";
import { CoinMetadata, Participant } from "./types";
import { generateZoraTokenUri } from "./pinata";

export interface MetadataGenerationParams {
  participants: { [fid: string]: Participant };
  sessionId: string;
  pinataJwt: string;
}

export interface GeneratedMetadata extends CoinMetadata {
  base64ImageData: string;
  fileName: string;
  zoraTokenUri: string;
  ipfsImageHash: string;
}

export async function generateCoinMetadata({
  participants,
  sessionId,
  pinataJwt
}: MetadataGenerationParams): Promise<GeneratedMetadata> {
  // Combine all prompts from participants
  const combinedPrompt = Object.values(participants)
    .map((participant: Participant) => participant.prompt)
    .join(" | ");

  console.log("Generating coin metadata using prompts:", combinedPrompt);

  // Define the coin metadata schema
  const coinMetadataSchema = z.object({
    name: z.string().describe("The name of the coin"),
    symbol: z.string().describe("The trading symbol for the coin (3-5 characters)"),
    description: z.string().describe("A short description of the coin"),
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
  const baseMetadata: CoinMetadata = {
    name: typeof resultData.name === 'string' ? resultData.name : "Unnamed Coin",
    symbol: typeof resultData.symbol === 'string' ? resultData.symbol : "COIN",
    description: typeof resultData.description === 'string' 
      ? `${resultData.description}\nCoinJoined by ${Object.keys(participants)
          .map(fid => `@${participants[fid].username || fid}`)
          .join(', ')}`
      : "A community-generated cryptocurrency",
    imageUrl: `https://api.dicebear.com/7.x/identicon/svg?seed=${typeof resultData.symbol === 'string' ? resultData.symbol : "COIN"}`
  };

  // Generate an AI image based on the combined prompt and metadata
  console.log("Generating AI image for the coin...");
  const imagePrompt = `Create a visually appealing image for ${baseMetadata.name} (${baseMetadata.symbol}). ${baseMetadata.description}. Based on these themes: ${combinedPrompt}. The image should have vibrant colors, be iconic, and represent a meme coin. Make it memorable and shareable. No text in the image.`;
  
  const imageResult = await generateImage({
    model: openai.image("dall-e-3"),
    prompt: imagePrompt,
  });
  
  console.log("AI image generated successfully");
  
  // Use the base64 image data directly
  const base64ImageData = imageResult.image.base64;
  const fileName = `coin-${sessionId}.png`;
  
  // Log information about the image data
  console.log(`Generated image data: ${base64ImageData ? "present" : "missing"}, length: ${base64ImageData?.length || 0}`);
  console.log(`Image data starts with: ${base64ImageData?.substring(0, 50)}...`);

  // Update imageUrl to use fileName
  const coinMetadata = {
    ...baseMetadata,
    imageUrl: fileName
  };
  
  console.log("Final coin metadata to save:", coinMetadata);
  
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
  console.log("Waiting for IPFS content to propagation...");
  await new Promise(resolve => setTimeout(resolve, 10000)); // 10 second delay

  return {
    ...coinMetadata,
    base64ImageData,
    fileName,
    zoraTokenUri: zoraUriResult.uri,
    ipfsImageHash: zoraUriResult.imageHash,
    ipfsImageUri: `ipfs://${zoraUriResult.imageHash}`,
    ipfsMetadataUri: zoraUriResult.uri
  };
} 
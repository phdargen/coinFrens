import { z } from "zod";
import { generateObject } from "ai";
import { google } from '@ai-sdk/google';
import OpenAI, { toFile } from "openai";
import fs from "fs";
import path from "path";
import sharp from "sharp";
import { CoinMetadata, Participant, CoinSession } from "./types";
import { generateZoraTokenUri } from "./pinata";

export interface MetadataGenerationParams {
  participants: { [fid: string]: Participant };
  sessionId: string;
  pinataJwt: string;
  session: CoinSession; // Full session object to access additional settings
}

export interface GeneratedMetadata extends CoinMetadata {
  fileName: string;
  zoraTokenUri: string;
  ipfsImageHash: string;
}

const openaiClient = new OpenAI({ 
  apiKey: process.env.OPENAI_API_KEY 
});

// Helper function to detect image format from buffer
function detectImageFormat(buffer: ArrayBuffer): string {
  const uint8Array = new Uint8Array(buffer);
  
  // Check magic bytes for different formats
  if (uint8Array[0] === 0x89 && uint8Array[1] === 0x50 && uint8Array[2] === 0x4E && uint8Array[3] === 0x47) {
    return 'png';
  }
  if (uint8Array[0] === 0xFF && uint8Array[1] === 0xD8 && uint8Array[2] === 0xFF) {
    return 'jpg';
  }
  if (uint8Array[0] === 0x52 && uint8Array[1] === 0x49 && uint8Array[2] === 0x46 && uint8Array[3] === 0x46) {
    return 'webp';
  }
  if (uint8Array[0] === 0x47 && uint8Array[1] === 0x49 && uint8Array[2] === 0x46) {
    return 'gif';
  }
  
  return 'unknown';
}

// Helper function to process image and convert to supported format
async function processImageForOpenAI(buffer: ArrayBuffer, originalFormat: string, sessionId: string, index: number): Promise<{ buffer: Buffer; format: string; mimeType: string }> {
  const inputBuffer = Buffer.from(buffer);
  
  if (originalFormat === 'gif') {
    console.log('Processing GIF: extracting first frame...');
    // Extract first frame from GIF and convert to PNG
    const processedBuffer = await sharp(inputBuffer, { animated: false })
      .png()
      .toBuffer();
    return {
      buffer: processedBuffer,
      format: 'png',
      mimeType: 'image/png'
    };
  }
  
  if (originalFormat === 'webp') {
    console.log('Processing WebP: keeping original format...');
    return {
      buffer: inputBuffer,
      format: 'webp',
      mimeType: 'image/webp'
    };
  }
  
  if (originalFormat === 'png' || originalFormat === 'jpg') {
    console.log(`Processing ${originalFormat.toUpperCase()}: keeping original format...`);
    const mimeType = originalFormat === 'png' ? 'image/png' : 'image/jpeg';
    return {
      buffer: inputBuffer,
      format: originalFormat,
      mimeType
    };
  }
  
  // For unknown formats, try to convert to PNG
  console.log('Unknown format detected, converting to PNG...');
  const processedBuffer = await sharp(inputBuffer)
    .png()
    .toBuffer();
  return {
    buffer: processedBuffer,
    format: 'png',
    mimeType: 'image/png'
  };
}

export async function generateCoinMetadata({
  participants,
  sessionId,
  pinataJwt,
  session
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

  // Generate coin metadata using Google Gemini
  const aiResult = await generateObject({
    model: google('gemini-2.0-flash'),
    schema: coinMetadataSchema,
    prompt: `Create a zora meme coin based on the following combined prompts from multiple users: "${combinedPrompt}"

    Generate a creative and interesting:
    1. Name for the coin (should be catchy and relevant)
    2. Symbol for the coin (3-5 uppercase letters, no spaces)
    3. Description explaining the coin's concept (1-2 sentences)

    The name and description should reflect the themes or ideas in the combined prompts.
    Be creative and fun with the coin concept!
    Keep description strictly about the combined user prompts, do not mention words like coin, meme, crypto, etc or introduce this as a coin, token.`,
  });

  // Log the raw result to understand its structure
  console.log("Raw AI result:", JSON.stringify(aiResult, null, 2));
  
  // The actual data is nested inside the 'object' property
  const resultData = aiResult.object;

  // Validate that AI returned all required fields
  if (!resultData || typeof resultData.name !== 'string' || typeof resultData.symbol !== 'string' || typeof resultData.description !== 'string') {
    throw new Error("AI failed to generate proper coin metadata");
  }

  // Create the metadata without fallbacks
  const baseMetadata: CoinMetadata = {
    name: resultData.name,
    symbol: resultData.symbol,
    description: `${resultData.description}\nCoinJoined by ${Object.keys(participants)
        .map(fid => `@${participants[fid].username || fid}`)
        .join(', ')}`,
    imageUrl: "" // Will be set after image generation
  };

  // Prepare image generation prompt with style and PFP considerations
  let imagePrompt = `Create a visually appealing image for ${baseMetadata.name} (${baseMetadata.symbol}). ${baseMetadata.description}. Based on these themes: ${combinedPrompt}.`;
  
  // Add style if specified and not "None"
  if (session.style && session.style !== "None" && session.style !== "Custom") {
    imagePrompt += ` Style: ${session.style}.`;
  }
  
  // Add PFP context if enabled
  if (session.addPfps) {
    const pfpUsers = Object.values(participants)
      .filter(p => p.pfpUrl)
      .map(p => p.username || p.fid)
    
    if (pfpUsers.length > 0) {
      imagePrompt += ` Include visual elements that represent the community members: ${pfpUsers.join(", ")}.`;
    }
  }
  
  imagePrompt += " The image should have vibrant colors, be iconic, and represent a meme coin. Make it memorable and shareable. No text in the image.";

  console.log("Final image prompt:", imagePrompt);

  // Download PFP images if addPfps is enabled
  const pfpImages = [];
  if (session.addPfps) {
    const participantsWithPfps = Object.values(participants).filter(p => p.pfpUrl);
    
    if (participantsWithPfps.length > 0) {
      console.log(`Downloading ${participantsWithPfps.length} PFP images...`);
      
      for (let i = 0; i < participantsWithPfps.length; i++) {
        const participant = participantsWithPfps[i];
        try {
          if (!participant.pfpUrl) continue;
          
          const pfpResponse = await fetch(participant.pfpUrl);
          if (pfpResponse.ok) {
            // Download the image
            const buffer = await pfpResponse.arrayBuffer();
            
            // Detect the original format
            const originalFormat = detectImageFormat(buffer);
            console.log(`PFP ${i}: detected format ${originalFormat} for ${participant.username || participant.fid}`);
            
            // Process the image (extract GIF frame, convert formats, etc.)
            const { buffer: processedBuffer, format: finalFormat, mimeType } = await processImageForOpenAI(
              buffer, 
              originalFormat, 
              sessionId, 
              i
            );
            
            // Save the processed image locally
            const pfpFileName = `pfp-${sessionId}-${i}-${Date.now()}.${finalFormat}`;
            const pfpFilePath = path.join(process.cwd(), pfpFileName);
            fs.writeFileSync(pfpFilePath, processedBuffer);
            console.log(`PFP image saved as ${pfpFileName} (${originalFormat} → ${finalFormat})`);
            
            // Convert to File object for OpenAI
            const pfpFile = await toFile(fs.createReadStream(pfpFilePath), pfpFileName, {
              type: mimeType,
            });
            
            pfpImages.push({ file: pfpFile, filePath: pfpFilePath });
          }
        } catch (error) {
          console.error(`Failed to process PFP for ${participant.username || participant.fid}:`, error);
        }
      }
    }
  }

  // Use OpenAI to edit/create image with PFPs
  console.log(`Creating image with ${pfpImages.length} PFP images using OpenAI ${pfpImages.length > 0 ? 'edit' : 'generate'}...`);
  
  const startTime = Date.now();
  let response;
  if (pfpImages.length > 0) {
    // Use edit API when we have PFP images to incorporate
    response = await openaiClient.images.edit({
      model: "gpt-image-1",
      image: pfpImages.map(img => img.file),
      prompt: imagePrompt + " Incorporate the attached images if suitable but do not use them repetitively.",
      quality: "low",
      n: 1,
      size: "1024x1024"
    });
  } else {
    // Use generate API when no PFP images
    response = await openaiClient.images.generate({
      model: "gpt-image-1",
      prompt: imagePrompt,
      quality: "low",
      moderation: "low",
      n: 1,
      size: "1024x1024"
    });
  }
  const endTime = Date.now();
  const durationSeconds = ((endTime - startTime) / 1000).toFixed(2);
  console.log(`OpenAI API call completed in ${durationSeconds} seconds`);
  
  // Clean up temporary PFP files
  pfpImages.forEach(img => {
    try {
      fs.unlinkSync(img.filePath);
      console.log(`Temporary PFP file ${path.basename(img.filePath)} cleaned up`);
    } catch (error) {
      console.error(`Failed to clean up ${img.filePath}:`, error);
    }
  });
  
  if (!response.data || response.data.length === 0) {
    throw new Error("No image generated from OpenAI");
  }

  // Handle both URL and base64 responses
  let base64ImageData: string;
  const imageData = response.data[0];
  
  if (imageData.b64_json) {
    // gpt-image-1 returns base64 data directly
    base64ImageData = imageData.b64_json;
    console.log("AI image created successfully using base64 response");
  } else if (imageData.url) {
    // DALL-E models return URLs that need to be downloaded
    console.log("AI image created successfully, downloading from URL");
    const imageResponse = await fetch(imageData.url);
    if (!imageResponse.ok) {
      throw new Error(`Failed to download generated image: ${imageResponse.status}`);
    }
    const imageBuffer = await imageResponse.arrayBuffer();
    base64ImageData = Buffer.from(imageBuffer).toString('base64');
  } else {
    throw new Error("No image data returned from OpenAI");
  }

  const fileName = `coin-${sessionId}.png`;
  
  // Log information about the image data
  console.log(`Generated image data: ${base64ImageData ? "present" : "missing"}, length: ${base64ImageData?.length || 0}`);

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

  return {
    ...coinMetadata,
    fileName,
    zoraTokenUri: zoraUriResult.uri,
    ipfsImageHash: zoraUriResult.imageHash,
    ipfsImageUri: `ipfs://${zoraUriResult.imageHash}`,
    ipfsMetadataUri: zoraUriResult.uri
  };
} 
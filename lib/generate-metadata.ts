import { CoinMetadata, CoinSession } from "./types";
import { updateSessionMetadata, updateSessionStatus } from "./session-client";

// This is a placeholder for the actual OpenAI API integration
// In a real implementation, you would use the OpenAI API to generate the metadata
async function generateMetadataWithAI(combinedPrompt: string): Promise<CoinMetadata> {
  console.log("Generating metadata with prompt:", combinedPrompt);
  
  // Simulate AI processing time
  await new Promise(resolve => setTimeout(resolve, 2000));
  
  // For demo purposes, generate a random coin name based on the prompt words
  const words = combinedPrompt
    .split(" ")
    .filter(word => word.length > 3)
    .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase());
  
  const randomWords = [];
  for (let i = 0; i < 2; i++) {
    const randomIndex = Math.floor(Math.random() * words.length);
    if (words[randomIndex]) {
      randomWords.push(words[randomIndex]);
    }
  }
  
  const name = randomWords.join(" ") || "CoinFren";
  const symbol = name.replace(/[^A-Z]/g, "").substring(0, 4) || "COIN";
  
  return {
    name,
    symbol,
    description: `A collaborative coin created with the prompts: ${combinedPrompt}`,
    imageUrl: `https://source.boringavatars.com/beam/120/${name}?colors=264653,2a9d8f,e9c46a,f4a261,e76f51`,
  };
}

export async function processCompletedSession(sessionId: string): Promise<CoinSession | null> {
  // Update the session status to generating
  const updatedSession = await updateSessionStatus(sessionId, "generating");
  if (!updatedSession) {
    console.error("Failed to update session status");
    return null;
  }
  
  // Combine all the prompts
  const prompts = Object.values(updatedSession.participants).map(participant => participant.prompt);
  const combinedPrompt = prompts.join(" ");
  
  try {
    // Generate metadata using AI
    const metadata = await generateMetadataWithAI(combinedPrompt);
    
    // Update the session with the generated metadata
    const sessionWithMetadata = await updateSessionMetadata(sessionId, metadata);
    
    if (sessionWithMetadata) {
      // Mark the session as complete
      return await updateSessionStatus(sessionId, "complete");
    }
    
    return null;
  } catch (error) {
    console.error("Error generating metadata:", error);
    return null;
  }
} 
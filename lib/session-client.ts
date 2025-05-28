import { redis } from "./redis";
import { CoinSession, Participant } from "./types";
import { nanoid } from "nanoid";

const SESSION_KEY_PREFIX = "coin-session:";
const ACTIVE_SESSIONS_KEY = "active-sessions";

export async function createSession(
  creatorFid: string, 
  creatorName?: string, 
  maxParticipants: number = 4,
  prompt?: string,
  address?: string,
  pfpUrl?: string,
  addPfps?: boolean,
  style?: string,
  allowedToJoin?: "all" | "followers" | "following" | "frens",
  minTalentScore?: number | null
): Promise<CoinSession | null> {
  if (!redis) {
    console.error("Redis client not available. Check your Redis configuration.");
    return null;
  }

  try {
    const sessionId = nanoid(10);
    const session: CoinSession = {
      id: sessionId,
      creatorFid,
      creatorName,
      createdAt: Date.now(),
      participants: {},
      maxParticipants,
      status: "pending",
      addPfps,
      style,
      allowedToJoin,
      minTalentScore,
    };

    // Add the creator's prompt if provided
    if (prompt) {
      session.participants[creatorFid] = {
        fid: creatorFid,
        username: creatorName,
        address,
        pfpUrl,
        prompt
      };
    }

    // Store the session
    await redis.set(`${SESSION_KEY_PREFIX}${sessionId}`, JSON.stringify(session));
    
    // Add to active sessions
    await redis.sadd(ACTIVE_SESSIONS_KEY, sessionId);
    
    return session;
  } catch (error) {
    console.error("Error creating session in Redis:", error);
    return null;
  }
}

export async function getSession(sessionId: string): Promise<CoinSession | null> {
  if (!redis) return null;
  
  const sessionData = await redis.get(`${SESSION_KEY_PREFIX}${sessionId}`);
  if (!sessionData) return null;
  
  try {
    if (typeof sessionData === 'object') {
      return sessionData as CoinSession;
    } else {
      return JSON.parse(sessionData as string) as CoinSession;
    }
  } catch (error) {
    console.error(`Error parsing session data for ID ${sessionId}:`, error);
    return null;
  }
}

export async function getActiveSessions(): Promise<CoinSession[]> {
  if (!redis) return [];
  
  const sessionIds = await redis.smembers(ACTIVE_SESSIONS_KEY);
  if (!sessionIds.length) return [];
  
  const sessions = await Promise.all(
    sessionIds.map(async (id) => {
      if (!redis) return null;
      const sessionData = await redis.get(`${SESSION_KEY_PREFIX}${id}`);
      if (!sessionData) return null;
      
      // Check if sessionData is already an object or a string that needs parsing
      try {
        if (typeof sessionData === 'object') {
          return sessionData as CoinSession;
        } else {
          return JSON.parse(sessionData as string) as CoinSession;
        }
      } catch (error) {
        console.error(`Error parsing session data for ID ${id}:`, error);
        return null;
      }
    })
  );
  
  return sessions.filter(Boolean) as CoinSession[];
}

export async function addPromptToSession(
  sessionId: string, 
  fid: string, 
  prompt: string,
  username?: string,
  address?: string,
  pfpUrl?: string
): Promise<CoinSession | null> {
  if (!redis) return null;
  
  const session = await getSession(sessionId);
  if (!session) return null;
  
  // Don't allow more participants than the max
  if (Object.keys(session.participants).length >= session.maxParticipants) {
    return null;
  }
  
  // Add the participant with all details
  const participant: Participant = {
    fid,
    username,
    address,
    pfpUrl,
    prompt
  };
  
  session.participants[fid] = participant;
  
  // Update the session
  await redis.set(`${SESSION_KEY_PREFIX}${sessionId}`, JSON.stringify(session));
  
  // If we've reached the max participants, set status to generating
  if (Object.keys(session.participants).length === session.maxParticipants) {
    return updateSessionStatus(sessionId, "generating");
  }
  
  return session;
}

export async function updateSessionStatus(
  sessionId: string,
  status: CoinSession["status"]
): Promise<CoinSession | null> {
  if (!redis) return null;
  
  const session = await getSession(sessionId);
  if (!session) return null;
  
  session.status = status;
  
  // If complete, remove from active sessions
  if (status === "complete") {
    await redis.srem(ACTIVE_SESSIONS_KEY, sessionId);
  }
  
  await redis.set(`${SESSION_KEY_PREFIX}${sessionId}`, JSON.stringify(session));
  return session;
}

export async function updateSessionMetadata(
  sessionId: string,
  metadata: CoinSession["metadata"]
): Promise<CoinSession | null> {
  if (!redis) return null;
  
  const session = await getSession(sessionId);
  if (!session) return null;
  
  session.metadata = metadata;
  
  await redis.set(`${SESSION_KEY_PREFIX}${sessionId}`, JSON.stringify(session));
  return session;
} 
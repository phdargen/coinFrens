import { NextRequest, NextResponse } from "next/server";
import { getActiveSessions, getSession } from "@/lib/session-client";
import { redis } from "@/lib/redis";

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    if (!redis) {
      return NextResponse.json(
        { success: false, error: "Redis connection not available" },
        { status: 500 }
      );
    }

    // Get all session keys to find completed ones
    const pattern = "coin-session:*";
    const keys = await redis.keys(pattern);
    
    const completedSessions = [];
    
    for (const key of keys) {
      const sessionId = key.replace("coin-session:", "");
      const session = await getSession(sessionId);
      
      if (session && session.status === "complete") {
        completedSessions.push(session);
      }
    }
    
    // Sort by creation time, newest first
    completedSessions.sort((a, b) => b.createdAt - a.createdAt);

    return NextResponse.json({ 
      success: true, 
      sessions: completedSessions 
    });
  } catch (error) {
    console.error("Error fetching completed sessions:", error);
    return NextResponse.json(
      { success: false, error: "Failed to fetch completed sessions" },
      { status: 500 }
    );
  }
} 
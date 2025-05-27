import { NextResponse } from "next/server";
import { getPlatformStats } from "@/lib/platform-stats";

// Force dynamic rendering for this route
export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const stats = await getPlatformStats();
    
    return NextResponse.json({
      success: true,
      stats
    });
  } catch (error) {
    console.error("Error retrieving platform stats:", error);
    return NextResponse.json(
      { error: "Failed to retrieve platform stats" },
      { status: 500 }
    );
  }
} 
import { NextResponse } from "next/server";
import { resetPlatformStats } from "@/lib/platform-stats";

// Force dynamic rendering for this route
export const dynamic = 'force-dynamic';

export async function POST() {
  try {
    await resetPlatformStats();
    
    return NextResponse.json({
      success: true,
      message: "Platform stats reset successfully"
    });
  } catch (error) {
    console.error("Error resetting platform stats:", error);
    return NextResponse.json(
      { error: "Failed to reset platform stats" },
      { status: 500 }
    );
  }
} 
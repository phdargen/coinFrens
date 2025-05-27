import { initializePlatformStats } from './platform-stats';

// Initialize platform stats when this module is imported
// This ensures stats are ready when the app starts
let initialized = false;

export async function ensurePlatformStatsInitialized(): Promise<void> {
  if (initialized) {
    return;
  }

  try {
    await initializePlatformStats();
    initialized = true;
  } catch (error) {
    console.error('Failed to initialize platform stats:', error);
  }
}

// Auto-initialize when module is imported
ensurePlatformStatsInitialized(); 
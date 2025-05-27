import { redis } from './redis';
import { PlatformStats } from './types';

const STATS_KEY = 'platform:stats';
const COINS_COUNT_KEY = 'platform:coins:count';
const SESSIONS_COUNT_KEY = 'platform:sessions:count';

export async function incrementCreatedCoins(): Promise<void> {
  if (!redis) {
    console.warn('Redis not available, skipping coin count increment');
    return;
  }

  try {
    await redis.incr(COINS_COUNT_KEY);
    await updateLastUpdated();
    console.log('Incremented created coins count');
  } catch (error) {
    console.error('Error incrementing created coins count:', error);
  }
}

export async function incrementCreatedSessions(): Promise<void> {
  if (!redis) {
    console.warn('Redis not available, skipping session count increment');
    return;
  }

  try {
    await redis.incr(SESSIONS_COUNT_KEY);
    await updateLastUpdated();
    console.log('Incremented created sessions count');
  } catch (error) {
    console.error('Error incrementing created sessions count:', error);
  }
}

export async function getPlatformStats(): Promise<PlatformStats> {
  if (!redis) {
    console.warn('Redis not available, returning default stats');
    return {
      createdCoins: 0,
      createdSessions: 0,
      lastUpdated: Date.now()
    };
  }

  try {
    const [coinsCount, sessionsCount, lastUpdated] = await Promise.all([
      redis.get(COINS_COUNT_KEY),
      redis.get(SESSIONS_COUNT_KEY),
      redis.hget(STATS_KEY, 'lastUpdated')
    ]);

    return {
      createdCoins: Number(coinsCount) || 0,
      createdSessions: Number(sessionsCount) || 0,
      lastUpdated: Number(lastUpdated) || Date.now()
    };
  } catch (error) {
    console.error('Error getting platform stats:', error);
    return {
      createdCoins: 0,
      createdSessions: 0,
      lastUpdated: Date.now()
    };
  }
}

export async function resetPlatformStats(): Promise<void> {
  if (!redis) {
    console.warn('Redis not available, cannot reset stats');
    return;
  }

  try {
    await Promise.all([
      redis.del(COINS_COUNT_KEY),
      redis.del(SESSIONS_COUNT_KEY),
      redis.del(STATS_KEY)
    ]);
    console.log('Platform stats reset successfully');
  } catch (error) {
    console.error('Error resetting platform stats:', error);
  }
}

async function updateLastUpdated(): Promise<void> {
  if (!redis) return;

  try {
    await redis.hset(STATS_KEY, {
      lastUpdated: Date.now()
    });
  } catch (error) {
    console.error('Error updating lastUpdated timestamp:', error);
  }
}

export async function initializePlatformStats(): Promise<void> {
  if (!redis) {
    console.warn('Redis not available, skipping stats initialization');
    return;
  }

  try {
    const stats = await getPlatformStats();
    console.log('Platform stats initialized:', stats);
  } catch (error) {
    console.error('Error initializing platform stats:', error);
  }
} 
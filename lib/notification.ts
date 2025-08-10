import type { MiniAppNotificationDetails } from "@farcaster/miniapp-sdk";
import { redis } from "./redis";

const notificationServiceKey =
  process.env.NEXT_PUBLIC_ONCHAINKIT_PROJECT_NAME ?? "minikit";

function getUserNotificationDetailsKey(fid: number): string {
  return `${notificationServiceKey}:user:${fid}`;
}

export async function getUserNotificationDetails(
  fid: number,
): Promise<MiniAppNotificationDetails | null> {
  if (!redis) {
    return null;
  }

  return await redis.get<MiniAppNotificationDetails>(
    getUserNotificationDetailsKey(fid),
  );
}

export async function setUserNotificationDetails(
  fid: number,
  notificationDetails: MiniAppNotificationDetails,
): Promise<void> {
  if (!redis) {
    return;
  }

  await redis.set(getUserNotificationDetailsKey(fid), notificationDetails);
}

export async function deleteUserNotificationDetails(
  fid: number,
): Promise<void> {
  if (!redis) {
    return;
  }

  await redis.del(getUserNotificationDetailsKey(fid));
}

// Get all FIDs with enabled notifications 
export async function getAllNotificationEnabledUsers(): Promise<number[]> {
  if (!redis) {
    return [];
  }
  
  const pattern = `${notificationServiceKey}:user:*`;
  const keys = await redis.keys(pattern);
  
  // Extract FIDs from keys (format is "...:user:{fid}")
  return keys.map(key => {
    const parts = key.split(':');
    return parseInt(parts[parts.length - 1]);
  }).filter(fid => !isNaN(fid));
}
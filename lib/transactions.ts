import { redis } from "./redis";

export interface CoinTransaction {
  txHash: string;
  timestamp: number;
  coinAddress: string;
  coinName: string;
  coinSymbol: string;
  fid?: string;
  username?: string | null;
  address?: string | null;
  ethAmount: string;
  usdAmount?: string;
  action: "buy" | "sell";
}

// Record transaction for a specific user (FID)
export async function recordUserTransaction(fid: string, transaction: CoinTransaction): Promise<void> {
  if (!redis) {
    console.log("Redis not available, skipping transaction recording");
    return;
  }

  try {
    const key = `user_transactions:${fid}`;
    await redis.lpush(key, JSON.stringify(transaction));
    
    // Keep only the last 100 transactions per user to prevent infinite growth
    await redis.ltrim(key, 0, 99);
    
    console.log(`Recorded transaction for user ${fid}: ${transaction.txHash}`);
  } catch (error) {
    console.error(`Error recording transaction for user ${fid}:`, error);
  }
}

// Record transaction for a specific address
export async function recordAddressTransaction(address: string, transaction: CoinTransaction): Promise<void> {
  if (!redis) {
    console.log("Redis not available, skipping transaction recording");
    return;
  }

  try {
    const key = `address_transactions:${address.toLowerCase()}`;
    await redis.lpush(key, JSON.stringify(transaction));
    
    // Keep only the last 100 transactions per address to prevent infinite growth
    await redis.ltrim(key, 0, 99);
    
    console.log(`Recorded transaction for address ${address}: ${transaction.txHash}`);
  } catch (error) {
    console.error(`Error recording transaction for address ${address}:`, error);
  }
}

// Record transaction in global list
export async function recordAllTransactions(transaction: CoinTransaction): Promise<void> {
  if (!redis) {
    console.log("Redis not available, skipping transaction recording");
    return;
  }

  try {
    const key = "all_transactions";
    await redis.lpush(key, JSON.stringify(transaction));
    
    // Keep only the last 1000 transactions globally to prevent infinite growth
    await redis.ltrim(key, 0, 999);
    
    console.log(`Recorded transaction globally: ${transaction.txHash}`);
  } catch (error) {
    console.error("Error recording transaction globally:", error);
  }
}

// Get transactions for a specific user
export async function getUserTransactions(fid: string): Promise<CoinTransaction[]> {
  if (!redis) {
    console.log("Redis not available, returning empty transactions");
    return [];
  }

  try {
    const key = `user_transactions:${fid}`;
    const transactions = await redis.lrange(key, 0, -1);
    return transactions.map(tx => JSON.parse(tx));
  } catch (error) {
    console.error(`Error getting transactions for user ${fid}:`, error);
    return [];
  }
}

// Get transactions for a specific address
export async function getAddressTransactions(address: string): Promise<CoinTransaction[]> {
  if (!redis) {
    console.log("Redis not available, returning empty transactions");
    return [];
  }

  try {
    const key = `address_transactions:${address.toLowerCase()}`;
    const transactions = await redis.lrange(key, 0, -1);
    return transactions.map(tx => JSON.parse(tx));
  } catch (error) {
    console.error(`Error getting transactions for address ${address}:`, error);
    return [];
  }
}

// Get all transactions
export async function getAllTransactions(limit: number = 100): Promise<CoinTransaction[]> {
  if (!redis) {
    console.log("Redis not available, returning empty transactions");
    return [];
  }

  try {
    const key = "all_transactions";
    const transactions = await redis.lrange(key, 0, limit - 1);
    return transactions.map(tx => JSON.parse(tx));
  } catch (error) {
    console.error("Error getting all transactions:", error);
    return [];
  }
} 
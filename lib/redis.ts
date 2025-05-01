import { Redis } from "@upstash/redis";

// More detailed logging for Redis connection
console.log("Redis environment check:", {
  url: process.env.KV_REST_API_URL ? "Defined" : "Not defined",
  token: process.env.KV_REST_API_TOKEN ? "Defined" : "Not defined",
  env: process.env.NODE_ENV
});

if (!process.env.KV_REST_API_URL || !process.env.KV_REST_API_TOKEN) {
  console.warn(
    "REDIS_URL or REDIS_TOKEN environment variable is not defined, please add to enable background notifications and webhooks.",
  );
}

let redisClient = null;
try {
  if (process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN) {
    redisClient = new Redis({
      url: process.env.KV_REST_API_URL,
      token: process.env.KV_REST_API_TOKEN,
    });
    console.log("Redis client initialized successfully");
  }
} catch (error) {
  console.error("Failed to initialize Redis client:", error);
}

export const redis = redisClient;

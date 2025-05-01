// Test Redis connection
require('dotenv').config();
const { Redis } = require('@upstash/redis');

console.log('Redis URL:', process.env.REDIS_URL);
console.log('Redis Token:', process.env.REDIS_TOKEN ? 'Set (hidden for security)' : 'Not set');

if (!process.env.REDIS_URL || !process.env.REDIS_TOKEN) {
  console.error('Redis configuration is missing!');
  process.exit(1);
}

const redis = new Redis({
  url: process.env.REDIS_URL,
  token: process.env.REDIS_TOKEN,
});

async function testConnection() {
  try {
    // Test connection with a simple ping
    const result = await redis.ping();
    console.log('Redis connection successful:', result);
    
    // Test basic operations
    await redis.set('test-key', 'test-value');
    const value = await redis.get('test-key');
    console.log('Redis operation successful:', value);
    
  } catch (error) {
    console.error('Redis connection error:', error);
  }
}

testConnection(); 
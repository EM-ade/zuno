import Redis from 'ioredis';

// Use a global variable to avoid multiple Redis client instances in development
declare global {
  var redisClient: Redis | undefined;
}

let redis: Redis;

if (process.env.NODE_ENV === 'production') {
  if (!process.env.REDIS_URL) {
    throw new Error('REDIS_URL is not defined in production environment');
  }
  redis = new Redis(process.env.REDIS_URL);
} else {
  // In development, use a global variable to prevent multiple instances
  // from being created on hot reloads.
  if (!global.redisClient) {
    if (!process.env.REDIS_URL) {
      throw new Error('REDIS_URL is not defined in development environment. Please add it to your .env.local file.'); // Changed to throw error
    }
    global.redisClient = new Redis(process.env.REDIS_URL);
    
    global.redisClient.on('connect', () => console.log('Redis Development Client Connected!'));
    global.redisClient.on('error', (err) => console.error('Redis Development Client Error:', err));
  }
  redis = global.redisClient;
}

export { redis };

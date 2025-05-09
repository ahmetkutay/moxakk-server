import { createClient } from 'redis';
import dotenv from 'dotenv';
import logger from '../utils/logger';
import { CustomError, ErrorType } from '../utils/error-handler';

dotenv.config();

// Redis configuration with advanced options
const redisConfig = {
  url: process.env.REDIS_URL || 'redis://localhost:6379',
  password: process.env.REDIS_PASSWORD,
  socket: {
    reconnectStrategy: (retries: number) => {
      const delay = Math.min(retries * 50, 2000);
      logger.info(`Redis reconnecting in ${delay}ms (attempt ${retries})`);
      return delay;
    },
    connectTimeout: 10000, // 10 seconds
    keepAlive: 5000, // Keep-alive every 5 seconds
  },
  // Enable TLS if REDIS_TLS is set to true
  tls: process.env.REDIS_TLS === 'true' ? {} : undefined,
};

// Create Redis client
const redisClient = createClient(redisConfig);

// Handle Redis connection events
redisClient.on('error', (err) => {
  logger.error(`Redis error: ${err.message}`, { error: err });
});

redisClient.on('connect', () => {
  logger.info('Redis client connecting');
});

redisClient.on('ready', () => {
  logger.info('Redis client ready');
});

redisClient.on('reconnecting', () => {
  logger.warn('Redis client reconnecting');
});

redisClient.on('end', () => {
  logger.warn('Redis client connection ended');
});

// Cache TTL settings (in seconds)
export const CACHE_TTL = {
  FOOTBALL_MATCH: 60 * 60 * 6, // 6 hours
  BASKETBALL_MATCH: 60 * 60 * 6, // 6 hours
  WEATHER_DATA: 60 * 30, // 30 minutes
  STANDINGS_DATA: 60 * 60 * 12, // 12 hours
  LINEUPS_DATA: 60 * 60 * 2, // 2 hours
  H2H_DATA: 60 * 60 * 24, // 24 hours
};

// Cache keys helpers
export const getCacheKey = {
  footballMatch: (id: string) => `football:${id}`,
  basketballMatch: (id: string) => `basketball:${id}`,
  weather: (location: string) => `weather:${location}`,
  standings: (league: string) => `standings:${league}`,
  lineups: (matchId: string) => `lineups:${matchId}`,
  h2h: (teams: string) => `h2h:${teams}`,
};

// Scraping rate limiter
export class ScrapingRateLimiter {
  private static instance: ScrapingRateLimiter;
  private hostLimits: Map<string, { count: number; resetTime: number }> = new Map();

  // Default settings: 5 requests every 10 seconds per host
  private maxRequestsPerWindow = 5;
  private windowMs = 10000;

  private constructor() {}

  static getInstance(): ScrapingRateLimiter {
    if (!ScrapingRateLimiter.instance) {
      ScrapingRateLimiter.instance = new ScrapingRateLimiter();
    }
    return ScrapingRateLimiter.instance;
  }

  configure(maxRequests: number, windowMs: number): void {
    this.maxRequestsPerWindow = maxRequests;
    this.windowMs = windowMs;
  }

  async acquireToken(host: string): Promise<void> {
    const now = Date.now();
    const hostLimit = this.hostLimits.get(host);

    if (!hostLimit) {
      // First request to this host
      this.hostLimits.set(host, { count: 1, resetTime: now + this.windowMs });
      return;
    }

    // Check if window has expired and reset if needed
    if (now > hostLimit.resetTime) {
      this.hostLimits.set(host, { count: 1, resetTime: now + this.windowMs });
      return;
    }

    // Check if we've hit the limit
    if (hostLimit.count >= this.maxRequestsPerWindow) {
      const waitTime = hostLimit.resetTime - now;
      logger.warn(`Rate limit reached for ${host}, waiting ${waitTime}ms`);
      await new Promise((resolve) => setTimeout(resolve, waitTime));
      // Recursive call after waiting
      return this.acquireToken(host);
    }

    // Increment the count
    hostLimit.count++;
    this.hostLimits.set(host, hostLimit);
  }
}

const connectDB = async () => {
  try {
    await redisClient.connect();
    logger.info('Redis connected successfully');

    // Configure default values for the rate limiter
    const rateLimiter = ScrapingRateLimiter.getInstance();
    rateLimiter.configure(
      parseInt(process.env.SCRAPING_RATE_LIMIT || '5'),
      parseInt(process.env.SCRAPING_RATE_WINDOW || '10000')
    );

    return true;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    logger.error(`Redis connection error: ${errorMessage}`);
    throw new CustomError('Failed to connect to Redis', ErrorType.DATABASE_ERROR, 500, {
      originalError: error,
    });
  }
};

export default connectDB;
export { redisClient };

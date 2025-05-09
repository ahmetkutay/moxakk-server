import { Request, Response, NextFunction } from 'express';
import logger from './logger';

// Interface for request with API key
interface RequestWithApiKey extends Request {
  apiKey?: string;
}

/**
 * Middleware to validate API key
 * Checks if the request contains a valid API key in the header
 */
export const apiKeyAuth = (req: RequestWithApiKey, res: Response, next: NextFunction) => {
  // Get API key from environment variable
  const validApiKey = process.env.API_KEY;

  if (!validApiKey) {
    logger.error('API_KEY environment variable is not set');
    return res.status(500).json({
      success: false,
      error: 'Server configuration error',
    });
  }

  // Get API key from request header
  const apiKey = req.header('X-API-Key');

  if (!apiKey) {
    logger.warn('API request without API key');
    return res.status(401).json({
      success: false,
      error: 'Unauthorized',
      message: 'API key is required',
    });
  }

  if (apiKey !== validApiKey) {
    logger.warn(`Invalid API key: ${apiKey.substring(0, 5)}...`);
    return res.status(401).json({
      success: false,
      error: 'Unauthorized',
      message: 'Invalid API key',
    });
  }

  // Store API key in request for potential future use
  req.apiKey = apiKey;

  next();
  return;
};

/**
 * Middleware to validate API key for specific routes
 * @param excludedPaths - Array of paths to exclude from API key validation
 */
export const apiKeyAuthWithExclusions = (excludedPaths: string[] = []) => {
  return (req: RequestWithApiKey, res: Response, next: NextFunction) => {
    // Skip authentication for excluded paths
    if (excludedPaths.some(path => req.path.startsWith(path))) {
      return next();
    }
    
    // Apply API key authentication
    return apiKeyAuth(req, res, next);
  };
};
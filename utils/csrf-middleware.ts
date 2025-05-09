import { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';
import logger from './logger';

// Interface for request with CSRF token
interface RequestWithCSRF extends Request {
  csrfToken?: string;
}

/**
 * Generate a CSRF token
 * @returns A random CSRF token
 */
export const generateCSRFToken = (): string => {
  return crypto.randomBytes(32).toString('hex');
};

/**
 * Middleware to protect against CSRF attacks
 * This should be used for all non-GET, non-HEAD requests
 */
export const csrfProtection = (req: RequestWithCSRF, res: Response, next: NextFunction) => {
  // Skip CSRF check for GET, HEAD, and OPTIONS methods as they should be safe
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) {
    return next();
  }

  // Get CSRF token from request header
  const csrfToken = req.header('X-CSRF-Token');

  // Get session token from cookies or headers
  const sessionToken = req.cookies?.sessionToken || req.header('X-Session-Token');

  if (!csrfToken || !sessionToken) {
    logger.warn('CSRF protection: Missing CSRF token or session token');
    return res.status(403).json({
      success: false,
      error: 'Forbidden',
      message: 'CSRF token validation failed',
    });
  }

  // In a real implementation, you would validate the CSRF token against a stored token
  // For this example, we're just checking if the token exists
  // TODO: Implement proper CSRF token validation against stored tokens

  next();
};

/**
 * Middleware to set CSRF token in response
 * This should be used for routes that render forms
 */
export const setCSRFToken = (req: RequestWithCSRF, res: Response, next: NextFunction) => {
  const token = generateCSRFToken();

  // Store the token in the response locals for template rendering
  res.locals.csrfToken = token;

  // Also set it in a cookie for JavaScript access
  res.cookie('XSRF-TOKEN', token, {
    httpOnly: false, // Allow JavaScript access
    secure: process.env.NODE_ENV === 'production', // Secure in production
    sameSite: 'strict',
  });

  next();
};
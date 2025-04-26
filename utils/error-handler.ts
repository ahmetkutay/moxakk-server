import { Request, Response, NextFunction } from 'express';
import logger from './logger';

export enum ErrorType {
  VALIDATION_ERROR = 'VALIDATION_ERROR',
  SCRAPING_ERROR = 'SCRAPING_ERROR',
  API_ERROR = 'API_ERROR',
  DATABASE_ERROR = 'DATABASE_ERROR',
  NETWORK_ERROR = 'NETWORK_ERROR',
  AUTH_ERROR = 'AUTH_ERROR',
  NOT_FOUND = 'NOT_FOUND',
  SERVER_ERROR = 'SERVER_ERROR',
}

export interface AppError extends Error {
  type: ErrorType;
  statusCode: number;
  details?: Record<string, unknown>;
}

export class CustomError extends Error implements AppError {
  type: ErrorType;
  statusCode: number;
  details?: Record<string, unknown>;

  constructor(
    message: string,
    type: ErrorType,
    statusCode: number,
    details?: Record<string, unknown>
  ) {
    super(message);
    this.name = this.constructor.name;
    this.type = type;
    this.statusCode = statusCode;
    this.details = details;
    Error.captureStackTrace(this, this.constructor);
  }

  static validationError(message: string, details?: Record<string, unknown>): CustomError {
    return new CustomError(message, ErrorType.VALIDATION_ERROR, 400, details);
  }

  static scrapingError(message: string, details?: Record<string, unknown>): CustomError {
    return new CustomError(message, ErrorType.SCRAPING_ERROR, 500, details);
  }

  static apiError(message: string, details?: Record<string, unknown>): CustomError {
    return new CustomError(message, ErrorType.API_ERROR, 500, details);
  }

  static databaseError(message: string, details?: Record<string, unknown>): CustomError {
    return new CustomError(message, ErrorType.DATABASE_ERROR, 500, details);
  }

  static networkError(message: string, details?: Record<string, unknown>): CustomError {
    return new CustomError(message, ErrorType.NETWORK_ERROR, 500, details);
  }

  static authError(message: string, details?: Record<string, unknown>): CustomError {
    return new CustomError(message, ErrorType.AUTH_ERROR, 401, details);
  }

  static notFoundError(message: string, details?: Record<string, unknown>): CustomError {
    return new CustomError(message, ErrorType.NOT_FOUND, 404, details);
  }

  static serverError(message: string, details?: Record<string, unknown>): CustomError {
    return new CustomError(message, ErrorType.SERVER_ERROR, 500, details);
  }
}

export const errorHandler = (
  err: Error,
  req: Request,
  res: Response,
  _next: NextFunction
): Response => {
  logger.error(`Error: ${err.message}\nStack: ${err.stack}`);

  // Check if this is our custom error
  if (err instanceof CustomError) {
    return res.status(err.statusCode).json({
      success: false,
      error: {
        type: err.type,
        message: err.message,
        ...(err.details && { details: err.details }),
      },
    });
  }

  // Default error handling for unexpected errors
  return res.status(500).json({
    success: false,
    error: {
      type: ErrorType.SERVER_ERROR,
      message: 'An unexpected error occurred',
    },
  });
};

// Wrapper for async route handlers
export const asyncHandler = <
  T extends (req: Request, res: Response, next: NextFunction) => Promise<unknown>,
>(
  fn: T
) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};

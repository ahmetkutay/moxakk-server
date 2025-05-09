import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import cookieParser from 'cookie-parser';
import { csrfProtection } from '../utils/csrf-middleware';

const ALLOWED_ORIGINS = ['https://moxakk.com'];
const MAX_REQUEST_SIZE = '1mb';

export function setupMiddleware(app: express.Application) {
  // Security headers
  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ['\'self\''],
          scriptSrc: ['\'self\'', ...ALLOWED_ORIGINS],
          styleSrc: ['\'self\'', ...ALLOWED_ORIGINS],
          imgSrc: ['\'self\'', ...ALLOWED_ORIGINS],
          connectSrc: ['\'self\'', ...ALLOWED_ORIGINS],
          fontSrc: ['\'self\'', ...ALLOWED_ORIGINS],
          objectSrc: ['\'none\''],
          mediaSrc: ['\'self\'', ...ALLOWED_ORIGINS],
          frameSrc: ['\'none\''],
          formAction: ['\'self\''],
          baseUri: ['\'self\''],
        },
      },
      crossOriginEmbedderPolicy: true,
      crossOriginOpenerPolicy: true,
      crossOriginResourcePolicy: { policy: 'same-site' },
      dnsPrefetchControl: true,
      frameguard: { action: 'deny' },
      hidePoweredBy: true,
      hsts: {
        maxAge: 15552000, // 180 days in seconds
        includeSubDomains: true,
        preload: true,
      },
      ieNoOpen: true,
      noSniff: true,
      referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
      xssFilter: true,
    })
  );

  // Add Permissions-Policy header manually
  app.use((req, res, next) => {
    res.setHeader(
      'Permissions-Policy',
      'geolocation=(), camera=(), microphone=(), payment=()'
    );
    next();
  });

  // Rate limiting
  app.use(
    rateLimit({
      windowMs: 15 * 60 * 1000,
      max: 100,
      standardHeaders: true,
      legacyHeaders: false,
      message: 'Too many requests from this IP, please try again later.',
    })
  );

  // CORS
  app.use(
    cors({
      origin: ALLOWED_ORIGINS,
      methods: ['GET', 'POST'],
      allowedHeaders: ['Content-Type', 'Authorization', 'X-API-Key', 'X-CSRF-Token', 'X-Session-Token'],
      credentials: true,
      maxAge: 600,
    })
  );

  // Cookie parser
  app.use(cookieParser());

  // CSRF protection
  app.use(csrfProtection);

  // Body parsing
  app.use(express.json({ limit: MAX_REQUEST_SIZE }));
  app.use(express.urlencoded({ extended: true, limit: MAX_REQUEST_SIZE }));
}

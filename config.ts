import * as http from 'http';
import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import rateLimit from 'express-rate-limit';

export function setupMiddleware(app: express.Application) {
    app.use(helmet({
        contentSecurityPolicy: {
            directives: {
                defaultSrc: ["'self'"],
                scriptSrc: ["'self'", "'unsafe-inline'"],
                styleSrc: ["'self'", "'unsafe-inline'"],
                imgSrc: ["'self'", "data:", "https:"],
            },
        },
        referrerPolicy: {
            policy: 'strict-origin-when-cross-origin',
        },
    }));

    // Simplified CORS configuration to allow all origins
    app.use(cors());

    app.use(express.json());

    const limiter = rateLimit({
        windowMs: 15 * 60 * 1000,
        limit: 100,
    });
    app.use(limiter);

    // Add logging middleware
    app.use((req, res, next) => {
        console.log('Received request:', req.method, req.url);
        next();
    });

    // Handle preflight requests
    app.options('*', cors());
}

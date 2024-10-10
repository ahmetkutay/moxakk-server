import * as http from 'http';
import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import { createProxyMiddleware } from 'http-proxy-middleware';

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

    const allowedOrigins = (process.env.ALLOWED_ORIGINS?.split(',') || ['http://localhost:3000']).map(origin => origin.trim());
    allowedOrigins.push('https://moxakk.com');

    app.use(cors({
        origin: ['https://moxakk.com', 'http://localhost:3000', 'http://localhost:3005'], 
        methods: ['GET', 'POST', 'OPTIONS'],
        allowedHeaders: ['Content-Type', 'Authorization'],
        credentials: true,
    }));

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

    // Modify the proxy middleware
    const proxyOptions = {
        target: 'https://omniapotentia.com',
        changeOrigin: true,
        pathRewrite: {
            '^/api': '', // remove /api from the URL
        },
        on: {
            proxyReq: (proxyReq: any, req: any, res: any) => {
                // Log the proxied request for debugging
                console.log('Proxying request to:', proxyReq.path);
            }
        },
        onProxyRes: (proxyRes: any, req: any, res: any) => {
            proxyRes.headers['Access-Control-Allow-Origin'] = 'https://moxakk.com';
            proxyRes.headers['Access-Control-Allow-Methods'] = 'GET, POST, OPTIONS';
        },
        // Increase timeout to handle potential slow responses
        proxyTimeout: 60000, // 60 seconds
        timeout: 60000, // 60 seconds
    } as any;

    app.use('/api', createProxyMiddleware(proxyOptions));

    // Handle preflight requests
    app.options('*', cors());
}

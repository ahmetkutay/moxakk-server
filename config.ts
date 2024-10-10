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
        origin: 'https://moxakk.com',
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
    app.use('/api', createProxyMiddleware({
        target: 'https://omniapotentia.com',
        changeOrigin: true,
        pathRewrite: {
            '^/api': '', // remove /api from the URL
        },
        onProxyReq: (proxyReq: http.ClientRequest, req: express.Request, res: express.Response) => {
            // Log the proxied request for debugging
            console.log('Proxying request to:', proxyReq.path);
        },
        onProxyRes: (proxyRes: http.IncomingMessage, req: express.Request, res: express.Response) => {
            proxyRes.headers['Access-Control-Allow-Origin'] = 'https://moxakk.com';
            proxyRes.headers['Access-Control-Allow-Methods'] = 'GET, POST, OPTIONS';
            proxyRes.headers['Access-Control-Allow-Headers'] = 'Content-Type, Authorization';
            proxyRes.headers['Access-Control-Allow-Credentials'] = 'true';
                
            // Log the proxied response for debugging
            console.log('Proxy response status:', proxyRes.statusCode);
            console.log('Proxy response headers:', proxyRes.headers);
        }
    } as any));
}

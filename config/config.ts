import express from "express";
import helmet from "helmet";
import cors from "cors";
import rateLimit from "express-rate-limit";

export function setupMiddleware(app: express.Application) {
  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          scriptSrc: ["'self'", "https://moxakk.com"],
          styleSrc: ["'self'", "https://moxakk.com"],
          imgSrc: ["'self'", "https://moxakk.com"],
          connectSrc: ["'self'", "https://moxakk.com"],
          fontSrc: ["'self'", "https://moxakk.com"],
          objectSrc: ["'none'"],
          mediaSrc: ["'self'", "https://moxakk.com"],
          frameSrc: ["'none'"],
        },
      },
      referrerPolicy: {
        policy: "strict-origin-when-cross-origin",
      },
      hsts: {
        maxAge: 31536000,
        includeSubDomains: true,
        preload: true,
      },
      noSniff: true,
      xssFilter: true,
    })
  );

  const corsOptions = {
    origin: [
      "https://moxakk.com",
    ],
    methods: ["GET", "POST"],
    allowedHeaders: ["Content-Type", "Authorization"],
    credentials: true,
    maxAge: 600,
  };
  app.use(cors(corsOptions));

  app.use(express.json({ limit: "1mb" }));

  const limiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 100,
    standardHeaders: true,
    legacyHeaders: false,
  });
  app.use(limiter);

  app.use((req, res, next) => {
    next();
  });
  
  app.options("*", cors(corsOptions));

  // Add security headers
  app.use((req, res, next) => {
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("X-Frame-Options", "SAMEORIGIN");
    res.setHeader("X-XSS-Protection", "1; mode=block");
    next();
  });
}

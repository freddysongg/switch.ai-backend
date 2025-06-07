import { NextFunction, Request, Response } from 'express';
import helmet from 'helmet';

/**
 * Content Security Policy (CSP) middleware for SwitchAI backend
 * Provides strict security headers to prevent XSS, clickjacking, and other attacks
 */
export const cspMiddleware = helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],

      scriptSrc: [
        "'self'",
        "'nonce-switchai-script'",
        ...(process.env.NODE_ENV === 'development' ? ["'unsafe-eval'"] : [])
      ],

      styleSrc: ["'self'", "'nonce-switchai-style'", "'unsafe-inline'"],

      imgSrc: ["'self'", 'data:', 'blob:', 'https:'],

      fontSrc: ["'self'", 'data:', 'https:'],

      connectSrc: [
        "'self'",
        'https://generativelanguage.googleapis.com',
        'https://*.supabase.co',
        'wss://*.supabase.co'
      ],

      mediaSrc: ["'self'"],

      objectSrc: ["'none'"],

      baseUri: ["'self'"],

      formAction: ["'self'"],

      frameAncestors: ["'none'"],

      frameSrc: ["'self'"],

      workerSrc: ["'self'", 'blob:'],

      manifestSrc: ["'self'"],

      ...(process.env.NODE_ENV === 'production' && {
        upgradeInsecureRequests: []
      })
    },

    reportOnly: false,

    useDefaults: false
  },

  crossOriginEmbedderPolicy: {
    policy: 'require-corp'
  },

  crossOriginOpenerPolicy: {
    policy: 'same-origin'
  },

  crossOriginResourcePolicy: {
    policy: 'cross-origin'
  },

  dnsPrefetchControl: {
    allow: false
  },

  hidePoweredBy: true,

  hsts: {
    maxAge: 31536000,
    includeSubDomains: true,
    preload: true
  },

  noSniff: true,

  referrerPolicy: {
    policy: 'strict-origin-when-cross-origin'
  },

  xssFilter: true
});

/**
 * Middleware to add CSP nonce to response locals
 * This allows dynamic nonce generation for inline scripts/styles
 */
export const addCSPNonce = (req: Request, res: Response, next: NextFunction) => {
  const nonce = Buffer.from(Math.random().toString()).toString('base64');

  res.locals.cspNonce = nonce;

  res.setHeader('Content-Security-Policy-Nonce', nonce);

  next();
};

/**
 * Development-specific CSP middleware with relaxed policies
 */
export const developmentCSP = helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: [
        "'self'",
        "'unsafe-inline'",
        "'unsafe-eval'",
        'http://localhost:*',
        'ws://localhost:*'
      ],
      styleSrc: ["'self'", "'unsafe-inline'", 'http://localhost:*'],
      imgSrc: ["'self'", 'data:', 'blob:', 'http://localhost:*', 'https:'],
      connectSrc: [
        "'self'",
        'http://localhost:*',
        'ws://localhost:*',
        'wss://localhost:*',
        'https://generativelanguage.googleapis.com',
        'https://*.supabase.co',
        'wss://*.supabase.co'
      ],
      fontSrc: ["'self'", 'data:', 'http://localhost:*', 'https:'],
      mediaSrc: ["'self'", 'http://localhost:*'],
      objectSrc: ["'none'"],
      baseUri: ["'self'"],
      formAction: ["'self'"],
      frameAncestors: ["'none'"],
      frameSrc: ["'self'", 'http://localhost:*'],
      workerSrc: ["'self'", 'blob:', 'http://localhost:*'],
      manifestSrc: ["'self'", 'http://localhost:*']
    },
    reportOnly: false,
    useDefaults: false
  },
  hidePoweredBy: true,
  noSniff: true,
  xssFilter: true
});

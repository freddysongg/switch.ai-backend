import { and, eq, gt, sql } from 'drizzle-orm';
import { NextFunction, Request, Response } from 'express';

import { db } from '../db';
import { rateLimits } from '../db/schema';

// Rate limits for different user types
const LIMITS = {
  authenticated: {
    requests: 50, // requests per time window
    timeWindow: 3600 * 1000, // 1 hour
    burstLimit: 5 // max concurrent requests
  },
  anonymous: {
    requests: 20, // requests per time window
    timeWindow: 3600 * 1000, // 1 hour
    burstLimit: 2 // max concurrent requests
  }
};

// In-memory store for burst control and IP-based rate limiting
const activeBursts = new Map<string, { count: number; timestamp: number }>();
const ipLimits = new Map<string, { count: number; resetAt: number }>();
const burstCleanupInterval = 10000; // 10 seconds

// Cleanup expired records
setInterval(() => {
  const now = Date.now();
  // Clean up bursts
  for (const [key, data] of activeBursts.entries()) {
    if (now - data.timestamp > 30000) {
      activeBursts.delete(key);
    }
  }
  // Clean up IP limits
  for (const [ip, data] of ipLimits.entries()) {
    if (now > data.resetAt) {
      ipLimits.delete(ip);
    }
  }
}, burstCleanupInterval);

// Helper function to check and update burst count
const checkBurst = (key: string, burstLimit: number): boolean => {
  const now = Date.now();
  const current = activeBursts.get(key) || { count: 0, timestamp: now };

  // Reset if expired
  if (now - current.timestamp > 30000) {
    current.count = 1;
    current.timestamp = now;
  } else {
    current.count++;
  }

  activeBursts.set(key, current);
  return current.count <= burstLimit;
};

// Helper function to check IP-based rate limit
const checkIpLimit = (ip: string, limit: number, timeWindow: number): boolean => {
  const now = Date.now();
  const current = ipLimits.get(ip) || { count: 0, resetAt: now + timeWindow };

  // Reset if expired
  if (now > current.resetAt) {
    current.count = 1;
    current.resetAt = now + timeWindow;
  } else {
    current.count++;
  }

  ipLimits.set(ip, current);
  return current.count <= limit;
};

export const rateLimiter = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = req.user?.id;
    const clientIp = req.ip || 'unknown';
    const reqPath = req.path;
    const currentTime = new Date();
    const limits = userId ? LIMITS.authenticated : LIMITS.anonymous;

    // Check burst limit
    const burstKey = userId || clientIp;
    if (!checkBurst(burstKey, limits.burstLimit)) {
      return res.status(429).json({
        error: 'Too many concurrent requests',
        retryAfter: 30
      });
    }

    // For anonymous users, use IP-based rate limiting
    if (!userId) {
      if (!checkIpLimit(clientIp, limits.requests, limits.timeWindow)) {
        const resetTime = ipLimits.get(clientIp)?.resetAt || Date.now() + limits.timeWindow;
        return res.status(429).json({
          error: 'Rate limit exceeded',
          retryAfter: Math.ceil((resetTime - Date.now()) / 1000)
        });
      }
      next();
      return;
    }

    // For authenticated users, use database rate limiting
    const [limit] = await db
      .select()
      .from(rateLimits)
      .where(
        and(
          eq(rateLimits.userId, userId),
          eq(rateLimits.endpoint, reqPath),
          gt(rateLimits.resetAt, currentTime)
        )
      )
      .limit(1);

    if (limit) {
      if (limit.count >= limits.requests) {
        const retryAfter = Math.ceil((limit.resetAt.getTime() - Date.now()) / 1000);
        return res.status(429).json({
          error: 'Rate limit exceeded',
          retryAfter,
          resetAt: limit.resetAt
        });
      }

      // Increment count
      await db
        .update(rateLimits)
        .set({
          count: limit.count + 1,
          updatedAt: currentTime
        })
        .where(eq(rateLimits.id, limit.id));
    } else {
      const resetAt = new Date(currentTime.getTime() + limits.timeWindow);
      await db.insert(rateLimits).values({
        userId,
        endpoint: reqPath,
        count: 1,
        resetAt,
        createdAt: currentTime,
        updatedAt: currentTime
      });
    }

    next();
  } catch (error) {
    console.error('Rate limiter error:', error);
    next(error);
  }
};

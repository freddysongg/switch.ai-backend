import { Router } from 'express';

import { AdminAnalyticsController } from '@/controllers/analytics';
import { AdminRateLimitController } from '@/controllers/rateLimit';

import { adminAuthMiddleware } from '@/middleware/admin';

const router = Router();

router.use(adminAuthMiddleware);

const rateLimitController = new AdminRateLimitController();
router.get('/rate-limits', rateLimitController.listRateLimits.bind(rateLimitController));
router.delete(
  '/rate-limits/:id',
  rateLimitController.deleteRateLimitById.bind(rateLimitController)
);
router.delete(
  '/rate-limits/user/:userId',
  rateLimitController.deleteRateLimitsByUserId.bind(rateLimitController)
);

const analyticsController = new AdminAnalyticsController();
router.get('/analytics-events', analyticsController.listAnalyticsEvents.bind(analyticsController));

export default router;

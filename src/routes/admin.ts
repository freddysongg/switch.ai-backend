import { Router } from 'express';

import { AdminAnalyticsController } from '../controllers/analytics.js';
import { AdminRateLimitController } from '../controllers/rateLimit.js';
import { adminAuthMiddleware } from '../middleware/admin.js';

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

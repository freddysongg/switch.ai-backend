import { Router } from 'express';

import { authMiddleware } from '../middleware/auth';
import chatRouter from './chat';
import conversationRouter from './conversation';
import healthRouter from './health';
import messageRouter from './message';
import userRouter from './user';

const router = Router();

router.use('/health', healthRouter);

router.use(async (req, res, next) => {
  try {
    await authMiddleware(req, res, next);
    // await rateLimiter(req, res, next);
  } catch (error) {
    next(error);
  }
});

router.use('/chat', chatRouter);
router.use('/users', userRouter);
router.use('/conversations', conversationRouter);
router.use('/messages', messageRouter);

export default router;

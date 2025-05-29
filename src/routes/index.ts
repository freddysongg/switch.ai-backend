import { Router } from 'express';

import { authMiddleware } from '../middleware/auth';
import authRouter from './auth';
import chatRouter from './chat';
import conversationRouter from './conversation';
import healthRouter from './health';
import messageRouter from './message';
import userRouter from './user';

const router = Router();

// Public routes
router.use('/health', healthRouter);
router.use('/auth', authRouter);

router.use(authMiddleware);

router.use('/chat', chatRouter);
router.use('/users', userRouter);
router.use('/conversations', conversationRouter);
router.use('/messages', messageRouter);

export default router;

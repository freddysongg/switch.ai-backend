import { Router } from 'express';

import { authMiddleware } from '../middleware/auth.js';
import analysisRouter from './analysisRoutes.js';
import authRouter from './auth.js';
import chatRouter from './chat.js';
import conversationRouter from './conversation.js';
import healthRouter from './health.js';
import messageRouter from './message.js';
import userRouter from './user.js';

const router = Router();

// Public routes
router.use('/health', healthRouter);
router.use('/auth', authRouter);

router.use(authMiddleware);

router.use('/analysis', analysisRouter);
router.use('/chat', chatRouter);
router.use('/users', userRouter);
router.use('/conversations', conversationRouter);
router.use('/messages', messageRouter);

export default router;

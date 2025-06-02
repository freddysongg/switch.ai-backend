import { Router } from 'express';

import { authMiddleware } from '../middleware/auth.js';
import authRouter from './auth.js';
import chatRouter from './chat.js';
import conversationRouter from './conversation.js';
import healthRouter from './health.js';
import messageRouter from './message.js';
import performanceRouter from './performanceRoutes.js';
import userRouter from './user.js';

const router = Router();

// Public routes
router.use('/health', healthRouter);
router.use('/auth', authRouter);

// Performance monitoring routes (can be protected or public based on needs)
router.use('/performance', performanceRouter);

// Protected routes
router.use(authMiddleware);
router.use('/chat', chatRouter);
router.use('/conversations', conversationRouter);
router.use('/messages', messageRouter);
router.use('/users', userRouter);

export default router;

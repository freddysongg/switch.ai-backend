import { Router } from 'express';

import chatRouter from './chat';
import healthRouter from './health';

const router = Router();

router.use('/chat', chatRouter);
router.use('/health', healthRouter);

export default router;

import { Router } from 'express';

import { HealthController } from '@/controllers/health';

const router = Router();
const healthController = new HealthController();

router.get('/', healthController.check.bind(healthController));

export default router;

import { Router } from 'express';

import { AuthController } from '../controllers/auth';
import { authMiddleware } from '../middleware/auth';

const router = Router();
const authController = new AuthController();

router.post('/register', authController.register.bind(authController));
router.post('/login', authController.login.bind(authController));
router.post('/logout', authController.logout.bind(authController));

router.get('/me', authMiddleware, authController.getMe.bind(authController));

export default router;

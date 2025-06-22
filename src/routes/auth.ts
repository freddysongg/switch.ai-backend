import { Router } from 'express';

import { AuthController } from '../controllers/auth.js';
import { authMiddleware } from '../middleware/auth.js';

const router = Router();
const authController = new AuthController();

router.post('/register', authController.register.bind(authController));
router.post('/login', authController.login.bind(authController));
router.post('/logout', authController.logout.bind(authController));

router.get('/google', authController.initiateGoogleOAuth.bind(authController));
router.get('/google/callback', authController.handleGoogleCallback.bind(authController));

router.get('/me', authMiddleware, authController.getMe.bind(authController));

export default router;

import { Router } from 'express';

import { ChatController } from '../controllers/chat';
import { authMiddleware } from '../middleware/auth';

// import { rateLimiter } from '../middleware/rateLimiter';

const router = Router();
const chatController = new ChatController();

// Apply auth before rate limiting so we can have different limits for authenticated vs anonymous users
router.use(async (req, res, next) => {
  try {
    await authMiddleware(req, res, next);
    // await rateLimiter(req, res, next);
  } catch (error) {
    next(error);
  }
});

router.post('/', chatController.chat.bind(chatController));
router.get('/', chatController.listConversations.bind(chatController));

router.post('/search', chatController.searchMessages.bind(chatController));
router.get('/switches/search', chatController.searchSwitches.bind(chatController));

router.get('/:conversationId', chatController.getConversation.bind(chatController));
router.delete('/:conversationId', chatController.deleteConversation.bind(chatController));

export default router;

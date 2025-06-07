import { Router } from 'express';

import { ChatController } from '../controllers/chat.js';
import {
  chatRequestSchema,
  conversationParamsSchema,
  searchSwitchesSchema,
  validateBody,
  validateParams,
  validateQuery
} from '../schemas/validation.js';

const router = Router();
const chatController = new ChatController();

// POST /api/chat - Send a message in a conversation
router.post('/', validateBody(chatRequestSchema), chatController.chat.bind(chatController));

// GET /api/chat - List all conversations for the user
router.get('/', chatController.listConversations.bind(chatController));

// POST /api/chat/search - Search messages (not implemented yet)
router.post('/search', chatController.searchMessages.bind(chatController));

// GET /api/chat/switches/search - Search switches with semantic similarity
router.get(
  '/switches/search',
  validateQuery(searchSwitchesSchema),
  chatController.searchSwitches.bind(chatController)
);

router.get(
  '/:conversationId',
  validateParams(conversationParamsSchema),
  chatController.getConversation.bind(chatController)
);

router.delete(
  '/:conversationId',
  validateParams(conversationParamsSchema),
  chatController.deleteConversation.bind(chatController)
);

export default router;

import { Router } from 'express';

import { ChatController } from '../controllers/chat';

const router = Router();
const chatController = new ChatController();

router.post('/', chatController.chat.bind(chatController));
router.get('/', chatController.listConversations.bind(chatController));

router.post('/search', chatController.searchMessages.bind(chatController));
router.get('/switches/search', chatController.searchSwitches.bind(chatController));

router.get('/:conversationId', chatController.getConversation.bind(chatController));
router.delete('/:conversationId', chatController.deleteConversation.bind(chatController));

export default router;

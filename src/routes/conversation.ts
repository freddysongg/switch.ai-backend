import { Router } from 'express';

import { ConversationController } from '@/controllers/conversation';

import { authMiddleware } from '../middleware/auth';

const router = Router();
const conversationController = new ConversationController();

router.post('/', conversationController.createConversation.bind(conversationController));
router.get('/', conversationController.getAllConversationsForUser.bind(conversationController));

router.get('/:id', conversationController.getConversationById.bind(conversationController));
router.put('/:id', conversationController.updateConversation.bind(conversationController));
router.delete('/:id', conversationController.deleteConversation.bind(conversationController));

export default router;

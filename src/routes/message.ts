import { Router } from 'express';

import { MessageController } from '../controllers/message';

const router = Router();
const messageController = new MessageController();

router.post('/', messageController.createMessage.bind(messageController));
router.get('/', messageController.getMessagesInConversation.bind(messageController));

router.get('/:id', messageController.getMessageById.bind(messageController));
router.put('/:id', messageController.updateMessage.bind(messageController));
router.delete('/:id', messageController.deleteMessage.bind(messageController));

export default router;

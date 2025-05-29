import { Router } from 'express';

import { UserController } from '../controllers/user';
import { authMiddleware } from '../middleware/auth';

const router = Router();
const userController = new UserController();

router.use(async (req, res, next) => {
  try {
    await authMiddleware(req, res, next);
  } catch (error) {
    next(error);
  }
});

router.post('/', userController.createUser.bind(userController));
router.get('/', userController.getAllUsers.bind(userController));
router.get('/:id', userController.getUserById.bind(userController));
router.put('/:id', userController.updateUser.bind(userController));
router.delete('/:id', userController.deleteUser.bind(userController));

export default router;

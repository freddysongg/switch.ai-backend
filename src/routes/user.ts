import { Router } from 'express';

import { UserController } from '../controllers/user.js';
import {
  userParamsSchema,
  userUpdateSchema,
  validateBody,
  validateParams
} from '../schemas/validation.js';

const router = Router();
const userController = new UserController();

router.get('/', userController.getAllUsers.bind(userController));

router.get(
  '/:userId',
  validateParams(userParamsSchema),
  userController.getUserById.bind(userController)
);

router.put(
  '/:userId',
  validateParams(userParamsSchema),
  validateBody(userUpdateSchema),
  userController.updateUser.bind(userController)
);

router.delete(
  '/:userId',
  validateParams(userParamsSchema),
  userController.deleteUser.bind(userController)
);

export default router;

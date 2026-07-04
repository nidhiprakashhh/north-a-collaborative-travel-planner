import { Router } from 'express';
import { requireAuth } from '../middleware/auth';
import { create, getById, join, listMine } from '../controllers/tripController';

const router = Router();

router.use(requireAuth);

router.post('/', create);
router.get('/', listMine);
router.get('/:id', getById);
router.post('/:id/join', join);

export default router;

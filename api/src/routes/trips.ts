import { Router } from 'express';
import { requireAuth } from '../middleware/auth';
import {
  create,
  getById,
  join,
  listMine,
  synthesize,
  getPreferences,
  getVotes,
  getItinerary,
  getConsiderList,
} from '../controllers/tripController';

const router = Router();

router.use(requireAuth);

router.post('/', create);
router.get('/', listMine);
router.get('/:id', getById);
router.post('/:id/join', join);
router.get('/:id/preferences', getPreferences);
router.get('/:id/votes', getVotes);
router.get('/:id/consider', getConsiderList);
router.get('/:id/itinerary', getItinerary);
router.post('/:id/synthesize', synthesize);

export default router;

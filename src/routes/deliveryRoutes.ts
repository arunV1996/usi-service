import { Router } from 'express';
import * as ctrl from '../controllers/deliveryController';

const router = Router();

router.post('/banks', ctrl.banks);
router.post('/branches', ctrl.branches);
router.post('/collection-points', ctrl.collectionPoints);

export default router;

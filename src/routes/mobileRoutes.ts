import { Router } from 'express';
import * as ctrl from '../controllers/mobileController';

const router = Router();

router.post('/operators', ctrl.operators);
router.post('/credit-types', ctrl.creditTypes);

export default router;

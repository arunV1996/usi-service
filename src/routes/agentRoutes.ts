import { Router } from 'express';
import * as ctrl from '../controllers/agentController';

const router = Router();

router.post('/details', ctrl.getAgentDetails);
router.post('/credit', ctrl.getCurrentCredit);

export default router;

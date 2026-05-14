import { Router } from 'express';
import agentRoutes from './agentRoutes';
import countryRoutes from './countryRoutes';
import ratesRoutes from './ratesRoutes';
import remitterRoutes from './remitterRoutes';
import beneficiaryRoutes from './beneficiaryRoutes';
import transactionRoutes from './transactionRoutes';
import deliveryRoutes from './deliveryRoutes';
import mobileRoutes from './mobileRoutes';
import auditRoutes from './auditRoutes';

const router = Router();

router.use('/agent', agentRoutes);
router.use('/countries', countryRoutes);
router.use('/rates', ratesRoutes);
router.use('/remitters', remitterRoutes);
router.use('/beneficiaries', beneficiaryRoutes);
router.use('/transactions', transactionRoutes);
router.use('/delivery', deliveryRoutes);
router.use('/mobile', mobileRoutes);
router.use('/audit', auditRoutes);

export default router;

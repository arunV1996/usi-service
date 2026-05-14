import { Router } from 'express';
import * as ctrl from '../controllers/countryController';

const router = Router();

router.post('/destinations', ctrl.getDestinationCountries);

export default router;

import { Router } from 'express';

import { MetricsController } from '../controllers/metricsController.js';

const router = Router();
const metricsController = new MetricsController();

router.get('/health', metricsController.healthCheck.bind(metricsController));

router.get('/test-suites', metricsController.getTestSuites.bind(metricsController));
router.post('/test-suites/:suiteId/run', metricsController.runTestSuite.bind(metricsController));
router.post('/test-suites/run-all', metricsController.runAllTests.bind(metricsController));

router.post('/test/custom', metricsController.runCustomTest.bind(metricsController));

router.get('/requests/:requestId', metricsController.getRequestMetrics.bind(metricsController));
router.get('/reports', metricsController.getMetricsReport.bind(metricsController));

router.post(
  '/requests/:requestId/evaluate',
  metricsController.recordManualEvaluation.bind(metricsController)
);
router.get(
  '/evaluation/guidelines',
  metricsController.getEvaluationGuidelines.bind(metricsController)
);

export default router;

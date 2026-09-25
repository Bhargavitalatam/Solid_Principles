// api/app.ts
import express, { Express } from 'express';
import { BillingController } from './controllers/BillingController';

export function createApp(billingController = new BillingController()): Express {
  const app = express();

  app.use(express.json());

  // Healthcheck endpoint
  app.get('/health', (_req, res) => {
    res.status(200).json({ status: 'healthy' });
  });

  // Core requirement 5: POST /api/renew
  app.post('/api/renew', billingController.renewSubscription);

  return app;
}

export const app = createApp();
export default app;

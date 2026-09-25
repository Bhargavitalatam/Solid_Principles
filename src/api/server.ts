// api/server.ts
import dotenv from 'dotenv';
dotenv.config();

import { app } from './app';
import { runMigrationsAndSeed } from '../infrastructure/database/migrate';

const PORT = parseInt(process.env.PORT || '3000', 10);

async function startServer() {
  // Ensure DB schema and seeds are ready if in container or dev mode
  try {
    if (process.env.AUTO_MIGRATE === 'true' || process.env.NODE_ENV !== 'test') {
      await runMigrationsAndSeed();
    }
  } catch (err) {
    console.warn('Initial migration/seed skipped or failed:', err);
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Subscription Billing API server running on port ${PORT}`);
  });
}

if (require.main === module) {
  startServer();
}

export { app };

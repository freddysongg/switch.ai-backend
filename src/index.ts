import cors from 'cors';
import express from 'express';

import { ASCII_LOGO, SERVER_READY } from './config/ascii.js';
import { getSecret, initializeSecrets } from './config/secrets.js';
import { closeDbConnection } from './db/index.js';
import { addCSPNonce, cspMiddleware, developmentCSP } from './middleware/csp.js';
import { errorHandler } from './middleware/error.js';
import { inputSanitization } from './middleware/inputSanitization.js';
import { rateLimiter } from './middleware/rateLimiter.js';
import router from './routes/index.js';

/**
 * Application startup function
 */
async function startServer() {
  try {
    console.log(ASCII_LOGO);
    console.log('🚀 Starting SwitchAI backend server...');

    await initializeSecrets();

    const app = express();
    const port = parseInt(getSecret('PORT'), 10);
    const nodeEnv = getSecret('NODE_ENV');

    console.log(`🌍 Environment: ${nodeEnv}`);

    if (nodeEnv === 'development') {
      app.use(developmentCSP);
    } else {
      app.use(cspMiddleware);
    }

    app.use(addCSPNonce);

    app.use(cors());
    app.use(express.json());
    app.use(inputSanitization);

    if (getSecret('RATE_LIMITING_ENABLED') !== 'false') {
      app.use('/api', rateLimiter, router);
    } else {
      console.log('🚨 Rate limiting is disabled via environment variable');
      app.use('/api', router);
    }

    app.use(errorHandler);

    const server = app.listen(port, () => {
      console.log(SERVER_READY(port));
      console.log('✅ Server started successfully with secure configuration');
    });

    const gracefulShutdown = async (signal: string) => {
      console.log(`\n📡 Received ${signal}. Starting graceful shutdown...`);

      server.close(async () => {
        console.log('🔌 HTTP server closed');

        try {
          await closeDbConnection();
          console.log('✅ Graceful shutdown completed');
          process.exit(0);
        } catch (error) {
          console.error('❌ Error during graceful shutdown:', error);
          process.exit(1);
        }
      });

      setTimeout(() => {
        console.error('⚠️ Forced shutdown after timeout');
        process.exit(1);
      }, 10000);
    };

    process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
    process.on('SIGINT', () => gracefulShutdown('SIGINT'));
  } catch (error) {
    console.error('❌ Failed to start server:', error);
    console.error(
      '🔧 Please check your environment configuration and ensure all required secrets are properly set.'
    );
    process.exit(1);
  }
}

startServer().catch((error) => {
  console.error('💥 Unhandled error during startup:', error);
  process.exit(1);
});

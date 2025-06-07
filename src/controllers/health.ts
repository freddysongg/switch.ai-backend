import { GoogleGenerativeAI } from '@google/generative-ai';
import { Request, Response } from 'express';

import { AI_CONFIG } from '../config/ai.config.js';
import { getSecret } from '../config/secrets.js';
import { db, withDb } from '../db/index.js';
import { health } from '../db/schema.js';
import { supabase } from '../utils/supabase.js';

export class HealthController {
  async check(req: Request, res: Response) {
    const status = {
      api: 'ok',
      database: 'pending',
      auth: 'pending',
      llm: 'pending',
      timestamp: new Date().toISOString()
    };

    try {
      await withDb(async () => {
        await db.insert(health).values({ status: 'ok' });
        status.database = 'ok';
      });

      try {
        await supabase.auth.getSession();
        status.auth = 'ok';
      } catch (error) {
        console.error('Auth health check failed:', error);
        status.auth = 'error';
      }

      try {
        const genAI = new GoogleGenerativeAI(getSecret('GEMINI_API_KEY'));
        const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });

        const timeoutPromise = new Promise<never>((_, reject) => {
          setTimeout(
            () => reject(new Error('LLM health check timed out')),
            AI_CONFIG.HEALTH_CHECK_TIMEOUT_MS
          );
        });

        await Promise.race([model.generateContent('test'), timeoutPromise]);

        status.llm = 'ok';
      } catch (error) {
        console.error('LLM health check failed:', error);
        status.llm = 'error';
      }

      res.json(status);
    } catch (error) {
      console.error('Health check failed:', error);
      res.status(500).json({
        ...status,
        api: 'error',
        error: 'Health check failed'
      });
    }
  }
}

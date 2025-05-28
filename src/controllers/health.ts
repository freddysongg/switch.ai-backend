import { GoogleGenerativeAI } from '@google/generative-ai';
import { Request, Response } from 'express';

import { db, withDb } from '../db';
import { health } from '../db/schema';
import { supabase } from '../utils/supabase';

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
      // Check database
      await withDb(async () => {
        await db.insert(health).values({ status: 'ok' });
        status.database = 'ok';
      });

      // Check auth service
      try {
        await supabase.auth.getSession();
        status.auth = 'ok';
      } catch (error) {
        console.error('Auth health check failed:', error);
        status.auth = 'error';
      }

      // Check LLM
      try {
        const genAI = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY || '');
        const model = genAI.getGenerativeModel({ model: 'gemini-pro' });
        await model.generateContent('test');
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

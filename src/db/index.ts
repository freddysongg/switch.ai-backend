import 'dotenv/config';

import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';

import { getSecret } from '../config/secrets.js';
import { DatabaseError } from './errors.js';
import * as schema from './schema.js';

let dbInstance: ReturnType<typeof drizzle> | null = null;
let clientInstance: ReturnType<typeof postgres> | null = null;

/**
 * Get or create the database connection (lazy initialization)
 */
function getDbConnection() {
  if (!dbInstance) {
    clientInstance = postgres(getSecret('DATABASE_URL'), {
      max: 10,
      idle_timeout: 20,
      connect_timeout: 10,
      onnotice: () => {},
      ssl: {
        rejectUnauthorized: false
      },
      connection: {
        application_name: 'switch.ai'
      }
    });

    dbInstance = drizzle(clientInstance, {
      schema,
      logger: false
    });
  }

  return dbInstance;
}

export const db = new Proxy({} as ReturnType<typeof drizzle>, {
  get(target, prop) {
    const connection = getDbConnection();
    const value = connection[prop as keyof typeof connection];

    if (typeof value === 'function') {
      return value.bind(connection);
    }

    return value;
  }
});

export async function withDb<T>(operation: () => Promise<T>): Promise<T> {
  try {
    return await operation();
  } catch (error) {
    console.error('Database error:', error);
    throw new DatabaseError('Database operation failed');
  }
}

/**
 * Cleanup database connections
 */
export async function closeDbConnection(): Promise<void> {
  if (clientInstance) {
    try {
      await clientInstance.end();
      console.log('✅ Database connection closed');
    } catch (error) {
      console.error('❌ Error closing database connection:', error);
    } finally {
      clientInstance = null;
      dbInstance = null;
    }
  }
}

export * from './schema.js';
export * from '../types/db.js';
export * from './errors.js';

import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';

import { DatabaseError } from './errors';
import * as schema from './schema';

if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL is not defined');
}

// Create postgres client with connection pooling
const client = postgres(process.env.DATABASE_URL, {
  max: 10,
  idle_timeout: 20,
  connect_timeout: 10,
  onnotice: () => {},
  ssl: {
    rejectUnauthorized: false
  },
  connection: {
    application_name: 'switch.ai-backend'
  }
});

// Create drizzle database instance
export const db = drizzle(client, {
  schema,
  logger: process.env.NODE_ENV === 'development'
});

// Wrap database operations with error handling
export async function withDb<T>(operation: () => Promise<T>): Promise<T> {
  try {
    return await operation();
  } catch (error) {
    console.error('Database error:', error);
    throw new DatabaseError('Database operation failed');
  }
}

export * from './schema';
export * from './types';
export * from './errors';

import { createClient } from '@supabase/supabase-js';

import type { Database } from '../types/db';

if (!process.env.DATABASE_URL || !process.env.DATABASE_ANON_KEY) {
  throw new Error('Missing Supabase credentials');
}

export const supabase = createClient<Database>(
  process.env.DATABASE_URL,
  process.env.DATABASE_ANON_KEY
);

export async function getUserById(userId: string) {
  const { data, error } = await supabase.from('users').select('*').eq('id', userId).single();

  if (error) throw error;
  return data;
}

export async function verifyAuthToken(token: string) {
  const {
    data: { user },
    error
  } = await supabase.auth.getUser(token);
  if (error) throw error;
  return user;
}

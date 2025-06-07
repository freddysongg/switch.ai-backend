import { createClient, SupabaseClient } from '@supabase/supabase-js';

import { getSecret } from '../config/secrets.js';
import type { Database } from '../types/db';

let supabaseInstance: SupabaseClient<Database> | null = null;

/**
 * Get or create the Supabase client
 */
function getSupabaseClient(): SupabaseClient<Database> {
  if (!supabaseInstance) {
    supabaseInstance = createClient<Database>(
      getSecret('DATABASE_URL'),
      getSecret('DATABASE_ANON_KEY') || ''
    );
  }
  return supabaseInstance;
}

export const supabase = new Proxy({} as SupabaseClient<Database>, {
  get(target, prop) {
    const client = getSupabaseClient();
    const value = client[prop as keyof SupabaseClient<Database>];

    if (typeof value === 'function') {
      return value.bind(client);
    }

    return value;
  }
});

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

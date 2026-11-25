// Supabase client (only created when configured). Sessions persist in AsyncStorage.
import 'react-native-url-polyfill/auto';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { Platform } from 'react-native';
import { config, isCloud } from './config';

export const supabase: SupabaseClient | null = isCloud
  ? createClient(config.supabaseUrl!, config.supabaseAnonKey!, {
      auth: {
        storage: Platform.OS === 'web' ? undefined : AsyncStorage,
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: Platform.OS === 'web',
      },
    })
  : null;

/** Call a Supabase Edge Function with the user's session. */
export async function callFunction<T>(name: string, body: unknown): Promise<T> {
  if (!supabase) throw new Error('not_configured');
  const { data, error } = await supabase.functions.invoke(name, { body: body as any });
  if (error) throw error;
  return data as T;
}

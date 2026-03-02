import 'react-native-url-polyfill/auto';
import { createClient } from '@supabase/supabase-js';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { Database } from '@/types/database';

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    '\n\n' +
    '=== Missing Supabase Environment Variables ===\n' +
    'EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY are not set.\n\n' +
    'Fix:\n' +
    '1. Copy .env.example to .env  →  cp .env.example .env\n' +
    '2. Open .env and paste your Supabase Project URL and anon key\n' +
    '   (find them at: https://supabase.com/dashboard → your project → Settings → API)\n' +
    '3. Stop the dev server and restart it with:  npx expo start --clear\n' +
    '==============================================\n'
  );
}

export const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});

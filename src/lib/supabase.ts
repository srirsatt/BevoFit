// file for a consistent import var
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL;
/*
const SUPABASE_ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON;

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
*/
const SUPABASE_PUBLISHABLE_KEY = process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE;

if (!SUPABASE_URL) {
    throw new Error('EXPO_PUBLIC_SUPABASE_URL is not defined in the env variables');
}

if (!SUPABASE_PUBLISHABLE_KEY) {
    throw new Error('EXPO_PUBLIC_SUPABASE_PUBLISHABLE is not defined in env variables.');
}

export const supabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
    auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: false,
    }
})
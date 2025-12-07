import { createClient } from '@supabase/supabase-js';

// These env vars should be set in your local environment or Netlify build settings
const SUPABASE_URL = process.env.REACT_APP_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.REACT_APP_SUPABASE_ANON_KEY;

let supabase = null;
if (SUPABASE_URL && SUPABASE_ANON_KEY) {
  supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: {
      persistSession: false, // Temporarily disabled to fix auth loop
      autoRefreshToken: true,
      detectSessionInUrl: true
    }
  });
}else {
  // Provide a minimal stub so the app doesn't crash in demo/local mode
  // and provide clearer logging to help debugging env problems.
  // Consumers should handle the case where methods return errors/nulls.
  // eslint-disable-next-line no-console
  console.warn('Supabase client not configured. Set REACT_APP_SUPABASE_URL and REACT_APP_SUPABASE_ANON_KEY in .env.local');

  supabase = {
    from: () => ({ select: async () => ({ data: null, error: null }) }),
    auth: {
      signInWithPassword: async () => ({ error: new Error('Supabase not configured') }),
      signOut: async () => ({}),
      getUser: async () => ({ data: { user: null } })
    },
    channel: () => ({
      on: () => ({ subscribe: () => ({ unsubscribe: () => {} }) })
    })
  };
}

export default supabase;

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.REACT_APP_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.REACT_APP_SUPABASE_ANON_KEY;

let supabase = null;

if (SUPABASE_URL && SUPABASE_ANON_KEY) {
  supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: {
      persistSession: false,
      autoRefreshToken: true,
      detectSessionInUrl: true
    }
  });
} else {
  console.error('❌ SUPABASE NOT CONFIGURED!');
  console.error('Set these in Netlify environment variables:');
  console.error('  - REACT_APP_SUPABASE_URL');
  console.error('  - REACT_APP_SUPABASE_ANON_KEY');
  
  // Stub that returns errors for all operations
  supabase = {
    from: () => ({
      select: () => ({
        eq: () => Promise.resolve({ data: null, error: new Error('Supabase not configured') }),
        in: () => Promise.resolve({ data: null, error: new Error('Supabase not configured') }),
        neq: () => Promise.resolve({ data: null, error: new Error('Supabase not configured') }),
      }),
      insert: () => Promise.resolve({ data: null, error: new Error('Supabase not configured') }),
      update: () => Promise.resolve({ data: null, error: new Error('Supabase not configured') }),
      delete: () => Promise.resolve({ data: null, error: new Error('Supabase not configured') }),
    }),
    auth: {
      signInWithPassword: () => Promise.resolve({ error: new Error('Supabase not configured') }),
      signUp: () => Promise.resolve({ error: new Error('Supabase not configured') }),
      signOut: () => Promise.resolve({}),
      getSession: () => Promise.resolve({ data: { session: null } }),
      getUser: () => Promise.resolve({ data: { user: null } }),
      onAuthStateChange: () => ({ data: { subscription: { unsubscribe: () => {} } } }),
    },
    channel: () => ({
      on: () => ({ subscribe: () => ({ unsubscribe: () => {} }) })
    })
  };
}

export default supabase;

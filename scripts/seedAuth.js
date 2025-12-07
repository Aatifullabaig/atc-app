#!/usr/bin/env node
/**
 * Seed Supabase with demo authentication users
 * Usage: npm run seed:auth or node scripts/seedAuth.js
 */

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const SUPABASE_URL = process.env.REACT_APP_SUPABASE_URL || process.env.SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.REACT_APP_SUPABASE_ANON_KEY;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  console.error('❌ Missing Supabase config.');
  console.error('Set REACT_APP_SUPABASE_URL and REACT_APP_SUPABASE_ANON_KEY in .env.local');
  process.exit(1);
}

if (!SUPABASE_SERVICE_ROLE_KEY) {
  console.error('❌ Missing SUPABASE_SERVICE_ROLE_KEY!');
  console.error('Add SUPABASE_SERVICE_ROLE_KEY to .env.local');
  console.error('Get it from: https://app.supabase.com → Settings → API → service_role');
  process.exit(1);
}

// Use anon key for auth, service role for database operations
const supabaseAuth = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
const supabaseDb = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

// Demo users to create
const demoUsers = [
  {
    email: 'ground@mailinator.com',
    password: 'Password123!',
    name: 'Ground Controller',
    role: 'ground',
    is_approved: true
  },
  {
    email: 'tower@mailinator.com',
    password: 'Password123!',
    name: 'Tower Controller',
    role: 'tower',
    is_approved: true
  },
  {
    email: 'aatifullabaigmm@gmail.com',
    password: 'Baig@1234',
    name: 'Admin User',
    role: 'admin',
    is_approved: true
  },
  {
    email: 'testuser@mailinator.com',
    password: 'Password123!',
    name: 'Test User',
    role: 'pending',
    is_approved: false
  }
];

async function seedAuth() {
  console.log('🔐 Seeding Supabase Authentication Users...\n');
  console.log(`URL: ${SUPABASE_URL}\n`);

  for (const user of demoUsers) {
    try {
      console.log(`📝 Creating user: ${user.email}`);
      
      // Use service role to create admin user with auto-confirm
      const { data, error } = await supabaseDb.auth.admin.createUser({
        email: user.email,
        password: user.password,
        email_confirm: true,
        user_metadata: {
          name: user.name
        }
      });

      if (error) {
        console.error(`   ❌ Error: ${error.message}`);
      } else if (data?.user?.id) {
        console.log(`   ✅ User created successfully!`);
        console.log(`      Email: ${user.email}`);
        console.log(`      User ID: ${data.user.id}`);
        console.log(`      Role: ${user.role}`);
        console.log(`      Approved: ${user.is_approved}`);

        // Set user role using service role key
        await setUserRole(data.user.id, user);
      } else {
        console.error(`   ❌ Error: User created but no user ID returned`);
      }
    } catch (err) {
      console.error(`   ❌ Unexpected error: ${err.message}`);
    }
  }

  console.log('\n✨ Done! Try logging in with these credentials:\n');
  demoUsers.forEach(user => {
    console.log(`   Email: ${user.email}`);
    console.log(`   Password: ${user.password}`);
    console.log(`   Role: ${user.role}`);
    console.log(`   Approved: ${user.is_approved}\n`);
  });

  process.exit(0);
}

async function setUserRole(userId, user) {
  try {
    // Wait longer to ensure user is fully committed to auth.users table
    console.log(`   ⏳ Waiting 1.5 seconds for user to be fully committed...`);
    await new Promise(resolve => setTimeout(resolve, 1500));
    
    // Use service role key for database insert
    const { error: roleError } = await supabaseDb
      .from('user_roles')
      .upsert({
        user_id: userId,
        email: user.email,
        role: user.role,
        is_approved: user.is_approved,
        created_at: new Date().toISOString(),
      }, { onConflict: 'user_id' });

    if (roleError) {
      console.error(`   ⚠️  Error setting role: ${roleError.message}`);
      // Try again after another delay
      console.log(`   🔄 Retrying in 3 seconds...`);
      await new Promise(resolve => setTimeout(resolve, 3000));
      
      const { error: retryError } = await supabaseDb
        .from('user_roles')
        .upsert({
          user_id: userId,
          email: user.email,
          role: user.role,
          is_approved: user.is_approved,
          created_at: new Date().toISOString(),
        }, { onConflict: 'user_id' });
      
      if (retryError) {
        console.error(`   ❌ Retry failed: ${retryError.message}`);
        // Final attempt with even longer wait
        console.log(`   🔄 Final retry in 5 seconds...`);
        await new Promise(resolve => setTimeout(resolve, 5000));
        
        const { error: finalError } = await supabaseDb
          .from('user_roles')
          .upsert({
            user_id: userId,
            email: user.email,
            role: user.role,
            is_approved: user.is_approved,
            created_at: new Date().toISOString(),
          }, { onConflict: 'user_id' });
        
        if (finalError) {
          console.error(`   ❌ Final attempt failed: ${finalError.message}`);
        } else {
          console.log(`   ✅ Role set successfully on final attempt!`);
        }
      } else {
        console.log(`   ✅ Role set successfully on retry!`);
      }
    } else {
      console.log(`   ✅ Role set successfully!`);
    }
  } catch (err) {
    console.error(`   ⚠️  Error setting role: ${err.message}`);
  }
}

seedAuth().catch(err => {
  console.error('❌ Fatal error:', err);
  process.exit(1);
});

#!/usr/bin/env node
/**
 * Setup user roles for existing users
 * Usage: node scripts/setupUserRoles.js
 */

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const SUPABASE_URL = process.env.REACT_APP_SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('❌ Missing Supabase config.');
  console.error('Set REACT_APP_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env.local');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

const users = [
  { email: 'ground@mailinator.com', role: 'ground', is_approved: true },
  { email: 'tower@mailinator.com', role: 'tower', is_approved: true },
  { email: 'aatifullabaigmm@gmail.com', role: 'admin', is_approved: true },
  { email: 'testuser@mailinator.com', role: 'pending', is_approved: false }
];

async function setupRoles() {
  console.log('🔧 Setting up user roles...\n');

  for (const user of users) {
    try {
      console.log(`📝 Processing: ${user.email}`);

      // Get user by email using admin API
      const { data: { users: authUsers }, error: listError } = await supabase.auth.admin.listUsers();

      if (listError) {
        console.error(`   ❌ Error listing users: ${listError.message}`);
        continue;
      }

      const authUser = authUsers.find(u => u.email === user.email);

      if (!authUser) {
        console.log(`   ⚠️  User not found in auth`);
        continue;
      }

      console.log(`   ✓ Found user ID: ${authUser.id}`);

      // Upsert role
      const { error: roleError } = await supabase
        .from('user_roles')
        .upsert({
          user_id: authUser.id,
          email: user.email,
          role: user.role,
          is_approved: user.is_approved,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        }, { onConflict: 'user_id' });

      if (roleError) {
        console.error(`   ❌ Error setting role: ${roleError.message}`);
      } else {
        console.log(`   ✅ Role set: ${user.role} (approved: ${user.is_approved})`);
      }
    } catch (err) {
      console.error(`   ❌ Unexpected error: ${err.message}`);
    }
    console.log('');
  }

  console.log('✨ Done!\n');
  console.log('You can now login with:');
  users.forEach(user => {
    console.log(`  • ${user.email} (role: ${user.role})`);
  });

  process.exit(0);
}

setupRoles().catch(err => {
  console.error('❌ Fatal error:', err);
  process.exit(1);
});

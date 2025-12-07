#!/usr/bin/env node
/**
 * Admin Panel: Approve/Reject user access
 * Usage: npm run admin:approve
 */

const { createClient } = require('@supabase/supabase-js');
const readline = require('readline');
require('dotenv').config({ path: '.env.local' });

const SUPABASE_URL = process.env.REACT_APP_SUPABASE_URL;
const SUPABASE_KEY = process.env.REACT_APP_SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('❌ Missing Supabase config.');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

function question(prompt) {
  return new Promise(resolve => rl.question(prompt, resolve));
}

async function listPendingUsers() {
  console.log('\n📋 Pending User Approvals\n');
  
  const { data, error } = await supabase
    .from('user_roles')
    .select('*')
    .eq('is_approved', false)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('❌ Error fetching pending users:', error.message);
    return [];
  }

  if (!data || data.length === 0) {
    console.log('✅ No pending approvals');
    return [];
  }

  data.forEach((user, index) => {
    console.log(`${index + 1}. Email: ${user.email}`);
    console.log(`   Role: ${user.role}`);
    console.log(`   Created: ${new Date(user.created_at).toLocaleString()}`);
    console.log('');
  });

  return data;
}

async function approveUser(user) {
  console.log(`\n✅ Approving ${user.email}...`);

  const roleChoice = await question(
    'Select role:\n1. Ground\n2. Tower\n3. Ground & Tower\n4. Pilot\nChoice (1-4): '
  );

  const roleMap = {
    '1': 'ground',
    '2': 'tower',
    '3': 'ground_tower',
    '4': 'pilot',
  };

  const role = roleMap[roleChoice];
  if (!role) {
    console.log('❌ Invalid choice');
    return;
  }

  const { error } = await supabase
    .from('user_roles')
    .update({
      role: role,
      is_approved: true,
      updated_at: new Date().toISOString(),
    })
    .eq('user_id', user.user_id);

  if (error) {
    console.error('❌ Error approving user:', error.message);
    return;
  }

  console.log(`✅ ${user.email} approved as ${role}`);
}

async function rejectUser(user) {
  const reason = await question('Rejection reason: ');

  const { error } = await supabase
    .from('admin_approvals')
    .insert({
      user_id: user.user_id,
      email: user.email,
      requested_role: user.role,
      rejected_at: new Date().toISOString(),
      rejection_reason: reason,
    });

  if (error) {
    console.error('❌ Error rejecting user:', error.message);
    return;
  }

  await supabase
    .from('user_roles')
    .delete()
    .eq('user_id', user.user_id);

  console.log(`✅ ${user.email} rejected`);
}

async function main() {
  console.log('🔐 User Approval Admin Panel\n');

  let continueLoop = true;

  while (continueLoop) {
    const pendingUsers = await listPendingUsers();

    if (pendingUsers.length === 0) {
      continueLoop = false;
      console.log('✨ Done!');
      break;
    }

    const choice = await question(
      'Enter number to approve, R to reject, or Q to quit: '
    ).catch(() => 'Q');

    if (choice.toUpperCase() === 'Q') {
      continueLoop = false;
      break;
    }

    if (choice.toUpperCase() === 'R') {
      const index = parseInt(await question('Enter number to reject: '));
      if (index > 0 && index <= pendingUsers.length) {
        await rejectUser(pendingUsers[index - 1]);
      } else {
        console.log('❌ Invalid number');
      }
      continue;
    }

    const index = parseInt(choice);
    if (index > 0 && index <= pendingUsers.length) {
      await approveUser(pendingUsers[index - 1]);
    } else {
      console.log('❌ Invalid number');
    }
  }

  rl.close();
  process.exit(0);
}

main().catch(err => {
  console.error('❌ Error:', err);
  process.exit(1);
});

#!/bin/bash
# Delete obsolete files - run this once to clean up

cd "$(dirname "$0")"

# Delete all old SQL files (keeping only DATABASE_SETUP.sql)
rm -f VOR_CONFIG.sql
rm -f supabase_user_roles_migration.sql
rm -f SUPABASE_SETUP.sql
rm -f supabase_schema.sql
rm -f supabase_migrations_cleanup.sql
rm -f supabase_migrations.sql
rm -f CREATE_PILOTS_TABLE.sql
rm -f FIX_RLS_USER_ROLES.sql
rm -f SETUP_USER_ROLES.sql

# Delete all old txt files
rm -f SQL_CLEANUP_INSTRUCTIONS.txt
rm -f COMPLETION_BADGE.txt
rm -f FINAL_COMPLETION_BADGE.txt
rm -f FIXES_COMPLETE.txt
rm -f 🎉_COMPLETION_SUMMARY.txt

# Delete old markdown files (keeping only README.md and STARTUP.md)
rm -f RELEASE_CHECKLIST.md

echo "✅ Cleanup complete!"
echo "Remaining essential files:"
echo "- DATABASE_SETUP.sql (complete database schema)"
echo "- README.md (project documentation)"
echo "- STARTUP.md (quick start guide)"

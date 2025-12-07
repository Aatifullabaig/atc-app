#!/bin/bash
# Quick validation script for ATC Tracker

echo "=== ATC Tracker Pre-deployment Checklist ==="
echo ""

# Check environment file
if [ -f ".env.local" ]; then
    echo "✓ .env.local exists"
    if grep -q "REACT_APP_SUPABASE_URL" .env.local; then
        echo "✓ REACT_APP_SUPABASE_URL configured"
    else
        echo "✗ REACT_APP_SUPABASE_URL missing"
    fi
    if grep -q "REACT_APP_SUPABASE_ANON_KEY" .env.local; then
        echo "✓ REACT_APP_SUPABASE_ANON_KEY configured"
    else
        echo "✗ REACT_APP_SUPABASE_ANON_KEY missing"
    fi
else
    echo "✗ .env.local not found - copy from .env.local.template"
fi

echo ""
echo "=== File Structure Check ==="

files_to_check=(
    "src/lib/flightService.js"
    "src/lib/supabaseClient.js"
    "src/screens/GroundPage.jsx"
    "src/screens/TowerPageLive.jsx"
    "src/screens/OpsPageLive.jsx"
    "src/utils/flightUtils.js"
    "package.json"
)

for file in "${files_to_check[@]}"; do
    if [ -f "$file" ]; then
        echo "✓ $file"
    else
        echo "✗ $file MISSING"
    fi
done

echo ""
echo "=== Dependencies Check ==="
if command -v node &> /dev/null; then
    echo "✓ Node.js installed: $(node --version)"
else
    echo "✗ Node.js not found"
fi

if [ -d "node_modules" ]; then
    echo "✓ node_modules exists"
else
    echo "✗ node_modules missing - run: npm install"
fi

echo ""
echo "=== Ready to Deploy ==="
echo "Next steps:"
echo "1. npm install (if needed)"
echo "2. npm run build"
echo "3. npm run start (to test)"
echo "4. netlify deploy (to deploy)"

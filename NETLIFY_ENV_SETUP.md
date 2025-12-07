# ⚙️ Netlify Environment Variables Setup

## 🚨 Current Issue
Your deployed site can't connect to Supabase because environment variables aren't set in Netlify.

## ✅ Fix in 3 Steps

### Step 1: Get Your Supabase Keys

1. Go to https://supabase.com
2. Log in to your account
3. Open your ATC project
4. Click **Settings** (bottom left)
5. Click **API**
6. Copy these values:
   - **Project URL** → This is your `REACT_APP_SUPABASE_URL`
   - **anon public** key → This is your `REACT_APP_SUPABASE_ANON_KEY`

### Step 2: Add to Netlify

1. Go to https://app.netlify.com
2. Select your site (nfti)
3. Click **Build & Deploy**
4. Click **Environment**
5. Click **Edit variables**
6. Add **two** new variables:

| Key | Value |
|-----|-------|
| `REACT_APP_SUPABASE_URL` | `https://your-project.supabase.co` |
| `REACT_APP_SUPABASE_ANON_KEY` | `eyJhbGc...` (your anon key) |

**Important:** 
- Key names MUST match exactly
- Values MUST NOT have quotes
- Click "Save"

### Step 3: Redeploy

1. Go back to **Deployments**
2. Click the **Deploy** button (or trigger)
3. Wait for green checkmark
4. Your site will now have Supabase access!

---

## 🔍 Verify It Worked

After deploying:
1. Go to https://nfti.netlify.app
2. Press **F12** (developer tools)
3. Go to **Console**
4. Look for the error message
5. **If error is gone** → Success! ✅

---

## 📸 Where to Find Supabase Keys

**In Supabase Dashboard:**
- Settings → API → You'll see:
  - `Project URL`
  - `anon public`
  - `service_role secret` (DON'T use this)

**Example values (NOT real):**
```
REACT_APP_SUPABASE_URL = https://xyzabcdef.supabase.co
REACT_APP_SUPABASE_ANON_KEY = eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

---

## 🆘 Still Not Working?

1. **Double-check variable names** - must be EXACT:
   - `REACT_APP_SUPABASE_URL` ✅
   - `REACT_APP_SUPABASE_ANON_KEY` ✅

2. **Clear browser cache** - Ctrl+Shift+Delete, select "All time"

3. **Hard refresh** - Ctrl+F5

4. **Check Netlify build log** - any errors?

5. **Verify Supabase keys are correct** - test in local `.env`

---

## 📝 Local Development

Create `.env.local` in your project root:
```
REACT_APP_SUPABASE_URL=https://your-project.supabase.co
REACT_APP_SUPABASE_ANON_KEY=your-anon-key-here
```

Then run:
```bash
npm start
```

---

**Need help?** Follow the 3 steps above and your site will be live! 🚀

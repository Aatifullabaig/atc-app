# 🔍 Debugging Deployed Site - Diagnostic Checklist

## What to Check

### 1. **In Your Browser (F12 - Developer Tools)**
- Open the site: https://nfti.netlify.app/
- Press **F12** or **Ctrl+Shift+I**
- Go to **Console** tab
- **Look for red errors** - take a screenshot or copy the error message

### 2. **Common Issues & Fixes**

#### Issue: Blank Page
- **Cause**: React not loading or JS error
- **Fix**: Check Console tab (F12) for errors

#### Issue: 404 Not Found
- **Cause**: Page doesn't exist or routes broken
- **Fix**: Check netlify.toml has SPA redirects

#### Issue: "Cannot find module"
- **Cause**: Missing dependency or import error
- **Fix**: Rebuild locally with `npm run build`

#### Issue: Authentication Not Working
- **Cause**: Supabase keys not set in Netlify
- **Fix**: Add environment variables to Netlify dashboard

#### Issue: Dark Page / Styling Missing
- **Cause**: CSS not loading
- **Fix**: Check Network tab (F12) for CSS files

### 3. **Check Netlify Dashboard**

Go to https://app.netlify.com:
- [ ] Select your site
- [ ] Go to "Deployments"
- [ ] Click latest deployment
- [ ] Check "Build log" for errors
- [ ] Verify "Published" status (green checkmark)

### 4. **Common Solutions**

**Clear Browser Cache:**
- **Windows**: Ctrl + Shift + Delete
- **Mac**: Cmd + Shift + Delete
- Select "All time"
- Click "Clear data"

**Hard Refresh:**
- **Windows**: Ctrl + F5
- **Mac**: Cmd + Shift + R

**Check Environment Variables:**
1. Go to Netlify dashboard
2. Select your site
3. Go to "Build & Deploy" → "Environment"
4. Verify these are set:
   - `REACT_APP_SUPABASE_URL`
   - `REACT_APP_SUPABASE_KEY`

---

## What to Tell Me

Please provide:
1. **What you see when you visit the site** (blank page? error message? text but no styling?)
2. **Error messages from Console (F12)**
3. **Screenshot of the error** (if any)
4. **Latest build status** (from Netlify dashboard)

---

## Quick Tests

### Test 1: Check Site is Live
- Go to https://nfti.netlify.app/
- If you see anything (even blank page), the site is deployed ✅

### Test 2: Check for JS Errors
- Press F12
- Go to "Console" tab
- Look for red errors
- Copy the error text

### Test 3: Check Network
- Press F12
- Go to "Network" tab
- Refresh page (F5)
- Look for red errors or 404s
- Check if JS bundle loaded

---

## Most Likely Issues

1. **Supabase keys not set** → Add to Netlify environment
2. **Browser cache** → Hard refresh (Ctrl+F5)
3. **Build failed silently** → Check Netlify build log
4. **CSS not loading** → Check Network tab for 404s

---

## Next Steps

1. Open https://nfti.netlify.app/ 
2. Press **F12** (developer tools)
3. Go to **Console** tab
4. **Tell me what errors you see**

Then I can fix it! 🎯

# 🚀 ATC TRACKER - Startup Guide

## ⚡ Quick Start (5 minutes)

### 1. Install & Configure
```bash
npm install
```

Create `.env.local`:
```
REACT_APP_SUPABASE_URL=https://your-project.supabase.co
REACT_APP_SUPABASE_ANON_KEY=your-anon-key
```

### 2. Start Development Server
```bash
npm start
```
Opens at `http://localhost:3000`

### 3. First Login
- **Admin**: Use admin credentials to access dashboard
- **Instructor**: Log in to access Tower/Ground Control
- **Cadet**: Log in to view flight tracking

---

## 🔧 Production Build

### Build
```bash
npm run build
```

### Output
Static files in `build/` folder - ready to deploy to any hosting service.

---

## 📱 Deployment Options

### Vercel (Recommended)
```bash
npm i -g vercel
vercel
```

### Netlify
```bash
npm i -g netlify-cli
netlify deploy --prod --dir=build
```

### Traditional Server
```bash
npm run build
# Copy 'build' folder to server
# Configure web server to serve index.html for all routes
```

---

## 🗄️ Database Setup

### Supabase Setup
1. Create new Supabase project
2. Open Supabase SQL Editor
3. Copy and run entire contents of `DATABASE_SETUP.sql` file
   - Creates all tables (users, pilots, aircraft, flights, vor_config, etc.)
   - Enables Row Level Security (RLS)
   - Creates helper functions and triggers
   - Inserts default VOR configuration

### Create Admin User
1. In Supabase Auth Console: Create new user with email
2. Copy the user ID
3. In SQL Editor, run:
   ```sql
   UPDATE public.users 
   SET role='admin', is_approved=TRUE, approved_at=NOW()
   WHERE email='admin@example.com';
   ```

---

## ✅ Verification Checklist

- [ ] Node.js installed (`node --version`)
- [ ] Dependencies installed (`npm install` completed)
- [ ] `.env.local` configured with Supabase keys
- [ ] Supabase database migrated
- [ ] Admin user created
- [ ] Dev server starts without errors (`npm start`)
- [ ] Can log in with admin credentials
- [ ] Can access Home page and see map

---

## 🆘 Common Issues

### Port 3000 Already in Use
```bash
# Kill process on port 3000
lsof -ti:3000 | xargs kill -9
npm start
```

### Blank Map
- Check `.env.local` Supabase URL
- Verify global_state table has vor_gondia entry

### Can't Log In
- Verify user exists in Supabase Auth
- Check users table for role assignment
- Ensure approved_at is set

---

## 📊 System Requirements

- **RAM**: 2GB minimum
- **Node**: v14.0.0+
- **npm**: v6.0.0+
- **Modern Browser**: Chrome, Firefox, Safari, Edge

---

## 🔄 Updating

```bash
git pull origin main
npm install
npm start
```

---

## 📞 Support

- Check console errors: `F12` → Console tab
- Enable debug logging in AuthContext.js
- Review error messages in Network tab (F12)

---

**Happy Flying! ✈️**

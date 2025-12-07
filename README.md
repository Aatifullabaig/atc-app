# ✈️ ATC TRACKER - Flight Operations System

**ATC Tracker** is a comprehensive Air Traffic Control flight operations management system built for professional flight training at NFTI (National Flight Training Institute).

## 📋 Features

- **Real-time Flight Tracking** - Monitor active flights on an interactive map
- **Ground Control Operations** - Manage aircraft movements on the ground
- **Tower Management** - Control takeoffs, landings, and flight patterns
- **Flight Monitoring** - Track flight status, altitude, and position data
- **Admin Dashboard** - Manage users, instructors, cadets, and aircraft
- **Role-based Access Control** - Separate interfaces for admins, instructors, and cadets
- **UTC Clock** - Synchronized time display for all operations

## 🏗️ Tech Stack

- **Frontend**: React 18 with Hooks
- **Real-time Database**: Supabase (PostgreSQL)
- **Mapping**: Leaflet.js with OpenStreetMap
- **Authentication**: Supabase Auth with JWT
- **Styling**: CSS3 with theme support (Light/Dark mode)

## 📦 Installation

### Prerequisites
- Node.js v14+ and npm
- Supabase project with database configured
- Git

### Setup Steps

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd atc-app
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Configure environment variables**
   Create `.env.local` in project root:
   ```
   REACT_APP_SUPABASE_URL=https://your-project.supabase.co
   REACT_APP_SUPABASE_ANON_KEY=your-anon-key
   ```

4. **Start development server**
   ```bash
   npm start
   ```
   App will open at `http://localhost:3000`

## 🚀 Quick Start

### For Admins
1. Log in with admin credentials
2. Access Admin Dashboard to manage users, instructors, cadets, and aircraft
3. Configure VOR location and system settings
4. Reset user passwords through the admin panel

### For Instructors
1. Log in with instructor credentials
2. Access Tower or Ground Control operations
3. Monitor student flights in real-time
4. Record flight operations (takeoff, landing, position updates)

### For Cadets
1. Log in with cadet credentials
2. View home page with live flight tracking
3. Monitor active flights on the map
4. See completed flights for the day

## 🗺️ Map Features

- **VOR Center Display** - Red marker shows primary VOR location (Gondia)
- **Flight Markers** - Color-coded by flight phase:
  - 🟡 Taxi
  - 🟢 Airborne
  - 🔴 Landing
  - ⚫ Landed

- **Interactive Map** - Zoom, pan, and click markers for flight details

## 🎮 Operation Pages

### Home Page
- Live aircraft tracking on map
- Active flights count
- Completed flights for today
- Quick navigation to Ground Control and Tower

### Tower Page
- Ground operations flight management
- Air operations flight tracking
- Position recording (radial, distance, altitude)
- Runway management (22/04)
- Go-arounds and landing recording
- Post-landing taxi decision management

### Ground Control Page
- Aircraft taxiing management
- Student/instructor assignment
- Flight startup procedures
- Real-time flight data display

### Admin Dashboard
- User management (pending approvals)
- Instructor/Cadet management
- Aircraft inventory
- Password reset utility
- VOR configuration

## 🔐 Authentication & Roles

- **Admin**: Full system access, user management, configuration
- **Instructor**: Tower operations, ground control, flight monitoring
- **Cadet**: View-only access to home page and flight tracking
- **Pending**: Users awaiting admin approval

## 📊 Database Schema

Main tables:
- `users` - User accounts with roles
- `pilots` - Instructor and cadet profiles
- `aircraft` - Aircraft inventory
- `flights` - Flight records with positions and status
- `global_state` - System configuration (VOR location, etc.)

## 🛠️ Development

### Build for Production
```bash
npm run build
```

### Run Tests
```bash
npm test
```

### Environment Variables
Configure in `.env.local`:
```
REACT_APP_SUPABASE_URL=<your-supabase-url>
REACT_APP_SUPABASE_ANON_KEY=<your-anon-key>
```

## 📚 Key Utilities

- `flightService.js` - Flight operations (takeoff, landing, position tracking)
- `flightUtils.js` - Formatting, position conversion, phase calculations
- `AuthContext.js` - Authentication state management
- `ThemeContext.js` - Light/Dark theme management

## 🔧 Runway Configuration

Current configuration: **Runway 22/04**
- Pattern altitude: 2000 ft
- Default distance: 5 nm
- Radial assignments: Base (180°), Final (0°)

Edit `RUNWAY_PATTERNS` in `flightService.js` to modify runway configurations.

## 📈 Flight Phases

- **Taxi**: Ground movement before takeoff
- **Airborne**: In-flight operations
- **Base**: Descending towards runway
- **Final**: Final approach to runway
- **Landing**: Touchdown phase
- **After Landing Taxi**: Ground movement after landing

## 🐛 Troubleshooting

### Map Not Showing
- Verify VOR coordinates in `global_state` table
- Check Leaflet CSS is loaded (check browser DevTools)

### Flight Not Appearing
- Ensure flight status is 'air' and has position data (radial, distance)
- Check radial_deg and distance_nm fields are populated

### Authentication Issues
- Verify Supabase credentials in `.env.local`
- Check user role is set in `users` table
- Ensure user is approved by admin

## 📝 License

© 2025 ATC Tracker - Professional Flight Training System
Developed by M M Aatifullah Baig
Dedicated to NFTI - National Flight Training Institute

## 📋 Release Checklist (v1.0.0)

### Code Quality
✅ All unused imports removed  
✅ Zero compiler errors  
✅ All ESLint warnings resolved  
✅ All features properly implemented  

### Database Setup
✅ Single consolidated `DATABASE_SETUP.sql` file  
✅ Complete schema with all tables and indexes  
✅ Row Level Security (RLS) policies configured  
✅ Helper functions and auto-triggers  
✅ Real-time subscription ready  

### Documentation
✅ README.md - Complete feature guide  
✅ STARTUP.md - Quick start & deployment  
✅ DATABASE_SETUP.sql - Full database schema  

### Security
✅ Role-based access control (admin, instructor, cadet)  
✅ Email-based approval workflow  
✅ RLS protecting data at database level  
✅ Audit logging for all changes  
✅ JWT token management via Supabase Auth  

### Features Tested
✅ Home Page - Live flight tracking  
✅ Tower Page - Optimized operations (fast performance)  
✅ Ground Control - Aircraft management  
✅ Admin Dashboard - User administration  
✅ Authentication - Login/Logout working  
✅ Theme Support - Light/Dark mode  
✅ Real-time Updates - Supabase subscriptions  

### Production Deployment
1. Create Supabase project
2. Run `DATABASE_SETUP.sql` in SQL Editor
3. Create admin user in Auth Console
4. Update admin role: `UPDATE public.users SET role='admin', is_approved=TRUE WHERE email='admin@example.com'`
5. Set `.env.local` with Supabase credentials
6. Run `npm run build`
7. Deploy to Vercel, Netlify, or traditional hosting

## 🤝 Support

For issues or questions, contact the development team or submit through the system's feedback mechanism.

---

**Version**: 1.0.0  
**Status**: Production Ready  
**Last Updated**: December 2025

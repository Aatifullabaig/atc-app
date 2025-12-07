# Database Schema Fixes Completed

## Issues Fixed

### 1. **pic_id Column Mismatch**
- **Error**: `"Could not find the 'pic_id' column of 'flights' in the schema cache"`
- **Cause**: Database uses `pic` (text field), not `pic_id`
- **Fix**: Updated `flightService.js` line 601 to use `pic: creatorId` instead of `pic_id: creatorId`
- **Files Modified**: `src/lib/flightService.js`

### 2. **Aircraft Code Column Mismatch**
- **Error**: `column aircraft_1.code does not exist`
- **Cause**: Database uses `registration`, not `code`
- **Fixes**:
  - `src/lib/flightService.js` line 825: Changed `.order('code'` to `.order('registration'`
  - `src/screens/AdminDashboard.jsx`: Changed `{plane.code}` to `{plane.registration}`
  - `src/screens/HomePage.jsx`: Changed `{selectedFlight.aircraft?.code || 'N/A'}` to `{selectedFlight.aircraft?.registration || 'N/A'}`
  - `src/screens/TowerPageOptimized.jsx` (2 instances):
    - Line 213: Changed `{flight.aircraft?.code || 'N/A'}` to `{flight.aircraft?.registration || 'N/A'}`
    - Line 337: Changed Position Report title reference from `.code` to `.registration`

## Database Schema Reference

### Flights Table
- `pic` (text) - Pilot in command name/id, NOT `pic_id`
- `student_id` (uuid) - References `pilots(id)`
- `instructor_id` (uuid) - References `pilots(id)`
- `aircraft_id` (uuid) - References `aircraft(id)`

### Aircraft Table
- `registration` (text) - Aircraft registration/code, NOT `code`
- `id`, `type`, `is_active`, `created_at`, `updated_at`

### Foreign Key Relationships
- `flights.aircraft_id` → `aircraft(id)`
- `flights.student_id` → `pilots(id)`
- `flights.instructor_id` → `pilots(id)`

## Status
✅ All schema mismatches resolved
✅ Queries now match actual database structure
✅ Ready for testing with real flight data

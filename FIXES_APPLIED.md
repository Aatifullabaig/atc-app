# Database Schema Fixes Applied

## Fixed Column References

### Removed Non-Existent Columns:
- `is_in_tower` - Replaced logic with `status` column checks
- `type_of_flight` - Removed from insert
- `pic` - Removed from insert  
- `slot_order` - Removed from insert
- `ground_position` - Removed from updates
- `go_around_count` - Changed to `go_arounds`
- `altitude_ft` - Changed to `altitude_feet`
- `inbound_outbound` - Changed to `direction`
- `takeoff_at` - Changed to `airborne_at`
- `started_at` - Removed
- `shutdown_at` - Removed

### Updated Query Logic:
- `getActiveFlights()` - Fixed to include all relationship fields
- `getReadyFlights()` - Removed non-existent `slot_order` ordering
- `getGroundOpsFlights()` - Fixed filtering logic
- `getAirOpsFlights()` - Fixed filtering logic  
- `getAircraft()` - Removed `is_active` filter and `registration` ordering
- `startFlight()` - Changed from `is_in_tower` to `status` checks
- `recordTakeoff()` - Changed from `is_in_tower` to `status` checks
- `recordLanding()` - Updated to use correct columns
- `recordShutdown()` - Removed `is_in_tower` and invalid `shutdown_at`

## Database Schema Reference

### Flights Table:
- id, callsign, aircraft_id, pic_id, instructor_id
- status, phase, runway, direction
- radial_deg, distance_nm, altitude_feet
- go_arounds, airborne_at, landing_time
- completed_at, landing_count, logs
- created_at, updated_at

### Aircraft Table:
- id, code, callsign, type, manufacturer, model
- status, max_altitude, max_speed, notes
- created_at, updated_at

### Pilots Table:
- id, user_id, name, email, role
- license_number, medical_expiry
- is_active, is_approved
- created_at, updated_at

All queries now match the actual database schema defined in DATABASE_SETUP.sql

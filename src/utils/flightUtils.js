/**
 * Format flight events into readable log lines
 * Input: Array of flight_events from Supabase
 * Output: Array of formatted log strings
 *
 * Format: "HH:MM:SS — Message"
 * e.g., "19:05:09 — Taxi hold-short: P2"
 */
export const formatFlightLogs = (events) => {
  if (!Array.isArray(events)) return [];

  return events.map((event) => {
    const time = new Date(event.created_at);
    const timeStr = time.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
      timeZone: 'UTC',
    });

    return `${timeStr} — ${event.message}`;
  });
};

/**
 * Format a single flight event
 */
export const formatFlightLogEntry = (event) => {
  const time = new Date(event.created_at);
  const timeStr = time.toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
    timeZone: 'UTC',
  });

  return `${timeStr} — ${event.message}`;
};

/**
 * Get current UTC time as HH:MM:SS
 */
export const getCurrentUTCTime = () => {
  const now = new Date();
  return now.toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
    timeZone: 'UTC',
  });
};

/**
 * Convert radial + distance + altitude to a display string
 * e.g., "225° / 5 nm @ 2000 ft — RWY 22"
 */
export const formatPosition = (radial, distance, altitude, runway) => {
  if (radial === null || distance === null || altitude === null) {
    return 'No position data';
  }

  let str = `${Math.round(radial)}° / ${Number(distance).toFixed(1)} nm @ ${altitude} ft`;
  if (runway) {
    str += ` — RWY ${runway}`;
  }
  return str;
};

/**
 * Format flight summary for display
 * Example: "VTNFA — 0° / 0 nm @ 0 ft — RWY 22"
 */
export const formatFlightSummary = (flight) => {
  const registration = flight.aircraft?.registration || flight.registration || 'N/A';
  const position = formatPosition(flight.radial_deg, flight.distance_nm, flight.altitude_ft, flight.runway_in_use);
  return `${registration} — ${position}`;
};

/**
 * Get status badge color
 */
export const getStatusColor = (status) => {
  const colors = {
    draft: 'bg-gray-200 text-gray-800',
    ready: 'bg-yellow-200 text-yellow-800',
    tower: 'bg-blue-200 text-blue-800',
    air: 'bg-green-200 text-green-800',
    completed: 'bg-slate-200 text-slate-800',
  };
  return colors[status] || 'bg-gray-200 text-gray-800';
};

/**
 * Get phase badge color
 */
export const getPhaseColor = (phase) => {
  const colors = {
    on_ground: 'bg-slate-100 text-slate-700',
    taxi: 'bg-amber-100 text-amber-700',
    airborne: 'bg-sky-100 text-sky-700',
    upwind: 'bg-blue-100 text-blue-700',
    crosswind: 'bg-indigo-100 text-indigo-700',
    downwind: 'bg-purple-100 text-purple-700',
    deadside: 'bg-fuchsia-100 text-fuchsia-700',
    base: 'bg-orange-100 text-orange-700',
    final: 'bg-red-100 text-red-700',
    overhead: 'bg-teal-100 text-teal-700',
    approach: 'bg-orange-100 text-orange-700',
    landing: 'bg-red-100 text-red-700',
    shutdown: 'bg-slate-100 text-slate-700',
  };
  return colors[phase] || 'bg-gray-100 text-gray-700';
};

/**
 * Parse position data from meta
 */
export const parsePositionFromMeta = (meta) => {
  if (!meta) return null;

  try {
    if (typeof meta === 'string') {
      meta = JSON.parse(meta);
    }

    return {
      radial: meta.radial,
      distance: meta.distanceNm,
      altitude: meta.altitudeFt,
      direction: meta.direction,
      phase: meta.phaseTag,
    };
  } catch (e) {
    console.error('Error parsing position meta:', e);
    return null;
  }
};

/**
 * Format runway display
 */
export const formatRunway = (runway) => {
  if (!runway) return 'N/A';
  return `RWY ${runway}`;
};

/**
 * Get display name for pilot
 */
export const getPilotDisplayName = (pilot) => {
  if (!pilot) return 'N/A';
  return pilot.short_name || pilot.name || 'N/A';
};

/**
 * Get display name for aircraft
 */
export const getAircraftDisplayName = (aircraft) => {
  if (!aircraft) return 'N/A';
  return aircraft.registration || 'N/A';
};

/**
 * Convert radial + distance from VOR to lat/lon
 * FIXED: Accepts individual parameters (lat, lng, radialDeg, distanceNm)
 */
export const convertPolarToLatLon = (vorLat, vorLng, radialDeg, distanceNm) => {
  if (vorLat === null || vorLng === null || radialDeg === null || distanceNm === null) {
    return null;
  }

  // Haversine formula constants
  const R = 3440.065; // Earth radius in nautical miles
  const lat1 = (vorLat * Math.PI) / 180;
  const lon1 = (vorLng * Math.PI) / 180;
  const bearing = (radialDeg * Math.PI) / 180;
  const d = distanceNm / R;

  const lat2 = Math.asin(
    Math.sin(lat1) * Math.cos(d) +
    Math.cos(lat1) * Math.sin(d) * Math.cos(bearing)
  );

  const lon2 =
    lon1 +
    Math.atan2(
      Math.sin(bearing) * Math.sin(d) * Math.cos(lat1),
      Math.cos(d) - Math.sin(lat1) * Math.sin(lat2)
    );

  return {
    lat: (lat2 * 180) / Math.PI,
    lng: (lon2 * 180) / Math.PI,
  };
};

/**
 * Check if a transition is valid
 */
export const isValidTransition = (currentStatus, currentPhase, targetStatus, targetPhase) => {
  // Add your validation logic here
  const validStatusTransitions = {
    draft: ['ready'],
    ready: ['tower', 'draft'],
    tower: ['air'],
    air: ['tower'],
  };

  return validStatusTransitions[currentStatus]?.includes(targetStatus) ?? false;
};

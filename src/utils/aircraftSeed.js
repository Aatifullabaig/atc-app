// Utility to seed N aircraft with radial/distance/altitude relative to a configurable VOR
const VOR_COORD = { lat: 21.532, lon: 80.293 }; // GDA VOR at Birsi Airport (VAGD)

function rand(min, max) {
  return Math.random() * (max - min) + min;
}

function nmToMeters(nm) {
  return nm * 1852;
}

// Compute destination lat/lon given start lat/lon, bearing (degrees) and distance (meters)
function destinationPoint(lat, lon, bearingDeg, distanceMeters) {
  const R = 6371000; // earth radius meters
  const bearing = (bearingDeg * Math.PI) / 180;
  const lat1 = (lat * Math.PI) / 180;
  const lon1 = (lon * Math.PI) / 180;
  const dR = distanceMeters / R;

  const lat2 = Math.asin(
    Math.sin(lat1) * Math.cos(dR) + Math.cos(lat1) * Math.sin(dR) * Math.cos(bearing)
  );
  const lon2 = lon1 + Math.atan2(
    Math.sin(bearing) * Math.sin(dR) * Math.cos(lat1),
    Math.cos(dR) - Math.sin(lat1) * Math.sin(lat2)
  );

  return { lat: (lat2 * 180) / Math.PI, lon: (lon2 * 180) / Math.PI };
}

export function seedAircraft(n = 14) {
  const arr = [];
  for (let i = 0; i < n; i++) {
    const callsign = `VTNFA${String(i + 1).padStart(2, '0')}`;
    const radial = Math.round(rand(0, 359));
    const distanceNm = Math.round(rand(1, 25) * 10) / 10; // 0.1 nm resolution
    const altitudeFeet = Math.round(rand(500, 8500));
    const phase = ['enroute', 'inbound', 'outbound', 'taxi', 'landing', 'holding'][
      Math.floor(rand(0, 6))
    ];
    const pos = destinationPoint(VOR_COORD.lat, VOR_COORD.lon, radial, nmToMeters(distanceNm));

    arr.push({
      id: callsign,
      callsign,
      radial,
      distanceNm,
      altitudeFeet,
      phase,
      runway: Math.random() > 0.5 ? '22' : '04',
      sector: ['N', 'E', 'SE', 'S', 'W', 'NW', 'OVERHEAD'][Math.floor(rand(0, 7))],
      lat: pos.lat,
      lon: pos.lon,
      pic: { name: null, contact: null },
      estArrival: null,
      estDeparture: null,
      profile: 'default',
      logs: [],
      isAirborne: Math.random() > 0.5,
      goArounds: 0,
      scheduledStartup: null,
      exerciseType: null,
      route: null,
      sequenceSlot: null,
      scheduledForTower: false,
      startupMarkedAt: null,
      takeoffTime: null,
      landingTime: null,
      touchAndGoCount: 0
    });
  }
  return arr;
}

export const VOR = VOR_COORD;

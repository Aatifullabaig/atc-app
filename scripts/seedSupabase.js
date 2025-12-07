#!/usr/bin/env node
/*
  Seed script for Supabase aircraft table.
  Usage:
    - Create a `.env.local` at project root with REACT_APP_SUPABASE_URL and REACT_APP_SUPABASE_ANON_KEY
      or export these env vars in your shell.
    - Run: `node scripts/seedSupabase.js` or `npm run seed:supabase` (added in package.json)
*/

const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
require('dotenv').config({ path: '.env.local' });

const SUPABASE_URL = process.env.REACT_APP_SUPABASE_URL || process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.REACT_APP_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('Missing Supabase URL or ANON key. Set REACT_APP_SUPABASE_URL and REACT_APP_SUPABASE_ANON_KEY in .env.local or environment.');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

function rand(min, max) {
  return Math.random() * (max - min) + min;
}

function nmToMeters(nm) {
  return nm * 1852;
}

function destinationPoint(lat, lon, bearingDeg, distanceMeters) {
  const R = 6371000;
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

const VOR = { lat: 21.4500, lon: 80.2000 };

function makeAircraft(i) {
  const callsign = `VTNFA${String(i + 1).padStart(2, '0')}`;
  const radial = Math.round(rand(0, 359));
  const distanceNm = Math.round(rand(1, 25) * 10) / 10;
  const altitudeFeet = Math.round(rand(500, 8500));
  const phase = ['enroute', 'inbound', 'outbound', 'taxi', 'landing', 'holding'][Math.floor(rand(0, 6))];
  const pos = destinationPoint(VOR.lat, VOR.lon, radial, nmToMeters(distanceNm));
  return {
    callsign,
    radial,
    distance_nm: distanceNm,
    altitude_feet: altitudeFeet,
    phase,
    runway: Math.random() > 0.5 ? '22' : '04',
    sector: ['N', 'E', 'SE', 'S', 'W', 'NW', 'OVERHEAD'][Math.floor(rand(0, 7))],
    lat: pos.lat,
    lon: pos.lon,
    pic: { name: null, contact: null },
    est_arrival: null,
    est_departure: null,
    profile: 'default',
    logs: [],
    is_airborne: Math.random() > 0.5,
    go_arounds: 0,
    scheduled_startup: null,
    last_updated_by: null,
    last_updated_at: null
  };
}

async function seed(n = 14) {
  const rows = [];
  for (let i = 0; i < n; i++) rows.push(makeAircraft(i));

  console.log(`Inserting ${rows.length} aircraft into Supabase at ${SUPABASE_URL}`);
  const { data, error } = await supabase.from('aircraft').insert(rows).select();
  if (error) {
    console.error('Insert error:', error.message || error);
    process.exit(1);
  }
  console.log(`Inserted ${data.length} rows.`);
  // write a local copy for reference
  fs.writeFileSync('seeded_aircraft.json', JSON.stringify(data, null, 2));
  console.log('Wrote seeded_aircraft.json');
}

seed().then(() => process.exit(0)).catch(err => { console.error(err); process.exit(1); });

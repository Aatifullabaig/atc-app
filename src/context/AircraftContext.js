import React, { createContext, useContext, useEffect, useState } from 'react';
import { seedAircraft, VOR } from '../utils/aircraftSeed';
import { supabase } from '../lib/supabase';

const AircraftContext = createContext(null);

export function AircraftProvider({ children }) {
  const [aircraft, setAircraft] = useState([]);

  // Normalize a DB row into client-friendly shape
  const normalizeRow = (d) => {
    if (!d) return null;
    const safeParse = (val) => {
      if (val === null || val === undefined) return null;
      if (typeof val === 'object') return val;
      if (typeof val === 'string') {
        try { return JSON.parse(val); } catch (e) { return { name: val }; }
      }
      return val;
    };

    const rawPic = d.pic ?? d.PIC ?? null;
    const pic = safeParse(rawPic) || (rawPic ? { name: rawPic } : null);
    let logs = d.logs ?? [];
    if (typeof logs === 'string') {
      try { logs = JSON.parse(logs); } catch (e) { logs = []; }
    }

    return ({
      id: d.id,
      callsign: d.callsign,
      radial: d.radial,
      distanceNm: d.distance_nm ?? d.distanceNm,
      distance_nm: d.distance_nm ?? d.distanceNm,
      altitudeFeet: d.altitude_feet ?? d.altitudeFeet,
      altitude_feet: d.altitude_feet ?? d.altitudeFeet,
      phase: d.phase,
      runway: d.runway,
      sector: d.sector,
      lat: d.lat,
      lon: d.lon,
      pic,
      estArrival: d.est_arrival ? new Date(d.est_arrival).getTime() : d.est_arrival || null,
      estArrival_raw: d.est_arrival,
      estDeparture: d.est_departure ? new Date(d.est_departure).getTime() : d.est_departure || null,
      estDeparture_raw: d.est_departure,
      profile: d.profile,
      logs: Array.isArray(logs) ? logs : [],
      isAirborne: d.is_airborne ?? d.isAirborne,
      goArounds: d.go_arounds ?? d.goArounds,
      scheduledStartup: d.scheduled_startup ? new Date(d.scheduled_startup).getTime() : d.scheduled_startup || null,
      lastUpdatedBy: d.last_updated_by || d.lastUpdatedBy,
      lastUpdatedAt: d.last_updated_at ? new Date(d.last_updated_at).getTime() : d.lastUpdated_at || null,
      aircraft_type: d.aircraft_type,
      aircraftType: d.aircraft_type,
      p3: d.p3,
      flight_level: d.flight_level,
      flightLevel: d.flight_level,
      overfly: d.overfly,
      sequence_slot: d.sequence_slot,
      sequenceSlot: d.sequence_slot,
      slot_status: d.slot_status,
      slotStatus: d.slot_status,
      takeoff_time: d.takeoff_time,
      takeoffTime: d.takeoff_time ? new Date(d.takeoff_time).getTime() : null,
      landing_time: d.landing_time,
      landingTime: d.landing_time ? new Date(d.landing_time).getTime() : null,
      landing_count: d.landing_count,
      landingCount: d.landing_count,
      touch_and_go_count: d.touch_and_go_count,
      touchAndGoCount: d.touch_and_go_count,
      scheduled_for_tower: d.scheduled_for_tower,
      scheduledForTower: d.scheduled_for_tower,
      exercise_type: d.exercise_type,
      exerciseType: d.exercise_type,
      route: d.route,
      // include raw DB row for debugging if needed
      _raw: d
    });
  };

  useEffect(() => {
    async function init() {
      // If Supabase configured, load aircraft from DB, otherwise seed localStorage
      try {
        if (process.env.REACT_APP_SUPABASE_URL && process.env.REACT_APP_SUPABASE_ANON_KEY) {
          console.log('AircraftContext: attempting to load aircraft from Supabase', { url: process.env.REACT_APP_SUPABASE_URL });
          
          // Test connection with a simple query
          const { error: testError } = await supabase.from('aircraft').select('count', { count: 'exact' });
          if (testError) {
            console.error('AircraftContext: Supabase connection test failed:', testError);
          } else {
            console.log('AircraftContext: Supabase connected successfully');
          }
          
          const { data, error } = await supabase.from('aircraft').select('*');
          if (error) {
            console.warn('AircraftContext: Supabase select error', error);
          } else if (Array.isArray(data) && data.length) {
            // helper to safely parse possible JSON fields coming from Supabase
            const safeParse = (val) => {
              if (val === null || val === undefined) return null;
              if (typeof val === 'object') return val;
              if (typeof val === 'string') {
                try {
                  return JSON.parse(val);
                } catch (e) {
                  // not JSON — wrap into object for compatibility
                  return { name: val };
                }
              }
              return val;
            };

            // normalize snake_case -> camelCase for client, with robust parsing
            const normalized = data.map(d => {
              const rawPic = d.pic ?? d.PIC ?? null;
              const pic = safeParse(rawPic) || { name: rawPic || null, contact: null };
              let logs = d.logs ?? [];
              if (typeof logs === 'string') {
                try { logs = JSON.parse(logs); } catch (e) { logs = []; }
              }

              return ({
                id: d.id,
                callsign: d.callsign,
                radial: d.radial,
                distanceNm: d.distance_nm ?? d.distanceNm,
                distance_nm: d.distance_nm ?? d.distanceNm,
                altitudeFeet: d.altitude_feet ?? d.altitudeFeet,
                altitude_feet: d.altitude_feet ?? d.altitudeFeet,
                phase: d.phase,
                runway: d.runway,
                sector: d.sector,
                lat: d.lat,
                lon: d.lon,
                pic,
                estArrival: d.est_arrival ? new Date(d.est_arrival).getTime() : d.est_arrival || null,
                estArrival_raw: d.est_arrival,
                estDeparture: d.est_departure ? new Date(d.est_departure).getTime() : d.est_departure || null,
                estDeparture_raw: d.est_departure,
                profile: d.profile,
                logs: Array.isArray(logs) ? logs : [],
                isAirborne: d.is_airborne ?? d.isAirborne,
                goArounds: d.go_arounds ?? d.goArounds,
                scheduledStartup: d.scheduled_startup ? new Date(d.scheduled_startup).getTime() : d.scheduled_startup || null,
                lastUpdatedBy: d.last_updated_by || d.lastUpdatedBy,
                lastUpdatedAt: d.last_updated_at ? new Date(d.last_updated_at).getTime() : d.lastUpdated_at || null,
                // New fields
                aircraft_type: d.aircraft_type,
                aircraftType: d.aircraft_type,
                p3: d.p3,
                flight_level: d.flight_level,
                flightLevel: d.flight_level,
                overfly: d.overfly,
                sequence_slot: d.sequence_slot,
                sequenceSlot: d.sequence_slot,
                slot_status: d.slot_status,
                slotStatus: d.slot_status,
                takeoff_time: d.takeoff_time,
                takeoffTime: d.takeoff_time ? new Date(d.takeoff_time).getTime() : null,
                landing_time: d.landing_time,
                landingTime: d.landing_time ? new Date(d.landing_time).getTime() : null,
                landing_count: d.landing_count,
                landingCount: d.landing_count,
                touch_and_go_count: d.touch_and_go_count,
                touchAndGoCount: d.touch_and_go_count,
                scheduled_for_tower: d.scheduled_for_tower,
                scheduledForTower: d.scheduled_for_tower,
                exercise_type: d.exercise_type,
                exerciseType: d.exercise_type,
                route: d.route
              });
            });
            console.log('AircraftContext: loaded', normalized.length, 'rows from Supabase');
            setAircraft(normalized);
            return;
          } else {
            console.log('AircraftContext: no rows returned from Supabase, this may be expected on a fresh database.');
          }
        }
      } catch (e) {
        console.error('AircraftContext: error loading from Supabase', e);
      }

      const stored = localStorage.getItem('atc_aircraft');
      if (stored) setAircraft(JSON.parse(stored));
      else {
        const seed = seedAircraft(14);
        setAircraft(seed);
        localStorage.setItem('atc_aircraft', JSON.stringify(seed));
      }
    }

    init();
  }, []);

  useEffect(() => {
    localStorage.setItem('atc_aircraft', JSON.stringify(aircraft));
  }, [aircraft]);

  useEffect(() => {
    // Set up Supabase realtime listener for aircraft table when configured
    let channel;
    async function setupRealtime() {
      try {
        if (!(process.env.REACT_APP_SUPABASE_URL && process.env.REACT_APP_SUPABASE_ANON_KEY)) return;
        channel = supabase
          .channel('public:aircraft')
          .on('postgres_changes', { event: '*', schema: 'public', table: 'aircraft' }, payload => {
            console.log('Supabase realtime event received:', payload); // <-- Add this log
            const evt = payload.eventType;
            const record = payload.new || payload.old;
            if (!record?.id) {
               console.warn('Realtime event is missing an ID, skipping:', record);
               return;
            }
            if (evt === 'INSERT') setAircraft(prev => [normalizeRow(record), ...prev]);
            else if (evt === 'UPDATE') setAircraft(prev => prev.map(a => (a.id === record.id ? normalizeRow(record) : a)));
            else if (evt === 'DELETE') setAircraft(prev => prev.filter(a => a.id !== record.id));
          })
          .subscribe();
      } catch (e) {
        // ignore realtime when not available
      }
    }

    setupRealtime();
    return () => {
      if (channel && channel.unsubscribe) channel.unsubscribe();
    };
  }, []);

function toDbPatch(patch) {
    const dbPatch = { ...patch };
  
    if (dbPatch.distanceNm !== undefined) {
      dbPatch.distance_nm = dbPatch.distanceNm;
      delete dbPatch.distanceNm;
    }
    if (dbPatch.altitudeFeet !== undefined) {
      dbPatch.altitude_feet = dbPatch.altitudeFeet;
      delete dbPatch.altitudeFeet;
    }
    if (dbPatch.isAirborne !== undefined) {
      dbPatch.is_airborne = dbPatch.isAirborne;
      delete dbPatch.isAirborne;
    }
    if (dbPatch.goArounds !== undefined) {
      dbPatch.go_arounds = dbPatch.goArounds;
      delete dbPatch.goArounds;
    }
    if (dbPatch.estArrival !== undefined) {
      dbPatch.est_arrival = dbPatch.estArrival;
      delete dbPatch.estArrival;
    }
    if (dbPatch.estDeparture !== undefined) {
      dbPatch.est_departure = dbPatch.estDeparture;
      delete dbPatch.estDeparture;
    }
    if (dbPatch.scheduledStartup !== undefined) {
      dbPatch.scheduled_startup = dbPatch.scheduledStartup;
      delete dbPatch.scheduledStartup;
    }
    if (dbPatch.lastUpdatedBy !== undefined) {
      dbPatch.last_updated_by = dbPatch.lastUpdatedBy;
      delete dbPatch.lastUpdatedBy;
    }
    if (dbPatch.lastUpdatedAt !== undefined) {
      dbPatch.last_updated_at = dbPatch.lastUpdatedAt;
      delete dbPatch.lastUpdatedAt;
    }
    if (dbPatch.takeoffTime !== undefined) {
      dbPatch.takeoff_time = dbPatch.takeoffTime;
      delete dbPatch.takeoffTime;
    }
    if (dbPatch.landingTime !== undefined) {
      dbPatch.landing_time = dbPatch.landingTime;
      delete dbPatch.landingTime;
    }
    if (dbPatch.landingCount !== undefined) {
      dbPatch.landing_count = dbPatch.landingCount;
      delete dbPatch.landingCount;
    }
    if (dbPatch.touchAndGoCount !== undefined) {
      dbPatch.touch_and_go_count = dbPatch.touchAndGoCount;
      delete dbPatch.touchAndGoCount;
    }
    if (dbPatch.scheduledForTower !== undefined) {
      dbPatch.scheduled_for_tower = dbPatch.scheduledForTower;
      delete dbPatch.scheduledForTower;
    }
    if (dbPatch.aircraftType !== undefined) {
      dbPatch.aircraft_type = dbPatch.aircraftType;
      delete dbPatch.aircraftType;
    }
    if (dbPatch.sequenceSlot !== undefined) {
      dbPatch.sequence_slot = dbPatch.sequenceSlot;
      delete dbPatch.sequenceSlot;
    }
    if (dbPatch.slotStatus !== undefined) {
      dbPatch.slot_status = dbPatch.slotStatus;
      delete dbPatch.slotStatus;
    }
    if (dbPatch.exerciseType !== undefined) {
      dbPatch.exercise_type = dbPatch.exerciseType;
      delete dbPatch.exerciseType;
    }
  
    return dbPatch;
  }

  async function updateAircraft(id, patch) {
    // Update local state immediately for responsiveness
    setAircraft(prev => prev.map(a => (a.id === id ? { ...a, ...patch } : a)));

    // Update Supabase if configured
    if (process.env.REACT_APP_SUPABASE_URL && process.env.REACT_APP_SUPABASE_ANON_KEY) {
      try {
        const dbPatch = toDbPatch(patch);
        dbPatch.last_updated_at = new Date().toISOString();
        
        console.log('updateAircraft: sending to Supabase:', { id, dbPatch });
        const { error } = await supabase.from('aircraft').update(dbPatch).eq('id', id);
        if (error) {
          console.error('updateAircraft: Supabase error:', error.code, error.message);
        } else {
          console.log('updateAircraft: successfully updated in Supabase');
        }
      } catch (e) {
        console.error('updateAircraft: exception:', e.message);
      }
    }
  }

  async function updateAircrafts(aircraftIds, patch) {
    // Update local state
    setAircraft(prev => prev.map(a => (aircraftIds.includes(a.id) ? { ...a, ...patch } : a)));

    // Update Supabase
    if (process.env.REACT_APP_SUPABASE_URL && process.env.REACT_APP_SUPABASE_ANON_KEY) {
      try {
        const dbPatch = toDbPatch(patch);
        dbPatch.last_updated_at = new Date().toISOString();

        const { error } = await supabase.from('aircraft').update(dbPatch).in('id', aircraftIds);
        if (error) {
          console.error('updateAircrafts: Supabase error:', error.message);
        }
      } catch (e) {
        console.error('updateAircrafts: exception:', e.message);
      }
    }
  }

  async function addLog(id, entry) {
    const newLog = { ts: Date.now(), entry };
    setAircraft(prev =>
      prev.map(a => (a.id === id ? { ...a, logs: [newLog, ...(a.logs || [])] } : a))
    );

    // Update Supabase if configured
    if (process.env.REACT_APP_SUPABASE_URL && process.env.REACT_APP_SUPABASE_ANON_KEY) {
      try {
        const currentAircraft = aircraft.find(a => a.id === id);
        const updatedLogs = [newLog, ...(currentAircraft?.logs || [])];
        const { error } = await supabase.from('aircraft').update({ logs: updatedLogs, last_updated_at: new Date().toISOString() }).eq('id', id);
        if (error) {
          console.error('Supabase update failed for addLog:', error);
        }
      } catch (e) {
        console.error('Error updating logs in Supabase:', e);
      }
    }
  }

  function setETA(id, { estArrival = null, estDeparture = null }) {
    const patch = { estArrival, estDeparture };
    setAircraft(prev => prev.map(a => (a.id === id ? { ...a, ...patch } : a)));
    updateAircraft(id, patch);
  }

  function setScheduledStartup(id, when) {
    setAircraft(prev => prev.map(a => (a.id === id ? { ...a, scheduledStartup: when } : a)));
  }

  function scheduleSequence(id, { sequenceSlot = null, exerciseType = null, route = null, pic = null }) {
    const currentAircraft = aircraft.find(a => a.id === id);
    const patch = {
      sequenceSlot,
      exerciseType,
      route,
      pic: pic || currentAircraft?.pic,
      scheduledStartup: currentAircraft?.scheduledStartup || null
    };
    setAircraft(prev =>
      prev.map(a =>
        a.id === id
          ? { ...a, ...patch }
          : a
      )
    );
    updateAircraft(id, patch);
  }

  function addWaypoint(id, waypoint) {
    // waypoint: { radial, distanceNm, altitudeFeet, outbound: bool, desc }
    setAircraft(prev =>
      prev.map(a => (a.id === id ? { ...a, routeWaypoints: [...(a.routeWaypoints || []), waypoint] } : a))
    );
    addLog(id, `Waypoint added: ${waypoint.radial}°/${waypoint.distanceNm}nm ${waypoint.outbound ? 'outbound' : 'inbound'}`);
  }

  function reportPosition(id, { radial, distanceNm, altitudeFeet, outbound = true }) {
    const when = Date.now();

    // helpers to compute lat/lon from VOR radial/distance
    function nmToMeters(nm) { return nm * 1852; }
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

    // compute absolute position relative to VOR if available
    let pos = null;
    try {
      const meters = nmToMeters(distanceNm || 0);
      pos = destinationPoint(VOR.lat, VOR.lon, radial || 0, meters);
    } catch (e) {
      pos = null;
    }

    console.debug('reportPosition computed', { id, radial, distanceNm, altitudeFeet, outbound, pos });
    setAircraft(prev =>
      prev.map(a =>
        a.id === id
          ? {
              ...a,
              lastReported: { radial, distanceNm, altitudeFeet, outbound, ts: when, lat: pos?.lat, lon: pos?.lon },
              // keep history small
              reports: [{ radial, distanceNm, altitudeFeet, outbound, ts: when, lat: pos?.lat, lon: pos?.lon }, ...(a.reports || [])].slice(0, 20)
            }
          : a
      )
    );
    addLog(id, `Position report: ${radial}°/${distanceNm}nm @ ${altitudeFeet}ft (${outbound ? 'outbound' : 'inbound'})`);
  }

  function getNextSequence(currentSlot = 0) {
    // return aircraft with smallest sequenceSlot > currentSlot
    const slots = aircraft
      .filter(a => typeof a.sequenceSlot === 'number' && a.sequenceSlot > currentSlot)
      .sort((x, y) => x.sequenceSlot - y.sequenceSlot);
    return slots.length ? slots[0] : null;
  }

  function pushToTower(id) {
    const patch = { scheduledForTower: true, startupMarkedAt: Date.now(), slotStatus: 'pushed_to_tower', slot_status: 'pushed_to_tower' };
    setAircraft(prev => prev.map(a => (a.id === id ? { ...a, ...patch } : a)));

    if (process.env.REACT_APP_SUPABASE_URL && process.env.REACT_APP_SUPABASE_ANON_KEY) {
      const dbPatch = {
        scheduled_for_tower: patch.scheduledForTower,
        startup_marked_at: patch.startupMarkedAt,
        slot_status: patch.slot_status,
        last_updated_at: new Date().toISOString(),
      };
      supabase.from('aircraft').update(dbPatch).eq('id', id).then(({ error }) => {
        if (error) {
          console.error('pushToTower: Supabase error:', error.message);
        }
      });
    }

    addLog(id, `Pushed to tower for startup`);
  }

  function setAirborne(id, isAirborne, timestamp = Date.now()) {
    const patch = { isAirborne, estDeparture: isAirborne ? timestamp : null, estArrival: !isAirborne ? timestamp : null, phase: isAirborne ? 'airborne' : 'landed' };
    console.debug('setAirborne called', { id, isAirborne, timestamp, patch });
    setAircraft(prev => {
      const next = prev.map(a =>
        a.id === id
          ? {
              ...a,
              ...patch
            }
          : a
      );
      // log the updated aircraft for debugging
      const updated = next.find(x => x.id === id);
      console.debug('setAirborne updated aircraft', updated);
      if (!updated) {
        console.error('setAirborne: aircraft not found with id', id);
      }
      return next;
    });

    if (process.env.REACT_APP_SUPABASE_URL && process.env.REACT_APP_SUPABASE_ANON_KEY) {
      const dbPatch = {
        is_airborne: patch.isAirborne,
        est_departure: patch.estDeparture,
        est_arrival: patch.estArrival,
        phase: patch.phase,
        last_updated_at: new Date().toISOString(),
      };
      supabase.from('aircraft').update(dbPatch).eq('id', id).then(({ error }) => {
        if (error) {
          console.error('setAirborne: Supabase error:', error.message);
        }
      });
    }
  }

  function markTakeoff(id, timestamp = Date.now()) {
    const patch = { takeoffTime: timestamp, isAirborne: true, scheduledForTower: false, phase: 'airborne' };
    console.debug('markTakeoff called', { id, timestamp, patch });
    setAircraft(prev => {
      const next = prev.map(a => (a.id === id ? { ...a, ...patch } : a));
      const updated = next.find(x => x.id === id);
      console.debug('markTakeoff updated aircraft', updated);
      return next;
    });

    if (process.env.REACT_APP_SUPABASE_URL && process.env.REACT_APP_SUPABASE_ANON_KEY) {
      const dbPatch = {
        takeoff_time: patch.takeoffTime,
        is_airborne: patch.isAirborne,
        scheduled_for_tower: patch.scheduledForTower,
        phase: patch.phase,
        last_updated_at: new Date().toISOString(),
      };
      supabase.from('aircraft').update(dbPatch).eq('id', id).then(({ error }) => {
        if (error) {
          console.error('markTakeoff: Supabase error:', error.message);
        }
      });
    }

    addLog(id, `Takeoff recorded at ${new Date(timestamp).toISOString()}`);
  }

  function editTakeoffTime(id, timestamp) {
    setAircraft(prev => prev.map(a => (a.id === id ? { ...a, takeoffTime: timestamp, isAirborne: true } : a)));
    addLog(id, `Takeoff time edited to ${timestamp ? new Date(timestamp).toISOString() : 'nil'}`);
  }

  function markLanding(id, timestamp = Date.now()) {
    const patch = { landingTime: timestamp, isAirborne: false, phase: 'landed' };
    console.debug('markLanding called', { id, timestamp, patch });
    setAircraft(prev => {
      const next = prev.map(a => (a.id === id ? { ...a, ...patch } : a));
      const updated = next.find(x => x.id === id);
      console.debug('markLanding updated aircraft', updated);
      return next;
    });

    if (process.env.REACT_APP_SUPABASE_URL && process.env.REACT_APP_SUPABASE_ANON_KEY) {
      const dbPatch = {
        landing_time: patch.landingTime,
        is_airborne: patch.isAirborne,
        phase: patch.phase,
        last_updated_at: new Date().toISOString(),
      };
      supabase.from('aircraft').update(dbPatch).eq('id', id).then(({ error }) => {
        if (error) {
          console.error('markLanding: Supabase error:', error.message);
        }
      });
    }

    addLog(id, `Landed at ${new Date(timestamp).toISOString()}`);
  }

  function recordTouchAndGo(id) {
    setAircraft(prev => prev.map(a => (a.id === id ? { ...a, touchAndGoCount: (a.touchAndGoCount || 0) + 1 } : a)));
    addLog(id, `Touch-and-go recorded`);
  }

  function incrementGoAround(id) {
    const aircraftToUpdate = aircraft.find(ac => ac.id === id);
    const newGoArounds = (aircraftToUpdate?.goArounds || 0) + 1;
    const patch = { goArounds: newGoArounds };
    setAircraft(prev => prev.map(a => (a.id === id ? { ...a, ...patch } : a)));
    updateAircraft(id, patch);
  }

  function setTaxiHoldShort(id, holdPoint) {
    // holdPoint: 'P1', 'P2', ..., 'P6', 'apron', or null
    // when on ground, set altitude=0, distance=0, radial=null
    const patch = { taxiHoldShort: holdPoint, altitudeFeet: 0, distanceNm: 0, radial: null, phase: 'taxi' };
    setAircraft(prev =>
      prev.map(a =>
        a.id === id
          ? { ...a, ...patch }
          : a
      )
    );

    if (process.env.REACT_APP_SUPABASE_URL && process.env.REACT_APP_SUPABASE_ANON_KEY) {
      const dbPatch = {
        taxi_hold_short: patch.taxiHoldShort,
        altitude_feet: patch.altitudeFeet,
        distance_nm: patch.distanceNm,
        radial: patch.radial,
        phase: patch.phase,
        last_updated_at: new Date().toISOString(),
      };
      supabase.from('aircraft').update(dbPatch).eq('id', id).then(({ error }) => {
        if (error) {
          console.error('setTaxiHoldShort: Supabase error:', error.message);
        }
      });
    }

    addLog(id, `Taxi hold-short: ${holdPoint}`);
  }

  function incrementLanding(id) {
    const aircraftToUpdate = aircraft.find(ac => ac.id === id);
    const newLandingCount = (aircraftToUpdate?.landingCount || 0) + 1;
    const patch = { landingCount: newLandingCount };
    console.debug('incrementLanding called', { id, patch });
    setAircraft(prev => {
      const next = prev.map(a => (a.id === id ? { ...a, ...patch } : a));
      const updated = next.find(x => x.id === id);
      console.debug('incrementLanding updated aircraft', updated);
      return next;
    });

    if (process.env.REACT_APP_SUPABASE_URL && process.env.REACT_APP_SUPABASE_ANON_KEY) {
      const dbPatch = {
        landing_count: patch.landingCount,
        last_updated_at: new Date().toISOString(),
      };
      supabase.from('aircraft').update(dbPatch).eq('id', id).then(({ error }) => {
        if (error) {
          console.error('incrementLanding: Supabase error:', error.message);
        }
      });
    }

    addLog(id, `Landing recorded (total: ${newLandingCount})`);
  }

  function completeFlight(id) {
    const ts = Date.now();
    const patch = {
      slotStatus: 'completed',
      landingTime: ts,
      isAirborne: false,
      scheduledForTower: false,
      landingCount: (aircraft.find(a => a.id === id)?.landingCount || 0) + 1,
      phase: 'landed'
    };
    setAircraft(prev =>
      prev.map(a =>
        a.id === id
          ? { ...a, ...patch }
          : a
      )
    );

    if (process.env.REACT_APP_SUPABASE_URL && process.env.REACT_APP_SUPABASE_ANON_KEY) {
      const dbPatch = {
        slot_status: patch.slotStatus,
        landing_time: patch.landingTime,
        is_airborne: patch.isAirborne,
        scheduled_for_tower: patch.scheduledForTower,
        landing_count: patch.landingCount,
        phase: patch.phase,
        last_updated_at: new Date().toISOString(),
      };
      supabase.from('aircraft').update(dbPatch).eq('id', id).then(({ error }) => {
        if (error) {
          console.error('completeFlight: Supabase error:', error.message);
        }
      });
    }

    addLog(id, `Flight completed at ${new Date(ts).toISOString()}`);
  }

  function pushOutOfTower(id) {
    // move aircraft back to Ground control (clear tower status)
    const patch = { scheduledForTower: false, taxiHoldShort: null, altitudeFeet: 0, distanceNm: 0, radial: null, phase: 'taxi' };
    setAircraft(prev =>
      prev.map(a =>
        a.id === id
          ? { ...a, ...patch }
          : a
      )
    );

    if (process.env.REACT_APP_SUPABASE_URL && process.env.REACT_APP_SUPABASE_ANON_KEY) {
      const dbPatch = {
        scheduled_for_tower: patch.scheduledForTower,
        taxi_hold_short: patch.taxiHoldShort,
        altitude_feet: patch.altitudeFeet,
        distance_nm: patch.distanceNm,
        radial: patch.radial,
        phase: patch.phase,
        last_updated_at: new Date().toISOString(),
      };
      supabase.from('aircraft').update(dbPatch).eq('id', id).then(({ error }) => {
        if (error) {
          console.error('pushOutOfTower: Supabase error:', error.message);
        }
      });
    }

    addLog(id, `Pushed out of Tower to Ground`);
  }

  function shutdownAircraft(id) {
    const patch = { altitudeFeet: 0, distanceNm: 0, radial: null, isAirborne: false, scheduledForTower: false, slotStatus: 'completed', slot_status: 'completed' };
    setAircraft(prev =>
      prev.map(a =>
        a.id === id
          ? { ...a, ...patch }
          : a
      )
    );

    setPhase(id, 'shutdown');

    if (process.env.REACT_APP_SUPABASE_URL && process.env.REACT_APP_SUPABASE_ANON_KEY) {
      const dbPatch = {
        altitude_feet: patch.altitudeFeet,
        distance_nm: patch.distanceNm,
        radial: patch.radial,
        is_airborne: patch.isAirborne,
        scheduled_for_tower: patch.scheduledForTower,
        slot_status: patch.slot_status,
        last_updated_at: new Date().toISOString(),
      };
      supabase.from('aircraft').update(dbPatch).eq('id', id).then(({ error }) => {
        if (error) {
          console.error('shutdownAircraft: Supabase error:', error.message);
        }
      });
    }

    addLog(id, `Aircraft shutdown at apron`);
  }

  async function addAircraft(record) {
    const tempId = `temp-${Date.now()}`;
    const rec = { ...record, id: tempId };

    // Add to local state immediately for responsiveness
    setAircraft(prev => [rec, ...prev]);

    // If Supabase configured, insert there
    if (process.env.REACT_APP_SUPABASE_URL && process.env.REACT_APP_SUPABASE_ANON_KEY) {
      try {
        console.log('addAircraft: attempting Supabase insert');

        // Prepare data with snake_case for Supabase (omitting the id)
        const dbRecord = {
          callsign: rec.callsign,
          radial: rec.radial || 0,
          distance_nm: rec.distance_nm || rec.distanceNm || 0,
          altitude_feet: rec.altitude_feet || rec.altitudeFeet || 0,
          phase: rec.phase || 'on-ground',
          runway: rec.runway || '22',
          sector: rec.sector || 'N',
          lat: rec.lat || null,
          lon: rec.lon || null,
          pic: rec.pic || null,
          profile: rec.profile || 'created',
          logs: rec.logs || [],
          is_airborne: rec.is_airborne || rec.isAirborne || false,
          go_arounds: rec.go_arounds || rec.goArounds || 0,
          slot_status: rec.slot_status || 'created',
          aircraft_type: rec.aircraft_type || null,
          p3: rec.p3 || null,
          flight_level: rec.flight_level || null,
          overfly: rec.overfly || null,
          sequence_slot: rec.sequence_slot || null,
          scheduled_for_tower: rec.scheduled_for_tower || false,
          last_updated_at: new Date().toISOString()
        };

        const { data, error } = await supabase.from('aircraft').insert(dbRecord).select();

        if (error) {
          console.error('addAircraft: Supabase insert error:', error.code, error.message);
          // Keep the local record even if Supabase fails, so slots can be created locally
          console.log('addAircraft: keeping local record due to Supabase error');
          return rec;
        }

        if (data && data[0]) {
          console.log('addAircraft: successfully saved to Supabase');
          const newRecord = normalizeRow(data[0]);
          // Replace the temporary record with the real one from the DB
          setAircraft(prev => prev.map(a => (a.id === tempId ? newRecord : a)));
          return newRecord;
        }
      } catch (e) {
        console.error('addAircraft: exception during Supabase insert:', e.message);
        // Revert optimistic update on exception
        setAircraft(prev => prev.filter(a => a.id !== tempId));
      }
    }

    console.log('addAircraft: saved to local state only (no Supabase connection)');
    return rec;
  }

  async function deleteAircraft(id) {
    // If Supabase configured, delete there first
    try {
      if (process.env.REACT_APP_SUPABASE_URL && process.env.REACT_APP_SUPABASE_ANON_KEY) {
        const { error } = await supabase.from('aircraft').delete().eq('id', id);
        if (error) throw error;
      }
    } catch (e) {
      console.error('Supabase delete failed:', e.message || e);
    }

    // fallback to local state
    setAircraft(prev => prev.filter(a => a.id !== id));
  }

  async function updateAircrafts(aircraftIds, patch) {
    // Update local state
    setAircraft(prev => prev.map(a => (aircraftIds.includes(a.id) ? { ...a, ...patch } : a)));

    // Update Supabase
    if (process.env.REACT_APP_SUPABASE_URL && process.env.REACT_APP_SUPABASE_ANON_KEY) {
      try {
        const dbPatch = {};
        for (const [key, val] of Object.entries(patch)) {
          if (key === 'distanceNm') dbPatch.distance_nm = val;
          else if (key === 'altitudeFeet') dbPatch.altitude_feet = val;
          else if (key === 'isAirborne') dbPatch.is_airborne = val;
          else if (key === 'goArounds') dbPatch.go_arounds = val;
          else if (key === 'estArrival') dbPatch.est_arrival = val;
          else if (key === 'estDeparture') dbPatch.est_departure = val;
          else if (key === 'scheduledStartup') dbPatch.scheduled_startup = val;
          else if (key === 'lastUpdatedBy') dbPatch.last_updated_by = val;
          else if (key === 'lastUpdatedAt') dbPatch.last_updated_at = val;
          else if (key === 'takeoffTime') dbPatch.takeoff_time = val;
          else if (key === 'landingTime') dbPatch.landing_time = val;
          else if (key === 'landingCount') dbPatch.landing_count = val;
          else if (key === 'touchAndGoCount') dbPatch.touch_and_go_count = val;
          else if (key === 'scheduledForTower') dbPatch.scheduled_for_tower = val;
          else if (key === 'aircraftType') dbPatch.aircraft_type = val;
          else if (key === 'sequenceSlot') dbPatch.sequence_slot = val;
          else if (key === 'slotStatus') dbPatch.slot_status = val;
          else if (key === 'exerciseType') dbPatch.exercise_type = val;
          else dbPatch[key] = val;
        }
        dbPatch.last_updated_at = new Date().toISOString();

        const { error } = await supabase.from('aircraft').update(dbPatch).in('id', aircraftIds);
        if (error) {
          console.error('updateAircrafts: Supabase error:', error.message);
        }
      } catch (e) {
        console.error('updateAircrafts: exception:', e.message);
      }
    }
  }

  function bulkUpdate(updater) {
    setAircraft(prev => prev.map(updater));
  }

  function setPhase(id, phase) {
    setAircraft(prev => prev.map(a => (a.id === id ? { ...a, phase } : a)));

    if (process.env.REACT_APP_SUPABASE_URL && process.env.REACT_APP_SUPABASE_ANON_KEY) {
      const dbPatch = {
        phase: phase,
        last_updated_at: new Date().toISOString(),
      };
      supabase.from('aircraft').update(dbPatch).eq('id', id).then(({ error }) => {
        if (error) {
          console.error('setPhase: Supabase error:', error.message);
        }
      });
    }
  }

  return (
    <AircraftContext.Provider
      value={{
        aircraft,
        updateAircraft,
        updateAircrafts,
        bulkUpdate,
        setPhase,
        addLog,
        setETA,
        setScheduledStartup,
        scheduleSequence,
        pushToTower,
        markTakeoff,
        editTakeoffTime,
        markLanding,
        recordTouchAndGo,
        addWaypoint,
        reportPosition,
        getNextSequence,
        setAirborne,
        incrementGoAround,
        setTaxiHoldShort,
        incrementLanding,
        pushOutOfTower,
        completeFlight,
        shutdownAircraft,
        addAircraft,
        deleteAircraft
      }}
    >
      {children}
    </AircraftContext.Provider>
  );
}

export const useAircraft = () => useContext(AircraftContext);

export default AircraftContext;

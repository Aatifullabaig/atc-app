import supabase from './supabaseClient';

// Runway patterns for RWY 22 and 04
export const RUNWAY_PATTERNS = {
  '22': {
    initial: { radial: 225, maxDistance: 10, maxAltitude: 2500, heading: 225, name: 'Initial' },
    circuit: { radial: 225, maxDistance: 5, maxAltitude: 2000, heading: 225, name: 'Circuit' },
    approach: { radial: 45, maxDistance: 5, maxAltitude: 2000, heading: 45, name: 'Approach' },
    base: { radial: 315, maxDistance: 5, maxAltitude: 1800, heading: 315, name: 'Base' },
    final: { radial: 225, minAltitude: 1000, maxAltitude: 1500, heading: 225, inbound: true, name: 'Final' },
    landing: { radial: 225, maxDistance: 2, maxAltitude: 500, heading: 225, name: 'Landing' },
  },
  '04': {
    initial: { radial: 45, maxDistance: 10, maxAltitude: 2500, heading: 45, name: 'Initial' },
    circuit: { radial: 45, maxDistance: 5, maxAltitude: 2000, heading: 45, name: 'Circuit' },
    approach: { radial: 225, maxDistance: 5, maxAltitude: 2000, heading: 225, name: 'Approach' },
    base: { radial: 135, maxDistance: 5, maxAltitude: 1800, heading: 135, name: 'Base' },
    final: { radial: 45, minAltitude: 1000, maxAltitude: 1500, heading: 45, inbound: true, name: 'Final' },
    landing: { radial: 45, maxDistance: 2, maxAltitude: 500, heading: 45, name: 'Landing' },
  },
};

// Sectors for position reporting
export const SECTORS = {
  'N': 5,
  'NE': 45,
  'E': 85,
  'SE': 135,
  'S': 185,
  'SW': 225,
  'W': 265,
  'NW': 315,
};

export const getSectorName = (radial) => {
  if (radial === null || radial === undefined) return 'UNKNOWN';
  radial = ((radial % 360) + 360) % 360;
  for (const [name, deg] of Object.entries(SECTORS)) {
    const diff = Math.abs(radial - deg);
    if (diff < 22.5 || diff > 337.5) return name;
  }
  return 'UNKNOWN';
};

export const getPhaseDisplay = (phase, runway) => {
  const pattern = RUNWAY_PATTERNS[runway];
  if (!pattern) return phase;
  for (const [key, value] of Object.entries(pattern)) {
    if (value.name === phase) return value.name;
  }
  return phase;
};

export const flightStateMachine = {
  canTransition: (currentStatus, currentPhase, targetStatus, targetPhase) => {
    const validTransitions = {
      'draft->ready': true,
      'draft->tower': false,
      'ready->tower': true,
      'ready->draft': true,
      'tower->air': true,
      'tower->completed': false,
      'air->tower': true, // Can land and return to ground ops
      'air->completed': false,
    };

    const key = `${currentStatus}->${targetStatus}`;
    return validTransitions[key] ?? false;
  },

  isValidPhaseTransition: (currentPhase, targetPhase) => {
    const validSequence = ['on_ground', 'taxi', 'airborne', 'upwind', 'crosswind', 'downwind', 'base', 'final', 'landing', 'shutdown'];
    const currentIdx = validSequence.indexOf(currentPhase);
    const targetIdx = validSequence.indexOf(targetPhase);
    return targetIdx >= currentIdx || targetIdx === 0; // Allow return to on_ground
  },
};

// ============================================================================
// STATE TRANSITION HELPERS
// ============================================================================

/**
 * Push a draft/ready flight to tower
 */
export const pushToTower = async (flightId) => {
  try {
    const { data: flight, error: fetchError } = await supabase
      .from('flights')
      .select('*')
      .eq('id', flightId)
      .single();

    if (fetchError) throw fetchError;

    if (flight.status !== 'ready') {
      throw new Error(`Cannot push to tower: flight status is ${flight.status}, not 'ready'`);
    }

    // Update flight
    const { error: updateError } = await supabase
      .from('flights')
      .update({
        status: 'tower',
        is_in_tower: true,
        pushed_to_tower_at: new Date().toISOString(),
      })
      .eq('id', flightId);

    if (updateError) throw updateError;

    // Log event
    await supabase.from('flight_events').insert({
      flight_id: flightId,
      event_type: 'pushed_to_tower',
      message: 'Flight pushed to tower',
      meta: {},
    });

    return true;
  } catch (error) {
    console.error('Error pushing to tower:', error);
    throw error;
  }
};

/**
 * Start a flight (engine start)
 */
export const startFlight = async (flightId) => {
  try {
    const { data: flight, error: fetchError } = await supabase
      .from('flights')
      .select('*')
      .eq('id', flightId)
      .single();

    if (fetchError) throw fetchError;

    if (flight.status !== 'tower') {
      throw new Error('Flight must be in tower to start');
    }

    if (flight.phase !== 'on_ground') {
      throw new Error(`Cannot start: flight phase is ${flight.phase}`);
    }

    // Update flight
    const { error: updateError } = await supabase
      .from('flights')
      .update({
        phase: 'taxi',
      })
      .eq('id', flightId);

    if (updateError) throw updateError;

    // Log event
    await supabase.from('flight_events').insert({
      flight_id: flightId,
      event_type: 'start',
      message: 'Started by operator',
      meta: {},
    });

    return true;
  } catch (error) {
    console.error('Error starting flight:', error);
    throw error;
  }
};

/**
 * Taxi to a location after landing
 * location: 'apron' (shutdown) | 'circuit' (another circuit) | or holding points before takeoff
 */
export const taxiAfterLanding = async (flightId, location) => {
  try {
    const { data: flight, error: fetchError } = await supabase
      .from('flights')
      .select('*')
      .eq('id', flightId)
      .single();

    if (fetchError) throw fetchError;

    if (flight.phase !== 'on_ground' || !flight.is_in_tower) {
      throw new Error('Flight must be on ground under tower control');
    }

    if (location === 'circuit') {
      // Return to takeoff (aircraft will line up for another circuit)
      const { error: updateError } = await supabase
        .from('flights')
        .update({
          phase: 'on_ground', // Reset to on_ground, ready for takeoff
        })
        .eq('id', flightId);

      if (updateError) throw updateError;

      await supabase.from('flight_events').insert({
        flight_id: flightId,
        event_type: 'taxi',
        message: `Taxiing for another circuit`,
        meta: { action: 'circuit' },
      });
    } else if (location === 'apron') {
      // Taxi to apron for shutdown
      const { error: updateError } = await supabase
        .from('flights')
        .update({
          phase: 'on_ground',
        })
        .eq('id', flightId);

      if (updateError) throw updateError;

      await supabase.from('flight_events').insert({
        flight_id: flightId,
        event_type: 'taxi',
        message: `Taxiing to apron`,
        meta: { action: 'apron' },
      });
    }

    return true;
  } catch (error) {
    console.error('Error taxiing after landing:', error);
    throw error;
  }
};

/**
 * Taxi to a holding point (before takeoff)
 * point: 'apron' | 'P1' | 'P2' | ... | 'P6'
 */
export const taxiToPoint = async (flightId, point) => {
  try {
    const validPoints = ['apron', 'P1', 'P2', 'P3', 'P4', 'P5', 'P6'];
    if (!validPoints.includes(point)) {
      throw new Error(`Invalid taxi point: ${point}`);
    }

    const { data: flight, error: fetchError } = await supabase
      .from('flights')
      .select('*')
      .eq('id', flightId)
      .single();

    if (fetchError) throw fetchError;

    if (!flight.is_in_tower) {
      throw new Error('Flight must be in tower');
    }

    // Update flight
    const { error: updateError } = await supabase
      .from('flights')
      .update({
        phase: 'taxi',
        ground_position: point,
      })
      .eq('id', flightId);

    if (updateError) throw updateError;

    // Log event
    await supabase.from('flight_events').insert({
      flight_id: flightId,
      event_type: 'taxi',
      message: `Taxi hold-short: ${point}`,
      meta: { point },
    });

    return true;
  } catch (error) {
    console.error('Error taxiing to point:', error);
    throw error;
  }
};

/**
 * Record takeoff
 */
export const recordTakeoff = async (flightId) => {
  try {
    const { data: flight, error: fetchError } = await supabase
      .from('flights')
      .select('*')
      .eq('id', flightId)
      .single();

    if (fetchError) throw fetchError;

    if (flight.status !== 'tower') {
      throw new Error('Flight must be in tower');
    }

    // Update flight
    const { error: updateError } = await supabase
      .from('flights')
      .update({
        status: 'air',
        phase: 'airborne',
        takeoff_at: new Date().toISOString(),
      })
      .eq('id', flightId);

    if (updateError) throw updateError;

    // Log events
    await Promise.all([
      supabase.from('flight_events').insert({
        flight_id: flightId,
        event_type: 'takeoff',
        message: 'Takeoff',
        meta: {},
      }),
      supabase.from('flight_events').insert({
        flight_id: flightId,
        event_type: 'airborne',
        message: 'Airborne',
        meta: {},
      }),
    ]);

    return true;
  } catch (error) {
    console.error('Error recording takeoff:', error);
    throw error;
  }
};

/**
 * Record aircraft position report with runway pattern validation
 * data: { radial, distanceNm, altitudeFt, direction, phaseTag, runway }
 */
export const recordPosition = async (flightId, data) => {
  try {
    const { radial, distanceNm, altitudeFt, direction, phaseTag } = data;

    if (radial === undefined || radial === null || distanceNm === undefined || distanceNm === null || altitudeFt === undefined || altitudeFt === null || !direction) {
      const msg = `Missing required position data: radial=${radial}, distanceNm=${distanceNm}, altitudeFt=${altitudeFt}, direction=${direction}`;
      console.error(msg, data);
      throw new Error(msg);
    }

    const { data: flight, error: fetchError } = await supabase
      .from('flights')
      .select('*')
      .eq('id', flightId)
      .single();

    if (fetchError) throw fetchError;

    if (flight.status !== 'air') {
      throw new Error(`Flight must be airborne to record position. Current status: ${flight.status}, phase: ${flight.phase}`);
    }

    // Determine position info
    const sector = getSectorName(radial);

    // Update flight - only position data, don't change phase
    const { error: updateError } = await supabase
      .from('flights')
      .update({
        radial_deg: radial,
        distance_nm: distanceNm,
        altitude_ft: altitudeFt,
        inbound_outbound: direction,
      })
      .eq('id', flightId);

    if (updateError) throw updateError;

    // Create message with sector info
    let eventType = phaseTag || 'position_report';
    let message;
    
    if (phaseTag === 'final') {
      message = `Final: ${radial}°/${distanceNm}nm @ ${altitudeFt}ft (${sector}) - ${direction}`;
    } else if (phaseTag === 'base') {
      message = `Base: ${radial}°/${distanceNm}nm @ ${altitudeFt}ft (${sector}) - ${direction}`;
    } else if (phaseTag === 'approach') {
      message = `Approach: ${radial}°/${distanceNm}nm @ ${altitudeFt}ft (${sector})`;
    } else if (phaseTag === 'initial') {
      message = `Initial: ${radial}°/${distanceNm}nm @ ${altitudeFt}ft (${sector})`;
    } else if (phaseTag === 'circuit') {
      message = `Circuit: ${radial}°/${distanceNm}nm @ ${altitudeFt}ft (${sector})`;
    } else if (phaseTag === 'landing') {
      message = `Landing: ${radial}°/${distanceNm}nm @ ${altitudeFt}ft (${sector})`;
    } else {
      message = `Position: ${radial}°/${distanceNm}nm @ ${altitudeFt}ft (${sector} - ${direction})`;
    }

    // Log event
    await supabase.from('flight_events').insert({
      flight_id: flightId,
      event_type: eventType,
      message,
      meta: {
        radial,
        distanceNm,
        altitudeFt,
        direction,
        phaseTag,
        sector,
      },
    });

    return true;
  } catch (error) {
    console.error('Error recording position:', error);
    throw error;
  }
};

/**
 * Record go-around
 */
export const recordGoAround = async (flightId) => {
  try {
    const { data: flight, error: fetchError } = await supabase
      .from('flights')
      .select('*')
      .eq('id', flightId)
      .single();

    if (fetchError) throw fetchError;

    if (flight.status !== 'air') {
      throw new Error('Flight must be airborne to go around');
    }

    // Update flight
    const { error: updateError } = await supabase
      .from('flights')
      .update({
        go_around_count: flight.go_around_count + 1,
        phase: 'air',
      })
      .eq('id', flightId);

    if (updateError) throw updateError;

    // Log event
    await supabase.from('flight_events').insert({
      flight_id: flightId,
      event_type: 'go_around',
      message: 'Go-around by operator',
      meta: {},
    });

    return true;
  } catch (error) {
    console.error('Error recording go-around:', error);
    throw error;
  }
};

/**
 * Record landing - returns to ground ops for taxi/shutdown decision
 */
export const recordLanding = async (flightId) => {
  try {
    const { data: flight, error: fetchError } = await supabase
      .from('flights')
      .select('*')
      .eq('id', flightId)
      .single();

    if (fetchError) throw fetchError;

    if (flight.status !== 'air') {
      throw new Error('Flight must be airborne to land');
    }

    const newLandingCount = flight.landing_count + 1;

    // Update flight - KEEP status as 'tower', move to on_ground phase for ground ops
    const { error: updateError } = await supabase
      .from('flights')
      .update({
        landing_count: newLandingCount,
        last_landed_at: new Date().toISOString(),
        phase: 'on_ground',
        status: 'tower', // Stay in tower control for ground ops decisions
      })
      .eq('id', flightId);

    if (updateError) throw updateError;

    // Log event
    await supabase.from('flight_events').insert({
      flight_id: flightId,
      event_type: 'landing_recorded',
      message: `Landing recorded (total: ${newLandingCount})`,
      meta: { landing_count: newLandingCount },
    });

    return true;
  } catch (error) {
    console.error('Error recording landing:', error);
    throw error;
  }
};



/**
 * Record shutdown
 */
export const recordShutdown = async (flightId) => {
  try {
    const { data: flight, error: fetchError } = await supabase
      .from('flights')
      .select('*')
      .eq('id', flightId)
      .single();

    if (fetchError) throw fetchError;

    if (!flight.is_in_tower) {
      throw new Error('Flight must be in tower to shutdown');
    }

    // Update flight
    const { error: updateError } = await supabase
      .from('flights')
      .update({
        phase: 'shutdown',
        status: 'completed',
        completed_at: new Date().toISOString(),
      })
      .eq('id', flightId);

    if (updateError) throw updateError;

    // Log events
    await Promise.all([
      supabase.from('flight_events').insert({
        flight_id: flightId,
        event_type: 'shutdown',
        message: 'Shutdown',
        meta: {},
      }),
      supabase.from('flight_events').insert({
        flight_id: flightId,
        event_type: 'completed',
        message: 'Flight completed',
        meta: {},
      }),
    ]);

    return true;
  } catch (error) {
    console.error('Error recording shutdown:', error);
    throw error;
  }
};

/**
 * Create a new draft flight
 */
export const createDraftFlight = async (flightData) => {
  try {
    const {
      aircraftId,
      studentName,
      instructorId,
      typeOfFlight,
      groundInchargeId,
      slotOrder,
    } = flightData;

    if (!aircraftId || !groundInchargeId) {
      throw new Error('Aircraft and ground incharge are required');
    }

    const { data: newFlight, error: insertError } = await supabase
      .from('flights')
      .insert({
        aircraft_id: aircraftId,
        pic: studentName || null,
        student_id: groundInchargeId,
        instructor_id: instructorId || null,
        type_of_flight: typeOfFlight || null,
        slot_order: slotOrder || null,
        status: 'draft',
        phase: 'on_ground',
      })
      .select()
      .single();

    if (insertError) throw insertError;

    // Log event
    await supabase.from('flight_events').insert({
      flight_id: newFlight.id,
      event_type: 'created',
      message: 'Slot created',
      meta: flightData,
    });

    return newFlight;
  } catch (error) {
    console.error('Error creating draft flight:', error);
    throw error;
  }
};

/**
 * Mark a draft flight as ready
 */
export const markFlightReady = async (flightId) => {
  try {
    const { data: flight, error: fetchError } = await supabase
      .from('flights')
      .select('*')
      .eq('id', flightId)
      .single();

    if (fetchError) throw fetchError;

    if (flight.status !== 'draft') {
      throw new Error(`Cannot mark ready: flight status is ${flight.status}`);
    }

    // Update flight
    const { error: updateError } = await supabase
      .from('flights')
      .update({ status: 'ready' })
      .eq('id', flightId);

    if (updateError) throw updateError;

    // Log event
    await supabase.from('flight_events').insert({
      flight_id: flightId,
      event_type: 'slot_ready',
      message: 'Slot marked ready',
      meta: {},
    });

    return true;
  } catch (error) {
    console.error('Error marking flight ready:', error);
    throw error;
  }
};

// ============================================================================
// QUERY HELPERS
// ============================================================================

/**
 * Get all draft flights
 */
export const getDraftFlights = async () => {
  const { data, error } = await supabase
    .from('flights')
    .select(
      `
      *,
      aircraft:aircraft_id(id, registration, type)
    `
    )
    .eq('status', 'draft')
    .order('created_at', { ascending: false });

  if (error) throw error;
  return data;
};

/**
 * Get all ready flights
 */
export const getReadyFlights = async () => {
  const { data, error } = await supabase
    .from('flights')
    .select(
      `
      *,
      aircraft:aircraft_id(id, registration, type)
    `
    )
    .eq('status', 'ready')
    .order('created_at', { ascending: true });

  if (error) throw error;
  return data;
};

/**
 * Get all completed flights (shown in ops - last 48 hours)
 */
export const getCompletedFlights = async () => {
  const { data, error } = await supabase
    .from('flights')
    .select(
      `
      *,
      aircraft:aircraft_id(id, registration, type)
    `
    )
    .eq('status', 'completed')
    .gte('completed_at', new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString())
    .order('completed_at', { ascending: false });

  if (error) throw error;
  return data;
};

/**
 * Get archived flights (older than 48 hours - for reference only)
 */
export const getArchivedFlights = async (limit = 20) => {
  const { data, error } = await supabase
    .from('flights')
    .select(
      `
      *,
      aircraft:aircraft_id(id, registration, type)
    `
    )
    .eq('status', 'completed')
    .lt('completed_at', new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString())
    .order('completed_at', { ascending: false })
    .limit(limit);

  if (error) throw error;
  return data;
};

/**
 * Get ground ops flights (on ground, still in tower)
 */
export const getGroundOpsFlights = async () => {
  const { data, error } = await supabase
    .from('flights')
    .select(
      `
      *,
      aircraft:aircraft_id(id, registration, type)
    `
    )
    .eq('status', 'tower')
    .in('phase', ['on_ground', 'taxi', 'landing', 'shutdown'])
    .order('created_at', { ascending: true });

  if (error) throw error;
  return data;
};

/**
 * Get air ops flights (airborne - has taken off but not landed)
 */
export const getAirOpsFlights = async () => {
  const { data, error } = await supabase
    .from('flights')
    .select(
      `
      *,
      aircraft:aircraft_id(id, registration, type)
    `
    )
    .eq('status', 'air')
    .order('takeoff_at', { ascending: true });

  if (error) throw error;
  return data;
};

/**
 * Get active flights (air or in tower, not completed)
 */
export const getActiveFlights = async () => {
  const { data, error } = await supabase
    .from('flights')
    .select(
      `
      *,
      aircraft:aircraft_id(id, registration, type)
    `
    )
    .in('status', ['tower', 'air'])
    .order('created_at', { ascending: true });

  if (error) throw error;
  return data;
};

/**
 * Get flight events for a specific flight
 */
export const getFlightEvents = async (flightId) => {
  const { data, error } = await supabase
    .from('flight_events')
    .select('*')
    .eq('flight_id', flightId)
    .order('created_at', { ascending: true });

  if (error) throw error;
  return data;
};

/**
 * Get all aircraft
 */
export const getAircraft = async () => {
  const { data, error } = await supabase
    .from('aircraft')
    .select('*')
    .order('registration', { ascending: true });

  if (error) throw error;
  return data;
};

/**
 * Get all pilots
 */
export const getPilots = async () => {
  const { data, error } = await supabase
    .from('pilots')
    .select('*')
    .order('name', { ascending: true });

  if (error) throw error;
  return data;
};

/**
 * Get pilots by role
 */
export const getPilotsByRole = async (role) => {
  const { data, error } = await supabase
    .from('pilots')
    .select('*')
    .eq('role', role)
    .order('name', { ascending: true });

  if (error) throw error;
  return data;
};

/**
 * Get global state value
 */
export const getGlobalState = async (key) => {
  const { data, error } = await supabase
    .from('global_state')
    .select('value')
    .eq('key', key)
    .single();

  if (error) throw error;
  return data?.value;
};

/**
 * Update global state
 */
export const updateGlobalState = async (key, value) => {
  const { error } = await supabase
    .from('global_state')
    .upsert({ key, value, updated_at: new Date().toISOString() })
    .eq('key', key);

  if (error) throw error;
  return true;
};

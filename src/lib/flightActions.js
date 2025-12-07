import supabase from './supabaseClient';
import { getPatternFor } from './patterns';

/**
 * Record a pattern leg for CL (circuit training) flights
 */
export async function recordPatternLeg(flightId, leg) {
  try {
    // Get current flight
    const { data: flight, error: fetchError } = await supabase
      .from('flights')
      .select('*')
      .eq('id', flightId)
      .single();

    if (fetchError) throw fetchError;
    if (!flight) throw new Error('Flight not found');

    // Get runway from flight or use default
    const runway = flight.runway_in_use || '22';

    // Get pattern spec
    const pattern = getPatternFor(runway, leg);

    // Update flight
    const { error: updateError } = await supabase
      .from('flights')
      .update({
        radial_deg: pattern.radial_deg,
        distance_nm: pattern.default_distance_nm,
        altitude_ft: pattern.default_altitude_ft,
        inbound_outbound: pattern.inbound_outbound,
        phase: pattern.phase,
        updated_at: new Date().toISOString(),
      })
      .eq('id', flightId);

    if (updateError) throw updateError;

    // Format message
    const message = `${pattern.label}: ${pattern.radial_deg}°/${pattern.default_distance_nm}nm @ ${pattern.default_altitude_ft}ft (${pattern.inbound_outbound})`;

    // Insert event
    const { error: eventError } = await supabase
      .from('flight_events')
      .insert([
        {
          flight_id: flightId,
          event_type: 'position_report',
          message,
          meta: {
            leg,
            radial_deg: pattern.radial_deg,
            distance_nm: pattern.default_distance_nm,
            altitude_ft: pattern.default_altitude_ft,
            heading_deg: pattern.heading_deg,
            inbound_outbound: pattern.inbound_outbound,
            phase: pattern.phase,
          },
        },
      ]);

    if (eventError) throw eventError;

    return true;
  } catch (error) {
    console.error(`Error recording pattern leg ${leg}:`, error);
    throw error;
  }
}

/**
 * Record a generic position report for non-CL flights
 */
export async function recordPositionReport(
  flightId,
  data
) {
  try {
    const { error: updateError } = await supabase
      .from('flights')
      .update({
        radial_deg: data.radial_deg,
        distance_nm: data.distance_nm,
        altitude_ft: data.altitude_ft,
        inbound_outbound: data.inbound_outbound,
        updated_at: new Date().toISOString(),
      })
      .eq('id', flightId);

    if (updateError) throw updateError;

    const message = `Position report: ${data.radial_deg}°/${data.distance_nm}nm @ ${data.altitude_ft}ft (${data.inbound_outbound})`;

    const { error: eventError } = await supabase
      .from('flight_events')
      .insert([
        {
          flight_id: flightId,
          event_type: 'position_report',
          message,
          meta: {
            radial_deg: data.radial_deg,
            distance_nm: data.distance_nm,
            altitude_ft: data.altitude_ft,
            inbound_outbound: data.inbound_outbound,
          },
        },
      ]);

    if (eventError) throw eventError;

    return true;
  } catch (error) {
    console.error('Error recording position report:', error);
    throw error;
  }
}

/**
 * Record go-around
 */
export async function recordGoAround(flightId) {
  try {
    const { data: flight, error: fetchError } = await supabase
      .from('flights')
      .select('go_around_count')
      .eq('id', flightId)
      .single();

    if (fetchError) throw fetchError;

    const newCount = (flight.go_around_count || 0) + 1;

    const { error: updateError } = await supabase
      .from('flights')
      .update({
        go_around_count: newCount,
        phase: 'airborne',
        updated_at: new Date().toISOString(),
      })
      .eq('id', flightId);

    if (updateError) throw updateError;

    const { error: eventError } = await supabase
      .from('flight_events')
      .insert([
        {
          flight_id: flightId,
          event_type: 'go_around',
          message: `Go-around by operator`,
          meta: { go_around_count: newCount },
        },
      ]);

    if (eventError) throw eventError;

    return true;
  } catch (error) {
    console.error('Error recording go-around:', error);
    throw error;
  }
}

/**
 * Record landing
 */
export async function recordLanding(flightId) {
  try {
    const { data: flight, error: fetchError } = await supabase
      .from('flights')
      .select('landing_count')
      .eq('id', flightId)
      .single();

    if (fetchError) throw fetchError;

    const newCount = (flight.landing_count || 0) + 1;

    const { error: updateError } = await supabase
      .from('flights')
      .update({
        landing_count: newCount,
        phase: 'on_ground',
        last_landed_at: new Date().toISOString(),
        status: 'tower',
        updated_at: new Date().toISOString(),
      })
      .eq('id', flightId);

    if (updateError) throw updateError;

    const { error: eventError } = await supabase
      .from('flight_events')
      .insert([
        {
          flight_id: flightId,
          event_type: 'landing',
          message: `Landing recorded (total: ${newCount})`,
          meta: { landing_count: newCount },
        },
      ]);

    if (eventError) throw eventError;

    return true;
  } catch (error) {
    console.error('Error recording landing:', error);
    throw error;
  }
}

/**
 * Start flight (ground phase)
 */
export async function startFlight(flightId) {
  try {
    const { error: updateError } = await supabase
      .from('flights')
      .update({
        phase: 'on_ground',
        status: 'tower',
        updated_at: new Date().toISOString(),
      })
      .eq('id', flightId);

    if (updateError) throw updateError;

    await supabase.from('flight_events').insert([
      {
        flight_id: flightId,
        event_type: 'start',
        message: 'Started',
        meta: {},
      },
    ]);

    return true;
  } catch (error) {
    console.error('Error starting flight:', error);
    throw error;
  }
}

/**
 * Taxi to point (apron / P1–P6)
 */
export async function taxiToPoint(flightId, point) {
  try {
    const validPoints = ['apron', 'P1', 'P2', 'P3', 'P4', 'P5', 'P6'];
    if (!validPoints.includes(point)) {
      throw new Error(`Invalid taxi point: ${point}`);
    }

    const { error: updateError } = await supabase
      .from('flights')
      .update({
        phase: 'taxi',
        ground_position: point,
        updated_at: new Date().toISOString(),
      })
      .eq('id', flightId);

    if (updateError) throw updateError;

    await supabase.from('flight_events').insert([
      {
        flight_id: flightId,
        event_type: 'taxi',
        message: `Taxi hold-short: ${point}`,
        meta: { point },
      },
    ]);

    return true;
  } catch (error) {
    console.error('Error taxiing to point:', error);
    throw error;
  }
}

/**
 * Record takeoff
 */
export async function recordTakeoff(flightId) {
  try {
    const { error: updateError } = await supabase
      .from('flights')
      .update({
        phase: 'airborne',
        status: 'air',
        takeoff_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', flightId);

    if (updateError) throw updateError;

    await supabase.from('flight_events').insert([
      {
        flight_id: flightId,
        event_type: 'takeoff',
        message: 'Takeoff',
        meta: {},
      },
    ]);

    return true;
  } catch (error) {
    console.error('Error recording takeoff:', error);
    throw error;
  }
}

/**
 * Record shutdown (complete flight)
 */
export async function recordShutdown(flightId) {
  try {
    const { error: updateError } = await supabase
      .from('flights')
      .update({
        phase: 'shutdown',
        status: 'completed',
        completed_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', flightId);

    if (updateError) throw updateError;

    await supabase.from('flight_events').insert([
      {
        flight_id: flightId,
        event_type: 'shutdown',
        message: 'Shutdown - Flight completed',
        meta: {},
      },
    ]);

    return true;
  } catch (error) {
    console.error('Error recording shutdown:', error);
    throw error;
  }
}

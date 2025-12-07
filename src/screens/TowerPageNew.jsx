import React, { useState, useEffect } from 'react';
import supabase from '../lib/supabaseClient';
import { recordPatternLeg, recordPositionReport, recordGoAround, recordLanding, startFlight, taxiToPoint, recordTakeoff, recordShutdown } from '../lib/flightActions.js';
import { PATTERN_22_RIGHT, PATTERN_04_RIGHT } from '../lib/patterns';
import '../shared/TowerPage.css';

const TowerPageNew = () => {
  const [runway, setRunway] = useState('22');
  const [groundOpsFlights, setGroundOpsFlights] = useState([]);
  const [airOpsFlights, setAirOpsFlights] = useState([]);
  const [utcTime, setUtcTime] = useState(new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false, timeZone: 'UTC' }));
  const [selectedFlight, setSelectedFlight] = useState(null);
  const [postLandingFlightId, setPostLandingFlightId] = useState(null);
  const [selectedTaxiPoint, setSelectedTaxiPoint] = useState(null);
  const [manualPositionForm, setManualPositionForm] = useState({ radial: '', distance: '', altitude: '', direction: 'inbound' });

  // UTC Clock
  useEffect(() => {
    const timer = setInterval(() => {
      setUtcTime(new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false, timeZone: 'UTC' }));
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // Load flights and setup realtime subscriptions
  useEffect(() => {
    loadFlights();
    const sub = supabase
      .channel('tower_flights')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'flights' }, () => {
        loadFlights();
      })
      .subscribe();

    return () => {
      sub.unsubscribe();
    };
  }, []);

  const loadFlights = async () => {
    try {
      // Ground ops: on ground/taxi/landing/shutdown, in tower
      const { data: ground } = await supabase
        .from('flights')
        .select('*,aircraft:aircraft_id(registration,type)')
        .eq('is_in_tower', true)
        .in('phase', ['on_ground', 'taxi', 'landing', 'shutdown'])
        .order('created_at', { ascending: true });

      // Air ops: airborne or in approach
      const { data: air } = await supabase
        .from('flights')
        .select('*,aircraft:aircraft_id(registration,type)')
        .in('status', ['air'])
        .order('takeoff_at', { ascending: true });

      setGroundOpsFlights(ground || []);
      setAirOpsFlights(air || []);
    } catch (error) {
      console.error('Error loading flights:', error);
    }
  };

  const handlePatternLeg = async (flightId, leg) => {
    try {
      await recordPatternLeg(flightId, leg, runway);
      await loadFlights();
      setSelectedFlight(null);
    } catch (error) {
      alert(`Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };

  const handleManualPosition = async (flightId) => {
    try {
      if (!manualPositionForm.radial || !manualPositionForm.distance || !manualPositionForm.altitude) {
        alert('Please fill all position fields');
        return;
      }
      await recordPositionReport(flightId, parseInt(manualPositionForm.radial), parseFloat(manualPositionForm.distance), parseInt(manualPositionForm.altitude), manualPositionForm.direction);
      await loadFlights();
      setSelectedFlight(null);
      setManualPositionForm({ radial: '', distance: '', altitude: '', direction: 'inbound' });
    } catch (error) {
      alert(`Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };

  const handleGoAround = async (flightId) => {
    try {
      await recordGoAround(flightId);
      await loadFlights();
    } catch (error) {
      alert(`Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };

  const handleLanding = async (flightId) => {
    try {
      await recordLanding(flightId);
      await loadFlights();
    } catch (error) {
      alert(`Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };

  const handleStart = async (flightId) => {
    try {
      await startFlight(flightId);
      await loadFlights();
    } catch (error) {
      alert(`Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };

  const handleTaxiToPoint = async (flightId, point) => {
    try {
      await taxiToPoint(flightId, point);
      await loadFlights();
      setSelectedTaxiPoint(null);
      setPostLandingFlightId(null);
    } catch (error) {
      alert(`Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };

  const handleTakeoff = async (flightId) => {
    try {
      await recordTakeoff(flightId);
      await loadFlights();
      setPostLandingFlightId(null);
      setSelectedTaxiPoint(null);
    } catch (error) {
      alert(`Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };

  const handleShutdown = async (flightId) => {
    try {
      await recordShutdown(flightId);
      await loadFlights();
      setPostLandingFlightId(null);
    } catch (error) {
      alert(`Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };

  const isCircuitTraining = (flight) => flight.type_of_flight === 'CL';
  const isAfterLanding = (flight) => flight.phase === 'on_ground' && flight.last_landed_at && flight.landing_count > 0;
  const isTaxiReady = (flight) => flight.phase === 'on_ground' && !flight.last_landed_at;

  return (
    <div className="tower-page">
      {/* Header */}
      <div className="tower-header">
        <h1>🛫 TOWER CONTROL</h1>
        <div className="header-controls">
          <div className="utc-clock">UTC: {utcTime}</div>
          <div className="runway-selector">
            <button className={runway === '04' ? 'active' : ''} onClick={() => setRunway('04')}>RWY 04</button>
            <button className={runway === '22' ? 'active' : ''} onClick={() => setRunway('22')}>RWY 22</button>
          </div>
        </div>
      </div>

      {/* Two-column layout */}
      <div className="tower-content">
        {/* GROUND OPS */}
        <div className="ops-column ground-ops">
          <h2>GROUND OPS</h2>
          <div className="flights-list">
            {groundOpsFlights.length === 0 ? (
              <div className="empty-state">No flights in ground ops</div>
            ) : (
              groundOpsFlights.map(flight => (
                <div key={flight.id} className="flight-card ground-card">
                  <div className="card-header">
                    <div className="callsign">{flight.aircraft?.registration || 'N/A'}</div>
                    <div className="meta">{flight.pic} | {flight.type_of_flight}</div>
                  </div>

                  <div className="card-body">
                    <div className="phase-info">
                      <span className="badge">{flight.phase.toUpperCase()}</span>
                      {flight.ground_position && <span className="position">{flight.ground_position}</span>}
                    </div>

                    {/* POST-LANDING: Initial choice */}
                    {isAfterLanding(flight) && postLandingFlightId !== flight.id && (
                      <div className="action-buttons">
                        <button className="btn btn-primary" onClick={() => setPostLandingFlightId(flight.id)}>
                          🔄 ANOTHER CIRCUIT
                        </button>
                        <button className="btn btn-secondary" onClick={() => {
                          setPostLandingFlightId(flight.id);
                          setSelectedTaxiPoint('apron');
                        }}>
                          🚕 TO APRON
                        </button>
                      </div>
                    )}

                    {/* POST-LANDING: Circuit path (taxi point selector + takeoff) */}
                    {isAfterLanding(flight) && postLandingFlightId === flight.id && selectedTaxiPoint !== 'apron' && (
                      <div className="action-buttons">
                        <div className="taxi-selector">
                          <label>Taxi Point:</label>
                          {['apron', 'P1', 'P2', 'P3', 'P4', 'P5', 'P6'].map(pt => (
                            <button
                              key={pt}
                              className={`taxi-btn ${selectedTaxiPoint === pt ? 'selected' : ''}`}
                              onClick={() => setSelectedTaxiPoint(pt)}
                            >
                              {pt}
                            </button>
                          ))}
                        </div>
                        {selectedTaxiPoint && selectedTaxiPoint !== 'apron' && (
                          <button className="btn btn-success" onClick={() => handleTaxiToPoint(flight.id, selectedTaxiPoint)}>
                            ✓ CONFIRM TAXI TO {selectedTaxiPoint}
                          </button>
                        )}
                        {selectedTaxiPoint && selectedTaxiPoint !== 'apron' && (
                          <button className="btn btn-info" onClick={() => handleTakeoff(flight.id)}>
                            🚀 TAKEOFF
                          </button>
                        )}
                      </div>
                    )}

                    {/* POST-LANDING: Apron path (shutdown) */}
                    {isAfterLanding(flight) && postLandingFlightId === flight.id && selectedTaxiPoint === 'apron' && (
                      <div className="action-buttons">
                        <button className="btn btn-warning" onClick={() => handleTaxiToPoint(flight.id, 'apron')}>
                          ✓ AT APRON
                        </button>
                        <button className="btn btn-danger" onClick={() => handleShutdown(flight.id)}>
                          🛑 SHUTDOWN (COMPLETE)
                        </button>
                      </div>
                    )}

                    {/* FIRST-TIME TAXI: Start + Taxi selector + Takeoff */}
                    {isTaxiReady(flight) && (
                      <div className="action-buttons">
                        <button className="btn btn-primary" onClick={() => handleStart(flight.id)}>
                          ▶️ START
                        </button>
                        <div className="taxi-selector">
                          <label>Taxi:</label>
                          {['apron', 'P1', 'P2', 'P3', 'P4', 'P5', 'P6'].map(pt => (
                            <button
                              key={pt}
                              className={`taxi-btn ${selectedTaxiPoint === `${flight.id}-${pt}` ? 'selected' : ''}`}
                              onClick={() => setSelectedTaxiPoint(`${flight.id}-${pt}`)}
                            >
                              {pt}
                            </button>
                          ))}
                        </div>
                        {selectedTaxiPoint?.startsWith(`${flight.id}-`) && (
                          <>
                            <button className="btn btn-success" onClick={() => handleTaxiToPoint(flight.id, selectedTaxiPoint.split('-')[1])}>
                              ✓ CONFIRM TAXI
                            </button>
                            <button className="btn btn-info" onClick={() => handleTakeoff(flight.id)}>
                              🚀 TAKEOFF
                            </button>
                          </>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* AIR OPS */}
        <div className="ops-column air-ops">
          <h2>AIR OPS</h2>
          <div className="flights-list">
            {airOpsFlights.length === 0 ? (
              <div className="empty-state">No aircraft airborne</div>
            ) : (
              airOpsFlights.map(flight => (
                <div key={flight.id} className="flight-card air-card">
                  <div className="card-header">
                    <div className="callsign">{flight.aircraft?.registration || 'N/A'}</div>
                    <div className="meta">GA: {flight.go_around_count || 0} | LD: {flight.landing_count || 0}</div>
                  </div>

                  <div className="card-body">
                    <div className="position-info">
                      {flight.radial_deg !== null && (
                        <div className="position-line">{flight.radial_deg}° / {flight.distance_nm}nm @ {flight.altitude_ft}ft</div>
                      )}
                    </div>

                    {isCircuitTraining(flight) ? (
                      <>
                        <div className="pattern-buttons">
                          {Object.keys(runway === '04' ? PATTERN_04_RIGHT : PATTERN_22_RIGHT).map((leg) => (
                            <button
                              key={leg}
                              className="btn btn-pattern"
                              onClick={() => handlePatternLeg(flight.id, leg)}
                            >
                              {leg.toUpperCase()}
                            </button>
                          ))}
                        </div>
                      </>
                    ) : (
                      <button className="btn btn-info" onClick={() => setSelectedFlight(flight)}>
                        📍 POSITION REPORT
                      </button>
                    )}

                    <div className="common-actions">
                      <button className="btn btn-warning" onClick={() => handleGoAround(flight.id)}>
                        ↩️ GO AROUND
                      </button>
                      <button className="btn btn-danger" onClick={() => handleLanding(flight.id)}>
                        📍 LAND
                      </button>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Modal: Manual Position Report */}
      {selectedFlight && !isCircuitTraining(selectedFlight) && (
        <div className="modal-overlay" onClick={() => setSelectedFlight(null)}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <h3>Position Report: {selectedFlight.aircraft?.registration}</h3>

            <div className="form-group">
              <label>Radial (°)</label>
              <input type="number" min="0" max="360" value={manualPositionForm.radial} onChange={e => setManualPositionForm({ ...manualPositionForm, radial: e.target.value })} />
            </div>

            <div className="form-group">
              <label>Distance (nm)</label>
              <input type="number" value={manualPositionForm.distance} onChange={e => setManualPositionForm({ ...manualPositionForm, distance: e.target.value })} />
            </div>

            <div className="form-group">
              <label>Altitude (ft)</label>
              <input type="number" value={manualPositionForm.altitude} onChange={e => setManualPositionForm({ ...manualPositionForm, altitude: e.target.value })} />
            </div>

            <div className="form-group">
              <label>Direction</label>
              <select value={manualPositionForm.direction} onChange={e => setManualPositionForm({ ...manualPositionForm, direction: e.target.value })}>
                <option value="inbound">Inbound</option>
                <option value="outbound">Outbound</option>
              </select>
            </div>

            <div className="modal-actions">
              <button className="btn btn-primary" onClick={() => handleManualPosition(selectedFlight.id)}>SUBMIT</button>
              <button className="btn btn-secondary" onClick={() => setSelectedFlight(null)}>CANCEL</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default TowerPageNew;

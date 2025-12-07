import React, { useState, useEffect } from 'react';
import supabase from '../lib/supabaseClient';
import {
  getGroundOpsFlights,
  getAirOpsFlights,
  startFlight,
  taxiToPoint,
  taxiAfterLanding,
  recordTakeoff,
  recordPosition,
  recordGoAround,
  recordLanding,
  recordShutdown,
  getGlobalState,
  updateGlobalState,
  RUNWAY_PATTERNS,
  getSectorName,
} from '../lib/flightService';
import {
  formatPosition,
  getCurrentUTCTime,
  getPhaseColor,
  getPilotDisplayName,
  getAircraftDisplayName,
} from '../utils/flightUtils';
import '../shared/TowerPageLive.css';

const TowerPageLive = () => {
  const [groundOps, setGroundOps] = useState([]);
  const [airOps, setAirOps] = useState([]);
  const [runway, setRunway] = useState('22');
  const [utcTime, setUtcTime] = useState(getCurrentUTCTime());
  const [tab, setTab] = useState('ground'); // 'ground', 'air'
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  
  // Modal states
  const [positionForm, setPositionForm] = useState({
    radial: '', distance: '', altitude: '', direction: 'inbound', phaseTag: ''
  });
  const [activeModal, setActiveModal] = useState(null);
  const [selectedFlight, setSelectedFlight] = useState(null);
  const [taxiPoint, setTaxiPoint] = useState('');
  const [taxiAfterDecision, setTaxiAfterDecision] = useState(null);

  const taxiPoints = ['apron', 'P1', 'P2', 'P3', 'P4', 'P5', 'P6'];
  const phaseOptions = ['overhead', 'deadside', 'downwind', 'base', 'final'];

  // UTC Clock
  useEffect(() => {
    const interval = setInterval(() => setUtcTime(getCurrentUTCTime()), 1000);
    return () => clearInterval(interval);
  }, []);

  // Load data
  useEffect(() => {
    loadData();
    setupRealtimeSubscriptions();
  }, []);

  const loadData = async () => {
    try {
      const [ground, air] = await Promise.all([
        getGroundOpsFlights(),
        getAirOpsFlights(),
      ]);
      setGroundOps(ground || []);
      setAirOps(air || []);
    } catch (err) {
      console.error('Error loading flights:', err);
      setError(err.message);
    }
  };

  const setupRealtimeSubscriptions = () => {
    const sub = supabase
      .channel('tower_flights')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'flights',
      }, () => {
        loadData();
      })
      .subscribe();

    return () => sub.unsubscribe();
  };

  const handleRunwayChange = async (newRunway) => {
    setRunway(newRunway);
    try {
      await updateGlobalState('runway_in_use', { runway: newRunway });
    } catch (err) {
      console.error('Error updating runway:', err);
    }
  };

  // Ground Ops Actions
  const handleStart = async (flightId) => {
    try {
      setLoading(true);
      await startFlight(flightId);
      await loadData();
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleTaxiToPoint = async (flightId) => {
    try {
      setLoading(true);
      await taxiToPoint(flightId, taxiPoint);
      await loadData();
      setActiveModal(null);
      setTaxiPoint('');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleTaxiAfterLanding = async (flightId, location) => {
    try {
      setLoading(true);
      await taxiAfterLanding(flightId, location);
      await loadData();
      setActiveModal(null);
      setTaxiAfterDecision(null);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleTakeoff = async (flightId) => {
    try {
      setLoading(true);
      await recordTakeoff(flightId);
      await loadData();
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleShutdown = async (flightId) => {
    try {
      setLoading(true);
      await recordShutdown(flightId);
      await loadData();
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // Air Ops Actions
  const handlePosition = async (flightId, phaseTag) => {
    try {
      const preset = getPatternPreset(phaseTag);
      
      // Use preset values if available, otherwise use manual form values
      const radial = preset?.radial || parseFloat(positionForm.radial);
      const distance = preset?.maxDistance || parseFloat(positionForm.distance);
      const altitude = preset?.maxAltitude || parseInt(positionForm.altitude);
      const direction = positionForm.direction || 'inbound';

      if (!radial || !distance || !altitude) {
        setError('Please fill all position fields');
        return;
      }

      setLoading(true);
      await recordPosition(flightId, {
        radial,
        distanceNm: distance,
        altitudeFt: altitude,
        direction,
        phaseTag,
        runway,
      });
      
      await loadData();
      setActiveModal(null);
      setPositionForm({ radial: '', distance: '', altitude: '', direction: 'inbound', phaseTag: '' });
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleGoAround = async (flightId) => {
    try {
      setLoading(true);
      await recordGoAround(flightId);
      await loadData();
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleLanding = async (flightId) => {
    try {
      setLoading(true);
      await recordLanding(flightId);
      await loadData();
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const getPatternPreset = (phaseTag) => {
    const pattern = RUNWAY_PATTERNS[runway];
    return pattern?.[phaseTag];
  };

  return (
    <div className="tower-container">
      {/* Header */}
      <header className="tower-header">
        <div className="header-left">
          <h1>Tower Control</h1>
          <div className="utc-time">{utcTime} UTC</div>
        </div>
        <div className="runway-selector">
          <button 
            className={`rwy-btn ${runway === '04' ? 'active' : ''}`}
            onClick={() => handleRunwayChange('04')}
          >
            RWY 04
          </button>
          <button 
            className={`rwy-btn ${runway === '22' ? 'active' : ''}`}
            onClick={() => handleRunwayChange('22')}
          >
            RWY 22
          </button>
        </div>
      </header>

      {/* Tab Navigation */}
      <div className="tower-tabs">
        <button 
          className={`tab-btn ${tab === 'ground' ? 'active' : ''}`}
          onClick={() => setTab('ground')}
        >
          Ground Ops ({groundOps.length})
        </button>
        <button 
          className={`tab-btn ${tab === 'air' ? 'active' : ''}`}
          onClick={() => setTab('air')}
        >
          Air Ops ({airOps.length})
        </button>
      </div>

      {error && <div className="error-banner">{error}</div>}

      {/* Ground Ops Tab */}
      {tab === 'ground' && (
        <div className="ground-ops-section">
          <div className="flights-grid">
            {groundOps.length === 0 ? (
              <div className="empty-state">No ground ops flights</div>
            ) : (
              groundOps.map((flight) => (
                <div key={flight.id} className="flight-card">
                  <div className="card-header">
                    <div className="registration">{getAircraftDisplayName(flight.aircraft)}</div>
                    <span className={`phase-badge ${getPhaseColor(flight.phase)}`}>
                      {flight.phase.toUpperCase()} @ {flight.ground_position || 'N/A'}
                    </span>
                  </div>

                  <div className="card-body">
                    <div><strong>PIC:</strong> {getPilotDisplayName(flight.student)}</div>
                    <div><strong>Type:</strong> {flight.type_of_flight}</div>
                    {flight.go_around_count > 0 && <div><strong>GA:</strong> {flight.go_around_count}</div>}
                    {flight.landing_count > 0 && <div><strong>Landings:</strong> {flight.landing_count}</div>}
                  </div>

                  <div className="card-actions">
                    {flight.phase === 'on_ground' && flight.started_at === null && (
                      <button 
                        className="action-btn start-btn"
                        onClick={() => handleStart(flight.id)}
                        disabled={loading}
                      >
                        Start
                      </button>
                    )}

                    {(flight.phase === 'on_ground' || flight.phase === 'taxi') && (
                      <>
                        <button 
                          className="action-btn taxi-btn"
                          onClick={() => {
                            setSelectedFlight(flight);
                            setActiveModal('taxi');
                          }}
                        >
                          Taxi
                        </button>

                        {flight.phase === 'taxi' && (
                          <button 
                            className="action-btn takeoff-btn"
                            onClick={() => handleTakeoff(flight.id)}
                            disabled={loading}
                          >
                            Takeoff
                          </button>
                        )}
                      </>
                    )}

                    {flight.phase === 'on_ground' && flight.landing_count > 0 && (
                      <>
                        <button 
                          className="action-btn circuit-btn"
                          onClick={() => {
                            setSelectedFlight(flight);
                            setActiveModal('post-landing');
                          }}
                        >
                          Post-Land
                        </button>
                      </>
                    )}

                    {flight.phase === 'on_ground' && flight.ground_position === 'apron' && (
                      <button 
                        className="action-btn shutdown-btn"
                        onClick={() => handleShutdown(flight.id)}
                        disabled={loading}
                      >
                        Shutdown
                      </button>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* Air Ops Tab */}
      {tab === 'air' && (
        <div className="air-ops-section">
          <div className="flights-grid">
            {airOps.length === 0 ? (
              <div className="empty-state">No air ops flights</div>
            ) : (
              airOps.map((flight) => {
                const sector = flight.radial_deg ? getSectorName(flight.radial_deg) : 'N/A';
                return (
                  <div key={flight.id} className="flight-card">
                    <div className="card-header">
                      <div className="registration">{getAircraftDisplayName(flight.aircraft)}</div>
                      <span className={`phase-badge ${getPhaseColor(flight.phase)}`}>
                        {flight.phase.toUpperCase()} ({sector})
                      </span>
                    </div>

                    <div className="card-body">
                      <div><strong>Position:</strong> {formatPosition(flight.radial_deg, flight.distance_nm, flight.altitude_ft, runway)}</div>
                      <div><strong>PIC:</strong> {getPilotDisplayName(flight.student)}</div>
                      <div><strong>GA/Land:</strong> {flight.go_around_count}/{flight.landing_count}</div>
                    </div>

                    <div className="card-actions">
                      {phaseOptions.map((phase) => (
                        <button 
                          key={phase}
                          className="action-btn position-btn"
                          onClick={() => {
                            setSelectedFlight(flight);
                            setPositionForm({ 
                              radial: '', distance: '', altitude: '', 
                              direction: 'inbound', 
                              phaseTag: phase 
                            });
                            setActiveModal('position');
                          }}
                        >
                          {phase.toUpperCase()}
                        </button>
                      ))}

                      <button 
                        className="action-btn ga-btn"
                        onClick={() => handleGoAround(flight.id)}
                        disabled={loading}
                      >
                        G/A
                      </button>

                      <button 
                        className="action-btn land-btn"
                        onClick={() => handleLanding(flight.id)}
                        disabled={loading}
                      >
                        Land
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}

      {/* Modals */}
      {activeModal === 'taxi' && selectedFlight && (
        <div className="modal-overlay" onClick={() => setActiveModal(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h3>Taxi to Point</h3>
            <div className="taxi-points">
              {taxiPoints.map((point) => (
                <button
                  key={point}
                  className={`point-btn ${taxiPoint === point ? 'selected' : ''}`}
                  onClick={() => setTaxiPoint(point)}
                >
                  {point}
                </button>
              ))}
            </div>
            <div className="modal-actions">
              <button 
                className="btn btn-confirm"
                onClick={() => handleTaxiToPoint(selectedFlight.id)}
                disabled={!taxiPoint || loading}
              >
                Confirm
              </button>
              <button 
                className="btn btn-cancel"
                onClick={() => setActiveModal(null)}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {activeModal === 'position' && selectedFlight && (
        <div className="modal-overlay" onClick={() => setActiveModal(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h3>Position Report - {positionForm.phaseTag?.toUpperCase()}</h3>
            {(() => {
              const preset = getPatternPreset(positionForm.phaseTag);
              return (
                <>
                  {preset && (
                    <div className="preset-info">
                      <p><strong>Runway {runway} Pattern:</strong></p>
                      <ul>
                        {preset.radial !== undefined && <li>Radial: {preset.radial}°</li>}
                        {preset.maxDistance !== undefined && <li>Distance: {preset.maxDistance}nm</li>}
                        {preset.maxAltitude !== undefined && <li>Altitude: {preset.maxAltitude}ft</li>}
                        {preset.minAltitude !== undefined && <li>Altitude Range: {preset.minAltitude}-{preset.maxAltitude}ft</li>}
                        {preset.inbound && <li>Direction: Inbound</li>}
                      </ul>
                    </div>
                  )}
                  <div className="form-group">
                    <label>Radial (°) {preset?.radial && <span className="preset">→ {preset.radial}°</span>}</label>
                    <input 
                      type="number" 
                      value={positionForm.radial}
                      onChange={(e) => setPositionForm({...positionForm, radial: e.target.value})}
                      placeholder={preset?.radial || '0-360'}
                    />
                  </div>
                  <div className="form-group">
                    <label>Distance (nm) {preset?.maxDistance && <span className="preset">→ {preset.maxDistance}nm</span>}</label>
                    <input 
                      type="number" 
                      value={positionForm.distance}
                      onChange={(e) => setPositionForm({...positionForm, distance: e.target.value})}
                      placeholder={preset?.maxDistance || '0-25'}
                    />
                  </div>
                  <div className="form-group">
                    <label>Altitude (ft QFE) {preset?.maxAltitude && <span className="preset">→ {preset.maxAltitude}ft</span>}</label>
                    <input 
                      type="number" 
                      value={positionForm.altitude}
                      onChange={(e) => setPositionForm({...positionForm, altitude: e.target.value})}
                      placeholder={preset?.maxAltitude || '1000'}
                    />
                  </div>
                  <div className="form-group">
                    <label>Direction</label>
                    <select 
                      value={positionForm.direction}
                      onChange={(e) => setPositionForm({...positionForm, direction: e.target.value})}
                    >
                      <option value="inbound">Inbound</option>
                      <option value="outbound">Outbound</option>
                    </select>
                  </div>
                  <div className="modal-actions">
                    <button 
                      className="btn btn-confirm"
                      onClick={() => handlePosition(selectedFlight.id, positionForm.phaseTag)}
                      disabled={loading}
                    >
                      Report
                    </button>
                    <button 
                      className="btn btn-cancel"
                      onClick={() => setActiveModal(null)}
                    >
                      Cancel
                    </button>
                  </div>
                </>
              );
            })()}
          </div>
        </div>
      )}

      {activeModal === 'post-landing' && selectedFlight && (
        <div className="modal-overlay" onClick={() => setActiveModal(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h3>Post-Landing Action</h3>
            <p>Where does {getAircraftDisplayName(selectedFlight.aircraft)} go?</p>
            <div className="modal-actions">
              <button 
                className="btn btn-circuit"
                onClick={() => handleTaxiAfterLanding(selectedFlight.id, 'circuit')}
                disabled={loading}
              >
                Another Circuit
              </button>
              <button 
                className="btn btn-apron"
                onClick={() => handleTaxiAfterLanding(selectedFlight.id, 'apron')}
                disabled={loading}
              >
                Back to Apron
              </button>
              <button 
                className="btn btn-cancel"
                onClick={() => setActiveModal(null)}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default TowerPageLive;

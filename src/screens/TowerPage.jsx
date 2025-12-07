import React, { useState, useEffect, useRef, useContext } from 'react';
import supabase from '../lib/supabaseClient';
import { ThemeContext } from '../context/ThemeContext';
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
import '../shared/TowerPageNew.css';

const TowerPage = () => {
  const { isDark, toggleTheme } = useContext(ThemeContext);
  const [activeColumn, setActiveColumn] = useState('ground');
  const [groundOpsFlights, setGroundOpsFlights] = useState([]);
  const [airOpsFlights, setAirOpsFlights] = useState([]);
  const [runway, setRunway] = useState('22');
  const [utcTime, setUtcTime] = useState(getCurrentUTCTime());
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  
  // Quick position entry state
  const [selectedFlightForPosition, setSelectedFlightForPosition] = useState(null);
  const [positionPhase, setPositionPhase] = useState('');
  const [positionData, setPositionData] = useState({
    radial: '',
    distance: '',
    altitude: '',
  });

  // Taxi decision state (after landing)
  const [selectedFlightForTaxiDecision, setSelectedFlightForTaxiDecision] = useState(null);
  
  // Quick taxi selector (before takeoff)
  const [showTaxiSelector, setShowTaxiSelector] = useState(null);

  // Position form state
  const [showPositionForm, setShowPositionForm] = useState(null);
  const [positionForm, setPositionForm] = useState({
    radial: '',
    distance: '',
    altitude: '',
    direction: 'inbound',
    phaseTag: '',
  });

  // Taxi after landing decision state
  const [taxiAfterLandingFlight, setTaxiAfterLandingFlight] = useState(null);

  const taxiPoints = ['apron', 'P1', 'P2', 'P3', 'P4', 'P5', 'P6'];
  const phaseOptions = ['upwind', 'downwind', 'base', 'final'];

  // Update UTC clock
  useEffect(() => {
    const interval = setInterval(() => {
      setUtcTime(getCurrentUTCTime());
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  // Load initial data
  useEffect(() => {
    loadInitialData();
    setupRealtimeSubscription();
  }, []);

  const loadInitialData = async () => {
    try {
      setLoading(true);
      await loadFlights();

      const runwayState = await getGlobalState('runway_in_use');
      if (runwayState?.runway) {
        setRunway(runwayState.runway);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const loadFlights = async () => {
    try {
      const [ground, air] = await Promise.all([
        getGroundOpsFlights(),
        getAirOpsFlights(),
      ]);
      setGroundOpsFlights(ground || []);
      setAirOpsFlights(air || []);
    } catch (err) {
      console.error('Error loading flights:', err);
      throw err;
    }
  };

  const setupRealtimeSubscription = () => {
    const subscription = supabase
      .channel('tower-flights')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'flights' }, () => {
        loadFlights();
      })
      .subscribe();

    return () => subscription.unsubscribe();
  };

  const handleRunwayChange = async (newRunway) => {
    try {
      setRunway(newRunway);
      await updateGlobalState('runway_in_use', { runway: newRunway });
    } catch (err) {
      setError(err.message);
    }
  };

  const handleStart = async (flightId) => {
    try {
      setLoading(true);
      setError(null);
      await startFlight(flightId);
      await loadFlights();
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleTaxi = async (flightId, point) => {
    try {
      setLoading(true);
      setError(null);
      await taxiToPoint(flightId, point);
      await loadFlights();
      setShowTaxiSelector(null);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleTakeoff = async (flightId) => {
    try {
      setLoading(true);
      setError(null);
      await recordTakeoff(flightId);
      await loadFlights();
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleQuickPosition = async (flightId) => {
    try {
      setLoading(true);
      setError(null);
      const rad = parseInt(positionData.radial);
      const dist = parseFloat(positionData.distance);
      const alt = parseInt(positionData.altitude);
      
      if (!rad || !dist || !alt) {
        throw new Error('All position fields required');
      }

      await recordPosition(flightId, {
        radial: rad,
        distanceNm: dist,
        altitudeFt: alt,
        direction: 'inbound',
        phaseTag: positionPhase || '',
        runway,
      });

      await loadFlights();
      setSelectedFlightForPosition(null);
      setPositionData({ radial: '', distance: '', altitude: '' });
      setPositionPhase('');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleGoAround = async (flightId) => {
    try {
      setLoading(true);
      setError(null);
      await recordGoAround(flightId);
      await loadFlights();
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleLanding = async (flightId) => {
    try {
      setLoading(true);
      setError(null);
      await recordLanding(flightId);
      await loadFlights();
      setSelectedFlightForTaxiDecision(flightId);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleTaxiAfterLanding = async (flightId, direction) => {
    try {
      setLoading(true);
      setError(null);
      await taxiAfterLanding(flightId, direction);
      await loadFlights();
      setSelectedFlightForTaxiDecision(null);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleShutdown = async (flightId) => {
    try {
      setLoading(true);
      setError(null);
      await recordShutdown(flightId);
      await loadFlights();
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handlePositionFormChange = (e) => {
    const { name, value } = e.target;
    setPositionForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleRecordPosition = async (flightId) => {
    try {
      setLoading(true);
      setError(null);

      const radial = parseFloat(positionForm.radial);
      const distance = parseFloat(positionForm.distance);
      const altitude = parseInt(positionForm.altitude);

      if (isNaN(radial) || isNaN(distance) || isNaN(altitude)) {
        throw new Error('Invalid position data - fill all fields');
      }

      await recordPosition(flightId, {
        radial,
        distanceNm: distance,
        altitudeFt: altitude,
        direction: positionForm.direction,
        phaseTag: positionForm.phaseTag || '',
      });

      setPositionForm({
        radial: '',
        distance: '',
        altitude: '',
        direction: 'inbound',
        phaseTag: '',
      });
      setShowPositionForm(null);
      await loadFlights();
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={`tower-page ${isDark ? 'dark' : 'light'}`}>
      <header className="page-header">
        <div className="header-content">
          <h1>🏠 TOWER ▪ RWY {runway}</h1>
          <div className="header-right">
            <div className="utc-clock">{utcTime} UTC</div>
            <button className="theme-toggle" onClick={toggleTheme}>
              {isDark ? '☀️' : '🌙'}
            </button>
          </div>
        </div>
      </header>

      {error && <div className="error-banner">{error}</div>}

      <div className="tower-controls">
        <div className="runway-selector">
          <button
            className={`runway-btn ${runway === '04' ? 'active' : ''}`}
            onClick={() => handleRunwayChange('04')}
          >
            RWY 04
          </button>
          <button
            className={`runway-btn ${runway === '22' ? 'active' : ''}`}
            onClick={() => handleRunwayChange('22')}
          >
            RWY 22
          </button>
        </div>
      </div>

      <div className="column-tabs">
        <button
          className={`tab-btn ${activeColumn === 'ground' ? 'active' : ''}`}
          onClick={() => setActiveColumn('ground')}
        >
          🚁 Ground Ops ({groundOpsFlights.length})
        </button>
        <button
          className={`tab-btn ${activeColumn === 'air' ? 'active' : ''}`}
          onClick={() => setActiveColumn('air')}
        >
          ✈ Air Ops ({airOpsFlights.length})
        </button>
      </div>

      {/* Ground Ops Column */}
      {activeColumn === 'ground' && (
        <div className="column ground-ops">
          {groundOpsFlights.length === 0 ? (
            <p className="empty-state">📭 No ground ops</p>
          ) : (
            <div className="flight-list">
              {groundOpsFlights.map((flight) => (
                <div key={flight.id} className="flight-card">
                  <div className="flight-card-header">
                    <span className="flight-registration">
                      {getAircraftDisplayName(flight.aircraft)}
                    </span>
                    <span className={`phase-badge ${getPhaseColor(flight.phase)}`}>
                      {flight.phase.toUpperCase()}
                    </span>
                  </div>

                  <div className="flight-card-info">
                    <span className="pic-info">{flight.pic}</span>
                    <span className="type-info">{flight.type_of_flight}</span>
                    {flight.ground_position && (
                      <span className="position-info">{flight.ground_position}</span>
                    )}
                  </div>

                  <div className="flight-card-actions">
                    {flight.phase === 'on_ground' && !flight.started_at && (
                      <button
                        className="btn btn-quick btn-start"
                        onClick={() => handleStart(flight.id)}
                        disabled={loading}
                      >
                        ⚙ START
                      </button>
                    )}

                    {flight.phase === 'on_ground' && flight.started_at && flight.landing_count === 0 && (
                      <button
                        className="btn btn-quick btn-taxi"
                        onClick={() => setShowTaxiSelector(flight.id)}
                        disabled={loading}
                      >
                        ✈ TAXI
                      </button>
                    )}

                    {flight.phase === 'taxi' && (
                      <button
                        className="btn btn-quick btn-takeoff"
                        onClick={() => handleTakeoff(flight.id)}
                        disabled={loading}
                      >
                        ↗ TAKEOFF
                      </button>
                    )}

                    {flight.phase === 'on_ground' && flight.landing_count > 0 && (
                      <>
                        <button
                          className="btn btn-quick btn-circuit"
                          onClick={() => handleTaxiAfterLanding(flight.id, 'circuit')}
                          disabled={loading}
                        >
                          🔄 CIRCUIT
                        </button>
                        <button
                          className="btn btn-quick btn-apron"
                          onClick={() => handleTaxiAfterLanding(flight.id, 'apron')}
                          disabled={loading}
                        >
                          📍 APRON
                        </button>
                      </>
                    )}

                    {flight.ground_position === 'apron' && (
                      <button
                        className="btn btn-quick btn-shutdown"
                        onClick={() => handleShutdown(flight.id)}
                        disabled={loading}
                      >
                        ⏹ SHUTDOWN
                      </button>
                    )}
                  </div>

                  {showTaxiSelector === flight.id && (
                    <div className="quick-selector">
                      <div className="selector-grid">
                        {taxiPoints.map((point) => (
                          <button
                            key={point}
                            className="selector-btn"
                            onClick={() => handleTaxi(flight.id, point)}
                            disabled={loading}
                          >
                            {point}
                          </button>
                        ))}
                      </div>
                      <button
                        className="btn btn-small"
                        onClick={() => setShowTaxiSelector(null)}
                      >
                        ✕ Close
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Air Ops Column */}
      {activeColumn === 'air' && (
        <div className="column air-ops">
          {airOpsFlights.length === 0 ? (
            <p className="empty-state">📭 No air ops</p>
          ) : (
            <div className="flight-list">
              {airOpsFlights.map((flight) => (
                <div key={flight.id} className="flight-card air-card">
                  <div className="flight-card-header">
                    <span className="flight-registration">
                      {getAircraftDisplayName(flight.aircraft)}
                    </span>
                    <span className={`phase-badge ${getPhaseColor(flight.phase)}`}>
                      {flight.phase.toUpperCase()}
                    </span>
                  </div>

                  <div className="flight-card-position">
                    <span className="pos-radial">{flight.radial_deg || '—'}°</span>
                    <span className="pos-distance">{flight.distance_nm || '—'} nm</span>
                    <span className="pos-altitude">{flight.altitude_ft || '—'} ft</span>
                    {flight.radial_deg && (
                      <span className="pos-sector">{getSectorName(flight.radial_deg)}</span>
                    )}
                  </div>

                  <div className="flight-card-info">
                    <span className="pic-info">{flight.pic}</span>
                    <span className="type-info">{flight.type_of_flight}</span>
                    <span className="traffic-info">GA:{flight.go_around_count} | LDG:{flight.landing_count}</span>
                  </div>

                  <div className="flight-card-actions">
                    <button
                      className="btn btn-quick btn-position"
                      onClick={() => setSelectedFlightForPosition(flight.id)}
                      disabled={loading}
                    >
                      📍 POS
                    </button>
                    <button
                      className="btn btn-quick btn-ga"
                      onClick={() => handleGoAround(flight.id)}
                      disabled={loading}
                    >
                      ↩ GA
                    </button>
                    <button
                      className="btn btn-quick btn-land"
                      onClick={() => handleLanding(flight.id)}
                      disabled={loading}
                    >
                      ↙ LAND
                    </button>
                  </div>

                  {selectedFlightForPosition === flight.id && (
                    <div className="position-entry">
                      <div className="entry-group">
                        <input
                          type="number"
                          placeholder="Radial (0-360)"
                          value={positionData.radial}
                          onChange={(e) => setPositionData({...positionData, radial: e.target.value})}
                          min="0"
                          max="360"
                          className="input-small"
                        />
                        <input
                          type="number"
                          placeholder="Distance (nm)"
                          value={positionData.distance}
                          onChange={(e) => setPositionData({...positionData, distance: e.target.value})}
                          step="0.1"
                          className="input-small"
                        />
                        <input
                          type="number"
                          placeholder="Altitude (ft)"
                          value={positionData.altitude}
                          onChange={(e) => setPositionData({...positionData, altitude: e.target.value})}
                          className="input-small"
                        />
                      </div>
                      <div className="phase-selector">
                        {phaseOptions.map((phase) => (
                          <button
                            key={phase}
                            className={`phase-btn ${positionPhase === phase ? 'active' : ''}`}
                            onClick={() => setPositionPhase(phase)}
                          >
                            {phase.toUpperCase()}
                          </button>
                        ))}
                      </div>
                      <div className="entry-actions">
                        <button
                          className="btn btn-small btn-confirm"
                          onClick={() => handleQuickPosition(flight.id)}
                          disabled={loading}
                        >
                          OK
                        </button>
                        <button
                          className="btn btn-small btn-cancel"
                          onClick={() => setSelectedFlightForPosition(null)}
                        >
                          ✕
                        </button>
                      </div>
                    </div>
                  )}

                  {selectedFlightForTaxiDecision === flight.id && (
                    <div className="taxi-decision">
                      <p className="decision-text">Landed. Next?</p>
                      <button
                        className="btn btn-quick btn-circuit"
                        onClick={() => handleTaxiAfterLanding(flight.id, 'circuit')}
                        disabled={loading}
                      >
                        🔄 CIRCUIT
                      </button>
                      <button
                        className="btn btn-quick btn-apron"
                        onClick={() => handleTaxiAfterLanding(flight.id, 'apron')}
                        disabled={loading}
                      >
                        📍 APRON
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Footer */}
      <footer className="page-footer">
        <div className="footer-content">
          <p>🛩 ATC Tracker - Developed by M M Aatiful Baig</p>
          <p>Dedicated to NFTI • Flight Operations Management System</p>
        </div>
      </footer>
    </div>
  );
};

export default TowerPage;

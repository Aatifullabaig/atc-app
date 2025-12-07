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
  updateGlobalState,
  RUNWAY_PATTERNS,
  getSectorName,
} from '../lib/flightService';
import {
  getCurrentUTCTime,
  getPhaseColor,
} from '../utils/flightUtils';
import '../shared/TowerPageOptimized.css';

const TowerPageOptimized = () => {
  const [groundOpsFlights, setGroundOpsFlights] = useState([]);
  const [airOpsFlights, setAirOpsFlights] = useState([]);
  const [runway, setRunway] = useState('22');
  const [utcTime, setUtcTime] = useState(getCurrentUTCTime());
  const [activeModal, setActiveModal] = useState(null);
  const [selectedFlight, setSelectedFlight] = useState(null);
  const [showQuickActions, setShowQuickActions] = useState(null);

  // Position form for air ops
  const [positionForm, setPositionForm] = useState({
    radial: '', distance: '', altitude: '', direction: 'inbound', phaseTag: ''
  });

  // Taxi decision (post-landing)
  const [taxiDecision, setTaxiDecision] = useState(null);
  const [postLandingDecision, setPostLandingDecision] = useState(null);

  const taxiPoints = ['apron', 'P1', 'P2', 'P3', 'P4', 'P5', 'P6'];

  // Get pattern prefills for runway
  const getPatternPresets = (phaseTag) => {
    const pattern = RUNWAY_PATTERNS[runway];
    if (!pattern || !pattern[phaseTag]) return null;
    return pattern[phaseTag];
  };

  // UTC Clock
  useEffect(() => {
    const interval = setInterval(() => setUtcTime(getCurrentUTCTime()), 1000);
    return () => clearInterval(interval);
  }, []);

  // Load flights and setup realtime
  useEffect(() => {
    loadFlights();
    const unsubscribe = setupRealtimeSubscriptions();
    return unsubscribe;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const setupRealtimeSubscriptions = () => {
    let reloadTimeout;
    const debounce = () => {
      clearTimeout(reloadTimeout);
      reloadTimeout = setTimeout(() => loadFlights(), 300);
    };

    const groundSub = supabase
      .channel('ground_ops')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'flights',
          filter: `is_in_tower=eq.true AND phase=in.(on_ground,taxi,landing,shutdown)`,
        },
        debounce
      )
      .subscribe();

    const airSub = supabase
      .channel('air_ops')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'flights',
          filter: `status=eq.air`,
        },
        debounce
      )
      .subscribe();

    return () => {
      clearTimeout(reloadTimeout);
      groundSub.unsubscribe();
      airSub.unsubscribe();
    };
  };

  const loadFlights = async () => {
    try {
      const [ground, air] = await Promise.all([
        getGroundOpsFlights(),
        getAirOpsFlights(),
      ]);
      setGroundOpsFlights(ground || []);
      setAirOpsFlights(air || []);
    } catch (error) {
      console.error('Error loading flights:', error);
    }
  };

  const handleRunwayChange = async (newRunway) => {
    setRunway(newRunway);
    await updateGlobalState('runway_in_use', { runway: newRunway });
  };

  const handleQuickAction = async (action, flightId) => {
    console.log('Button clicked:', action, flightId);
    try {
      switch (action) {
        case 'start':
          await startFlight(flightId);
          break;
        case 'takeoff':
          await recordTakeoff(flightId);
          break;
        case 'goaround':
          await recordGoAround(flightId);
          break;
        case 'land':
          await recordLanding(flightId);
          break;
        case 'shutdown':
          await recordShutdown(flightId);
          break;
        default:
          break;
      }
      setShowQuickActions(null);
      alert(`${action} action completed successfully`);
    } catch (error) {
      console.error(`Error with action ${action}:`, error);
      alert(`Error with action ${action}: ${error.message}`);
    } finally {
      await loadFlights();
    }
  };

  const handleTaxiToPoint = async (flightId, point) => {
    try {
      await taxiToPoint(flightId, point);
      await loadFlights();
      setShowQuickActions(null);
    } catch (error) {
      console.error('Error taxiing:', error);
    }
  };

  const handleTaxiAfterLanding = async (flightId, location) => {
    alert(`Post-landing taxi button clicked: ${location} for flight ${flightId}`);
    try {
      await taxiAfterLanding(flightId, location);
      alert(`${location} taxi action completed successfully`);
      await loadFlights();
      setTaxiDecision(null);
    } catch (error) {
      console.error('Error taxiing after landing:', error);
      alert(`Error taxiing after landing: ${error.message}`);
    }
  };

  const submitPosition = async () => {
    if (!selectedFlight || !positionForm.phaseTag) {
      console.error('Missing flight or phase');
      return;
    }

    try {
      const pattern = getPatternPresets(positionForm.phaseTag);
      
      // Validate and parse inputs
      const radial = positionForm.radial ? parseInt(positionForm.radial) : (pattern?.radial || 0);
      const distanceNm = positionForm.distance ? parseInt(positionForm.distance) : (pattern?.maxDistance || 5);
      const altitudeFt = positionForm.altitude ? parseInt(positionForm.altitude) : (pattern?.maxAltitude || 2000);
      
      if (isNaN(radial) || isNaN(distanceNm) || isNaN(altitudeFt)) {
        alert('Invalid position values. Please enter numbers only.');
        return;
      }

      const data = {
        radial,
        distanceNm,
        altitudeFt,
        direction: positionForm.direction,
        phaseTag: positionForm.phaseTag,
        runway,
      };

      console.log('Submitting position data:', data);
      await recordPosition(selectedFlight.id, data);
      await loadFlights();
      setActiveModal(null);
      setPositionForm({ radial: '', distance: '', altitude: '', direction: 'inbound', phaseTag: '' });
    } catch (error) {
      console.error('Error submitting position:', error.message, error);
      alert(`Error: ${error.message}`);
    }
  };

  const GroundOpsCard = ({ flight }) => {
    const isAfterLanding = flight.phase === 'on_ground' && flight.last_landed_at && flight.landing_count > 0;
    const readyForTakeoff = flight.phase === 'on_ground' && flight.status === 'tower' && !flight.takeoff_at;
    
    return (
      <div className="flight-card ground-ops-card" key={flight.id}>
        <div className="card-header">
          <span className="aircraft-reg">{flight.aircraft?.registration || 'N/A'}</span>
          <span className="pilot-pic">{flight.pic || 'N/A'}</span>
        </div>

        <div className="card-body">
          <div className="flight-status">
            <span className="phase-badge" style={{ backgroundColor: getPhaseColor(flight.phase) }}>
              {flight.phase.toUpperCase()}
            </span>
            {flight.ground_position && <span className="ground-pos">{flight.ground_position}</span>}
          </div>

          {isAfterLanding && postLandingDecision !== flight.id && (
            <div className="post-landing-actions">
              <button
                className="btn btn-lg btn-success"
                onClick={(e) => {
                  e.stopPropagation();
                  setPostLandingDecision(flight.id);
                  handleTaxiAfterLanding(flight.id, 'circuit');
                }}
              >
                ANOTHER CIRCUIT
              </button>
              <button
                className="btn btn-lg btn-info"
                onClick={(e) => {
                  e.stopPropagation();
                  setPostLandingDecision(flight.id);
                  handleTaxiAfterLanding(flight.id, 'apron');
                }}
              >
                TO APRON
              </button>
            </div>
          )}

          {isAfterLanding && postLandingDecision === flight.id && flight.ground_position !== 'apron' && (
            <div className="post-landing-actions">
              <div style={{ fontSize: 11, color: '#ffff00', marginBottom: 8, fontWeight: 'bold' }}>
                SELECT TAXI POINT:
              </div>
              <div className="taxi-selector" style={{ marginBottom: 8 }}>
                {taxiPoints.map((pt) => (
                  <button
                    key={pt}
                    className="btn btn-xs btn-outline"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleTaxiToPoint(flight.id, pt);
                    }}
                  >
                    {pt}
                  </button>
                ))}
              </div>
              <button
                className="btn btn-md btn-success"
                onClick={(e) => {
                  e.stopPropagation();
                  handleQuickAction('takeoff', flight.id);
                  setPostLandingDecision(null);
                }}
              >
                TAKEOFF → (AIRBORNE)
              </button>
            </div>
          )}

          {isAfterLanding && postLandingDecision === flight.id && flight.ground_position === 'apron' && (
            <div className="post-landing-actions">
              <button
                className="btn btn-lg btn-warning"
                onClick={(e) => {
                  e.stopPropagation();
                  handleTaxiAfterLanding(flight.id, 'apron');
                }}
                style={{ marginBottom: 8 }}
              >
                ✓ AT APRON
              </button>
              <button
                className="btn btn-lg btn-danger"
                onClick={(e) => {
                  e.stopPropagation();
                  handleQuickAction('shutdown', flight.id);
                  setPostLandingDecision(null);
                }}
              >
                SHUTDOWN (COMPLETE)
              </button>
            </div>
          )}

          {readyForTakeoff && flight.phase === 'on_ground' && (
            <div className="quick-buttons">
              <button
                className="btn btn-xs btn-primary"
                onClick={() => handleQuickAction('start', flight.id)}
              >
                START
              </button>
              <button
                className="btn btn-xs btn-info"
                onClick={() => setShowQuickActions(flight.id)}
              >
                TAXI ▼
              </button>
              {showQuickActions === flight.id && (
                <div className="taxi-selector">
                  {taxiPoints.map((pt) => (
                    <button
                      key={pt}
                      className="btn btn-xs btn-outline"
                      onClick={() => handleTaxiToPoint(flight.id, pt)}
                    >
                      {pt}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {flight.phase === 'taxi' && (
            <button
              className="btn btn-md btn-success"
              onClick={() => handleQuickAction('takeoff', flight.id)}
            >
              TAKEOFF →
            </button>
          )}
        </div>
      </div>
    );
  };

  const AirOpsCard = ({ flight }) => {
    return (
      <div className="flight-card air-ops-card" key={flight.id}>
        <div className="card-header">
          <span className="aircraft-reg">{flight.aircraft.registration}</span>
          <span className="counts">GA:{flight.go_around_count} LD:{flight.landing_count}</span>
        </div>

        <div className="card-body">
          <div className="position-display">
            {flight.radial_deg !== null && (
              <div className="position-line">
                <strong>{flight.radial_deg}°</strong> / <strong>{flight.distance_nm}nm</strong> @ <strong>{flight.altitude_ft}ft</strong>
              </div>
            )}
            <div className="sector-info">
              Sector: <strong>{flight.radial_deg ? getSectorName(flight.radial_deg) : 'N/A'}</strong>
            </div>
          </div>

          <div className="phase-badge" style={{ backgroundColor: getPhaseColor(flight.phase) }}>
            {flight.phase.toUpperCase()}
          </div>

          <div className="quick-buttons">
            <button
              className="btn btn-xs btn-info"
              onClick={() => {
                alert(`POS button clicked for flight ${flight.id}`);
                setSelectedFlight(flight);
                setActiveModal('position');
              }}
            >
              POS ▼
            </button>
            <button
              className="btn btn-xs btn-warning"
              onClick={() => handleQuickAction('goaround', flight.id)}
            >
              GA
            </button>
            <button
              className="btn btn-xs btn-danger"
              onClick={() => handleQuickAction('land', flight.id)}
            >
              LAND
            </button>
          </div>
        </div>
      </div>
    );
  };

  const PositionModal = () => {
    if (!selectedFlight || activeModal !== 'position') return null;

    return (
      <div className="modal-overlay" onClick={() => setActiveModal(null)}>
        <div className="modal-content" onClick={(e) => e.stopPropagation()}>
          <h3>Position Report: {selectedFlight.aircraft?.registration || 'N/A'}</h3>

          <div className="phase-buttons">
            {['initial', 'circuit', 'approach', 'base', 'final', 'landing'].map((phase) => {
              const displayNames = {
                'initial': 'INITIAL',
                'circuit': 'UPWIND',
                'approach': 'DOWNWIND',
                'base': 'BASE',
                'final': 'FINAL',
                'landing': 'LANDING',
              };
              const preset = getPatternPresets(phase);
              return (
                <button
                  key={phase}
                  className={`btn btn-phase ${positionForm.phaseTag === phase ? 'active' : ''}`}
                  onClick={() => {
                    setPositionForm({
                      ...positionForm,
                      phaseTag: phase,
                      radial: preset?.radial || '',
                      distance: preset?.maxDistance || '',
                      altitude: preset?.maxAltitude || preset?.minAltitude || '',
                    });
                  }}
                >
                  {displayNames[phase]}
                </button>
              );
            })}
          </div>

          <div className="form-group">
            <label>Radial (deg)</label>
            <input
              type="number"
              min="0"
              max="360"
              value={positionForm.radial}
              onChange={(e) => setPositionForm({ ...positionForm, radial: e.target.value })}
              placeholder="e.g., 225"
            />
          </div>

          <div className="form-group">
            <label>Distance (nm)</label>
            <input
              type="number"
              min="0"
              max="25"
              value={positionForm.distance}
              onChange={(e) => setPositionForm({ ...positionForm, distance: e.target.value })}
              placeholder="e.g., 5"
            />
          </div>

          <div className="form-group">
            <label>Altitude (ft)</label>
            <input
              type="number"
              value={positionForm.altitude}
              onChange={(e) => setPositionForm({ ...positionForm, altitude: e.target.value })}
              placeholder="e.g., 2000"
            />
          </div>

          <div className="form-group">
            <label>Direction</label>
            <select
              value={positionForm.direction}
              onChange={(e) => setPositionForm({ ...positionForm, direction: e.target.value })}
            >
              <option value="inbound">Inbound</option>
              <option value="outbound">Outbound</option>
            </select>
          </div>

          <div className="modal-actions">
            <button className="btn btn-primary" onClick={submitPosition}>
              SUBMIT
            </button>
            <button className="btn btn-secondary" onClick={() => setActiveModal(null)}>
              CANCEL
            </button>
          </div>
        </div>
      </div>
    );
  };

  const TaxiDecisionModal = () => {
    return null;
  };

  return (
    <div className="tower-page-optimized">
      <div className="tower-header">
        <h1>TOWER CONTROL</h1>
        <div className="header-info">
          <span className="utc-time">UTC: {utcTime}</span>
          <div className="runway-selector">
            <button
              className={`btn btn-runway ${runway === '04' ? 'active' : ''}`}
              onClick={() => handleRunwayChange('04')}
            >
              RWY 04
            </button>
            <button
              className={`btn btn-runway ${runway === '22' ? 'active' : ''}`}
              onClick={() => handleRunwayChange('22')}
            >
              RWY 22
            </button>
          </div>
        </div>
      </div>

      <div className="tower-content">
        <div className="ops-column">
          <h2>GROUND OPS</h2>
          <div className="flights-container">
            {groundOpsFlights.length === 0 ? (
              <div className="empty-state">No flights in ground ops</div>
            ) : (
              groundOpsFlights.map((flight) => <GroundOpsCard flight={flight} key={flight.id} />)
            )}
          </div>
        </div>

        <div className="ops-column">
          <h2>AIR OPS</h2>
          <div className="flights-container">
            {airOpsFlights.length === 0 ? (
              <div className="empty-state">No aircraft airborne</div>
            ) : (
              airOpsFlights.map((flight) => <AirOpsCard flight={flight} key={flight.id} />)
            )}
          </div>
        </div>
      </div>

      <PositionModal />
      <TaxiDecisionModal />
    </div>
  );
};

export default TowerPageOptimized;

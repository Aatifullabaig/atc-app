import React, { useState, useEffect } from 'react';
import supabase from '../lib/supabaseClient';
import { recordPatternLeg, recordPositionReport, recordGoAround, recordLanding, startFlight, taxiToPoint, recordTakeoff, recordShutdown } from '../lib/flightActions.js';
import { PATTERN_22_RIGHT, PATTERN_04_RIGHT } from '../lib/patterns';
import '../shared/TowerPageMobile.css';

const TowerPageMobile = () => {
  const [runway, setRunway] = useState('22');
  const [groundOpsFlights, setGroundOpsFlights] = useState([]);
  const [airOpsFlights, setAirOpsFlights] = useState([]);
  const [utcTime, setUtcTime] = useState(new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false, timeZone: 'UTC' }));
  const [activeTab, setActiveTab] = useState('ground');
  const [expandedFlight, setExpandedFlight] = useState(null);
  const [actionMode, setActionMode] = useState(null); // 'pattern', 'taxi', 'position', etc.

  useEffect(() => {
    const timer = setInterval(() => {
      setUtcTime(new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false, timeZone: 'UTC' }));
    }, 1000);
    return () => clearInterval(timer);
  }, []);

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
      const { data: ground } = await supabase
        .from('flights')
        .select('*,aircraft:aircraft_id(registration,type)')
        .eq('is_in_tower', true)
        .in('phase', ['on_ground', 'taxi', 'landing', 'shutdown'])
        .neq('status', 'completed')
        .order('created_at', { ascending: true });

      const { data: air } = await supabase
        .from('flights')
        .select('*,aircraft:aircraft_id(registration,type)')
        .eq('status', 'air')
        .order('takeoff_at', { ascending: true });

      setGroundOpsFlights(ground || []);
      setAirOpsFlights(air || []);
    } catch (error) {
      console.error('Error loading flights:', error);
    }
  };

  const handleQuickAction = async (flightId, action, param = null) => {
    try {
      switch (action) {
        case 'start':
          await startFlight(flightId);
          break;
        case 'taxi':
          if (param) await taxiToPoint(flightId, param);
          break;
        case 'takeoff':
          await recordTakeoff(flightId);
          break;
        case 'shutdown':
          await recordShutdown(flightId);
          break;
        case 'goaround':
          await recordGoAround(flightId);
          break;
        case 'land':
          await recordLanding(flightId);
          break;
        case 'pattern':
          if (param) await recordPatternLeg(flightId, param, runway);
          break;
        default:
          break;
      }
      // Small delay to ensure database is updated
      await new Promise(resolve => setTimeout(resolve, 300));
      await loadFlights();
      setActionMode(null);
      setExpandedFlight(null);
    } catch (error) {
      alert(`Error: ${error.message}`);
    }
  };

  const isAfterLanding = (flight) => flight.phase === 'on_ground' && flight.last_landed_at && flight.landing_count > 0;
  const isTaxiReady = (flight) => flight.phase === 'on_ground' && !flight.last_landed_at;
  const isCircuitTraining = (flight) => flight.type_of_flight === 'CL';

  const patterns = runway === '04' ? PATTERN_04_RIGHT : PATTERN_22_RIGHT;

  return (
    <div className="tower-mobile">
      {/* Header */}
      <div className="mobile-header">
        <div className="header-top">
          <h1>🛫 TOWER</h1>
          <div className="utc-badge">{utcTime}</div>
        </div>
        <div className="runway-tabs">
          <button className={runway === '04' ? 'active' : ''} onClick={() => setRunway('04')}>RWY 04</button>
          <button className={runway === '22' ? 'active' : ''} onClick={() => setRunway('22')}>RWY 22</button>
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="tab-nav">
        <button className={`tab-btn ${activeTab === 'ground' ? 'active' : ''}`} onClick={() => setActiveTab('ground')}>
          GND ({groundOpsFlights.length})
        </button>
        <button className={`tab-btn ${activeTab === 'air' ? 'active' : ''}`} onClick={() => setActiveTab('air')}>
          AIR ({airOpsFlights.length})
        </button>
      </div>

      {/* Flights List */}
      <div className="flights-container">
        {activeTab === 'ground' ? (
          groundOpsFlights.length === 0 ? (
            <div className="empty">No ground flights</div>
          ) : (
            groundOpsFlights.map(flight => (
              <FlightCard
                key={flight.id}
                flight={flight}
                isExpanded={expandedFlight === flight.id}
                onToggle={() => setExpandedFlight(expandedFlight === flight.id ? null : flight.id)}
                isAfterLanding={isAfterLanding(flight)}
                isTaxiReady={isTaxiReady(flight)}
                onAction={handleQuickAction}
                runway={runway}
              />
            ))
          )
        ) : (
          airOpsFlights.length === 0 ? (
            <div className="empty">No air flights</div>
          ) : (
            airOpsFlights.map(flight => (
              <FlightCard
                key={flight.id}
                flight={flight}
                isExpanded={expandedFlight === flight.id}
                onToggle={() => setExpandedFlight(expandedFlight === flight.id ? null : flight.id)}
                isAirOps={true}
                isCircuitTraining={isCircuitTraining(flight)}
                patterns={patterns}
                onAction={handleQuickAction}
              />
            ))
          )
        )}
      </div>
    </div>
  );
};

const FlightCard = ({ flight, isExpanded, onToggle, isAfterLanding, isTaxiReady, isAirOps, isCircuitTraining, patterns, onAction, runway }) => {
  const isOnGround = !isAirOps;

  return (
    <div className={`flight-card ${isExpanded ? 'expanded' : ''}`}>
      <div className="card-header" onClick={onToggle}>
        <div className="flight-info">
          <div className="registration">{flight.aircraft?.registration || 'N/A'}</div>
          <div className="pic">{flight.pic || '-'}</div>
        </div>
        <div className="status">
          <span className={`phase-badge ${flight.phase}`}>{flight.phase.toUpperCase()}</span>
        </div>
        <div className="expand-icon">{isExpanded ? '−' : '+'}</div>
      </div>

      {isExpanded && (
        <div className="card-actions">
          {isAirOps ? (
            <>
              {/* AIR OPS ACTIONS */}
              {isCircuitTraining ? (
                <div className="action-grid">
                  {Object.keys(patterns).map(leg => (
                    <button
                      key={leg}
                      className="action-btn pattern-btn"
                      onClick={() => onAction(flight.id, 'pattern', leg)}
                    >
                      {leg.toUpperCase()}
                    </button>
                  ))}
                </div>
              ) : (
                <button className="action-btn wide" onClick={() => onAction(flight.id, 'position')}>
                  📍 POSITION REPORT
                </button>
              )}
              <div className="action-grid">
                <button className="action-btn warning" onClick={() => onAction(flight.id, 'goaround')}>
                  ↩️ GA
                </button>
                <button className="action-btn danger" onClick={() => onAction(flight.id, 'land')}>
                  📍 LAND
                </button>
              </div>
            </>
          ) : (
            <>
              {/* GROUND OPS ACTIONS */}
              {isAfterLanding ? (
                <>
                  <div className="info-line">Landing #{flight.landing_count} | GA: {flight.go_around_count || 0}</div>
                  <button className="action-btn wide success" onClick={() => onAction(flight.id, 'start')}>
                    🔄 ANOTHER CIRCUIT
                  </button>
                  <button className="action-btn wide secondary" onClick={() => onAction(flight.id, 'start')}>
                    🚕 TO APRON
                  </button>
                </>
              ) : isTaxiReady ? (
                <>
                  <button className="action-btn wide primary" onClick={() => onAction(flight.id, 'start')}>
                    ▶️ START
                  </button>
                  <div className="taxi-grid">
                    {['apron', 'P1', 'P2', 'P3', 'P4', 'P5', 'P6'].map(pt => (
                      <button
                        key={pt}
                        className="action-btn taxi-btn"
                        onClick={() => onAction(flight.id, 'taxi', pt)}
                      >
                        {pt}
                      </button>
                    ))}
                  </div>
                  <button className="action-btn wide info" onClick={() => onAction(flight.id, 'takeoff')}>
                    🚀 TAKEOFF
                  </button>
                </>
              ) : flight.phase === 'taxi' ? (
                <button className="action-btn wide info" onClick={() => onAction(flight.id, 'takeoff')}>
                  🚀 TAKEOFF
                </button>
              ) : flight.phase === 'shutdown' ? (
                <div className="info-line">✅ COMPLETED</div>
              ) : null}
            </>
          )}
        </div>
      )}
    </div>
  );
};

export default TowerPageMobile;

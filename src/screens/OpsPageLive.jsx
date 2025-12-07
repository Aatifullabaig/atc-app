import React, { useState, useEffect, useRef } from 'react';
import supabase from '../lib/supabaseClient';
import {
  getActiveFlights,
  getCompletedFlights,
  getArchivedFlights,
  getFlightEvents,
  getSectorName,
  getPhaseDisplay,
} from '../lib/flightService';
import {
  formatFlightLogs,
  getCurrentUTCTime,
  formatPosition,
  getPhaseColor,
  getPilotDisplayName,
  getAircraftDisplayName,
} from '../utils/flightUtils';
import '../shared/OpsPageLive.css';

const OpsPageLive = () => {
  const [activeFlights, setActiveFlights] = useState([]);
  const [completedFlights, setCompletedFlights] = useState([]);
  const [archivedFlights, setArchivedFlights] = useState([]);
  const [selectedFlight, setSelectedFlight] = useState(null);
  const [flightLogs, setFlightLogs] = useState([]);
  const [utcTime, setUtcTime] = useState(getCurrentUTCTime());
  const [tab, setTab] = useState('active'); // 'active', 'completed', 'archived'
  const [loading, setLoading] = useState(false);
  const mapRef = useRef(null);

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
      const [active, completed, archived] = await Promise.all([
        getActiveFlights(),
        getCompletedFlights(),
        getArchivedFlights(20),
      ]);
      setActiveFlights(active || []);
      setCompletedFlights(completed || []);
      setArchivedFlights(archived || []);
    } catch (err) {
      console.error('Error loading flights:', err);
    }
  };

  const setupRealtimeSubscriptions = () => {
    const sub = supabase
      .channel('ops_flights')
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

  const handleSelectFlight = async (flight) => {
    setSelectedFlight(flight);
    try {
      const events = await getFlightEvents(flight.id);
      setFlightLogs(formatFlightLogs(events || []));
    } catch (err) {
      console.error('Error loading flight events:', err);
      setFlightLogs([]);
    }
  };

  const getFlightsList = () => {
    let flights = [];
    if (tab === 'active') flights = activeFlights;
    else if (tab === 'completed') flights = completedFlights;
    else flights = archivedFlights;
    return flights;
  };

  const flights = getFlightsList();

  return (
    <div className="ops-container">
      <header className="ops-header">
        <div className="header-left">
          <h1>Operations</h1>
          <div className="utc-time">{utcTime} UTC</div>
        </div>
        <div className="tab-buttons">
          <button 
            className={`tab-btn ${tab === 'active' ? 'active' : ''}`}
            onClick={() => setTab('active')}
          >
            Active {activeFlights.length > 0 && `(${activeFlights.length})`}
          </button>
          <button 
            className={`tab-btn ${tab === 'completed' ? 'active' : ''}`}
            onClick={() => setTab('completed')}
          >
            Completed {completedFlights.length > 0 && `(${completedFlights.length})`}
          </button>
          <button 
            className={`tab-btn ${tab === 'archived' ? 'active' : ''}`}
            onClick={() => setTab('archived')}
          >
            Archive {archivedFlights.length > 0 && `(${archivedFlights.length})`}
          </button>
        </div>
      </header>

      <div className="ops-main">
        {/* Aircraft List */}
        <div className="aircraft-list-section">
          <h2>{tab === 'active' ? 'Active Flights' : tab === 'completed' ? 'Completed Flights' : 'Archived Flights'}</h2>
          <div className="aircraft-list">
            {flights.length === 0 ? (
              <div className="empty-state">No flights</div>
            ) : (
              flights.map((flight) => {
                const sector = flight.radial_deg ? getSectorName(flight.radial_deg) : 'N/A';
                const phaseDisplay = getPhaseDisplay(flight.phase, flight.runway_in_use);
                const isSelected = selectedFlight?.id === flight.id;
                
                return (
                  <div
                    key={flight.id}
                    className={`flight-row ${isSelected ? 'selected' : ''}`}
                    onClick={() => handleSelectFlight(flight)}
                  >
                    <div className="flight-row-header">
                      <div className="registration">
                        {getAircraftDisplayName(flight.aircraft)}
                      </div>
                      <span className={`phase-badge ${getPhaseColor(flight.phase)}`}>
                        {phaseDisplay} ({sector})
                      </span>
                    </div>
                    
                    <div className="flight-row-details">
                      <div className="detail-line">
                        <strong>Position:</strong> {formatPosition(flight.radial_deg, flight.distance_nm, flight.altitude_ft, flight.runway_in_use)}
                      </div>
                      <div className="detail-line">
                        <strong>PIC:</strong> {getPilotDisplayName(flight.student || flight.instructor)}
                        {flight.go_around_count > 0 && ` | GA: ${flight.go_around_count}`}
                        {flight.landing_count > 0 && ` | Land: ${flight.landing_count}`}
                      </div>
                      <div className="detail-line">
                        <strong>Type:</strong> {flight.type_of_flight || 'N/A'}
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Flight Logs */}
        <div className="flight-logs-section">
          {selectedFlight ? (
            <>
              <h3>Flight Log: {getAircraftDisplayName(selectedFlight.aircraft)}</h3>
              <div className="flight-logs">
                {flightLogs.length === 0 ? (
                  <div className="empty-logs">No events</div>
                ) : (
                  flightLogs.map((log, idx) => (
                    <div key={idx} className="log-entry">
                      {log}
                    </div>
                  ))
                )}
              </div>
            </>
          ) : (
            <div className="no-selection">
              Select a flight to view logs
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default OpsPageLive;

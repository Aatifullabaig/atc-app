import React, { useState, useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import supabase from '../lib/supabaseClient';
import {
  getActiveFlights,
  getFlightEvents,
  getGlobalState,
  getSectorName,
} from '../lib/flightService';
import {
  formatFlightLogs,
  getCurrentUTCTime,
  formatPosition,
  formatFlightSummary,
  convertPolarToLatLon,
} from '../utils/flightUtils';
import '../shared/OpsPageOptimized.css';

const OpsPageOptimized = () => {
  const [activeFlights, setActiveFlights] = useState([]);
  const [oldAircraft, setOldAircraft] = useState([]);
  const [selectedFlight, setSelectedFlight] = useState(null);
  const [flightLogs, setFlightLogs] = useState([]);
  const [utcTime, setUtcTime] = useState(getCurrentUTCTime());
  const [vorCenter, setVorCenter] = useState({ lat: -20.2844, lon: 85.2236 });
  const [runway, setRunway] = useState('22');
  const mapRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const markersRef = useRef({});

  // UTC Clock
  useEffect(() => {
    const interval = setInterval(() => setUtcTime(getCurrentUTCTime()), 1000);
    return () => clearInterval(interval);
  }, []);

  // Initialize Leaflet map
  useEffect(() => {
    if (!mapRef.current || mapInstanceRef.current) return;

    delete L.Icon.Default.prototype._getIconUrl;
    L.Icon.Default.mergeOptions({
      iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
      iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
      shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
    });

    const map = L.map(mapRef.current).setView([vorCenter.lat, vorCenter.lon], 10);

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© OpenStreetMap',
      maxZoom: 19,
    }).addTo(map);

    // VOR center
    L.circleMarker([vorCenter.lat, vorCenter.lon], {
      radius: 8,
      fillColor: '#ff0000',
      color: '#ff0000',
      weight: 2,
      opacity: 1,
      fillOpacity: 0.8,
    })
      .addTo(map)
      .bindPopup('Gondia VOR');

    // 25nm circle
    const earthRadiusM = 1852;
    const radiusM = 25 * earthRadiusM;
    L.circle([vorCenter.lat, vorCenter.lon], radiusM, {
      color: 'blue',
      fill: false,
      weight: 2,
      opacity: 0.5,
      dashArray: '5, 5',
    }).addTo(map);

    mapInstanceRef.current = map;

    return () => {
      map.remove();
      mapInstanceRef.current = null;
    };
  }, [vorCenter]);

  // Load data
  useEffect(() => {
    loadData();
    setupRealtimeSubscriptions();
  }, []);

  const setupRealtimeSubscriptions = () => {
    const sub = supabase
      .channel('ops_flights')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'flights',
          filter: `status=in.(air,tower,completed)`,
        },
        () => loadData()
      )
      .subscribe();

    return () => sub.unsubscribe();
  };

  const loadData = async () => {
    try {
      // Active flights (still in ops)
      const active = await getActiveFlights();
      const now = new Date();
      const cutoffTime = new Date(now.getTime() - 48 * 60 * 60 * 1000); // 48 hours ago

      // Old aircraft (completed within last 48 hours)
      const { data: completedFlights } = await supabase
        .from('flights')
        .select('*,aircraft:aircraft_id(*)')
        .eq('status', 'completed')
        .gte('completed_at', cutoffTime.toISOString())
        .order('completed_at', { ascending: false })
        .limit(20);

      setActiveFlights(active || []);
      setOldAircraft(completedFlights || []);

      // Load global state
      const runwayState = await getGlobalState('runway_in_use');
      if (runwayState?.runway) setRunway(runwayState.runway);
    } catch (error) {
      console.error('Error loading data:', error);
    }
  };

  // Load logs when flight selected
  const handleSelectFlight = async (flight) => {
    setSelectedFlight(flight);
    try {
      const events = await getFlightEvents(flight.id);
      setFlightLogs(events || []);
    } catch (error) {
      console.error('Error loading logs:', error);
      setFlightLogs([]);
    }
  };

  // Update map markers
  useEffect(() => {
    if (!mapInstanceRef.current) return;

    // Clear old markers
    Object.values(markersRef.current).forEach((marker) => marker.remove());
    markersRef.current = {};

    // Add markers for active flights
    activeFlights.forEach((flight) => {
      if (flight.radial_deg !== null && flight.distance_nm !== null) {
        const latLon = convertPolarToLatLon(
          vorCenter,
          flight.radial_deg,
          flight.distance_nm
        );

        const marker = L.circleMarker(
          [latLon.lat, latLon.lon],
          {
            radius: 6,
            fillColor: flight.status === 'air' ? '#00ff00' : '#0088ff',
            color: '#fff',
            weight: 2,
            opacity: 1,
            fillOpacity: 0.9,
          }
        )
          .addTo(mapInstanceRef.current)
          .bindPopup(`${flight.aircraft.registration} - ${flight.phase}`);

        markersRef.current[flight.id] = marker;
      }
    });
  }, [activeFlights, vorCenter]);

  const FlightLog = ({ logs }) => {
    if (!logs || logs.length === 0) {
      return <div className="empty-logs">No events logged</div>;
    }

    return (
      <div className="flight-logs-container">
        {logs.map((log) => {
          const logTime = new Date(log.created_at);
          const timeStr = logTime.toLocaleTimeString('en-AU', {
            hour12: false,
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
          });

          return (
            <div key={log.id} className="log-entry">
              <span className="log-time">{timeStr}</span>
              <span className="log-message">— {log.message}</span>
            </div>
          );
        })}
      </div>
    );
  };

  const ActiveFlightCard = ({ flight }) => {
    return (
      <div
        className="flight-card-ops active-flight"
        onClick={() => handleSelectFlight(flight)}
        style={{
          borderLeft:
            flight.status === 'air'
              ? '4px solid #00ff00'
              : '4px solid #0088ff',
          backgroundColor:
            selectedFlight?.id === flight.id ? 'rgba(255, 107, 53, 0.2)' : '',
        }}
      >
        <div className="card-summary">
          <strong>{flight.aircraft.registration}</strong>
          {flight.radial_deg !== null && (
            <span className="position-badge">
              {flight.radial_deg}° / {flight.distance_nm}nm @ {flight.altitude_ft}ft
            </span>
          )}
        </div>
        <div className="card-details">
          <span className="detail-item">
            GA: {flight.go_around_count} | LD: {flight.landing_count}
          </span>
          <span className="detail-item">{flight.type_of_flight}</span>
          <span className="detail-item">PIC: {flight.pic}</span>
          <span
            className="phase-badge"
            style={{
              backgroundColor: flight.phase === 'airborne' ? '#00ff00' : '#0088ff',
            }}
          >
            {flight.phase.toUpperCase()}
          </span>
          {flight.radial_deg !== null && (
            <span className="sector-badge">{getSectorName(flight.radial_deg)}</span>
          )}
        </div>
      </div>
    );
  };

  const OldAircraftCard = ({ flight }) => {
    const completedTime = new Date(flight.completed_at);
    const timeStr = completedTime.toLocaleTimeString('en-AU', {
      hour12: false,
      hour: '2-digit',
      minute: '2-digit',
    });

    return (
      <div
        className="flight-card-ops old-aircraft"
        onClick={() => handleSelectFlight(flight)}
        style={{
          backgroundColor:
            selectedFlight?.id === flight.id ? 'rgba(255, 107, 53, 0.2)' : '',
        }}
      >
        <div className="card-summary">
          <strong>{flight.aircraft.registration}</strong>
          <span className="completed-time">Completed {timeStr}</span>
        </div>
        <div className="card-details">
          <span className="detail-item">LD: {flight.landing_count}</span>
          <span className="detail-item">{flight.type_of_flight}</span>
          <span className="detail-item">PIC: {flight.pic}</span>
        </div>
      </div>
    );
  };

  return (
    <div className="ops-page-optimized">
      <div className="ops-header">
        <h1>OPERATIONS CONTROL</h1>
        <div className="header-info">
          <span className="utc-time">UTC: {utcTime}</span>
          <span className="runway-display">RWY {runway}</span>
        </div>
      </div>

      <div className="ops-layout">
        {/* Map Section */}
        <div className="map-section">
          <div className="map-container" ref={mapRef} id="ops-map"></div>
        </div>

        {/* Aircraft List & Logs */}
        <div className="info-section">
          <div className="aircraft-list">
            <h2>ACTIVE AIRCRAFT</h2>
            <div className="list-container">
              {activeFlights.length === 0 ? (
                <div className="empty-message">No active aircraft</div>
              ) : (
                activeFlights.map((flight) => (
                  <ActiveFlightCard flight={flight} key={flight.id} />
                ))
              )}
            </div>

            <h2>OLD AIRCRAFT (Last 48 hrs)</h2>
            <div className="list-container">
              {oldAircraft.length === 0 ? (
                <div className="empty-message">No completed flights</div>
              ) : (
                oldAircraft.map((flight) => (
                  <OldAircraftCard flight={flight} key={flight.id} />
                ))
              )}
            </div>
          </div>

          {/* Flight Logs */}
          <div className="flight-logs">
            <h2>FLIGHT LOG</h2>
            {selectedFlight ? (
              <div className="logs-content">
                <div className="selected-flight-header">
                  <strong>{selectedFlight.aircraft.registration}</strong>
                  <span>{selectedFlight.pic}</span>
                </div>
                <FlightLog logs={flightLogs} />
              </div>
            ) : (
              <div className="empty-message">Select a flight to view logs</div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default OpsPageOptimized;

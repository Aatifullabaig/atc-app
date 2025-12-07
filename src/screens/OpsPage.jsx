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
import '../shared/OpsPage.css';

const OpsPage = () => {
  const [activeFlights, setActiveFlights] = useState([]);
  const [selectedFlight, setSelectedFlight] = useState(null);
  const [flightLogs, setFlightLogs] = useState([]);
  const [utcTime, setUtcTime] = useState(getCurrentUTCTime());
  const [vorCenter, setVorCenter] = useState({ lat: -20.2844, lon: 85.2236 });
  const [runway, setRunway] = useState('22');
  const mapRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const markersRef = useRef({});

  // Update UTC clock
  useEffect(() => {
    const interval = setInterval(() => {
      setUtcTime(getCurrentUTCTime());
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  // Initialize map
  useEffect(() => {
    if (!mapRef.current || mapInstanceRef.current) return;

    // Fix Leaflet marker icons
    delete L.Icon.Default.prototype._getIconUrl;
    L.Icon.Default.mergeOptions({
      iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
      iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
      shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
    });

    const map = L.map(mapRef.current).setView([vorCenter.lat, vorCenter.lon], 10);

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© OpenStreetMap contributors',
      maxZoom: 19,
    }).addTo(map);

    // Add VOR center marker
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

    // Add 25nm circle
    const earthRadiusM = 1852; // 1 nm = 1852m
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

  // Load initial data
  useEffect(() => {
    loadInitialData();
    setupRealtimeSubscription();
  }, []);

  const loadInitialData = async () => {
    try {
      const [flights, vorState, runwayState] = await Promise.all([
        getActiveFlights(),
        getGlobalState('vor_gondia'),
        getGlobalState('runway_in_use'),
      ]);

      setActiveFlights(flights || []);

      if (vorState?.lat && vorState?.lon) {
        setVorCenter({ lat: vorState.lat, lon: vorState.lon });
      }

      if (runwayState?.runway) {
        setRunway(runwayState.runway);
      }

      // Update map markers
      updateMapMarkers(flights || []);
    } catch (err) {
      console.error('Error loading data:', err);
    }
  };

  const setupRealtimeSubscription = () => {
    const subscription = supabase
      .channel('flights-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'flights' }, () => {
        loadInitialData();
      })
      .subscribe();

    return () => {
      subscription.unsubscribe();
    };
  };

  const updateMapMarkers = (flights) => {
    if (!mapInstanceRef.current) return;

    // Clear old markers
    Object.values(markersRef.current).forEach((marker) => {
      mapInstanceRef.current.removeLayer(marker);
    });
    markersRef.current = {};

    // Add new markers
    flights.forEach((flight) => {
      if (flight.radial_deg !== null && flight.distance_nm !== null) {
        const latLon = convertPolarToLatLon(
          vorCenter,
          flight.radial_deg,
          flight.distance_nm
        );

        if (latLon) {
          const color = flight.status === 'air' ? '#00ff00' : '#ffaa00';
          const marker = L.circleMarker([latLon.lat, latLon.lon], {
            radius: 6,
            fillColor: color,
            color: color,
            weight: 2,
            opacity: 1,
            fillOpacity: 0.8,
          })
            .addTo(mapInstanceRef.current)
            .bindPopup(`${flight.aircraft?.registration}<br />${flight.altitude_ft} ft`);

          markersRef.current[flight.id] = marker;

          // Add click handler to select flight
          marker.on('click', () => {
            handleSelectFlight(flight);
          });
        }
      }
    });
  };

  const handleSelectFlight = async (flight) => {
    setSelectedFlight(flight);

    try {
      const events = await getFlightEvents(flight.id);
      setFlightLogs(formatFlightLogs(events || []));
    } catch (err) {
      console.error('Error loading flight logs:', err);
      setFlightLogs([]);
    }
  };

  const handleCloseFlightDetails = () => {
    setSelectedFlight(null);
    setFlightLogs([]);
  };

  return (
    <div className="ops-page">
      {/* Header */}
      <header className="page-header">
        <div className="header-content">
          <h1>Ops / Radar</h1>
          <div className="utc-clock">{utcTime} UTC</div>
        </div>
      </header>

      <div className="ops-layout">
        {/* Map Section */}
        <div className="map-section">
          <div className="map-info">
            <p>Gondia VOR | RWY {runway} | {activeFlights.length} active flights</p>
          </div>
          <div ref={mapRef} className="map-container"></div>
        </div>

        {/* Aircraft List Section */}
        <div className="aircraft-list-section">
          <h2>Active Flights</h2>
          {activeFlights.length === 0 ? (
            <p className="empty-state">No active flights</p>
          ) : (
            <div className="aircraft-list">
              {activeFlights.map((flight) => (
                <div
                  key={flight.id}
                  className={`aircraft-item ${selectedFlight?.id === flight.id ? 'selected' : ''}`}
                  onClick={() => handleSelectFlight(flight)}
                >
                  <div className="aircraft-item-header">
                    <span className="aircraft-registration">
                      {flight.aircraft?.registration}
                    </span>
                    <span className={`status-badge ${flight.status}`}>{flight.status.toUpperCase()}</span>
                  </div>

                  <div className="aircraft-item-details">
                    <p className="position-detail">
                      {flight.radial_deg ? `${flight.radial_deg}°` : '—'} / 
                      {flight.distance_nm ? ` ${flight.distance_nm}nm` : ' —'} @ 
                      {flight.altitude_ft ? ` ${flight.altitude_ft}ft` : ' —'}
                    </p>
                    <p className="phase-detail">
                       {flight.phase.toUpperCase()}
                       {flight.radial_deg && ` — ${getSectorName(flight.radial_deg)}`}
                     </p>
                    <p className="traffic-detail">GA:{flight.go_around_count} | Land:{flight.landing_count}</p>
                    <p className="info-detail">{flight.type_of_flight} • {flight.pic}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Flight Details Panel */}
      {selectedFlight && (
        <div className="flight-details-panel">
          <div className="panel-header">
            <h3>{selectedFlight.aircraft?.registration}</h3>
            <button className="close-btn" onClick={handleCloseFlightDetails}>×</button>
          </div>

          <div className="panel-content">
            <div className="flight-summary">
              <p><strong>Registration:</strong> {selectedFlight.aircraft?.registration}</p>
              <p><strong>Status:</strong> {selectedFlight.status.toUpperCase()} | <strong>Phase:</strong> {selectedFlight.phase.replace('_', ' ').toUpperCase()}</p>
              {selectedFlight.radial_deg && <p><strong>Sector:</strong> {getSectorName(selectedFlight.radial_deg)}</p>}
              <p><strong>Position:</strong> {formatPosition(selectedFlight.radial_deg, selectedFlight.distance_nm, selectedFlight.altitude_ft, selectedFlight.runway_in_use)}</p>
              <p><strong>PIC:</strong> {selectedFlight.pic} | <strong>Type:</strong> {selectedFlight.type_of_flight}</p>
              <p><strong>Traffic:</strong> GA: {selectedFlight.go_around_count} | Landings: {selectedFlight.landing_count}</p>
              {selectedFlight.student && <p><strong>Student:</strong> {selectedFlight.student?.name}</p>}
            </div>

            <div className="flight-logs">
              <h4>Flight Events</h4>
              {flightLogs.length === 0 ? (
                <p>No events recorded</p>
              ) : (
                <ul>
                  {flightLogs.map((log, idx) => (
                    <li key={idx}>{log}</li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default OpsPage;

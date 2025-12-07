import React, { useState, useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import supabase from '../lib/supabaseClient';
import {
  getActiveFlights,
  getCompletedFlights,
  getArchivedFlights,
  getFlightEvents,
  getSectorName,
  getPhaseDisplay,
  getGlobalState,
} from '../lib/flightService';
import {
  formatFlightLogs,
  getCurrentUTCTime,
  formatPosition,
  getPhaseColor,
  getPilotDisplayName,
  getAircraftDisplayName,
  convertPolarToLatLon,
} from '../utils/flightUtils';
import '../shared/OpsPageLive.css';

const OpsPageWithMap = () => {
  const [activeFlights, setActiveFlights] = useState([]);
  const [completedFlights, setCompletedFlights] = useState([]);
  const [archivedFlights, setArchivedFlights] = useState([]);
  const [selectedFlight, setSelectedFlight] = useState(null);
  const [flightLogs, setFlightLogs] = useState([]);
  const [utcTime, setUtcTime] = useState(getCurrentUTCTime());
  const [tab, setTab] = useState('active');
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

  // Initialize map
  useEffect(() => {
    if (!mapRef.current || mapInstanceRef.current) return;

    try {
      // Fix Leaflet default icons
      delete L.Icon.Default.prototype._getIconUrl;
      L.Icon.Default.mergeOptions({
        iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
        iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
        shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
      });

      const map = L.map(mapRef.current, {
        center: [vorCenter.lat, vorCenter.lon],
        zoom: 10,
        zoomControl: true,
        attributionControl: true,
      });

      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap contributors',
        maxZoom: 19,
        minZoom: 8,
      }).addTo(map);

      // VOR center marker
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
      console.log('Map initialized successfully');

      return () => {
        if (mapInstanceRef.current) {
          mapInstanceRef.current.remove();
          mapInstanceRef.current = null;
        }
      };
    } catch (err) {
      console.error('Map initialization error:', err);
    }
  }, [vorCenter]);

  // Load data
  useEffect(() => {
    loadData();
    setupRealtimeSubscriptions();
  }, []);

  const loadData = async () => {
    try {
      const [active, completed, archived, vorState, runwayState] = await Promise.all([
        getActiveFlights(),
        getCompletedFlights(),
        getArchivedFlights(20),
        getGlobalState('vor_gondia'),
        getGlobalState('runway_in_use'),
      ]);
      setActiveFlights(active || []);
      setCompletedFlights(completed || []);
      setArchivedFlights(archived || []);

      if (vorState?.lat && vorState?.lon) {
        setVorCenter({ lat: vorState.lat, lon: vorState.lon });
      }

      if (runwayState?.runway) {
        setRunway(runwayState.runway);
      }

      updateMapMarkers(active || []);
    } catch (err) {
      console.error('Error loading flights:', err);
    }
  };

  const updateMapMarkers = (flights) => {
    if (!mapInstanceRef.current) return;

    Object.values(markersRef.current).forEach((marker) => {
      mapInstanceRef.current.removeLayer(marker);
    });
    markersRef.current = {};

    flights.forEach((flight) => {
      if (flight.radial_deg !== null && flight.distance_nm !== null) {
        const latLon = convertPolarToLatLon(vorCenter, flight.radial_deg, flight.distance_nm);

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
          marker.on('click', () => {
            handleSelectFlight(flight);
          });
        }
      }
    });
  };

  const setupRealtimeSubscriptions = () => {
    const sub = supabase
      .channel('ops_flights_map')
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
    <div className="ops-container-map">
      <header className="ops-header">
        <div className="header-left">
          <h1>Ops / Radar</h1>
          <div className="utc-time">{utcTime} UTC | RWY {runway}</div>
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

      <div className="ops-main-map">
        {/* Map Section */}
        <div className="map-section">
          <div ref={mapRef} style={{ flex: 1, width: '100%' }} />
        </div>

        {/* Aircraft List */}
        <div className="aircraft-list-section">
          <h2>{tab === 'active' ? 'Active' : tab === 'completed' ? 'Completed' : 'Archive'}</h2>
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
                        <strong>Pos:</strong> {formatPosition(flight.radial_deg, flight.distance_nm, flight.altitude_ft, flight.runway_in_use)}
                      </div>
                      <div className="detail-line">
                        <strong>PIC:</strong> {getPilotDisplayName(flight.student || flight.instructor)}
                        {flight.go_around_count > 0 && ` | GA:${flight.go_around_count}`}
                        {flight.landing_count > 0 && ` | Ld:${flight.landing_count}`}
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
              <h3>{getAircraftDisplayName(selectedFlight.aircraft)}</h3>
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

export default OpsPageWithMap;

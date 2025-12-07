import React, { useState, useEffect, useRef, useContext } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { ThemeContext } from '../context/ThemeContext';
import supabase from '../lib/supabaseClient';
import {
  getActiveFlights,
} from '../lib/flightService';
import {
  getCurrentUTCTime,
  getPhaseColor,
  convertPolarToLatLon,
} from '../utils/flightUtils';
import '../shared/HomePage.css';

const HomePage = () => {
  const navigate = useNavigate();
  const { user, userRole, isApproved, logout } = useAuth();
  const { isDark, toggleTheme } = useContext(ThemeContext);
  const [activeFlights, setActiveFlights] = useState([]);
  const [completedFlights, setCompletedFlights] = useState([]);
  const [selectedFlight, setSelectedFlight] = useState(null);
  const [utcTime, setUtcTime] = useState(getCurrentUTCTime());
  const [vorCenter, setVorCenter] = useState({ lat: 21.5268, lng: 80.2903 });
  const mapRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const markersRef = useRef({});

  // UTC Clock
  useEffect(() => {
    const interval = setInterval(() => setUtcTime(getCurrentUTCTime()), 1000);
    return () => clearInterval(interval);
  }, []);

  // Load VOR configuration from global_state table
  useEffect(() => {
    const loadVorConfig = async () => {
      try {
        const { data, error } = await supabase
          .from('global_state')
          .select('value')
          .eq('key', 'vor_gondia')
          .single();

        if (error) {
          console.error('Error loading VOR config:', error);
          return;
        }

        if (data && data.value) {
          // Handle both JSON string and object formats
          let vorData;
          if (typeof data.value === 'string') {
            vorData = JSON.parse(data.value);
          } else {
            vorData = data.value;
          }
          setVorCenter({ lat: vorData.lat, lng: vorData.lon });
        }
      } catch (err) {
        console.error('Error parsing VOR config:', err);
      }
    };

    loadVorConfig();
  }, []);

  // Initialize map
  useEffect(() => {
    if (!mapRef.current || mapInstanceRef.current) return;

    try {
      L.Icon.Default.mergeOptions({
        iconRetinaUrl: require('leaflet/dist/images/marker-icon-2x.png'),
        iconUrl: require('leaflet/dist/images/marker-icon.png'),
        shadowUrl: require('leaflet/dist/images/marker-shadow.png'),
      });

      const map = L.map(mapRef.current).setView([vorCenter.lat, vorCenter.lng], 12);

      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap contributors',
        maxZoom: 19,
      }).addTo(map);

      const vorMarker = L.circleMarker([vorCenter.lat, vorCenter.lng], {
        radius: 8,
        fillColor: '#ff0000',
        color: '#000',
        weight: 2,
        opacity: 1,
        fillOpacity: 0.8,
      }).addTo(map);
      vorMarker.bindPopup('VOR Center');

      mapInstanceRef.current = map;
    } catch (err) {
      console.error('Map error:', err);
    }

    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, [vorCenter.lat, vorCenter.lng]);

  // Load active flights
  useEffect(() => {
    const loadFlights = async () => {
      try {
        const flights = await getActiveFlights();
        setActiveFlights(flights || []);

        // Load completed flights for today
        const today = new Date().toISOString().split('T')[0];
        const { data: completed } = await supabase
          .from('flights')
          .select('*')
          .eq('status', 'completed')
          .gte('completed_at', `${today}T00:00:00`)
          .order('completed_at', { ascending: false });
        setCompletedFlights(completed || []);

        if (mapInstanceRef.current) {
          Object.values(markersRef.current).forEach(marker => marker.remove());
          markersRef.current = {};

          (flights || []).forEach(flight => {
            // Skip flights without position data
            if (!flight || flight.radial_deg === null || flight.distance_nm === null) {
              if (flight) console.warn(`No position data for flight ${flight.callsign}`);
              return;
            }

            const pos = convertPolarToLatLon(
              vorCenter.lat,
              vorCenter.lng,
              flight.radial_deg,
              flight.distance_nm
            );

            // Skip invalid positions
            if (!pos || isNaN(pos.lat) || isNaN(pos.lng)) {
              console.warn(`Invalid position for flight ${flight.callsign}:`, pos);
              return;
            }

            const marker = L.circleMarker([pos.lat, pos.lng], {
              radius: 6,
              fillColor: getPhaseColor(flight.phase),
              color: '#000',
              weight: 1,
              opacity: 1,
              fillOpacity: 0.7,
            }).addTo(mapInstanceRef.current);

            marker.bindPopup(
              `<b>${flight.callsign}</b><br>${flight.phase}<br>${flight.altitude_feet} ft`
            );

            marker.on('click', () => setSelectedFlight(flight));
            markersRef.current[flight.id] = marker;
          });
        }
      } catch (err) {
        console.error('Error loading flights:', err);
      }
    };

    const interval = setInterval(loadFlights, 5000);
    loadFlights();

    return () => clearInterval(interval);
  }, [vorCenter.lat, vorCenter.lng]);

  const handleNavigate = (path) => {
    if (user && isApproved) {
      navigate(path);
    } else if (!user) {
      navigate('/login');
    }
  };

  // eslint-disable-next-line no-unused-vars
  const handleLogout = async () => {
    try {
      await logout();
      navigate('/login', { replace: true });
    } catch (error) {
      console.error('Logout failed:', error);
      navigate('/login', { replace: true });
    }
  };

  return (
    <div className={`home-page ${isDark ? 'dark' : 'light'}`}>
      {/* Header */}
      <header className="home-header">
        <div className="header-content">
          <div className="logo-section">
            <h1>✈️ ATC TRACKER</h1>
            <p>Flight Operations System</p>
          </div>
          <div className="header-actions">
            <div className="utc-clock">
              <span>UTC: {utcTime}</span>
            </div>
            <button
              className="theme-btn"
              onClick={toggleTheme}
              title="Toggle theme"
            >
              {isDark ? '☀️' : '🌙'}
            </button>
            {!user && (
              <button
                className="nav-btn login-btn"
                onClick={() => navigate('/login')}
              >
                Login
              </button>
            )}
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="home-main">
        <div className="content-wrapper">
          {/* Left Panel - Info */}
          <div className="info-panel">
            <section className="info-section">
              <h2>Live Operations</h2>
              <div className="stats">
                <div className="stat-card">
                  <span className="stat-number">{activeFlights.length}</span>
                  <span className="stat-label">Active Flights</span>
                </div>
              </div>
              <div className="flights-list">
                {activeFlights.length === 0 ? (
                  <p className="no-data">No active flights</p>
                ) : (
                  activeFlights.map(flight => (
                    <div
                      key={flight.id}
                      className="flight-item"
                      onClick={() => setSelectedFlight(flight)}
                      style={{
                        borderLeftColor: getPhaseColor(flight.phase),
                      }}
                    >
                      <div className="flight-callsign">{flight.callsign}</div>
                      <div className="flight-details">
                        <span>{flight.phase}</span>
                        <span>{flight.altitude_feet} ft</span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </section>
            <section className="info-section">
              <h2>✅ Completed Flights (Today)</h2>
              <div className="flights-list">
                {completedFlights.length === 0 ? (
                  <p className="no-data">No completed flights today</p>
                ) : (
                  completedFlights.map(flight => (
                    <div
                      key={flight.id}
                      className="flight-item"
                      onClick={() => setSelectedFlight(flight)}
                      style={{
                        borderLeftColor: '#27ae60',
                        opacity: 0.8
                      }}
                    >
                      <div className="flight-callsign">{flight.callsign}</div>
                      <div className="flight-details">
                        <span>Landed</span>
                        <span>{flight.altitude_feet} ft</span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </section>
            <section className="info-section">
              <h2>Quick Access</h2>
              <div className="quick-access">
                {userRole === 'admin' && (
                  <button
                    className="access-btn"
                    onClick={() => handleNavigate('/admin')}
                    disabled={!user}
                    style={{ background: '#f39c12' }}
                  >
                    🔐 Admin Panel
                  </button>
                )}
                {(userRole === 'ground' || userRole === 'ground_tower' || userRole === 'admin') && (
                  <button
                    className="access-btn"
                    onClick={() => handleNavigate('/ground')}
                    disabled={!user || !isApproved}
                  >
                    📍 Ground Control
                  </button>
                )}
                {(userRole === 'tower' || userRole === 'ground_tower' || userRole === 'admin') && (
                  <button
                    className="access-btn"
                    onClick={() => handleNavigate('/tower')}
                    disabled={!user || !isApproved}
                  >
                    🏠 Tower
                  </button>
                )}
              </div>
            </section>
          </div>

          {/* Map Panel */}
          <div className="map-panel">
            <div
              ref={mapRef}
              className="map-container"
              style={{ width: '100%', height: '100%' }}
            />
            {selectedFlight && (
              <div className="flight-detail-overlay">
                <div className="detail-card">
                  <button
                    className="close-btn"
                    onClick={() => setSelectedFlight(null)}
                  >
                    ✕
                  </button>
                  <h3>{selectedFlight.callsign}</h3>
                  <div className="detail-row">
                    <span>PIC (Pilot):</span>
                    <span>{selectedFlight.pic?.name || 'N/A'}</span>
                  </div>
                  <div className="detail-row">
                    <span>Aircraft:</span>
                    <span>{selectedFlight.aircraft?.registration || 'N/A'}</span>
                  </div>
                  <div className="detail-row">
                    <span>Phase:</span>
                    <span>{selectedFlight.phase}</span>
                  </div>
                  <div className="detail-row">
                    <span>Altitude:</span>
                    <span>{selectedFlight.altitude_feet} ft</span>
                  </div>
                  <div className="detail-row">
                    <span>Go-Arounds:</span>
                    <span>{selectedFlight.go_arounds || 0}</span>
                  </div>
                  <div className="detail-row">
                    <span>Airborne Time:</span>
                    <span>{selectedFlight.airborne_time || 'N/A'}</span>
                  </div>
                  <div className="detail-row">
                    <span>Landing Time:</span>
                    <span>{selectedFlight.landing_time ? new Date(selectedFlight.landing_time).toLocaleTimeString('en-US', {timeZone: 'UTC'}) : 'N/A'}</span>
                  </div>
                  <div className="detail-row">
                    <span>Total Landings:</span>
                    <span>{selectedFlight.total_landings || 0}</span>
                  </div>
                  <div className="detail-row">
                    <span>Runway:</span>
                    <span>{selectedFlight.runway}</span>
                  </div>
                  <div className="detail-row">
                    <span>Radial:</span>
                    <span>{selectedFlight.radial}°</span>
                  </div>
                  <div className="detail-row">
                    <span>Distance:</span>
                    <span>{selectedFlight.distance_nm} NM</span>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="home-footer">
        <div className="footer-content">
          <div className="footer-section">
            <h4>About</h4>
            <p>ATC Tracker - Flight Operations System</p>
            <p>Developed by <strong>M M Aatifullah Baig</strong></p>
          </div>
          <div className="footer-section">
            <h4>Dedicated To</h4>
            <p>NFTI - National Flight Training Institute</p>
            <p>Professional Air Traffic Control Training</p>
          </div>
          <div className="footer-section">
            <h4>Features</h4>
            <ul>
              <li>Real-time Flight Tracking</li>
              <li>Ground Control Operations</li>
              <li>Tower Management</li>
              <li>Flight Monitoring</li>
            </ul>
          </div>
          <div className="footer-section">
            <h4>Status</h4>
            <p>System Status: <span className="status-online">Online</span></p>
            <p>Version: 1.0.0</p>
          </div>
        </div>
        <div className="footer-bottom">
          <p>&copy; 2025 
            ATC Tracker - Flight Operations System</p>
            <p>Developed by <strong>M M Aatifullah Baig</strong></p>
        </div>
      </footer>
    </div>
  );
};

export default HomePage;

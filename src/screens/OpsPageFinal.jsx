import React, { useEffect, useState, useContext } from 'react';
import { ThemeContext } from '../context/ThemeContext';
import supabase from '../lib/supabaseClient';
import { formatFlightLog } from '../lib/flightService';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

const OpsPageFinal = () => {
  const { isDark } = useContext(ThemeContext);
  const [flights, setFlights] = useState([]);
  const [oldFlights, setOldFlights] = useState([]);
  const [selectedFlightId, setSelectedFlightId] = useState(null);
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [runwayInUse, setRunwayInUse] = useState('22');
  const [activeTab, setActiveTab] = useState('active');
  const [vorData, setVorData] = useState({ lat: 19.8854, lon: 74.8196 });

  const mapRef = React.useRef(null);
  const mapInstanceRef = React.useRef(null);
  const markersRef = React.useRef({});

  // Load VOR data and runway
  useEffect(() => {
    const loadGlobalState = async () => {
      try {
        const { data: vorState } = await supabase
          .from('global_state')
          .select('*')
          .eq('key', 'vor_gondia')
          .single();

        if (vorState?.value) {
          setVorData({
            lat: vorState.value.lat || 19.8854,
            lon: vorState.value.lon || 74.8196,
          });
        }

        const { data: runwayState } = await supabase
          .from('global_state')
          .select('*')
          .eq('key', 'runway_in_use')
          .single();

        if (runwayState?.value?.runway) {
          setRunwayInUse(runwayState.value.runway);
        }
      } catch (err) {
        console.error('Error loading global state:', err);
      }
    };

    loadGlobalState();
  }, []);

  // Initialize map
  useEffect(() => {
    if (!mapRef.current) return;

    if (mapInstanceRef.current) {
      mapInstanceRef.current.remove();
    }

    const map = L.map(mapRef.current).setView([vorData.lat, vorData.lon], 12);

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '© OpenStreetMap contributors',
    }).addTo(map);

    // Draw 25nm circle
    const nmToMeters = 1852;
    L.circle([vorData.lat, vorData.lon], 25 * nmToMeters, {
      color: '#3498db',
      fillOpacity: 0.1,
      weight: 2,
      dashArray: '5, 5',
    }).addTo(map);

    // VOR marker
    L.circleMarker([vorData.lat, vorData.lon], {
      radius: 8,
      fillColor: '#e74c3c',
      color: '#c0392b',
      weight: 2,
      opacity: 1,
      fillOpacity: 0.8,
    })
      .bindPopup('VOR Gondia')
      .addTo(map);

    mapInstanceRef.current = map;

    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, [vorData]);

  // Convert radial/distance to lat/lon
  const getLatLonFromRadial = (radial, distance) => {
    const R = 6371; // Earth radius in km
    const lat1 = (vorData.lat * Math.PI) / 180;
    const lon1 = (vorData.lon * Math.PI) / 180;
    const bearing = (radial * Math.PI) / 180;
    const d = (distance * 1.852) / R;

    const lat2 = Math.asin(
      Math.sin(lat1) * Math.cos(d) +
        Math.cos(lat1) * Math.sin(d) * Math.cos(bearing)
    );
    const lon2 =
      lon1 +
      Math.atan2(
        Math.sin(bearing) * Math.sin(d) * Math.cos(lat1),
        Math.cos(d) - Math.sin(lat1) * Math.sin(lat2)
      );

    return {
      lat: (lat2 * 180) / Math.PI,
      lon: (lon2 * 180) / Math.PI,
    };
  };

  // Update markers on map
  useEffect(() => {
    if (!mapInstanceRef.current) return;

    Object.keys(markersRef.current).forEach((id) => {
      mapInstanceRef.current.removeLayer(markersRef.current[id]);
    });
    markersRef.current = {};

    flights.forEach((flight) => {
      if (
        flight.radial_deg !== null &&
        flight.distance_nm !== null &&
        flight.status !== 'completed'
      ) {
        const pos = getLatLonFromRadial(flight.radial_deg, flight.distance_nm);
        const colors = {
          airborne: '#27ae60',
          approach: '#f39c12',
          landing: '#e67e22',
          on_ground: '#95a5a6',
          taxi: '#3498db',
        };

        const marker = L.circleMarker([pos.lat, pos.lon], {
          radius: 6,
          fillColor: colors[flight.phase] || '#95a5a6',
          color: '#fff',
          weight: 2,
          opacity: 1,
          fillOpacity: 0.8,
        });

        marker.bindPopup(
          `<strong>${flight.flights?.registration || 'Unknown'}</strong><br/>
           Phase: ${flight.phase}<br/>
           Alt: ${flight.altitude_ft || 0} ft<br/>
           ${flight.radial_deg}° / ${flight.distance_nm} nm`
        );

        marker.addTo(mapInstanceRef.current);
        markersRef.current[flight.id] = marker;

        if (selectedFlightId === flight.id) {
          marker.openPopup();
        }
      }
    });
  }, [flights, selectedFlightId, vorData]);

  // Load flights and subscribe to changes
  useEffect(() => {
    const loadFlights = async () => {
      try {
        setLoading(true);

        const { data, error: err } = await supabase
          .from('flights')
          .select(
            `
            *,
            flights:flights(registration, type)
          `
          )
          .or(`status.eq.air,status.eq.tower`);

        if (err) throw err;

        const activeFlights = data?.filter(
          (f) => f.status === 'air' || f.status === 'tower'
        ) || [];
        const completedFlights = data?.filter((f) => f.status === 'completed') || [];

        setFlights(activeFlights);
        setOldFlights(completedFlights);
        setError('');
      } catch (err) {
        console.error('Error loading flights:', err);
        setError('Failed to load flights');
      } finally {
        setLoading(false);
      }
    };

    loadFlights();

    const subscription = supabase
      .channel('flights-changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'flights' },
        (payload) => {
          if (payload.eventType === 'UPDATE') {
            setFlights((prev) =>
              prev.map((f) =>
                f.id === payload.new.id ? { ...f, ...payload.new } : f
              )
            );
            setOldFlights((prev) =>
              prev.map((f) =>
                f.id === payload.new.id ? { ...f, ...payload.new } : f
              )
            );
          } else if (payload.eventType === 'INSERT') {
            setFlights((prev) => [...prev, payload.new]);
          }
        }
      )
      .subscribe();

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  // Load flight events when flight is selected
  useEffect(() => {
    const loadEvents = async () => {
      if (!selectedFlightId) return;

      try {
        const { data, error: err } = await supabase
          .from('flight_events')
          .select('*')
          .eq('flight_id', selectedFlightId)
          .order('created_at', { ascending: false });

        if (err) throw err;
        setEvents(data || []);
      } catch (err) {
        console.error('Error loading events:', err);
      }
    };

    loadEvents();

    const subscription = supabase
      .channel(`events-${selectedFlightId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'flight_events',
          filter: `flight_id=eq.${selectedFlightId}`,
        },
        (payload) => {
          setEvents((prev) => [payload.new, ...prev]);
        }
      )
      .subscribe();

    return () => {
      subscription.unsubscribe();
    };
  }, [selectedFlightId]);

  const getPhaseLabel = (phase) => {
    const labels = {
      on_ground: '🛬 Ground',
      taxi: '🚗 Taxi',
      airborne: '✈️ Airborne',
      approach: '📍 Approach',
      landing: '🛬 Landing',
      shutdown: '🔴 Shutdown',
    };
    return labels[phase] || phase;
  };

  const getSectorLabel = (radial) => {
    if (!radial) return '';
    const sectors = {
      'N': 5,
      'NE': 45,
      'E': 85,
      'SE': 135,
      'S': 185,
      'SW': 225,
      'W': 265,
      'NW': 315,
    };

    for (const [label, deg] of Object.entries(sectors)) {
      if (Math.abs(radial - deg) < 25) return label;
    }
    return '';
  };

  const bgColor = isDark ? '#1a1a1a' : '#f5f5f5';
  const cardBg = isDark ? '#2a2a2a' : '#ffffff';
  const textColor = isDark ? '#e0e0e0' : '#333';
  const borderColor = isDark ? '#444' : '#e0e0e0';

  const activeFlightsCount = flights.filter((f) => f.status === 'air').length;
  const totalAircraft = flights.length;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', backgroundColor: bgColor, color: textColor, overflow: 'hidden' }}>
      {/* Header */}
      <div style={{ padding: '12px 16px', borderBottom: `1px solid ${borderColor}`, flexShrink: 0 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
          <h1 style={{ margin: 0, fontSize: '18px', fontWeight: 'bold' }}>Operations</h1>
          <span style={{ fontSize: '12px', backgroundColor: '#e74c3c', color: 'white', padding: '4px 8px', borderRadius: '12px' }}>
            {activeFlightsCount}/{totalAircraft} Active
          </span>
        </div>
        <div style={{ fontSize: '12px', color: '#bdc3c7' }}>
          RWY {runwayInUse} | VOR: {vorData.lat.toFixed(4)}, {vorData.lon.toFixed(4)}
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: '4px', padding: '0 16px', borderBottom: `1px solid ${borderColor}`, flexShrink: 0 }}>
        <button
          onClick={() => setActiveTab('active')}
          style={{
            padding: '8px 16px',
            border: 'none',
            background: activeTab === 'active' ? '#27ae60' : 'transparent',
            color: activeTab === 'active' ? 'white' : textColor,
            cursor: 'pointer',
            fontSize: '13px',
            borderRadius: '4px 4px 0 0',
          }}
        >
          Active ({flights.length})
        </button>
        <button
          onClick={() => setActiveTab('completed')}
          style={{
            padding: '8px 16px',
            border: 'none',
            background: activeTab === 'completed' ? '#27ae60' : 'transparent',
            color: activeTab === 'completed' ? 'white' : textColor,
            cursor: 'pointer',
            fontSize: '13px',
            borderRadius: '4px 4px 0 0',
          }}
        >
          Completed ({oldFlights.length})
        </button>
        <button
          onClick={() => setActiveTab('map')}
          style={{
            padding: '8px 16px',
            border: 'none',
            background: activeTab === 'map' ? '#27ae60' : 'transparent',
            color: activeTab === 'map' ? 'white' : textColor,
            cursor: 'pointer',
            fontSize: '13px',
            borderRadius: '4px 4px 0 0',
          }}
        >
          Map
        </button>
      </div>

      {/* Content */}
      <div style={{ flex: 1, overflow: 'auto', display: 'flex' }}>
        {activeTab === 'map' && (
          <div
            ref={mapRef}
            style={{
              width: '100%',
              height: '100%',
              backgroundColor: '#e0e0e0',
            }}
          />
        )}

        {activeTab === 'active' && (
          <div style={{ flex: 1, overflow: 'auto', padding: '12px' }}>
            {loading ? (
              <div style={{ textAlign: 'center', padding: '20px', color: '#bdc3c7' }}>
                Loading flights...
              </div>
            ) : error ? (
              <div style={{ textAlign: 'center', padding: '20px', color: '#e74c3c' }}>
                {error}
              </div>
            ) : flights.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '20px', color: '#bdc3c7' }}>
                No active flights
              </div>
            ) : (
              <div style={{ display: 'grid', gap: '8px', gridTemplateColumns: '1fr' }}>
                {flights.map((flight) => (
                  <div
                    key={flight.id}
                    onClick={() => setSelectedFlightId(flight.id)}
                    style={{
                      padding: '12px',
                      backgroundColor: selectedFlightId === flight.id ? '#27ae60' : cardBg,
                      border: `1px solid ${borderColor}`,
                      borderRadius: '8px',
                      cursor: 'pointer',
                      color: selectedFlightId === flight.id ? 'white' : textColor,
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', marginBottom: '6px' }}>
                      <strong style={{ fontSize: '14px' }}>
                        {flight.flights?.registration || 'N/A'} — {flight.callsign || 'N/A'}
                      </strong>
                      <span style={{ fontSize: '12px', backgroundColor: 'rgba(255,255,255,0.2)', padding: '2px 6px', borderRadius: '4px' }}>
                        {getPhaseLabel(flight.phase)}
                      </span>
                    </div>
                    <div style={{ fontSize: '12px', lineHeight: '1.4' }}>
                      <div>📍 {flight.radial_deg || 0}° / {flight.distance_nm || 0} nm @ {flight.altitude_ft || 0} ft</div>
                      {flight.radial_deg && (
                        <div>🧭 Sector: {getSectorLabel(flight.radial_deg)}</div>
                      )}
                      <div>Type: {flight.type_of_flight || 'N/A'} | PIC: {flight.pic || 'N/A'}</div>
                      <div>GA: {flight.go_around_count || 0} | Land: {flight.landing_count || 0}</div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {activeTab === 'completed' && (
          <div style={{ flex: 1, overflow: 'auto', padding: '12px' }}>
            {oldFlights.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '20px', color: '#bdc3c7' }}>
                No completed flights
              </div>
            ) : (
              <div style={{ display: 'grid', gap: '8px', gridTemplateColumns: '1fr' }}>
                {oldFlights.map((flight) => (
                  <div
                    key={flight.id}
                    onClick={() => {
                      setSelectedFlightId(flight.id);
                      setActiveTab('active');
                    }}
                    style={{
                      padding: '12px',
                      backgroundColor: cardBg,
                      border: `1px solid ${borderColor}`,
                      borderRadius: '8px',
                      cursor: 'pointer',
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', marginBottom: '6px' }}>
                      <strong style={{ fontSize: '14px' }}>
                        {flight.flights?.registration || 'N/A'}
                      </strong>
                      <span style={{ fontSize: '12px', backgroundColor: 'rgba(39, 174, 96, 0.2)', padding: '2px 6px', borderRadius: '4px', color: '#27ae60' }}>
                        ✓ Completed
                      </span>
                    </div>
                    <div style={{ fontSize: '12px', color: '#bdc3c7' }}>
                      {flight.completed_at && new Date(flight.completed_at).toLocaleTimeString()}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Flight Logs Panel */}
      {selectedFlightId && (
        <div
          style={{
            padding: '12px 16px',
            borderTop: `1px solid ${borderColor}`,
            maxHeight: '25vh',
            overflow: 'auto',
            backgroundColor: cardBg,
            flexShrink: 0,
          }}
        >
          <h3 style={{ margin: '0 0 8px 0', fontSize: '13px', fontWeight: 'bold' }}>
            Flight Logs
          </h3>
          <div style={{ display: 'grid', gap: '4px' }}>
            {events.length === 0 ? (
              <div style={{ fontSize: '12px', color: '#bdc3c7' }}>No events</div>
            ) : (
              events.map((evt) => (
                <div key={evt.id} style={{ fontSize: '11px', color: '#bdc3c7', fontFamily: 'monospace' }}>
                  <strong style={{ color: textColor }}>
                    {new Date(evt.created_at).toLocaleTimeString()}
                  </strong>{' '}
                  — {evt.message}
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default OpsPageFinal;

import React, { useState, useEffect } from 'react';
import { useAircraft } from '../context/AircraftContext';
import MapView from '../shared/MapView';
import { VOR } from '../utils/aircraftSeed';

export default function Operations() {
  const { aircraft } = useAircraft();
  const isMobile = window.innerWidth < 768;
  const [lastUpdated, setLastUpdated] = useState(Date.now());
  const [isLive, setIsLive] = useState(true);

  useEffect(() => {
    setLastUpdated(Date.now());
  }, [aircraft]);

  function formatUTC_HHMM(ts) {
    if (!ts) return '—';
    const d = new Date(ts);
    return d.getUTCHours().toString().padStart(2, '0') + d.getUTCMinutes().toString().padStart(2, '0');
  }

  return (
    <div style={{ padding: 12, fontFamily: 'monospace', backgroundColor: '#1a1a1a', color: '#fff', minHeight: '100vh' }}>
      <h2 style={{ color: '#0f0', marginBottom: 16 }}>Operations Dashboard</h2>
      <div style={{ display: 'flex', flexDirection: isMobile ? 'column' : 'row', gap: 12 }}>
        <div style={{ flex: 1, overflowY: 'auto', maxHeight: isMobile ? '50vh' : '80vh' }}>
          <h3 style={{ color: '#0ff', marginBottom: 8 }}>Aircraft List ({aircraft.length})</h3>
          {aircraft.map(a => (
            <div key={a.id} style={{ backgroundColor: '#222', border: '1px solid #444', padding: 8, marginBottom: 8, borderRadius: 4, fontSize: isMobile ? 12 : 14 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                <strong style={{ color: '#fff', fontSize: isMobile ? 14 : 16 }}>{a.callsign}</strong>
                <div style={{ color: '#aaa', fontSize: isMobile ? 10 : 12 }}>{a.phase}</div>
                </div>
              <div style={{ marginBottom: 4, color: '#0ff' }}>
                {a.lastReported ? `${a.lastReported.radial}°/${a.lastReported.distanceNm}nm @${a.lastReported.altitudeFeet}ft` : `${a.radial || 0}° / ${a.distanceNm || 0} nm @ ${a.altitudeFeet || 0} ft`} — RWY {a.runway}
              </div>
              {a.takeoffTime && (
                <div style={{ marginBottom: 4, color: '#f0f' }}>
                  Airborne: {formatUTC_HHMM(a.takeoffTime)} UTC
                </div>
              )}
              {a.landingTime && (
                <div style={{ marginBottom: 4, color: '#0f0' }}>
                  Landed: {formatUTC_HHMM(a.landingTime)} UTC
                </div>
              )}
              <div style={{ marginBottom: 4, color: '#ff9900' }}>
                GA: {a.goArounds || 0} | Land: {a.landingCount || 0}
              </div>
              {a.aircraft_type && (
                <div style={{ marginBottom: 4, color: '#0f0' }}>
                  Type of Flight: {a.aircraft_type}
                </div>
              )}
              {a.pic && (
                <div style={{ marginBottom: 4, color: '#0f0' }}>
                  PIC: {typeof a.pic === 'string' ? a.pic : (a.pic.name || JSON.stringify(a.pic))}
                </div>
              )}
              {a.exerciseType && (
                <div style={{ marginBottom: 4, color: '#0f0' }}>
                  Exercise Type: {a.exerciseType}
                </div>
              )}
              {a.route && (
                <div style={{ marginBottom: 4, color: '#0f0' }}>
                  Route: {a.route}
                </div>
              )}
              <details style={{ marginTop: 4 }}>
                <summary style={{ cursor: 'pointer', color: '#aaa', fontSize: isMobile ? 10 : 12 }}>Flight Logs</summary>
                <div style={{ maxHeight: 120, overflow: 'auto', marginTop: 4 }}>
                  {(a.logs || []).map((l, idx) => (
                    <div key={idx} style={{ fontSize: isMobile ? 9 : 10, color: '#ccc', marginBottom: 2 }}>
                      {new Date(l.ts).toLocaleTimeString()} — {l.entry}
                    </div>
                  ))}
                </div>
              </details>
            </div>
          ))}
        </div>
        <div style={{ width: isMobile ? '100%' : 600, height: isMobile ? 400 : 500 }}>
          <MapView aircraft={aircraft} vor={VOR} />
        </div>
      </div>
    </div>
  );
}

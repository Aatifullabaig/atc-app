import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAircraft } from '../context/AircraftContext';
import { useAuth } from '../context/AuthContext';

export default function Tower() {
  const navigate = useNavigate();
  // eslint-disable-next-line no-unused-vars
  const { aircraft, updateAircraft, updateAircrafts, addLog, setAirborne, incrementGoAround, markTakeoff, markLanding, reportPosition, getNextSequence, incrementLanding, setTaxiHoldShort, completeFlight } = useAircraft();
  const { user } = useAuth();
  // eslint-disable-next-line no-unused-vars
  const [currentSlot, setCurrentSlot] = useState(0);
  const [showDetails, setShowDetails] = useState(null);
  const [quickReport, setQuickReport] = useState({ radial: '', distance: '', alt: '', inbound: true, approachPhase: '' });
  const [filterInbound, setFilterInbound] = useState(null);
  const [runwayInUse, setRunwayInUse] = useState(() => localStorage.getItem('runwayInUse') || '22');

  useEffect(() => {
    localStorage.setItem('runwayInUse', runwayInUse);
    const airborne = aircraft.filter(a => a.isAirborne);
    const ground = aircraft.filter(a => a.slot_status === 'pushed_to_tower' && !a.isAirborne);
    const aircraftIdsToUpdate = [...airborne, ...ground].map(a => a.id);
    if (aircraftIdsToUpdate.length > 0) {
      updateAircrafts(aircraftIdsToUpdate, { runway: runwayInUse });
    }
  }, [runwayInUse]); // Only depend on runwayInUse to avoid infinite loop
  const [utcTime, setUtcTime] = useState(new Date());

  // Debug render counts to ensure re-renders when aircraft state changes
  console.debug('Tower render', { total: aircraft.length, airborne: aircraft.filter(a => a.isAirborne).length, ground: aircraft.filter(a => a.slot_status === 'pushed_to_tower' && !a.isAirborne).length });

  function pad2(n) { return String(n).padStart(2, '0'); }
  // eslint-disable-next-line no-unused-vars
  function formatUTC_HHMM(ts) {
    if (!ts) return '—';
    const d = new Date(ts);
    return pad2(d.getUTCHours()) + pad2(d.getUTCMinutes());
  }

  useEffect(() => {
    const timer = setInterval(() => setUtcTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  // Auto-populate position when approach phase is selected
  const handleApproachPhaseChange = (phase) => {
    setQuickReport({ ...quickReport, approachPhase: phase });
    if (phase) {
      const radial = runwayInUse === '04' ? 45 : 225;
      setQuickReport(prev => ({
        ...prev,
        approachPhase: phase,
        radial: radial.toString(),
        distance: '5',
        alt: '2000',
        inbound: true
      }));
    }
  };

  function quickReportPos(aid) {
    if (!quickReport.radial || !quickReport.distance || !quickReport.alt) return alert('Fill all fields');
    reportPosition(aid, {
      radial: parseInt(quickReport.radial, 10),
      distanceNm: parseFloat(quickReport.distance),
      altitudeFeet: parseInt(quickReport.alt, 10),
      outbound: !quickReport.inbound,
      approachPhase: quickReport.approachPhase || null
    });
    setQuickReport({ radial: '', distance: '', alt: '', inbound: true, approachPhase: '' });
    setShowDetails(null);
  }

  function quickAction(aid, action, confirm = false) {
    console.log('quickAction:', { aid, action, confirm });
    if (confirm && !window.confirm(`${action}?`)) return;
    try {
      switch (action) {
        case 'started':
          updateAircraft(aid, { phase: 'started' });
          addLog(aid, `Started by ${user?.email || user?.id || 'operator'}`);
          break;
      case 'taxi':
        updateAircraft(aid, { phase: 'taxi' });
        addLog(aid, `Taxiing by ${user?.email || user?.id || 'operator'}`);
        break;
      case 'takeoff':
        console.log('quickAction: takeoff -> markTakeoff', aid);
        try {
          const ts = Date.now();
          markTakeoff(aid, ts);
        } catch (err) {
          console.error('quickAction takeoff failed', err);
        }
        break;
      case 'airborne':
        console.log('quickAction: airborne -> setAirborne', aid);
        try {
          setAirborne(aid, true, Date.now());
          addLog(aid, `Airborne by ${user?.email || user?.id || 'operator'}`);
        } catch (err) {
          console.error('quickAction airborne failed', err);
        }
        break;
      case 'landed':
        try {
          markLanding(aid, Date.now());
          incrementLanding(aid);
        } catch (err) {
          console.error('quickAction landed failed', err);
        }
        break;
      case 'go-around':
        incrementGoAround(aid);
        addLog(aid, `Go-around by ${user?.email || user?.id || 'operator'}`);
        break;
      default:
        break;
      }
    } catch (e) {
      console.error('quickAction: unexpected error', e);
    }
  }


  const airborneList = aircraft.filter(a => a.isAirborne).sort((x, y) => (y.lastReported?.ts || 0) - (x.lastReported?.ts || 0));
  const groundList = aircraft.filter(a => a.slot_status === 'pushed_to_tower' && !a.isAirborne).sort((x, y) => (x.sequenceSlot || 999) - (y.sequenceSlot || 999));

  return (
    <div style={{ display: 'flex', height: '100vh', flexDirection: 'column', backgroundColor: '#1a1a1a', color: '#fff', fontFamily: 'monospace' }}>
      {/* Header */}
      <div style={{ backgroundColor: '#0a0a0a', padding: '8px 12px', borderBottom: '2px solid #00ff00', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
        <div style={{ minWidth: 200 }}>
          <strong style={{ fontSize: 16 }}>TOWER — GDA</strong>
          <span style={{ marginLeft: 8, fontSize: 11 }}>{user?.name}</span>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: 12 }}>
          <div style={{ fontWeight: 'bold', color: '#0f0' }}>
            UTC: {utcTime.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false, timeZone: 'UTC' })}
          </div>
          <div style={{ display: 'flex', border: '2px solid #0f0', borderRadius: 4 }}>
            <button
              onClick={() => setRunwayInUse('04')}
              style={{
                padding: '4px 12px',
                backgroundColor: runwayInUse === '04' ? '#0f0' : 'transparent',
                color: runwayInUse === '04' ? '#000' : '#0f0',
                border: 'none',
                cursor: 'pointer',
                fontWeight: 'bold',
                fontSize: 12
              }}
            >
              RWY 04
            </button>
            <button
              onClick={() => setRunwayInUse('22')}
              style={{
                padding: '4px 12px',
                backgroundColor: runwayInUse === '22' ? '#0f0' : 'transparent',
                color: runwayInUse === '22' ? '#000' : '#0f0',
                border: 'none',
                cursor: 'pointer',
                fontWeight: 'bold',
                fontSize: 12
              }}
            >
              RWY 22
            </button>
          </div>
          <div style={{ fontSize: 10, color: '#0f0' }}>
            RWY {runwayInUse} IN USE
          </div>
        </div>
      </div>

      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
        {/* Main lists */}
        <div style={{ flex: 1, display: 'flex', gap: 3, padding: 3, overflowX: 'auto', minWidth: 0, scrollBehavior: 'smooth' }}>
          {/* Ground aircraft */}
          <div style={{ width: 'calc(50% - 1.5px)', minWidth: 200, display: 'flex', flexDirection: 'column', gap: 3, flex: 'none' }}>
            <div style={{ backgroundColor: '#333', padding: 4, fontSize: 11, fontWeight: 'bold', borderLeft: '3px solid #ff9900' }}>
              GND ({groundList.length})
            </div>
            <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 4 }}>
              {groundList.map(a => (
                <div
                  key={a.id}
                  onClick={() => setShowDetails(showDetails === a.id ? null : a.id)}
                  style={{
                    backgroundColor: '#222',
                    border: `1px solid #444`,
                    padding: 6,
                    cursor: 'pointer',
                    borderRadius: 2,
                    fontSize: 11,
                    lineHeight: 1.3,
                    color: '#fff'
                  }}
                >
                  <div style={{ fontWeight: 'bold' }}>{a.callsign} {a.sequenceSlot ? `[${a.sequenceSlot}]` : ''}</div>
                  <div style={{ fontSize: 10 }}>
                    {a.lastReported ? `${a.lastReported.radial}°/${a.lastReported.distanceNm}nm @${a.lastReported.altitudeFeet}ft` : `${a.radial}° / ${a.distanceNm}nm @ ${a.altitudeFeet}ft`}
                  </div>
                  <div style={{ fontSize: 10, color: '#aaa' }}>
                    {a.phase} • {a.runway}
                  </div>
                  {showDetails === a.id && (
                    <div style={{ marginTop: 6, paddingTop: 6, borderTop: '1px solid #666', fontSize: 10 }}>
                      <div style={{ marginBottom: 4, fontSize: 9, fontWeight: 'bold', color: '#f0f' }}>TAXI HOLD-SHORT:</div>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 2, marginBottom: 4 }}>
                        {['P1', 'P2', 'P3', 'P4', 'P5', 'P6'].map(p => (
                          <button key={p} onClick={(e) => { e.stopPropagation(); setTaxiHoldShort(a.id, p); }} style={{ padding: 2, backgroundColor: a.taxiHoldShort === p ? '#0f0' : '#555', color: a.taxiHoldShort === p ? '#000' : '#fff', border: 'none', fontSize: 8, cursor: 'pointer' }}>
                            {p}
                          </button>
                        ))}
                        <button onClick={(e) => { e.stopPropagation(); setTaxiHoldShort(a.id, 'apron'); }} style={{ padding: 2, backgroundColor: a.taxiHoldShort === 'apron' ? '#0f0' : '#555', color: a.taxiHoldShort === 'apron' ? '#000' : '#fff', border: 'none', fontSize: 8, cursor: 'pointer', gridColumn: '1 / -1' }}>
                          APRON
                        </button>
                      </div>
                      <div style={{ display: 'flex', gap: 4, marginBottom: 4 }}>
                        <button onClick={(e) => { e.stopPropagation(); quickAction(a.id, 'started', false); }} style={{ flex: 1, padding: 3, backgroundColor: '#0a0', color: '#000', border: 'none', fontSize: 9, cursor: 'pointer' }}>START</button>
                        <button onClick={(e) => { e.stopPropagation(); completeFlight(a.id); }} style={{ flex: 1, padding: 3, backgroundColor: '#f80', color: '#000', border: 'none', fontSize: 9, cursor: 'pointer', fontWeight: 'bold' }}>SHUTDOWN</button>
                      </div>
                      <div style={{ marginTop: 4, paddingTop: 4, borderTop: '1px solid #666', display: 'flex', gap: 4 }}>
                        <button onClick={(e) => { e.stopPropagation(); quickAction(a.id, 'takeoff', false); }} style={{ flex: 1, padding: 3, backgroundColor: '#f00', color: '#fff', border: 'none', fontSize: 9, cursor: 'pointer', fontWeight: 'bold' }}>TAKEOFF</button>
                        <button onClick={(e) => { e.stopPropagation(); quickAction(a.id, 'airborne', false); }} style={{ flex: 1, padding: 3, backgroundColor: '#0ff', color: '#000', border: 'none', fontSize: 9, cursor: 'pointer', fontWeight: 'bold' }}>AIRBORNE</button>
                      </div>
                    </div>
                  )}

                </div>
              ))}
            </div>
          </div>

          {/* Airborne aircraft */}
          <div style={{ width: 'calc(50% - 1.5px)', minWidth: 200, display: 'flex', flexDirection: 'column', gap: 3, flex: 'none' }}>
            <div style={{ backgroundColor: '#333', padding: 4, fontSize: 11, fontWeight: 'bold', borderLeft: '3px solid #0099ff', display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 4 }}>
              <span>AIR ({airborneList.length})</span>
              <div style={{ fontSize: 9, fontWeight: 'normal', display: 'flex', gap: 2 }}>
                <button onClick={() => setFilterInbound(null)} style={{ padding: 2, backgroundColor: filterInbound === null ? '#0ff' : '#666', color: '#000', border: 'none', cursor: 'pointer', fontSize: 8 }}>ALL</button>
                <button onClick={() => setFilterInbound(true)} style={{ padding: 2, backgroundColor: filterInbound === true ? '#0f0' : '#666', color: '#000', border: 'none', cursor: 'pointer', fontSize: 8 }}>INB</button>
                <button onClick={() => setFilterInbound(false)} style={{ padding: 2, backgroundColor: filterInbound === false ? '#f0f' : '#666', color: '#fff', border: 'none', cursor: 'pointer', fontSize: 8 }}>OUB</button>
              </div>
            </div>
            <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 3 }}>
              {airborneList.filter(a => filterInbound === null || (a.lastReported?.outbound === !filterInbound)).map(a => (
                <div
                  key={a.id}
                  onClick={() => setShowDetails(showDetails === a.id ? null : a.id)}
                  style={{
                    backgroundColor: '#001a33',
                    border: `1px solid #003366`,
                    padding: 6,
                    cursor: 'pointer',
                    borderRadius: 2,
                    fontSize: 11,
                    lineHeight: 1.3,
                    color: '#0ff'
                  }}
                >
                  <div style={{ fontWeight: 'bold' }}>{a.callsign} {a.lastReported?.outbound ? '[OUB]' : '[INB]'}</div>
                  <div style={{ fontSize: 10 }}>
                    Last: {a.lastReported ? `${a.lastReported.radial}°/${a.lastReported.distanceNm}nm @${a.lastReported.altitudeFeet}` : 'no report'}
                  </div>
                  <div style={{ fontSize: 10 }}>
                    GA: {a.goArounds || 0} | Land: {a.landingCount || 0} | TO: {formatUTC_HHMM(a.takeoffTime)}
                  </div>
                  {showDetails === a.id && (
                    <div style={{ marginTop: 6, paddingTop: 6, borderTop: '1px solid #003366', fontSize: 10 }}>
                      <div style={{ display: 'flex', gap: 4, marginBottom: 4, flexDirection: window.innerWidth < 768 ? 'column' : 'row' }}>
                        <input
                          type="number"
                          placeholder="Radial"
                          value={quickReport.radial}
                          onChange={e => setQuickReport({ ...quickReport, radial: e.target.value })}
                          onClick={e => e.stopPropagation()}
                          style={{ flex: window.innerWidth < 768 ? 1 : 0.5, padding: 3, fontSize: 9, backgroundColor: '#1a1a1a', color: '#0ff', border: '1px solid #003366' }}
                        />
                        <input
                          type="number"
                          placeholder="Dist(nm)"
                          value={quickReport.distance}
                          onChange={e => setQuickReport({ ...quickReport, distance: e.target.value })}
                          onClick={e => e.stopPropagation()}
                          style={{ flex: window.innerWidth < 768 ? 1 : 0.5, padding: 3, fontSize: 9, backgroundColor: '#1a1a1a', color: '#0ff', border: '1px solid #003366' }}
                        />
                        <input
                          type="number"
                          placeholder="Alt(ft)"
                          value={quickReport.alt}
                          onChange={e => setQuickReport({ ...quickReport, alt: e.target.value })}
                          onClick={e => e.stopPropagation()}
                          style={{ flex: window.innerWidth < 768 ? 1 : 0.5, padding: 3, fontSize: 9, backgroundColor: '#1a1a1a', color: '#0ff', border: '1px solid #003366' }}
                        />
                      </div>
                      <div style={{ display: 'flex', gap: 4, marginBottom: 4 }}>
                        <label style={{ fontSize: 9, color: '#0ff', display: 'flex', alignItems: 'center', gap: 2 }}>
                          <input type="checkbox" checked={quickReport.inbound} onChange={e => setQuickReport({ ...quickReport, inbound: e.target.checked })} onClick={e => e.stopPropagation()} />
                          Inbound
                        </label>
                      </div>
                      <div style={{ marginBottom: 4 }}>
                        <select
                          value={quickReport.approachPhase}
                          onChange={e => handleApproachPhaseChange(e.target.value)}
                          onClick={e => e.stopPropagation()}
                          style={{ width: '100%', padding: 3, fontSize: 9, backgroundColor: '#1a1a1a', color: '#0ff', border: '1px solid #003366' }}
                        >
                          <option value="">— Approach —</option>
                          <option value="base">Base</option>
                          <option value="downwind">Downwind</option>
                          <option value="final">Final</option>
                          <option value="upwind">Upwind</option>
                        </select>
                      </div>
                      <div style={{ display: 'flex', gap: 4 }}>
                        <button onClick={(e) => { e.stopPropagation(); quickReportPos(a.id); }} style={{ flex: 1, padding: 3, backgroundColor: '#0ff', color: '#000', border: 'none', fontSize: 9, cursor: 'pointer', fontWeight: 'bold' }}>REPORT</button>
                        <button onClick={(e) => { e.stopPropagation(); quickAction(a.id, 'go-around'); }} style={{ flex: 1, padding: 3, backgroundColor: '#ff9900', color: '#000', border: 'none', fontSize: 9, cursor: 'pointer' }}>GA</button>
                        <button onClick={(e) => { e.stopPropagation(); quickAction(a.id, 'landed', false); }} style={{ flex: 1, padding: 3, backgroundColor: '#f00', color: '#fff', border: 'none', fontSize: 9, cursor: 'pointer', fontWeight: 'bold' }}>LAND</button>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>


      </div>
    </div>
  );
}

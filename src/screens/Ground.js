import React, { useState, useEffect } from 'react';
import { useAircraft } from '../context/AircraftContext';
import { useAuth } from '../context/AuthContext';

export default function Ground() {
  const { aircraft, updateAircraft, addAircraft, pushToTower, pushOutOfTower, deleteAircraft, addLog } = useAircraft();
  const { user } = useAuth();
  const [selected, setSelected] = useState(null);
  const [filter, setFilter] = useState('all');
  const [editMode, setEditMode] = useState(false);
  const [form, setForm] = useState({});
  const [showAddModal, setShowAddModal] = useState(false);
  const [newSlot, setNewSlot] = useState({ callsign: '', aircraft_type: '', pic: '', p3: '', sequence_slot: '', flight_level: '', overfly: '', leg: '', remarks: '' });
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);
  const PRESET_CALLSIGNS = ['VTNFA','VTNFB','VTNFC','VTNFD','VTNFF','VTNFG','VTNFH','VTNFI','VTNFJ','VTNFK','VTNFL','VTNFM','VTNFN','VTNFO','VTNFP','VTNFT'];
  const AIRCRAFT_TYPES = ['CL','GF','CROSSCOUNTRY','NSXC','OTHER'];

  // Normalize selected -> form so edit inputs always get string values
  useEffect(() => {
    if (!selected) return;
    const picText = getPicText(selected.pic);
    setForm({ ...selected, pic: picText });
  }, [selected]);

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    const interval = setInterval(() => {
      const now = Date.now();
      aircraft.forEach(a => {
        if (a.slot_status === 'completed' && a.last_updated_at && (now - new Date(a.last_updated_at).getTime()) > 3600000) {
          deleteAircraft(a.id);
        }
      });
    }, 60000);
    return () => clearInterval(interval);
  }, [aircraft, deleteAircraft]);

  function saveForm() {
    if (!form?.id) return;
    updateAircraft(form.id, form);
    addLog(form.id, `Flight details updated by ${user?.id || 'operator'}`);
    setSelected({ ...form });
    setEditMode(false);
  }

  function pushSlot() {
    if (!form.sequence_slot) return alert('Assign sequence slot first');
    updateAircraft(form.id, { slot_status: 'pushed_to_tower' });
    pushToTower(form.id);
    addLog(form.id, `Pushed to Tower by ${user?.id || 'operator'}`);
    setSelected({ ...form, slot_status: 'pushed_to_tower' });
  }

  function cancelSlot() {
    if (!form?.id) return;
    updateAircraft(form.id, { slot_status: 'cancelled', profile: 'created', sequence_slot: null });
    addLog(form.id, `Slot cancelled by ${user?.id || 'operator'}`);
    setSelected({ ...form, slot_status: 'cancelled' });
  }

  const filtered = aircraft
    .filter(a => a.slot_status) // Only show aircraft created through Ground slot creation
    .filter(a => {
      if (filter === 'ready') return a.slot_status === 'created' && a.sequence_slot;
      if (filter === 'tower') return a.slot_status === 'pushed_to_tower';
      if (filter === 'completed') return a.slot_status === 'completed';
      return a.slot_status !== 'cancelled'; // Hide cancelled in 'all'
    });

  const statusColor = (status) => {
    switch (status) {
      case 'pushed_to_tower':
        return '#00ff00';
      case 'completed':
        return '#999';
      case 'cancelled':
        return '#f00';
      default:
        return '#ff9900';
    }
  };

  function getPicText(pic) {
    if (!pic) return '';
    if (typeof pic === 'string') return pic;
    if (typeof pic === 'object') {
      if (Array.isArray(pic)) return pic.join(', ');
      return pic.name || pic.title || JSON.stringify(pic);
    }
    return String(pic);
  }

  function pad2(n) { return String(n).padStart(2, '0'); }
  function formatUTC_HHMM(ts) {
    if (!ts) return '—';
    const d = new Date(ts);
    return pad2(d.getUTCHours()) + pad2(d.getUTCMinutes());
  }

  async function createNewSlot() {
    if (!newSlot.callsign || !newSlot.pic || !newSlot.aircraft_type) {
      return alert('Callsign, PIC, and Aircraft Type are required');
    }



    // Create unique ID: callsign + PIC name + timestamp
    const payload = {
      callsign: newSlot.callsign,
      pic: newSlot.pic,
      p3: newSlot.p3 || null,
      aircraft_type: newSlot.aircraft_type,
      sequence_slot: newSlot.sequence_slot ? parseInt(newSlot.sequence_slot) : null,
      flight_level: newSlot.flight_level || null,
      overfly: newSlot.overfly || null,
      leg: newSlot.leg || null,
      remarks: newSlot.remarks || null,
      phase: 'on-ground',
      runway: '22',
      sector: 'N',
      radial: 0,
      distance_nm: 0,
      altitude_feet: 0,
      distanceNm: 0,
      altitudeFeet: 0,
      lat: 21.532,
      lon: 80.293,
      is_airborne: false,
      slot_status: 'created',
      profile: 'created'
    };

    try {
      const created = await addAircraft(payload);
      addLog(created.id, `New slot created by ${user?.id || 'operator'}`);
      // Open created slot in details panel so operator can see and edit it
      setSelected(created || payload);
      setForm(created || payload);
    } catch (e) {
      console.error('createNewSlot failed', e);
      // fallback: still add to local list sync
    }

    setNewSlot({ callsign: '', aircraft_type: '', pic: '', p3: '', sequence_slot: '', flight_level: '', overfly: '', leg: '', remarks: '' });
    setShowAddModal(false);
  }

  return (
    <div style={{ display: 'flex', height: '100vh', backgroundColor: '#f5f5f5', fontFamily: 'Arial, sans-serif', flexDirection: isMobile ? 'column' : 'row' }}>
      <div style={{ flex: 1, overflowY: 'auto', borderRight: isMobile ? 'none' : '2px solid #ddd', borderBottom: isMobile ? '2px solid #ddd' : 'none' }}>
        <div style={{ backgroundColor: '#1a1a1a', color: '#0f0', padding: 12, fontSize: 13, fontWeight: 'bold', position: 'sticky', top: 0, borderBottom: '2px solid #333' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>GROUND CONTROL</div>
            <button
              onClick={() => setShowAddModal(true)}
              style={{
                padding: '6px 12px',
                fontSize: 10,
                backgroundColor: '#0f0',
                color: '#000',
                border: 'none',
                cursor: 'pointer',
                fontWeight: 'bold',
                borderRadius: 3
              }}
            >
              + ADD AIRCRAFT
            </button>
          </div>
          <div style={{ fontSize: 10, marginTop: 4, color: '#ccc' }}>{filtered.length} aircraft loaded</div>
          <div style={{ fontSize: 10, marginTop: 6, display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {['all', 'ready', 'tower', 'completed'].map(f => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                style={{
                  padding: '4px 10px',
                  fontSize: 9,
                  backgroundColor: filter === f ? '#0f0' : '#333',
                  color: filter === f ? '#000' : '#0f0',
                  border: '1px solid #0f0',
                  cursor: 'pointer',
                  fontWeight: filter === f ? 'bold' : 'normal'
                }}
              >
                {f.toUpperCase()}
              </button>
            ))}
          </div>
        </div>
        <div>
          {filtered.map(a => (
            <div
              key={a.id}
              onClick={() => { setSelected(a); setEditMode(false); }}
              style={{
                padding: 10,
                borderBottom: '1px solid #e0e0e0',
                backgroundColor: selected?.id === a.id ? '#e8f4f8' : '#fff',
                cursor: 'pointer',
                borderLeft: `4px solid ${statusColor(a.slot_status)}`,
                transition: 'background-color 0.2s'
              }}
            >
              <div style={{ fontWeight: 'bold', fontSize: 12, color: '#000' }}>{a.callsign}</div>
              <div style={{ fontSize: 10, color: '#666', marginTop: 3 }}>
                {a.aircraft_type ? `${a.aircraft_type} • ` : 'PENDING • '}
                {a.pic ? `${getPicText(a.pic).substring(0, 12)}` : 'No PIC'}
              </div>
              {a.sequence_slot && (
                <div style={{ fontSize: 9, color: '#0f0', marginTop: 2, fontWeight: 'bold' }}>SLOT #{a.sequence_slot}</div>
              )}
              <div style={{ fontSize: 9, color: '#999', marginTop: 2 }}>
                {a.flight_level || '—'} • {a.slot_status}
              </div>
              {a.slot_status === 'completed' && (
                <div style={{ fontSize: 9, color: '#666', marginTop: 6 }}>
                  Airborne: {formatUTC_HHMM(a.takeoffTime || a.estDeparture)} • Landed: {a.landingTime ? formatUTC_HHMM(a.landingTime) : '—'} • GA: {a.goArounds || 0} • Land: {a.landingCount || 0}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      <div style={{ width: 420, overflowY: 'auto', backgroundColor: '#fff', display: 'flex', flexDirection: 'column' }}>
        {selected ? (
          <>
            <div style={{ backgroundColor: '#1a1a1a', color: '#0f0', padding: 12, borderBottom: '2px solid #333' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <div style={{ fontSize: 14, fontWeight: 'bold' }}>{selected.callsign}</div>
                  <div style={{ fontSize: 10, marginTop: 2, color: '#ccc' }}>Status: {selected.slot_status}</div>
                </div>
                <button
                  onClick={() => setEditMode(!editMode)}
                  style={{
                    padding: '6px 12px',
                    backgroundColor: editMode ? '#ff4444' : '#0f0',
                    color: editMode ? '#fff' : '#000',
                    border: 'none',
                    cursor: 'pointer',
                    fontWeight: 'bold',
                    fontSize: 11
                  }}
                >
                  {editMode ? 'CANCEL' : 'EDIT'}
                </button>
              </div>
            </div>

            {!editMode ? (
              <div style={{ flex: 1, padding: 12, overflow: 'auto' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
                  <div style={{ backgroundColor: '#f5f5f5', padding: 10, borderRadius: 4, fontSize: 10 }}>
                    <div style={{ fontWeight: 'bold', color: '#333' }}>TYPE OF FLIGHT</div>
                    <div style={{ marginTop: 4, color: '#000' }}>{form.aircraft_type || 'PENDING'}</div>
                  </div>
                  <div style={{ backgroundColor: '#f5f5f5', padding: 10, borderRadius: 4, fontSize: 10 }}>
                    <div style={{ fontWeight: 'bold', color: '#333' }}>SLOT</div>
                    <div style={{ marginTop: 4, color: '#000', fontSize: 12, fontWeight: 'bold' }}>{form.sequence_slot ? `#${form.sequence_slot}` : 'UNASSIGNED'}</div>
                  </div>
                </div>

                <div style={{ marginBottom: 12, borderTop: '1px solid #ddd', paddingTop: 12 }}>
                  <div style={{ fontSize: 10, fontWeight: 'bold', color: '#333', marginBottom: 8 }}>CREW</div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                    <div style={{ fontSize: 9 }}>
                      <div style={{ color: '#666' }}>PIC</div>
                      <div style={{ fontWeight: 'bold', color: '#000', marginTop: 2 }}>{form.pic || '—'}</div>
                    </div>
                    <div style={{ fontSize: 9 }}>
                      <div style={{ color: '#666' }}>P3</div>
                      <div style={{ fontWeight: 'bold', color: '#000', marginTop: 2 }}>{form.p3 || 'N/A'}</div>
                    </div>
                  </div>
                </div>

                {(form.flight_level || form.overfly || form.leg) && (
                  <div style={{ marginBottom: 12, backgroundColor: '#f9f9f9', padding: 10, borderRadius: 4, fontSize: 9 }}>
                    <div style={{ fontWeight: 'bold', color: '#333', marginBottom: 6 }}>ROUTING</div>
                    {form.flight_level && <div style={{ marginBottom: 4 }}><span style={{ color: '#666' }}>FL:</span> <span style={{ fontWeight: 'bold' }}>{form.flight_level}</span></div>}
                    {form.overfly && <div style={{ marginBottom: 4 }}><span style={{ color: '#666' }}>OVERFLY:</span> <span style={{ fontWeight: 'bold' }}>{form.overfly}</span></div>}
                    {form.leg && <div><span style={{ color: '#666' }}>LEG:</span> <span style={{ fontWeight: 'bold' }}>{form.leg}</span></div>}
                  </div>
                )}

                <div style={{ marginBottom: 12, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                  <div style={{ fontSize: 9 }}>
                    <div style={{ color: '#666' }}>EOBT</div>
                    <div style={{ fontWeight: 'bold', color: '#000', marginTop: 2 }}>{form.eobt || 'TBD'}</div>
                  </div>
                  <div style={{ fontSize: 9 }}>
                    <div style={{ color: '#666' }}>END</div>
                    <div style={{ fontWeight: 'bold', color: '#000', marginTop: 2 }}>{form.end_time || 'TBD'}</div>
                  </div>
                </div>

                {form.remarks && (
                  <div style={{ fontSize: 9, backgroundColor: '#fff3cd', padding: 8, borderRadius: 4, marginBottom: 12 }}>
                    <div style={{ fontWeight: 'bold', color: '#856404' }}>REMARKS</div>
                    <div style={{ marginTop: 4, color: '#856404' }}>{form.remarks}</div>
                  </div>
                )}
              </div>
            ) : (
              <div style={{ flex: 1, padding: 12, overflow: 'auto' }}>
                <div style={{ marginBottom: 10 }}>
                  <label style={{ fontSize: 9, fontWeight: 'bold', color: '#333' }}>AIRCRAFT TYPE</label>
                  <input type="text" value={form.aircraft_type || ''} onChange={e => setForm({ ...form, aircraft_type: e.target.value })} style={{ width: '100%', padding: 8, fontSize: 11, border: '1px solid #ddd', boxSizing: 'border-box', marginTop: 4, borderRadius: 3 }} placeholder="e.g., GF, CL, NSXC" />
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 8, marginBottom: 10 }}>
                  <div>
                    <label style={{ fontSize: 9, fontWeight: 'bold', color: '#333' }}>SLOT #</label>
                    <input type="number" value={form.sequence_slot || ''} onChange={e => setForm({ ...form, sequence_slot: parseInt(e.target.value) || '' })} style={{ width: '100%', padding: 8, fontSize: 11, border: '1px solid #ddd', boxSizing: 'border-box', marginTop: 4, borderRadius: 3 }} />
                  </div>
                </div>

                <div style={{ marginBottom: 10 }}>
                  <label style={{ fontSize: 9, fontWeight: 'bold', color: '#333' }}>PIC</label>
                  <input type="text" value={form.pic || ''} onChange={e => setForm({ ...form, pic: e.target.value })} style={{ width: '100%', padding: 8, fontSize: 11, border: '1px solid #ddd', boxSizing: 'border-box', marginTop: 4, borderRadius: 3 }} />
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 10 }}>
                  <div>
                    <label style={{ fontSize: 9, fontWeight: 'bold', color: '#333' }}>P3</label>
                    <input type="text" value={form.p3 || ''} onChange={e => setForm({ ...form, p3: e.target.value })} style={{ width: '100%', padding: 8, fontSize: 11, border: '1px solid #ddd', boxSizing: 'border-box', marginTop: 4, borderRadius: 3 }} />
                  </div>
                  <div>
                    <label style={{ fontSize: 9, fontWeight: 'bold', color: '#333' }}>FIC</label>
                    <input type="text" value={form.fic || ''} onChange={e => setForm({ ...form, fic: e.target.value })} style={{ width: '100%', padding: 8, fontSize: 11, border: '1px solid #ddd', boxSizing: 'border-box', marginTop: 4, borderRadius: 3 }} />
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 10 }}>
                  <div>
                    <label style={{ fontSize: 9, fontWeight: 'bold', color: '#333' }}>ADC</label>
                    <input type="text" value={form.adc || ''} onChange={e => setForm({ ...form, adc: e.target.value })} style={{ width: '100%', padding: 8, fontSize: 11, border: '1px solid #ddd', boxSizing: 'border-box', marginTop: 4, borderRadius: 3 }} />
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 10 }}>
                  <div>
                    <label style={{ fontSize: 9, fontWeight: 'bold', color: '#333' }}>EOBT</label>
                    <input type="text" value={form.eobt || ''} onChange={e => setForm({ ...form, eobt: e.target.value })} style={{ width: '100%', padding: 8, fontSize: 11, border: '1px solid #ddd', boxSizing: 'border-box', marginTop: 4, borderRadius: 3 }} placeholder="0500" />
                  </div>
                  <div>
                    <label style={{ fontSize: 9, fontWeight: 'bold', color: '#333' }}>END</label>
                    <input type="text" value={form.end_time || ''} onChange={e => setForm({ ...form, end_time: e.target.value })} style={{ width: '100%', padding: 8, fontSize: 11, border: '1px solid #ddd', boxSizing: 'border-box', marginTop: 4, borderRadius: 3 }} placeholder="0630" />
                  </div>
                </div>

                <div style={{ marginBottom: 10 }}>
                  <label style={{ fontSize: 9, fontWeight: 'bold', color: '#333' }}>FLIGHT LEVEL</label>
                  <input type="text" value={form.flight_level || ''} onChange={e => setForm({ ...form, flight_level: e.target.value })} style={{ width: '100%', padding: 8, fontSize: 11, border: '1px solid #ddd', boxSizing: 'border-box', marginTop: 4, borderRadius: 3 }} placeholder="FL065/055" />
                </div>

                <div style={{ marginBottom: 10 }}>
                  <label style={{ fontSize: 9, fontWeight: 'bold', color: '#333' }}>OVERFLY</label>
                  <input type="text" value={form.overfly || ''} onChange={e => setForm({ ...form, overfly: e.target.value })} style={{ width: '100%', padding: 8, fontSize: 11, border: '1px solid #ddd', boxSizing: 'border-box', marginTop: 4, borderRadius: 3 }} placeholder="WARDHA R245/105D" />
                </div>

                <div style={{ marginBottom: 10 }}>
                  <label style={{ fontSize: 9, fontWeight: 'bold', color: '#333' }}>LEG</label>
                  <input type="text" value={form.leg || ''} onChange={e => setForm({ ...form, leg: e.target.value })} style={{ width: '100%', padding: 8, fontSize: 11, border: '1px solid #ddd', boxSizing: 'border-box', marginTop: 4, borderRadius: 3 }} placeholder="VAGD TO VANP" />
                </div>

                <div style={{ marginBottom: 12 }}>
                  <label style={{ fontSize: 9, fontWeight: 'bold', color: '#333' }}>REMARKS</label>
                  <textarea value={form.remarks || ''} onChange={e => setForm({ ...form, remarks: e.target.value })} style={{ width: '100%', padding: 8, fontSize: 11, border: '1px solid #ddd', boxSizing: 'border-box', marginTop: 4, borderRadius: 3, minHeight: 60 }} />
                </div>
              </div>
            )}

            <div style={{ backgroundColor: '#f5f5f5', padding: 12, borderTop: '2px solid #ddd', display: 'flex', gap: 8 }}>
              {!editMode ? (
                <>
                  {selected.slot_status === 'created' && (
                    <>
                      <button
                        onClick={pushSlot}
                        style={{
                          flex: 1,
                          padding: 10,
                          backgroundColor: '#0f0',
                          color: '#000',
                          border: 'none',
                          cursor: 'pointer',
                          fontWeight: 'bold',
                          fontSize: 11,
                          borderRadius: 3
                        }}
                      >
                        PUSH TO TOWER
                      </button>
                      <button
                        onClick={cancelSlot}
                        style={{
                          flex: 1,
                          padding: 10,
                          backgroundColor: '#f00',
                          color: '#fff',
                          border: 'none',
                          cursor: 'pointer',
                          fontWeight: 'bold',
                          fontSize: 11,
                          borderRadius: 3
                        }}
                      >
                        CANCEL
                      </button>
                    </>
                  )}
                  {selected.slot_status === 'pushed_to_tower' && (
                    <button
                      onClick={() => { pushOutOfTower(selected.id); setSelected(null); }}
                      style={{
                        flex: 1,
                        padding: 10,
                        backgroundColor: '#ff9900',
                        color: '#000',
                        border: 'none',
                        cursor: 'pointer',
                        fontWeight: 'bold',
                        fontSize: 11,
                        borderRadius: 3
                      }}
                    >
                      PULL BACK
                    </button>
                  )}
                </>
              ) : (
                <button
                  onClick={saveForm}
                  style={{
                    flex: 1,
                    padding: 10,
                    backgroundColor: '#0f0',
                    color: '#000',
                    border: 'none',
                    cursor: 'pointer',
                    fontWeight: 'bold',
                    fontSize: 11,
                    borderRadius: 3
                  }}
                >
                  SAVE DETAILS
                </button>
              )}
            </div>
          </>
        ) : (
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#999', fontSize: 12 }}>
            Select an aircraft to view details
          </div>
        )}
      </div>

      {/* Add Aircraft Modal */}
      {showAddModal && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.7)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000
        }}>
          <div style={{
            backgroundColor: '#fff',
            borderRadius: 8,
            boxShadow: '0 4px 20px rgba(0, 0, 0, 0.3)',
            maxWidth: 500,
            width: '90%',
            maxHeight: '90vh',
            overflowY: 'auto',
            padding: 20
          }}>
            <h2 style={{ margin: '0 0 16px 0', color: '#333' }}>CREATE NEW FLIGHT SLOT</h2>

            {/* Required Fields */}
            <div style={{ marginBottom: 12 }}>
              <label style={{ fontSize: 11, fontWeight: 'bold', color: '#333' }}>AIRCRAFT CALLSIGN * </label>
              <select value={newSlot.callsign || ''} onChange={e => {
                const val = e.target.value;
                setNewSlot({ ...newSlot, callsign: val });
              }} style={{ width: '100%', padding: 8, fontSize: 11, border: '1px solid #ddd', boxSizing: 'border-box', marginTop: 4, borderRadius: 3 }}>
                <option value="">-- Pick or type --</option>
                {PRESET_CALLSIGNS.map(c => (<option key={c} value={c}>{c}</option>))}
              </select>
            </div>

           

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
              <div>
                <label style={{ fontSize: 11, fontWeight: 'bold', color: '#333' }}>AIRCRAFT TYPE *</label>
                <select value={newSlot.aircraft_type || ''} onChange={e => setNewSlot({ ...newSlot, aircraft_type: e.target.value })} style={{ width: '100%', padding: 8, fontSize: 11, border: '1px solid #ddd', boxSizing: 'border-box', marginTop: 4, borderRadius: 3 }}>
                  <option value="">-- Select type --</option>
                  {AIRCRAFT_TYPES.map(t => (<option key={t} value={t}>{t}</option>))}
                </select>
              </div>
              <div>
                <label style={{ fontSize: 11, fontWeight: 'bold', color: '#333' }}>PIC (PILOT IN COMMAND) *</label>
                <input type="text" placeholder="e.g., PRANAV" value={newSlot.pic} onChange={e => setNewSlot({ ...newSlot, pic: e.target.value })} style={{ width: '100%', padding: 8, fontSize: 11, border: '1px solid #ddd', boxSizing: 'border-box', marginTop: 4, borderRadius: 3 }} />
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 12, marginBottom: 12 }}>
              <div>
                <label style={{ fontSize: 11, fontWeight: 'bold', color: '#333' }}>SLOT #</label>
                <input type="number" placeholder="1, 2, 3..." value={newSlot.sequence_slot} onChange={e => setNewSlot({ ...newSlot, sequence_slot: e.target.value })} style={{ width: '100%', padding: 8, fontSize: 11, border: '1px solid #ddd', boxSizing: 'border-box', marginTop: 4, borderRadius: 3 }} />
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
              <div>
                <label style={{ fontSize: 11, fontWeight: 'bold', color: '#333' }}>P3 (OBSERVER)</label>
                <input type="text" value={newSlot.p3} onChange={e => setNewSlot({ ...newSlot, p3: e.target.value })} style={{ width: '100%', padding: 8, fontSize: 11, border: '1px solid #ddd', boxSizing: 'border-box', marginTop: 4, borderRadius: 3 }} />
              </div>
            </div>

            {/* Advanced Fields (for Cross-Country) */}
            <div style={{ marginBottom: 12, padding: 12, backgroundColor: '#f9f9f9', borderRadius: 4 }}>
              <div style={{ fontSize: 11, fontWeight: 'bold', color: '#333', marginBottom: 8 }}>FOR CROSS-COUNTRY (Optional)</div>

              <div style={{ marginBottom: 10 }}>
                <label style={{ fontSize: 10, fontWeight: 'bold', color: '#666' }}>FLIGHT LEVEL</label>
                <input type="text" placeholder="e.g., FL065/055" value={newSlot.flight_level} onChange={e => setNewSlot({ ...newSlot, flight_level: e.target.value })} style={{ width: '100%', padding: 8, fontSize: 11, border: '1px solid #ddd', boxSizing: 'border-box', marginTop: 4, borderRadius: 3 }} />
              </div>

              <div style={{ marginBottom: 10 }}>
                <label style={{ fontSize: 10, fontWeight: 'bold', color: '#666' }}>OVERFLY</label>
                <input type="text" placeholder="e.g., WARDHA R245/105D" value={newSlot.overfly} onChange={e => setNewSlot({ ...newSlot, overfly: e.target.value })} style={{ width: '100%', padding: 8, fontSize: 11, border: '1px solid #ddd', boxSizing: 'border-box', marginTop: 4, borderRadius: 3 }} />
              </div>

              <div style={{ marginBottom: 10 }}>
                <label style={{ fontSize: 10, fontWeight: 'bold', color: '#666' }}>LEG</label>
                <input type="text" placeholder="e.g., VAGD TO VANP" value={newSlot.leg} onChange={e => setNewSlot({ ...newSlot, leg: e.target.value })} style={{ width: '100%', padding: 8, fontSize: 11, border: '1px solid #ddd', boxSizing: 'border-box', marginTop: 4, borderRadius: 3 }} />
              </div>
            </div>

            <div style={{ marginBottom: 16 }}>
              <label style={{ fontSize: 11, fontWeight: 'bold', color: '#333' }}>REMARKS</label>
              <textarea value={newSlot.remarks} onChange={e => setNewSlot({ ...newSlot, remarks: e.target.value })} style={{ width: '100%', padding: 8, fontSize: 11, border: '1px solid #ddd', boxSizing: 'border-box', marginTop: 4, borderRadius: 3, minHeight: 60 }} />
            </div>

              <div style={{ display: 'flex', gap: 8 }}>
                <button
                  onClick={createNewSlot}
                  style={{
                    flex: 1,
                    padding: 12,
                    backgroundColor: '#0f0',
                    color: '#000',
                    border: 'none',
                    cursor: 'pointer',
                    fontWeight: 'bold',
                    fontSize: 12,
                    borderRadius: 3
                  }}
                >
                  CREATE SLOT
                </button>
                <button
                  onClick={() => { setShowAddModal(false); setNewSlot({ callsign: '', aircraft_type: '', pic: '', p3: '', sequence_slot: '', flight_level: '', overfly: '', leg: '', remarks: '' }); }}
                  style={{
                    flex: 1,
                    padding: 12,
                    backgroundColor: '#ddd',
                    color: '#333',
                    border: 'none',
                    cursor: 'pointer',
                    fontWeight: 'bold',
                    fontSize: 12,
                    borderRadius: 3
                  }}
                >
                  CANCEL
                </button>
              </div>
          </div>
        </div>
      )}
    </div>
  );
}

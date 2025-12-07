import React, { useState, useEffect, useContext } from 'react';
import supabase from '../lib/supabaseClient';
import { ThemeContext } from '../context/ThemeContext';
import { useAuth } from '../context/AuthContext';
import {
  getDraftFlights,
  getReadyFlights,
  getCompletedFlights,
  createDraftFlight,
  markFlightReady,
  pushToTower,
  getAircraft,
  getPilotsByRole,
  getFlightEvents,
} from '../lib/flightService';
import { formatFlightLogs, getCurrentUTCTime, getStatusColor } from '../utils/flightUtils';
import '../shared/GroundPageNew.css';

const FLIGHT_TYPES = [
  'CL ',
  'GF',
  'CrossCountry',
  'IF',
  'Emergency',
  'Other'
];

const GroundPage = () => {
  const { isDark, toggleTheme } = useContext(ThemeContext);
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState('create');
  const [aircraft, setAircraft] = useState([]);
  const [instructors, setInstructors] = useState([]);
  const [draftFlights, setDraftFlights] = useState([]);
  const [readyFlights, setReadyFlights] = useState([]);
  const [completedFlights, setCompletedFlights] = useState([]);
  const [utcTime, setUtcTime] = useState(getCurrentUTCTime());
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [selectedCompletedFlight, setSelectedCompletedFlight] = useState(null);
  const [completedFlightLogs, setCompletedFlightLogs] = useState([]);
  const [refreshing, setRefreshing] = useState(false);

  // Form state
  const [form, setForm] = useState({
    aircraftId: '',
    studentName: '',
    instructorId: '',
    typeOfFlight: '',
    groundIncharge: '',
    groundInchargeId: null,
    slotOrder: '',
  });

  // Update UTC clock every second
  useEffect(() => {
    const interval = setInterval(() => {
      setUtcTime(getCurrentUTCTime());
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  // Load initial data and auto-fill student
  useEffect(() => {
    loadInitialData();
    setupRealtimeSubscription();
    autoFillStudent();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  const loadInitialData = async () => {
    try {
      setLoading(true);
      const [aircraftData, cadetsData, instructorsData] = await Promise.all([
        getAircraft(),
        getPilotsByRole('cadet'),
        getPilotsByRole('instructor'),
      ]);

      setAircraft(aircraftData || []);
      setCadets(cadetsData || []);
      setInstructors(instructorsData || []);

      await loadFlights();
    } catch (err) {
      console.error('Error loading data:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // Auto-fill ground incharge from login user
  const autoFillStudent = async () => {
    if (!user?.email || !user?.id) {
      console.log('No user email or ID available for autofill');
      return;
    }
    try {
      // Try to find pilot by user_id first, then by email
      const { data, error } = await supabase
        .from('pilots')
        .select('id, name, user_id, email')
        .or(`user_id.eq.${user.id},email.eq.${user.email}`)
        .single();

      if (error) {
        console.log('No pilot found for autofill:', error.message);
        return;
      }

      if (data && data.name) {
        console.log('Autofilled ground incharge:', data.name);
        setForm(prev => ({ 
          ...prev, 
          groundIncharge: data.name,
          groundInchargeId: data.id
        }));
      }
    } catch (err) {
      console.log('Auto-fill exception:', err.message);
    }
  };

  // Refresh only database (not entire page)
  const handleRefreshData = async () => {
    try {
      setRefreshing(true);
      setError(null);
      console.log('Refreshing flight data...');
      await loadFlights();
      console.log('Refresh completed');
    } catch (err) {
      setError('Failed to refresh data: ' + err.message);
      console.error('Refresh error:', err);
    } finally {
      setRefreshing(false);
    }
  };

  const loadFlights = async () => {
    try {
      const [drafts, ready, completed] = await Promise.all([
        getDraftFlights(),
        getReadyFlights(),
        getCompletedFlights(),
      ]);

      setDraftFlights(drafts || []);
      setReadyFlights(ready || []);
      setCompletedFlights(completed || []);
    } catch (err) {
      console.error('Error loading flights:', err);
    }
  };

  const setupRealtimeSubscription = () => {
    const subscription = supabase
      .channel('flights-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'flights' }, () => {
        loadFlights();
      })
      .subscribe();

    return () => {
      subscription.unsubscribe();
    };
  };

  const handleFormChange = (e) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleSaveDraft = async (e) => {
    e.preventDefault();
    try {
      setLoading(true);
      setError(null);

      if (!form.aircraftId || !form.groundIncharge) {
        throw new Error('Aircraft and Ground Incharge are required');
      }

      await createDraftFlight({
        aircraftId: form.aircraftId,
        studentName: form.studentName,
        instructorId: form.instructorId || null,
        typeOfFlight: form.typeOfFlight,
        groundInchargeId: form.groundInchargeId,
        slotOrder: form.slotOrder ? parseInt(form.slotOrder) : null,
      });

      // Reset form but keep ground incharge
      const groundIncharge = form.groundIncharge;
      const groundInchargeId = form.groundInchargeId;
      setForm({
        aircraftId: '',
        studentName: '',
        instructorId: '',
        typeOfFlight: '',
        groundIncharge: groundIncharge,
        groundInchargeId: groundInchargeId,
        slotOrder: '',
      });

      await loadFlights();
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleMarkReady = async (flightId) => {
    try {
      setLoading(true);
      setError(null);
      await markFlightReady(flightId);
      await loadFlights();
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleCancelDraft = async (flightId) => {
    if (!window.confirm('Are you sure you want to delete this draft?')) {
      return;
    }
    try {
      setLoading(true);
      setError(null);
      const { error } = await supabase
        .from('flights')
        .delete()
        .eq('id', flightId);
      
      if (error) throw error;
      await loadFlights();
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handlePushToTower = async (flightId) => {
    try {
      setLoading(true);
      setError(null);
      await pushToTower(flightId);
      await loadFlights();
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleViewCompletedFlight = async (flight) => {
    try {
      const logs = await getFlightEvents(flight.id);
      setCompletedFlightLogs(formatFlightLogs(logs));
      setSelectedCompletedFlight(flight);
    } catch (err) {
      console.error('Error loading flight logs:', err);
    }
  };

  const handleCloseFlightLogs = () => {
    setSelectedCompletedFlight(null);
    setCompletedFlightLogs([]);
  };

  return (
    <div className={`ground-page ${isDark ? 'dark' : 'light'}`}>
      {/* Header */}
      <header className="page-header">
        <div className="header-content">
          <h1>✈ Ground Operations</h1>
          <div className="header-right">
            <div className="utc-clock">{utcTime} UTC</div>
            <button 
              className="btn btn-refresh" 
              onClick={handleRefreshData}
              disabled={refreshing}
              title="Refresh database only"
            >
              {refreshing ? '⟳ Refreshing...' : '🔄 Refresh'}
            </button>
            <button className="theme-toggle" onClick={toggleTheme}>
              {isDark ? '☀️' : '🌙'}
            </button>
          </div>
        </div>
      </header>

      {/* Error message */}
      {error && <div className="error-banner">{error}</div>}

      {/* Tabs */}
      <div className="tabs">
        <button
          className={`tab ${activeTab === 'create' ? 'active' : ''}`}
          onClick={() => setActiveTab('create')}
        >
          ✏ Create Slot
        </button>
        <button
          className={`tab ${activeTab === 'ready' ? 'active' : ''}`}
          onClick={() => setActiveTab('ready')}
        >
          ✓ Ready ({readyFlights.length})
        </button>
        <button
          className={`tab ${activeTab === 'completed' ? 'active' : ''}`}
          onClick={() => setActiveTab('completed')}
        >
          ✅ Completed ({completedFlights.length})
        </button>
      </div>

      {/* Tab Content */}
      <div className="tab-content">
        {/* Create Slot Tab */}
        {activeTab === 'create' && (
          <div className="section">
            <form onSubmit={handleSaveDraft} className="flight-form">
              <div className="form-grid">
                <div className="form-group">
                  <label htmlFor="aircraftId">Aircraft</label>
                  <select
                    id="aircraftId"
                    name="aircraftId"
                    value={form.aircraftId}
                    onChange={handleFormChange}
                    required
                  >
                    <option value="">Select Aircraft</option>
                    {aircraft.map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.registration}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="form-group">
                  <label htmlFor="studentName">Student Name</label>
                  <textarea
                    id="studentName"
                    name="studentName"
                    value={form.studentName}
                    onChange={handleFormChange}
                    placeholder="Enter student name"
                    rows="2"
                  />
                </div>

                <div className="form-group">
                  <label htmlFor="instructorId">Instructor (optional)</label>
                  <select
                    id="instructorId"
                    name="instructorId"
                    value={form.instructorId}
                    onChange={handleFormChange}
                  >
                    <option value="">None</option>
                    {instructors.map((i) => (
                      <option key={i.id} value={i.id}>
                        {i.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="form-group">
                  <label htmlFor="typeOfFlight">Type of Flight</label>
                  <select
                    id="typeOfFlight"
                    name="typeOfFlight"
                    value={form.typeOfFlight}
                    onChange={handleFormChange}
                    required
                  >
                    <option value="">Select Type</option>
                    {FLIGHT_TYPES.map((type) => (
                      <option key={type} value={type}>
                        {type}
                      </option>
                    ))}
                    <option value="custom">📝 Add Custom...</option>
                  </select>
                </div>

                {form.typeOfFlight === 'custom' && (
                  <div className="form-group">
                    <label htmlFor="customFlightType">Custom Flight Type</label>
                    <input
                      id="customFlightType"
                      type="text"
                      placeholder="Enter flight type"
                      value={form.typeOfFlight === 'custom' ? '' : form.typeOfFlight}
                      onChange={(e) => setForm(prev => ({ ...prev, typeOfFlight: e.target.value }))}
                      required
                    />
                  </div>
                )}

                <div className="form-group">
                  <label htmlFor="groundIncharge">Ground Incharge</label>
                  <input
                    id="groundIncharge"
                    name="groundIncharge"
                    type="text"
                    placeholder="Auto-filled from login"
                    value={form.groundIncharge}
                    onChange={handleFormChange}
                    readOnly
                  />
                </div>

                <div className="form-group">
                  <label htmlFor="slotOrder">Slot Order (optional)</label>
                  <input
                    id="slotOrder"
                    name="slotOrder"
                    type="number"
                    placeholder="1, 2, 3..."
                    value={form.slotOrder}
                    onChange={handleFormChange}
                  />
                </div>
              </div>

              <div className="button-group">
                <button type="submit" className="btn btn-primary" disabled={loading}>
                  {loading ? 'Saving...' : '💾 Save as Draft'}
                </button>
              </div>
            </form>

            {/* Draft Flights List */}
            {draftFlights.length > 0 && (
              <div className="section">
                <h3>📋 Draft Slots ({draftFlights.length})</h3>
                <div className="flight-list">
                  {draftFlights.map((flight) => (
                    <div key={flight.id} className="flight-card draft">
                      <div className="flight-card-header">
                        <span className="flight-registration">
                          {flight.aircraft?.registration}
                        </span>
                        <span className={`status-badge ${getStatusColor(flight.status)}`}>
                          {flight.status}
                        </span>
                      </div>
                      <div className="flight-card-details">
                        <p><strong>Student:</strong> {flight.student?.name}</p>
                        <p><strong>Type:</strong> {flight.type_of_flight}</p>
                        <p><strong>PIC:</strong> {flight.pic}</p>
                      </div>
                      <div className="button-group">
                        <button
                          className="btn btn-secondary"
                          onClick={() => handleMarkReady(flight.id)}
                          disabled={loading}
                        >
                          ✓ Mark Ready
                        </button>
                        <button
                          className="btn btn-danger"
                          onClick={() => handleCancelDraft(flight.id)}
                          disabled={loading}
                        >
                          ✕ Cancel
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Ready Slots Tab */}
        {activeTab === 'ready' && (
          <div className="section">
            {readyFlights.length === 0 ? (
              <p className="empty-state">📭 No ready slots yet</p>
            ) : (
              <div className="flight-list">
                {readyFlights.map((flight) => (
                  <div key={flight.id} className="flight-card ready">
                    <div className="flight-card-header">
                      <span className="flight-registration">
                        {flight.aircraft?.registration}
                      </span>
                      <span className={`status-badge ${getStatusColor(flight.status)}`}>
                        {flight.status}
                      </span>
                    </div>
                    <div className="flight-card-details">
                      <p><strong>Student:</strong> {flight.student?.name}</p>
                      <p><strong>Type:</strong> {flight.type_of_flight}</p>
                      <p><strong>PIC:</strong> {flight.pic}</p>
                      <p><strong>Created:</strong> {new Date(flight.created_at).toLocaleTimeString()}</p>
                    </div>
                    <button
                      className="btn btn-success"
                      onClick={() => handlePushToTower(flight.id)}
                      disabled={loading}
                    >
                      🚁 Push to Tower
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Completed Flights Tab */}
        {activeTab === 'completed' && (
          <div className="section">
            {completedFlights.length === 0 ? (
              <p className="empty-state">📭 No completed flights yet</p>
            ) : (
              <div className="flight-list">
                {completedFlights.map((flight) => (
                  <div key={flight.id} className="flight-card completed">
                    <div className="flight-card-header">
                      <span className="flight-registration">
                        {flight.aircraft?.registration}
                      </span>
                      <span className={`status-badge ${getStatusColor(flight.status)}`}>
                        {flight.status}
                      </span>
                    </div>
                    <div className="flight-card-details">
                      <p><strong>Student:</strong> {flight.student?.name}</p>
                      <p><strong>Landings:</strong> {flight.landing_count}</p>
                      <p><strong>Go-arounds:</strong> {flight.go_around_count}</p>
                      <p><strong>Completed:</strong> {new Date(flight.completed_at).toLocaleTimeString()}</p>
                    </div>
                    <button
                      className="btn btn-info"
                      onClick={() => handleViewCompletedFlight(flight)}
                    >
                      📖 View Logs
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Flight Logs Modal */}
      {selectedCompletedFlight && (
        <div className="modal-overlay" onClick={handleCloseFlightLogs}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>📖 Flight Logs - {selectedCompletedFlight.aircraft?.registration}</h2>
              <button className="close-btn" onClick={handleCloseFlightLogs}>×</button>
            </div>
            <div className="modal-body">
              <div className="flight-logs">
                {completedFlightLogs.length === 0 ? (
                  <p>No events recorded</p>
                ) : (
                  <ul>
                    {completedFlightLogs.map((log, idx) => (
                      <li key={idx}>{log}</li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Footer */}
      <footer className="page-footer">
        <div className="footer-content">
          <p>🛩 ATC Tracker - Developed by M M Aatiful Baig</p>
          <p>Dedicated to NFTI • Flight Operations Management System</p>
        </div>
      </footer>
    </div>
  );
};

export default GroundPage;

import React, { useState, useEffect, useContext } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { ThemeContext } from '../context/ThemeContext';
import supabase from '../lib/supabaseClient';
import '../shared/AdminDashboard.css';

const AdminDashboard = () => {
  const navigate = useNavigate();
  const { userRole } = useAuth();
  const { isDark } = useContext(ThemeContext);
  const [pendingUsers, setPendingUsers] = useState([]);
  const [approvedUsers, setApprovedUsers] = useState([]);
  const [activeTab, setActiveTab] = useState('pending');
  const [loading, setLoading] = useState(false);
  const [selectedRole, setSelectedRole] = useState('ground');
  const [instructors, setInstructors] = useState([]);
  const [cadets, setCadets] = useState([]);
  const [aircraft, setAircraft] = useState([]);
  const [vorConfig] = useState({ lat: 21.5268, lon: 80.2903, name: 'GDA VOR', frequency: '114.2' });
  const [newInstructor, setNewInstructor] = useState('');
  const [newCadet, setNewCadet] = useState('');
  const [newAircraft, setNewAircraft] = useState('');
  const [resetUserEmail, setResetUserEmail] = useState('');

  // Check admin accessi have a tavble 
  useEffect(() => {
    if (userRole !== 'admin') {
      navigate('/');
    }
  }, [userRole, navigate]);

  // Load all data
  useEffect(() => {
    loadUsers();
    loadPilots();
    loadAircraft();
    const interval = setInterval(() => {
      loadUsers();
      loadPilots();
    }, 5000);
    return () => clearInterval(interval);
  }, []);

  const loadUsers = async () => {
    try {
      // Load pending users
      const { data: pending } = await supabase
        .from('pilots')
        .select('*')
        .eq('is_approved', false)
        .order('created_at', { ascending: false });

      // Load approved users
      const { data: approved } = await supabase
        .from('pilots')
        .select('*')
        .eq('is_approved', true)
        .order('created_at', { ascending: false });

      setPendingUsers(pending || []);
      setApprovedUsers(approved || []);
    } catch (err) {
      console.error('Error loading users:', err);
    }
  };

  const loadPilots = async () => {
    try {
      const { data: instData } = await supabase
        .from('pilots')
        .select('*')
        .eq('role', 'instructor');

      const { data: cadetData } = await supabase
        .from('pilots')
        .select('*')
        .eq('role', 'cadet');

      setInstructors(instData || []);
      setCadets(cadetData || []);
    } catch (err) {
      console.error('Error loading pilots:', err);
    }
  };

  const loadAircraft = async () => {
    try {
      const { data } = await supabase
        .from('aircraft')
        .select('*');

      setAircraft(data || []);
    } catch (err) {
      console.error('Error loading aircraft:', err);
    }
  };

  const handleApprove = async (userRecord, role) => {
    setLoading(true);
    try {
      const { error } = await supabase
        .from('pilots')
        .update({
          role: role,
          is_approved: true,
          updated_at: new Date().toISOString(),
        })
        .eq('user_id', userRecord.user_id);

      if (error) throw error;

      setSelectedRole('ground');
      await loadUsers();
      alert(`✅ ${userRecord.email} approved as ${role}`);
    } catch (err) {
      alert(`❌ Error: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleReject = async (userRecord) => {
    const reason = window.prompt('Enter rejection reason:');
    if (!reason) return;

    setLoading(true);
    try {
      await supabase
        .from('admin_approvals')
        .insert({
          user_id: userRecord.user_id,
          email: userRecord.email,
          requested_role: userRecord.role,
          rejected_at: new Date().toISOString(),
          rejection_reason: reason,
        });

      await supabase
        .from('pilots')
        .delete()
        .eq('user_id', userRecord.user_id);

      await loadUsers();
      alert(`✅ ${userRecord.email} rejected`);
    } catch (err) {
      alert(`❌ Error: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleChangeRole = async (userRecord, newRole) => {
    setLoading(true);
    try {
      const { error } = await supabase
        .from('pilots')
        .update({
          role: newRole,
          updated_at: new Date().toISOString(),
        })
        .eq('user_id', userRecord.user_id);

      if (error) throw error;

      await loadUsers();
      alert(`✅ Role updated to ${newRole}`);
    } catch (err) {
      alert(`❌ Error: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };



  const handleAddInstructor = async () => {
    if (!newInstructor.trim()) return;
    try {
      setLoading(true);
      const { error } = await supabase
        .from('pilots')
        .insert({
          name: newInstructor,
          role: 'instructor',
          is_approved: true,
          is_active: true
        });

      if (error) throw error;
      setNewInstructor('');
      await loadPilots();
      alert('✅ Instructor added successfully');
    } catch (err) {
      alert(`❌ Error: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleAddCadet = async () => {
    if (!newCadet.trim()) return;
    try {
      setLoading(true);
      const { error } = await supabase
        .from('pilots')
        .insert({
          name: newCadet,
          role: 'cadet',
          is_approved: true,
          is_active: true
        });

      if (error) throw error;
      setNewCadet('');
      await loadPilots();
      alert('✅ Cadet added successfully');
    } catch (err) {
      alert(`❌ Error: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleAddAircraft = async () => {
    if (!newAircraft.trim()) return;
    try {
      setLoading(true);
      const { error } = await supabase
        .from('aircraft')
        .insert({
          code: newAircraft,
          type: 'Training Aircraft',
          status: 'grounded'
        });

      if (error) throw error;
      setNewAircraft('');
      await loadAircraft();
      alert('✅ Aircraft added successfully');
    } catch (err) {
      alert(`❌ Error: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleResetPassword = async () => {
    if (!resetUserEmail.trim()) {
      alert('Please enter an email');
      return;
    }

    try {
      setLoading(true);
      const { error } = await supabase.auth.resetPasswordForEmail(resetUserEmail, {
        redirectTo: `${window.location.origin}/reset-password`,
      });

      if (error) throw error;
      alert(`✅ Password reset email sent to ${resetUserEmail}`);
      setResetUserEmail('');
    } catch (err) {
      alert(`❌ Error: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  // eslint-disable-next-line no-unused-vars
  const handleUpdateVorConfig = async () => {
    if (!vorConfig.name.trim() || !vorConfig.frequency.trim()) {
      alert('Please fill in all required fields');
      return;
    }

    try {
      setLoading(true);
      const { error } = await supabase
        .from('vor_config')
        .upsert({
          id: 1, // Always use ID 1 for the main VOR config
          name: vorConfig.name,
          latitude: vorConfig.lat,
          longitude: vorConfig.lon,
          frequency: vorConfig.frequency,
          updated_at: new Date().toISOString(),
        });

      if (error) throw error;
      alert('✅ VOR configuration updated successfully');
    } catch (err) {
      alert(`❌ Error: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={`admin-dashboard ${isDark ? 'dark' : 'light'}`}>
      {/* Main Content - Navbar handles header */}
      <main className="admin-main">
        <div className="admin-container">
          {/* Title */}
          <h1 style={{ paddingTop: '20px', marginBottom: '20px' }}>🔐 Admin Dashboard</h1>
          {/* Tabs */}
          <div className="admin-tabs">
            <button
              className={`tab-btn ${activeTab === 'pending' ? 'active' : ''}`}
              onClick={() => setActiveTab('pending')}
            >
              ⏳ Pending ({pendingUsers.length})
            </button>
            <button
              className={`tab-btn ${activeTab === 'approved' ? 'active' : ''}`}
              onClick={() => setActiveTab('approved')}
            >
              ✅ Approved ({approvedUsers.length})
            </button>
            <button
              className={`tab-btn ${activeTab === 'instructors' ? 'active' : ''}`}
              onClick={() => setActiveTab('instructors')}
            >
              👨‍✈️ Instructors ({instructors.length})
            </button>
            <button
              className={`tab-btn ${activeTab === 'cadets' ? 'active' : ''}`}
              onClick={() => setActiveTab('cadets')}
            >
              🎓 Cadets ({cadets.length})
            </button>
            <button
              className={`tab-btn ${activeTab === 'aircraft' ? 'active' : ''}`}
              onClick={() => setActiveTab('aircraft')}
            >
              ✈️ Aircraft ({aircraft.length})
            </button>
            <button
              className={`tab-btn ${activeTab === 'reset' ? 'active' : ''}`}
              onClick={() => setActiveTab('reset')}
            >
              🔑 Reset Password
            </button>
          </div>

          {/* Content */}
          <div className="admin-content">
            {activeTab === 'pending' && (
              <div className="tab-content">
                <h2>Pending User Approvals</h2>
                {pendingUsers.length === 0 ? (
                  <div className="empty-state">
                    <p>✨ No pending approvals</p>
                  </div>
                ) : (
                  <div className="users-grid">
                    {pendingUsers.map(userRecord => (
                      <div key={userRecord.user_id} className="user-card pending">
                        <div className="card-header">
                          <span className="user-email">{userRecord.email}</span>
                          <span className="status-badge pending-badge">Pending</span>
                        </div>

                        <div className="card-details">
                          <div className="detail-item">
                            <span className="label">Requested Role:</span>
                            <span className="value">{userRecord.role}</span>
                          </div>
                          <div className="detail-item">
                            <span className="label">Created:</span>
                            <span className="value">
                              {new Date(userRecord.created_at).toLocaleString()}
                            </span>
                          </div>
                        </div>

                        <div className="card-actions">
                          <div className="role-selector">
                            <select
                              value={selectedRole}
                              onChange={e => setSelectedRole(e.target.value)}
                              className="role-select"
                            >
                              <option value="ground">Ground</option>
                              <option value="tower">Tower</option>
                              <option value="ground_tower">Ground & Tower</option>
                              <option value="pilot">Pilot</option>
                            </select>
                          </div>
                          <div className="action-buttons">
                            <button
                              className="btn approve-btn"
                              onClick={() => handleApprove(userRecord, selectedRole)}
                              disabled={loading}
                            >
                              ✅ Approve
                            </button>
                            <button
                              className="btn reject-btn"
                              onClick={() => handleReject(userRecord)}
                              disabled={loading}
                            >
                              ❌ Reject
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {activeTab === 'approved' && (
              <div className="tab-content">
                <h2>Approved Users</h2>
                {approvedUsers.length === 0 ? (
                  <div className="empty-state">
                    <p>No approved users yet</p>
                  </div>
                ) : (
                  <div className="users-grid">
                    {approvedUsers.map(userRecord => (
                      <div key={userRecord.user_id} className="user-card approved">
                        <div className="card-header">
                          <span className="user-email">{userRecord.email}</span>
                          <span className="status-badge approved-badge">
                            {userRecord.role}
                          </span>
                        </div>

                        <div className="card-details">
                          <div className="detail-item">
                            <span className="label">Current Role:</span>
                            <span className="value">{userRecord.role}</span>
                          </div>
                          <div className="detail-item">
                            <span className="label">Approved:</span>
                            <span className="value">
                              {new Date(userRecord.updated_at).toLocaleString()}
                            </span>
                          </div>
                        </div>

                        <div className="card-actions">
                          <div className="role-selector">
                            <select
                              value={userRecord.role}
                              onChange={e =>
                                handleChangeRole(userRecord, e.target.value)
                              }
                              className="role-select"
                            >
                              <option value="ground">Ground</option>
                              <option value="tower">Tower</option>
                              <option value="ground_tower">Ground & Tower</option>
                              <option value="pilot">Pilot</option>
                            </select>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {activeTab === 'instructors' && (
              <div className="tab-content">
                <h2>👨‍✈️ Manage Instructors</h2>
                <div className="add-item-form">
                  <input
                    type="text"
                    placeholder="Instructor name"
                    value={newInstructor}
                    onChange={e => setNewInstructor(e.target.value)}
                  />
                  <button
                    className="btn btn-primary"
                    onClick={handleAddInstructor}
                    disabled={loading}
                  >
                    ➕ Add Instructor
                  </button>
                </div>
                {instructors.length === 0 ? (
                  <p className="empty-state">No instructors yet</p>
                ) : (
                  <div className="items-list">
                    {instructors.map((inst, index) => (
                      <div key={inst.id || `inst-${index}`} className="item-card">
                        <p>{inst.name}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {activeTab === 'cadets' && (
              <div className="tab-content">
                <h2>🎓 Manage Cadets</h2>
                <div className="add-item-form">
                  <input
                    type="text"
                    placeholder="Cadet name"
                    value={newCadet}
                    onChange={e => setNewCadet(e.target.value)}
                  />
                  <button
                    className="btn btn-primary"
                    onClick={handleAddCadet}
                    disabled={loading}
                  >
                    ➕ Add Cadet
                  </button>
                </div>
                {cadets.length === 0 ? (
                  <p className="empty-state">No cadets yet</p>
                ) : (
                  <div className="items-list">
                    {cadets.map(cadet => (
                      <div key={cadet.id} className="item-card">
                        <p>{cadet.name}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {activeTab === 'aircraft' && (
              <div className="tab-content">
                <h2>✈️ Manage Aircraft</h2>
                <div className="add-item-form">
                  <input
                    type="text"
                    placeholder="Aircraft registration (e.g., N12345)"
                    value={newAircraft}
                    onChange={e => setNewAircraft(e.target.value)}
                  />
                  <button
                    className="btn btn-primary"
                    onClick={handleAddAircraft}
                    disabled={loading}
                  >
                    ➕ Add Aircraft
                  </button>
                </div>
                {aircraft.length === 0 ? (
                  <p className="empty-state">No aircraft yet</p>
                ) : (
                  <div className="items-list">
                    {aircraft.map((plane, index) => (
                      <div key={plane.id || `plane-${index}`} className="item-card">
                        <p>{plane.registration}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {activeTab === 'reset' && (
              <div className="tab-content">
                <h2>🔑 Reset User Password</h2>
                <div className="reset-form">
                  <select
                    value={resetUserEmail}
                    onChange={e => setResetUserEmail(e.target.value)}
                    className="user-select"
                    style={{
                      padding: '10px',
                      borderRadius: '4px',
                      border: '1px solid #ccc',
                      width: '100%',
                      marginBottom: '10px'
                    }}
                  >
                    <option value="">-- Select a user --</option>
                    {approvedUsers.map(user => (
                      <option key={user.user_id} value={user.email}>
                        {user.email} ({user.role})
                      </option>
                    ))}
                    {pendingUsers.map(user => (
                      <option key={user.user_id} value={user.email}>
                        {user.email} (pending - {user.role})
                      </option>
                    ))}
                  </select>
                  <button
                    className="btn btn-primary"
                    onClick={handleResetPassword}
                    disabled={loading || !resetUserEmail}
                  >
                    📧 Send Reset Email
                  </button>
                </div>
                <p className="info-text">Select a user and click to send password reset email.</p>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
};

export default AdminDashboard;

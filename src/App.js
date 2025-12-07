import React, { useContext, useState } from 'react';
import './shared/mobile-first.css';
import './shared/navbar.css';
import './App.css';
import { BrowserRouter, Routes, Route, Link, Navigate, useNavigate } from 'react-router-dom';
import { useAuth } from './context/AuthContext';
import { ThemeContext } from './context/ThemeContext';
import HomePage from './screens/HomePage';
import GroundPage from './screens/GroundPage';
import TowerPageMobile from './screens/TowerPageMobile';
import AdminDashboard from './screens/AdminDashboard';
import LoginPage from './screens/LoginPage';
import SignUp from './screens/SignUp';
import ForgotPassword from './screens/ForgotPassword';

function ProtectedRoute({ element, requiredRoles }) {
  const { user, userRole, isApproved, loading, hasRole } = useAuth();

  if (loading) {
    return <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', color: '#fff' }}>Loading...</div>;
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (!isApproved && userRole !== 'admin') {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', color: '#fff', flexDirection: 'column' }}>
        <h2>Account Pending Approval</h2>
        <p>Your account is awaiting admin approval. Please check back later.</p>
      </div>
    );
  }

  // Check if user has required role (don't bypass with 'user' role for protected routes)
  if (requiredRoles && !hasRole(requiredRoles)) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', color: '#fff', flexDirection: 'column' }}>
        <h2>Access Denied</h2>
        <p>You do not have permission to access this page. Your role: {userRole}</p>
      </div>
    );
  }

  return element;
}

function AppShell() {
  const navigate = useNavigate();
  const { isDark, toggleTheme } = useContext(ThemeContext);
  const { user, userRole, logout, loading } = useAuth();
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  const handleLogout = async () => {
    try {
      setIsLoggingOut(true);
      await logout();
      // Force navigate to login after logout completes
      setTimeout(() => {
        navigate('/login', { replace: true });
      }, 100);
    } catch (error) {
      console.error('Logout failed:', error);
      setIsLoggingOut(false);
      // Navigate to login anyway
      navigate('/login', { replace: true });
    }
  };

  // Only show navbar if user is logged in AND loading is complete
  const showNavbar = user && !loading;

  return (
    <div className="page">
      {showNavbar && (
        <nav className="navbar">
          <div className="navbar-brand">🛫 ATC OPS</div>
          <div className="navbar-links">
            <Link to="/" className="navbar-link">Home</Link>
            {(userRole === 'ground' || userRole === 'admin' || userRole === 'ground_tower') && (
              <Link to="/ground" className="navbar-link">Ground</Link>
            )}
            {(userRole === 'tower' || userRole === 'admin' || userRole === 'ground_tower') && (
              <Link to="/tower" className="navbar-link">Tower</Link>
            )}
            {userRole === 'admin' && (
              <Link to="/admin" className="navbar-link">🔐 Admin</Link>
            )}
          </div>
          <div className="navbar-actions">
            <div className="user-info">
              <div className="user-email">{user?.email}</div>
              <span className="user-role">{userRole}</span>
            </div>
            <button
              onClick={toggleTheme}
              className="theme-toggle"
              title="Toggle theme"
            >
              {isDark ? '☀️' : '🌙'}
            </button>
            <button
              onClick={handleLogout}
              disabled={isLoggingOut}
              className="btn btn-danger btn-sm"
            >
              {isLoggingOut ? '...' : 'Logout'}
            </button>
          </div>
        </nav>
      )}
      <div className="page-content">
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/ground" element={<ProtectedRoute element={<GroundPage />} requiredRoles={['ground', 'admin', 'ground_tower']} />} />
          <Route path="/tower" element={<ProtectedRoute element={<TowerPageMobile />} requiredRoles={['tower', 'admin', 'ground_tower']} />} />
          <Route path="/admin" element={<ProtectedRoute element={<AdminDashboard />} requiredRoles="admin" />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/signup" element={<SignUp />} />
          <Route path="/forgot-password" element={<ForgotPassword />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </div>
    </div>
  );
}

function App() {
  return (
    <BrowserRouter>
      <AppShell />
    </BrowserRouter>
  );
}

export default App;

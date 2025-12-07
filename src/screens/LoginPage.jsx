import React, { useState, useContext, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { ThemeContext } from '../context/ThemeContext';
import '../shared/AuthPages.css';

const Login = () => {
  const navigate = useNavigate();
  const { signIn, user, userRole, loading: authLoading } = useAuth();
  const { isDark, toggleTheme } = useContext(ThemeContext);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [rememberMe, setRememberMe] = useState(false);

  // Redirect to appropriate page if already logged in
  useEffect(() => {
    if (user && userRole && !authLoading) {
      // Redirect based on role
      if (userRole === 'admin') {
        navigate('/admin', { replace: true });
      } else if (userRole === 'tower' || userRole === 'ground_tower') {
        navigate('/tower', { replace: true });
      } else if (userRole === 'ground') {
        navigate('/ground', { replace: true });
      } else {
        navigate('/', { replace: true });
      }
    }
  }, [user, userRole, authLoading, navigate]);

  // If user is already logged in, show loading message
  if (user && authLoading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', color: '#fff' }}>
        <div>Loading your dashboard...</div>
      </div>
    );
  }

  if (user && userRole) {
    return null;
  }

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      await signIn(email, password);
      if (rememberMe) {
        localStorage.setItem('rememberMe', JSON.stringify({ email }));
      }
      // Clear form
      setEmail('');
      setPassword('');
      // Wait longer for auth state and role to update
      await new Promise(resolve => setTimeout(resolve, 1500));
      // The useEffect above will handle the redirect based on userRole
    } catch (err) {
      setError(err.message || 'Login failed');
      setLoading(false);
    }
  };

  return (
    <div className={`auth-container ${isDark ? 'dark' : 'light'}`}>
      <button className="theme-toggle" onClick={toggleTheme}>
        {isDark ? '☀️' : '🌙'}
      </button>

      <div className="auth-card">
        <div className="auth-header">
          <h1>ATC Tracker</h1>
          <p>Flight Operations System</p>
        </div>

        <form onSubmit={handleLogin} className="auth-form">
          <div className="form-group">
            <label htmlFor="email">Email</label>
            <input
              id="email"
              type="email"
              placeholder="your@email.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              disabled={loading}
            />
          </div>

          <div className="form-group">
            <label htmlFor="password">Password</label>
            <input
              id="password"
              type="password"
              placeholder="Enter your password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              disabled={loading}
            />
          </div>

          <div className="form-group checkbox">
            <input
              id="rememberMe"
              type="checkbox"
              checked={rememberMe}
              onChange={(e) => setRememberMe(e.target.checked)}
              disabled={loading}
            />
            <label htmlFor="rememberMe">Remember me</label>
          </div>

          {error && <div className="error-message">{error}</div>}

          <button type="submit" className="btn-primary" disabled={loading}>
            {loading ? 'Logging in...' : 'Login'}
          </button>
        </form>

        <div className="auth-footer">
          <Link to="/" className="link">
            ← Home
          </Link>
          <span className="separator">•</span>
          <Link to="/forgot-password" className="link">
            Forgot password?
          </Link>
          <span className="separator">•</span>
          <Link to="/signup" className="link">
            Create account
          </Link>
        </div>
      </div>

      <div className="auth-demo">
        <p><strong>Demo Credentials:</strong></p>
        <p>Ground: ground@mailinator.com / Password123!</p>
        <p>Tower: tower@mailinator.com / Password123!</p>
      </div>
    </div>
  );
};

export default Login;

import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNavigate, Link } from 'react-router-dom';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState(null);
  const auth = useAuth();
  const navigate = useNavigate();

  async function submit(e) {
    e.preventDefault();
    setError(null);
    const ok = await auth.login(email, password);
    if (ok) {
      // redirect based on role
      const role = auth.user?.role;
      if (role === 'tower') navigate('/tower');
      else if (role === 'ground') navigate('/ground');
      else navigate('/ops');
    } else setError('Invalid credentials');
  }

  return (
    <div style={{ padding: 20 }}>
      <h2>ATC Login</h2>
      <form onSubmit={submit}>
        <div>
          <label>Email</label>
          <br />
          <input value={email} onChange={e => setEmail(e.target.value)} />
        </div>
        <div style={{ marginTop: 8 }}>
          <label>Password</label>
          <br />
          <input type="password" value={password} onChange={e => setPassword(e.target.value)} />
        </div>
        <div style={{ marginTop: 12 }}>
          <button type="submit">Login</button>
        </div>
        {error && <div style={{ color: 'red', marginTop: 8 }}>{error}</div>}
      </form>
      <p style={{ marginTop: 12 }}>
        <Link to="/register">Register an account</Link>
      </p>
      <p style={{ marginTop: 12 }}>
        (If using demo local mode, use `tower1/towerpass`, `ground1/groundpass`, `ops1/opspass` as IDs)
      </p>
    </div>
  );
}

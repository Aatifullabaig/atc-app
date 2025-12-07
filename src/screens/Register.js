import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';

export default function Register() {
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState('ops');
  const [error, setError] = useState(null);
  const auth = useAuth();
  const navigate = useNavigate();

  async function submit(e) {
    e.preventDefault();
    setError(null);
    const res = await auth.register({ email, password, name, role });
    if (res && res.error) setError(res.error.message || 'Registration failed');
    else {
      // after signup, attempt login
      await auth.login(email, password);
      navigate(role === 'tower' ? '/tower' : role === 'ground' ? '/ground' : '/ops');
    }
  }

  return (
    <div style={{ padding: 20 }}>
      <h2>Register Account</h2>
      <form onSubmit={submit}>
        <div>
          <label>Email</label>
          <br />
          <input value={email} onChange={e => setEmail(e.target.value)} />
        </div>
        <div style={{ marginTop: 8 }}>
          <label>Name</label>
          <br />
          <input value={name} onChange={e => setName(e.target.value)} />
        </div>
        <div style={{ marginTop: 8 }}>
          <label>Password</label>
          <br />
          <input type="password" value={password} onChange={e => setPassword(e.target.value)} />
        </div>
        <div style={{ marginTop: 8 }}>
          <label>Role</label>
          <br />
          <select value={role} onChange={e => setRole(e.target.value)}>
            <option value="ops">Operations</option>
            <option value="ground">Ground</option>
            <option value="tower">Tower</option>
          </select>
        </div>
        <div style={{ marginTop: 12 }}>
          <button type="submit">Register</button>
        </div>
        {error && <div style={{ color: 'red', marginTop: 8 }}>{error}</div>}
      </form>
    </div>
  );
}

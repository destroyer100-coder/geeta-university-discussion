import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';

export const LoginPage = () => {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [errorCode, setErrorCode] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setErrorCode('');
    try {
      const res = await login(email, password);
      if (res.success) {
        navigate('/');
      }
    } catch (err) {
      setError(err.message || 'Login failed');
      setErrorCode(err.code || '');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ maxWidth: '440px', margin: '40px auto', padding: '0 16px' }}>
      <div className="card" style={{ padding: '32px' }}>
        <h2 style={{ fontSize: '1.4rem', fontWeight: 800, textAlign: 'center', marginBottom: '6px' }}>
          Geeta University Portal
        </h2>
        <p style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.85rem', marginBottom: '24px' }}>
          Log in with your university credentials
        </p>

        {error && (
          <div style={{ background: '#fef2f2', border: '1px solid #fecaca', color: '#ef4444', padding: '10px', borderRadius: 'var(--radius-md)', fontSize: '0.8rem', marginBottom: '16px' }}>
            {error}
          </div>
        )}
        {errorCode === 'EMAIL_NOT_VERIFIED' && (
          <div style={{ marginBottom: '16px', fontSize: '0.85rem' }}>
            <Link to={`/verify-email?email=${encodeURIComponent(email.trim())}`} style={{ color: 'var(--primary)', fontWeight: 600 }}>Verify or resend university email</Link>
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="form-label">Campus Email</label>
            <input
              type="email"
              className="form-control"
              placeholder="name@university.edu"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>

          <div className="form-group" style={{ marginBottom: '20px' }}>
            <label className="form-label">Password</label>
            <input
              type="password"
              className="form-control"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>

          <button type="submit" className="btn btn-primary" style={{ width: '100%', padding: '10px' }} disabled={loading}>
            {loading ? 'Authenticating...' : 'Sign In'}
          </button>
        </form>

        <div style={{ textAlign: 'center', marginTop: '16px', fontSize: '0.85rem' }}>
          Don't have an account? <Link to="/register" style={{ color: 'var(--primary)', fontWeight: 600 }}>Register</Link>
        </div>
      </div>
    </div>
  );
};

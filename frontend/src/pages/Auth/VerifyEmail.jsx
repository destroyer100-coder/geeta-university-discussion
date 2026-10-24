import React, { useState } from 'react';
import { Link, useSearchParams, useLocation } from 'react-router-dom';
import { authApi } from '../../services/api.js';

export const VerifyEmailPage = () => {
  const [searchParams] = useSearchParams();
  const location = useLocation();
  const [email, setEmail] = useState(searchParams.get('email') || '');
  const [token, setToken] = useState(searchParams.get('token') || '');
  const [message, setMessage] = useState(location.state?.notice || 'Open the verification link sent to your university inbox.');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);

  const handleVerify = async (event) => {
    event.preventDefault();
    setLoading(true);
    setError('');
    setMessage('');
    try {
      const result = await authApi.verifyEmail(email.trim(), token.trim());
      setMessage(result.message || 'University email verified. You can now sign in.');
      setToken('');
    } catch (requestError) {
      setError(requestError.message || 'Email verification failed.');
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    setResending(true);
    setError('');
    setMessage('');
    try {
      const result = await authApi.resendVerificationEmail(email.trim());
      setMessage(result.message || 'If the account needs verification, an email will be sent shortly.');
    } catch (requestError) {
      setError(requestError.message || 'Could not request a verification email.');
    } finally {
      setResending(false);
    }
  };

  return (
    <div style={{ maxWidth: '480px', margin: '40px auto', padding: '0 16px' }}>
      <div className="card" style={{ padding: '32px' }}>
        <h2 style={{ fontSize: '1.4rem', fontWeight: 800, textAlign: 'center', marginBottom: '8px' }}>
          Verify University Email
        </h2>
        <p style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.875rem', marginBottom: '24px' }}>
          Verification links expire after one hour and can only be used once.
        </p>

        {message && <div role="status" style={{ background: '#eff6ff', border: '1px solid #bfdbfe', color: '#1d4ed8', padding: '10px', borderRadius: 'var(--radius-md)', fontSize: '0.85rem', marginBottom: '16px' }}>{message}</div>}
        {error && <div role="alert" style={{ background: '#fef2f2', border: '1px solid #fecaca', color: '#b91c1c', padding: '10px', borderRadius: 'var(--radius-md)', fontSize: '0.85rem', marginBottom: '16px' }}>{error}</div>}

        <form onSubmit={handleVerify}>
          <div className="form-group">
            <label className="form-label" htmlFor="verification-email">University email</label>
            <input id="verification-email" type="email" className="form-control" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} maxLength={254} required />
          </div>
          <div className="form-group">
            <label className="form-label" htmlFor="verification-token">Verification token</label>
            <input id="verification-token" type="text" className="form-control" autoComplete="off" value={token} onChange={(event) => setToken(event.target.value)} pattern="[a-fA-F0-9]{64}" maxLength={64} required />
          </div>
          <button type="submit" className="btn btn-primary" style={{ width: '100%', padding: '10px' }} disabled={loading || !email.trim() || !token.trim()}>
            {loading ? 'Verifying...' : 'Verify Email'}
          </button>
        </form>

        <button type="button" className="btn btn-secondary" style={{ width: '100%', padding: '10px', marginTop: '10px' }} onClick={handleResend} disabled={resending || !email.trim()}>
          {resending ? 'Requesting...' : 'Resend Verification Email'}
        </button>
        <div style={{ textAlign: 'center', marginTop: '20px', fontSize: '0.85rem' }}>
          Already verified? <Link to="/login" style={{ color: 'var(--primary)', fontWeight: 600 }}>Sign in</Link>
        </div>
      </div>
    </div>
  );
};

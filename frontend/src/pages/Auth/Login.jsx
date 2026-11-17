import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { Icon } from '../../components/common/Icons';

export const LoginPage = () => {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [errorCode, setErrorCode] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (event) => {
    event.preventDefault();
    setLoading(true);
    setError('');
    setErrorCode('');
    try {
      const response = await login(email.trim(), password);
      if (response.success) navigate('/', { replace: true });
    } catch (err) {
      setError(err.message || 'Login failed.');
      setErrorCode(err.code || '');
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="auth-page">
      <section className="auth-campus-panel">
        <div className="auth-campus-brand">
          <div className="auth-brand-emblem"><Icon name="shieldCheck" size={28} /></div>
          <div><strong>GEETA UNIVERSITY</strong><span>Discussion Forum</span></div>
        </div>
        <div className="auth-campus-copy">
          <p className="auth-eyebrow">YOUR CAMPUS. YOUR COMMUNITY.</p>
          <h1>Connect. Discuss.<br /><em>Learn & Build.</em></h1>
          <p>Share ideas, ask questions and connect with students, seniors and faculty across the university.</p>
        </div>
        <div className="auth-feature-row">
          <span><Icon name="users" size={17} /> Communities</span>
          <span><Icon name="messageSquare" size={17} /> Discussions</span>
          <span><Icon name="calendar" size={17} /> Events</span>
        </div>
      </section>

      <section className="auth-form-panel">
        <div className="auth-form-card">
          <div className="auth-form-mark"><Icon name="lock" size={20} /></div>
          <p className="auth-eyebrow">WELCOME BACK</p>
          <h2>Sign in to your account</h2>
          <p className="auth-form-subtitle">Use your university email and password to continue.</p>

          {error ? <div className="auth-error" role="alert">{error}</div> : null}
          {errorCode === 'EMAIL_NOT_VERIFIED' ? (
            <div className="auth-verification-link"><Link to={'/verify-email?email=' + encodeURIComponent(email.trim())}>Verify or resend university email</Link></div>
          ) : null}

          <form onSubmit={handleSubmit} className="auth-login-form">
            <label className="form-group">
              <span className="form-label">University Email</span>
              <span className="auth-input-wrap"><Icon name="userCheck" size={17} /><input className="form-control" type="email" autoComplete="username" placeholder="name@geeta.edu.in" value={email} onChange={(event) => setEmail(event.target.value)} required /></span>
            </label>
            <label className="form-group">
              <span className="form-label">Password</span>
              <span className="auth-input-wrap"><Icon name="lock" size={17} /><input className="form-control" type="password" autoComplete="current-password" placeholder="Enter your password" value={password} onChange={(event) => setPassword(event.target.value)} required /></span>
            </label>
            <button type="submit" className="btn btn-primary auth-submit" disabled={loading}>
              {loading ? 'Signing in...' : 'Sign In'} <Icon name="arrowRight" size={17} />
            </button>
          </form>

          <p className="auth-register-prompt">New to the forum? <Link to="/register">Create an account</Link></p>
          <div className="auth-security-note"><Icon name="shieldCheck" size={16} /> University account authentication</div>
        </div>
      </section>
    </main>
  );
};

export default LoginPage;

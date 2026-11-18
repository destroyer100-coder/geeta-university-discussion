import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { Icon } from '../../components/common/Icons';

export const LoginPage = () => {
  const { login, loginPreview } = useAuth();
  const navigate = useNavigate();
  const [activeMode, setActiveMode] = useState('university');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(true);
  const [error, setError] = useState('');
  const [errorCode, setErrorCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [showReset, setShowReset] = useState(false);
  const [resetEmail, setResetEmail] = useState('');
  const [notice, setNotice] = useState('');

  const handleSubmit = async (event) => {
    event.preventDefault();
    setLoading(true);
    setError('');
    setErrorCode('');
    setNotice('');
    try {
      const response = await login(email.trim(), password);
      if (response.success) navigate('/', { replace: true });
      else setError(response.message || 'Login could not be completed.');
    } catch (err) {
      setError(err.message || 'University sign-in is unavailable right now.');
      setErrorCode(err.code || '');
    } finally {
      setLoading(false);
    }
  };

  const handleGuestLogin = () => {
    setError('');
    setNotice('Guest preview is active. Changes stay in this browser and are not connected to a university account.');
    loginPreview();
    navigate('/', { replace: true });
  };

  const handleSocialPreview = (provider) => {
    setNotice(provider + ' sign-in is shown for the reference UI only and is not connected to an external account.');
  };

  const handleResetPreview = (event) => {
    event.preventDefault();
    setShowReset(false);
    setNotice('Password reset is not connected during this frontend preview. No email was sent.');
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
          <p>A unified community for students, faculty and university clubs to collaborate, share knowledge and grow together.</p>
        </div>
        <div className="auth-feature-row">
          <span><Icon name="users" size={17} /> Communities</span>
          <span><Icon name="messageSquare" size={17} /> Discussions</span>
          <span><Icon name="calendar" size={17} /> Events</span>
          <span><Icon name="layers" size={17} /> Resources</span>
        </div>
      </section>

      <section className="auth-form-panel">
        <div className="auth-form-card">
          <p className="auth-eyebrow">WELCOME BACK</p>
          <h2>Welcome Back</h2>
          <p className="auth-form-subtitle">Sign in to your Geeta University Discussion Forum.</p>

          <div className="auth-mode-tabs" role="tablist" aria-label="Sign-in method">
            <button type="button" role="tab" aria-selected={activeMode === 'university'} className={activeMode === 'university' ? 'active' : ''} onClick={() => { setActiveMode('university'); setError(''); }}>
              <Icon name="graduationCap" size={16} /> University Login
            </button>
            <button type="button" role="tab" aria-selected={activeMode === 'guest'} className={activeMode === 'guest' ? 'active' : ''} onClick={() => { setActiveMode('guest'); setError(''); }}>
              <Icon name="user" size={16} /> Guest Login
            </button>
          </div>

          {error ? <div className="auth-error" role="alert">{error}</div> : null}
          {notice ? <div className="auth-preview-notice" role="status">{notice}</div> : null}
          {errorCode === 'EMAIL_NOT_VERIFIED' ? (
            <div className="auth-verification-link"><Link to={'/verify-email?email=' + encodeURIComponent(email.trim())}>Verify or resend university email</Link></div>
          ) : null}

          {activeMode === 'university' ? (
            <form onSubmit={handleSubmit} className="auth-login-form">
              <label className="form-group">
                <span className="form-label">University Email</span>
                <span className="auth-input-wrap"><Icon name="mail" size={17} /><input className="form-control" type="email" autoComplete="username" placeholder="Enter your university email" value={email} onChange={(event) => setEmail(event.target.value)} required /></span>
              </label>
              <label className="form-group">
                <span className="form-label">Password</span>
                <span className="auth-input-wrap"><Icon name="lock" size={17} /><input className="form-control" type="password" autoComplete="current-password" placeholder="Enter your password" value={password} onChange={(event) => setPassword(event.target.value)} required /></span>
              </label>
              <div className="auth-login-options">
                <label><input type="checkbox" checked={rememberMe} onChange={(event) => setRememberMe(event.target.checked)} /> Remember me</label>
                <button type="button" onClick={() => { setResetEmail(email); setShowReset(true); }}>Forgot password?</button>
              </div>
              <button type="submit" className="btn btn-primary auth-submit" disabled={loading}>
                {loading ? 'Signing in...' : 'Sign In'} <Icon name="arrowRight" size={17} />
              </button>
            </form>
          ) : (
            <div className="auth-guest-panel">
              <div className="auth-guest-icon"><Icon name="userRound" size={25} /></div>
              <h3>Explore as a Guest</h3>
              <p>Browse the forum and try the frontend interactions. Your preview activity is stored only in this browser and is not published to a university account.</p>
              <button type="button" className="btn btn-primary auth-submit" onClick={handleGuestLogin}>Continue as Guest <Icon name="arrowRight" size={17} /></button>
            </div>
          )}

          <div className="auth-divider"><span>or continue with</span></div>
          <div className="auth-social-buttons">
            <button type="button" onClick={() => handleSocialPreview('Google')}><strong className="auth-google-mark">G</strong> Google</button>
            <button type="button" onClick={() => handleSocialPreview('Microsoft')}><strong className="auth-microsoft-mark"><i /><i /><i /><i /></strong> Microsoft</button>
          </div>

          <p className="auth-register-prompt">New to the forum? <Link to="/register">Create an Account <Icon name="arrowRight" size={14} /></Link></p>
        </div>
      </section>

      {showReset ? (
        <div className="modal-overlay" role="presentation" onClick={(event) => { if (event.target === event.currentTarget) setShowReset(false); }}>
          <section className="modal-card auth-reset-dialog" role="dialog" aria-modal="true" aria-label="Reset password">
            <header><h2>Forgot Password?</h2><button type="button" className="btn-icon" aria-label="Close" onClick={() => setShowReset(false)}><Icon name="x" size={18} /></button></header>
            <p>Enter your university email to preview the reset form.</p>
            <form onSubmit={handleResetPreview}>
              <label className="form-group"><span className="form-label">University Email</span><input className="form-control" type="email" required value={resetEmail} onChange={(event) => setResetEmail(event.target.value)} placeholder="name@university.edu" /></label>
              <footer><button type="button" className="btn btn-outline" onClick={() => setShowReset(false)}>Cancel</button><button type="submit" className="btn btn-primary">Continue</button></footer>
            </form>
          </section>
        </div>
      ) : null}
    </main>
  );
};

export default LoginPage;

import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { notificationsApi, usersApi } from '../../services/api';
import { Icon } from '../../components/common/Icons';
import { PageHero } from '../../components/common/PageHero';

const readAppearance = () => {
  try {
    const saved = JSON.parse(localStorage.getItem('guf-appearance') || '{}');
    return {
      mode: ['light', 'dark', 'system'].includes(saved.mode) ? saved.mode : 'system',
      accent: ['green', 'blue', 'purple', 'amber', 'rose'].includes(saved.accent) ? saved.accent : 'green',
    };
  } catch {
    return { mode: 'system', accent: 'green' };
  }
};

const getInitials = (name = '') =>
  name.trim().split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]).join('').toUpperCase() || 'U';

export const SettingsPage = () => {
  const { user, updateUser, logout } = useAuth();
  const navigate = useNavigate();
  const [activeSection, setActiveSection] = useState('account');
  const [profileForm, setProfileForm] = useState({
    name: user?.name || '',
    department: user?.department || '',
    year: user?.year || '',
    bio: user?.bio || '',
    avatar: user?.avatar || '',
  });
  const [restrictions, setRestrictions] = useState({ blockedUsers: [], mutedUsers: [] });
  const [notificationStatus, setNotificationStatus] = useState({ total: 0, unread: 0 });
  const [appearance, setAppearance] = useState(readAppearance);
  const [loadingPrivacy, setLoadingPrivacy] = useState(false);
  const [savingProfile, setSavingProfile] = useState(false);
  const [busyUserId, setBusyUserId] = useState('');
  const [notice, setNotice] = useState('');
  const [errorNotice, setErrorNotice] = useState('');

  useEffect(() => {
    setProfileForm({
      name: user?.name || '',
      department: user?.department || '',
      year: user?.year || '',
      bio: user?.bio || '',
      avatar: user?.avatar || '',
    });
  }, [user]);

  useEffect(() => {
    const root = document.documentElement;
    root.dataset.theme = appearance.mode;
    root.dataset.accent = appearance.accent;
    try {
      localStorage.setItem('guf-appearance', JSON.stringify(appearance));
    } catch {
      // Appearance still applies for this session when browser storage is unavailable.
    }
  }, [appearance]);

  const loadAccountPanels = async () => {
    if (!user) return;
    setLoadingPrivacy(true);
    try {
      const [restrictionResult, notificationResult] = await Promise.allSettled([
        usersApi.getRestrictions(),
        notificationsApi.getAll(),
      ]);
      if (restrictionResult.status === 'fulfilled' && restrictionResult.value?.success) {
        setRestrictions({
          blockedUsers: restrictionResult.value.data?.blockedUsers || [],
          mutedUsers: restrictionResult.value.data?.mutedUsers || [],
        });
      }
      if (notificationResult.status === 'fulfilled' && notificationResult.value?.success) {
        setNotificationStatus({
          total: notificationResult.value.count || notificationResult.value.data?.length || 0,
          unread: notificationResult.value.unreadCount || 0,
        });
      }
    } finally {
      setLoadingPrivacy(false);
    }
  };

  useEffect(() => { loadAccountPanels(); }, [user?._id]);

  const handleProfileChange = (field, value) => {
    setProfileForm((form) => ({ ...form, [field]: value }));
  };

  const handleSaveProfile = async (event) => {
    event.preventDefault();
    setSavingProfile(true);
    setNotice('');
    setErrorNotice('');
    try {
      const response = await usersApi.updateProfile(profileForm);
      if (response.success) {
        updateUser(response.data || profileForm);
        setNotice('Your profile details have been saved.');
      }
    } catch (error) {
      setErrorNotice(error.message || 'Could not save your account details.');
    } finally {
      setSavingProfile(false);
    }
  };

  const handleRestriction = async (person, kind) => {
    const personId = person?._id;
    if (!personId || busyUserId) return;
    setBusyUserId(personId);
    setNotice('');
    setErrorNotice('');
    try {
      if (kind === 'blocked') await usersApi.unblock(personId);
      else await usersApi.unmute(personId);
      await loadAccountPanels();
      setNotice(kind === 'blocked' ? 'User unblocked.' : 'User unmuted.');
    } catch (error) {
      setErrorNotice(error.message || 'Could not update this restriction.');
    } finally {
      setBusyUserId('');
    }
  };

  const handleDeleteAccount = async () => {
    const confirmation = window.prompt('Type DELETE to confirm account deletion and anonymization.');
    if (confirmation !== 'DELETE') return;
    setErrorNotice('');
    try {
      const response = await usersApi.deleteAccount();
      if (response.success) {
        logout();
        navigate('/login', { replace: true });
      }
    } catch (error) {
      setErrorNotice(error.message || 'Account deletion could not be completed.');
    }
  };

  if (!user) {
    return (
      <div className="page-shell page-settings">
        <PageHero icon="settings" title="Settings" description="Manage your account and application preferences." />
        <div className="card settings-signin">
          <h2>Sign in to manage settings</h2>
          <p>Account settings are available after you sign in.</p>
          <Link to="/login" className="btn btn-primary">Sign in</Link>
        </div>
      </div>
    );
  }

  const sections = [
    { key: 'account', label: 'Account Settings', icon: 'userCheck' },
    { key: 'privacy', label: 'Privacy & Visibility', icon: 'shieldCheck' },
    { key: 'appearance', label: 'Appearance', icon: 'image' },
    { key: 'notifications', label: 'Notifications', icon: 'bell' },
  ];

  return (
    <div className="page-shell page-settings">
      <PageHero icon="settings" title="Settings" description="Manage your account, privacy and application preferences." />
      {notice ? <div className="settings-notice" role="status">{notice}</div> : null}
      {errorNotice ? <div className="notification-error" role="alert">{errorNotice}</div> : null}

      <div className="settings-workspace">
        <nav className="settings-nav" aria-label="Settings sections">
          <h2>Settings</h2>
          {sections.map((section) => (
            <button type="button" key={section.key} className={activeSection === section.key ? 'active' : ''} onClick={() => setActiveSection(section.key)}>
              <Icon name={section.icon} size={18} /><span>{section.label}</span><Icon name="chevronRight" size={16} />
            </button>
          ))}
        </nav>

        <main className="settings-main">
          {activeSection === 'account' ? (
            <section className="card settings-panel">
              <header className="settings-panel-header">
                <div><h2>Account Settings</h2><p>Manage your profile information and account details.</p></div>
                <span className="settings-status"><Icon name="checkCircle2" size={15} /> {user.verified ? 'Verified account' : 'Unverified account'}</span>
              </header>

              <div className="settings-profile-preview">
                {user.avatar ? <img src={user.avatar} alt="" /> : <span>{getInitials(user.name)}</span>}
                <div><strong>{user.name}</strong><small>{user.email}</small></div>
                <Link to="/profile/me" className="btn btn-outline btn-sm">View Profile</Link>
              </div>

              <form onSubmit={handleSaveProfile} className="settings-form">
                <div className="settings-form-grid">
                  <label className="form-group"><span className="form-label">Full Name</span><input className="form-control" required maxLength={100} value={profileForm.name} onChange={(event) => handleProfileChange('name', event.target.value)} /></label>
                  <label className="form-group"><span className="form-label">Email Address</span><input className="form-control" value={user.email || ''} readOnly disabled /></label>
                  <label className="form-group"><span className="form-label">Department</span><input className="form-control" value={profileForm.department} onChange={(event) => handleProfileChange('department', event.target.value)} /></label>
                  <label className="form-group"><span className="form-label">Year / Role</span><input className="form-control" value={profileForm.year} onChange={(event) => handleProfileChange('year', event.target.value)} /></label>
                  <label className="form-group settings-form-span"><span className="form-label">Avatar Image URL</span><input className="form-control" type="url" value={profileForm.avatar} onChange={(event) => handleProfileChange('avatar', event.target.value)} placeholder="https://..." /></label>
                  <label className="form-group settings-form-span"><span className="form-label">About Me</span><textarea className="form-control" rows={4} maxLength={2000} value={profileForm.bio} onChange={(event) => handleProfileChange('bio', event.target.value)} /></label>
                </div>
                <div className="settings-form-actions">
                  <button type="submit" className="btn btn-primary" disabled={savingProfile}>{savingProfile ? 'Saving...' : 'Save Changes'}</button>
                </div>
              </form>

              <div className="settings-danger-zone">
                <div><strong>Delete account</strong><p>Delete and anonymize your account. Community ownership must be transferred first.</p></div>
                <button type="button" className="btn btn-outline settings-danger-button" onClick={handleDeleteAccount}>Delete Account</button>
              </div>
            </section>
          ) : null}

          {activeSection === 'privacy' ? (
            <section className="card settings-panel">
              <header className="settings-panel-header"><div><h2>Privacy & Visibility</h2><p>Review the account restrictions that are supported by your current account settings.</p></div></header>
              <div className="settings-readonly-note"><Icon name="shieldCheck" size={19} /><span>Profile visibility and message permissions are enforced by the server. The current API does not expose a general profile-visibility switch.</span></div>
              {loadingPrivacy ? <div className="loading-state">Loading account restrictions...</div> : (
                <div className="settings-restrictions-grid">
                  <section className="settings-restriction-group">
                    <h3>Blocked Users <span>{restrictions.blockedUsers.length}</span></h3>
                    {restrictions.blockedUsers.length ? restrictions.blockedUsers.map((person) => (
                      <div className="settings-restriction-row" key={person._id}>
                        <div>{person.avatar ? <img src={person.avatar} alt="" /> : <span>{getInitials(person.name)}</span>}<strong>{person.name}</strong></div>
                        <button type="button" className="btn btn-outline btn-sm" disabled={busyUserId === person._id} onClick={() => handleRestriction(person, 'blocked')}>Unblock</button>
                      </div>
                    )) : <p className="settings-empty-line">No blocked users.</p>}
                  </section>
                  <section className="settings-restriction-group">
                    <h3>Muted Users <span>{restrictions.mutedUsers.length}</span></h3>
                    {restrictions.mutedUsers.length ? restrictions.mutedUsers.map((person) => (
                      <div className="settings-restriction-row" key={person._id}>
                        <div>{person.avatar ? <img src={person.avatar} alt="" /> : <span>{getInitials(person.name)}</span>}<strong>{person.name}</strong></div>
                        <button type="button" className="btn btn-outline btn-sm" disabled={busyUserId === person._id} onClick={() => handleRestriction(person, 'muted')}>Unmute</button>
                      </div>
                    )) : <p className="settings-empty-line">No muted users.</p>}
                  </section>
                </div>
              )}
            </section>
          ) : null}

          {activeSection === 'appearance' ? (
            <section className="card settings-panel">
              <header className="settings-panel-header"><div><h2>Appearance</h2><p>Choose a display mode and accent colour for this browser.</p></div></header>
              <h3 className="settings-subheading">Display Mode</h3>
              <div className="settings-mode-grid">
                {[
                  { key: 'light', label: 'Light', icon: 'sun' },
                  { key: 'dark', label: 'Dark', icon: 'moon' },
                  { key: 'system', label: 'System', icon: 'monitor' },
                ].map((mode) => (
                  <button type="button" key={mode.key} className={appearance.mode === mode.key ? 'settings-mode-option active' : 'settings-mode-option'} onClick={() => setAppearance((value) => ({ ...value, mode: mode.key }))}>
                    <span><Icon name={mode.icon} size={20} /></span><strong>{mode.label}</strong>{appearance.mode === mode.key ? <Icon name="checkCircle2" size={17} /> : null}
                  </button>
                ))}
              </div>
              <h3 className="settings-subheading">Accent Colour</h3>
              <div className="settings-accent-grid">
                {[
                  { key: 'green', label: 'Forest Green', color: '#087447' },
                  { key: 'blue', label: 'Blue', color: '#2563eb' },
                  { key: 'purple', label: 'Purple', color: '#7c3aed' },
                  { key: 'amber', label: 'Amber', color: '#d97706' },
                  { key: 'rose', label: 'Rose', color: '#e11d48' },
                ].map((accent) => (
                  <button type="button" key={accent.key} className={appearance.accent === accent.key ? 'settings-accent-option active' : 'settings-accent-option'} onClick={() => setAppearance((value) => ({ ...value, accent: accent.key }))}>
                    <span style={{ background: accent.color }} /><strong>{accent.label}</strong>{appearance.accent === accent.key ? <Icon name="check" size={16} /> : null}
                  </button>
                ))}
              </div>
              <p className="settings-local-note">Appearance preferences are saved locally in this browser. They do not change your account profile or server data.</p>
            </section>
          ) : null}

          {activeSection === 'notifications' ? (
            <section className="card settings-panel">
              <header className="settings-panel-header"><div><h2>Notifications</h2><p>Review notification activity and read status.</p></div></header>
              <div className="settings-notification-stats">
                <div><span>Unread</span><strong>{notificationStatus.unread}</strong></div>
                <div><span>Total</span><strong>{notificationStatus.total}</strong></div>
              </div>
              <p className="settings-local-note">Push, email and per-category delivery preferences are not provided by the current notification API.</p>
              <Link to="/notifications" className="btn btn-primary">Open Notification Center <Icon name="arrowRight" size={16} /></Link>
            </section>
          ) : null}
        </main>
      </div>
    </div>
  );
};

export default SettingsPage;

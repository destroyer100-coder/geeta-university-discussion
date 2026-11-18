import React, { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { usersApi } from '../../services/api';
import { Icon } from '../../components/common/Icons';
import { PageHero } from '../../components/common/PageHero';

const DEFAULT_PREFERENCES = {
  privacy: {
    visibility: 'university',
    showEmail: false,
    showPhone: false,
    onlineStatus: true,
    activity: true,
    messagePermission: 'university',
    followPermission: 'university',
    mentionPermission: 'everyone',
  },
  notifications: {
    push: true,
    email: false,
    community: true,
    events: true,
    activity: true,
    mentions: true,
  },
  appearance: {
    mode: 'light',
    accent: 'green',
    fontSize: 'medium',
    compact: false,
    animations: true,
  },
  security: { twoFactor: false },
  connections: { google: false, microsoft: false },
  accessibility: { highContrast: false, reducedMotion: false, keyboardHints: true },
  language: { language: 'English', timezone: 'Asia/Kolkata' },
};

const readPreferences = () => {
  try {
    const saved = JSON.parse(localStorage.getItem('guf-settings-preferences') || '{}');
    return {
      ...DEFAULT_PREFERENCES,
      ...saved,
      privacy: { ...DEFAULT_PREFERENCES.privacy, ...(saved.privacy || {}) },
      notifications: { ...DEFAULT_PREFERENCES.notifications, ...(saved.notifications || {}) },
      appearance: { ...DEFAULT_PREFERENCES.appearance, ...(saved.appearance || {}) },
      security: { ...DEFAULT_PREFERENCES.security, ...(saved.security || {}) },
      connections: { ...DEFAULT_PREFERENCES.connections, ...(saved.connections || {}) },
      accessibility: { ...DEFAULT_PREFERENCES.accessibility, ...(saved.accessibility || {}) },
      language: { ...DEFAULT_PREFERENCES.language, ...(saved.language || {}) },
    };
  } catch {
    return DEFAULT_PREFERENCES;
  }
};

const initials = (name = '') =>
  name.trim().split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]).join('').toUpperCase() || 'U';

const SECTIONS = [
  { key: 'account', label: 'Account Settings', icon: 'userCheck' },
  { key: 'privacy', label: 'Privacy & Visibility', icon: 'shieldCheck' },
  { key: 'notifications', label: 'Notifications', icon: 'bell' },
  { key: 'appearance', label: 'Appearance', icon: 'image' },
  { key: 'security', label: 'Security', icon: 'lock' },
  { key: 'connections', label: 'Connected Accounts', icon: 'link' },
  { key: 'data', label: 'Data & Privacy', icon: 'fileText' },
  { key: 'communities', label: 'Manage Communities', icon: 'users' },
  { key: 'moderation', label: 'Moderation & Rules', icon: 'shieldCheck' },
  { key: 'language', label: 'Language & Region', icon: 'globe' },
  { key: 'accessibility', label: 'Accessibility', icon: 'eye' },
  { key: 'help', label: 'About & Help', icon: 'helpCircle' },
];

const InfoItem = ({ label, value }) => (
  <div className="settings-info-item">
    <span>{label}</span>
    <strong>{value || 'Not provided'}</strong>
  </div>
);

const SwitchRow = ({ label, description, checked, onChange }) => (
  <label className="settings-switch-row">
    <span><strong>{label}</strong>{description ? <small>{description}</small> : null}</span>
    <input type="checkbox" checked={Boolean(checked)} onChange={(event) => onChange(event.target.checked)} />
    <i aria-hidden="true" />
  </label>
);

export const SettingsPage = () => {
  const { user, updateUser, logout } = useAuth();
  const navigate = useNavigate();
  const [activeSection, setActiveSection] = useState(() => {
    const value = new URLSearchParams(window.location.search).get('section');
    return SECTIONS.some((item) => item.key === value) ? value : 'account';
  });
  const [editingAccount, setEditingAccount] = useState(false);
  const [profileForm, setProfileForm] = useState({
    name: user?.name || '',
    username: user?.username || '',
    university: user?.university || '',
    department: user?.department || '',
    year: user?.year || '',
    location: user?.location || '',
    bio: user?.bio || '',
  });
  const [avatarPreview, setAvatarPreview] = useState('');
  const avatarInputRef = useRef(null);
  const [preferences, setPreferences] = useState(readPreferences);
  const [savedPreferences, setSavedPreferences] = useState(readPreferences);
  const [notice, setNotice] = useState('');
  const [dialogAction, setDialogAction] = useState('');
  const [dialogValue, setDialogValue] = useState('');
  const [showHelpTopic, setShowHelpTopic] = useState('getting-started');

  useEffect(() => {
    setProfileForm({
      name: user?.name || '',
      username: user?.username || '',
      university: user?.university || '',
      department: user?.department || '',
      year: user?.year || '',
      location: user?.location || '',
      bio: user?.bio || '',
    });
  }, [user?._id]);

  useEffect(() => {
    const appearance = preferences.appearance;
    const root = document.documentElement;
    const media = window.matchMedia('(prefers-color-scheme: dark)');
    const apply = () => {
      root.dataset.theme = appearance.mode === 'system'
        ? (media.matches ? 'dark' : 'light')
        : appearance.mode;
      root.dataset.accent = appearance.accent;
      root.dataset.fontSize = appearance.fontSize;
      root.dataset.compact = String(appearance.compact);
      root.dataset.reducedMotion = String(preferences.accessibility.reducedMotion || !appearance.animations);
      root.dataset.highContrast = String(preferences.accessibility.highContrast);
    };
    apply();
    if (appearance.mode === 'system') media.addEventListener?.('change', apply);
    return () => media.removeEventListener?.('change', apply);
  }, [preferences]);

  const updatePreference = (group, key, value) => {
    setPreferences((current) => ({
      ...current,
      [group]: { ...current[group], [key]: value },
    }));
  };

  const savePreferences = () => {
    try {
      localStorage.setItem('guf-settings-preferences', JSON.stringify(preferences));
      setSavedPreferences(preferences);
      setNotice('Your preferences are saved in this browser.');
    } catch {
      setNotice('Preferences are active for this session, but browser storage is unavailable.');
    }
  };

  const updateProfileField = (field, value) => {
    setProfileForm((current) => ({ ...current, [field]: value }));
  };

  const handleAvatarChange = (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      setNotice('Choose an image file for your profile photo.');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setNotice('Choose an image smaller than 5 MB.');
      return;
    }
    setAvatarPreview(URL.createObjectURL(file));
  };

  const saveProfilePreview = async (event) => {
    event.preventDefault();
    setNotice('');
    const profilePayload = {
      name: profileForm.name.trim(),
      bio: profileForm.bio,
      department: profileForm.department,
      year: profileForm.year,
    };

    if (user?.isGuestPreview) {
      try {
        localStorage.setItem('guf-profile-preview', JSON.stringify(profilePayload));
        if (updateUser) updateUser({ ...user, ...profilePayload });
        setEditingAccount(false);
        setNotice('Guest preview profile updated in this browser only.');
      } catch {
        setNotice('The profile preview could not be stored in this browser.');
      }
      return;
    }

    if (!user?._id) {
      setNotice('Sign in to update your account profile.');
      return;
    }

    try {
      const response = await usersApi.updateProfile(profilePayload);
      if (!response?.success || !response?.data) {
        throw new Error(response?.message || 'Your profile could not be updated.');
      }
      if (updateUser) updateUser(response.data);
      setProfileForm((current) => ({
        ...current,
        name: response.data.name || current.name,
        bio: response.data.bio || '',
        department: response.data.department || '',
        year: response.data.year || '',
      }));
      setEditingAccount(false);
      const photoWasPreviewOnly = Boolean(avatarPreview);
      setAvatarPreview('');
      setNotice(photoWasPreviewOnly
        ? 'Your profile fields were saved. Profile photo upload is not supported by the current backend API, so the photo was not changed.'
        : 'Your profile changes have been saved to your account.');
    } catch (error) {
      setNotice(error.message || 'Your profile could not be updated. Please try again.');
    }
  };

  const exportPreferences = () => {
    const payload = {
      exportedAt: new Date().toISOString(),
      profilePreview: profileForm,
      preferences,
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = 'geeta-forum-local-settings.json';
    anchor.click();
    URL.revokeObjectURL(url);
    setNotice('Your local settings export has been prepared.');
  };

  const resetPreferences = () => {
    setPreferences(DEFAULT_PREFERENCES);
    try {
      localStorage.removeItem('guf-settings-preferences');
      setSavedPreferences(DEFAULT_PREFERENCES);
      setNotice('Local preferences have been reset.');
    } catch {
      setNotice('Preferences were reset for this session.');
    }
  };

  const handleDeleteAccount = async () => {
    if (!user?._id || user?.isGuestPreview) {
      setNotice('Sign in with a real account before requesting account deletion.');
      return;
    }
    const confirmed = window.confirm('Delete your account? Your personal profile will be anonymized. This action cannot be undone.');
    if (!confirmed) return;
    try {
      const response = await usersApi.deleteAccount();
      if (!response?.success) throw new Error(response?.message || 'Account deletion could not be completed.');
      setNotice('Your account has been deleted and personal data anonymized. Signing you out.');
      window.setTimeout(() => {
        logout();
        navigate('/login', { replace: true });
      }, 900);
    } catch (error) {
      setNotice(error.message || 'Account deletion could not be completed.');
    }
  };

  const updateDialog = (event) => {
    event.preventDefault();
    setDialogAction('');
    setDialogValue('');
    setNotice('Password, email and phone changes are not supported by the current backend API. No account data was changed.');
  };

  const currentName = profileForm.name || user?.name || 'Your name';
  const currentAvatar = avatarPreview || user?.avatar || '';
  const university = profileForm.university || user?.university || '';
  const department = profileForm.department || user?.department || '';
  const year = profileForm.year || user?.year || '';

  return (
    <div className="page-shell page-settings">
      <PageHero icon="settings" title="Settings" description="Manage your account, privacy, notifications and more." />
      {notice ? <div className="settings-notice" role="status">{notice}</div> : null}

      <div className="settings-workspace">
        <nav className="settings-nav" aria-label="Settings sections">
          {SECTIONS.map((section) => (
            <button
              type="button"
              key={section.key}
              className={activeSection === section.key ? 'active' : ''}
              onClick={() => { setActiveSection(section.key); setEditingAccount(false); setNotice(''); }}
              aria-current={activeSection === section.key ? 'page' : undefined}
            >
              <Icon name={section.icon} size={17} />
              <span>{section.label}</span>
              {activeSection === section.key ? <Icon name="chevronRight" size={15} /> : null}
            </button>
          ))}
        </nav>

        <main className="settings-main">
          {activeSection === 'account' ? (
            <section className="card settings-panel">
              {!editingAccount ? (
                <>
                  <header className="settings-panel-header">
                    <div><h2>Account Settings</h2><p>Manage your profile information and account details.</p></div>
                    <button type="button" className="btn btn-outline btn-sm" onClick={() => setEditingAccount(true)}><Icon name="edit3" size={15} /> Edit Profile</button>
                  </header>
                  <div className="settings-account-profile">
                    <div className="settings-account-photo">
                      {currentAvatar ? <img src={currentAvatar} alt="" /> : <span>{initials(currentName)}</span>}
                    </div>
                    <div className="settings-account-profile-copy"><strong>{currentName}</strong><small>{[department, year].filter(Boolean).join(' · ') || 'University member'}</small><small>{user?.email || 'Email not provided'}</small></div>
                    <span className="settings-account-verified"><Icon name="checkCircle2" size={14} /> {user?.verified ? 'Verified' : 'Account profile'}</span>
                  </div>
                  <div className="settings-info-grid">
                    <section className="settings-info-card">
                      <header><h3><Icon name="userCheck" size={16} /> Personal Information</h3><button type="button" onClick={() => setEditingAccount(true)}>Edit</button></header>
                      <InfoItem label="Full Name" value={currentName} />
                      <InfoItem label="Email" value={user?.email} />
                      <InfoItem label="Phone" value={user?.phone} />
                      <InfoItem label="Bio" value={profileForm.bio || user?.bio} />
                    </section>
                    <section className="settings-info-card">
                      <header><h3><Icon name="users" size={16} /> University Information</h3><button type="button" onClick={() => setEditingAccount(true)}>Edit</button></header>
                      <InfoItem label="University" value={university} />
                      <InfoItem label="Program / Department" value={department} />
                      <InfoItem label="Current Year" value={year} />
                      <InfoItem label="Roll Number" value={user?.rollNumber} />
                      <InfoItem label="Batch" value={user?.batch} />
                    </section>
                  </div>
                  <section className="settings-account-actions">
                    <h3>Account Actions</h3>
                    <div className="settings-action-grid">
                      <button type="button" onClick={() => { setDialogAction('Change Password'); setDialogValue(''); }}><Icon name="lock" size={17} /><span><strong>Change Password</strong><small>Update your account password</small></span><Icon name="chevronRight" size={16} /></button>
                      <button type="button" onClick={() => { setDialogAction('Update Email'); setDialogValue(user?.email || ''); }}><Icon name="mail" size={17} /><span><strong>Update Email</strong><small>Change your email address</small></span><Icon name="chevronRight" size={16} /></button>
                      <button type="button" onClick={() => { setDialogAction('Update Phone'); setDialogValue(user?.phone || ''); }}><Icon name="phone" size={17} /><span><strong>Update Phone</strong><small>Change your phone number</small></span><Icon name="chevronRight" size={16} /></button>
                    </div>
                  </section>
                  <section className="settings-danger-zone">
                    <div><strong>Danger Zone</strong><p>Irreversible actions. Proceed with care.</p></div>
                    <button type="button" className="btn btn-outline settings-danger-button" onClick={handleDeleteAccount}>Delete Account</button>
                  </section>
                </>
              ) : (
                <>
                  <header className="settings-panel-header"><div><h2>Account Settings</h2><p>Update your profile information and account details.</p></div></header>
                  <form onSubmit={saveProfilePreview} className="settings-profile-edit">
                    <div className="settings-photo-edit">
                      {currentAvatar ? <img src={currentAvatar} alt="Profile preview" /> : <span>{initials(currentName)}</span>}
                      <div><strong>Profile Photo</strong><small>JPG, PNG or WebP. Max size 5 MB.</small><div className="settings-photo-actions"><input ref={avatarInputRef} type="file" accept="image/*" onChange={handleAvatarChange} hidden /><button type="button" className="btn btn-primary btn-sm" onClick={() => avatarInputRef.current?.click()}><Icon name="upload" size={15} /> Upload New</button><button type="button" className="btn btn-outline btn-sm" onClick={() => setAvatarPreview('')}>Remove</button></div></div>
                    </div>
                    <h3 className="settings-form-section-title">Basic Information</h3>
                    <div className="settings-form-grid">
                      <label className="form-group"><span className="form-label">Full Name *</span><input className="form-control" required maxLength={100} value={profileForm.name} onChange={(event) => updateProfileField('name', event.target.value)} /></label>
                                            <label className="form-group"><span className="form-label">Program / Department</span><input className="form-control" value={profileForm.department} onChange={(event) => updateProfileField('department', event.target.value)} /></label>
                      <label className="form-group"><span className="form-label">Year</span><input className="form-control" value={profileForm.year} onChange={(event) => updateProfileField('year', event.target.value)} /></label>
                                            <label className="form-group settings-form-span"><span className="form-label">Bio</span><textarea className="form-control" rows={4} maxLength={250} value={profileForm.bio} onChange={(event) => updateProfileField('bio', event.target.value)} /><small className="settings-character-count">{profileForm.bio.length} / 250</small></label>
                    </div>
                    <div className="settings-form-actions"><button type="button" className="btn btn-outline" onClick={() => { setEditingAccount(false); setAvatarPreview(''); }}>Cancel</button><button type="submit" className="btn btn-primary"><Icon name="check" size={15} /> Save Changes</button></div>
                    <p className="settings-local-note">Name, bio, department and year are saved to your account. Appearance and other browser preferences are stored locally unless the server provides a corresponding setting.</p>
                  </form>
                </>
              )}
            </section>
          ) : null}

          {activeSection === 'privacy' ? (
            <section className="card settings-panel">
              <header className="settings-panel-header"><div><h2>Privacy & Visibility</h2><p>Control who can see your information and interact with you on the forum.</p></div></header>
              <div className="settings-privacy-columns">
                <section className="settings-preference-card">
                  <h3><Icon name="eye" size={17} /> Profile Visibility</h3>
                  <p>Choose who can view your profile, posts and basic information.</p>
                  {[
                    ['public', 'Public — anyone can view your profile'],
                    ['university', 'University Members Only — only registered university users'],
                    ['private', 'Private — only you can view your profile'],
                  ].map(([value, label]) => <label className="settings-radio-row" key={value}><input type="radio" name="profile-visibility" checked={preferences.privacy.visibility === value} onChange={() => updatePreference('privacy', 'visibility', value)} /><span>{label}</span></label>)}
                </section>
                <aside className="settings-privacy-callout"><Icon name="shieldCheck" size={34} /><strong>Your profile visibility is set to {preferences.privacy.visibility === 'university' ? 'University Members Only' : preferences.privacy.visibility}.</strong><small>These controls are stored locally as a frontend preview.</small></aside>
                <section className="settings-preference-card">
                  <h3><Icon name="userCheck" size={17} /> Personal Information</h3>
                  <SwitchRow label="Show email address on profile" checked={preferences.privacy.showEmail} onChange={(value) => updatePreference('privacy', 'showEmail', value)} />
                  <SwitchRow label="Show phone number on profile" checked={preferences.privacy.showPhone} onChange={(value) => updatePreference('privacy', 'showPhone', value)} />
                  <SwitchRow label="Show online status" checked={preferences.privacy.onlineStatus} onChange={(value) => updatePreference('privacy', 'onlineStatus', value)} />
                  <SwitchRow label="Show recent activity" description="Posts, comments and events" checked={preferences.privacy.activity} onChange={(value) => updatePreference('privacy', 'activity', value)} />
                </section>
                <section className="settings-preference-card">
                  <h3><Icon name="users" size={17} /> Interaction Permissions</h3>
                  <label className="settings-select-row"><span>Who can send you messages?</span><select className="form-control" value={preferences.privacy.messagePermission} onChange={(event) => updatePreference('privacy', 'messagePermission', event.target.value)}><option value="everyone">Everyone</option><option value="university">University Members</option><option value="following">People I Follow</option><option value="nobody">Nobody</option></select></label>
                  <label className="settings-select-row"><span>Who can follow you?</span><select className="form-control" value={preferences.privacy.followPermission} onChange={(event) => updatePreference('privacy', 'followPermission', event.target.value)}><option value="everyone">Everyone</option><option value="university">University Members</option><option value="nobody">Nobody</option></select></label>
                  <label className="settings-select-row"><span>Who can mention you in discussions?</span><select className="form-control" value={preferences.privacy.mentionPermission} onChange={(event) => updatePreference('privacy', 'mentionPermission', event.target.value)}><option value="everyone">Everyone</option><option value="university">University Members</option><option value="following">People I Follow</option><option value="nobody">Nobody</option></select></label>
                </section>
              </div>
              <div className="settings-form-actions"><button type="button" className="btn btn-outline" onClick={resetPreferences}>Reset to Default</button><button type="button" className="btn btn-primary" onClick={savePreferences}><Icon name="check" size={15} /> Save Changes</button></div>
            </section>
          ) : null}

          {activeSection === 'notifications' ? (
            <section className="card settings-panel">
              <header className="settings-panel-header"><div><h2>Notifications</h2><p>Manage what updates you want to see in the forum.</p></div><Link to="/notifications" className="btn btn-outline btn-sm">Open Notification Center</Link></header>
              <div className="settings-preference-card">
                <h3><Icon name="bell" size={17} /> Notification Settings</h3>
                <p>Choose the notification categories and channels shown in this browser.</p>
                <SwitchRow label="Push Notifications" checked={preferences.notifications.push} onChange={(value) => updatePreference('notifications', 'push', value)} />
                <SwitchRow label="Email Notifications" checked={preferences.notifications.email} onChange={(value) => updatePreference('notifications', 'email', value)} />
                <SwitchRow label="Community Updates" checked={preferences.notifications.community} onChange={(value) => updatePreference('notifications', 'community', value)} />
                <SwitchRow label="Event Reminders" checked={preferences.notifications.events} onChange={(value) => updatePreference('notifications', 'events', value)} />
                <SwitchRow label="Activity on My Posts" checked={preferences.notifications.activity} onChange={(value) => updatePreference('notifications', 'activity', value)} />
                <SwitchRow label="Mentions & Replies" checked={preferences.notifications.mentions} onChange={(value) => updatePreference('notifications', 'mentions', value)} />
              </div>
              <div className="settings-form-actions"><button type="button" className="btn btn-primary" onClick={savePreferences}>Save Changes</button></div>
              <p className="settings-local-note">Notification preferences are a frontend preview. Delivery settings are not sent to a server.</p>
            </section>
          ) : null}

          {activeSection === 'appearance' ? (
            <section className="card settings-panel">
              <header className="settings-panel-header"><div><h2>Appearance</h2><p>Customize the look and feel of your forum experience.</p></div></header>
              <h3 className="settings-subheading">Theme Color</h3>
              <p className="settings-help-copy">Choose your preferred accent color. It will update across the entire platform.</p>
              <div className="settings-theme-grid">
                {[
                  { key: 'green', label: 'Forest Green', color: '#087447' },
                  { key: 'blue', label: 'Royal Blue', color: '#2563eb' },
                  { key: 'purple', label: 'Deep Purple', color: '#7436b8' },
                  { key: 'teal', label: 'Teal', color: '#0d9488' },
                  { key: 'amber', label: 'Amber', color: '#d97706' },
                  { key: 'crimson', label: 'Crimson', color: '#dc2626' },
                ].map((theme) => <button type="button" key={theme.key} className={preferences.appearance.accent === theme.key ? 'settings-theme-option active' : 'settings-theme-option'} onClick={() => updatePreference('appearance', 'accent', theme.key)}><span style={{ background: theme.color }} /><strong>{theme.label}</strong>{preferences.appearance.accent === theme.key ? <Icon name="checkCircle2" size={16} /> : null}</button>)}
              </div>
              <h3 className="settings-subheading">Display Mode</h3>
              <div className="settings-mode-grid">
                {[['light', 'Light', 'sun'], ['dark', 'Dark', 'moon'], ['system', 'System', 'monitor']].map(([key, label, icon]) => <button type="button" key={key} className={preferences.appearance.mode === key ? 'settings-mode-option active' : 'settings-mode-option'} onClick={() => updatePreference('appearance', 'mode', key)}><span><Icon name={icon} size={20} /></span><strong>{label}</strong>{preferences.appearance.mode === key ? <Icon name="checkCircle2" size={17} /> : null}</button>)}
              </div>
              <div className="settings-appearance-row"><strong>Font Size</strong><div className="settings-choice-group">{['small', 'medium', 'large'].map((size) => <button type="button" key={size} className={preferences.appearance.fontSize === size ? 'active' : ''} onClick={() => updatePreference('appearance', 'fontSize', size)}>{size[0].toUpperCase() + size.slice(1)}</button>)}</div></div>
              <SwitchRow label="Compact View" description="Show more content in less space." checked={preferences.appearance.compact} onChange={(value) => updatePreference('appearance', 'compact', value)} />
              <SwitchRow label="Animations" description="Enable smooth transitions and interface animations." checked={preferences.appearance.animations} onChange={(value) => updatePreference('appearance', 'animations', value)} />
              <div className="settings-form-actions"><button type="button" className="btn btn-primary" onClick={savePreferences}><Icon name="check" size={15} /> Save Changes</button><button type="button" className="btn btn-outline" onClick={() => setPreferences((current) => ({ ...current, appearance: savedPreferences.appearance }))}>Cancel</button></div>
            </section>
          ) : null}

          {activeSection === 'security' ? (
            <section className="card settings-panel">
              <header className="settings-panel-header"><div><h2>Security</h2><p>Review your account security options.</p></div></header>
              <div className="settings-security-card"><Icon name="lock" size={24} /><div><strong>Password</strong><p>Keep your password private and update it regularly.</p></div><button type="button" className="btn btn-outline btn-sm" onClick={() => { setDialogAction('Change Password'); setDialogValue(''); }}>Change Password</button></div>
              <SwitchRow label="Two-factor authentication" description="Preview the additional verification option for your account." checked={preferences.security.twoFactor} onChange={(value) => updatePreference('security', 'twoFactor', value)} />
              <div className="settings-readonly-note"><Icon name="shieldCheck" size={18} /><span>Security changes are not connected to an authentication service in this frontend-only phase.</span></div>
              <div className="settings-form-actions"><button type="button" className="btn btn-primary" onClick={savePreferences}>Save Changes</button></div>
            </section>
          ) : null}

          {activeSection === 'connections' ? (
            <section className="card settings-panel">
              <header className="settings-panel-header"><div><h2>Connected Accounts</h2><p>Manage external sign-in connections.</p></div></header>
              {['google', 'microsoft'].map((provider) => <div className="settings-connection-row" key={provider}><div className={'settings-provider-mark ' + provider}>{provider === 'google' ? 'G' : 'M'}</div><div><strong>{provider === 'google' ? 'Google' : 'Microsoft'}</strong><small>{preferences.connections[provider] ? 'Marked as connected in this browser' : 'Not connected'}</small></div><button type="button" className="btn btn-outline btn-sm" onClick={() => updatePreference('connections', provider, !preferences.connections[provider])}>{preferences.connections[provider] ? 'Disconnect' : 'Connect'}</button></div>)}
              <p className="settings-local-note">Connection buttons update only this local preview. No external account is linked.</p>
            </section>
          ) : null}

          {activeSection === 'data' ? (
            <section className="card settings-panel">
              <header className="settings-panel-header"><div><h2>Data & Privacy</h2><p>Review and export the preferences stored by this frontend.</p></div></header>
              <div className="settings-data-action"><div><strong>Export local settings</strong><p>Download the profile preview and preferences stored in this browser.</p></div><button type="button" className="btn btn-outline" onClick={exportPreferences}><Icon name="download" size={16} /> Export Data</button></div>
              <div className="settings-data-action"><div><strong>Clear local settings</strong><p>Remove the local preferences and profile preview created by this page.</p></div><button type="button" className="btn btn-outline settings-danger-button" onClick={() => { localStorage.removeItem('guf-settings-preferences'); localStorage.removeItem('guf-profile-preview'); resetPreferences(); }}>Clear Local Data</button></div>
              <p className="settings-local-note">This page does not request, download or delete server-side account data.</p>
            </section>
          ) : null}

          {activeSection === 'communities' ? (
            <section className="card settings-panel">
              <header className="settings-panel-header"><div><h2>Manage Communities</h2><p>Open your communities to manage membership and community details.</p></div><Link to="/communities" className="btn btn-primary btn-sm">Browse Communities <Icon name="arrowRight" size={15} /></Link></header>
              <div className="settings-navigation-card"><Icon name="users" size={25} /><div><strong>Your community workspace</strong><p>Community membership, roles, and management actions are available from each community page.</p></div><Link to="/communities">Open Communities</Link></div>
            </section>
          ) : null}

          {activeSection === 'moderation' ? (
            <section className="card settings-panel">
              <header className="settings-panel-header"><div><h2>Moderation & Rules</h2><p>Review moderation and posting permissions for communities you manage.</p></div></header>
              <div className="settings-navigation-card"><Icon name="shieldCheck" size={25} /><div><strong>Community permissions</strong><p>Open a community and use its Permissions, Audit Logs and Settings tabs to review rules and moderation controls.</p></div><Link to="/communities">View Communities</Link></div>
            </section>
          ) : null}

          {activeSection === 'language' ? (
            <section className="card settings-panel">
              <header className="settings-panel-header"><div><h2>Language & Region</h2><p>Choose the display language and regional time zone for this browser.</p></div></header>
              <label className="settings-select-row"><span>Language</span><select className="form-control" value={preferences.language.language} onChange={(event) => updatePreference('language', 'language', event.target.value)}><option>English</option><option>Hindi</option></select></label>
              <label className="settings-select-row"><span>Time Zone</span><select className="form-control" value={preferences.language.timezone} onChange={(event) => updatePreference('language', 'timezone', event.target.value)}><option value="Asia/Kolkata">India Standard Time (UTC+05:30)</option><option value="UTC">UTC</option><option value="Europe/London">London</option><option value="America/New_York">Eastern Time</option></select></label>
              <div className="settings-form-actions"><button type="button" className="btn btn-primary" onClick={savePreferences}>Save Changes</button></div>
            </section>
          ) : null}

          {activeSection === 'accessibility' ? (
            <section className="card settings-panel">
              <header className="settings-panel-header"><div><h2>Accessibility</h2><p>Adjust interface options for easier navigation and reading.</p></div></header>
              <SwitchRow label="High Contrast" description="Increase contrast between text and surfaces." checked={preferences.accessibility.highContrast} onChange={(value) => updatePreference('accessibility', 'highContrast', value)} />
              <SwitchRow label="Reduce Motion" description="Limit interface animation and motion effects." checked={preferences.accessibility.reducedMotion} onChange={(value) => updatePreference('accessibility', 'reducedMotion', value)} />
              <SwitchRow label="Keyboard Hints" description="Show keyboard shortcut hints where available." checked={preferences.accessibility.keyboardHints} onChange={(value) => updatePreference('accessibility', 'keyboardHints', value)} />
              <div className="settings-form-actions"><button type="button" className="btn btn-primary" onClick={savePreferences}>Save Changes</button></div>
            </section>
          ) : null}

          {activeSection === 'help' ? (
            <section className="card settings-panel">
              <header className="settings-panel-header"><div><h2>About & Help</h2><p>Find your way around the university discussion forum.</p></div></header>
              <div className="settings-about-card"><strong>Geeta University Discussion Forum</strong><span>Campus community workspace</span></div>
              <div className="settings-help-list">
                {[['getting-started', 'Getting started', 'Use the sidebar to browse discussions, communities, events and people.'], ['communities', 'Communities and permissions', 'Community pages contain discussions, members, resources, permissions, audit logs and settings.'], ['account', 'Account and privacy', 'Use Account Settings and Privacy & Visibility to review your local profile preview and display preferences.']].map(([key, title, copy]) => <section key={key}><button type="button" onClick={() => setShowHelpTopic((current) => current === key ? '' : key)}><strong>{title}</strong><Icon name={showHelpTopic === key ? 'chevronDown' : 'chevronRight'} size={16} /></button>{showHelpTopic === key ? <p>{copy}</p> : null}</section>)}
              </div>
            </section>
          ) : null}
        </main>
      </div>

      {dialogAction ? (
        <div className="modal-overlay" role="presentation" onClick={(event) => { if (event.target === event.currentTarget) setDialogAction(''); }}>
          <section className="modal-card settings-action-dialog" role="dialog" aria-modal="true" aria-label={dialogAction}>
            <header><h2>{dialogAction}</h2><button type="button" className="btn-icon" onClick={() => setDialogAction('')} aria-label="Close"><Icon name="x" size={18} /></button></header>
            <form onSubmit={updateDialog}>
              <p>This is a frontend-only preview. Enter a value to test the form interaction; nothing will be sent to a server.</p>
              {dialogAction === 'Change Password' ? <><label className="form-group"><span className="form-label">Current Password</span><input className="form-control" type="password" required /></label><label className="form-group"><span className="form-label">New Password</span><input className="form-control" type="password" minLength={8} required /></label></> : <label className="form-group"><span className="form-label">{dialogAction === 'Update Email' ? 'Email Address' : 'Phone Number'}</span><input className="form-control" value={dialogValue} onChange={(event) => setDialogValue(event.target.value)} required type={dialogAction === 'Update Email' ? 'email' : 'tel'} /></label>}
              <footer><button type="button" className="btn btn-outline" onClick={() => setDialogAction('')}>Cancel</button><button type="submit" className="btn btn-primary">Save Preview</button></footer>
            </form>
          </section>
        </div>
      ) : null}
    </div>
  );
};

export default SettingsPage;

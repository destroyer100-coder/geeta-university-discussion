import React, { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { usersApi } from '../../services/api';
import { PostCard } from '../../components/post/PostCard';
import { Icon } from '../../components/common/Icons';

const getInitials = (name = '') => name.trim().split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]).join('').toUpperCase() || 'U';
const readProfilePreview = () => {
  try { return JSON.parse(localStorage.getItem('guf-profile-action-preview') || '{}'); } catch { return {}; }
};
const readLocalPosts = (id) => {
  try {
    return JSON.parse(localStorage.getItem('guf-local-post-preview') || '[]')
      .filter((post) => String(post.author?._id || post.author || '') === String(id || ''));
  } catch {
    return [];
  }
};
const readPostActionPreview = () => {
  try { return JSON.parse(localStorage.getItem('guf-post-action-preview') || '{}'); } catch { return {}; }
};
const writeProfilePreview = (id, patch) => {
  const store = readProfilePreview();
  store[String(id)] = { ...(store[String(id)] || {}), ...patch };
  try { localStorage.setItem('guf-profile-action-preview', JSON.stringify(store)); } catch { /* Keep this session interactive. */ }
};

export const ProfilePage = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user: currentUser, logout } = useAuth();

  const [profileData, setProfileData] = useState(null);
  const [userPosts, setUserPosts] = useState([]);
  const [userComments, setUserComments] = useState([]);
  const [savedPosts, setSavedPosts] = useState([]);
  const [activeTab, setActiveTab] = useState('posts'); // 'posts' | 'comments' | 'communities' | 'about' | 'saved'
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [errorNotice, setErrorNotice] = useState(null);

  // Edit Profile Modal State
  const [showEditModal, setShowEditModal] = useState(false);
  const [editName, setEditName] = useState('');
  const [editBio, setEditBio] = useState('');
  const [editDepartment, setEditDepartment] = useState('');
  const [editYear, setEditYear] = useState('');
  const [editAvatar, setEditAvatar] = useState('');
  const [savingProfile, setSavingProfile] = useState(false);

  // Target User ID: if no id or 'me', use currentUser
  const targetUserId = !id || id === 'me' || id === 'user' ? currentUser?._id : id;

  const loadProfile = async () => {
    if (!targetUserId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setErrorNotice(null);
    if (currentUser?.isGuestPreview && String(currentUser._id) === String(targetUserId)) {
      const localPreview = readProfilePreview()[String(targetUserId)] || {};
      const guestProfile = { ...currentUser, ...localPreview };
      setProfileData(guestProfile);
      setUserPosts(readLocalPosts(targetUserId));
      setUserComments([]);
      setEditName(guestProfile.name || 'Guest');
      setEditBio(guestProfile.bio || '');
      setEditDepartment(guestProfile.department || '');
      setEditYear(guestProfile.year || '');
      setEditAvatar(guestProfile.avatar || '');
      setLoading(false);
      return;
    }
    try {
      const res = await usersApi.getProfile(targetUserId);
      if (res.success && res.data) {
        const followingIds = (() => { try { return JSON.parse(localStorage.getItem('guf-following-preview') || '[]'); } catch { return []; } })();
        const localPreview = readProfilePreview()[String(targetUserId)] || {};
        setProfileData({ ...res.data, ...localPreview, ...(followingIds.includes(String(targetUserId)) ? { isFollowing: true } : (localPreview.isFollowing === false ? { isFollowing: false } : {})) });
        const localPosts = readLocalPosts(targetUserId);
        const serverPosts = res.data.posts || [];
        const serverIds = new Set(serverPosts.map((post) => String(post._id)));
        setUserPosts([...localPosts.filter((post) => !serverIds.has(String(post._id))), ...serverPosts]);
        setUserComments(res.data.comments || []);
        setEditName(res.data.name || '');
        setEditBio(res.data.bio || '');
        setEditDepartment(res.data.department || '');
        setEditYear(res.data.year || '');
        setEditAvatar(res.data.avatar || '');
      }
    } catch (err) {
      console.error('Failed to load profile:', err);
      const localPosts = readLocalPosts(targetUserId);
      if (currentUser && String(currentUser._id) === String(targetUserId)) {
        const localPreview = readProfilePreview()[String(targetUserId)] || {};
        const fallbackProfile = { ...currentUser, ...localPreview };
        setProfileData(fallbackProfile);
        setUserPosts(localPosts);
        setEditName(fallbackProfile.name || '');
        setEditBio(fallbackProfile.bio || '');
        setEditDepartment(fallbackProfile.department || '');
        setEditYear(fallbackProfile.year || '');
        setEditAvatar(fallbackProfile.avatar || '');
      }
      setErrorNotice(err.message || 'Profile service unavailable; showing local profile previews where available.');
    } finally {
      setLoading(false);
    }
  };

  const loadSavedPosts = async () => {
    let serverPosts = [];
    try {
      const response = await usersApi.getSaved();
      if (response.success && Array.isArray(response.data)) serverPosts = response.data;
    } catch (error) {
      console.error('Failed to load server saved posts:', error);
    }
    const localPosts = readLocalPosts(targetUserId);
    const actionMap = readPostActionPreview();
    const locallySaved = localPosts.map((post) => ({ ...post, ...(actionMap[String(post._id)] || {}) })).filter((post) => post.isSaved);
    const serverIds = new Set(serverPosts.map((post) => String(post._id)));
    setSavedPosts([...locallySaved.filter((post) => !serverIds.has(String(post._id))), ...serverPosts]);
  };

  useEffect(() => {
    loadProfile();
  }, [targetUserId, currentUser]);

  useEffect(() => {
    if (activeTab === 'saved' && isOwnProfile) {
      loadSavedPosts();
    }
  }, [activeTab]);

  const isOwnProfile = Boolean(
    currentUser &&
      profileData &&
      (currentUser._id?.toString() === profileData._id?.toString() ||
        currentUser.email === profileData.email)
  );

  // Follow, mute and block are local browser previews in this frontend phase.
  const handleToggleFollow = () => {
    if (!currentUser || !profileData) {
      setErrorNotice('Sign in to preview follow actions.');
      return;
    }
    const following = !profileData.isFollowing;
    const patch = {
      isFollowing: following,
      followersCount: Math.max(0, Number(profileData.followersCount || 0) + (following ? 1 : -1)),
    };
    setProfileData((prev) => ({ ...prev, ...patch }));
    writeProfilePreview(profileData._id, patch);
    const followingIds = (() => { try { return JSON.parse(localStorage.getItem('guf-following-preview') || '[]'); } catch { return []; } })();
    const nextFollowing = following ? [...new Set([...followingIds, String(profileData._id)])] : followingIds.filter((value) => value !== String(profileData._id));
    try { localStorage.setItem('guf-following-preview', JSON.stringify(nextFollowing)); } catch { /* current profile state remains updated */ }
  };

  const handleToggleBlock = () => {
    if (!currentUser || !profileData) return;
    const patch = { isBlocked: !profileData.isBlocked };
    setProfileData((prev) => ({ ...prev, ...patch }));
    writeProfilePreview(profileData._id, patch);
    setErrorNotice(patch.isBlocked ? 'Blocked in this browser preview only.' : 'Unblocked in this browser preview only.');
  };

  const handleToggleMute = () => {
    if (!currentUser || !profileData) return;
    const patch = { isMuted: !profileData.isMuted };
    setProfileData((prev) => ({ ...prev, ...patch }));
    writeProfilePreview(profileData._id, patch);
    setErrorNotice(patch.isMuted ? 'Muted in this browser preview only.' : 'Unmuted in this browser preview only.');
  };

  // Profile edits update this screen and browser-local preview storage only.
  const handleSaveProfile = (event) => {
    event.preventDefault();
    if (!profileData) return;
    setSavingProfile(true);
    const patch = {
      name: editName.trim(),
      bio: editBio,
      department: editDepartment,
      year: editYear,
      avatar: editAvatar,
    };
    setProfileData((prev) => ({ ...prev, ...patch }));
    writeProfilePreview(profileData._id, patch);
    if (isOwnProfile) {
      try { localStorage.setItem('guf-profile-preview', JSON.stringify(patch)); } catch { /* Session state remains updated. */ }
    }
    setShowEditModal(false);
    setErrorNotice('Profile changes are saved in this browser preview only.');
    setSavingProfile(false);
  };

  // Copy Profile Link
  const handleShareProfile = async () => {
    const url = window.location.origin + `/profile/${profileData._id}`;
    try {
      await navigator.clipboard?.writeText?.(url);
      setErrorNotice('Profile link copied.');
    } catch {
      setErrorNotice(url);
    }
  };

  // Direct Message action
  const handleSendMessage = () => {
    navigate(`/messages?user=${profileData._id}`, { state: { selectedUser: profileData } });
  };

  // Destructive account actions are disabled during frontend-only review.
  const handleDeleteAccount = () => {
    setErrorNotice('Account deletion is disabled in this frontend-only phase. No account data was changed.');
  };

  if (loading) {
    return <div style={{ textAlign: 'center', padding: '60px', color: 'var(--text-muted)' }}>Loading member profile...</div>;
  }

  if (errorNotice || !profileData) {
    return (
      <div className="card" style={{ padding: '40px', textAlign: 'center', margin: '40px auto', maxWidth: '600px' }}>
        <div style={{ fontSize: '3rem', marginBottom: '12px' }}>🔒</div>
        <h2 style={{ fontSize: '1.3rem', fontWeight: 800, marginBottom: '8px' }}>Profile Unavailable</h2>
        <p style={{ color: 'var(--text-muted)', marginBottom: '16px' }}>
          {errorNotice || 'This profile is deleted or restricted by user block settings.'}
        </p>
        <Link to="/" className="btn btn-primary">
          Back to Discussions
        </Link>
      </div>
    );
  }

  return (
    <div className="page-shell page-profile">
      {/* Profile Header Card */}
      <div className="card" style={{ padding: '0', overflow: 'hidden', marginBottom: '20px' }}>
        {/* Cover Banner */}
        <div className="profile-cover">
          <div style={{ position: 'absolute', top: 16, right: 20, display: 'flex', gap: '8px' }}>
            <button
              onClick={handleShareProfile}
              className="btn btn-sm"
              style={{
                background: 'rgba(255, 255, 255, 0.2)',
                color: '#ffffff',
                border: '1px solid rgba(255, 255, 255, 0.4)',
                backdropFilter: 'blur(4px)',
              }}
              title="Share profile"
            >
              <Icon name="share2" size={14} color="#ffffff" />
              <span>Share</span>
            </button>
          </div>
        </div>

        {/* Profile Info Container */}
        <div style={{ padding: '0 24px 24px', position: 'relative' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginTop: '-50px', marginBottom: '16px', flexWrap: 'wrap', gap: '16px' }}>
            {/* Avatar */}
            <div style={{ position: 'relative' }}>
              {profileData.avatar ? (
                <img
                  src={profileData.avatar}
                  alt={profileData.name || ''}
                  loading="lazy"
                  decoding="async"
                  className="profile-main-avatar"
                />
              ) : (
                <span className="profile-main-avatar profile-avatar-initials" aria-hidden="true">
                  {getInitials(profileData.name)}
                </span>
              )}
            </div>

            {/* Action Buttons Bar */}
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
              {!isOwnProfile ? (
                <>
                  <button
                    className={`btn ${profileData.isFollowing ? 'btn-secondary' : 'btn-primary'}`}
                    onClick={handleToggleFollow}
                    disabled={actionLoading}
                    style={{ fontWeight: 700 }}
                  >
                    {profileData.isFollowing ? '✓ Following' : '+ Follow'}
                  </button>

                  <button
                    className="btn btn-secondary"
                    onClick={handleSendMessage}
                    style={{ fontWeight: 600 }}
                  >
                    <Icon name="messageSquare" size={14} />
                    <span>Message</span>
                  </button>

                  <button
                    className="btn btn-secondary btn-sm"
                    onClick={handleToggleMute}
                    disabled={actionLoading}
                    title={profileData.isMuted ? 'Unmute posts' : 'Mute posts'}
                  >
                    {profileData.isMuted ? 'Unmute' : 'Mute'}
                  </button>

                  <button
                    className="btn btn-secondary btn-sm"
                    style={{ color: '#ef4444' }}
                    onClick={handleToggleBlock}
                    disabled={actionLoading}
                    title="Block this user"
                  >
                    {profileData.isBlocked ? 'Unblock' : 'Block'}
                  </button>
                </>
              ) : (
                <>
                  <button
                    className="btn btn-secondary"
                    onClick={() => setShowEditModal(true)}
                    style={{ fontWeight: 600 }}
                  >
                    <Icon name="edit3" size={14} />
                    <span>Edit Profile</span>
                  </button>
                  <button
                    className="btn btn-outline btn-sm"
                    style={{ color: '#ef4444', borderColor: '#fca5a5' }}
                    onClick={handleDeleteAccount}
                    disabled={actionLoading}
                  >
                    Delete Account
                  </button>
                </>
              )}
            </div>
          </div>

          {/* User Details */}
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
              <h1 style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--text-main)' }}>
                {profileData.name}
              </h1>
              {profileData.verified && <Icon name="checkCircle2" size={20} color="#3b82f6" />}
              <span className="badge badge-primary" style={{ textTransform: 'capitalize' }}>
                {profileData.role || 'Student'}
              </span>
            </div>

            <div style={{ fontSize: '0.9rem', color: 'var(--text-muted)', marginTop: '4px', fontWeight: 500 }}>
              {profileData.department || 'Geeta University'} {profileData.year ? `• ${profileData.year}` : ''}
            </div>

            <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', marginTop: '10px', maxWidth: '640px', lineHeight: 1.5 }}>
              {profileData.bio || 'No biography has been added.'}
            </p>

            {/* Counts Bar */}
            <div style={{ display: 'flex', gap: '20px', marginTop: '14px', fontSize: '0.85rem', color: 'var(--text-muted)', flexWrap: 'wrap' }}>
              <span>
                <strong style={{ color: 'var(--text-main)', fontSize: '0.95rem' }}>{profileData.followersCount || 0}</strong> Followers
              </span>
              <span>
                <strong style={{ color: 'var(--text-main)', fontSize: '0.95rem' }}>{profileData.followingCount || 0}</strong> Following
              </span>
              <span>
                <strong style={{ color: 'var(--text-main)', fontSize: '0.95rem' }}>{userPosts.length}</strong> Recent Discussions
              </span>
              <span>
                <strong style={{ color: 'var(--text-main)', fontSize: '0.95rem' }}>{userComments.length}</strong> Recent Answers
              </span>
            </div>
          </div>
        </div>

        {/* Profile Tabs Navigation */}
        <div style={{ display: 'flex', borderTop: '1px solid var(--border-color)', padding: '0 16px', background: 'var(--bg-card)' }}>
          {[
            { key: 'posts', label: `Discussions (${userPosts.length})` },
            { key: 'comments', label: `Comments & Answers (${userComments.length})` },
            { key: 'communities', label: `Communities (${profileData.communities?.length || 0})` },
            { key: 'about', label: 'About & Activity' },
            ...(isOwnProfile ? [{ key: 'saved', label: 'Saved' }] : []),
          ].map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              style={{
                padding: '14px 18px',
                border: 'none',
                background: 'transparent',
                fontWeight: activeTab === tab.key ? 700 : 500,
                color: activeTab === tab.key ? 'var(--primary)' : 'var(--text-muted)',
                borderBottom: activeTab === tab.key ? '2px solid var(--primary)' : '2px solid transparent',
                cursor: 'pointer',
                fontSize: '0.875rem',
                whiteSpace: 'nowrap',
              }}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      <div className="profile-workspace">
        <main className="profile-main-content">
      {/* Tab Panels */}
      {/* 1. Discussions Tab */}
      {activeTab === 'posts' && (
        <div>
          {userPosts.length === 0 ? (
            <div className="card" style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>
              <div style={{ fontSize: '2rem', marginBottom: '8px' }}>📝</div>
              <h3>No discussions posted yet</h3>
              <p style={{ fontSize: '0.85rem', marginTop: '6px' }}>
                {isOwnProfile ? 'Start your first discussion to share resources with the university.' : 'This user hasn\'t posted any discussions yet.'}
              </p>
            </div>
          ) : (
            userPosts.map((p) => <PostCard key={p._id} post={p} onPostUpdated={loadProfile} />)
          )}
        </div>
      )}

      {/* 2. Comments & Answers Tab */}
      {activeTab === 'comments' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          {userComments.length === 0 ? (
            <div className="card" style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>
              <div style={{ fontSize: '2rem', marginBottom: '8px' }}>💬</div>
              <h3>No comments or answers yet</h3>
              <p style={{ fontSize: '0.85rem', marginTop: '6px' }}>
                Comments and answers posted in discussions will appear here.
              </p>
            </div>
          ) : (
            userComments.map((comm) => (
              <div key={comm._id} className="card" style={{ padding: '18px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                    Commented on discussion:{' '}
                    <Link
                      to={`/discussions/${comm.post?._id}`}
                      style={{ fontWeight: 700, color: 'var(--primary)', textDecoration: 'none' }}
                    >
                      {comm.post?.title || 'View Discussion'}
                    </Link>
                  </div>
                  <span style={{ fontSize: '0.725rem', color: 'var(--text-muted)' }}>
                    {new Date(comm.createdAt).toLocaleDateString()}
                  </span>
                </div>

                <div
                  style={{
                    fontSize: '0.9rem',
                    lineHeight: 1.5,
                    color: 'var(--text-main)',
                    background: 'var(--bg-muted)',
                    padding: '12px 14px',
                    borderRadius: 'var(--radius-sm)',
                    whiteSpace: 'pre-line',
                  }}
                >
                  {comm.body}
                </div>

                {comm.isAccepted && (
                  <div style={{ marginTop: '8px' }}>
                    <span className="badge badge-success" style={{ fontSize: '0.7rem' }}>
                      ✓ Marked as Accepted Answer
                    </span>
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      )}

      {/* 3. Communities Tab (Scoped Community Roles) */}
      {activeTab === 'communities' && (
        <div>
          {(!profileData.communities || profileData.communities.length === 0) ? (
            <div className="card" style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>
              <div style={{ fontSize: '2rem', marginBottom: '8px' }}>👥</div>
              <h3>No communities joined yet</h3>
              <p style={{ fontSize: '0.85rem', marginTop: '6px' }}>
                {isOwnProfile ? (
                  <Link to="/communities" className="btn btn-primary btn-sm" style={{ marginTop: '8px' }}>
                    Explore Communities
                  </Link>
                ) : 'This user is not a member of any public communities.'}
              </p>
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(min(300px, 100%), 1fr))', gap: '16px' }}>
              {profileData.communities.map((comm) => {
                const role = comm.communityRole || 'member';
                return (
                  <div key={comm._id} className="card" style={{ padding: '16px', display: 'flex', gap: '12px', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div style={{ display: 'flex', gap: '12px', alignItems: 'center', minWidth: 0 }}>
                      {comm.avatar ? (
                        <img src={comm.avatar} alt="" loading="lazy" decoding="async" className="profile-community-avatar" />
                      ) : (
                        <span className="profile-community-avatar profile-community-initials" aria-hidden="true">{getInitials(comm.name)}</span>
                      )}
                      <div style={{ minWidth: 0 }}>
                        <h3 style={{ fontSize: '0.95rem', fontWeight: 700, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          <Link to={`/communities/${comm.slug || comm._id}`}>{comm.name}</Link>
                        </h3>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                          {comm.memberCount || 0} members
                        </div>
                      </div>
                    </div>

                    <div>
                      {role === 'owner' && (
                        <span className="badge badge-primary" style={{ fontSize: '0.725rem', whiteSpace: 'nowrap' }}>
                          👑 Head
                        </span>
                      )}
                      {role === 'moderator' && (
                        <span className="badge badge-success" style={{ fontSize: '0.725rem', whiteSpace: 'nowrap' }}>
                          🛡️ Moderator
                        </span>
                      )}
                      {role === 'member' && (
                        <span className="badge badge-muted" style={{ fontSize: '0.725rem', whiteSpace: 'nowrap' }}>
                          👤 Member
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* 4. Activity & About Tab */}
      {activeTab === 'about' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
          <div className="card" style={{ padding: '24px' }}>
            <h2 style={{ fontSize: '1.1rem', fontWeight: 800, marginBottom: '16px' }}>Academic Overview</h2>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(min(240px, 100%), 1fr))', gap: '16px', marginBottom: '20px' }}>
              <div style={{ padding: '14px', background: 'var(--bg-muted)', borderRadius: 'var(--radius-sm)' }}>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600 }}>DEPARTMENT</div>
                <div style={{ fontSize: '0.95rem', fontWeight: 700, marginTop: '4px' }}>{profileData.department || 'Not specified'}</div>
              </div>
              <div style={{ padding: '14px', background: 'var(--bg-muted)', borderRadius: 'var(--radius-sm)' }}>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600 }}>UNIVERSITY ROLE / YEAR</div>
                <div style={{ fontSize: '0.95rem', fontWeight: 700, marginTop: '4px' }}>{profileData.year || profileData.role || 'Member'}</div>
              </div>
              <div style={{ padding: '14px', background: 'var(--bg-muted)', borderRadius: 'var(--radius-sm)' }}>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600 }}>VERIFICATION STATUS</div>
                <div style={{ fontSize: '0.95rem', fontWeight: 700, color: '#059669', marginTop: '4px' }}>
                  {profileData.verified ? '✓ Official University ID Verified' : 'Registered Member'}
                </div>
              </div>
              <div style={{ padding: '14px', background: 'var(--bg-muted)', borderRadius: 'var(--radius-sm)' }}>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600 }}>MEMBER SINCE</div>
                <div style={{ fontSize: '0.95rem', fontWeight: 700, marginTop: '4px' }}>
                  {profileData.createdAt ? new Date(profileData.createdAt).toLocaleDateString('en-US', { month: 'long', year: 'numeric' }) : 'Not available'}
                </div>
              </div>
            </div>

            <h3 style={{ fontSize: '0.95rem', fontWeight: 700, marginBottom: '8px' }}>About Me</h3>
            <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', lineHeight: 1.6 }}>
              {profileData.bio || 'No biography has been added.'}
            </p>
          </div>

          {/* Recent Activity Timeline */}
          <div className="card" style={{ padding: '24px' }}>
            <h3 style={{ fontSize: '1.05rem', fontWeight: 800, marginBottom: '16px' }}>Recent Activity Timeline</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {userPosts.slice(0, 3).map((p) => (
                <div key={p._id} style={{ display: 'flex', alignItems: 'center', gap: '12px', fontSize: '0.85rem' }}>
                  <span style={{ fontSize: '1.2rem' }}>📝</span>
                  <div style={{ flex: 1 }}>
                    <span>Published discussion: </span>
                    <Link to={`/discussions/${p._id}`} style={{ fontWeight: 700, color: 'var(--primary)' }}>
                      {p.title}
                    </Link>
                  </div>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                    {new Date(p.createdAt).toLocaleDateString()}
                  </span>
                </div>
              ))}
              {userComments.slice(0, 3).map((c) => (
                <div key={c._id} style={{ display: 'flex', alignItems: 'center', gap: '12px', fontSize: '0.85rem' }}>
                  <span style={{ fontSize: '1.2rem' }}>💬</span>
                  <div style={{ flex: 1 }}>
                    <span>Answered in: </span>
                    <Link to={`/discussions/${c.post?._id}`} style={{ fontWeight: 700, color: 'var(--primary)' }}>
                      {c.post?.title || 'Discussion'}
                    </Link>
                  </div>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                    {new Date(c.createdAt).toLocaleDateString()}
                  </span>
                </div>
              ))}
              {userPosts.length === 0 && userComments.length === 0 && (
                <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>No recent activity to display.</p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* 5. Saved Discussions Tab (Own profile only) */}
      {activeTab === 'saved' && isOwnProfile && (
        <div>
          {savedPosts.length === 0 ? (
            <div className="card" style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>
              <div style={{ fontSize: '2rem', marginBottom: '8px' }}>🔖</div>
              <h3>No saved discussions</h3>
              <p style={{ fontSize: '0.85rem', marginTop: '6px' }}>
                Click the bookmark icon on any discussion to save it for quick reference later.
              </p>
            </div>
          ) : (
            savedPosts.map((p) => <PostCard key={p._id} post={p} onPostUpdated={loadSavedPosts} />)
          )}
        </div>
      )}


        </main>
        <aside className="profile-side">
          <section className="card profile-side-card">
            <header className="profile-side-heading"><h2><Icon name="barChart2" size={18} /> Profile Overview</h2></header>
            <div className="profile-overview-grid">
              <div><strong>{userPosts.length}</strong><span>Recent Posts</span></div>
              <div><strong>{userComments.length}</strong><span>Recent Comments</span></div>
              <div><strong>{profileData.followersCount || 0}</strong><span>Followers</span></div>
              <div><strong>{profileData.followingCount || 0}</strong><span>Following</span></div>
            </div>
          </section>

          <section className="card profile-side-card">
            <header className="profile-side-heading"><h2><Icon name="userCheck" size={18} /> About</h2><span className="profile-side-muted">Details</span></header>
            <div className="profile-about-row"><span>University</span><strong>Geeta University</strong></div>
            <div className="profile-about-row"><span>Department</span><strong>{profileData.department || 'Not specified'}</strong></div>
            <div className="profile-about-row"><span>Year / Role</span><strong>{profileData.year || profileData.role || 'Member'}</strong></div>
            <div className="profile-about-row"><span>Member since</span><strong>{profileData.createdAt ? new Date(profileData.createdAt).toLocaleDateString(undefined, { month: 'short', year: 'numeric' }) : 'Not available'}</strong></div>
            <div className="profile-about-row"><span>Verification</span><strong>{profileData.verified ? 'Verified' : 'Not verified'}</strong></div>
          </section>

          <section className="card profile-side-card">
            <header className="profile-side-heading"><h2><Icon name="users" size={18} /> Communities</h2><span className="profile-side-muted">{profileData.communities?.length || 0}</span></header>
            {profileData.communities?.length ? profileData.communities.slice(0, 4).map((community) => (
              <Link className="profile-side-community" to={'/communities/' + (community.slug || community._id)} key={community._id}>
                {community.avatar ? <img src={community.avatar} alt="" loading="lazy" decoding="async" /> : <span>{getInitials(community.name)}</span>}
                <span><strong>{community.name}</strong><small>{community.communityRole || 'Member'}</small></span>
                <Icon name="chevronRight" size={15} />
              </Link>
            )) : <p className="profile-side-empty">No community memberships are available.</p>}
            <Link className="profile-side-footer-link" to="/communities">Explore Communities <Icon name="arrowRight" size={14} /></Link>
          </section>

          <section className="card profile-side-card">
            <header className="profile-side-heading"><h2><Icon name="trendingUp" size={18} /> Recent Contributions</h2></header>
            {userPosts.slice(0, 3).map((post) => (
              <Link to={'/discussions/' + post._id} className="profile-contribution" key={post._id}>
                <strong>{post.title}</strong><small>{post.createdAt ? new Date(post.createdAt).toLocaleDateString() : ''}</small>
              </Link>
            ))}
            {userPosts.length === 0 ? <p className="profile-side-empty">No discussions have been published.</p> : null}
          </section>
        </aside>
      </div>

      {/* Edit Profile Modal */}
      {showEditModal && (
        <div
          className="modal-overlay"
          id="edit-profile-modal"
          onClick={(e) => {
            if (e.target === e.currentTarget) setShowEditModal(false);
          }}
        >
          <div className="modal-content" style={{ maxWidth: '540px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 20px', borderBottom: '1px solid var(--border-color)' }}>
              <h2 style={{ fontSize: '1.2rem', fontWeight: 800 }}>Edit Profile</h2>
              <button
                type="button"
                onClick={() => setShowEditModal(false)}
                style={{ border: 'none', background: 'transparent', cursor: 'pointer', fontSize: '1.2rem' }}
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveProfile} style={{ padding: '20px' }}>
              <div style={{ marginBottom: '14px' }}>
                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 700, marginBottom: '6px' }}>Full Name</label>
                <input
                  type="text"
                  className="form-control"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  required
                />
              </div>

              <div style={{ marginBottom: '14px' }}>
                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 700, marginBottom: '6px' }}>Headline / Department</label>
                <input
                  type="text"
                  className="form-control"
                  placeholder="e.g. Computer Science & Engineering"
                  value={editDepartment}
                  onChange={(e) => setEditDepartment(e.target.value)}
                />
              </div>

              <div style={{ marginBottom: '14px' }}>
                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 700, marginBottom: '6px' }}>Academic Year / Status</label>
                <input
                  type="text"
                  className="form-control"
                  placeholder="e.g. 3rd Year • CSE or Faculty"
                  value={editYear}
                  onChange={(e) => setEditYear(e.target.value)}
                />
              </div>

              <div style={{ marginBottom: '14px' }}>
                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 700, marginBottom: '6px' }}>Bio</label>
                <textarea
                  className="form-control"
                  rows={3}
                  placeholder="Tell fellow students and faculty about your interests and research..."
                  value={editBio}
                  onChange={(e) => setEditBio(e.target.value)}
                />
              </div>

              <div style={{ marginBottom: '20px' }}>
                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 700, marginBottom: '6px' }}>Avatar Image URL</label>
                <input
                  type="url"
                  className="form-control"
                  placeholder="https://images.unsplash.com/..."
                  value={editAvatar}
                  onChange={(e) => setEditAvatar(e.target.value)}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setShowEditModal(false)}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={savingProfile}
                >
                  {savingProfile ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

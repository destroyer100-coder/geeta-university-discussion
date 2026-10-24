import React, { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { usersApi, postsApi } from '../../services/api';
import { PostCard } from '../../components/post/PostCard';
import { Icon } from '../../components/common/Icons';

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
    try {
      const res = await usersApi.getProfile(targetUserId);
      if (res.success && res.data) {
        setProfileData(res.data);
        setUserPosts(res.data.posts || []);
        setUserComments(res.data.comments || []);
        setEditName(res.data.name || '');
        setEditBio(res.data.bio || '');
        setEditDepartment(res.data.department || '');
        setEditYear(res.data.year || '');
        setEditAvatar(res.data.avatar || '');
      }
    } catch (err) {
      console.error('Failed to load profile:', err);
      setErrorNotice(err.message || 'Profile could not be loaded.');
    } finally {
      setLoading(false);
    }
  };

  const loadSavedPosts = async () => {
    try {
      const res = await usersApi.getSaved();
      if (res.success && res.data) {
        setSavedPosts(res.data);
      }
    } catch (err) {
      console.error('Failed to load saved posts:', err);
    }
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

  // Follow / Unfollow
  const handleToggleFollow = async () => {
    if (!currentUser) {
      alert('Please log in to follow users.');
      return;
    }
    if (actionLoading) return;
    setActionLoading(true);
    try {
      const res = await usersApi.toggleFollow('user', profileData._id);
      if (res.success) {
        setProfileData((prev) => ({
          ...prev,
          isFollowing: res.following,
          followersCount: res.following ? prev.followersCount + 1 : Math.max(0, prev.followersCount - 1),
        }));
      }
    } catch (err) {
      alert(err.message || 'Follow action failed');
    } finally {
      setActionLoading(false);
    }
  };

  // Block / Unblock
  const handleToggleBlock = async () => {
    if (!currentUser) return;
    if (actionLoading) return;
    setActionLoading(true);
    try {
      if (profileData.isBlocked) {
        const res = await usersApi.unblock(profileData._id);
        if (res.success) {
          setProfileData((prev) => ({ ...prev, isBlocked: false }));
          alert('User unblocked.');
        }
      } else {
        const res = await usersApi.block(profileData._id);
        if (res.success) {
          setProfileData((prev) => ({ ...prev, isBlocked: true }));
          alert('User blocked. They can no longer interact with your discussions or message you.');
        }
      }
    } catch (err) {
      alert(err.message || 'Block action failed');
    } finally {
      setActionLoading(false);
    }
  };

  // Mute / Unmute
  const handleToggleMute = async () => {
    if (!currentUser) return;
    if (actionLoading) return;
    setActionLoading(true);
    try {
      if (profileData.isMuted) {
        const res = await usersApi.unmute(profileData._id);
        if (res.success) {
          setProfileData((prev) => ({ ...prev, isMuted: false }));
          alert('User unmuted.');
        }
      } else {
        const res = await usersApi.mute(profileData._id);
        if (res.success) {
          setProfileData((prev) => ({ ...prev, isMuted: true }));
          alert('User muted. Their posts will no longer appear in your feed.');
        }
      }
    } catch (err) {
      alert(err.message || 'Mute action failed');
    } finally {
      setActionLoading(false);
    }
  };

  // Save Profile Edits
  const handleSaveProfile = async (e) => {
    e.preventDefault();
    setSavingProfile(true);
    try {
      const res = await usersApi.updateProfile({
        name: editName,
        bio: editBio,
        department: editDepartment,
        year: editYear,
        avatar: editAvatar,
      });
      if (res.success) {
        setProfileData((prev) => ({
          ...prev,
          ...res.data,
        }));
        setShowEditModal(false);
        alert('Profile updated successfully!');
      }
    } catch (err) {
      alert(err.message || 'Failed to update profile');
    } finally {
      setSavingProfile(false);
    }
  };

  // Copy Profile Link
  const handleShareProfile = () => {
    const url = window.location.origin + `/profile/${profileData._id}`;
    navigator.clipboard?.writeText?.(url);
    alert('Profile link copied to clipboard!');
  };

  // Direct Message action
  const handleSendMessage = () => {
    navigate(`/messages?user=${profileData._id}`);
  };

  // Account Deletion
  const handleDeleteAccount = async () => {
    const confirmation = window.prompt(
      'Type "DELETE" to confirm permanent account deletion and anonymization:'
    );
    if (confirmation !== 'DELETE') return;

    setActionLoading(true);
    try {
      const res = await usersApi.deleteAccount();
      if (res.success) {
        alert(res.message);
        logout();
        navigate('/');
      }
    } catch (err) {
      alert(err.message || 'Failed to delete account');
    } finally {
      setActionLoading(false);
    }
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
    <div>
      {/* Profile Header Card */}
      <div className="card" style={{ padding: '0', overflow: 'hidden', marginBottom: '20px' }}>
        {/* Cover Banner */}
        <div
          style={{
            height: '130px',
            background: 'linear-gradient(135deg, #1e3a8a 0%, #1e40af 50%, #3b82f6 100%)',
            position: 'relative',
          }}
        >
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
              <img
                src={
                  profileData.avatar ||
                  'https://api.dicebear.com/7.x/avataaars/svg?seed=' + profileData.name
                }
                alt={profileData.name}
                style={{
                  width: 100,
                  height: 100,
                  borderRadius: '50%',
                  objectFit: 'cover',
                  border: '4px solid #ffffff',
                  boxShadow: 'var(--shadow-md)',
                  backgroundColor: '#f8fafc',
                }}
              />
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
              {profileData.bio || 'Geeta University academic community member. Sharing knowledge and participating in university discussions.'}
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
                <strong style={{ color: 'var(--text-main)', fontSize: '0.95rem' }}>{userPosts.length}</strong> Discussions
              </span>
              <span>
                <strong style={{ color: 'var(--text-main)', fontSize: '0.95rem' }}>{userComments.length}</strong> Answers
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
                      <img
                        src={comm.avatar || 'https://images.unsplash.com/photo-1517694712202-14dd9538aa97?w=80'}
                        alt={comm.name}
                        style={{ width: 44, height: 44, borderRadius: '10px', objectFit: 'cover' }}
                      />
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
                  {new Date(profileData.createdAt || Date.now()).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
                </div>
              </div>
            </div>

            <h3 style={{ fontSize: '0.95rem', fontWeight: 700, marginBottom: '8px' }}>About Me</h3>
            <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', lineHeight: 1.6 }}>
              {profileData.bio || 'This user has not added a biography yet.'}
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

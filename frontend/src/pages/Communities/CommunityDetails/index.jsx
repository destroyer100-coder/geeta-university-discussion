import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { communitiesApi, postsApi } from '../../../services/api';
import { PostCard } from '../../../components/post/PostCard';
import { RequestToPostModal } from '../../../components/community/RequestToPostModal';
import { useAuth } from '../../../context/AuthContext';
import { Icon } from '../../../components/common/Icons';

export const CommunityDetails = ({ onOpenCreatePostWithCommunity }) => {
  const { id } = useParams();
  const { user } = useAuth();
  const [community, setCommunity] = useState(null);
  const [posts, setPosts] = useState([]);
  const [pendingPosts, setPendingPosts] = useState([]);
  const [postRequests, setPostRequests] = useState([]);
  const [auditLogs, setAuditLogs] = useState([]);
  const [joinRequests, setJoinRequests] = useState([]);
  const [activeTab, setActiveTab] = useState('discussions'); // 'discussions' | 'rules' | 'members' | 'settings' | 'requests' | 'audit'
  const [loading, setLoading] = useState(true);
  const [showRequestModal, setShowRequestModal] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);

  // Settings form state (Point 8)
  const [settingsPolicy, setSettingsPolicy] = useState({
    name: '',
    description: '',
    category: 'General',
    visibility: 'PUBLIC',
    postPolicy: 'MEMBERS',
    commentPolicy: 'EVERYONE',
    sharePolicy: 'EVERYONE',
    allowPostRequests: true,
    requirePostApproval: false,
    allowAnonymousPosts: true,
    maxPinnedPosts: 3,
  });

  const loadCommunityData = async () => {
    setLoading(true);
    try {
      const res = await communitiesApi.getById(id);
      if (res.success && res.data) {
        const comm = res.data;
        setCommunity(comm);
        if (comm.permissions) {
          setSettingsPolicy({
            name: comm.name || '',
            description: comm.description || '',
            category: comm.category || 'General',
            visibility: comm.permissions.visibility || 'PUBLIC',
            postPolicy: comm.permissions.postPolicy || 'MEMBERS',
            commentPolicy: comm.permissions.commentPolicy || 'EVERYONE',
            sharePolicy: comm.permissions.sharePolicy || 'EVERYONE',
            allowPostRequests: comm.permissions.allowPostRequests ?? true,
            requirePostApproval: comm.permissions.requirePostApproval ?? false,
            allowAnonymousPosts: comm.permissions.allowAnonymousPosts ?? true,
            maxPinnedPosts: comm.maxPinnedPosts || 3,
          });
        }

        // Load posts for this community
        const postRes = await postsApi.getAll({ community: comm._id });
        if (postRes.success) setPosts(postRes.data);

        // Moderation surfaces are fetched only when the SERVER says this user holds
        // the corresponding delegation for this exact community (rules §8).
        const isModIdentity = Boolean(comm.canModerate);
        const modPermsLoad = comm.moderationPermissions || {};

        if (modPermsLoad.manageRequests) {
          postsApi
            .getAll({ community: comm._id, status: 'pending' })
            .then((pRes) => {
              if (pRes.success) setPendingPosts(pRes.data || []);
            })
            .catch(() => {});

          communitiesApi
            .getPostRequests(comm._id)
            .then((rRes) => {
              if (rRes.success) setPostRequests(rRes.data || []);
            })
            .catch(() => {});
        } else {
          setPendingPosts([]);
          setPostRequests([]);
        }

        // Audit trail visibility is identity-scoped (any active moderator of THIS
        // community may read the trail); it is NOT gated by manage_rules or any
        // action delegation (rules §19).
        if (modPermsLoad.manageRules) {
          communitiesApi
            .getAuditLogs(comm._id)
            .then((aRes) => {
              if (aRes.success) setAuditLogs(aRes.data || []);
            })
            .catch(() => {});
        }

        // Join Requests queue is only fetched when the backend says this user may review them
        if (comm.canManageJoinRequests) {
          communitiesApi
            .getJoinRequests(comm._id)
            .then((jRes) => {
              if (jRes.success) setJoinRequests(jRes.data || []);
            })
            .catch(() => {});
        } else {
          setJoinRequests([]);
        }
      }
    } catch (err) {
      console.error('Failed to load community:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadCommunityData();
  }, [id, user]);

  const handleJoinToggle = async () => {
    if (!user) {
      alert('Please log in to join this community.');
      return;
    }
    if (actionLoading) return;
    setActionLoading(true);
    try {
      const membershipStatus = community.currentUserMembership?.status;

      if (membershipStatus === 'active') {
        const res = await communitiesApi.leave(community._id);
        if (res.success) {
          alert(res.message);
          loadCommunityData();
        }
      } else {
        // Public -> joins immediately (Active). Private -> creates a pending join request.
        const res = await communitiesApi.join(community._id);
        if (res.success) {
          alert(res.message);
          loadCommunityData();
        }
      }
    } catch (err) {
      // 409 = duplicate pending request; surface the backend message and resync state
      alert(err.message || 'Action failed');
      loadCommunityData();
    } finally {
      setActionLoading(false);
    }
  };

  const handleReviewPost = async (postId, action) => {
    let reviewNote = '';
    if (action === 'reject') {
      const noteInput = prompt('Reason for rejection (optional):');
      if (noteInput === null) return; // cancelled
      reviewNote = noteInput;
    }
    try {
      const res = await postsApi.review(postId, { action, reviewNote });
      if (res.success) {
        alert(`Post ${action === 'approve' ? 'approved and published' : 'rejected'}.`);
        loadCommunityData();
      }
    } catch (e) {
      alert(e.message || `Failed to ${action} post.`);
    }
  };

  const handleReviewRequest = async (requestId, status) => {
    try {
      const res = await communitiesApi.reviewPostRequest(requestId, { status });
      if (res.success) {
        alert(`Request marked as ${status}`);
        loadCommunityData();
      }
    } catch (e) {
      alert(e.message);
    }
  };

  const handleReviewJoinRequest = async (userId, status) => {
    if (actionLoading) return;
    setActionLoading(true);
    try {
      const res = await communitiesApi.reviewJoinRequest(community._id, userId, { status });
      if (res.success) {
        alert(res.message);
        loadCommunityData();
      }
    } catch (e) {
      alert(e.message || 'Failed to review join request.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleSaveSettings = async (e) => {
    e.preventDefault();
    try {
      const res = await communitiesApi.updateSettings(community._id, {
        name: settingsPolicy.name,
        description: settingsPolicy.description,
        category: settingsPolicy.category,
        maxPinnedPosts: settingsPolicy.maxPinnedPosts,
        permissions: {
          visibility: settingsPolicy.visibility,
          postPolicy: settingsPolicy.postPolicy,
          commentPolicy: settingsPolicy.commentPolicy,
          sharePolicy: settingsPolicy.sharePolicy,
          allowPostRequests: settingsPolicy.allowPostRequests,
          requirePostApproval: settingsPolicy.requirePostApproval,
          allowAnonymousPosts: settingsPolicy.allowAnonymousPosts,
        },
      });
      if (res.success) {
        alert('Community settings and permissions updated successfully!');
        loadCommunityData();
      }
    } catch (e) {
      alert(e.message);
    }
  };

  if (loading) {
    return <div style={{ textAlign: 'center', padding: '60px' }}>Loading community...</div>;
  }

  if (!community) {
    return (
      <div className="card" style={{ padding: '40px', textAlign: 'center', margin: '40px auto', maxWidth: '600px' }}>
        <h2 style={{ fontSize: '1.3rem', fontWeight: 800, marginBottom: '8px' }}>
          Community Not Found
        </h2>
        <p style={{ color: 'var(--text-muted)', marginBottom: '16px' }}>
          The requested community could not be found.
        </p>
        <Link to="/communities" className="btn btn-primary">
          Explore All Communities
        </Link>
      </div>
    );
  }

  const isOwner = user && community.owner?._id === user._id;
  // Server-authoritative identity + granular delegated permissions for this community
  const isMod = Boolean(community.canModerate);
  const modPerms = community.moderationPermissions || {};
  const canManagePostRequests = Boolean(modPerms.manageRequests);
  const canManageSettings = Boolean(modPerms.manageRules);
  const canPost = community.currentUserPermission?.allowed;
  const membershipStatus = community.currentUserMembership?.status || 'none';
  const isMember = membershipStatus === 'active';
  const isPendingJoinRequest = membershipStatus === 'pending';
  const isRejectedJoinRequest = membershipStatus === 'rejected';
  const isPrivateCommunity = community.permissions?.visibility === 'MEMBERS_ONLY';
  const canManageJoinRequests = !!community.canManageJoinRequests;

  return (
    <div>
      {/* Banner & Cover */}
      <div
        style={{
          borderRadius: 'var(--radius-lg)',
          overflow: 'hidden',
          border: '1px solid var(--border-color)',
          background: '#ffffff',
          marginBottom: '20px',
        }}
      >
        <div
          style={{
            height: '160px',
            background: `url(${
              community.banner ||
              'https://images.unsplash.com/photo-1526374965328-7f61d4dc18c5?w=1200'
            }) center/cover no-repeat`,
            position: 'relative',
          }}
        />

        <div style={{ padding: '20px 24px', position: 'relative' }}>
          <div
            style={{
              display: 'flex',
              alignItems: 'flex-start',
              justifyContent: 'space-between',
              flexWrap: 'wrap',
              gap: '16px',
            }}
          >
            <div style={{ display: 'flex', gap: '16px' }}>
              <img
                src={
                  community.avatar ||
                  'https://images.unsplash.com/photo-1517694712202-14dd9538aa97?w=120'
                }
                alt={community.name}
                style={{
                  width: 72,
                  height: 72,
                  borderRadius: '16px',
                  objectFit: 'cover',
                  border: '4px solid #ffffff',
                  boxShadow: 'var(--shadow-md)',
                  marginTop: '-44px',
                }}
              />
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                  <h1 style={{ fontSize: '1.4rem', fontWeight: 800 }}>{community.name}</h1>
                  <span className="badge badge-primary">{community.category || community.type}</span>
                  {community.permissions?.visibility === 'MEMBERS_ONLY' && (
                    <span className="badge" style={{ background: '#fef3c7', color: '#92400e' }}>
                      🔒 Members Only
                    </span>
                  )}
                </div>
                <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', marginTop: '4px', maxWidth: '640px' }}>
                  {community.description}
                </p>
                <div style={{ display: 'flex', gap: '16px', marginTop: '8px', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                  <span>
                    👥 <strong>{community.memberCount || 0}</strong> Members
                  </span>
                  <span>
                    💬 <strong>{community.postCount || 0}</strong> Discussions
                  </span>
                  <span>
                    🛡️ Head: <strong>{community.owner?.name || 'Faculty Head'}</strong>
                  </span>
                </div>
              </div>
            </div>

            {/* Action buttons */}
            <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
              {isOwner ? (
                <span className="badge badge-primary" style={{ padding: '8px 14px' }}>
                  👑 Community Head
                </span>
              ) : isMember ? (
                <button
                  className="btn btn-secondary"
                  onClick={handleJoinToggle}
                  disabled={actionLoading}
                >
                  ✓ Joined (Leave)
                </button>
              ) : isPendingJoinRequest ? (
                <button
                  className="btn btn-secondary"
                  disabled
                  title="Your request is awaiting moderator approval"
                >
                  ⏳ Pending Approval
                </button>
              ) : (
                <button
                  className="btn btn-primary"
                  onClick={handleJoinToggle}
                  disabled={actionLoading}
                >
                  {isPrivateCommunity ? '🔒 Request to Join' : '+ Join Community'}
                </button>
              )}

              {isRejectedJoinRequest && !isOwner && (
                <span className="badge" style={{ background: '#fee2e2', color: '#991b1b', padding: '8px 12px' }}>
                  Join request rejected — you may request again
                </span>
              )}

              {canPost && onOpenCreatePostWithCommunity && (
                <button
                  className="btn btn-primary"
                  onClick={() => onOpenCreatePostWithCommunity(community._id)}
                >
                  + Create Post
                </button>
              )}
            </div>
          </div>

          {/* Navigation Tabs */}
          <div style={{ display: 'flex', gap: '8px', borderTop: '1px solid var(--border-color)', marginTop: '18px', paddingTop: '12px', flexWrap: 'wrap' }}>
            <button
              className={`btn btn-sm ${activeTab === 'discussions' ? 'btn-primary' : 'btn-secondary'}`}
              onClick={() => setActiveTab('discussions')}
            >
              Discussions
            </button>
            <button
              className={`btn btn-sm ${activeTab === 'rules' ? 'btn-primary' : 'btn-secondary'}`}
              onClick={() => setActiveTab('rules')}
            >
              Rules & Policy
            </button>
            <button
              className={`btn btn-sm ${activeTab === 'members' ? 'btn-primary' : 'btn-secondary'}`}
              onClick={() => setActiveTab('members')}
            >
              Members ({community.memberCount || 0})
            </button>

            {canManageJoinRequests && (
              <button
                className={`btn btn-sm ${activeTab === 'join-requests' ? 'btn-primary' : 'btn-secondary'}`}
                onClick={() => setActiveTab('join-requests')}
              >
                Join Requests ({joinRequests.length})
              </button>
            )}

            {canManagePostRequests && (
              <button
                className={`btn btn-sm ${activeTab === 'requests' ? 'btn-primary' : 'btn-secondary'}`}
                onClick={() => setActiveTab('requests')}
              >
                Post Requests ({pendingPosts.length + postRequests.filter((r) => r.status === 'pending').length})
              </button>
            )}
            {canManageSettings && (
              <button
                className={`btn btn-sm ${activeTab === 'settings' ? 'btn-primary' : 'btn-secondary'}`}
                onClick={() => setActiveTab('settings')}
              >
                Settings & Permissions
              </button>
            )}
            {isMod && (
              <button
                className={`btn btn-sm ${activeTab === 'audit' ? 'btn-primary' : 'btn-secondary'}`}
                onClick={() => setActiveTab('audit')}
              >
                Audit Logs
              </button>
            )}
          </div>
        </div>
      </div>

      {/* TAB 1: DISCUSSIONS */}
      {activeTab === 'discussions' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) 300px', gap: '20px' }}>
          <div>
            {!canPost && (
              <div
                style={{
                  background: '#fffbeb',
                  border: '1px solid #fde68a',
                  borderRadius: 'var(--radius-md)',
                  padding: '12px 16px',
                  marginBottom: '16px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <Icon name="lock" size={18} color="#d97706" />
                  <span style={{ fontSize: '0.825rem', color: '#92400e' }}>
                    {community.currentUserPermission?.reason || 'Posting is restricted in this community.'}
                  </span>
                </div>
                {community.permissions?.allowPostRequests && (
                  <button className="btn btn-warning btn-sm" onClick={() => setShowRequestModal(true)}>
                    Request to Post
                  </button>
                )}
              </div>
            )}

            {posts.length === 0 ? (
              <div className="card" style={{ textAlign: 'center', padding: '40px' }}>
                <p style={{ color: 'var(--text-muted)' }}>No discussions in this community yet.</p>
                {canPost && onOpenCreatePostWithCommunity && (
                  <button
                    className="btn btn-primary"
                    style={{ marginTop: '12px' }}
                    onClick={() => onOpenCreatePostWithCommunity(community._id)}
                  >
                    Start First Discussion
                  </button>
                )}
              </div>
            ) : (
              posts.map((p) => (
                <PostCard
                  key={p._id}
                  post={p}
                  modPermissions={modPerms}
                  onPostUpdated={loadCommunityData}
                />
              ))
            )}
          </div>

          {/* Right Panel: Community Rules & Permissions */}
          <div>
            <div className="card" style={{ marginBottom: '16px' }}>
              <div
                style={{
                  fontWeight: 700,
                  fontSize: '0.95rem',
                  marginBottom: '12px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                }}
              >
                <Icon name="shieldCheck" size={18} color="var(--primary)" />
                <span>Enforced Policies</span>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', fontSize: '0.825rem' }}>
                <div>
                  <span style={{ color: 'var(--text-muted)', display: 'block' }}>Visibility</span>
                  <strong>
                    {community.permissions?.visibility === 'PUBLIC'
                      ? 'Everyone (Public)'
                      : 'Members Only (Private)'}
                  </strong>
                </div>
                <div>
                  <span style={{ color: 'var(--text-muted)', display: 'block' }}>Posting Policy</span>
                  <span className="badge badge-warning">
                    {community.permissions?.postPolicy || 'MEMBERS'}
                  </span>
                </div>
                <div>
                  <span style={{ color: 'var(--text-muted)', display: 'block' }}>Comment Policy</span>
                  <strong>{community.permissions?.commentPolicy || 'EVERYONE'}</strong>
                </div>
                <div>
                  <span style={{ color: 'var(--text-muted)', display: 'block' }}>Approval Required</span>
                  <strong>{community.permissions?.requirePostApproval ? 'Yes (Moderated)' : 'No (Instant)'}</strong>
                </div>
              </div>

              <div style={{ borderTop: '1px solid var(--border-color)', marginTop: '12px', paddingTop: '10px' }}>
                <button
                  className="btn btn-outline btn-sm"
                  style={{ width: '100%' }}
                  onClick={() => setActiveTab('rules')}
                >
                  View Guidelines & Rules →
                </button>
              </div>
            </div>

            {/* Moderators Box */}
            <div className="card">
              <div style={{ fontWeight: 700, fontSize: '0.9rem', marginBottom: '10px' }}>
                Community Moderators
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '0.8rem' }}>
                  <div>
                    <strong>{community.owner?.name}</strong>
                    <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Community Head</div>
                  </div>
                </div>
                {community.moderators?.map((m) => (
                  <div key={m._id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '0.8rem' }}>
                    <div>
                      <strong>{m.name}</strong>
                      <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Moderator</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: RULES */}
      {activeTab === 'rules' && (
        <div className="card" style={{ padding: '24px' }}>
          <h3 style={{ fontSize: '1.1rem', fontWeight: 800, marginBottom: '16px' }}>
            Official Community Guidelines
          </h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            {community.rules?.map((rule, idx) => (
              <div key={idx} style={{ padding: '12px', background: 'var(--bg-muted)', borderRadius: 'var(--radius-md)' }}>
                <strong style={{ fontSize: '0.9rem', color: 'var(--primary)' }}>
                  {idx + 1}. {rule.title}
                </strong>
                <p style={{ fontSize: '0.825rem', color: 'var(--text-secondary)', marginTop: '4px' }}>
                  {rule.description}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TAB 3: MEMBERS */}
      {activeTab === 'members' && (
        <div className="card" style={{ padding: '24px' }}>
          <h3 style={{ fontSize: '1.1rem', fontWeight: 800, marginBottom: '16px' }}>
            Community Leadership & Members
          </h3>
          <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '16px' }}>
            {community.memberCount} members belong to this channel.
          </p>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(min(220px, 100%), 1fr))', gap: '12px' }}>
            <div style={{ padding: '12px', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-md)' }}>
              <strong>{community.owner?.name}</strong>
              <div style={{ fontSize: '0.75rem', color: 'var(--primary)', fontWeight: 700 }}>Head / Owner</div>
            </div>
            {community.moderators?.map((m) => (
              <div key={m._id} style={{ padding: '12px', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-md)' }}>
                <strong>{m.name}</strong>
                <div style={{ fontSize: '0.75rem', color: '#10b981', fontWeight: 700 }}>Moderator</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TAB 4: POST REQUESTS & PENDING SUBMISSIONS (manage_requests delegation only) */}
      {activeTab === 'requests' && canManagePostRequests && (
        <div className="card" style={{ padding: '24px' }}>
          <h3 style={{ fontSize: '1.1rem', fontWeight: 800, marginBottom: '16px' }}>
            Post Requests & Pending Submissions ({pendingPosts.length + postRequests.filter((r) => r.status === 'pending').length})
          </h3>

          {pendingPosts.length === 0 && postRequests.length === 0 ? (
            <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>No pending requests or submissions awaiting moderation.</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {/* Pending Discussions awaiting Moderator Approval */}
              {pendingPosts.map((post) => (
                <div
                  key={post._id}
                  style={{
                    padding: '16px',
                    border: '1px solid #fed7aa',
                    borderRadius: 'var(--radius-md)',
                    background: '#fffbeb',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '10px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <img
                        src={post.author?.avatar || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100'}
                        alt={post.author?.name || 'Author'}
                        style={{ width: '36px', height: '36px', borderRadius: '50%', objectFit: 'cover' }}
                      />
                      <div>
                        <div style={{ fontWeight: 700, fontSize: '0.9rem' }}>
                          {post.author?.name || 'Community Member'}
                          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginLeft: '6px' }}>
                            ({post.author?.department || 'Student'})
                          </span>
                        </div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                          Submitted: {new Date(post.createdAt).toLocaleString()} · <span className="badge" style={{ background: '#fef3c7', color: '#92400e' }}>PENDING REVIEW</span>
                        </div>
                      </div>
                    </div>

                    <div style={{ display: 'flex', gap: '8px' }}>
                      <button
                        className="btn btn-primary btn-sm"
                        style={{ background: '#16a34a', borderColor: '#16a34a' }}
                        onClick={() => handleReviewPost(post._id, 'approve')}
                      >
                        ✓ Approve & Publish
                      </button>
                      <button
                        className="btn btn-danger btn-sm"
                        onClick={() => handleReviewPost(post._id, 'reject')}
                      >
                        ✕ Reject
                      </button>
                    </div>
                  </div>

                  <div style={{ marginTop: '12px' }}>
                    <h4 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: '6px', color: '#1e293b' }}>
                      {post.title}
                    </h4>
                    <p style={{ fontSize: '0.875rem', color: '#334155', whiteSpace: 'pre-wrap', lineHeight: 1.5 }}>
                      {post.body}
                    </p>
                    {post.tags && post.tags.length > 0 && (
                      <div style={{ display: 'flex', gap: '6px', marginTop: '8px', flexWrap: 'wrap' }}>
                        {post.tags.map((t, idx) => (
                          <span key={idx} className="badge badge-secondary" style={{ fontSize: '0.75rem' }}>
                            #{t}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              ))}

              {/* Permission requests from non-members */}
              {postRequests.map((req) => (
                <div
                  key={req._id}
                  style={{
                    padding: '16px',
                    border: '1px solid var(--border-color)',
                    borderRadius: 'var(--radius-md)',
                    background: '#fafafa',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div>
                      <strong>{req.user?.name}</strong> ({req.user?.year || req.user?.department})
                      <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                        Status: <span className="badge badge-warning">{req.status}</span>
                      </div>
                    </div>
                    {req.status === 'pending' && (
                      <div style={{ display: 'flex', gap: '8px' }}>
                        <button className="btn btn-primary btn-sm" onClick={() => handleReviewRequest(req._id, 'approved')}>
                          Approve
                        </button>
                        <button className="btn btn-secondary btn-sm" onClick={() => handleReviewRequest(req._id, 'rejected')}>
                          Reject
                        </button>
                      </div>
                    )}
                  </div>
                  <div style={{ marginTop: '8px', fontSize: '0.85rem' }}>
                    <strong>Reason:</strong> {req.reason || 'No specific reason provided.'}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* TAB 4b: JOIN REQUESTS (Head / Platform Admin / delegated moderator only) */}
      {activeTab === 'join-requests' && canManageJoinRequests && (
        <div className="card" style={{ padding: '24px' }}>
          <h3 style={{ fontSize: '1.1rem', fontWeight: 800, marginBottom: '16px' }}>
            Join Requests ({joinRequests.length})
          </h3>

          {joinRequests.length === 0 ? (
            <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>
              No pending join requests for this community.
            </p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {joinRequests.map((req) => (
                <div
                  key={req._id}
                  style={{
                    padding: '16px',
                    border: '1px solid #fed7aa',
                    borderRadius: 'var(--radius-md)',
                    background: '#fffbeb',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '10px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <img
                        src={req.user?.avatar || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100'}
                        alt={req.user?.name || 'Requester'}
                        style={{ width: '36px', height: '36px', borderRadius: '50%', objectFit: 'cover' }}
                      />
                      <div>
                        <div style={{ fontWeight: 700, fontSize: '0.9rem' }}>
                          {req.user?.name || 'Applicant'}
                          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginLeft: '6px' }}>
                            ({req.user?.department || 'Student'})
                          </span>
                        </div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                          Requested: {new Date(req.createdAt).toLocaleString()} ·{' '}
                          <span className="badge" style={{ background: '#fef3c7', color: '#92400e' }}>
                            PENDING APPROVAL
                          </span>
                        </div>
                      </div>
                    </div>

                    <div style={{ display: 'flex', gap: '8px' }}>
                      <button
                        className="btn btn-primary btn-sm"
                        style={{ background: '#16a34a', borderColor: '#16a34a' }}
                        disabled={actionLoading}
                        onClick={() => handleReviewJoinRequest(req.user?._id, 'active')}
                      >
                        ✓ Approve
                      </button>
                      <button
                        className="btn btn-danger btn-sm"
                        disabled={actionLoading}
                        onClick={() => handleReviewJoinRequest(req.user?._id, 'rejected')}
                      >
                        ✕ Reject
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* TAB 5: COMMUNITY SETTINGS (Head & Platform Admin — manage_rules authority) */}
      {activeTab === 'settings' && canManageSettings && (
        <div className="card" style={{ padding: '24px' }}>
          <h3 style={{ fontSize: '1.1rem', fontWeight: 800, marginBottom: '16px' }}>
            Manage Community Settings & Permissions
          </h3>
          <form onSubmit={handleSaveSettings} style={{ maxWidth: '640px' }}>
            <div className="form-group" style={{ marginBottom: '12px' }}>
              <label className="form-label">Community Name</label>
              <input
                type="text"
                className="form-control"
                value={settingsPolicy.name}
                onChange={(e) => setSettingsPolicy({ ...settingsPolicy, name: e.target.value })}
                required
              />
            </div>

            <div className="form-group" style={{ marginBottom: '12px' }}>
              <label className="form-label">Description</label>
              <textarea
                className="form-control"
                rows={3}
                value={settingsPolicy.description}
                onChange={(e) => setSettingsPolicy({ ...settingsPolicy, description: e.target.value })}
              />
            </div>

            <div className="form-group" style={{ marginBottom: '12px' }}>
              <label className="form-label">Category</label>
              <select
                className="form-control"
                value={settingsPolicy.category}
                onChange={(e) => setSettingsPolicy({ ...settingsPolicy, category: e.target.value })}
              >
                <option value="CSE">CSE</option>
                <option value="ECE">ECE</option>
                <option value="Placement">Placement</option>
                <option value="Clubs">Clubs</option>
                <option value="Events">Events</option>
                <option value="Hostel">Hostel</option>
                <option value="Academics">Academics</option>
                <option value="Sports">Sports</option>
                <option value="General">General</option>
              </select>
            </div>

            <div className="form-group" style={{ marginBottom: '12px' }}>
              <label className="form-label">Visibility (Privacy)</label>
              <select
                className="form-control"
                value={settingsPolicy.visibility}
                onChange={(e) => setSettingsPolicy({ ...settingsPolicy, visibility: e.target.value })}
              >
                <option value="PUBLIC">PUBLIC (Visible to all students/faculty)</option>
                <option value="MEMBERS_ONLY">MEMBERS_ONLY (Private to joined members)</option>
              </select>
            </div>

            <div className="form-group" style={{ marginBottom: '12px' }}>
              <label className="form-label">Posting Policy</label>
              <select
                className="form-control"
                value={settingsPolicy.postPolicy}
                onChange={(e) => setSettingsPolicy({ ...settingsPolicy, postPolicy: e.target.value })}
              >
                <option value="EVERYONE">EVERYONE (Any authenticated user)</option>
                <option value="MEMBERS">MEMBERS (Joined community members)</option>
                <option value="APPROVED_USERS">APPROVED_USERS (Members + approved contributors)</option>
                <option value="HEAD_MODS">HEAD_MODS (Only owner and moderators)</option>
                <option value="CUSTOM">CUSTOM (Restricted)</option>
              </select>
            </div>

            <div className="form-group" style={{ marginBottom: '12px' }}>
              <label className="form-label">Comment Policy</label>
              <select
                className="form-control"
                value={settingsPolicy.commentPolicy}
                onChange={(e) => setSettingsPolicy({ ...settingsPolicy, commentPolicy: e.target.value })}
              >
                <option value="EVERYONE">EVERYONE</option>
                <option value="MEMBERS">MEMBERS</option>
                <option value="HEAD_MODS">HEAD_MODS</option>
              </select>
            </div>

            <div className="form-group" style={{ marginBottom: '14px' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', marginBottom: '8px' }}>
                <input
                  type="checkbox"
                  checked={settingsPolicy.requirePostApproval}
                  onChange={(e) => setSettingsPolicy({ ...settingsPolicy, requirePostApproval: e.target.checked })}
                />
                <span><strong>Require Moderator Approval:</strong> New posts require review before public display</span>
              </label>

              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={settingsPolicy.allowPostRequests}
                  onChange={(e) => setSettingsPolicy({ ...settingsPolicy, allowPostRequests: e.target.checked })}
                />
                <span>Allow non-members to submit Request-to-Post</span>
              </label>
            </div>

            <button type="submit" className="btn btn-primary">
              Save Community Settings
            </button>
          </form>
        </div>
      )}

      {/* TAB 6: AUDIT LOGS (Point 8, Point 19) */}
      {activeTab === 'audit' && isMod && (
        <div className="card" style={{ padding: '24px' }}>
          <h3 style={{ fontSize: '1.1rem', fontWeight: 800, marginBottom: '16px' }}>
            Community Audit Log Trail
          </h3>
          {auditLogs.length === 0 ? (
            <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>No audit records found for this community.</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {auditLogs.map((log) => (
                <div key={log._id} style={{ padding: '12px 16px', background: '#f8fafc', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-color)', fontSize: '0.85rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                    <span style={{ fontWeight: 700, color: 'var(--primary)' }}>
                      Action: {log.action}
                    </span>
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                      {new Date(log.createdAt).toLocaleString()}
                    </span>
                  </div>
                  <div style={{ color: 'var(--text-secondary)' }}>
                    Actor: <strong>{log.actor?.name || 'System / Admin'}</strong> ({log.actor?.email})
                  </div>
                  {log.details && (
                    <div style={{ fontSize: '0.775rem', color: 'var(--text-muted)', marginTop: '4px' }}>
                      Details: {JSON.stringify(log.details)}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Request to post modal */}
      <RequestToPostModal
        isOpen={showRequestModal}
        onClose={() => setShowRequestModal(false)}
        community={community}
        onSuccess={loadCommunityData}
      />
    </div>
  );
};

import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { communitiesApi, postsApi, eventsApi } from '../../../services/api';
import { PostCard } from '../../../components/post/PostCard';
import { useAuth } from '../../../context/AuthContext';
import { Icon } from '../../../components/common/Icons';

const getCommunityInitials = (name = '') => name.trim().split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]).join('').toUpperCase() || 'C';
const readLocalMap = (key) => { try { return JSON.parse(localStorage.getItem(key) || '{}'); } catch { return {}; } };
const readLocalList = (key) => { try { return JSON.parse(localStorage.getItem(key) || '[]'); } catch { return []; } };

export const CommunityDetails = ({ onOpenCreatePostWithCommunity }) => {
  const { id } = useParams();
  const { user } = useAuth();
  const [community, setCommunity] = useState(null);
  const [posts, setPosts] = useState([]);
  const [pendingPosts, setPendingPosts] = useState([]);
  const [postRequests, setPostRequests] = useState([]);
  const [auditLogs, setAuditLogs] = useState([]);
  const [joinRequests, setJoinRequests] = useState([]);
  const [communityEvents, setCommunityEvents] = useState([]);
  const [localActionNotice, setLocalActionNotice] = useState('');
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
      let comm = res?.success && res.data
        ? res.data
        : readLocalList('guf-community-cache').find((item) => String(item._id) === String(id) || String(item.slug || '') === String(id));
      if (comm) {
        const settingPreview = readLocalMap('guf-community-settings-preview')[String(comm._id)] || {};
        const membershipPreview = readLocalMap('guf-community-membership-preview');
        const hasMembershipPreview = Object.prototype.hasOwnProperty.call(membershipPreview, String(comm._id));
        comm = {
          ...comm,
          ...settingPreview,
          ...(hasMembershipPreview ? {
            isCurrentUserMember: Boolean(membershipPreview[String(comm._id)]),
            currentUserMembership: { ...(comm.currentUserMembership || {}), status: membershipPreview[String(comm._id)] ? 'active' : 'none' },
            currentUserPermission: { ...(comm.currentUserPermission || {}), allowed: true },
          } : {}),
        };
        setCommunity(comm);
        if (res?.success && res.data) {
          const cachedCommunities = readLocalList('guf-community-cache').filter((item) => String(item._id) !== String(comm._id));
          try { localStorage.setItem('guf-community-cache', JSON.stringify([comm, ...cachedCommunities].slice(0, 100))); } catch { /* Community cache is optional. */ }
        }
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
        let serverPosts = [];
        try {
          const postRes = await postsApi.getAll({ community: comm._id });
          if (postRes.success && Array.isArray(postRes.data)) serverPosts = postRes.data;
        } catch { /* Continue with locally created discussions where available. */ }
        const localPosts = readLocalList('guf-local-post-preview').filter((item) => String(item.community?._id || item.community || '') === String(comm._id));
        const knownPostIds = new Set(serverPosts.map((item) => String(item._id)));
        setPosts([...localPosts.filter((item) => !knownPostIds.has(String(item._id))), ...serverPosts]);

        try {
          const eventRes = await eventsApi.getAll();
          const serverEvents = eventRes?.success && Array.isArray(eventRes.data)
            ? eventRes.data.filter((item) => String(item.community?._id || item.community || '') === String(comm._id))
            : [];
          const localEvents = readLocalList('guf-local-event-preview').filter((item) => String(item.community?._id || item.community || '') === String(comm._id));
          const knownEventIds = new Set(serverEvents.map((item) => String(item._id)));
          setCommunityEvents([...localEvents.filter((item) => !knownEventIds.has(String(item._id))), ...serverEvents]);
        } catch {
          setCommunityEvents(readLocalList('guf-local-event-preview').filter((item) => String(item.community?._id || item.community || '') === String(comm._id)));
        }

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
      const cachedCommunity = readLocalList('guf-community-cache').find((item) => String(item._id) === String(id) || String(item.slug || '') === String(id));
      if (cachedCommunity) {
        const settingPreview = readLocalMap('guf-community-settings-preview')[String(cachedCommunity._id)] || {};
        const membershipPreview = readLocalMap('guf-community-membership-preview');
        const hasMembershipPreview = Object.prototype.hasOwnProperty.call(membershipPreview, String(cachedCommunity._id));
        setCommunity({
          ...cachedCommunity,
          ...settingPreview,
          ...(hasMembershipPreview ? {
            isCurrentUserMember: Boolean(membershipPreview[String(cachedCommunity._id)]),
            currentUserMembership: { ...(cachedCommunity.currentUserMembership || {}), status: membershipPreview[String(cachedCommunity._id)] ? 'active' : 'none' },
            currentUserPermission: { ...(cachedCommunity.currentUserPermission || {}), allowed: true },
          } : {}),
        });
        setPosts(readLocalList('guf-local-post-preview').filter((item) => String(item.community?._id || item.community || '') === String(cachedCommunity._id)));
        setCommunityEvents(readLocalList('guf-local-event-preview').filter((item) => String(item.community?._id || item.community || '') === String(cachedCommunity._id)));
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadCommunityData();
  }, [id, user]);

  const handleJoinToggle = () => {
    if (!community) return;
    const nextMember = !isMember;
    const memberships = readLocalMap('guf-community-membership-preview');
    memberships[String(community._id)] = nextMember;
    try { localStorage.setItem('guf-community-membership-preview', JSON.stringify(memberships)); } catch { /* Local component state remains interactive. */ }
    setCommunity((current) => ({
      ...current,
      isCurrentUserMember: nextMember,
      currentUserMembership: { ...(current.currentUserMembership || {}), status: nextMember ? 'active' : 'none' },
      currentUserPermission: { ...(current.currentUserPermission || {}), allowed: nextMember || Boolean(current.currentUserPermission?.allowed) },
      memberCount: Math.max(0, Number(current.memberCount || 0) + (nextMember ? 1 : -1)),
    }));
    setLocalActionNotice(nextMember ? 'Joined in this browser preview only.' : 'Left in this browser preview only.');
  };

  const handleReviewPost = (postId, action) => {
    const nextStatus = action === 'approve' ? 'published' : 'rejected';
    setPendingPosts((items) => items.filter((item) => String(item._id) !== String(postId)));
    setPosts((items) => items.map((item) => String(item._id) === String(postId) ? { ...item, status: nextStatus } : item));
    setLocalActionNotice('Post ' + nextStatus + ' in this browser preview only.');
  };

  const handleReviewRequest = (requestId, status) => {
    setPostRequests((items) => items.map((item) => String(item._id) === String(requestId) ? { ...item, status } : item));
    setLocalActionNotice('Request marked ' + status + ' in this browser preview only.');
  };

  const handleReviewJoinRequest = (userId, status) => {
    setJoinRequests((items) => items.filter((item) => String(item.user?._id || item.user) !== String(userId)));
    setLocalActionNotice('Join request ' + (status === 'active' ? 'approved' : 'rejected') + ' in this browser preview only.');
  };

  const handleToggleEventRsvp = (eventItem) => {
    const id = String(eventItem._id);
    const rsvps = readLocalList('guf-event-rsvp-preview');
    const next = rsvps.includes(id) ? rsvps.filter((value) => value !== id) : [...rsvps, id];
    try { localStorage.setItem('guf-event-rsvp-preview', JSON.stringify(next)); } catch { /* current view still updates */ }
    setCommunityEvents((items) => items.map((item) => {
      if (String(item._id) !== id) return item;
      const attendeeIds = (item.attendees || []).map((person) => String(person?._id || person));
      const currentId = String(user?._id || 'local-preview-user');
      const withoutCurrent = (item.attendees || []).filter((person) => String(person?._id || person) !== currentId);
      return { ...item, attendees: next.includes(id) ? (attendeeIds.includes(currentId) ? item.attendees : [...withoutCurrent, currentId]) : withoutCurrent };
    }));
  };

  const handleSaveSettings = (event) => {
    event.preventDefault();
    const permissions = {
      ...(community.permissions || {}),
      visibility: settingsPolicy.visibility,
      postPolicy: settingsPolicy.postPolicy,
      commentPolicy: settingsPolicy.commentPolicy,
      sharePolicy: settingsPolicy.sharePolicy,
      allowPostRequests: settingsPolicy.allowPostRequests,
      requirePostApproval: settingsPolicy.requirePostApproval,
      allowAnonymousPosts: settingsPolicy.allowAnonymousPosts,
    };
    const patch = {
      name: settingsPolicy.name,
      description: settingsPolicy.description,
      category: settingsPolicy.category,
      maxPinnedPosts: settingsPolicy.maxPinnedPosts,
      permissions,
    };
    setCommunity((current) => ({ ...current, ...patch }));
    const previews = readLocalMap('guf-community-settings-preview');
    previews[String(community._id)] = patch;
    try { localStorage.setItem('guf-community-settings-preview', JSON.stringify(previews)); } catch { /* current page remains interactive */ }
    setLocalActionNotice('Community settings updated in this browser preview only.');
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
  const isMod = Boolean(community.canModerate || isOwner || user?.role === 'admin');
  const modPerms = community.moderationPermissions || {};
  const canManagePostRequests = Boolean(modPerms.manageRequests);
  const canManageSettings = Boolean(isOwner || isMod || modPerms.manageRules || user?.role === 'admin');
  const canPost = true;
  const membershipStatus = community.currentUserMembership?.status || 'none';
  const isMember = membershipStatus === 'active';
  const isPendingJoinRequest = membershipStatus === 'pending';
  const isRejectedJoinRequest = membershipStatus === 'rejected';
  const isPrivateCommunity = community.permissions?.visibility === 'MEMBERS_ONLY';
  const canManageJoinRequests = Boolean(community.canManageJoinRequests || isOwner || user?.role === 'admin');

  return (
    <div className="page-shell page-community-detail">
      {localActionNotice ? <div className="settings-notice" role="status">{localActionNotice}</div> : null}
      {/* Community header and tabs — matched to PDF visual reference, page 3 */}
      <section className="community-reference-header">
        <div className="community-reference-heading">
          <div className="community-reference-title">
            <span className="community-reference-kicker">
              {community.name?.trim().toLowerCase() === 'cse' ? 'CSE Community' : `${community.name || 'University'} Community`}
            </span>
            <h1>
              {community.name?.trim().toLowerCase() === 'cse' ? 'Computer Science & Engineering' : community.name}
            </h1>
            <p>
              {community.name?.trim().toLowerCase() === 'cse'
                ? 'Discussions, projects, DSA, internships and campus tech.'
                : community.description}
            </p>
          </div>
          <div className="community-reference-actions">
            {isOwner ? (
              <span className="community-role-pill">Community Head</span>
            ) : isMember ? (
              <button type="button" className="btn btn-secondary" onClick={handleJoinToggle} disabled={actionLoading}>✓ Joined</button>
            ) : isPendingJoinRequest ? (
              <button type="button" className="btn btn-secondary" disabled>Request Pending</button>
            ) : (
              <button type="button" className="btn btn-primary" onClick={handleJoinToggle} disabled={actionLoading}>
                {isPrivateCommunity ? 'Request to Join' : 'Join Community'}
              </button>
            )}
            {isRejectedJoinRequest && !isOwner ? <span className="community-rejected-note">Previous request rejected</span> : null}
            {canManageSettings ? (
              <button type="button" className="btn btn-outline" onClick={() => setActiveTab('settings')}>Manage Community</button>
            ) : null}
          </div>
        </div>
        <nav className="community-reference-tabs" aria-label="Community sections">
          <button type="button" className={activeTab === 'discussions' ? 'active' : ''} onClick={() => setActiveTab('discussions')}>Discussions</button>
          <button type="button" className={activeTab === 'permissions' ? 'active' : ''} onClick={() => setActiveTab('permissions')}>Rules &amp; Permissions</button>
          <button type="button" className={activeTab === 'members' ? 'active' : ''} onClick={() => setActiveTab('members')}>Members &amp; Mods</button>
        </nav>
      </section>

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

          {/* Right Panel: Community information and leadership */}
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
                <span>Community Info</span>
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
                  <span style={{ color: 'var(--text-muted)', display: 'block' }}>Members</span>
                  <strong>{community.memberCount || 0}</strong>
                </div>
                <div>
                  <span style={{ color: 'var(--text-muted)', display: 'block' }}>Discussions</span>
                  <strong>{community.postCount || posts.length}</strong>
                </div>
                <div>
                  <span style={{ color: 'var(--text-muted)', display: 'block' }}>Moderators</span>
                  <strong>{community.moderators?.length || 0}</strong>
                </div>
              </div>

            </div>


          </div>
        </div>
      )}

      {/* TAB: EVENTS */}
      {activeTab === 'events' && (
        <div className="card community-tab-panel">
          <h3>Community Events</h3>
          {communityEvents.length ? communityEvents.map((eventItem) => {
            const attending = readLocalList('guf-event-rsvp-preview').includes(String(eventItem._id));
            return (
              <article className="community-event-row" key={eventItem._id}>
                <div className="community-event-date"><strong>{new Date(eventItem.date).toLocaleDateString([], { day: '2-digit' })}</strong><span>{new Date(eventItem.date).toLocaleDateString([], { month: 'short' })}</span></div>
                <div className="community-event-copy"><strong>{eventItem.title}</strong><span>{[eventItem.time, eventItem.venue].filter(Boolean).join(' · ')}</span><p>{eventItem.description}</p></div>
                <button type="button" className={attending ? 'btn btn-secondary btn-sm' : 'btn btn-primary btn-sm'} onClick={() => handleToggleEventRsvp(eventItem)}>{attending ? 'Registered' : 'Register'}</button>
              </article>
            );
          }) : <p className="community-tab-empty">No events have been added to this community yet.</p>}
        </div>
      )}

      {/* TAB: RESOURCES */}
      {activeTab === 'resources' && (
        <div className="card community-tab-panel">
          <h3>Community Resources</h3>
          {posts.filter((item) => item.type === 'resource').length ? posts.filter((item) => item.type === 'resource').map((item) => (
            <PostCard key={item._id} post={item} modPermissions={modPerms} onPostUpdated={loadCommunityData} />
          )) : <p className="community-tab-empty">No resources have been shared in this community yet.</p>}
        </div>
      )}

      {/* TAB: PERMISSIONS */}
      {activeTab === 'permissions' && (
        <div className="card" style={{ padding: '24px' }}>
          <h3 style={{ fontSize: '1.1rem', fontWeight: 800, marginBottom: '16px' }}>
            Permissions & Community Rules
          </h3>
          <div className="community-policy-grid">
            <div><span>Visibility</span><strong>{community.permissions?.visibility || 'PUBLIC'}</strong></div>
            <div><span>Posting Policy</span><strong>{community.permissions?.postPolicy || 'MEMBERS'}</strong></div>
            <div><span>Comment Policy</span><strong>{community.permissions?.commentPolicy || 'EVERYONE'}</strong></div>
            <div><span>Share Policy</span><strong>{community.permissions?.sharePolicy || 'EVERYONE'}</strong></div>
            <div><span>Moderator Approval</span><strong>{community.permissions?.requirePostApproval ? 'Required' : 'Not required'}</strong></div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', marginTop: '20px' }}>
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
                      <span className="community-request-avatar" aria-hidden="true">{getCommunityInitials(post.author?.name)}</span>
                      <div>
                        <div style={{ fontWeight: 700, fontSize: '0.9rem' }}>
                          {post.author?.name || 'Member'}
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
                      <span className="community-request-avatar" aria-hidden="true">{getCommunityInitials(req.user?.name)}</span>
                      <div>
                        <div style={{ fontWeight: 700, fontSize: '0.9rem' }}>
                          {req.user?.name || 'Member'}
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

      {showRequestModal ? (
        <div className="modal-overlay" role="presentation" onClick={(event) => { if (event.target === event.currentTarget) setShowRequestModal(false); }}>
          <section className="modal-content create-post-request-preview" role="dialog" aria-modal="true" aria-label="Request to post">
            <h3>Request to Post</h3>
            <p>Your request can be previewed here. No request is sent to the community server during this phase.</p>
            <button type="button" className="btn btn-primary" onClick={() => { setShowRequestModal(false); setLocalActionNotice('Post request recorded in this browser preview only.'); }}>Confirm Preview</button>
          </section>
        </div>
      ) : null}    </div>
  );
};

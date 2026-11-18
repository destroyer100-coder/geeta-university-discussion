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
  const [communityMembers, setCommunityMembers] = useState([]);
  const [postFilter, setPostFilter] = useState('all');
  const [postSearch, setPostSearch] = useState('');
  const [postSort, setPostSort] = useState('latest');
  const [showCommunityDetails, setShowCommunityDetails] = useState(false);
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

        try {
          const membersRes = await communitiesApi.getMembers(comm._id);
          setCommunityMembers(membersRes?.success && Array.isArray(membersRes.data) ? membersRes.data : []);
        } catch {
          setCommunityMembers([]);
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

  const handleJoinToggle = async () => {
    if (!community || actionLoading) return;
    setActionLoading(true);
    try {
      const response = isMember
        ? await communitiesApi.leave(community._id)
        : await communitiesApi.join(community._id);
      if (!response?.success) throw new Error(response?.message || 'Unable to update membership.');
      await loadCommunityData();
      setLocalActionNotice(isMember ? 'You left this community.' : 'Your community membership was updated.');
    } catch (error) {
      setLocalActionNotice(error.message || 'Unable to update community membership.');
    } finally {
      setActionLoading(false);
    }
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
      {/* Community hero and complete navigation from the supplied CSE Hub reference */}
      <section className="community-hub-hero">
        <div className="community-hub-hero-content">
          <div className="community-hub-identity">
            <span className="community-hub-mark"><Icon name="graduationCap" size={36} /></span>
            <div>
              <span className="community-hub-eyebrow">{community.name?.trim().toLowerCase() === 'cse' ? 'CSE HUB' : 'COMMUNITY HUB'}</span>
              <h1>{community.name?.trim().toLowerCase() === 'cse' ? 'CSE Hub' : community.name}</h1>
              <p>{community.name?.trim().toLowerCase() === 'cse' ? 'Computer Science & Engineering' : community.description}</p>
            </div>
          </div>
          <div className="community-hub-hero-actions">
            <button type="button" className={isMember ? 'community-joined-button' : 'community-join-button'} onClick={handleJoinToggle} disabled={actionLoading || isOwner}>
              <Icon name={isMember ? 'check' : 'plus'} size={16} />
              {actionLoading ? 'Please wait…' : isMember ? 'Joined' : isPendingJoinRequest ? 'Request Pending' : isPrivateCommunity ? 'Request to Join' : 'Join Community'}
              <Icon name="chevronDown" size={15} />
            </button>
            <span className="community-hero-stat"><Icon name="users" size={19} />{Number(community.memberCount || communityMembers.length || 0).toLocaleString()}</span>
            <span className="community-hero-stat"><Icon name="messageSquare" size={19} />{Number(community.postCount ?? posts.length).toLocaleString()}</span>
            <span className="community-hero-stat"><Icon name="fileText" size={19} />{posts.filter((post) => post.type === 'resource').length.toLocaleString()}</span>
            <button type="button" className="community-hero-more" onClick={() => setShowCommunityDetails((value) => !value)} aria-label="More community details"><Icon name="moreHorizontal" size={22} /></button>
          </div>
        </div>
      </section>

      <div className="community-hub-layout">
        <div className="community-hub-main">
          <nav className="community-hub-tabs" aria-label="Community navigation">
            {[
              ['discussions', 'messageSquare', 'Discussions'],
              ['members', 'users', 'Members'],
              ['events', 'calendar', 'Events'],
              ['resources', 'fileText', 'Resources'],
              ['permissions', 'shieldCheck', 'Permissions'],
              ...(isMod ? [['audit', 'fileText', 'Audit Logs']] : []),
              ...(canManageSettings ? [['settings', 'settings', 'Settings']] : []),
              ...(canManagePostRequests ? [['requests', 'archive', 'Requests']] : []),
            ].map(([key, iconName, label]) => (
              <button type="button" key={key} className={activeTab === key ? 'active' : ''} onClick={() => setActiveTab(key)}>
                <Icon name={iconName} size={18} />{label}
                {key === 'members' ? <span>{Number(community.memberCount || communityMembers.length || 0).toLocaleString()}</span> : null}
              </button>
            ))}
          </nav>
      {/* Discussions: real community posts with client-side discovery controls */}
      {activeTab === 'discussions' && (
        <>
          <div className="community-post-toolbar">
            <div className="community-post-filters">
              {[
                ['all', 'All Posts', 'layers'],
                ['trending', 'Trending', 'trendingUp'],
                ['unanswered', 'Unanswered', 'helpCircle'],
                ['announcements', 'Announcements', 'megaphone'],
              ].map(([key, label, iconName]) => (
                <button type="button" key={key} className={postFilter === key ? 'active' : ''} onClick={() => setPostFilter(key)}>
                  <Icon name={iconName} size={16} />{label}
                </button>
              ))}
            </div>
            <div className="community-post-tools">
              <label className="community-sort-control">
                <Icon name="filter" size={16} />
                <select value={postSort} onChange={(event) => setPostSort(event.target.value)} aria-label="Sort community discussions">
                  <option value="latest">Latest</option>
                  <option value="popular">Most popular</option>
                  <option value="oldest">Oldest</option>
                </select>
              </label>
              <label className="community-search-control">
                <Icon name="search" size={16} />
                <input type="search" value={postSearch} onChange={(event) => setPostSearch(event.target.value)} placeholder="Search in this community…" />
              </label>
              <button type="button" className="community-create-discussion" onClick={() => onOpenCreatePostWithCommunity?.(community._id)} disabled={!onOpenCreatePostWithCommunity || !canPost}>
                <Icon name="plus" size={18} />Create Discussion
              </button>
            </div>
          </div>

          <div className="community-hub-content-grid">
            <section className="community-post-feed" aria-label="Community discussions">
              {!canPost ? (
                <div className="community-post-permission"><Icon name="lock" size={18} /><span>{community.currentUserPermission?.reason || 'Posting is restricted in this community.'}</span>{community.permissions?.allowPostRequests ? <button type="button" onClick={() => setShowRequestModal(true)}>Request to Post</button> : null}</div>
              ) : null}
              {(() => {
                const query = postSearch.trim().toLowerCase();
                let visiblePosts = posts.filter((post) => {
                  const text = [post.title, post.content, post.body, post.description].filter(Boolean).join(' ').toLowerCase();
                  if (query && !text.includes(query)) return false;
                  if (postFilter === 'announcements' && !(post.type === 'announcement' || post.category === 'ANNOUNCEMENT' || post.isAnnouncement)) return false;
                  if (postFilter === 'unanswered' && Number(post.commentCount ?? post.commentsCount ?? post.comments?.length ?? 0) > 0) return false;
                  return true;
                });
                if (postFilter === 'trending' || postSort === 'popular') {
                  visiblePosts = [...visiblePosts].sort((a, b) => Number(b.likeCount || b.likes?.length || 0) + Number(b.commentCount || b.comments?.length || 0) * 2 - (Number(a.likeCount || a.likes?.length || 0) + Number(a.commentCount || a.comments?.length || 0) * 2));
                } else if (postSort === 'oldest') {
                  visiblePosts = [...visiblePosts].reverse();
                } else {
                  visiblePosts = [...visiblePosts].sort((a, b) => Number(Boolean(b.isPinned || b.pinned)) - Number(Boolean(a.isPinned || a.pinned)));
                }
                return visiblePosts.length ? visiblePosts.map((post) => <PostCard key={post._id} post={post} modPermissions={modPerms} onPostUpdated={loadCommunityData} />) : (
                  <div className="community-empty-feed"><Icon name="messageSquare" size={28} /><strong>{posts.length ? 'No discussions match these filters.' : 'No discussions have been published yet.'}</strong><span>{posts.length ? 'Try another filter or search term.' : 'Start the first discussion in this community.'}</span>{!posts.length && canPost && onOpenCreatePostWithCommunity ? <button type="button" className="community-create-discussion" onClick={() => onOpenCreatePostWithCommunity(community._id)}><Icon name="plus" size={17} />Start First Discussion</button> : null}</div>
                );
              })()}
            </section>

            <aside className="community-hub-right-rail">
              <section className="community-rail-card">
                <button type="button" className="community-rail-primary" onClick={() => onOpenCreatePostWithCommunity?.(community._id)} disabled={!onOpenCreatePostWithCommunity || !canPost}><Icon name="plus" size={19} />Create Discussion</button>
                <button type="button" className="community-rail-link" onClick={() => setShowCommunityDetails((value) => !value)}><Icon name="info" size={20} />Community Details<Icon name="chevronRight" size={17} /></button>
                {showCommunityDetails ? <div className="community-rail-expanded">{community.description || 'No community description provided.'}<span>Visibility: {community.permissions?.visibility === 'PUBLIC' ? 'Public' : 'Members only'}</span></div> : null}
                <button type="button" className="community-rail-link" onClick={() => setActiveTab('members')}><Icon name="users" size={20} />Members ({Number(community.memberCount || communityMembers.length || 0).toLocaleString()})<Icon name="chevronRight" size={17} /></button>
                <button type="button" className="community-rail-link" onClick={() => setActiveTab('permissions')}><Icon name="calendar" size={20} />Community Rules<Icon name="chevronRight" size={17} /></button>
                <div className="community-quick-stats">
                  <h3><Icon name="barChart2" size={20} />Quick Stats</h3>
                  <div className="community-stat-grid">
                    <div><strong>{Number(community.postCount ?? posts.length).toLocaleString()}</strong><span>Discussions</span></div>
                    <div><strong>{Number(community.memberCount || communityMembers.length || 0).toLocaleString()}</strong><span>Members</span></div>
                    <div><strong>{posts.filter((post) => post.type === 'resource').length.toLocaleString()}</strong><span>Resources</span></div>
                  </div>
                </div>
                <div className="community-moderation-summary">
                  <h3><Icon name="shieldCheck" size={20} />Moderation</h3>
                  <button type="button" onClick={() => isMod ? setActiveTab('audit') : setActiveTab('permissions')}>
                    <Icon name={isMod ? 'checkCircle2' : 'lock'} size={18} />{isMod ? 'You have moderation access' : 'View community rules'}<Icon name="chevronRight" size={17} />
                  </button>
                </div>
              </section>
            </aside>
          </div>
        </>
      )}

      <div className="community-hub-secondary-content">
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

      {/* Members directory — fetched from the community members endpoint */}
      {activeTab === 'members' && (
        <section className="card community-tab-panel">
          <h2>Community Members</h2>
          <p className="community-tab-intro">{Number(community.memberCount || communityMembers.length || 0).toLocaleString()} members in this community</p>
          {communityMembers.length ? <div className="community-members-grid">{communityMembers.map((member) => {
            const person = member.user || member.member || member;
            const personId = person._id || member._id;
            const role = member.role || member.membershipRole || (String(personId) === String(community.owner?._id) ? 'HEAD' : 'MEMBER');
            return <article className="community-member-card" key={personId}><span className="community-member-avatar">{person.avatar ? <img src={person.avatar} alt="" /> : getCommunityInitials(person.name || 'Member')}</span><span className="community-member-copy"><strong>{person.name || 'University member'}</strong><small>{role === 'HEAD' || role === 'OWNER' ? 'Community Head' : role === 'MODERATOR' ? 'Moderator' : 'Member'}</small></span></article>;
          })}</div> : <p className="community-tab-empty">Member details are not available from the server yet.</p>}
        </section>
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

      </div>

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

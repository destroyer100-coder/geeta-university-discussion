
import React, { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { communitiesApi } from '../../../services/api';
import { useAuth } from '../../../context/AuthContext';
import { Icon } from '../../../components/common/Icons';
import { PageHero } from '../../../components/common/PageHero';

const CATEGORIES = [
  'All',
  'CSE',
  'ECE',
  'Placement',
  'Clubs',
  'Events',
  'Hostel',
  'Academics',
  'Sports',
  'General',
];

export const CommunityList = () => {
  const { user } = useAuth();

  const [communities, setCommunities] = useState([]);
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [selectedScope, setSelectedScope] = useState('all');
  const [sortBy, setSortBy] = useState('members');
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);
  const [joiningId, setJoiningId] = useState(null);

  const fetchCommunities = async () => {
    setLoading(true);

    try {
      const params = { sort: sortBy };

      if (searchTerm.trim()) {
        params.search = searchTerm.trim();
      }

      const res = await communitiesApi.getAll(params);

      if (res.success && res.data) {
        setCommunities(res.data);
      } else {
        setCommunities([]);
      }
    } catch (err) {
      console.error('Failed to load communities:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCommunities();
  }, [searchTerm, sortBy, user?._id]);

  const visibleCommunities = useMemo(() => communities.filter((community) => {
    const ownerId = community.owner?._id || community.owner;
    const role = community.currentUserRole || (ownerId === user?._id ? 'owner' : '');
    const isManaged = ['owner', 'moderator'].includes(role);
    const isJoined = Boolean(community.isCurrentUserMember);
    const matchesScope =
      selectedScope === 'mine' ? (isJoined || isManaged) :
      selectedScope === 'joined' ? isJoined :
      selectedScope === 'managed' ? isManaged : true;
    const matchesCategory = selectedCategory === 'All' || community.category === selectedCategory;
    return matchesScope && matchesCategory;
  }), [communities, selectedScope, selectedCategory, user?._id]);

  const categoryCounts = useMemo(() => {
    const counts = {};
    communities.forEach((community) => {
      const category = community.category || 'General';
      counts[category] = (counts[category] || 0) + 1;
    });
    return counts;
  }, [communities]);

  const recommendedCommunities = useMemo(() => communities
    .filter((community) => !community.isCurrentUserMember && !['owner', 'moderator'].includes(community.currentUserRole))
    .slice()
    .sort((a, b) => (Number(b.memberCount) || 0) - (Number(a.memberCount) || 0))
    .slice(0, 3), [communities]);

  const handleJoinToggle = async (communityId, isJoined) => {
    if (!user) {
      alert(
        'Please sign in to join this community.'
      );
      return;
    }

    setJoiningId(communityId);

    try {
      const res = isJoined
        ? await communitiesApi.leave(communityId)
        : await communitiesApi.join(communityId);

      if (res.success) {
        await fetchCommunities();
      }
    } catch (err) {
      alert(err.message || 'Action failed');
      await fetchCommunities();
    } finally {
      setJoiningId(null);
    }
  };

  return (
    <div className="page-shell page-communities">
      <PageHero
        icon="users"
        title="Communities"
        description="Join interest-based groups, department communities and campus circles."
      />

      <div className="communities-workspace">
      <main className="communities-main">
      <div className="page-tabs community-scope-tabs" role="tablist" aria-label="Community views">
        {[
          { key: 'all', label: 'All Communities' },
          { key: 'mine', label: 'My Communities' },
          { key: 'joined', label: 'Joined' },
          { key: 'managed', label: 'Managed' },
        ].map((tab) => (
          <button
            type="button"
            key={tab.key}
            role="tab"
            aria-selected={selectedScope === tab.key}
            className={selectedScope === tab.key ? 'btn btn-primary' : 'btn btn-secondary'}
            onClick={() => setSelectedScope(tab.key)}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div className="page-toolbar page-communities-toolbar">
        <label className="page-toolbar-search community-search">
          <Icon name="search" size={17} />
          <input
            type="search"
            className="form-control"
            placeholder="Search communities by name or topic..."
            value={searchTerm}
            onChange={(event) => setSearchTerm(event.target.value)}
          />
        </label>
        <div className="community-toolbar-controls">
          <select className="form-control" value={selectedCategory} onChange={(event) => setSelectedCategory(event.target.value)} aria-label="Filter by category">
            {CATEGORIES.map((category) => <option key={category} value={category}>{category === 'All' ? 'All Categories' : category}</option>)}
          </select>
          <select className="form-control" value={sortBy} onChange={(event) => setSortBy(event.target.value)} aria-label="Sort communities">
            <option value="members">Most Members</option>
            <option value="activity">Most Active</option>
            <option value="newest">Newest</option>
          </select>
        </div>
      </div>
      {selectedScope !== 'all' ? (
        <p className="community-scope-note">
          {selectedScope === 'mine'
            ? 'Showing communities you have joined or manage from the public discovery results.'
            : selectedScope === 'joined'
              ? 'Showing joined communities from the public discovery results.'
              : 'Showing communities you own or moderate from the public discovery results.'}
          {' '}Private communities are not included in this discovery endpoint.
        </p>
      ) : null}

      {loading ? (
        <div className="loading-state">
          <div className="spinner" />
          <p>Loading communities...</p>
        </div>
      ) : visibleCommunities.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-icon">🏫</div>
          <h3>{selectedScope === 'joined' ? 'No joined communities in this view' : selectedScope === 'managed' ? 'No managed communities in this view' : 'No communities found'}</h3>
          <p>Try adjusting your search, category or community view.</p>
        </div>
      ) : (
        <div
          className="community-grid"
          style={{
            display: 'grid',
            gridTemplateColumns:
              'repeat(auto-fill, minmax(min(320px, 100%), 1fr))',
            gap: '16px',
          }}
        >
          {visibleCommunities.map((c) => {
            const isMember = c.isCurrentUserMember;
            const membershipStatus = c.currentUserMembershipStatus;
            const isPending = membershipStatus === 'pending';
            const isPrivate =
              c.permissions?.visibility === 'MEMBERS_ONLY';
            const isOwner = user && (c.owner?._id || c.owner) === user._id;

            return (
              <div
                key={c._id}
                className="card community-card"
              >
                <div
                  style={{
                    display: 'flex',
                    gap: '12px',
                    alignItems: 'center',
                    marginBottom: '12px',
                  }}
                >
                  {c.avatar ? (
                    <img
                      className="community-card-avatar"
                      src={c.avatar}
                      alt={c.name || ''}
                      loading="lazy"
                      decoding="async"
                    />
                  ) : (
                    <span className="community-card-avatar community-avatar-initials" aria-hidden="true">
                      {(c.name || 'C').trim().split(/\s+/).slice(0, 2).map((part) => part[0]).join('').toUpperCase()}
                    </span>
                  )}

                  <div style={{ minWidth: 0, flex: 1 }}>
                    <h3
                      style={{
                        fontSize: '1rem',
                        fontWeight: 700,
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                      }}
                    >
                      <Link to={`/communities/${c.slug || c._id}`}>
                        {c.name}
                      </Link>
                    </h3>

                    <div
                      style={{
                        display: 'flex',
                        gap: '6px',
                        alignItems: 'center',
                        marginTop: '2px',
                      }}
                    >
                      <span
                        className="badge badge-primary"
                        style={{ fontSize: '0.675rem' }}
                      >
                        {c.category || c.type}
                      </span>

                      {isPrivate && (
                        <span
                          className="badge"
                          style={{
                            fontSize: '0.675rem',
                            background: '#fef3c7',
                            color: '#92400e',
                          }}
                        >
                          🔒 Private
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                <p className="community-card-description">
                  {c.description}
                </p>

                <div className="community-card-footer">
                  <div className="community-card-stats">
                    👥 <strong>{c.memberCount || 0}</strong> Members • 💬{' '}
                    <strong>{c.postCount || 0}</strong> Posts
                  </div>

                  <div
                    style={{
                      display: 'flex',
                      gap: '8px',
                      alignItems: 'center',
                    }}
                  >
                    {isOwner ? (
                      <span
                        className="badge badge-primary"
                        style={{ fontSize: '0.7rem' }}
                      >
                        Head
                      </span>
                    ) : isPending ? (
                      <span
                        className="badge"
                        style={{
                          fontSize: '0.7rem',
                          background: '#fef3c7',
                          color: '#92400e',
                        }}
                      >
                        ⏳ Pending
                      </span>
                    ) : (
                      <button
                        type="button"
                        className={`btn btn-sm ${
                          isMember ? 'btn-secondary' : 'btn-primary'
                        }`}
                        disabled={joiningId === c._id}
                        onClick={() =>
                          handleJoinToggle(c._id, isMember)
                        }
                        style={{
                          fontSize: '0.75rem',
                          padding: '4px 10px',
                        }}
                      >
                        {joiningId === c._id
                          ? '...'
                          : isMember
                            ? 'Joined'
                            : isPrivate
                              ? 'Request to Join'
                              : '+ Join'}
                      </button>
                    )}

                    <Link
                      to={`/communities/${c.slug || c._id}`}
                      className="btn btn-outline btn-sm"
                      style={{
                        fontSize: '0.75rem',
                        padding: '4px 8px',
                      }}
                    >
                      View →
                    </Link>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
      </main>

      <aside className="communities-side">
        {user ? (
          <Link to="/communities/create" className="btn btn-primary communities-side-create">
            <Icon name="plus" size={18} /> Create a Community
          </Link>
        ) : null}

        <section className="card communities-side-card">
          <h2 className="communities-side-title"><Icon name="bookmark" size={18} /> Categories</h2>
          {CATEGORIES.map((category) => (
            <button
              type="button"
              key={category}
              className={selectedCategory === category ? 'community-category-option active' : 'community-category-option'}
              onClick={() => setSelectedCategory(category)}
            >
              <span>{category === 'All' ? 'All Categories' : category}</span>
              <strong>{category === 'All' ? communities.length : (categoryCounts[category] || 0)}</strong>
            </button>
          ))}
        </section>

        <section className="card communities-side-card">
          <h2 className="communities-side-title"><Icon name="trendingUp" size={18} /> Recommended</h2>
          {recommendedCommunities.length ? recommendedCommunities.map((community) => (
            <div className="community-recommendation" key={community._id}>
              <span aria-hidden="true">
                {(community.name || 'C').trim().split(/\s+/).slice(0, 2).map((part) => part[0]).join('').toUpperCase()}
              </span>
              <div className="community-recommendation-copy">
                <strong>{community.name}</strong>
                <small>{community.category || 'Community'} · {community.memberCount || 0} members</small>
              </div>
              {community.isCurrentUserMember ? (
                <span className="badge badge-success">Joined</span>
              ) : (
                <button
                  type="button"
                  className="btn btn-outline btn-sm"
                  disabled={joiningId === community._id}
                  onClick={() => handleJoinToggle(community._id, false)}
                >
                  {joiningId === community._id ? '...' : 'Join'}
                </button>
              )}
            </div>
          )) : (
            <p className="community-scope-note">No recommendations are available from the current community records.</p>
          )}
        </section>
      </aside>
      </div>
    </div>
  );
};

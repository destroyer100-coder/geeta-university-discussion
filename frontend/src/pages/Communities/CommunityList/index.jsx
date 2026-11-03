import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { communitiesApi } from '../../../services/api';
import { useAuth } from '../../../context/AuthContext';
import { Icon } from '../../../components/common/Icons';

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
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);
  const [joiningId, setJoiningId] = useState(null);

  const fetchCommunities = async () => {
    setLoading(true);
    try {
      const params = {};
      if (selectedCategory && selectedCategory !== 'All') params.category = selectedCategory;
      if (searchTerm.trim()) params.search = searchTerm.trim();
      const res = await communitiesApi.getAll(params);
      setCommunities(res.success && res.data ? res.data : []);
    } catch (err) {
      console.error('Failed to load communities:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCommunities();
  }, [selectedCategory, searchTerm, user]);

  const handleJoinToggle = async (communityId, isJoined) => {
    if (!user) {
      alert('Please log in first or select a demo persona from the top right menu.');
      return;
    }
    setJoiningId(communityId);
    try {
      const res = isJoined
        ? await communitiesApi.leave(communityId)
        : await communitiesApi.join(communityId);
      if (res.success) await fetchCommunities();
    } catch (err) {
      alert(err.message || 'Action failed');
      await fetchCommunities();
    } finally {
      setJoiningId(null);
    }
  };

  return (
    <div className="community-discovery-page">
      <header className="page-header community-page-header">
        <div>
          <span className="page-eyebrow"><Icon name="users" size={13} /> CAMPUS NETWORK</span>
          <h1>Find your community</h1>
          <p>Join department hubs, student clubs, placement circles and academic channels.</p>
        </div>
        {user && (
          <Link to="/communities/create" className="btn btn-primary">
            <Icon name="plus" size={16} aria-hidden="true" />
            Create Community
          </Link>
        )}
      </header>

      <section className="community-discovery-toolbar" aria-label="Find communities">
        <label className="community-search">
          <Icon name="search" size={17} aria-hidden="true" />
          <span className="sr-only">Search communities</span>
          <input
            type="search"
            className="form-control"
            placeholder="Search by community name or topic…"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
          {searchTerm && (
            <button type="button" className="btn-icon" aria-label="Clear search" onClick={() => setSearchTerm('')}>
              <Icon name="x" size={16} />
            </button>
          )}
        </label>

        <div className="community-category-filters" role="group" aria-label="Filter by category">
          {CATEGORIES.map((cat) => (
            <button
              key={cat}
              type="button"
              className={`community-category-chip${selectedCategory === cat ? ' is-active' : ''}`}
              onClick={() => setSelectedCategory(cat)}
              aria-pressed={selectedCategory === cat}
            >
              {cat === 'All' ? 'All communities' : cat}
            </button>
          ))}
        </div>
      </section>

      <div className="community-results-heading">
        <h2>{selectedCategory === 'All' ? 'Campus communities' : selectedCategory}</h2>
        {!loading && <span>{communities.length} {communities.length === 1 ? 'community' : 'communities'}</span>}
      </div>

      {loading ? (
        <div className="loading-state" role="status" aria-live="polite">
          <div className="spinner" aria-hidden="true" />
          <p>Loading communities…</p>
        </div>
      ) : communities.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-icon"><Icon name="users" size={24} /></div>
          <h3>No communities found</h3>
          <p>Try another search or category. You can also create a community for your campus group.</p>
          {user && (
            <Link to="/communities/create" className="btn btn-primary">
              <Icon name="plus" size={16} aria-hidden="true" />
              Create Community
            </Link>
          )}
        </div>
      ) : (
        <div className="community-grid">
          {communities.map((community) => {
            const isMember = community.isCurrentUserMember;
            const membershipStatus = community.currentUserMembershipStatus;
            const isPending = membershipStatus === 'pending';
            const isPrivate = community.permissions?.visibility === 'MEMBERS_ONLY';
            const isOwner = user && community.owner?._id === user._id;

            return (
              <article key={community._id} className="community-card">
                <div className="community-card-banner" aria-hidden="true" />
                <div className="community-card-body">
                  <div className="community-card-header">
                    <img
                      className="community-card-avatar"
                      src={community.avatar}
                      alt=""
                      loading="lazy"
                    />
                    <div className="community-card-info">
                      <h3 className="community-card-name">
                        <Link to={`/communities/${community.slug || community._id}`}>
                          {community.name}
                        </Link>
                      </h3>
                      <div className="community-card-badges">
                        <span className="badge badge-primary">{community.category || community.type}</span>
                        {isPrivate && (
                          <span className="badge badge-warning">
                            <Icon name="lock" size={11} aria-hidden="true" /> Private
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  <p className="community-card-description">
                    {community.description || 'A place for students to connect, share and learn.'}
                  </p>
                  {(community.tags || []).length > 0 && (
                    <div className="community-card-tags" aria-label="Community topics">
                      {community.tags.slice(0, 4).map((tag) => <span key={tag}>#{tag}</span>)}
                      {community.tags.length > 4 && <small>+{community.tags.length - 4}</small>}
                    </div>
                  )}

                  <div className="community-card-footer">
                    <div className="community-card-stats">
                      <span><Icon name="users" size={13} aria-hidden="true" /> <strong>{community.memberCount || 0}</strong> members</span>
                      <span><Icon name="messageSquare" size={13} aria-hidden="true" /> <strong>{community.postCount || 0}</strong> posts</span>
                    </div>

                    <div className="community-card-actions">
                      {isOwner ? (
                        <span className="badge badge-primary">Community head</span>
                      ) : isPending ? (
                        <span className="badge badge-warning">Pending approval</span>
                      ) : (
                        <button
                          type="button"
                          className={`btn btn-sm ${isMember ? 'btn-secondary' : 'btn-primary'}`}
                          disabled={joiningId === community._id}
                          onClick={() => handleJoinToggle(community._id, isMember)}
                        >
                          {joiningId === community._id
                            ? 'Please wait…'
                            : isMember
                              ? 'Joined'
                              : isPrivate
                                ? 'Request to join'
                                : 'Join'}
                        </button>
                      )}

                      <Link
                        to={`/communities/${community.slug || community._id}`}
                        className="btn btn-outline btn-sm"
                      >
                        View
                        <Icon name="arrowRight" size={13} aria-hidden="true" />
                      </Link>
                    </div>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
};

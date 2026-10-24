
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

      if (selectedCategory && selectedCategory !== 'All') {
        params.category = selectedCategory;
      }

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
  }, [selectedCategory, searchTerm, user]);

  const handleJoinToggle = async (communityId, isJoined) => {
    if (!user) {
      alert(
        'Please log in first or select a demo persona from the top right menu.'
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
    <div>
      <div className="page-header">
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '16px',
          }}
        >
          <div>
            <h1>Explore University Communities</h1>
            <p>
              Discover department hubs, student clubs, placement circles and
              academic channels.
            </p>
          </div>

          {user && (
            <Link
              to="/communities/create"
              className="btn btn-primary"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
              }}
            >
              <Icon name="plus" size={16} />
              Create Community
            </Link>
          )}
        </div>
      </div>

      <div
        style={{
          marginBottom: '24px',
          display: 'flex',
          flexDirection: 'column',
          gap: '12px',
        }}
      >
        <div style={{ maxWidth: '400px' }}>
          <input
            type="text"
            className="form-control"
            placeholder="Search communities by name or topic..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>

        <div
          style={{
            display: 'flex',
            gap: '8px',
            overflowX: 'auto',
            paddingBottom: '6px',
          }}
        >
          {CATEGORIES.map((cat) => (
            <button
              key={cat}
              type="button"
              className={`btn btn-sm ${
                selectedCategory === cat ? 'btn-primary' : 'btn-outline'
              }`}
              onClick={() => setSelectedCategory(cat)}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="loading-state">
          <div className="spinner" />
          <p>Loading communities...</p>
        </div>
      ) : communities.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-icon">🏫</div>
          <h3>No communities found</h3>
          <p>Try adjusting your search or category filter.</p>
        </div>
      ) : (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns:
              'repeat(auto-fill, minmax(min(320px, 100%), 1fr))',
            gap: '16px',
          }}
        >
          {communities.map((c) => {
            const isMember = c.isCurrentUserMember;
            const membershipStatus = c.currentUserMembershipStatus;
            const isPending = membershipStatus === 'pending';
            const isPrivate =
              c.permissions?.visibility === 'MEMBERS_ONLY';
            const isOwner = user && c.owner?._id === user._id;

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
                  <img
                    className="community-card-avatar"
                    src={c.avatar}
                    alt={c.name || 'Community'}
                  />

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
    </div>
  );
};

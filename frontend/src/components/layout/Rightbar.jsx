import React, { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Icon } from '../common/Icons';
import { eventsApi, postsApi, communitiesApi } from '../../services/api';
import { useAuth } from '../../context/AuthContext';

const initials = (name = '') =>
  name.trim().split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]).join('').toUpperCase() || 'U';

export const Rightbar = () => {
  const { user } = useAuth();
  const [events, setEvents] = useState([]);
  const [trendingPosts, setTrendingPosts] = useState([]);
  const [communities, setCommunities] = useState([]);
  const [loading, setLoading] = useState(true);
  const [joiningId, setJoiningId] = useState('');
  const [joinError, setJoinError] = useState('');

  const loadDiscovery = useCallback(async () => {
    setLoading(true);
    const [eventResult, postResult, communityResult] = await Promise.allSettled([
      eventsApi.getAll({ upcoming: 'true' }),
      postsApi.getAll({ sort: 'trending', page: 1, limit: 4 }),
      communitiesApi.getAll({ sort: 'members' }),
    ]);

    setEvents(eventResult.status === 'fulfilled' && Array.isArray(eventResult.value?.data)
      ? eventResult.value.data.slice(0, 3)
      : []);
    setTrendingPosts(postResult.status === 'fulfilled' && Array.isArray(postResult.value?.data)
      ? postResult.value.data.slice(0, 4)
      : []);
    setCommunities(communityResult.status === 'fulfilled' && Array.isArray(communityResult.value?.data)
      ? communityResult.value.data
          .filter((community) => !community.isCurrentUserMember && community.currentUserMembershipStatus !== 'pending')
          .slice(0, 4)
      : []);
    setLoading(false);
  }, []);

  useEffect(() => { loadDiscovery(); }, [loadDiscovery]);

  const handleJoin = async (community) => {
    if (!user?._id) return;
    setJoiningId(String(community._id));
    setJoinError('');
    try {
      const response = await communitiesApi.join(community._id);
      if (!response?.success) throw new Error(response?.message || 'Could not join this community.');
      await loadDiscovery();
    } catch (error) {
      setJoinError(error.message || 'Could not join this community.');
    } finally {
      setJoiningId('');
    }
  };

  return (
    <aside className="right-sidebar home-discovery-rail">
      <section className="card rightbar-discovery-card">
        <header className="rightbar-card-heading">
          <h2><Icon name="calendar" size={18} /> Upcoming Events</h2>
          <Link to="/events">View All</Link>
        </header>
        {loading && events.length === 0 ? (
          <p className="rightbar-discovery-status">Loading events…</p>
        ) : events.length ? (
          <div className="rightbar-event-list">
            {events.map((event) => {
              const date = new Date(event.date);
              return (
                <Link to={`/events/${event._id}`} className="rightbar-event-row" key={event._id}>
                  <span className="rightbar-event-date">
                    <strong>{date.getDate()}</strong>
                    <small>{date.toLocaleString('en-US', { month: 'short' })}</small>
                  </span>
                  <span className="rightbar-event-copy">
                    <strong>{event.title}</strong>
                    <small>{event.community?.name || event.venue || 'University event'}</small>
                  </span>
                  <Icon name="chevronRight" size={16} />
                </Link>
              );
            })}
          </div>
        ) : (
          <p className="rightbar-discovery-status">No upcoming events have been published.</p>
        )}
      </section>

      <section className="card rightbar-discovery-card">
        <header className="rightbar-card-heading">
          <h2><Icon name="trendingUp" size={18} /> Trending Discussions</h2>
          <Link to="/explore">View All</Link>
        </header>
        {loading && trendingPosts.length === 0 ? (
          <p className="rightbar-discovery-status">Loading discussions…</p>
        ) : trendingPosts.length ? (
          <ol className="rightbar-trending-list">
            {trendingPosts.map((post, index) => (
              <li key={post._id}>
                <span className="rightbar-trending-rank">{index + 1}</span>
                <Link to={`/discussions/${post._id}`}>
                  <strong>{post.title || 'Untitled discussion'}</strong>
                  <small>{post.community?.name || 'Campus-wide'} · {post.commentsCount || post.commentCount || 0} comments</small>
                </Link>
              </li>
            ))}
          </ol>
        ) : (
          <p className="rightbar-discovery-status">Trending discussions will appear here.</p>
        )}
      </section>

      <section className="card rightbar-discovery-card">
        <header className="rightbar-card-heading">
          <h2><Icon name="users" size={18} /> Suggested Communities</h2>
          <Link to="/communities">View All</Link>
        </header>
        {joinError ? <p className="rightbar-discovery-error" role="alert">{joinError}</p> : null}
        {loading && communities.length === 0 ? (
          <p className="rightbar-discovery-status">Loading communities…</p>
        ) : communities.length ? (
          <div className="rightbar-suggested-list">
            {communities.map((community) => (
              <div className="rightbar-suggested-row" key={community._id}>
                {community.avatar ? (
                  <img src={community.avatar} alt="" loading="lazy" decoding="async" />
                ) : (
                  <span className="rightbar-suggested-avatar">{initials(community.name)}</span>
                )}
                <Link to={`/communities/${community.slug || community._id}`}>
                  <strong>{community.name}</strong>
                  <small>{community.memberCount || community.membersCount || 0} members</small>
                </Link>
                {user?._id ? (
                  <button type="button" onClick={() => handleJoin(community)} disabled={joiningId === String(community._id)}>
                    {joiningId === String(community._id) ? '…' : 'Join'}
                  </button>
                ) : (
                  <Link className="rightbar-suggested-join" to="/login">Join</Link>
                )}
              </div>
            ))}
          </div>
        ) : (
          <p className="rightbar-discovery-status">You’re up to date with available communities.</p>
        )}
      </section>
    </aside>
  );
};

export default Rightbar;

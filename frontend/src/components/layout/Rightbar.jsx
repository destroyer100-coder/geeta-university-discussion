import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Icon } from '../common/Icons';
import { eventsApi, postsApi } from '../../services/api';

export const Rightbar = ({ onOpenCreatePost }) => {
  const [events, setEvents] = useState([]);
  const [trendingPosts, setTrendingPosts] = useState([]);

  useEffect(() => {
    eventsApi.getAll().then((res) => {
      if (res.success && res.data) {
        setEvents(res.data.slice(0, 3));
      }
    }).catch(() => {});

    postsApi.getAll({ sort: 'trending', limit: 4 }).then((res) => {
      if (res.success && res.data) {
        setTrendingPosts(res.data.slice(0, 4));
      }
    }).catch(() => {});
  }, []);

  return (
    <aside className="right-sidebar">
      {/* Upcoming Events (Visual Reference 1) */}
      <div className="card" style={{ marginBottom: '18px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
          <div style={{ fontWeight: 700, fontSize: '0.95rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Icon name="calendar" size={16} color="var(--primary)" />
            <span>Upcoming Events</span>
          </div>
          <Link to="/events" style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--primary)' }}>
            View All
          </Link>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {events.length > 0 ? (
            events.map((ev, idx) => {
              const d = new Date(ev.date);
              const day = d.getDate();
              const month = d.toLocaleString('en-US', { month: 'short' });

              return (
                <div key={ev._id || idx} style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <div
                    style={{
                      background: 'var(--primary-light)',
                      border: '1px solid #bfdbfe',
                      borderRadius: 'var(--radius-md)',
                      width: '44px',
                      height: '44px',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0,
                    }}
                  >
                    <span style={{ fontSize: '0.95rem', fontWeight: 800, color: 'var(--primary)', lineHeight: 1 }}>
                      {day}
                    </span>
                    <span style={{ fontSize: '0.625rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                      {month}
                    </span>
                  </div>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-main)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {ev.title}
                    </div>
                    <div style={{ fontSize: '0.725rem', color: 'var(--text-muted)' }}>
                      {[ev.venue, ev.time].filter(Boolean).join(' · ') || 'Event details not provided'}
                    </div>
                  </div>
                </div>
              );
            })
          ) : (
            <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>No upcoming events scheduled.</div>
          )}
        </div>
      </div>

      {/* Trending Discussions (Visual Reference 1) */}
      <div className="card" style={{ marginBottom: '18px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
          <div style={{ fontWeight: 700, fontSize: '0.95rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Icon name="trendingUp" size={16} color="#f59e0b" />
            <span>Trending Discussions</span>
          </div>
          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Week</span>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {trendingPosts && trendingPosts.length > 0 ? (
            trendingPosts.map((item, i) => (
              <Link
                key={item._id}
                to={`/discussions/${item._id}`}
                style={{
                  display: 'flex',
                  gap: '10px',
                  textDecoration: 'none',
                  color: 'inherit',
                  padding: '4px 6px',
                  borderRadius: 'var(--radius-sm)',
                  transition: 'background 0.2s',
                }}
                onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--bg-muted)')}
                onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
              >
                <span style={{ fontWeight: 800, color: 'var(--primary)', fontSize: '0.95rem' }}>{i + 1}</span>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: '0.825rem', fontWeight: 600, color: 'var(--text-main)', lineHeight: 1.3 }}>
                    {item.title}
                  </div>
                  <div style={{ fontSize: '0.725rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                    {item.commentsCount || 0} comments • {item.viewsCount || 0} views
                  </div>
                </div>
              </Link>
            ))
          ) : (
            <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
              No trending discussions are available yet.
            </div>
          )}
        </div>
      </div>

      <div className="card rightbar-quick-actions">
        <div className="rightbar-card-heading"><Icon name="zap" size={17} /><strong>Quick Actions</strong></div>
        <button type="button" onClick={() => onOpenCreatePost?.()}><span className="rightbar-action-icon"><Icon name="plus" size={17} /></span><span><strong>Start a Discussion</strong><small>Share a question or resource</small></span><Icon name="chevronRight" size={16} /></button>
        <Link to="/communities/create"><span className="rightbar-action-icon"><Icon name="users" size={17} /></span><span><strong>Create a Community</strong><small>Start a group for your peers</small></span><Icon name="chevronRight" size={16} /></Link>
        <Link to="/people"><span className="rightbar-action-icon"><Icon name="userCheck" size={17} /></span><span><strong>Find People</strong><small>Connect with campus members</small></span><Icon name="chevronRight" size={16} /></Link>
        <Link to="/saved"><span className="rightbar-action-icon"><Icon name="bookmark" size={17} /></span><span><strong>Saved Discussions</strong><small>Open your bookmarked posts</small></span><Icon name="chevronRight" size={16} /></Link>
      </div>

    </aside>
  );
};

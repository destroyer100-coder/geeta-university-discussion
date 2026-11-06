import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Icon } from '../common/Icons';
import { eventsApi, postsApi } from '../../services/api';

const formatEventDate = (value) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return {
    day: new Intl.DateTimeFormat('en', { day: '2-digit' }).format(date),
    month: new Intl.DateTimeFormat('en', { month: 'short' }).format(date),
    full: new Intl.DateTimeFormat('en', { dateStyle: 'medium' }).format(date),
  };
};

export const Rightbar = () => {
  const [events, setEvents] = useState([]);
  const [trendingPosts, setTrendingPosts] = useState([]);

  useEffect(() => {
    eventsApi.getAll().then((res) => {
      if (res.success && res.data) setEvents(res.data.slice(0, 3));
    }).catch(() => {});

    postsApi.getAll({ sort: 'trending', limit: 4 }).then((res) => {
      if (res.success && res.data) setTrendingPosts(res.data.slice(0, 4));
    }).catch(() => {});
  }, []);

  return (
    <aside className="right-sidebar" aria-label="Campus updates">
      <section className="card rail-card">
        <div className="rail-card-heading">
          <h2><Icon name="calendar" size={16} /> Upcoming Events</h2>
          <Link to="/events">View all</Link>
        </div>

        {events.length > 0 ? (
          <div className="rail-list">
            {events.map((event, index) => {
              const date = formatEventDate(event.date);
              const eventContent = (
                <>
                  <span className="rail-event-date" aria-hidden="true">
                    {date ? <><strong>{date.day}</strong><small>{date.month}</small></> : <Icon name="calendar" size={17} />}
                  </span>
                  <span className="rail-event-copy">
                    <strong>{event.title || 'Campus event'}</strong>
                    <small>
                      {date?.full}
                      {event.venue ? ` · ${event.venue}` : ''}
                      {event.time ? ` · ${event.time}` : ''}
                    </small>
                  </span>
                  <Icon name="arrowRight" size={14} className="rail-row-arrow" />
                </>
              );

              return event._id ? (
                <Link key={event._id} to={`/events/${event._id}`} className="rail-event-row">
                  {eventContent}
                </Link>
              ) : (
                <div key={index} className="rail-event-row is-static">
                  {eventContent}
                </div>
              );
            })}
          </div>
        ) : (
          <p className="rail-empty">No upcoming events scheduled.</p>
        )}
      </section>

      <section className="card rail-card">
        <div className="rail-card-heading">
          <h2><Icon name="barChart2" size={16} /> Trending Discussions</h2>
          <span className="rail-period-label">This week</span>
        </div>

        {trendingPosts.length > 0 ? (
          <div className="rail-list">
            {trendingPosts.map((post, index) => (
              <Link key={post._id} to={`/discussions/${post._id}`} className="rail-trending-row">
                <span className="rail-trending-rank">{String(index + 1).padStart(2, '0')}</span>
                <span className="rail-trending-copy">
                  <strong>{post.title}</strong>
                  <small>{post.commentsCount || 0} comments · {post.viewsCount || 0} views</small>
                </span>
                <Icon name="arrowRight" size={14} className="rail-row-arrow" />
              </Link>
            ))}
          </div>
        ) : (
          <p className="rail-empty">Trending discussions will appear here as conversations grow.</p>
        )}
      </section>

      <section className="card rail-card">
        <div className="rail-card-heading">
          <h2><Icon name="award" size={16} /> Top Contributors</h2>
          <Link to="/people">View all</Link>
        </div>
        <p className="rail-empty">Contributor rankings are not available yet.</p>
      </section>

      <section className="verification-card" aria-labelledby="verification-heading">
        <div className="verification-card-heading">
          <Icon name="shieldCheck" size={18} aria-hidden="true" />
          <h2 id="verification-heading">University community</h2>
        </div>
        <p>
          Keep campus conversations trustworthy. University verification and
          community-specific posting rules are applied separately.
        </p>
        <span className="badge badge-success">Community guidelines apply</span>
      </section>
    </aside>
  );
};

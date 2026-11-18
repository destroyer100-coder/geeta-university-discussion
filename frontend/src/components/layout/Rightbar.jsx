import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Icon } from '../common/Icons';
import { eventsApi, notificationsApi } from '../../services/api';

export const Rightbar = ({ onOpenCreatePost }) => {
  const [events, setEvents] = useState([]);
  const [announcements, setAnnouncements] = useState([]);

  useEffect(() => {
    eventsApi.getAll().then((res) => {
      if (res.success && res.data) setEvents(res.data.slice(0, 3));
    }).catch(() => {});

    notificationsApi.getAll().then((res) => {
      if (res.success && Array.isArray(res.data)) {
        setAnnouncements(res.data.filter((item) => item.type === 'announcement').slice(0, 2));
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
                      width: '68px',
                      height: '68px',
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
                  <div className="rightbar-event-copy">
                    <strong>{ev.title}</strong>
                    {ev.venue ? <span><Icon name="mapPin" size={13} />{ev.venue}</span> : null}
                    {ev.time ? <span><Icon name="clock" size={13} />{ev.time}</span> : null}
                  </div>
                  <Icon name="chevronRight" size={19} className="rightbar-event-chevron" />
                </div>
              );
            })
          ) : (
            <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>No upcoming events scheduled.</div>
          )}
        </div>
      </div>

      <div className="card rightbar-quick-actions">
        <div className="rightbar-card-heading"><Icon name="zap" size={17} /><strong>Quick Actions</strong></div>
        <button type="button" onClick={() => onOpenCreatePost?.()}>
          <span className="rightbar-action-icon"><Icon name="plus" size={17} /></span>
          <span><strong>Create a Discussion</strong></span>
        </button>
        <Link to="/communities/create">
          <span className="rightbar-action-icon"><Icon name="users" size={17} /></span>
          <span><strong>Create a Community</strong></span>
        </Link>
        <Link to="/people">
          <span className="rightbar-action-icon"><Icon name="userCheck" size={17} /></span>
          <span><strong>Find People</strong></span>
        </Link>
        <Link to="/explore">
          <span className="rightbar-action-icon"><Icon name="compass" size={17} /></span>
          <span><strong>Explore Resources</strong></span>
        </Link>
      </div>

      <div className="card rightbar-announcements">
        <div className="rightbar-card-heading"><Icon name="megaphone" size={19} /><strong>Campus Announcements</strong></div>
        {announcements.length ? announcements.map((item) => (
          <Link to="/notifications" className="rightbar-announcement-item" key={item._id}>
            {item.message}
            <small>{item.createdAt ? new Date(item.createdAt).toLocaleDateString() : ''}</small>
          </Link>
        )) : (
          <p>University announcements will appear here when published.</p>
        )}
        <Link to="/notifications" className="btn btn-accent btn-sm">View Announcements <Icon name="arrowRight" size={15} /></Link>
      </div>

    </aside>
  );
};

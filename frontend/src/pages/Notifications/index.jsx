import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { notificationsApi } from '../../services/api';
import { Icon } from '../../components/common/Icons';
import { NOTIFICATIONS_CHANGED_EVENT } from '../../components/layout/Navbar';
import { PageHero } from '../../components/common/PageHero';

export const NotificationsPage = () => {
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);

  // Tell the navbar to re-read its badge from the API so the badge and this
  // list are always derived from the same data.
  const syncBadge = () => {
    window.dispatchEvent(new Event(NOTIFICATIONS_CHANGED_EVENT));
  };

  const loadNotifications = () => {
    notificationsApi
      .getAll()
      .then((res) => {
        if (res.success && res.data) setNotifications(res.data);
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadNotifications();
  }, []);

  const handleMarkAll = async () => {
    await notificationsApi.markAllRead();
    loadNotifications();
    syncBadge();
  };

  const handleNotificationClick = async (n) => {
    if (!n.read) {
      await notificationsApi.markRead(n._id);
      loadNotifications();
      syncBadge();
    }
  };

  const getTargetUrl = (n) => {
    if (!n.target || !n.target.id) return '#';
    if (n.target.modelType === 'Post') return `/discussions/${n.target.id}`;
    if (n.target.modelType === 'Community') return `/communities/${n.target.id}`;
    return '#';
  };

  return (
    <div className="page-shell page-notifications">
      <PageHero
        icon="bell"
        title="Notifications"
        description="Stay updated with the latest activities, mentions and updates from your campus."
        action={(
          <button className="btn btn-outline btn-sm" onClick={handleMarkAll}>
            <Icon name="check" size={16} /> Mark all as read
          </button>
        )}
      />

      {loading ? (
        <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>
          Loading notifications...
        </div>
      ) : notifications.length === 0 ? (
        <div className="card" style={{ textAlign: 'center', padding: '40px' }}>
          <div style={{ fontSize: '2rem', marginBottom: '8px' }}>🔔</div>
          <h3>No notifications</h3>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>You're all caught up!</p>
        </div>
      ) : (
        <div className="notification-list">
          {notifications.map((n) => {
            const url = getTargetUrl(n);
            return (
              <Link
                key={n._id}
                to={url}
                onClick={() => handleNotificationClick(n)}
                className={`card notification-row${n.read ? '' : ' is-unread'}`}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px',
                  padding: '14px',
                  textDecoration: 'none',
                  color: 'inherit',
                  background: n.read ? '#ffffff' : 'var(--primary-light)',
                  borderLeft: n.read ? '1px solid var(--border-color)' : '4px solid var(--primary)',
                }}
              >
                <div
                  style={{
                    width: 36,
                    height: 36,
                    borderRadius: '50%',
                    background: '#e0f2fe',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <Icon name="bell" size={18} color="var(--primary)" />
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: '0.875rem', fontWeight: n.read ? 500 : 700 }}>
                    {n.message}
                  </div>
                  <div style={{ fontSize: '0.725rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                    {new Date(n.createdAt).toLocaleString()}
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
};

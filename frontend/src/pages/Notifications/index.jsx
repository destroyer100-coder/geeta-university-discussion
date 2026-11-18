import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { notificationsApi } from '../../services/api';
import { Icon } from '../../components/common/Icons';
import { NOTIFICATIONS_CHANGED_EVENT } from '../../components/layout/Navbar';
import { PageHero } from '../../components/common/PageHero';

const notificationGroup = (type = '') => {
  if (['mention', 'mentioned', 'mention_created'].includes(type)) return 'mentions';
  if (['reply', 'comment', 'accepted_answer', 'comment_reply'].includes(type)) return 'replies';
  if (['post_request', 'join_request', 'request_approved', 'request_rejected', 'community_update'].includes(type)) return 'communities';
  if (['event', 'event_reminder', 'event_created', 'event_update'].includes(type)) return 'events';
  return 'system';
};

const readNotificationPreferences = () => {
  try {
    return JSON.parse(localStorage.getItem('guf-notification-preferences-preview') || '{"comments":true,"mentions":true,"communities":true,"events":true,"announcements":true}');
  } catch {
    return { comments: true, mentions: true, communities: true, events: true, announcements: true };
  }
};

const notificationTarget = (item) => {
  if (!item?.target?.id) return '/notifications';
  if (item.target.modelType === 'Post') return `/discussions/${item.target.id}`;
  if (item.target.modelType === 'Community') return `/communities/${item.target.id}`;
  return '/notifications';
};

const filterOptions = [
  { key: 'all', label: 'All' },
  { key: 'mentions', label: 'Mentions' },
  { key: 'replies', label: 'Replies' },
  { key: 'communities', label: 'Communities' },
  { key: 'events', label: 'Events' },
  { key: 'system', label: 'System' },
];

export const NotificationsPage = () => {
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeFilter, setActiveFilter] = useState('all');
  const [sortOrder, setSortOrder] = useState('newest');
  const [errorNotice, setErrorNotice] = useState('');
  const [notificationPreferences, setNotificationPreferences] = useState(readNotificationPreferences);

  useEffect(() => {
    try { localStorage.setItem('guf-notification-preferences-preview', JSON.stringify(notificationPreferences)); } catch { /* preferences remain active for this session */ }
  }, [notificationPreferences]);

  const syncBadge = () => window.dispatchEvent(new Event(NOTIFICATIONS_CHANGED_EVENT));

  const loadNotifications = async () => {
    setLoading(true);
    setErrorNotice('');
    try {
      const res = await notificationsApi.getAll();
      if (res.success && Array.isArray(res.data)) setNotifications(res.data);
      else setNotifications([]);
    } catch (error) {
      setErrorNotice(error.message || 'Notifications could not be loaded.');
      setNotifications([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadNotifications(); }, []);

  const counts = useMemo(() => ({
    all: notifications.length,
    unread: notifications.filter((item) => !item.read).length,
    mentions: notifications.filter((item) => notificationGroup(item.type) === 'mentions').length,
    replies: notifications.filter((item) => notificationGroup(item.type) === 'replies').length,
    communities: notifications.filter((item) => notificationGroup(item.type) === 'communities').length,
    events: notifications.filter((item) => notificationGroup(item.type) === 'events').length,
    system: notifications.filter((item) => notificationGroup(item.type) === 'system').length,
  }), [notifications]);

  const visibleNotifications = useMemo(() => {
    const filtered = notifications.filter((item) => {
      if (activeFilter === 'unread') return !item.read;
      if (activeFilter === 'all') return true;
      return notificationGroup(item.type) === activeFilter;
    });
    return filtered.sort((a, b) => {
      const difference = new Date(a.createdAt || 0).getTime() - new Date(b.createdAt || 0).getTime();
      return sortOrder === 'oldest' ? difference : -difference;
    });
  }, [notifications, activeFilter, sortOrder]);

  const handleMarkAll = () => {
    if (!counts.unread) return;
    setNotifications((items) => items.map((item) => ({ ...item, read: true })));
    syncBadge();
  };

  const handleNotificationClick = (item) => {
    if (item.read) return;
    setNotifications((items) => items.map((current) => current._id === item._id ? { ...current, read: true } : current));
    syncBadge();
  };

  return (
    <div className="page-shell page-notifications">
      <PageHero
        icon="bell"
        title="Notifications"
        description="Stay updated with the latest activities and updates from your campus."
        action={<div className="notification-hero-actions"><button type="button" className="btn btn-outline btn-sm" onClick={handleMarkAll} disabled={!counts.unread}><Icon name="check" size={16} /> Mark all as read</button><Link to="/settings?section=notifications" className="btn btn-outline btn-sm"><Icon name="settings" size={15} /> Notification Preferences</Link></div>}
      />

      <div className="notification-workspace">
        <main className="notification-main">
          <div className="page-tabs notification-filter-tabs" role="tablist" aria-label="Filter notifications">
            {filterOptions.map((option) => (
              <button
                type="button"
                key={option.key}
                role="tab"
                aria-selected={activeFilter === option.key}
                className={activeFilter === option.key ? 'btn btn-primary' : 'btn btn-secondary'}
                onClick={() => setActiveFilter(option.key)}
              >
                {option.label}
                <span>{counts[option.key]}</span>
              </button>
            ))}
          </div>

          <div className="notification-toolbar">
            <button type="button" className="notification-mark-read" onClick={handleMarkAll} disabled={!counts.unread}>
              <Icon name="check" size={16} /> Mark all as read
            </button>
            <label className="notification-sort">
              <span>Sort:</span>
              <select className="form-control" value={sortOrder} onChange={(event) => setSortOrder(event.target.value)}>
                <option value="newest">Newest first</option>
                <option value="oldest">Oldest first</option>
              </select>
            </label>
          </div>

          {errorNotice ? <div className="notification-error" role="alert">{errorNotice}</div> : null}
          {loading ? (
            <div className="loading-state">Loading notifications...</div>
          ) : visibleNotifications.length === 0 ? (
            <div className="card notification-empty">
              <Icon name="bell" size={30} />
              <h3>{notifications.length ? 'No notifications in this filter' : 'You’re all caught up'}</h3>
              <p>{notifications.length ? 'Choose another filter to see more activity.' : 'New activity will appear here when it happens.'}</p>
            </div>
          ) : (
            <div className="notification-list">
              {visibleNotifications.map((item) => (
                <Link
                  key={item._id}
                  to={notificationTarget(item)}
                  onClick={() => handleNotificationClick(item)}
                  className={'notification-row' + (item.read ? '' : ' is-unread')}
                >
                  <span className={'notification-type-icon notification-type-' + notificationGroup(item.type)}>
                    <Icon name={notificationGroup(item.type) === 'discussion' ? 'messageSquare' : notificationGroup(item.type) === 'community' ? 'users' : 'bell'} size={20} />
                  </span>
                  {item.actor?.avatar ? (
                    <img className="notification-actor-avatar" src={item.actor.avatar} alt="" loading="lazy" decoding="async" />
                  ) : (
                    <span className="notification-actor-avatar notification-actor-initials">{(item.actor?.name || 'G').trim().split(/\s+/).slice(0, 2).map((part) => part[0]).join('').toUpperCase()}</span>
                  )}
                  <span className="notification-copy">
                    <strong>{item.message}</strong>
                    <small>{item.createdAt ? new Date(item.createdAt).toLocaleString() : ''}</small>
                  </span>
                  {item.read ? null : <span className="notification-unread-dot" aria-label="Unread" />}
                  <Icon name="chevronRight" size={17} />
                </Link>
              ))}
            </div>
          )}
        </main>

        <aside className="notification-side">
          <section className="card notification-side-card">
            <h2><Icon name="filter" size={19} /> Filter Notifications</h2>
            {filterOptions.map((option) => (
              <button type="button" key={option.key} className={activeFilter === option.key ? 'notification-side-filter active' : 'notification-side-filter'} onClick={() => setActiveFilter(option.key)}>
                <span className="notification-radio" />
                <span>{option.label}</span>
                <strong>{counts[option.key]}</strong>
              </button>
            ))}
          </section>
          <section className="card notification-side-card notification-preferences-card">
            <h2><Icon name="settings" size={19} /> Notification Settings</h2>
            <p className="notification-settings-intro">Manage what notifications you receive in this browser.</p>
            {[
              ['comments', 'Comments & Replies'],
              ['mentions', 'Mentions'],
              ['communities', 'Community Updates'],
              ['events', 'Event Reminders'],
              ['announcements', 'Announcements'],
            ].map(([key, label]) => (
              <label className="notification-preference-row" key={key}>
                <span>{label}</span>
                <input type="checkbox" checked={Boolean(notificationPreferences[key])} onChange={(event) => setNotificationPreferences((current) => ({ ...current, [key]: event.target.checked }))} />
                <i aria-hidden="true" />
              </label>
            ))}
            <Link to="/settings?section=notifications" className="btn btn-outline btn-sm notification-refresh">Manage Preferences <Icon name="arrowRight" size={15} /></Link>
            <p className="notification-settings-note">These preference switches are local frontend controls; they do not change email or push delivery.</p>
          </section>
        </aside>
      </div>
    </div>
  );
};

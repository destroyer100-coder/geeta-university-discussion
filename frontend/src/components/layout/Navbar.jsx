import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Icon } from '../common/Icons';
import { useAuth } from '../../context/AuthContext';
import { messagesApi, notificationsApi } from '../../services/api';

export const NOTIFICATIONS_CHANGED_EVENT = 'notifications:changed';

const initials = (name = '') => name.trim().split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]).join('').toUpperCase() || 'U';

const targetForNotification = (item) => {
  if (!item?.target?.id) return '/notifications';
  if (item.target.modelType === 'Post') return `/discussions/${item.target.id}`;
  if (item.target.modelType === 'Community') return `/communities/${item.target.id}`;
  return '/notifications';
};

export const Navbar = ({ onOpenCreatePost, onOpenMobileNav, isMobileNavOpen = false }) => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const searchRef = useRef(null);
  const [showPersonaMenu, setShowPersonaMenu] = useState(false);
  const [openPopover, setOpenPopover] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [unreadCount, setUnreadCount] = useState(0);
  const [messageUnreadCount, setMessageUnreadCount] = useState(0);
  const [notificationPreview, setNotificationPreview] = useState([]);
  const [messagePreview, setMessagePreview] = useState([]);
  const [previewLoading, setPreviewLoading] = useState(false);

  const loadUnreadCount = useCallback(async () => {
    if (!user) {
      setUnreadCount(0);
      return;
    }
    try {
      const res = await notificationsApi.getAll();
      if (res?.success) setUnreadCount(res.unreadCount || 0);
    } catch {
      setUnreadCount(0);
    }
  }, [user]);

  const loadMessageCount = useCallback(async () => {
    if (!user) {
      setMessageUnreadCount(0);
      return;
    }
    try {
      const res = await messagesApi.getConversations();
      if (res?.success && Array.isArray(res.data)) {
        setMessageUnreadCount(res.data.reduce((sum, item) => sum + (Number(item.unreadCount) || 0), 0));
      }
    } catch {
      setMessageUnreadCount(0);
    }
  }, [user]);

  useEffect(() => {
    loadUnreadCount();
    loadMessageCount();
  }, [loadUnreadCount, loadMessageCount, location.pathname]);

  useEffect(() => {
    window.addEventListener(NOTIFICATIONS_CHANGED_EVENT, loadUnreadCount);
    return () => window.removeEventListener(NOTIFICATIONS_CHANGED_EVENT, loadUnreadCount);
  }, [loadUnreadCount]);

  useEffect(() => {
    const onShortcut = (event) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        searchRef.current?.focus();
      }
      if (event.key === 'Escape') {
        setOpenPopover('');
        setShowPersonaMenu(false);
      }
    };
    window.addEventListener('keydown', onShortcut);
    return () => window.removeEventListener('keydown', onShortcut);
  }, []);

  const openPreview = async (type) => {
    setShowPersonaMenu(false);
    if (openPopover === type) {
      setOpenPopover('');
      return;
    }
    setOpenPopover(type);
    setPreviewLoading(true);
    try {
      if (type === 'notifications') {
        const res = await notificationsApi.getAll();
        if (res?.success) {
          setNotificationPreview(Array.isArray(res.data) ? res.data.slice(0, 4) : []);
          setUnreadCount(res.unreadCount || 0);
        }
      } else {
        const res = await messagesApi.getConversations();
        if (res?.success && Array.isArray(res.data)) {
          setMessagePreview(res.data.slice(0, 4));
          setMessageUnreadCount(res.data.reduce((sum, item) => sum + (Number(item.unreadCount) || 0), 0));
        }
      }
    } catch (error) {
      console.error(`Failed to load ${type} preview:`, error);
      if (type === 'notifications') setNotificationPreview([]);
      else setMessagePreview([]);
    } finally {
      setPreviewLoading(false);
    }
  };

  const handleSearch = (event) => {
    event.preventDefault();
    if (!searchQuery.trim()) return;
    setOpenPopover('');
    navigate(`/search?q=${encodeURIComponent(searchQuery.trim())}`);
  };

  const handleMarkAllNotificationsRead = async () => {
    try {
      await notificationsApi.markAllRead();
      setNotificationPreview((items) => items.map((item) => ({ ...item, read: true })));
      setUnreadCount(0);
      window.dispatchEvent(new Event(NOTIFICATIONS_CHANGED_EVENT));
    } catch (error) {
      console.error('Failed to mark notifications as read:', error);
    }
  };

  const handleNotificationClick = async (item) => {
    if (!item.read) {
      try {
        await notificationsApi.markRead(item._id);
        setNotificationPreview((items) => items.map((entry) => entry._id === item._id ? { ...entry, read: true } : entry));
        loadUnreadCount();
      } catch (error) {
        console.error('Failed to mark notification as read:', error);
      }
    }
    setOpenPopover('');
    navigate(targetForNotification(item));
  };

  return (
    <nav className="navbar">
      <div className="navbar-container">
        <button
          type="button"
          className="btn-icon"
          onClick={onOpenMobileNav}
          aria-label={isMobileNavOpen ? 'Close navigation menu' : 'Open navigation menu'}
          aria-expanded={isMobileNavOpen}
          aria-controls="app-navigation"
          title="Toggle navigation sidebar"
          style={{ flexShrink: 0 }}
        >
          <Icon name={isMobileNavOpen ? 'x' : 'menu'} size={22} />
        </button>

        <Link to="/" className="nav-brand" onClick={() => setOpenPopover('')}>
          <div className="brand-logo-badge" aria-hidden="true">
            <Icon name="shieldCheck" size={27} />
          </div>
          <div className="brand-text">
            <div className="brand-text-main">GEETA <span>UNIVERSITY</span></div>
            <div className="brand-text-sub">Discussion Forum</div>
          </div>
        </Link>

        <form onSubmit={handleSearch} className="search-bar-wrapper" role="search">
          <Icon name="search" size={18} className="search-icon-pos" />
          <input
            ref={searchRef}
            type="search"
            className="search-input"
            placeholder="Search discussions, communities, people, events..."
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
            aria-label="Search discussions, communities, people and events"
          />
          <span className="search-shortcut">Ctrl + K</span>
        </form>

        <div className="nav-links">
          <div className="persona-dropdown-container nav-preview-container">
            <button
              type="button"
              className="btn-icon nav-action-button"
              title="Notifications"
              aria-label="Open notifications preview"
              aria-expanded={openPopover === 'notifications'}
              onClick={() => openPreview('notifications')}
            >
              <Icon name="bell" size={22} />
              {unreadCount > 0 && <span className="nav-count-badge">{unreadCount > 99 ? '99+' : unreadCount}</span>}
            </button>
            {openPopover === 'notifications' && (
              <div className="nav-popover" role="dialog" aria-label="Recent notifications">
                <div className="nav-popover-header">
                  <span>Notifications</span>
                  <button type="button" onClick={handleMarkAllNotificationsRead} disabled={unreadCount === 0}>Mark all as read</button>
                </div>
                {previewLoading ? (
                  <div className="nav-popover-empty">Loading notifications...</div>
                ) : notificationPreview.length ? (
                  notificationPreview.map((item) => (
                    <button
                      type="button"
                      key={item._id}
                      className={`nav-popover-item nav-popover-button${item.read ? '' : ' is-unread'}`}
                      onClick={() => handleNotificationClick(item)}
                    >
                      <span className="nav-popover-icon"><Icon name="bell" size={18} /></span>
                      <span className="nav-popover-copy">
                        <strong>{item.message}</strong>
                        <span>{item.createdAt ? new Date(item.createdAt).toLocaleString() : ''}</span>
                      </span>
                      {!item.read && <span className="nav-popover-unread-dot" />}
                    </button>
                  ))
                ) : (
                  <div className="nav-popover-empty">No notifications yet.</div>
                )}
                <Link to="/notifications" className="nav-popover-footer" onClick={() => setOpenPopover('')}>View all notifications <span>→</span></Link>
              </div>
            )}
          </div>

          <div className="persona-dropdown-container nav-preview-container">
            <button
              type="button"
              className="btn-icon nav-action-button"
              title="Messages"
              aria-label="Open messages preview"
              aria-expanded={openPopover === 'messages'}
              onClick={() => openPreview('messages')}
            >
              <Icon name="messageSquare" size={22} />
              {messageUnreadCount > 0 && <span className="nav-count-badge nav-message-count">{messageUnreadCount > 99 ? '99+' : messageUnreadCount}</span>}
            </button>
            {openPopover === 'messages' && (
              <div className="nav-popover" role="dialog" aria-label="Recent messages">
                <div className="nav-popover-header"><span>Messages</span><span className="nav-popover-subtitle">Recent conversations</span></div>
                {previewLoading ? (
                  <div className="nav-popover-empty">Loading conversations...</div>
                ) : messagePreview.length ? (
                  messagePreview.map((item) => {
                    const person = item.user || {};
                    return (
                      <Link
                        key={item._id || person._id}
                        to={person._id ? `/messages?user=${person._id}` : '/messages'}
                        className="nav-popover-item"
                        onClick={() => setOpenPopover('')}
                      >
                        {person.avatar ? (
                          <img src={person.avatar} alt="" className="nav-popover-avatar" loading="lazy" />
                        ) : (
                          <span className="nav-popover-avatar nav-avatar-initials">{initials(person.name)}</span>
                        )}
                        <span className="nav-popover-copy">
                          <strong>{person.name || 'Conversation'}</strong>
                          <span>{item.lastMessage || ''}</span>
                        </span>
                        {item.unreadCount > 0 && <span className="nav-popover-count">{item.unreadCount}</span>}
                      </Link>
                    );
                  })
                ) : (
                  <div className="nav-popover-empty">No conversations yet.</div>
                )}
                <Link to="/messages" className="nav-popover-footer" onClick={() => setOpenPopover('')}>View all messages <span>→</span></Link>
              </div>
            )}
          </div>

          <div className="persona-dropdown-container">
            <button
              type="button"
              className="btn btn-secondary nav-account-trigger"
              aria-haspopup="true"
              aria-expanded={showPersonaMenu}
              aria-label={user ? `Account menu for ${user.name}` : 'Open sign-in menu'}
              onClick={() => {
                setOpenPopover('');
                setShowPersonaMenu((value) => !value);
              }}
            >
              {user?.avatar ? (
                <img src={user.avatar} alt="" />
              ) : (
                <span className="nav-user-initials">{initials(user?.name)}</span>
              )}
              <Icon name="chevronDown" size={14} />
            </button>

            {showPersonaMenu && (
              <div className="persona-menu-card">
                {user ? (
                  <>
                    <div className="nav-account-summary">
                      {user.avatar ? <img src={user.avatar} alt="" /> : <span className="nav-account-summary-avatar">{initials(user.name)}</span>}
                      <div><strong>{user.name}</strong><span>{[user.department, user.year].filter(Boolean).join(' · ')}</span></div>
                    </div>
                    <Link to="/profile/me" className="persona-item" onClick={() => setShowPersonaMenu(false)}>
                      <Icon name="userCheck" size={17} /><span>My Profile</span>
                    </Link>
                    <Link to="/settings" className="persona-item" onClick={() => setShowPersonaMenu(false)}>
                      <Icon name="settings" size={17} /><span>Account Settings</span>
                    </Link>

                    <button
                      type="button"
                      className="persona-item nav-logout-item"
                      onClick={() => { logout(); setShowPersonaMenu(false); }}
                    >
                      <Icon name="logOut" size={17} /><span>Log out</span>
                    </button>
                  </>
                ) : (
                  <Link to="/login" className="persona-item" onClick={() => setShowPersonaMenu(false)}>
                    <Icon name="lock" size={17} /><span>Sign in</span>
                  </Link>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </nav>
  );
};

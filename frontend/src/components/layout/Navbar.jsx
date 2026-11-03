import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Icon } from '../common/Icons';
import { useAuth } from '../../context/AuthContext';
import { notificationsApi } from '../../services/api';

export const NOTIFICATIONS_CHANGED_EVENT = 'notifications:changed';

export const Navbar = ({ onOpenCreatePost, onOpenMobileNav, isMobileNavOpen = false }) => {
  const { user, logout, switchPersona, DEMO_ACCOUNTS } = useAuth();
  const isDevelopment = import.meta.env.DEV;
  const [showPersonaMenu, setShowPersonaMenu] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [unreadCount, setUnreadCount] = useState(0);
  const searchInputRef = useRef(null);
  const accountMenuRef = useRef(null);
  const navigate = useNavigate();
  const location = useLocation();

  const loadUnreadCount = useCallback(() => {
    if (!user) {
      setUnreadCount(0);
      return;
    }
    notificationsApi
      .getAll()
      .then((res) => {
        if (res && res.success) setUnreadCount(res.unreadCount || 0);
      })
      .catch(() => setUnreadCount(0));
  }, [user]);

  useEffect(() => {
    loadUnreadCount();
  }, [loadUnreadCount, location.pathname]);

  useEffect(() => {
    window.addEventListener(NOTIFICATIONS_CHANGED_EVENT, loadUnreadCount);
    return () => window.removeEventListener(NOTIFICATIONS_CHANGED_EVENT, loadUnreadCount);
  }, [loadUnreadCount]);

  useEffect(() => {
    const handleSearchShortcut = (event) => {
      const isShortcut = (event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k';
      if (!isShortcut) return;
      event.preventDefault();
      searchInputRef.current?.focus();
    };
    window.addEventListener('keydown', handleSearchShortcut);
    return () => window.removeEventListener('keydown', handleSearchShortcut);
  }, []);

  useEffect(() => {
    setShowPersonaMenu(false);
  }, [location.pathname]);

  useEffect(() => {
    if (!showPersonaMenu) return undefined;
    const handlePointerDown = (event) => {
      if (!accountMenuRef.current?.contains(event.target)) setShowPersonaMenu(false);
    };
    const handleKeyDown = (event) => {
      if (event.key === 'Escape') setShowPersonaMenu(false);
    };
    document.addEventListener('pointerdown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [showPersonaMenu]);

  const handleSearch = (event) => {
    event.preventDefault();
    const query = searchQuery.trim();
    if (query) navigate(`/search?q=${encodeURIComponent(query)}`);
  };

  const toggleAccountMenu = () => setShowPersonaMenu((visible) => !visible);

  return (
    <nav className="navbar" aria-label="Main navigation">
      <div className="navbar-container">
        <button
          type="button"
          className="btn-icon navbar-menu-toggle"
          onClick={onOpenMobileNav}
          aria-label={isMobileNavOpen ? 'Close navigation menu' : 'Toggle navigation sidebar'}
          aria-expanded={isMobileNavOpen}
          aria-controls="app-navigation"
          title="Toggle navigation"
        >
          <Icon name={isMobileNavOpen ? 'x' : 'menu'} size={20} />
        </button>

        <Link to="/" className="nav-brand" aria-label="Geeta University Discussion home">
          <span className="brand-logo-badge" aria-hidden="true">G</span>
          <span className="brand-text">
            <span className="brand-text-main">GEETA UNIVERSITY</span>
            <span className="brand-text-sub">Discussion</span>
          </span>
        </Link>

        <form onSubmit={handleSearch} className="search-bar-wrapper" role="search">
          <Icon name="search" size={16} className="search-icon-pos" aria-hidden="true" />
          <input
            ref={searchInputRef}
            type="search"
            className="search-input"
            aria-label="Search discussions, topics, people and communities"
            placeholder="Search campus discussions, people and communities…"
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
          />
          <span className="search-shortcut" aria-hidden="true">Ctrl K</span>
        </form>

        <div className="nav-links">
          <button
            id="nav-create-post-btn"
            type="button"
            className="btn btn-primary"
            onClick={onOpenCreatePost}
          >
            <Icon name="plus" size={16} aria-hidden="true" />
            <span>Create Post</span>
          </button>

          <Link
            to="/notifications"
            className="btn-icon navbar-icon-link"
            title="Notifications"
            aria-label={unreadCount > 0 ? `Notifications, ${unreadCount} unread` : 'Notifications'}
          >
            <span className="navbar-icon-wrap">
              <Icon name="bell" size={20} />
              {unreadCount > 0 && (
                <span className="notification-count" aria-hidden="true">
                  {unreadCount > 99 ? '99+' : unreadCount}
                </span>
              )}
            </span>
          </Link>

          <Link to="/messages" className="btn-icon navbar-icon-link" title="Messages" aria-label="Messages">
            <Icon name="messageSquare" size={20} />
          </Link>

          <div className="account-menu" ref={accountMenuRef}>
            <button
              type="button"
              className="account-menu-trigger"
              aria-haspopup="true"
              aria-expanded={showPersonaMenu}
              aria-controls="account-menu"
              aria-label={user ? `Account menu for ${user.name}` : 'Open sign-in menu'}
              onClick={toggleAccountMenu}
            >
              {user ? (
                <>
                  <img
                    className="account-avatar"
                    src={user.avatar || 'https://api.dicebear.com/7.x/avataaars/svg?seed=user'}
                    alt=""
                  />
                  <span className="nav-user-name">{user.name}</span>
                </>
              ) : (
                <span>Log In</span>
              )}
              <Icon name="chevronDown" size={14} aria-hidden="true" />
            </button>

            {showPersonaMenu && (
              <div id="account-menu" className="account-menu-panel" role="menu">
                {isDevelopment && (
                  <div className="account-persona-section">
                    <p className="account-menu-label">Test personas · Development</p>
                    {DEMO_ACCOUNTS.map((account) => (
                      <button
                        type="button"
                        key={account.email}
                        className={`account-persona-item${user?.email === account.email ? ' is-active' : ''}`}
                        role="menuitem"
                        onClick={() => {
                          switchPersona(account.email);
                          setShowPersonaMenu(false);
                        }}
                      >
                        <strong>{account.name} {user?.email === account.email ? '✓' : ''}</strong>
                        <small>{account.title}</small>
                      </button>
                    ))}
                  </div>
                )}

                {user ? (
                  <>
                    <Link to="/profile/me" className="account-menu-item" role="menuitem" onClick={() => setShowPersonaMenu(false)}>
                      <Icon name="users" size={15} />
                      My Profile
                    </Link>
                    <button
                      type="button"
                      className="account-menu-item is-danger"
                      role="menuitem"
                      onClick={() => {
                        logout();
                        setShowPersonaMenu(false);
                      }}
                    >
                      <Icon name="x" size={15} />
                      Logout
                    </button>
                  </>
                ) : (
                  <Link to="/login" className="account-menu-item" role="menuitem" onClick={() => setShowPersonaMenu(false)}>
                    <Icon name="lock" size={15} />
                    Sign In with Password
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

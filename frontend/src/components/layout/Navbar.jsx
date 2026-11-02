import React, { useCallback, useEffect, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Icon } from '../common/Icons';
import { useAuth } from '../../context/AuthContext';
import { notificationsApi } from '../../services/api';

// Window event used by the Notifications page to keep the bell badge in sync
// with the list after marking notifications as read.
export const NOTIFICATIONS_CHANGED_EVENT = 'notifications:changed';

export const Navbar = ({ onOpenCreatePost, onOpenMobileNav, isMobileNavOpen = false }) => {
  const { user, logout } = useAuth();
  const [showAccountMenu, setShowAccountMenu] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [unreadCount, setUnreadCount] = useState(0);
  const navigate = useNavigate();
  const location = useLocation();

  // Badge count comes from the same endpoint/field the Notifications page uses,
  // so the badge can never disagree with the rendered list.
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

  // Refresh on mount, on navigation, and when the authenticated user changes
  useEffect(() => {
    loadUnreadCount();
  }, [loadUnreadCount, location.pathname]);

  useEffect(() => {
    window.addEventListener(NOTIFICATIONS_CHANGED_EVENT, loadUnreadCount);
    return () => window.removeEventListener(NOTIFICATIONS_CHANGED_EVENT, loadUnreadCount);
  }, [loadUnreadCount]);

  const handleSearch = (e) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      navigate(`/search?q=${encodeURIComponent(searchQuery.trim())}`);
    }
  };

  return (
    <nav className="navbar">
      <div className="navbar-container">
       
        
        {/* Navigation toggle for desktop sidebar and mobile drawer */}
        <button
          type="button"
          className="btn-icon"
          onClick={onOpenMobileNav}
          aria-label={
            isMobileNavOpen
              ? 'Close navigation menu'
              : 'Open navigation menu'
          }
          aria-expanded={isMobileNavOpen}
          aria-controls="app-navigation"
          title="Toggle Navigation Sidebar"
          style={{ marginRight: '6px', flexShrink: 0 }}
        >
          <Icon name={isMobileNavOpen ? 'x' : 'menu'} size={20} />
        </button>

        
        {/* Brand */}
        <Link to="/" className="nav-brand">
          <div className="brand-logo-badge">G</div>
          <div className="brand-text">
            <div className="brand-text-main">GEETA UNIVERSITY</div>
            <div className="brand-text-sub">Discussion</div>
          </div>
        </Link>

        {/* Global Search */}
        <form onSubmit={handleSearch} className="search-bar-wrapper">
          <Icon name="search" size={16} className="search-icon-pos" />
          <input
            type="text"
            className="search-input"
            placeholder="Search discussions, topics, people, communities... (e.g. DSA, placements)"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
          <span className="search-shortcut">Ctrl K</span>
        </form>

        {/* Navigation & Actions */}
        <div className="nav-links">
          {/* Create Post Button (Section 1 & 5: Home shows Create Post button only) */}
          <button
            id="nav-create-post-btn"
            className="btn btn-accent"
            onClick={onOpenCreatePost}
            style={{ padding: '8px 18px', borderRadius: '20px' }}
          >
            <Icon name="plus" size={16} color="#fff" />
            <span>Create Post</span>
          </button>

          <Link to="/notifications" className="btn-icon" title="Notifications">
            <div style={{ position: 'relative' }}>
              <Icon name="bell" size={20} />
              {unreadCount > 0 && (
                <span style={{
                  position: 'absolute',
                  top: -4,
                  right: -4,
                  background: '#ef4444',
                  color: '#fff',
                  fontSize: '0.65rem',
                  fontWeight: 700,
                  width: 15,
                  height: 15,
                  borderRadius: '50%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}>
                  {unreadCount}
                </span>
              )}
            </div>
          </Link>

          <Link to="/messages" className="btn-icon" title="Messages">
            <Icon name="messageSquare" size={20} />
          </Link>

          {/* User account menu */}
          <div style={{ position: 'relative' }}>
            <button
              type="button"
              className="btn btn-secondary"
              aria-haspopup="true"
              aria-expanded={showAccountMenu}
              aria-label={user ? `Account menu for ${user.name}` : 'Open sign-in menu'}
              onClick={() => setShowAccountMenu(!showAccountMenu)}
              style={{ padding: '4px 10px', gap: '8px', borderRadius: '20px' }}
            >
              {user ? (
                <>
                  <img
                    src={user.avatar || 'https://api.dicebear.com/7.x/avataaars/svg?seed=user'}
                    alt={user.name}
                    style={{ width: 26, height: 26, borderRadius: '50%', objectFit: 'cover' }}
                  />
                  <span className="nav-user-name" style={{ fontSize: '0.825rem', fontWeight: 600 }}>{user.name}</span>
                </>
              ) : (
                <span>Log In</span>
              )}
              <Icon name="chevronDown" size={14} />
            </button>

            {/* Account actions for the currently authenticated user. */}
            {showAccountMenu && (
              <div
                style={{
                  position: 'absolute',
                  right: 0,
                  top: '115%',
                  background: '#ffffff',
                  border: '1px solid var(--border-color)',
                  borderRadius: 'var(--radius-md)',
                  boxShadow: 'var(--shadow-lg)',
                  width: '260px',
                  padding: '8px',
                  zIndex: 200,
                }}
              >
                {user ? (
                  <>
                    <Link
                      to="/profile/me"
                      onClick={() => setShowAccountMenu(false)}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                        padding: '8px 10px',
                        fontSize: '0.825rem',
                        color: 'var(--text-main)',
                        borderRadius: 'var(--radius-sm)',
                      }}
                    >
                      <Icon name="users" size={14} />
                      <span>My Profile</span>
                    </Link>

                    <button
                      onClick={() => {
                        logout();
                        setShowAccountMenu(false);
                      }}
                      style={{
                        width: '100%',
                        textAlign: 'left',
                        padding: '8px 10px',
                        background: 'transparent',
                        border: 'none',
                        fontSize: '0.825rem',
                        color: '#ef4444',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                      }}
                    >
                      <Icon name="x" size={14} color="#ef4444" />
                      <span>Logout</span>
                    </button>
                  </>
                ) : (
                  <Link
                    to="/login"
                    onClick={() => setShowAccountMenu(false)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      padding: '8px 10px',
                      fontSize: '0.825rem',
                      color: 'var(--primary)',
                      fontWeight: 600,
                      borderRadius: 'var(--radius-sm)',
                    }}
                  >
                    <Icon name="lock" size={14} />
                    <span>Sign In with Password</span>
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

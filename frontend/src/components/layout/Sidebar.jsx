
import React, { useCallback, useEffect, useState } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { Icon } from '../common/Icons';
import { communitiesApi } from '../../services/api';

export const COMMUNITIES_CHANGED_EVENT = 'communities:changed';

const AVATAR_COLORS = [
  '#2563eb',
  '#059669',
  '#d97706',
  '#7c3aed',
  '#db2777',
  '#0891b2',
  '#dc2626',
  '#4f46e5',
];

const getCommunityName = (community) =>
  community?.name || community?.title || 'Untitled Community';

const getCommunityId = (community) =>
  community?._id || community?.id || community?.slug;

const getCommunityPath = (community) => {
  const identifier = community?.slug || getCommunityId(community);
  return `/communities/${encodeURIComponent(identifier)}`;
};

const getCommunityImage = (community) => {
  const image =
    community?.avatarUrl ||
    community?.logoUrl ||
    community?.badgeImage ||
    community?.imageUrl ||
    community?.avatar ||
    community?.logo;

  if (typeof image === 'string') return image;
  if (image && typeof image === 'object') {
    return image.url || image.secure_url || '';
  }

  return '';
};

const getInitials = (name = '') => {
  const words = name.trim().split(/\s+/).filter(Boolean);

  if (!words.length) return '?';

  return words.length === 1
    ? words[0].slice(0, 2).toUpperCase()
    : `${words[0][0]}${words[1][0]}`.toUpperCase();
};

const normalizeCommunities = (response) => {
  const payload = response?.data ?? response;

  const list = Array.isArray(payload)
    ? payload
    : Array.isArray(payload?.communities)
      ? payload.communities
      : Array.isArray(payload?.data)
        ? payload.data
        : [];

  return list.filter((community) => getCommunityId(community));
};

const navItems = [
  { to: '/', label: 'Home', icon: 'home', end: true },
  { to: '/explore', label: 'Explore', icon: 'compass' },
  { to: '/communities', label: 'Communities', icon: 'users' },
  { to: '/events', label: 'Events', icon: 'calendar' },
  { to: '/people', label: 'People', icon: 'userCheck' },
  { to: '/saved', label: 'Saved', icon: 'bookmark' },
  {
    to: '/my-discussions',
    label: 'My Discussions',
    icon: 'messageSquare',
  },
];

export const Sidebar = ({
  isCollapsed,
  onToggleCollapse,
  mobileOpen = false,
  onCloseMobileNav,
}) => {
  const [communities, setCommunities] = useState([]);
  const [communitiesLoading, setCommunitiesLoading] = useState(true);
  const [communitiesError, setCommunitiesError] = useState(false);

  const location = useLocation();
  const closeMobileNav = onCloseMobileNav || (() => {});
  const isCompact = isCollapsed && !mobileOpen;

  const loadCommunities = useCallback(async () => {
    try {
      const response = await communitiesApi.getAll();
      setCommunities(normalizeCommunities(response));
      setCommunitiesError(false);
    } catch (error) {
      console.error('Failed to load sidebar communities:', error);
      setCommunitiesError(true);
    } finally {
      setCommunitiesLoading(false);
    }
  }, []);

  useEffect(() => {
    loadCommunities();

    const handleCommunitiesChanged = () => {
      loadCommunities();
    };

    window.addEventListener(
      COMMUNITIES_CHANGED_EVENT,
      handleCommunitiesChanged
    );

    window.addEventListener('focus', handleCommunitiesChanged);

    return () => {
      window.removeEventListener(
        COMMUNITIES_CHANGED_EVENT,
        handleCommunitiesChanged
      );
      window.removeEventListener('focus', handleCommunitiesChanged);
    };
  }, [loadCommunities]);

  useEffect(() => {
    loadCommunities();
  }, [location.pathname, loadCommunities]);

  return (
    <>
      <button
        type="button"
        className={`nav-drawer-backdrop${mobileOpen ? ' is-visible' : ''}`}
        aria-label="Close navigation menu"
        aria-hidden={!mobileOpen}
        tabIndex={mobileOpen ? 0 : -1}
        onClick={closeMobileNav}
      />

      <aside
        id="app-navigation"
        className={`left-sidebar${isCollapsed ? ' collapsed' : ''}${
          mobileOpen ? ' is-mobile-open' : ''
        }`}
      >
        <div className="sidebar-header">
          {!isCompact && (
            <span className="sidebar-header-label">NAVIGATION</span>
          )}

          <button
            type="button"
            className="btn-icon sidebar-collapse-toggle"
            onClick={onToggleCollapse}
            title={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            aria-label={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            aria-expanded={!isCollapsed}
          >
            <Icon
              name={isCollapsed ? 'chevronRight' : 'chevronLeft'}
              size={18}
            />
          </button>
        </div>

        <div className="sidebar-section">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              title={isCompact ? item.label : undefined}
              className={({ isActive }) =>
                `sidebar-link${isActive ? ' active' : ''}`
              }
              onClick={closeMobileNav}
            >
              <Icon name={item.icon} size={18} />
              {!isCompact && (
                <span className="sidebar-link-label">{item.label}</span>
              )}
            </NavLink>
          ))}
        </div>

        <div className="sidebar-section">
          {!isCompact && <div className="sidebar-title">COMMUNITIES</div>}

          {communitiesLoading && communities.length === 0 && (
            <div className="sidebar-community-status">
              {!isCompact && 'Loading communities...'}
            </div>
          )}

          {!communitiesLoading && communitiesError && communities.length === 0 && (
            <div className="sidebar-community-status">
              {!isCompact && 'Could not load communities.'}
              <button
                type="button"
                className="sidebar-retry-button"
                onClick={loadCommunities}
              >
                Retry
              </button>
            </div>
          )}

          {!communitiesLoading &&
            !communitiesError &&
            communities.length === 0 && (
              <div className="sidebar-community-status">
                {!isCompact && 'No communities yet.'}
              </div>
            )}

          {communities.map((community, index) => {
            const name = getCommunityName(community);
            const image = getCommunityImage(community);
            const color = AVATAR_COLORS[index % AVATAR_COLORS.length];

            return (
              <NavLink
                key={getCommunityId(community)}
                to={getCommunityPath(community)}
                title={isCompact ? name : undefined}
                className={({ isActive }) =>
                  `sidebar-link sidebar-community-link${
                    isActive ? ' active' : ''
                  }`
                }
                onClick={closeMobileNav}
              >
                <span
                  className="sidebar-community-avatar"
                  style={{ backgroundColor: color }}
                >
                  {image ? (
                    <img
                      src={image}
                      alt=""
                      loading="lazy"
                      onError={(event) => {
                        event.currentTarget.style.display = 'none';
                        event.currentTarget.nextElementSibling?.style.setProperty(
                          'display',
                          'flex'
                        );
                      }}
                    />
                  ) : null}

                  <span
                    className="sidebar-community-initials"
                    style={{ display: image ? 'none' : 'flex' }}
                  >
                    {getInitials(name)}
                  </span>
                </span>

                {!isCompact && (
                  <span className="sidebar-community-name">{name}</span>
                )}
              </NavLink>
            );
          })}

          <NavLink
            to="/communities/create"
            title={isCompact ? 'Create community' : undefined}
            className="sidebar-link sidebar-create-community"
            onClick={closeMobileNav}
          >
            <Icon name="plus" size={18} />
            {!isCompact && (
              <span className="sidebar-link-label">Create community</span>
            )}
          </NavLink>
        </div>

        {!isCompact && (
          <div className="sidebar-promo-card">
            <div className="sidebar-promo-university">Geeta University</div>
            <div className="sidebar-promo-heading">
              Same Students.
              <br />
              Bigger Conversations.
            </div>
            <div className="sidebar-promo-description">
              Ideas. People. Progress.
            </div>
          </div>
        )}
      </aside>
    </>
  );
};

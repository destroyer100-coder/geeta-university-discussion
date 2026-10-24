
import React, { useEffect, useState } from 'react';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import { Navbar } from './Navbar';
import { Sidebar } from './Sidebar';
import { Rightbar } from './Rightbar';
import { CreatePostModal } from '../composer/CreatePostModal';

export const MainLayout = () => {
  const [isCreatePostOpen, setIsCreatePostOpen] = useState(false);
  const [modalCommunityId, setModalCommunityId] = useState(null);

  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(() => {
    try {
      return localStorage.getItem('sidebar_collapsed') === 'true';
    } catch {
      return false;
    }
  });

  const [isMobileNavOpen, setIsMobileNavOpen] = useState(false);

  const location = useLocation();
  const navigate = useNavigate();

  const handleToggleSidebar = () => {
    setIsSidebarCollapsed((prev) => {
      const next = !prev;

      try {
        localStorage.setItem('sidebar_collapsed', String(next));
      } catch {}

      return next;
    });
  };

  const handleOpenCreatePost = (communityId = null) => {
    setModalCommunityId(
      typeof communityId === 'string' && communityId
        ? communityId
        : null
    );

    setIsCreatePostOpen(true);
  };

  const handlePostCreated = (post) => {
    if (post?._id) {
      navigate(`/discussions/${post._id}`);
    } else {
      window.location.reload();
    }
  };

  const hideRightbar =
    location.pathname.startsWith('/profile') ||
    location.pathname.startsWith('/messages');

  const layoutClassName = `main-layout${
    isSidebarCollapsed ? ' is-collapsed' : ''
  }${hideRightbar ? ' no-rightbar' : ''}`;

  useEffect(() => {
    setIsMobileNavOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    const handlePopState = () => {
      setIsMobileNavOpen(false);
    };

    window.addEventListener('popstate', handlePopState);

    return () => {
      window.removeEventListener('popstate', handlePopState);
    };
  }, []);

  useEffect(() => {
    if (!isMobileNavOpen) return;

    const onKey = (event) => {
      if (event.key === 'Escape') {
        setIsMobileNavOpen(false);
      }
    };

    window.addEventListener('keydown', onKey);

    return () => {
      window.removeEventListener('keydown', onKey);
    };
  }, [isMobileNavOpen]);

  const handleMenuToggle = () => {
    if (window.innerWidth <= 768) {
      setIsMobileNavOpen((prev) => !prev);
    } else {
      handleToggleSidebar();
    }
  };

  return (
    <div className="app-container">
      <Navbar
        onOpenCreatePost={() => handleOpenCreatePost()}
        onOpenMobileNav={handleMenuToggle}
        isMobileNavOpen={isMobileNavOpen}
      />

      <div className={layoutClassName}>
        <Sidebar
          isCollapsed={isSidebarCollapsed}
          onToggleCollapse={handleToggleSidebar}
          mobileOpen={isMobileNavOpen}
          onCloseMobileNav={() => setIsMobileNavOpen(false)}
        />

        <main className="content-area">
          <Outlet context={{ openCreatePost: handleOpenCreatePost }} />
        </main>

        {!hideRightbar && <Rightbar />}
      </div>

      <CreatePostModal
        isOpen={isCreatePostOpen}
        onClose={() => {
          setIsCreatePostOpen(false);
          setModalCommunityId(null);
        }}
        initialCommunityId={modalCommunityId}
        onPostCreated={handlePostCreated}
      />
    </div>
  );
};

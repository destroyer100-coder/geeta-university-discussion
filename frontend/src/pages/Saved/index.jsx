import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { usersApi } from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import { PostCard } from '../../components/post/PostCard';
import { PageHero } from '../../components/common/PageHero';
import { Icon } from '../../components/common/Icons';

export const SavedPage = () => {
  const { user } = useAuth();
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeType, setActiveType] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [errorNotice, setErrorNotice] = useState('');

  const loadSaved = async () => {
    if (!user) {
      setPosts([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    setErrorNotice('');
    try {
      const response = await usersApi.getSaved();
      setPosts(response.success && Array.isArray(response.data) ? response.data : []);
    } catch (error) {
      setErrorNotice(error.message || 'Saved discussions could not be loaded.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadSaved(); }, [user?._id]);

  const counts = useMemo(() => ({
    all: posts.length,
    discussion: posts.filter((post) => post.type === 'discussion').length,
    question: posts.filter((post) => post.type === 'question').length,
    resource: posts.filter((post) => post.type === 'resource').length,
  }), [posts]);

  const visiblePosts = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    return posts.filter((post) => {
      const matchesType = activeType === 'all' || post.type === activeType;
      const matchesSearch = !query || [post.title, post.body, ...(post.tags || [])].filter(Boolean).some((value) => String(value).toLowerCase().includes(query));
      return matchesType && matchesSearch;
    });
  }, [posts, activeType, searchQuery]);

  return (
    <div className="page-shell page-saved">
      <PageHero icon="bookmark" title="Saved" description="Find the discussions and resources you have bookmarked." />
      {!user ? (
        <div className="card people-empty"><h3>Sign in to view your saved posts</h3><Link to="/login" className="btn btn-primary">Sign in</Link></div>
      ) : (
        <>
          <div className="page-toolbar saved-toolbar">
            <label className="page-toolbar-search event-search"><Icon name="search" size={17} /><input className="form-control" type="search" placeholder="Search saved posts..." value={searchQuery} onChange={(event) => setSearchQuery(event.target.value)} /></label>
          </div>
          <div className="page-tabs saved-filter-tabs" role="tablist" aria-label="Saved post types">
            {[
              { key: 'all', label: 'All Saved' },
              { key: 'discussion', label: 'Discussions' },
              { key: 'question', label: 'Questions' },
              { key: 'resource', label: 'Resources' },
            ].map((tab) => (
              <button type="button" key={tab.key} className={activeType === tab.key ? 'btn btn-primary' : 'btn btn-secondary'} aria-selected={activeType === tab.key} onClick={() => setActiveType(tab.key)}>
                {tab.label} <span>{counts[tab.key]}</span>
              </button>
            ))}
          </div>
          {errorNotice ? <div className="notification-error" role="alert">{errorNotice}</div> : null}
          {loading ? (
            <div className="loading-state">Loading saved posts...</div>
          ) : visiblePosts.length === 0 ? (
            <div className="card people-empty"><Icon name="bookmark" size={30} /><h3>{posts.length ? 'No saved posts match this filter' : 'No saved posts yet'}</h3><p>{posts.length ? 'Try another post type or search term.' : 'Save a discussion from its action bar to keep it here.'}</p><Link to="/explore" className="btn btn-outline">Explore Discussions</Link></div>
          ) : (
            visiblePosts.map((post) => <PostCard key={post._id} post={post} onPostUpdated={loadSaved} />)
          )}
        </>
      )}
    </div>
  );
};

export default SavedPage;

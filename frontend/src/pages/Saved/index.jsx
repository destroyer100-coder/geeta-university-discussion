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
      setPosts([]);
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
      const matchesSearch = !query || [post.title, post.body, ...(post.tags || [])]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(query));
      return matchesType && matchesSearch;
    });
  }, [posts, activeType, searchQuery]);

  return (
    <div className="page-shell page-saved">
      <PageHero icon="bookmark" title="Saved" description="Find the discussions and resources you have bookmarked." />

      {!user ? (
        <div className="card people-empty">
          <Icon name="bookmark" size={30} />
          <h3>Sign in to view your saved posts</h3>
          <p>Your saved discussions are private to your account.</p>
          <Link to="/login" className="btn btn-primary">Sign in</Link>
        </div>
      ) : (
        <div className="saved-workspace">
          <main className="saved-main">
            <div className="page-toolbar saved-toolbar">
              <label className="page-toolbar-search event-search">
                <Icon name="search" size={17} />
                <input className="form-control" type="search" placeholder="Search saved posts..." value={searchQuery} onChange={(event) => setSearchQuery(event.target.value)} />
              </label>
            </div>

            <div className="page-tabs saved-filter-tabs" role="tablist" aria-label="Saved post types">
              {[
                { key: 'all', label: 'All Saved' },
                { key: 'discussion', label: 'Posts' },
                { key: 'resource', label: 'Resources' },
                { key: 'question', label: 'Questions' },
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
              <div className="card people-empty">
                <Icon name="bookmark" size={30} />
                <h3>{posts.length ? 'No saved posts match this filter' : 'No saved posts yet'}</h3>
                <p>{posts.length ? 'Try another post type or search term.' : 'Save a discussion from its action bar to keep it here.'}</p>
                <Link to="/explore" className="btn btn-outline">Explore Discussions</Link>
              </div>
            ) : (
              <div className="saved-post-list">
                {visiblePosts.map((post) => <PostCard key={post._id} post={post} onPostUpdated={loadSaved} />)}
              </div>
            )}
          </main>

          <aside className="saved-side">
            <section className="card saved-side-card">
              <header className="saved-side-heading"><h2><Icon name="barChart2" size={18} /> Saved Overview</h2></header>
              <div className="saved-overview-total"><strong>{counts.all}</strong><span>Saved posts</span></div>
              <div className="saved-type-row"><span><Icon name="messageSquare" size={15} /> Discussions</span><strong>{counts.discussion}</strong></div>
              <div className="saved-type-row"><span><Icon name="fileText" size={15} /> Resources</span><strong>{counts.resource}</strong></div>
              <div className="saved-type-row"><span><Icon name="helpCircle" size={15} /> Questions</span><strong>{counts.question}</strong></div>
              <p className="saved-side-note">These totals are calculated from the saved posts returned for your account.</p>
            </section>

            <section className="card saved-side-card">
              <header className="saved-side-heading"><h2><Icon name="zap" size={18} /> Quick Actions</h2></header>
              <Link to="/explore" className="saved-quick-action"><Icon name="compass" size={17} /><span>Discover Discussions</span><Icon name="chevronRight" size={15} /></Link>
              <Link to="/communities" className="saved-quick-action"><Icon name="users" size={17} /><span>Explore Communities</span><Icon name="chevronRight" size={15} /></Link>
              <Link to="/my-discussions" className="saved-quick-action"><Icon name="messageSquare" size={17} /><span>My Discussions</span><Icon name="chevronRight" size={15} /></Link>
            </section>
          </aside>
        </div>
      )}
    </div>
  );
};

export default SavedPage;

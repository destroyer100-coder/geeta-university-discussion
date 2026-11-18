import React, { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { postsApi } from '../../services/api';
import { PostCard } from '../../components/post/PostCard';
import { PageHero } from '../../components/common/PageHero';
import { Icon } from '../../components/common/Icons';

const PAGE_SIZE = 10;

export const MyDiscussionsPage = () => {
  const { user, loading: authLoading } = useAuth();
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [countLoading, setCountLoading] = useState(true);
  const [activeStatus, setActiveStatus] = useState('all');
  const [page, setPage] = useState(1);
  const [pageCount, setPageCount] = useState(0);
  const [counts, setCounts] = useState({ all: 0, published: 0, pending: 0, rejected: 0 });
  const [errorNotice, setErrorNotice] = useState('');

  const fetchCounts = useCallback(async () => {
    if (!user?._id) {
      setCounts({ all: 0, published: 0, pending: 0, rejected: 0 });
      setCountLoading(false);
      return;
    }
    setCountLoading(true);
    try {
      const [allResult, publishedResult, pendingResult, rejectedResult] = await Promise.all([
        postsApi.getAll({ author: user._id, page: 1, limit: 1 }),
        postsApi.getAll({ author: user._id, status: 'published', page: 1, limit: 1 }),
        postsApi.getAll({ author: user._id, status: 'pending', page: 1, limit: 1 }),
        postsApi.getAll({ author: user._id, status: 'rejected', page: 1, limit: 1 }),
      ]);
      setCounts({
        all: allResult.pagination?.total || 0,
        published: publishedResult.pagination?.total || 0,
        pending: pendingResult.pagination?.total || 0,
        rejected: rejectedResult.pagination?.total || 0,
      });
    } catch (error) {
      setErrorNotice(error.message || 'Discussion totals could not be loaded.');
    } finally {
      setCountLoading(false);
    }
  }, [user?._id]);

  const fetchMyPosts = useCallback(async () => {
    if (!user?._id) {
      setPosts([]);
      setLoading(false);
      setPageCount(0);
      return;
    }
    setLoading(true);
    setErrorNotice('');
    try {
      const params = { author: user._id, page, limit: PAGE_SIZE };
      if (activeStatus !== 'all') params.status = activeStatus;
      const response = await postsApi.getAll(params);
      setPosts(response.success && Array.isArray(response.data) ? response.data : []);
      setPageCount(response.pagination?.pages || 0);
    } catch (error) {
      setPosts([]);
      setErrorNotice(error.message || 'Your discussions could not be loaded.');
    } finally {
      setLoading(false);
    }
  }, [user?._id, activeStatus, page]);

  useEffect(() => {
    if (!authLoading) {
      fetchCounts();
      fetchMyPosts();
    }
  }, [user?._id, authLoading, fetchCounts, fetchMyPosts]);

  const selectStatus = (status) => {
    setActiveStatus(status);
    setPage(1);
  };

  return (
    <div className="page-shell page-my-discussions">
      <PageHero
        icon="messageSquare"
        title="My Discussions"
        description="Manage, create and track all your discussions on the forum."
        action={user ? <Link to="/create" className="btn btn-primary"><Icon name="plus" size={17} /> Create New Post</Link> : null}
      />

      {!user ? (
        <div className="card people-empty">
          <Icon name="messageSquare" size={30} />
          <h3>Sign in to view your discussions</h3>
          <Link to="/login" className="btn btn-primary">Sign in</Link>
        </div>
      ) : (
        <div className="my-discussions-workspace">
          <main className="my-discussions-main">
            <div className="page-tabs discussion-status-tabs" role="tablist" aria-label="Filter your discussions">
              {[
                { key: 'all', label: 'All Posts' },
                { key: 'published', label: 'Published' },
                { key: 'pending', label: 'Pending' },
                { key: 'rejected', label: 'Rejected' },
              ].map((tab) => (
                <button
                  type="button"
                  key={tab.key}
                  className={activeStatus === tab.key ? 'btn btn-primary' : 'btn btn-secondary'}
                  aria-selected={activeStatus === tab.key}
                  onClick={() => selectStatus(tab.key)}
                >
                  {tab.label} <span>{countLoading ? '–' : counts[tab.key]}</span>
                </button>
              ))}
            </div>

            {errorNotice ? <div className="notification-error" role="alert">{errorNotice}</div> : null}
            {loading ? (
              <div className="loading-state">Loading your discussions...</div>
            ) : posts.length === 0 ? (
              <div className="card people-empty">
                <Icon name="messageSquare" size={30} />
                <h3>{counts.all ? 'No posts in this status' : 'You have not posted yet'}</h3>
                <p>{counts.all ? 'Choose another status filter to see your posts.' : 'Create a discussion or share a resource with the university community.'}</p>
                {!counts.all ? <Link to="/create" className="btn btn-primary">Create New Post</Link> : null}
              </div>
            ) : (
              <div className="my-discussion-list">
                {posts.map((post) => <PostCard key={post._id} post={post} onPostUpdated={fetchMyPosts} />)}
              </div>
            )}

            {pageCount > 1 ? (
              <nav className="my-discussions-pagination" aria-label="Discussion pages">
                <button type="button" className="btn btn-outline btn-sm" onClick={() => setPage((value) => Math.max(1, value - 1))} disabled={page <= 1}>Previous</button>
                <span>Page {page} of {pageCount}</span>
                <button type="button" className="btn btn-outline btn-sm" onClick={() => setPage((value) => Math.min(pageCount, value + 1))} disabled={page >= pageCount}>Next</button>
              </nav>
            ) : null}
          </main>

          <aside className="my-discussions-side">
            <section className="card my-discussions-side-card">
              <header className="my-discussions-side-heading"><h2><Icon name="barChart2" size={18} /> Your Discussion Stats</h2></header>
              <div className="my-discussions-total"><strong>{countLoading ? '–' : counts.all}</strong><span>Total Discussions</span></div>
              <div className="my-discussions-stat-row"><span><i className="status-dot published" /> Published</span><strong>{countLoading ? '–' : counts.published}</strong></div>
              <div className="my-discussions-stat-row"><span><i className="status-dot pending" /> Pending Review</span><strong>{countLoading ? '–' : counts.pending}</strong></div>
              <div className="my-discussions-stat-row"><span><i className="status-dot rejected" /> Rejected</span><strong>{countLoading ? '–' : counts.rejected}</strong></div>
            </section>

            <section className="card my-discussions-side-card">
              <header className="my-discussions-side-heading"><h2><Icon name="zap" size={18} /> Quick Actions</h2></header>
              <Link to="/create" className="my-discussions-action"><Icon name="plus" size={17} /><span>Create New Post</span><Icon name="chevronRight" size={15} /></Link>
              <Link to="/explore" className="my-discussions-action"><Icon name="compass" size={17} /><span>Explore Discussions</span><Icon name="chevronRight" size={15} /></Link>
              <Link to="/saved" className="my-discussions-action"><Icon name="bookmark" size={17} /><span>View Saved Posts</span><Icon name="chevronRight" size={15} /></Link>
            </section>

            <section className="card my-discussions-side-card">
              <header className="my-discussions-side-heading"><h2><Icon name="clock" size={18} /> Recent Posts</h2></header>
              {posts.slice(0, 3).map((post) => (
                <Link to={'/discussions/' + post._id} className="my-discussions-recent" key={post._id}>
                  <strong>{post.title}</strong>
                  <small>{post.createdAt ? new Date(post.createdAt).toLocaleDateString() : ''} · {post.status || 'Published'}</small>
                </Link>
              ))}
              {!posts.length ? <p className="my-discussions-side-empty">Your recent discussions will appear here.</p> : null}
            </section>
          </aside>
        </div>
      )}
    </div>
  );
};

export default MyDiscussionsPage;

import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { postsApi } from '../../services/api';
import { PostCard } from '../../components/post/PostCard';
import { PageHero } from '../../components/common/PageHero';
import { Icon } from '../../components/common/Icons';

const statusFor = (post) => String(post.status || '').toLowerCase();

export const MyDiscussionsPage = () => {
  const { user, loading: authLoading } = useAuth();
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeStatus, setActiveStatus] = useState('all');
  const [errorNotice, setErrorNotice] = useState('');

  const fetchMyPosts = async () => {
    if (!user?._id) {
      setPosts([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    setErrorNotice('');
    try {
      const response = await postsApi.getAll({ author: user._id });
      setPosts(response.success && Array.isArray(response.data) ? response.data : []);
    } catch (error) {
      setErrorNotice(error.message || 'Your discussions could not be loaded.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!authLoading) fetchMyPosts();
  }, [user?._id, authLoading]);

  const counts = useMemo(() => ({
    all: posts.length,
    published: posts.filter((post) => statusFor(post) === 'published').length,
    pending: posts.filter((post) => statusFor(post) === 'pending').length,
    rejected: posts.filter((post) => statusFor(post) === 'rejected').length,
  }), [posts]);

  const visiblePosts = useMemo(() => posts.filter((post) => activeStatus === 'all' || statusFor(post) === activeStatus), [posts, activeStatus]);

  return (
    <div className="page-shell page-my-discussions">
      <PageHero icon="messageSquare" title="My Discussions" description="Manage, create and track your discussions on the forum." action={user ? <Link to="/create" className="btn btn-primary"><Icon name="plus" size={17} /> Create New Post</Link> : null} />

      {!user ? <div className="card people-empty"><h3>Sign in to view your discussions</h3><Link to="/login" className="btn btn-primary">Sign in</Link></div> : null}
      {user ? (
        <>
          <div className="page-tabs discussion-status-tabs" role="tablist" aria-label="Filter your discussions">
            {[
              { key: 'all', label: 'All Posts' },
              { key: 'published', label: 'Published' },
              { key: 'pending', label: 'Pending Review' },
              { key: 'rejected', label: 'Rejected' },
            ].map((tab) => (
              <button type="button" key={tab.key} className={activeStatus === tab.key ? 'btn btn-primary' : 'btn btn-secondary'} aria-selected={activeStatus === tab.key} onClick={() => setActiveStatus(tab.key)}>
                {tab.label} <span>{counts[tab.key]}</span>
              </button>
            ))}
          </div>
          {errorNotice ? <div className="notification-error" role="alert">{errorNotice}</div> : null}
          {loading ? (
            <div className="loading-state">Loading your discussions...</div>
          ) : visiblePosts.length === 0 ? (
            <div className="card people-empty"><Icon name="messageSquare" size={30} /><h3>{posts.length ? 'No posts in this status' : 'You haven’t posted yet'}</h3><p>{posts.length ? 'Choose another status filter to see your posts.' : 'Create a discussion or share a resource with the university community.'}</p></div>
          ) : (
            visiblePosts.map((post) => <PostCard key={post._id} post={post} onPostUpdated={fetchMyPosts} />)
          )}
        </>
      ) : null}
    </div>
  );
};

export default MyDiscussionsPage;

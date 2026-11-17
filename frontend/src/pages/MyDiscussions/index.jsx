import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { postsApi } from '../../services/api';
import { PostCard } from '../../components/post/PostCard';
import { Link } from 'react-router-dom';
import { PageHero } from '../../components/common/PageHero';
import { Icon } from '../../components/common/Icons';

export const MyDiscussionsPage = () => {
  const { user, loading: authLoading } = useAuth();
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchMyPosts = async () => {
    if (!user?._id) return;
    setLoading(true);
    try {
      const res = await postsApi.getAll({ author: user._id });
      if (res.success && res.data) {
        setPosts(res.data);
      }
    } catch (err) {
      console.error('Failed to load my discussions:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!authLoading) {
      if (user?._id) {
        fetchMyPosts();
      } else {
        setLoading(false);
      }
    }
  }, [user?._id, authLoading]);

  return (
    <div className="page-shell page-my-discussions">
      <PageHero
        icon="messageSquare"
        title="My Discussions"
        description="Manage, create and track all your discussions on the forum."
        action={user ? (
          <Link to="/create" className="btn btn-primary">
            <Icon name="plus" size={17} /> Create New Post
          </Link>
        ) : null}
      />

      {loading ? (
        <div style={{ textAlign: 'center', padding: '40px' }}>Loading your discussions...</div>
      ) : posts.length === 0 ? (
        <div className="card" style={{ textAlign: 'center', padding: '40px' }}>
          <h3>You haven't posted yet</h3>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', margin: '8px 0' }}>
            Ask a doubt or share a resource with your peers!
          </p>
        </div>
      ) : (
        posts.map(p => <PostCard key={p._id} post={p} onPostUpdated={fetchMyPosts} />)
      )}
    </div>
  );
};

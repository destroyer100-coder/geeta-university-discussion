import React, { useState, useEffect } from 'react';
import { PostCard } from '../../components/post/PostCard';
import { postsApi } from '../../services/api';
import { Icon } from '../../components/common/Icons';
import { useAuth } from '../../context/AuthContext';

export const Home = ({ onOpenCreatePost }) => {
  const { user } = useAuth();
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeFilter, setActiveFilter] = useState('latest');
  const [selectedTag, setSelectedTag] = useState('');

  const readLocalPosts = () => {
    try { return JSON.parse(localStorage.getItem('guf-local-post-preview') || '[]'); } catch { return []; }
  };

  const mergeLocalPosts = (serverPosts = []) => {
    const localPosts = readLocalPosts().filter((post) => !selectedTag || (post.tags || []).includes(selectedTag));
    const knownIds = new Set(serverPosts.map((post) => String(post._id)));
    return [...localPosts.filter((post) => !knownIds.has(String(post._id))), ...serverPosts];
  };

  const fetchPosts = async () => {
    setLoading(true);
    try {
      const params = { sort: activeFilter };
      if (selectedTag) params.tag = selectedTag;
      const res = await postsApi.getAll(params);
      if (res.success && res.data) {
        setPosts(mergeLocalPosts(res.data));
      }
    } catch (err) {
      console.error('Failed to load posts:', err);
      setPosts(mergeLocalPosts([]));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPosts();
    const refreshLocalPosts = () => setPosts(mergeLocalPosts(posts));
    window.addEventListener('local-posts:changed', refreshLocalPosts);
    return () => window.removeEventListener('local-posts:changed', refreshLocalPosts);
  }, [activeFilter, selectedTag]);

  return (
    <div className="page-shell page-home">
      <section className="home-campus-hero">
        <div className="home-campus-eyebrow">GEETA UNIVERSITY</div>
        <h1 className="home-campus-title">Campus Discussion <em>Forum</em></h1>
        <p className="home-campus-subtitle">Ask · Discuss · Learn · Collaborate · Grow Together</p>
      </section>

      {/* CRITICAL RULE (Section 1 & Section 5):
          "Home/Feed shows a Create Post button only. The full composer opens after the user clicks Create Post."
          NO permanent embedded composer is rendered here. */}
      <div
        className="home-cta-card"
        style={{
          background: '#ffffff',
          border: '1px solid var(--border-color)',
          borderRadius: 'var(--radius-lg)',
          padding: '14px 18px',
          marginBottom: '20px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '12px',
          boxShadow: 'var(--shadow-sm)',
        }}
      >
        <div className="home-composer-launch">
          {user?.avatar ? (
            <img className="home-composer-avatar" src={user.avatar} alt="" loading="lazy" decoding="async" />
          ) : (
            <span className="home-composer-avatar home-composer-initials">
              {(user?.name || 'G').trim().split(/\s+/).slice(0, 2).map((part) => part[0]).join('').toUpperCase()}
            </span>
          )}
          <button type="button" className="home-cta-prompt" onClick={() => onOpenCreatePost?.()}>
            What’s on your mind{user?.name ? `, ${user.name.split(/\s+/)[0]}` : ''}?
          </button>
          <div className="home-cta-tools" aria-label="Create post attachments">
            <button type="button" title="Add image" aria-label="Add image" onClick={() => onOpenCreatePost?.(null, 'image')}><Icon name="image" size={19} /></button>
            <button type="button" title="Add video" aria-label="Add video" onClick={() => onOpenCreatePost?.(null, 'video')}><Icon name="video" size={19} /></button>
            <button type="button" title="Attach file" aria-label="Attach file" onClick={() => onOpenCreatePost?.(null, 'file')}><Icon name="fileText" size={19} /></button>
            <button type="button" title="Create poll" aria-label="Create poll" onClick={() => onOpenCreatePost?.(null, 'poll')}><Icon name="barChart2" size={19} /></button>
          </div>
        </div>

        <button
          id="home-create-post-trigger"
          className="btn btn-accent"
          onClick={() => onOpenCreatePost?.()}
          style={{ padding: '9px 20px', borderRadius: 'var(--radius-md)', gap: '8px' }}
        >
          <Icon name="plus" size={16} color="#fff" />
          <span>+ Create Post</span>
        </button>
      </div>

      {/* Feed Filter Bar (Reference 1) */}
      <div
        className="home-feed-tabs"
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '8px',
          borderBottom: '1px solid var(--border-color)',
          paddingBottom: '12px',
          marginBottom: '16px',
        }}
      >
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          {[
            { key: 'latest', label: 'Latest', icon: 'layers' },
            { key: 'trending', label: 'Trending', icon: 'trendingUp' },
            { key: 'following', label: 'Following', icon: 'users' },
            { key: 'helpful', label: 'Most Helpful', icon: 'star' },
          ].map((tab) => (
            <button
              key={tab.key}
              className={`btn btn-sm ${activeFilter === tab.key ? 'btn-primary' : 'btn-secondary'}`}
              onClick={() => setActiveFilter(tab.key)}
            >
              <Icon name={tab.icon} size={17} />
              <span>{tab.label}</span>
            </button>
          ))}
        </div>

        {selectedTag && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span className="badge badge-primary">Filtered: #{selectedTag}</span>
            <button
              onClick={() => setSelectedTag('')}
              style={{ border: 'none', background: 'transparent', cursor: 'pointer', fontSize: '0.75rem', color: '#ef4444' }}
            >
              Clear
            </button>
          </div>
        )}
      </div>

      {/* Post List */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>
          Loading discussions...
        </div>
      ) : posts.length === 0 ? (
        <div className="card" style={{ textAlign: 'center', padding: '40px' }}>
          <div style={{ fontSize: '2rem', marginBottom: '10px' }}>💬</div>
          <h3>No discussions found</h3>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', margin: '8px 0 16px' }}>
            Be the first to start a conversation in this topic!
          </p>
          <button className="btn btn-primary" onClick={() => onOpenCreatePost?.()}>
            Create Post
          </button>
        </div>
      ) : (
        posts.map((post) => (
          <PostCard
            key={post._id}
            post={post}
            onPostUpdated={fetchPosts}
          />
        ))
      )}
    </div>
  );
};

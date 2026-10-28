import React, { useState, useEffect } from 'react';
import { PostCard } from '../../components/post/PostCard';
import { postsApi } from '../../services/api';
import { Icon } from '../../components/common/Icons';

export const Home = ({ onOpenCreatePost }) => {
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeFilter, setActiveFilter] = useState('latest');
  const [selectedTag, setSelectedTag] = useState('');

  const fetchPosts = async () => {
    setLoading(true);
    try {
      const params = { sort: activeFilter };
      if (selectedTag) params.tag = selectedTag;
      const res = await postsApi.getAll(params);
      if (res.success && res.data) {
        setPosts(res.data);
      }
    } catch (err) {
      console.error('Failed to load posts:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPosts();
  }, [activeFilter, selectedTag]);

  return (
    <div>
      {/* Banner / Header (Visual Reference 1) */}
      <div
        style={{
          background: 'linear-gradient(135deg, #1e3a8a 0%, #0f172a 100%)',
          borderRadius: 'var(--radius-lg)',
          padding: '24px 28px',
          color: '#ffffff',
          marginBottom: '20px',
          boxShadow: 'var(--shadow-md)',
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        <div style={{ position: 'relative', zIndex: 1 }}>
          <div style={{ fontSize: '0.8rem', fontWeight: 700, color: '#f59e0b', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '6px' }}>
            A Campus Community for Students & Faculty
          </div>
          <h1 style={{ fontSize: '1.6rem', fontWeight: 800, marginBottom: '6px', letterSpacing: '-0.5px' }}>
            GEETA UNIVERSITY DISCUSSION
          </h1>
          <p style={{ fontSize: '0.9rem', color: '#cbd5e1', marginBottom: '18px', maxWidth: '640px' }}>
            Discuss, Learn, Share, Grow. Connect with peers, seniors and faculty across departments.
          </p>


        </div>
      </div>

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
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div
            style={{
              width: 38,
              height: 38,
              borderRadius: '50%',
              background: 'var(--primary-light)',
              color: 'var(--primary)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontWeight: 700,
            }}
          >
            ✏️
          </div>
          <div>
            <div style={{ fontWeight: 700, fontSize: '0.95rem', color: 'var(--text-main)' }}>
              Have something academic to ask or share?
            </div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
              Attach notes, questions, code repositories, polls, and video roadmaps.
            </div>
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
            { key: 'latest', label: 'Latest' },
            { key: 'trending', label: 'Trending' },
            { key: 'helpful', label: 'Most Helpful' },
          ].map((tab) => (
            <button
              key={tab.key}
              className={`btn btn-sm ${activeFilter === tab.key ? 'btn-primary' : 'btn-secondary'}`}
              onClick={() => setActiveFilter(tab.key)}
            >
              {tab.label}
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

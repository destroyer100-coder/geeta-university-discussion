import React, { useState, useEffect } from 'react';
import { PostCard } from '../../components/post/PostCard';
import { postsApi } from '../../services/api';
import { Icon } from '../../components/common/Icons';

const EXPLORE_TAGS = [
  'All',
  'DSA',
  'Placements',
  'Exams',
  'Projects',
  'WebDev',
  'AI-ML',
  'Notes',
  'Campus',
];

export const ExplorePage = ({ onOpenCreatePost }) => {
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedTag, setSelectedTag] = useState('All');
  const [selectedType, setSelectedType] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');

  const fetchExplorePosts = async () => {
    setLoading(true);
    try {
      const res = await postsApi.getAll({
        tag: selectedTag !== 'All' ? selectedTag : undefined,
        type: selectedType !== 'all' ? selectedType : undefined,
        search: searchQuery.trim() || undefined,
        sort: 'trending',
      });
      if (res.success && res.data) {
        setPosts(res.data);
      }
    } catch (err) {
      console.error('Failed to load explore feed:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchExplorePosts();
  }, [selectedTag, selectedType, searchQuery]);

  return (
    <div>
      {/* Header */}
      <div style={{ marginBottom: '20px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
          <Icon name="compass" size={24} color="var(--primary)" />
          <h1 style={{ fontSize: '1.5rem', fontWeight: 800 }}>Explore Geeta University Discussions</h1>
        </div>
        <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>
          Discover trending academic roadmaps, study resources, campus questions and active conversations.
        </p>
      </div>

      {/* Filter Controls */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '20px' }}>
        {/* Search Input */}
        <div style={{ maxWidth: '440px' }}>
          <input
            type="text"
            className="form-control"
            placeholder="Filter discussions by keywords..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>

        {/* Post Type Selector */}
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          {[
            { key: 'all', label: 'All Content' },
            { key: 'resource', label: '📚 Resources' },
            { key: 'question', label: '❓ Questions' },
            { key: 'discussion', label: '💬 Discussions' },
          ].map((t) => (
            <button
              key={t.key}
              className={`btn btn-sm ${selectedType === t.key ? 'btn-primary' : 'btn-secondary'}`}
              onClick={() => setSelectedType(t.key)}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* Tag Pills */}
        <div style={{ display: 'flex', gap: '8px', overflowX: 'auto', paddingBottom: '4px' }}>
          {EXPLORE_TAGS.map((tag) => (
            <button
              key={tag}
              className={`tag-pill ${selectedTag === tag ? 'active' : ''}`}
              onClick={() => setSelectedTag(tag)}
              style={{
                cursor: 'pointer',
                border: selectedTag === tag ? '1px solid var(--primary)' : '1px solid var(--border-color)',
                background: selectedTag === tag ? 'var(--primary)' : 'var(--bg-muted)',
                color: selectedTag === tag ? '#ffffff' : 'var(--text-main)',
                fontWeight: 600,
                fontSize: '0.8rem',
                padding: '4px 12px',
                borderRadius: '16px',
              }}
            >
              {tag === 'All' ? 'All Topics' : `#${tag}`}
            </button>
          ))}
        </div>
      </div>

      {/* Posts List */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>
          Loading trending discussions...
        </div>
      ) : posts.length === 0 ? (
        <div className="card" style={{ textAlign: 'center', padding: '40px' }}>
          <div style={{ fontSize: '2rem', marginBottom: '8px' }}>🔍</div>
          <h3>No matching discussions found</h3>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', margin: '8px 0 16px' }}>
            Try selecting a different topic or start a new discussion.
          </p>
          {onOpenCreatePost && (
            <button className="btn btn-primary" onClick={() => onOpenCreatePost?.()}>
              + Start Discussion
            </button>
          )}
        </div>
      ) : (
        posts.map((post) => (
          <PostCard
            key={post._id}
            post={post}
            onPostUpdated={fetchExplorePosts}
          />
        ))
      )}
    </div>
  );
};

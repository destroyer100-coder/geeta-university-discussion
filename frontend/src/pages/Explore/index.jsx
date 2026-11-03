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

const CONTENT_TYPES = [
  { key: 'all', label: 'All content', icon: 'compass' },
  { key: 'resource', label: 'Resources', icon: 'fileText' },
  { key: 'question', label: 'Questions', icon: 'helpCircle' },
  { key: 'discussion', label: 'Discussions', icon: 'messageSquare' },
];

export const ExplorePage = ({ onOpenCreatePost }) => {
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedTag, setSelectedTag] = useState('All');
  const [selectedType, setSelectedType] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [error, setError] = useState('');

  const fetchExplorePosts = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await postsApi.getAll({
        tag: selectedTag !== 'All' ? selectedTag : undefined,
        type: selectedType !== 'all' ? selectedType : undefined,
        search: searchQuery.trim() || undefined,
        sort: 'trending',
      });
      if (res.success && res.data) {
        setPosts(res.data);
      } else {
        setPosts([]);
        setError(res.message || 'Explore discussions could not be loaded.');
      }
    } catch (err) {
      console.error('Failed to load explore feed:', err);
      setPosts([]);
      setError(err.message || 'Unable to connect to the server. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchExplorePosts();
  }, [selectedTag, selectedType, searchQuery]);

  return (
    <div className="explore-page">
      <header className="page-header explore-page-header">
        <div>
          <span className="page-eyebrow"><Icon name="compass" size={13} /> DISCOVER</span>
          <h1>Explore discussions</h1>
          <p>Find useful roadmaps, study resources, campus questions and conversations worth joining.</p>
        </div>
        {onOpenCreatePost && (
          <button type="button" className="btn btn-primary" onClick={() => onOpenCreatePost()}>
            <Icon name="plus" size={16} aria-hidden="true" />
            Start a discussion
          </button>
        )}
      </header>

      <section className="explore-controls" aria-label="Filter discussions">
        <label className="explore-search">
          <Icon name="search" size={17} aria-hidden="true" />
          <span className="sr-only">Search discussions</span>
          <input
            type="search"
            className="form-control"
            placeholder="Search discussions, topics or keywords…"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
          {searchQuery && (
            <button type="button" className="btn-icon" aria-label="Clear search" onClick={() => setSearchQuery('')}>
              <Icon name="x" size={16} />
            </button>
          )}
        </label>

        <div className="explore-type-filters" role="group" aria-label="Content type">
          {CONTENT_TYPES.map((type) => (
            <button
              key={type.key}
              type="button"
              className={`explore-type-chip${selectedType === type.key ? ' is-active' : ''}`}
              onClick={() => setSelectedType(type.key)}
              aria-pressed={selectedType === type.key}
            >
              <Icon name={type.icon} size={14} aria-hidden="true" />
              {type.label}
            </button>
          ))}
        </div>

        <div className="explore-topic-filters" role="group" aria-label="Filter by topic">
          {EXPLORE_TAGS.map((tag) => (
            <button
              key={tag}
              type="button"
              className={`explore-topic-chip${selectedTag === tag ? ' is-active' : ''}`}
              onClick={() => setSelectedTag(tag)}
              aria-pressed={selectedTag === tag}
            >
              {tag === 'All' ? 'All topics' : `#${tag}`}
            </button>
          ))}
        </div>
      </section>

      <div className="explore-results-heading">
        <div>
          <h2>Trending on campus</h2>
          <p>Popular conversations from across the university</p>
        </div>
        {!loading && <span>{posts.length} {posts.length === 1 ? 'discussion' : 'discussions'}</span>}
      </div>

      {loading ? (
        <div className="card feed-state-card" role="status" aria-live="polite">
          <span className="spinner" aria-hidden="true" />
          <p>Finding conversations…</p>
        </div>
      ) : error ? (
        <div className="card feed-state-card" role="alert">
          <span className="feed-state-icon"><Icon name="info" size={22} /></span>
          <h3>Could not load discussions</h3>
          <p>{error}</p>
          <button type="button" className="btn btn-primary" onClick={fetchExplorePosts}>Try again</button>
        </div>
      ) : posts.length === 0 ? (
        <div className="card feed-state-card">
          <span className="feed-state-icon"><Icon name="search" size={22} /></span>
          <h3>No matching discussions</h3>
          <p>Try another topic or content type, or start a new campus conversation.</p>
          {onOpenCreatePost && (
            <button type="button" className="btn btn-primary" onClick={() => onOpenCreatePost()}>
              <Icon name="plus" size={16} aria-hidden="true" />
              Start a discussion
            </button>
          )}
        </div>
      ) : (
        <div className="feed-post-list">
          {posts.map((post) => (
            <PostCard
              key={post._id}
              post={post}
              onPostUpdated={fetchExplorePosts}
            />
          ))}
        </div>
      )}
    </div>
  );
};

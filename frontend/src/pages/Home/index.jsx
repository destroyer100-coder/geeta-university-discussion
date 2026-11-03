import React, { useState, useEffect } from 'react';
import { PostCard } from '../../components/post/PostCard';
import { postsApi } from '../../services/api';
import { Icon } from '../../components/common/Icons';

export const Home = ({ onOpenCreatePost }) => {
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeFilter, setActiveFilter] = useState('latest');
  const [selectedTag, setSelectedTag] = useState('');
  const [error, setError] = useState('');

  const fetchPosts = async () => {
    setLoading(true);
    setError('');
    try {
      const params = { sort: activeFilter };
      if (selectedTag) params.tag = selectedTag;
      const res = await postsApi.getAll(params);
      if (res?.success && Array.isArray(res.data)) {
        setPosts(res.data);
      } else {
        setPosts([]);
        setError(res?.message || 'Discussions could not be loaded. Please try again.');
      }
    } catch (err) {
      console.error('Failed to load posts:', err);
      setError(err.message || 'Unable to connect to the server. Check your connection and try again.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPosts();
  }, [activeFilter, selectedTag]);

  return (
    <div className="home-feed">
      <section className="home-hero-banner" aria-labelledby="home-hero-title">
        <div className="home-hero-kicker">
          <Icon name="compass" size={14} aria-hidden="true" />
          A community by students, for students
        </div>
        <h1 id="home-hero-title">GEETA UNIVERSITY DISCUSSION</h1>
        <p>
          Your campus, your conversations. Learn together, exchange ideas and
          connect with peers, seniors and faculty across departments.
        </p>
      </section>

      <section className="home-cta-card" aria-label="Start a discussion">
        <div className="home-cta-copy">
          <span className="home-cta-icon" aria-hidden="true">
            <Icon name="messageSquare" size={19} />
          </span>
          <div className="home-cta-text">
            <strong>Have something academic to ask or share?</strong>
            <span>Share questions, notes, projects, polls and useful resources with campus.</span>
          </div>
        </div>
        <button
          id="home-create-post-trigger"
          type="button"
          className="btn btn-primary"
          onClick={() => onOpenCreatePost?.()}
        >
          <Icon name="plus" size={16} aria-hidden="true" />
          Create Post
        </button>
      </section>

      <section className="feed-section" aria-label="Campus discussions">
        <div className="feed-section-heading">
          <div>
            <h2>Campus discussions</h2>
            <p>What students are talking about</p>
          </div>
          {selectedTag && (
            <div className="feed-active-filter">
              <span className="badge badge-primary">#{selectedTag}</span>
              <button type="button" className="btn btn-ghost btn-sm" onClick={() => setSelectedTag('')}>
                Clear filter
              </button>
            </div>
          )}
        </div>

        <div className="feed-filter-bar" role="group" aria-label="Sort discussions">
          {[
            { key: 'latest', label: 'Latest' },
            { key: 'trending', label: 'Trending' },
            { key: 'helpful', label: 'Most Helpful' },
          ].map((tab) => (
            <button
              key={tab.key}
              type="button"
              className={`feed-filter-button${activeFilter === tab.key ? ' is-active' : ''}`}
              onClick={() => setActiveFilter(tab.key)}
              aria-pressed={activeFilter === tab.key}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {error && !loading ? (
          <div className="card feed-state-card" role="alert">
            <span className="feed-state-icon"><Icon name="info" size={22} /></span>
            <h3>Could not load discussions</h3>
            <p>{error}</p>
            <button type="button" className="btn btn-primary" onClick={fetchPosts}>Try again</button>
          </div>
        ) : loading ? (
          <div className="card feed-state-card" role="status" aria-live="polite">
            <span className="spinner" aria-hidden="true" />
            <p>Loading campus discussions…</p>
          </div>
        ) : posts.length === 0 ? (
          <div className="card feed-state-card">
            <span className="feed-state-icon"><Icon name="messageSquare" size={23} /></span>
            <h3>No discussions yet</h3>
            <p>Start the first conversation and help your campus community learn together.</p>
            <button type="button" className="btn btn-primary" onClick={() => onOpenCreatePost?.()}>
              <Icon name="plus" size={16} aria-hidden="true" />
              Create the first post
            </button>
          </div>
        ) : (
          <div className="feed-post-list">
            {posts.map((post) => (
              <PostCard
                key={post._id}
                post={post}
                onPostUpdated={fetchPosts}
                onTagClick={setSelectedTag}
              />
            ))}
          </div>
        )}
      </section>
    </div>
  );
};

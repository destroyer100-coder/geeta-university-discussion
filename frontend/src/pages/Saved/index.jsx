import React, { useState, useEffect } from 'react';
import { usersApi } from '../../services/api';
import { PostCard } from '../../components/post/PostCard';

export const SavedPage = () => {
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    usersApi.getSaved().then((res) => {
      if (res.success && res.data) setPosts(res.data);
    }).finally(() => setLoading(false));
  }, []);

  return (
    <div>
      <div style={{ marginBottom: '20px' }}>
        <h1 style={{ fontSize: '1.4rem', fontWeight: 800 }}>Saved Discussions & Resources</h1>
        <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>
          Quickly access reference guides, notes and posts you bookmarked.
        </p>
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: '40px' }}>Loading saved posts...</div>
      ) : posts.length === 0 ? (
        <div className="card" style={{ textAlign: 'center', padding: '40px' }}>
          <div style={{ fontSize: '2rem', marginBottom: '10px' }}>🔖</div>
          <h3>No saved discussions</h3>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>
            Click the "Save" button on any post to keep it here for quick revision.
          </p>
        </div>
      ) : (
        posts.map(p => <PostCard key={p._id} post={p} />)
      )}
    </div>
  );
};

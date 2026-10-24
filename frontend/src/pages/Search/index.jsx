import React, { useState, useEffect } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { searchApi } from '../../services/api';
import { PostCard } from '../../components/post/PostCard';

export const SearchPage = () => {
  const [searchParams] = useSearchParams();
  const q = searchParams.get('q') || '';
  const [results, setResults] = useState({ posts: [], communities: [], users: [] });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (q) {
      setLoading(true);
      searchApi.search(q).then((res) => {
        if (res.success && res.data) setResults(res.data);
      }).finally(() => setLoading(false));
    }
  }, [q]);

  return (
    <div>
      <div style={{ marginBottom: '20px' }}>
        <h1 style={{ fontSize: '1.4rem', fontWeight: 800 }}>
          Search Results for "{q}"
        </h1>
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: '40px' }}>Searching discussions, channels, and members...</div>
      ) : (
        <>
          {/* Communities matched */}
          {results.communities?.length > 0 && (
            <div style={{ marginBottom: '24px' }}>
              <h3 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: '10px' }}>Matching Communities</h3>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(min(240px, 100%), 1fr))', gap: '12px' }}>
                {results.communities.map((c) => (
                  <Link key={c._id} to={`/communities/${c.slug || c._id}`} className="card" style={{ padding: '12px', display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <img src={c.avatar} alt={c.name} style={{ width: 36, height: 36, borderRadius: '8px', objectFit: 'cover' }} />
                    <div>
                      <div style={{ fontWeight: 700, fontSize: '0.9rem' }}>{c.name}</div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{c.type}</div>
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          )}

          {/* Posts matched */}
          <div>
            <h3 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: '12px' }}>
              Discussions ({results.posts?.length || 0})
            </h3>
            {results.posts?.length === 0 ? (
              <div className="card" style={{ padding: '30px', textAlign: 'center' }}>No discussions matched "{q}".</div>
            ) : (
              results.posts.map((p) => <PostCard key={p._id} post={p} />)
            )}
          </div>
        </>
      )}
    </div>
  );
};

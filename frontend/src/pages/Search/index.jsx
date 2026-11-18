import React, { useEffect, useMemo, useState } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { searchApi } from '../../services/api';
import { PostCard } from '../../components/post/PostCard';
import { Icon } from '../../components/common/Icons';
import { PageHero } from '../../components/common/PageHero';

const EMPTY_RESULTS = { posts: [], communities: [], users: [] };
const initials = (name = '') =>
  name.trim().split(/\\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]).join('').toUpperCase() || 'U';

const tabs = [
  { key: 'all', label: 'All' },
  { key: 'posts', label: 'Discussions' },
  { key: 'communities', label: 'Communities' },
  { key: 'users', label: 'People' },
];

export const SearchPage = () => {
  const [searchParams] = useSearchParams();
  const query = (searchParams.get('q') || '').trim();
  const [results, setResults] = useState(EMPTY_RESULTS);
  const [loading, setLoading] = useState(Boolean(query));
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState('all');
  const [retryToken, setRetryToken] = useState(0);

  useEffect(() => {
    let cancelled = false;
    if (!query) {
      setResults(EMPTY_RESULTS);
      setLoading(false);
      setError('');
      return undefined;
    }

    setLoading(true);
    setError('');
    const timeoutId = window.setTimeout(async () => {
      try {
        const response = await searchApi.search(query);
        if (cancelled) return;
        if (!response?.success) {
          throw new Error(response?.message || 'Search could not be completed.');
        }
        setResults({
          posts: Array.isArray(response.data?.posts) ? response.data.posts : [],
          communities: Array.isArray(response.data?.communities) ? response.data.communities : [],
          users: Array.isArray(response.data?.users) ? response.data.users : [],
        });
      } catch (searchError) {
        if (cancelled) return;
        setResults(EMPTY_RESULTS);
        setError(searchError.message || 'Search could not be completed. Please try again.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }, 250);

    return () => {
      cancelled = true;
      window.clearTimeout(timeoutId);
    };
  }, [query, retryToken]);

  const counts = useMemo(() => ({
    all: results.posts.length + results.communities.length + results.users.length,
    posts: results.posts.length,
    communities: results.communities.length,
    users: results.users.length,
  }), [results]);

  const visibleSections = activeTab === 'all'
    ? ['communities', 'users', 'posts']
    : [activeTab];

  return (
    <div className="page-shell page-search">
      <PageHero
        icon="search"
        title="Search"
        description={query ? <>Results across discussions, communities and university members for <strong>“{query}”</strong>.</> : 'Find discussions, communities and people across the university.'}
      />

      {!query ? (
        <section className="card search-empty-state">
          <span className="search-empty-icon"><Icon name="search" size={25} /></span>
          <h2>What are you looking for?</h2>
          <p>Use the search bar above to find discussions, communities and people.</p>
        </section>
      ) : (
        <>
          <div className="search-results-toolbar">
            <div className="search-results-count">
              {loading ? 'Searching…' : error ? 'Search unavailable' : `${counts.all} results`}
            </div>
            <div className="search-result-tabs" role="tablist" aria-label="Search result type">
              {tabs.map((tab) => (
                <button
                  key={tab.key}
                  type="button"
                  role="tab"
                  aria-selected={activeTab === tab.key}
                  className={activeTab === tab.key ? 'active' : ''}
                  onClick={() => setActiveTab(tab.key)}
                >
                  {tab.label}
                  {!loading && <span>{tab.key === 'all' ? counts.all : counts[tab.key]}</span>}
                </button>
              ))}
            </div>
          </div>

          {error ? (
            <section className="card search-state-card" role="alert">
              <Icon name="info" size={24} />
              <h2>We couldn’t complete your search</h2>
              <p>{error}</p>
              <button type="button" className="btn btn-primary btn-sm" onClick={() => setRetryToken((value) => value + 1)}>
                Try Again
              </button>
            </section>
          ) : loading ? (
            <div className="search-loading" aria-live="polite">
              <span className="search-loading-indicator" />
              Searching discussions, communities and people…
            </div>
          ) : counts.all === 0 ? (
            <section className="card search-state-card">
              <Icon name="search" size={25} />
              <h2>No results found</h2>
              <p>Try another name, topic, department or community.</p>
            </section>
          ) : (
            <div className="search-result-sections">
              {visibleSections.includes('communities') && results.communities.length > 0 && (
                <section className="search-result-section">
                  <header><h2>Communities</h2><span>{results.communities.length} found</span></header>
                  <div className="search-community-grid">
                    {results.communities.map((community) => (
                      <Link key={community._id} to={`/communities/${community.slug || community._id}`} className="card search-community-card">
                        {community.avatar ? (
                          <img src={community.avatar} alt="" loading="lazy" decoding="async" />
                        ) : (
                          <span className="search-result-avatar">{initials(community.name)}</span>
                        )}
                        <span className="search-result-copy">
                          <strong>{community.name}</strong>
                          <small>{community.type || 'University community'}</small>
                          {community.description ? <span>{community.description}</span> : null}
                        </span>
                        <Icon name="chevronRight" size={17} />
                      </Link>
                    ))}
                  </div>
                </section>
              )}

              {visibleSections.includes('users') && results.users.length > 0 && (
                <section className="search-result-section">
                  <header><h2>People</h2><span>{results.users.length} found</span></header>
                  <div className="search-people-list">
                    {results.users.map((person) => (
                      <Link key={person._id} to={`/profile/${person._id}`} className="card search-person-card">
                        {person.avatar ? (
                          <img src={person.avatar} alt="" loading="lazy" decoding="async" />
                        ) : (
                          <span className="search-result-avatar">{initials(person.name)}</span>
                        )}
                        <span className="search-result-copy">
                          <strong>{person.name || 'University member'} {person.verified ? <Icon name="checkCircle2" size={14} /> : null}</strong>
                          <small>{[person.department, person.year, person.role].filter(Boolean).join(' · ') || 'University member'}</small>
                          {person.bio ? <span>{person.bio}</span> : null}
                        </span>
                        <span className="search-view-profile">View profile <Icon name="arrowRight" size={14} /></span>
                      </Link>
                    ))}
                  </div>
                </section>
              )}

              {visibleSections.includes('posts') && results.posts.length > 0 && (
                <section className="search-result-section">
                  <header><h2>Discussions</h2><span>{results.posts.length} found</span></header>
                  <div className="search-post-list">
                    {results.posts.map((post) => <PostCard key={post._id} post={post} />)}
                  </div>
                </section>
              )}

              {activeTab !== 'all' && counts[activeTab] === 0 && (
                <section className="card search-state-card">
                  <h2>No {tabs.find((tab) => tab.key === activeTab)?.label.toLowerCase()} found</h2>
                  <p>Try another result category or a different search term.</p>
                </section>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default SearchPage;

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { PostCard } from '../../components/post/PostCard';
import {
  postsApi,
  communitiesApi,
  usersApi,
  eventsApi,
} from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import { Icon } from '../../components/common/Icons';
import { PageHero } from '../../components/common/PageHero';

const EXPLORE_TAGS = ['All', 'DSA', 'Placements', 'Exams', 'Projects', 'WebDev', 'AI-ML', 'Notes', 'Campus'];
const idOf = (value) => (value?._id || value || '').toString();
const initials = (name = '') => name.trim().split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]).join('').toUpperCase() || 'U';

export const ExplorePage = ({ onOpenCreatePost }) => {
  const { user } = useAuth();
  const [posts, setPosts] = useState([]);
  const [communities, setCommunities] = useState([]);
  const [people, setPeople] = useState([]);
  const [events, setEvents] = useState([]);
  const [loadingPosts, setLoadingPosts] = useState(true);
  const [loadingDirectory, setLoadingDirectory] = useState(true);
  const [activeView, setActiveView] = useState('all');
  const [selectedTag, setSelectedTag] = useState('All');
  const [selectedType, setSelectedType] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [busyId, setBusyId] = useState('');

  const fetchExplorePosts = useCallback(async () => {
    setLoadingPosts(true);
    try {
      const response = await postsApi.getAll({
        tag: selectedTag !== 'All' ? selectedTag : undefined,
        type: selectedType !== 'all' ? selectedType : undefined,
        search: searchQuery.trim() || undefined,
        sort: 'trending',
      });
      setPosts(response.success && Array.isArray(response.data) ? response.data : []);
    } catch (error) {
      console.error('Failed to load explore discussions:', error);
      setPosts([]);
    } finally {
      setLoadingPosts(false);
    }
  }, [selectedTag, selectedType, searchQuery]);

  const fetchDirectoryData = useCallback(async () => {
    setLoadingDirectory(true);
    const [communityResult, peopleResult, eventResult] = await Promise.allSettled([
      communitiesApi.getAll({ sort: 'members' }),
      usersApi.getAll(),
      eventsApi.getAll(),
    ]);
    setCommunities(
      communityResult.status === 'fulfilled' && communityResult.value?.success && Array.isArray(communityResult.value.data)
        ? communityResult.value.data
        : []
    );
    setPeople(
      peopleResult.status === 'fulfilled' && peopleResult.value?.success && Array.isArray(peopleResult.value.data)
        ? peopleResult.value.data
        : []
    );
    setEvents(
      eventResult.status === 'fulfilled' && eventResult.value?.success && Array.isArray(eventResult.value.data)
        ? eventResult.value.data
        : []
    );
    setLoadingDirectory(false);
  }, []);

  useEffect(() => { fetchExplorePosts(); }, [fetchExplorePosts]);
  useEffect(() => { fetchDirectoryData(); }, [fetchDirectoryData, user?._id]);

  const filteredCommunities = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    return communities.filter((community) => {
      const values = [community.name, community.description, community.category].filter(Boolean);
      return !query || values.some((value) => value.toLowerCase().includes(query));
    });
  }, [communities, searchQuery]);

  const filteredPeople = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    return people.filter((person) => {
      const values = [person.name, person.department, person.role].filter(Boolean);
      const notCurrentUser = !user?._id || idOf(person) !== idOf(user);
      return notCurrentUser && (!query || values.some((value) => value.toLowerCase().includes(query)));
    });
  }, [people, searchQuery, user?._id]);

  const filteredEvents = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    return events.filter((event) => {
      const values = [event.title, event.description, event.venue, event.community?.name].filter(Boolean);
      return !query || values.some((value) => value.toLowerCase().includes(query));
    });
  }, [events, searchQuery]);

  const recommendedCommunities = communities.slice(0, 5);
  const suggestedPeople = people
    .filter((person) => !user?._id || idOf(person) !== idOf(user))
    .slice(0, 3);

  const handleJoinCommunity = async (community) => {
    if (!user) {
      alert('Please sign in to join a community.');
      return;
    }
    if (!community?._id || busyId) return;
    setBusyId(community._id);
    try {
      const response = community.isCurrentUserMember
        ? await communitiesApi.leave(community._id)
        : await communitiesApi.join(community._id);
      if (response.success) await fetchDirectoryData();
    } catch (error) {
      alert(error.message || 'The community membership action could not be completed.');
    } finally {
      setBusyId('');
    }
  };

  const handleFollowPerson = async (person) => {
    if (!user) {
      alert('Please sign in to follow university members.');
      return;
    }
    if (!person?._id || busyId) return;
    setBusyId(person._id);
    try {
      const response = await usersApi.toggleFollow('user', person._id);
      if (response.success) {
        setPeople((current) => current.map((item) => idOf(item) === idOf(person)
          ? { ...item, isFollowing: Boolean(response.following) }
          : item));
      }
    } catch (error) {
      alert(error.message || 'The follow action could not be completed.');
    } finally {
      setBusyId('');
    }
  };

  const handleRSVP = async (eventItem) => {
    if (!user) {
      alert('Please sign in to RSVP for events.');
      return;
    }
    if (!eventItem?._id || busyId) return;
    setBusyId(eventItem._id);
    try {
      const response = await eventsApi.rsvp(eventItem._id);
      if (response.success && response.data) {
        setEvents((current) => current.map((item) => item._id === eventItem._id ? response.data : item));
      }
    } catch (error) {
      alert(error.message || 'The event RSVP could not be updated.');
    } finally {
      setBusyId('');
    }
  };

  const tabs = [
    { key: 'all', label: 'All', icon: 'grid' },
    { key: 'discussions', label: 'Discussions', icon: 'messageSquare' },
    { key: 'communities', label: 'Communities', icon: 'users' },
    { key: 'people', label: 'People', icon: 'userCheck' },
    { key: 'events', label: 'Events', icon: 'calendar' },
  ];

  const contentLoading = activeView === 'all' || activeView === 'discussions'
    ? loadingPosts
    : loadingDirectory;

  return (
    <div className="page-shell page-explore">
      <PageHero icon="compass" title="Explore" description="Discover trending discussions, communities, people and university activities." />

      <div className="explore-workspace">
        <main className="explore-main">
          <div className="page-tabs explore-view-tabs" role="tablist" aria-label="Explore categories">
            {tabs.map((tab) => (
              <button
                type="button"
                key={tab.key}
                role="tab"
                aria-selected={activeView === tab.key}
                className={activeView === tab.key ? 'btn btn-primary' : 'btn btn-secondary'}
                onClick={() => setActiveView(tab.key)}
              >
                <Icon name={tab.icon} size={17} /> {tab.label}
              </button>
            ))}
          </div>

          <label className="explore-search">
            <Icon name="search" size={18} />
            <input
              className="form-control"
              type="search"
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              placeholder={
                activeView === 'people' ? 'Search people by name or department...' :
                activeView === 'communities' ? 'Search communities...' :
                activeView === 'events' ? 'Search campus events...' :
                'Search discussions, tags and topics...'
              }
            />
          </label>

          {activeView === 'all' || activeView === 'discussions' ? (
            <>
              <div className="explore-section-heading">
                <h2><Icon name="trendingUp" size={19} /> Trending in University</h2>
                <button type="button" onClick={() => setActiveView('discussions')}>View All <Icon name="arrowRight" size={15} /></button>
              </div>

              {activeView === 'discussions' ? (
                <>
                  <div className="page-tabs explore-type-tabs">
                    {[
                      { key: 'all', label: 'All Content' },
                      { key: 'resource', label: 'Resources' },
                      { key: 'question', label: 'Questions' },
                      { key: 'discussion', label: 'Discussions' },
                    ].map((item) => (
                      <button type="button" key={item.key} className={selectedType === item.key ? 'btn btn-primary btn-sm' : 'btn btn-secondary btn-sm'} onClick={() => setSelectedType(item.key)}>
                        {item.label}
                      </button>
                    ))}
                  </div>
                  <div className="explore-topic-filters">
                    {EXPLORE_TAGS.map((tag) => (
                      <button type="button" key={tag} className={selectedTag === tag ? 'tag-pill active' : 'tag-pill'} onClick={() => setSelectedTag(tag)}>
                        {tag === 'All' ? 'All Topics' : '#' + tag}
                      </button>
                    ))}
                  </div>
                </>
              ) : null}

              {contentLoading ? (
                <div className="loading-state">Loading trending discussions...</div>
              ) : posts.length ? (
                posts.map((post) => <PostCard key={post._id} post={post} onPostUpdated={fetchExplorePosts} />)
              ) : (
                <div className="card people-empty">
                  <Icon name="search" size={30} />
                  <h3>No matching discussions</h3>
                  <p>Try another topic or search phrase.</p>
                  {onOpenCreatePost ? <button type="button" className="btn btn-primary" onClick={() => onOpenCreatePost()}>Start a Discussion</button> : null}
                </div>
              )}
            </>
          ) : null}

          {activeView === 'communities' ? (
            contentLoading ? <div className="loading-state">Loading communities...</div> :
            filteredCommunities.length ? (
              <div className="explore-directory-grid">
                {filteredCommunities.map((community) => (
                  <article className="card explore-community-card" key={community._id}>
                    <div className="explore-directory-identity">
                      {community.avatar ? <img src={community.avatar} alt="" loading="lazy" decoding="async" /> : <span>{initials(community.name)}</span>}
                      <div><strong>{community.name}</strong><small>{community.category || 'Community'} · {community.memberCount || 0} members</small></div>
                    </div>
                    <p>{community.description || 'No community description has been added.'}</p>
                    <div className="explore-directory-actions">
                      <Link to={'/communities/' + (community.slug || community._id)} className="btn btn-outline btn-sm">View</Link>
                      <button type="button" className={community.isCurrentUserMember ? 'btn btn-secondary btn-sm' : 'btn btn-primary btn-sm'} disabled={busyId === community._id} onClick={() => handleJoinCommunity(community)}>
                        {busyId === community._id ? 'Updating...' : community.isCurrentUserMember ? 'Joined' : community.currentUserMembershipStatus === 'pending' ? 'Requested' : 'Join'}
                      </button>
                    </div>
                  </article>
                ))}
              </div>
            ) : <div className="card people-empty"><h3>No communities found</h3><p>Try another search term.</p></div>
          ) : null}

          {activeView === 'people' ? (
            contentLoading ? <div className="loading-state">Loading people...</div> :
            filteredPeople.length ? (
              <div className="explore-people-list">
                {filteredPeople.map((person) => (
                  <article className="card explore-person-row" key={person._id}>
                    {person.avatar ? <img src={person.avatar} alt="" loading="lazy" decoding="async" /> : <span className="explore-person-initials">{initials(person.name)}</span>}
                    <div className="explore-person-copy"><strong>{person.name}</strong><small>{[person.department, person.year, person.role].filter(Boolean).join(' · ')}</small></div>
                    <button type="button" className={person.isFollowing ? 'btn btn-secondary btn-sm' : 'btn btn-outline btn-sm'} disabled={busyId === person._id} onClick={() => handleFollowPerson(person)}>
                      {busyId === person._id ? '...' : person.isFollowing ? 'Following' : 'Follow'}
                    </button>
                    <Link to={'/profile/' + person._id} className="btn btn-outline btn-sm">Profile</Link>
                  </article>
                ))}
              </div>
            ) : <div className="card people-empty"><h3>No people found</h3><p>Try a different search term.</p></div>
          ) : null}

          {activeView === 'events' ? (
            contentLoading ? <div className="loading-state">Loading events...</div> :
            filteredEvents.length ? (
              <div className="explore-events-list">
                {filteredEvents.map((eventItem) => {
                  const attending = (eventItem.attendees || []).some((attendee) => idOf(attendee) === idOf(user));
                  const date = new Date(eventItem.date);
                  return (
                    <article className="card explore-event-row" key={eventItem._id}>
                      <span className="explore-event-date"><small>{date.toLocaleDateString(undefined, { month: 'short' })}</small><strong>{date.getDate()}</strong></span>
                      <div className="explore-event-copy"><strong>{eventItem.title}</strong><small>{[eventItem.community?.name, eventItem.venue, eventItem.time].filter(Boolean).join(' · ')}</small><p>{eventItem.description || ''}</p></div>
                      <button type="button" className={attending ? 'btn btn-secondary btn-sm' : 'btn btn-primary btn-sm'} disabled={busyId === eventItem._id} onClick={() => handleRSVP(eventItem)}>
                        {busyId === eventItem._id ? 'Updating...' : attending ? 'Registered' : 'RSVP'}
                      </button>
                    </article>
                  );
                })}
              </div>
            ) : <div className="card people-empty"><h3>No events found</h3><p>There are no matching campus events.</p></div>
          ) : null}
        </main>

        <aside className="explore-side">
          <section className="card explore-side-card">
            <header className="explore-side-heading"><h2><Icon name="users" size={18} /> Popular Communities</h2><Link to="/communities">View All <Icon name="arrowRight" size={14} /></Link></header>
            {recommendedCommunities.length ? recommendedCommunities.map((community) => (
              <div className="explore-popular-row" key={community._id}>
                {community.avatar ? <img src={community.avatar} alt="" loading="lazy" decoding="async" /> : <span>{initials(community.name)}</span>}
                <div><strong>{community.name}</strong><small>{community.memberCount || 0} members</small></div>
                {community.isCurrentUserMember ? <span className="badge badge-success">Joined</span> : <button type="button" disabled={busyId === community._id} onClick={() => handleJoinCommunity(community)}>{busyId === community._id ? '...' : 'Join'}</button>}
              </div>
            )) : <p className="explore-side-empty">No communities are available.</p>}
          </section>

          <section className="card explore-side-card">
            <header className="explore-side-heading"><h2><Icon name="userCheck" size={18} /> Suggested People</h2><Link to="/people">View All <Icon name="arrowRight" size={14} /></Link></header>
            {suggestedPeople.length ? suggestedPeople.map((person) => (
              <div className="explore-suggested-row" key={person._id}>
                {person.avatar ? <img src={person.avatar} alt="" loading="lazy" decoding="async" /> : <span>{initials(person.name)}</span>}
                <div><strong>{person.name}</strong><small>{[person.department, person.year].filter(Boolean).join(' · ')}</small></div>
                <button type="button" disabled={busyId === person._id} onClick={() => handleFollowPerson(person)}>{busyId === person._id ? '...' : person.isFollowing ? 'Following' : 'Follow'}</button>
              </div>
            )) : <p className="explore-side-empty">No suggested members are available.</p>}
          </section>
        </aside>
      </div>
    </div>
  );
};

export default ExplorePage;

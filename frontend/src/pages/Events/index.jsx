import React, { useEffect, useMemo, useState } from 'react';
import { eventsApi, communitiesApi } from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import { Icon } from '../../components/common/Icons';
import { PageHero } from '../../components/common/PageHero';

const localDateValue = (date) => {
  const value = new Date(date);
  const offset = value.getTimezoneOffset() * 60000;
  return new Date(value.getTime() - offset).toISOString().slice(0, 10);
};
const isUserAttending = (event, userId) =>
  Boolean(userId && (event.attendees || []).some((person) => (person?._id || person).toString() === userId.toString()));
const isEventOrganizer = (event, userId) =>
  Boolean(userId && (event.organizer?._id || event.organizer)?.toString() === userId.toString());

export const EventsPage = () => {
  const { user } = useAuth();
  const [events, setEvents] = useState([]);
  const [communities, setCommunities] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeScope, setActiveScope] = useState('all');
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [selectedCommunity, setSelectedCommunity] = useState('All');
  const [searchQuery, setSearchQuery] = useState('');
  const [rsvpLoadingId, setRsvpLoadingId] = useState(null);
  const [showCreate, setShowCreate] = useState(false);
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState('');
  const [createForm, setCreateForm] = useState({
    community: '',
    title: '',
    date: '',
    time: '',
    venue: '',
    category: '',
    description: '',
  });

  const creatableCommunities = useMemo(
    () => communities.filter((community) => ['owner', 'moderator'].includes(community.currentUserRole)),
    [communities]
  );
  const categories = useMemo(
    () => ['All', ...new Set(events.map((event) => event.category).filter(Boolean))],
    [events]
  );

  const loadEvents = async () => {
    setLoading(true);
    try {
      const [eventResponse, communityResponse] = await Promise.all([
        eventsApi.getAll({ upcoming: 'false' }),
        user ? communitiesApi.getAll() : Promise.resolve({ success: true, data: [] }),
      ]);
      setEvents(eventResponse.success && Array.isArray(eventResponse.data) ? eventResponse.data : []);
      setCommunities(communityResponse.success && Array.isArray(communityResponse.data) ? communityResponse.data : []);
    } catch (error) {
      console.error('Failed to load events:', error);
      setEvents([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadEvents(); }, [user?._id]);

  const now = Date.now();
  const filteredEvents = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    return events.filter((event) => {
      const date = new Date(event.date).getTime();
      const isPast = date < now;
      const matchesScope =
        activeScope === 'all' ||
        (activeScope === 'upcoming' && !isPast) ||
        (activeScope === 'past' && isPast) ||
        (activeScope === 'mine' && (isUserAttending(event, user?._id) || isEventOrganizer(event, user?._id)));
      const matchesCategory = selectedCategory === 'All' || event.category === selectedCategory;
      const communityId = event.community?._id || event.community || '';
      const matchesCommunity = selectedCommunity === 'All' || communityId.toString() === selectedCommunity;
      const values = [event.title, event.description, event.venue, event.community?.name].filter(Boolean);
      const matchesSearch = !query || values.some((value) => value.toLowerCase().includes(query));
      return matchesScope && matchesCategory && matchesCommunity && matchesSearch;
    }).sort((a, b) => {
      const diff = new Date(a.date).getTime() - new Date(b.date).getTime();
      return activeScope === 'past' ? -diff : diff;
    });
  }, [events, activeScope, selectedCategory, selectedCommunity, searchQuery, user?._id]);

  const handleRSVP = async (eventItem) => {
    if (!user) {
      alert('Please sign in to RSVP for events.');
      return;
    }
    if (rsvpLoadingId === eventItem._id) return;
    setRsvpLoadingId(eventItem._id);
    try {
      const response = await eventsApi.rsvp(eventItem._id);
      if (response.success && response.data) {
        setEvents((items) => items.map((item) => item._id === eventItem._id ? response.data : item));
      }
    } catch (error) {
      alert(error.message || 'Could not update your RSVP.');
    } finally {
      setRsvpLoadingId(null);
    }
  };

  const handleCreateEvent = async (event) => {
    event.preventDefault();
    setCreating(true);
    setCreateError('');
    try {
      const response = await eventsApi.create({
        ...createForm,
        date: createForm.date ? new Date(createForm.date + 'T12:00:00').toISOString() : '',
      });
      if (response.success && response.data) {
        setEvents((items) => [...items, response.data].sort((a, b) => new Date(a.date) - new Date(b.date)));
        setShowCreate(false);
        setCreateForm({ community: '', title: '', date: '', time: '', venue: '', category: '', description: '' });
      }
    } catch (error) {
      setCreateError(error.message || 'Event creation was not permitted or could not be completed.');
    } finally {
      setCreating(false);
    }
  };

  const scopeOptions = [
    { key: 'all', label: 'All Events', icon: 'calendar' },
    { key: 'upcoming', label: 'Upcoming', icon: 'clock' },
    { key: 'past', label: 'Past', icon: 'archive' },
    { key: 'mine', label: 'My Events', icon: 'userCheck' },
  ];

  return (
    <div className="page-shell page-events">
      <PageHero
        icon="calendar"
        title="Events"
        description="Discover and participate in campus events, workshops, talks and more."
        action={creatableCommunities.length > 0 ? (
          <button type="button" className="btn btn-primary" onClick={() => { setCreateError(''); setShowCreate(true); }}>
            <Icon name="plus" size={17} /> Create an Event
          </button>
        ) : null}
      />

      <div className="page-tabs event-scope-tabs" role="tablist" aria-label="Event views">
        {scopeOptions.map((option) => (
          <button type="button" key={option.key} className={activeScope === option.key ? 'btn btn-primary' : 'btn btn-secondary'} aria-selected={activeScope === option.key} onClick={() => setActiveScope(option.key)}>
            <Icon name={option.icon} size={17} /> {option.label}
          </button>
        ))}
      </div>

      <div className="page-toolbar event-toolbar">
        <label className="page-toolbar-search event-search">
          <Icon name="search" size={17} />
          <input className="form-control" type="search" value={searchQuery} onChange={(event) => setSearchQuery(event.target.value)} placeholder="Search events..." />
        </label>
        <div className="page-toolbar-filters">
          <select className="form-control" value={selectedCategory} onChange={(event) => setSelectedCategory(event.target.value)} aria-label="Filter by category">
            {categories.map((category) => <option key={category} value={category}>{category === 'All' ? 'All Categories' : category}</option>)}
          </select>
          <select className="form-control" value={selectedCommunity} onChange={(event) => setSelectedCommunity(event.target.value)} aria-label="Filter by community">
            <option value="All">All Communities</option>
            {[...new Map(events.filter((event) => event.community?._id).map((event) => [event.community._id, event.community])).values()].map((community) => (
              <option key={community._id} value={community._id}>{community.name}</option>
            ))}
          </select>
        </div>
      </div>

      {loading ? (
        <div className="loading-state">Loading campus events...</div>
      ) : filteredEvents.length === 0 ? (
        <div className="card event-empty">
          <Icon name="calendar" size={32} />
          <h3>No events found</h3>
          <p>{events.length ? 'Try changing the filters or search term.' : 'There are no events available right now.'}</p>
        </div>
      ) : (
        <div className="event-list">
          {filteredEvents.map((item) => {
            const date = new Date(item.date);
            const attending = isUserAttending(item, user?._id);
            const past = date.getTime() < Date.now();
            return (
              <article key={item._id} className="event-card">
                <div className="event-date-block">
                  <span>{date.toLocaleDateString(undefined, { month: 'short' })}</span>
                  <strong>{date.toLocaleDateString(undefined, { day: '2-digit' })}</strong>
                  <small>{date.getFullYear()}</small>
                </div>
                <div className="event-main-copy">
                  <div className="event-title-row">
                    <span className="badge badge-primary">{item.category || 'Event'}</span>
                    {item.community?.name ? <span className="event-community-name">{item.community.name}</span> : null}
                  </div>
                  <h2>{item.title}</h2>
                  {item.description ? <p>{item.description}</p> : null}
                  <div className="event-meta">
                    {item.time ? <span><Icon name="clock" size={15} /> {item.time}</span> : null}
                    {item.venue ? <span><Icon name="mapPin" size={15} /> {item.venue}</span> : null}
                    <span><Icon name="users" size={15} /> {item.attendees?.length || 0} registered</span>
                  </div>
                </div>
                <div className="event-register">
                  {past ? <span className="event-past-label">Event ended</span> : (
                    <button type="button" className={attending ? 'btn btn-secondary' : 'btn btn-primary'} disabled={rsvpLoadingId === item._id} onClick={() => handleRSVP(item)}>
                      {rsvpLoadingId === item._id ? 'Updating...' : attending ? '✓ Registered' : 'Register'} <Icon name="arrowRight" size={15} />
                    </button>
                  )}
                </div>
              </article>
            );
          })}
        </div>
      )}

      {showCreate ? (
        <div className="modal-overlay" role="presentation" onClick={(event) => { if (event.target === event.currentTarget && !creating) setShowCreate(false); }}>
          <div className="modal-content event-create-modal" role="dialog" aria-modal="true" aria-labelledby="create-event-title">
            <header className="modal-header">
              <div><h2 id="create-event-title">Create an Event</h2><p>Events can be created by a community head or moderator.</p></div>
              <button type="button" className="btn-icon" onClick={() => setShowCreate(false)} disabled={creating} aria-label="Close"><Icon name="x" size={20} /></button>
            </header>
            <form onSubmit={handleCreateEvent}>
              <div className="modal-body">
                {createError ? <div className="notification-error" role="alert">{createError}</div> : null}
                <label className="form-group"><span className="form-label">Community</span>
                  <select className="form-control" required value={createForm.community} onChange={(event) => setCreateForm((form) => ({ ...form, community: event.target.value }))}>
                    <option value="">Select a community</option>
                    {creatableCommunities.map((community) => <option key={community._id} value={community._id}>{community.name}</option>)}
                  </select>
                </label>
                <label className="form-group"><span className="form-label">Event title</span><input className="form-control" required maxLength={160} value={createForm.title} onChange={(event) => setCreateForm((form) => ({ ...form, title: event.target.value }))} /></label>
                <div className="event-create-grid">
                  <label className="form-group"><span className="form-label">Date</span><input className="form-control" type="date" required min={localDateValue(Date.now() + 86400000)} value={createForm.date} onChange={(event) => setCreateForm((form) => ({ ...form, date: event.target.value }))} /></label>
                  <label className="form-group"><span className="form-label">Time</span><input className="form-control" value={createForm.time} maxLength={60} onChange={(event) => setCreateForm((form) => ({ ...form, time: event.target.value }))} placeholder="e.g. 10:00 AM - 1:00 PM" /></label>
                </div>
                <label className="form-group"><span className="form-label">Venue</span><input className="form-control" value={createForm.venue} maxLength={180} onChange={(event) => setCreateForm((form) => ({ ...form, venue: event.target.value }))} /></label>
                <label className="form-group"><span className="form-label">Category</span><input className="form-control" value={createForm.category} maxLength={60} onChange={(event) => setCreateForm((form) => ({ ...form, category: event.target.value }))} placeholder="Workshop, Seminar, Hackathon..." /></label>
                <label className="form-group"><span className="form-label">Description</span><textarea className="form-control" rows={4} maxLength={4000} value={createForm.description} onChange={(event) => setCreateForm((form) => ({ ...form, description: event.target.value }))} /></label>
              </div>
              <footer className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setShowCreate(false)} disabled={creating}>Cancel</button>
                <button type="submit" className="btn btn-primary" disabled={creating}>{creating ? 'Creating...' : 'Create Event'}</button>
              </footer>
            </form>
          </div>
        </div>
      ) : null}
    </div>
  );
};

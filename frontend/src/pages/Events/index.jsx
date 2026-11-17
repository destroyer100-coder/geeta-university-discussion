import React, { useState, useEffect } from 'react';
import { eventsApi } from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import { Icon } from '../../components/common/Icons';
import { PageHero } from '../../components/common/PageHero';

const EVENT_CATEGORIES = ['All', 'Workshop', 'Hackathon', 'Seminar', 'Tech Talk', 'Meetup'];

export const EventsPage = () => {
  const { user } = useAuth();
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [rsvpLoadingId, setRsvpLoadingId] = useState(null);

  const loadEvents = async () => {
    try {
      const res = await eventsApi.getAll();
      if (res.success && res.data) {
        setEvents(res.data);
      }
    } catch (err) {
      console.error('Failed to fetch events:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadEvents();
  }, []);

  const handleRSVP = async (eventObj) => {
    if (!user) {
      alert('Please log in to RSVP for campus events.');
      return;
    }

    const eventId = eventObj._id;
    if (rsvpLoadingId === eventId) return;
    setRsvpLoadingId(eventId);

    const isAttending = (eventObj.attendees || []).some(
      (uid) => (uid._id || uid).toString() === user._id.toString()
    );

    // Optimistic UI update
    setEvents((prevEvents) =>
      prevEvents.map((ev) => {
        if (ev._id === eventId) {
          const updatedAttendees = isAttending
            ? ev.attendees.filter((uid) => (uid._id || uid).toString() !== user._id.toString())
            : [...(ev.attendees || []), user._id];
          return { ...ev, attendees: updatedAttendees };
        }
        return ev;
      })
    );

    try {
      const res = await eventsApi.rsvp(eventId);
      if (res.success) {
        if (res.data) {
          setEvents((prev) => prev.map((ev) => (ev._id === eventId ? res.data : ev)));
        }
      }
    } catch (err) {
      alert(err.message || 'Failed to update RSVP');
      loadEvents(); // Revert on failure
    } finally {
      setRsvpLoadingId(null);
    }
  };

  const filteredEvents = events.filter((ev) => {
    if (selectedCategory === 'All') return true;
    return (ev.category || '').toLowerCase() === selectedCategory.toLowerCase();
  });

  return (
    <div className="page-shell page-events">
      <PageHero icon="calendar" title="Events" description="Discover and participate in campus events, workshops, talks and more." />

      {/* Category Pills */}
      <div className="page-tabs event-category-tabs" style={{ display: 'flex', gap: '8px', overflowX: 'auto', paddingBottom: '8px', marginBottom: '20px' }}>
        {EVENT_CATEGORIES.map((cat) => (
          <button
            key={cat}
            className={`btn btn-sm ${selectedCategory === cat ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => setSelectedCategory(cat)}
            style={{ borderRadius: '20px', padding: '5px 14px', whiteSpace: 'nowrap' }}
          >
            {cat}
          </button>
        ))}
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>
          Loading campus events...
        </div>
      ) : filteredEvents.length === 0 ? (
        <div className="card" style={{ textAlign: 'center', padding: '40px' }}>
          <div style={{ fontSize: '2rem', marginBottom: '8px' }}>📅</div>
          <h3>No events found</h3>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginTop: '6px' }}>
            No upcoming events scheduled in this category right now.
          </p>
        </div>
      ) : (
        <div className="event-list">
          {filteredEvents.map((ev) => {
            const d = new Date(ev.date);
            const isAttending = Boolean(
              user &&
                (ev.attendees || []).some(
                  (uid) => (uid._id || uid).toString() === user._id.toString()
                )
            );
            const attendeesCount = ev.attendees?.length || 0;

            return (
              <article
                key={ev._id}
                className="event-card"
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between',
                  padding: '13px',
                  border: '0',
                  position: 'relative',
                }}
              >
                <div>
                  {/* Category & Date Header */}
                  <div className="event-date-block">
                    <span>{d.toLocaleDateString('en-US', { month: 'short' })}</span>
                    <strong>{d.toLocaleDateString('en-US', { day: '2-digit' })}</strong>
                    <small>{d.toLocaleDateString('en-US', { year: 'numeric' })}</small>
                  </div>

                  <h3 style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: '8px', color: 'var(--text-main)' }}>
                    {ev.title}
                  </h3>

                  {ev.description ? (
                    <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '12px', lineHeight: 1.5 }}>
                      {ev.description}
                    </p>
                  ) : null}

                  {/* Event Details */}
                  <div className="event-meta">
                    {ev.time ? <span><Icon name="clock" size={15} /> {ev.time}</span> : null}
                    {ev.venue ? <span><Icon name="mapPin" size={15} /> {ev.venue}</span> : null}
                    <span><Icon name="users" size={15} /> {attendeesCount} registered</span>
                  </div>
                </div>

                {/* RSVP Action */}
                <div className="event-register" style={{ borderTop: '1px solid var(--border-color)', paddingTop: '14px', marginTop: '8px' }}>
                  <button
                    className={`btn btn-sm ${isAttending ? 'btn-secondary' : 'btn-primary'}`}
                    style={{
                      width: '100%',
                      padding: '8px',
                      fontWeight: 700,
                      borderRadius: 'var(--radius-sm)',
                      background: isAttending ? '#ecfdf5' : undefined,
                      color: isAttending ? '#065f46' : undefined,
                      borderColor: isAttending ? '#a7f3d0' : undefined,
                    }}
                    onClick={() => handleRSVP(ev)}
                    disabled={rsvpLoadingId === ev._id}
                  >
                    {rsvpLoadingId === ev._id
                      ? 'Updating...'
                      : isAttending
                      ? '✓ Attending (Click to Cancel RSVP)'
                      : '+ RSVP / Attend Event'}
                  </button>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
};

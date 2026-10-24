import React, { useState, useEffect } from 'react';
import { eventsApi } from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import { Icon } from '../../components/common/Icons';

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
    <div>
      {/* Header */}
      <div style={{ marginBottom: '24px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
          <Icon name="calendar" size={24} color="var(--primary)" />
          <h1 style={{ fontSize: '1.5rem', fontWeight: 800 }}>Campus Events & Workshops</h1>
        </div>
        <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>
          Upcoming tech talks, hackathons, academic seminars and university workshops.
        </p>
      </div>

      {/* Category Pills */}
      <div style={{ display: 'flex', gap: '8px', overflowX: 'auto', paddingBottom: '8px', marginBottom: '20px' }}>
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
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(min(320px, 100%), 1fr))', gap: '20px' }}>
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
              <div
                key={ev._id}
                className="card"
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between',
                  padding: '20px',
                  border: isAttending ? '1.5px solid #93c5fd' : '1px solid var(--border-color)',
                  position: 'relative',
                }}
              >
                <div>
                  {/* Category & Date Header */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' }}>
                    <span className="badge badge-accent">{ev.category || 'Event'}</span>
                    <span style={{ fontSize: '0.775rem', fontWeight: 700, color: 'var(--primary)' }}>
                      {d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                    </span>
                  </div>

                  <h3 style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: '8px', color: 'var(--text-main)' }}>
                    {ev.title}
                  </h3>

                  <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '16px', lineHeight: 1.5 }}>
                    {ev.description || 'Join fellow Geeta University students and faculty for this session.'}
                  </p>

                  {/* Event Details */}
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', display: 'flex', flexDirection: 'column', gap: '6px', marginBottom: '14px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <span>📍</span>
                      <span><strong>Venue:</strong> {ev.venue || 'Geeta University Campus'}</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <span>⏰</span>
                      <span><strong>Time:</strong> {ev.time || '10:00 AM'}</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <span>👥</span>
                      <span><strong>Attendees:</strong> {attendeesCount} registered {isAttending && <span style={{ color: '#059669', fontWeight: 700 }}>(Including You)</span>}</span>
                    </div>
                  </div>
                </div>

                {/* RSVP Action */}
                <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '14px', marginTop: '8px' }}>
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
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

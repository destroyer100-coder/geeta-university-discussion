import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { DEMO_ACCOUNTS, useAuth } from '../../context/AuthContext';
import { usersApi } from '../../services/api';
import { Icon } from '../../components/common/Icons';

export const PeoplePage = () => {
  const { user, switchPersona } = useAuth();
  const [people, setPeople] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState('All');
  const [followingMap, setFollowingMap] = useState({});

  const fetchPeople = async () => {
    setLoading(true);
    try {
      const params = {};
      if (searchQuery.trim()) params.search = searchQuery.trim();
      if (roleFilter !== 'All') params.role = roleFilter.toLowerCase();

      const res = await usersApi.getAll(params);
      if (res.success && res.data && res.data.length > 0) {
        setPeople(res.data);
      } else if (!searchQuery.trim() && roleFilter === 'All') {
        // Fallback to DEMO_ACCOUNTS if database has empty list
        setPeople(DEMO_ACCOUNTS);
      } else {
        setPeople([]);
      }
    } catch (err) {
      console.error('Failed to load people:', err);
      // Graceful fallback to DEMO_ACCOUNTS
      setPeople(DEMO_ACCOUNTS);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPeople();
  }, [searchQuery, roleFilter]);

  const toggleFollow = async (person) => {
    const key = person._id || person.email;
    const isNowFollowing = !followingMap[key];
    setFollowingMap((prev) => ({ ...prev, [key]: isNowFollowing }));

    if (person._id) {
      try {
        await usersApi.toggleFollow('user', person._id);
      } catch (err) {
        console.warn('Failed to persist follow:', err.message);
      }
    }
  };

  return (
    <div>
      {/* Header */}
      <div style={{ marginBottom: '20px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '6px' }}>
          <Icon name="users" size={24} color="var(--primary)" />
          <h1 style={{ fontSize: '1.5rem', fontWeight: 800 }}>Geeta University Students & Faculty</h1>
        </div>
        <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>
          Connect with peers, faculty heads, placement coordinators, and academic mentors across campus.
        </p>
      </div>

      {/* Search & Filter Bar */}
      <div
        style={{
          display: 'flex',
          gap: '12px',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          marginBottom: '20px',
        }}
      >
        <div style={{ position: 'relative', flex: '1 1 260px', maxWidth: '400px' }}>
          <input
            type="text"
            className="form-control"
            placeholder="Search by name, department, or email..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{ paddingLeft: '36px' }}
          />
          <div style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }}>
            <Icon name="search" size={16} />
          </div>
        </div>

        {/* Role Filters */}
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          {['All', 'Faculty', 'Student', 'Admin'].map((role) => (
            <button
              key={role}
              className={`btn btn-sm ${roleFilter === role ? 'btn-primary' : 'btn-secondary'}`}
              onClick={() => setRoleFilter(role)}
            >
              {role === 'All' ? 'All Roles' : `${role}s`}
            </button>
          ))}
        </div>
      </div>

      {/* People Grid */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: '60px', color: 'var(--text-muted)' }}>
          Loading university members...
        </div>
      ) : people.length === 0 ? (
        <div className="card" style={{ textAlign: 'center', padding: '40px' }}>
          <div style={{ fontSize: '2rem', marginBottom: '8px' }}>🔍</div>
          <h3>No people found</h3>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginTop: '4px' }}>
            Try searching with a different name or resetting the role filter.
          </p>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(min(280px, 100%), 1fr))', gap: '16px' }}>
          {people.map((person) => {
            const isMe = user?.email === person.email || (user?._id && person._id && user._id.toString() === person._id.toString());
            const key = person._id || person.email;
            const isFollowing = !!followingMap[key];
            const profileLink = isMe ? '/profile/me' : `/profile/${person._id || person.email}`;
            const isDemoUser = DEMO_ACCOUNTS.some((d) => d.email === person.email);

            return (
              <div key={key} className="card" style={{ textAlign: 'center', padding: '20px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                <div>
                  <img
                    src={
                      person.avatar ||
                      `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(person.name || 'User')}`
                    }
                    alt={person.name}
                    style={{
                      width: 64,
                      height: 64,
                      borderRadius: '50%',
                      margin: '0 auto 12px',
                      display: 'block',
                      objectFit: 'cover',
                      border: '2px solid var(--primary-light)',
                    }}
                  />
                  <h3 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: '2px' }}>
                    <Link to={profileLink} style={{ textDecoration: 'none', color: 'inherit' }}>
                      {person.name}
                    </Link>
                  </h3>
                  <div style={{ display: 'flex', justifyContent: 'center', gap: '6px', margin: '4px 0 8px' }}>
                    <span className={`badge ${person.role === 'faculty' ? 'badge-primary' : person.role === 'admin' ? 'badge-warning' : 'badge-secondary'}`} style={{ fontSize: '0.7rem' }}>
                      {person.role === 'faculty' ? '🎓 Faculty' : person.role === 'admin' ? '🛡️ Admin' : '🎒 Student'}
                    </span>
                    {person.verified && (
                      <span className="badge badge-success" style={{ fontSize: '0.7rem' }}>✓ Verified</span>
                    )}
                  </div>
                  <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '14px', minHeight: '36px' }}>
                    {person.department ? `${person.department}${person.year ? ` · Year ${person.year}` : ''}` : person.title || 'Geeta University Member'}
                  </p>
                </div>

                <div style={{ display: 'flex', gap: '6px', justifyContent: 'center', flexWrap: 'wrap', borderTop: '1px solid var(--border-color)', paddingTop: '12px' }}>
                  {isMe ? (
                    <Link to="/profile/me" className="btn btn-primary btn-sm" style={{ width: '100%' }}>
                      My Profile
                    </Link>
                  ) : (
                    <>
                      <button
                        className={`btn btn-sm ${isFollowing ? 'btn-secondary' : 'btn-primary'}`}
                        onClick={() => toggleFollow(person)}
                        style={{ flex: 1 }}
                      >
                        {isFollowing ? '✓ Following' : '+ Follow'}
                      </button>
                      <Link
                        to={profileLink}
                        className="btn btn-outline btn-sm"
                        style={{ flex: 1 }}
                      >
                        Profile
                      </Link>
                      {isDemoUser && (
                        <button
                          className="btn btn-secondary btn-sm"
                          onClick={() => switchPersona(person.email)}
                          title="Switch active user to test roles and permissions"
                        >
                          Login As
                        </button>
                      )}
                    </>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

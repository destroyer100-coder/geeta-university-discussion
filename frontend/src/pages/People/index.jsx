import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { usersApi } from '../../services/api';
import { Icon } from '../../components/common/Icons';
import { PageHero } from '../../components/common/PageHero';

const initials = (name = '') => name.trim().split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]).join('').toUpperCase() || 'U';

export const PeoplePage = () => {
  const { user } = useAuth();
  const [people, setPeople] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState('All');
  const [errorNotice, setErrorNotice] = useState('');

  const fetchPeople = async () => {
    setLoading(true);
    setErrorNotice('');
    try {
      const params = {};
      if (searchQuery.trim()) params.search = searchQuery.trim();
      if (roleFilter !== 'All') params.role = roleFilter.toLowerCase();
      const response = await usersApi.getAll(params);
      const rows = response.success && Array.isArray(response.data) ? response.data : [];
      setPeople(rows);
;
    } catch (error) {
      setPeople([]);
      setErrorNotice(error.message || 'University members could not be loaded.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchPeople(); }, [searchQuery, roleFilter]);



  return (
    <div className="page-shell page-people">
      <PageHero icon="users" title="People" description="Find and connect with students, seniors, faculty and community members." />

      <div className="people-toolbar">
        <label className="people-search">
          <Icon name="search" size={17} />
          <input className="form-control" type="search" placeholder="Search people by name or department..." value={searchQuery} onChange={(event) => setSearchQuery(event.target.value)} />
        </label>
        <div className="people-role-filters">
          {['All', 'Student', 'Faculty', 'Admin'].map((role) => (
            <button type="button" key={role} className={roleFilter === role ? 'btn btn-primary btn-sm' : 'btn btn-secondary btn-sm'} onClick={() => setRoleFilter(role)}>
              {role === 'All' ? 'All People' : role + 's'}
            </button>
          ))}
        </div>
      </div>

      {errorNotice ? <div className="notification-error" role="alert">{errorNotice}</div> : null}
      {loading ? (
        <div className="loading-state">Loading university members...</div>
      ) : people.length === 0 ? (
        <div className="card people-empty"><Icon name="users" size={30} /><h3>No members found</h3><p>Try a different name or role filter.</p></div>
      ) : (
        <div className="people-list">
          {people.map((person) => {
            const isMe = user?._id && person._id && user._id.toString() === person._id.toString();
            const isFollowing = Boolean(followingMap[person._id]);
            const profileLink = isMe ? '/profile/me' : '/profile/' + person._id;
            return (
              <article key={person._id} className="people-row">
                <div className="people-identity">
                  {person.avatar ? (
                    <img src={person.avatar} alt="" className="people-avatar" loading="lazy" decoding="async" />
                  ) : (
                    <span className="people-avatar-fallback" aria-hidden="true">{initials(person.name)}</span>
                  )}
                  <h3><Link to={profileLink}>{person.name}</Link></h3>
                  <div className="people-role-badges">
                    <span className="badge badge-primary">{person.role === 'faculty' ? 'Faculty' : person.role === 'admin' ? 'Admin' : 'Student'}</span>
                    {person.verified ? <span className="badge badge-success">Verified</span> : null}
                  </div>
                  <p>{[person.department, person.year].filter(Boolean).join(' · ') || 'University member'}</p>
                </div>
                <div className="people-actions">
                  {isMe ? (
                    <Link to="/profile/me" className="btn btn-outline btn-sm">My Profile</Link>
                  ) : (
                    <>
                      <Link to={profileLink} className="btn btn-primary btn-sm">View Profile</Link>
                      <Link to={'/messages?user=' + person._id} className="btn btn-outline btn-sm">Message</Link>
                    </>
                  )}
                </div>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default PeoplePage;

import React, { useEffect, useMemo, useState } from 'react';
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
  const [selectedDepartment, setSelectedDepartment] = useState('All');
  const [errorNotice, setErrorNotice] = useState('');

  const fetchPeople = async () => {
    setLoading(true);
    setErrorNotice('');
    try {
      const params = { page: 1, limit: 50 };
      if (searchQuery.trim()) params.search = searchQuery.trim();
      const response = await usersApi.getAll(params);
      setPeople(response.success && Array.isArray(response.data) ? response.data : []);
    } catch (error) {
      setPeople([]);
      setErrorNotice(error.message || 'University members could not be loaded.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchPeople(); }, [searchQuery, roleFilter, selectedDepartment, user?._id]);

  const departmentCounts = useMemo(() => {
    const counts = {};
    people.forEach((person) => {
      const department = person.department || 'Not specified';
      counts[department] = (counts[department] || 0) + 1;
    });
    return counts;
  }, [people]);

  const roleCounts = useMemo(() => ({
    All: people.length,
    Student: people.filter((person) => person.role === 'student').length,
    Faculty: people.filter((person) => person.role === 'faculty').length,
    Admin: people.filter((person) => person.role === 'admin').length,
  }), [people]);

  const suggestedPeople = useMemo(
    () => people.filter((person) => !user?._id || person._id?.toString() !== user._id.toString()).slice(0, 4),
    [people, user?._id]
  );

  const visiblePeople = useMemo(() => people.filter((person) => {
    const matchesRole = roleFilter === 'All' || person.role === roleFilter.toLowerCase();
    const matchesDepartment = selectedDepartment === 'All' || (person.department || 'Not specified') === selectedDepartment;
    return matchesRole && matchesDepartment;
  }), [people, roleFilter, selectedDepartment]);

  return (
    <div className="page-shell page-people">
      <PageHero icon="users" title="People" description="Find and connect with students, seniors, faculty and community members." />

      <div className="people-workspace">
        <main className="people-main">
          <div className="people-toolbar">
            <label className="people-search">
              <Icon name="search" size={17} />
              <input
                className="form-control"
                type="search"
                placeholder="Search people by name or department..."
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
              />
            </label>
            <div className="people-role-filters" role="group" aria-label="Filter by role">
              {['All', 'Student', 'Faculty', 'Admin'].map((role) => (
                <button
                  type="button"
                  key={role}
                  className={roleFilter === role ? 'btn btn-primary btn-sm' : 'btn btn-secondary btn-sm'}
                  onClick={() => setRoleFilter(role)}
                >
                  {role === 'All' ? 'All People' : role + 's'}
                  <span>{roleCounts[role]}</span>
                </button>
              ))}
            </div>
          </div>

          {errorNotice ? <div className="notification-error" role="alert">{errorNotice}</div> : null}
          {loading ? (
            <div className="loading-state">Loading university members...</div>
          ) : visiblePeople.length === 0 ? (
            <div className="card people-empty">
              <Icon name="users" size={30} />
              <h3>No members found</h3>
              <p>Try a different search term, department or role.</p>
            </div>
          ) : (
            <div className="people-list">
              {visiblePeople.map((person) => {
                const isMe = user?._id && person._id && user._id.toString() === person._id.toString();
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
          <p className="people-results-note">Showing up to 50 members matching the selected filters.</p>
        </main>

        <aside className="people-side">
          <section className="card people-side-card">
            <header className="people-side-heading"><h2><Icon name="filter" size={18} /> Find People</h2></header>
            <h3 className="people-side-subheading">Departments</h3>
            <button
              type="button"
              className={selectedDepartment === 'All' ? 'people-filter-option active' : 'people-filter-option'}
              onClick={() => setSelectedDepartment('All')}
            >
              <span>All Departments</span><strong>{people.length}</strong>
            </button>
            {Object.entries(departmentCounts).sort(([a], [b]) => a.localeCompare(b)).map(([department, count]) => (
              <button
                type="button"
                key={department}
                className={selectedDepartment === department ? 'people-filter-option active' : 'people-filter-option'}
                onClick={() => setSelectedDepartment(department)}
              >
                <span>{department}</span><strong>{count}</strong>
              </button>
            ))}
          </section>

          <section className="card people-side-card">
            <header className="people-side-heading">
              <h2><Icon name="userCheck" size={18} /> People You May Know</h2>
            </header>
            {suggestedPeople.length ? suggestedPeople.map((person) => (
              <div className="people-suggestion" key={person._id}>
                {person.avatar ? (
                  <img src={person.avatar} alt="" loading="lazy" decoding="async" />
                ) : (
                  <span>{initials(person.name)}</span>
                )}
                <div><strong>{person.name}</strong><small>{person.department || person.role || 'University member'}</small></div>
                <Link to={'/profile/' + person._id}>View</Link>
              </div>
            )) : (
              <p className="people-side-empty">No additional members are available in the current results.</p>
            )}
            <Link to="/messages" className="btn btn-outline btn-sm people-side-message">Open Messages</Link>
          </section>
        </aside>
      </div>
    </div>
  );
};

export default PeoplePage;

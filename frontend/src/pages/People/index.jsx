import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { usersApi } from '../../services/api';
import { Icon } from '../../components/common/Icons';
import { PageHero } from '../../components/common/PageHero';

const initials = (name = '') => name.trim().split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]).join('').toUpperCase() || 'U';
const readFollowing = () => {
  try { return JSON.parse(localStorage.getItem('guf-following-preview') || '[]'); } catch { return []; }
};

export const PeoplePage = () => {
  const { user } = useAuth();
  const [people, setPeople] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState('All');
  const [selectedDepartment, setSelectedDepartment] = useState('All');
  const [selectedYear, setSelectedYear] = useState('All');
  const [selectedRole, setSelectedRole] = useState('All');
  const [followingIds, setFollowingIds] = useState(() => user?.isGuestPreview ? readFollowing() : []);
  const [filtersApplied, setFiltersApplied] = useState(false);
  const [errorNotice, setErrorNotice] = useState('');
  const [followBusyId, setFollowBusyId] = useState('');

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

  useEffect(() => { fetchPeople(); }, [searchQuery, user?._id]);
  useEffect(() => {
    if (user?.isGuestPreview) {
      try { localStorage.setItem('guf-following-preview', JSON.stringify(followingIds)); } catch { /* Guest preview remains in memory. */ }
    }
  }, [followingIds]);

  useEffect(() => {
    setFollowingIds(user?.isGuestPreview ? readFollowing() : []);
  }, [user?._id, user?.isGuestPreview]);

  const departments = useMemo(() => [...new Set(people.map((person) => person.department).filter(Boolean))].sort(), [people]);
  const years = useMemo(() => [...new Set(people.map((person) => person.year).filter(Boolean))].sort(), [people]);

  const roleCounts = useMemo(() => ({
    All: people.length,
    Student: people.filter((person) => person.role === 'student').length,
    Faculty: people.filter((person) => person.role === 'faculty').length,
    Admin: people.filter((person) => person.role === 'admin').length,
    Following: people.filter((person) => followingIds.includes(String(person._id))).length,
  }), [people, followingIds]);

  const visiblePeople = useMemo(() => people.filter((person) => {
    const personId = String(person._id || '');
    const matchesRoleTab = roleFilter === 'All' ||
      (roleFilter === 'Following' ? followingIds.includes(personId) : person.role === roleFilter.toLowerCase());
    const matchesDepartment = !filtersApplied || selectedDepartment === 'All' || (person.department || 'Not specified') === selectedDepartment;
    const matchesYear = !filtersApplied || selectedYear === 'All' || String(person.year || '') === selectedYear;
    const matchesRole = !filtersApplied || selectedRole === 'All' || person.role === selectedRole.toLowerCase();
    return matchesRoleTab && matchesDepartment && matchesYear && matchesRole;
  }), [people, roleFilter, followingIds, filtersApplied, selectedDepartment, selectedYear, selectedRole]);

  const suggestedPeople = useMemo(
    () => people.filter((person) => person._id?.toString() !== user?._id?.toString()).slice(0, 4),
    [people, user?._id]
  );

  const toggleFollow = async (personId) => {
    const id = String(personId);
    if (!id || followBusyId) return;
    setFollowBusyId(id);
    setErrorNotice('');
    try {
      if (user?.isGuestPreview) {
        setFollowingIds((current) => {
          const next = current.includes(id) ? current.filter((value) => value !== id) : [...current, id];
          const previews = (() => { try { return JSON.parse(localStorage.getItem('guf-profile-action-preview') || '{}'); } catch { return {}; } })();
          previews[id] = { ...(previews[id] || {}), isFollowing: next.includes(id) };
          try { localStorage.setItem('guf-profile-action-preview', JSON.stringify(previews)); } catch { /* Guest preview remains in memory. */ }
          return next;
        });
      } else if (!user?._id) {
        setErrorNotice('Sign in to follow university members.');
      } else {
        const response = await usersApi.toggleFollow('user', id);
        if (!response?.success) throw new Error(response?.message || 'The follow action could not be completed.');
        setFollowingIds((current) => response.following
          ? (current.includes(id) ? current : [...current, id])
          : current.filter((value) => value !== id));
      }
    } catch (error) {
      setErrorNotice(error.message || 'The follow action could not be completed.');
    } finally {
      setFollowBusyId('');
    }
  };

  const clearFilters = () => {
    setSelectedDepartment('All');
    setSelectedYear('All');
    setSelectedRole('All');
    setFiltersApplied(false);
    setRoleFilter('All');
  };

  return (
    <div className="page-shell page-people">
      <PageHero icon="users" title="People" description="Find and connect with students, seniors, faculty and community members." />

      <div className="people-workspace">
        <main className="people-main">
          <div className="people-toolbar">
            <label className="people-search">
              <Icon name="search" size={17} />
              <input className="form-control" type="search" placeholder="Search people by name or department..." value={searchQuery} onChange={(event) => setSearchQuery(event.target.value)} />
            </label>
            <div className="people-role-filters" role="tablist" aria-label="Filter by role">
              {['All', 'Student', 'Faculty', 'Admin', 'Following'].map((role) => (
                <button type="button" key={role} role="tab" aria-selected={roleFilter === role} className={roleFilter === role ? 'btn btn-primary btn-sm' : 'btn btn-secondary btn-sm'} onClick={() => setRoleFilter(role)}>
                  {role === 'All' ? 'All People' : role === 'Admin' ? 'Admins' : role === 'Following' ? 'Following' : role + 's'}
                  <span>{roleCounts[role]}</span>
                </button>
              ))}
            </div>
          </div>

          {errorNotice ? <div className="notification-error" role="alert">{errorNotice}</div> : null}
          {loading ? <div className="loading-state">Loading university members...</div> : visiblePeople.length === 0 ? (
            <div className="card people-empty"><Icon name="users" size={30} /><h3>No members found</h3><p>Try a different search term, department or role.</p></div>
          ) : (
            <div className="people-list">
              {visiblePeople.map((person) => {
                const isMe = user?._id && person._id && user._id.toString() === person._id.toString();
                const profileLink = isMe ? '/profile/me' : '/profile/' + person._id;
                const following = followingIds.includes(String(person._id));
                return (
                  <article key={person._id} className="people-row">
                    <div className="people-identity">
                      {person.avatar ? <img src={person.avatar} alt="" className="people-avatar" loading="lazy" decoding="async" /> : <span className="people-avatar-fallback" aria-hidden="true">{initials(person.name)}</span>}
                      <div className="people-identity-copy">
                        <h3><Link to={profileLink}>{person.name}</Link>{person.verified ? <Icon name="checkCircle2" size={14} /> : null}</h3>
                        <p>{[person.department, person.year, person.rollNumber].filter(Boolean).join(' · ') || 'University member'}</p>
                        <div className="people-skill-tags">{(person.skills || []).slice(0, 3).map((skill) => <span key={skill}>{skill}</span>)}</div>
                      </div>
                    </div>
                    <div className="people-role-badges"><span className="badge badge-primary">{person.role === 'faculty' ? 'Faculty' : person.role === 'admin' ? 'Admin' : 'Student'}</span></div>
                    <div className="people-actions">
                      {isMe ? <Link to="/profile/me" className="btn btn-outline btn-sm">My Profile</Link> : <button type="button" className={following ? 'btn btn-secondary btn-sm' : 'btn btn-outline btn-sm'} aria-pressed={following} disabled={followBusyId === String(person._id)} onClick={() => toggleFollow(person._id)}>{followBusyId === String(person._id) ? 'Updating…' : <><Icon name={following ? 'check' : 'plus'} size={14} /> {following ? 'Following' : 'Follow'}</>}</button>}
                      <Link to={profileLink} className="people-more-link" aria-label={'View ' + person.name + ' profile'} title="View Profile"><Icon name="moreHorizontal" size={18} /></Link>
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
            <header className="people-side-heading"><h2><Icon name="filter" size={18} /> Filter People</h2></header>
            <label className="settings-select-row"><span>Department</span><select className="form-control" value={selectedDepartment} onChange={(event) => setSelectedDepartment(event.target.value)}><option value="All">All Departments</option>{departments.map((department) => <option key={department}>{department}</option>)}</select></label>
            <label className="settings-select-row"><span>Year</span><select className="form-control" value={selectedYear} onChange={(event) => setSelectedYear(event.target.value)}><option value="All">All Years</option>{years.map((year) => <option key={year}>{year}</option>)}</select></label>
            <label className="settings-select-row"><span>Role</span><select className="form-control" value={selectedRole} onChange={(event) => setSelectedRole(event.target.value)}><option value="All">All Roles</option><option value="Student">Student</option><option value="Faculty">Faculty</option><option value="Admin">Admin</option></select></label>
            <button type="button" className="btn btn-primary btn-sm people-apply-filters" onClick={() => setFiltersApplied(true)}><Icon name="filter" size={14} /> Apply Filters</button>
            <button type="button" className="btn btn-outline btn-sm people-clear-filters" onClick={clearFilters}>Clear All</button>
          </section>
          <section className="card people-side-card">
            <header className="people-side-heading"><h2><Icon name="award" size={18} /> People You May Know</h2></header>
            {suggestedPeople.length ? suggestedPeople.map((person) => {
              const following = followingIds.includes(String(person._id));
              return <div className="people-suggestion" key={person._id}>
                {person.avatar ? <img src={person.avatar} alt="" loading="lazy" decoding="async" /> : <span>{initials(person.name)}</span>}
                <div><strong>{person.name}</strong><small>{[person.department, person.year].filter(Boolean).join(' · ') || 'University member'}</small></div>
                <button type="button" className={following ? 'btn btn-secondary btn-sm' : 'btn btn-outline btn-sm'} onClick={() => toggleFollow(person._id)} disabled={followBusyId === String(person._id)}>{followBusyId === String(person._id) ? 'Updating…' : following ? 'Following' : 'Follow'}</button>
              </div>;
            }) : <p className="people-side-empty">No additional members are available in the current results.</p>}
          </section>
        </aside>
      </div>
    </div>
  );
};

export default PeoplePage;

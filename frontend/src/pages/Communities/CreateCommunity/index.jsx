import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { communitiesApi } from '../../../services/api';
import { useAuth } from '../../../context/AuthContext';
import { Icon } from '../../../components/common/Icons';

const COMMUNITY_CATEGORIES = [
  'CSE',
  'ECE',
  'Placement',
  'Clubs',
  'Events',
  'Hostel',
  'Academics',
  'Sports',
  'General',
];

export const CreateCommunity = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({
    name: '',
    description: '',
    category: 'General',
    visibility: 'PUBLIC',
  });
  const [errors, setErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [serverError, setServerError] = useState(null);
  const [created, setCreated] = useState(null);

  if (!user) {
    navigate('/login');
    return null;
  }

  if (created) {
    return (
      <div className="card" style={{ padding: '40px', textAlign: 'center', maxWidth: '480px', margin: '60px auto' }}>
        <div style={{ fontSize: '48px', marginBottom: '16px' }}>🎉</div>
        <h2 style={{ fontSize: '1.5rem', fontWeight: 800, marginBottom: '8px', letterSpacing: '-0.5px' }}>Community created</h2>
        <p style={{ color: 'var(--text-secondary)', marginBottom: '24px' }}>
          <strong>{created.name}</strong> is now live. You&rsquo;re the owner.
        </p>
        <div style={{ display: 'flex', gap: '10px', justifyContent: 'center' }}>
          <button onClick={() => navigate(`/communities/${created.slug || created._id}`)} className="btn btn-primary">
            View Community
          </button>
          <button onClick={() => navigate('/communities')} className="btn btn-outline">
            Explore More
          </button>
        </div>
      </div>
    );
  }

  const validate = () => {
    const e = {};
    if (!form.name || !form.name.trim()) e.name = 'Community name is required.';
    else if (form.name.trim().length < 3) e.name = 'Name must be at least 3 characters.';
    else if (form.name.trim().length > 60) e.name = 'Name must be under 60 characters.';
    if (form.description && form.description.length > 500) e.description = 'Description must be under 500 characters.';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleChange = (key) => (e) => {
    setForm({ ...form, [key]: e.target.value });
    if (errors[key]) setErrors({ ...errors, [key]: null });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setServerError(null);
    if (!validate()) return;
    setSubmitting(true);
    try {
      const res = await communitiesApi.create({
        name: form.name.trim(),
        description: form.description.trim(),
        category: form.category,
        visibility: form.visibility,
      });
      if (res.success && res.data) {
        setCreated(res.data);
        window.dispatchEvent(new Event('communities:changed'));
      }
    } catch (err) {
      setServerError(err.message || 'Failed to create community. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div style={{ maxWidth: '560px', margin: '40px auto', padding: '0 16px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '24px' }}>
        <button onClick={() => navigate('/communities')} className="btn btn-outline btn-sm" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <Icon name="arrow-left" size={16} /> Back
        </button>
        <h1 style={{ fontSize: '1.5rem', fontWeight: 800, letterSpacing: '-0.5px', flex: 1 }}>Create Community</h1>
      </div>

      <p style={{ color: 'var(--text-secondary)', marginBottom: '32px' }}>
        Start a new university community. You&rsquo;ll be its owner and can manage members, settings, and posts.
      </p>

      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <label style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--text-main)' }}>Community name</label>
          <input
            className="form-control"
            type="text"
            placeholder="e.g. CSE Study Group"
            value={form.name}
            onChange={handleChange('name')}
            maxLength="60"
            disabled={submitting}
          />
          {errors.name && <span style={{ color: 'var(--danger)', fontSize: '0.8rem', marginTop: '2px' }}>{errors.name}</span>}
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <label style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--text-main)' }}>Description</label>
          <textarea
            className="form-control"
            placeholder="What is this community about?"
            value={form.description}
            onChange={handleChange('description')}
            rows={4}
            maxLength="500"
            disabled={submitting}
          />
          {errors.description && <span style={{ color: 'var(--danger)', fontSize: '0.8rem', marginTop: '2px' }}>{errors.description}</span>}
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <label style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--text-main)' }}>Category</label>
          <select
            className="form-control"
            value={form.category}
            onChange={handleChange('category')}
            disabled={submitting}
          >
            {COMMUNITY_CATEGORIES.map((cat) => (
              <option key={cat} value={cat}>{cat}</option>
            ))}
          </select>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <label style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--text-main)' }}>Visibility</label>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
            <button
              type="button"
              onClick={() => setForm({ ...form, visibility: 'PUBLIC' })}
              className={`btn btn-sm ${form.visibility === 'PUBLIC' ? 'btn-primary' : 'btn-outline'}`}
              disabled={submitting}
            >
              Public &mdash; discoverable by everyone
            </button>
            <button
              type="button"
              onClick={() => setForm({ ...form, visibility: 'MEMBERS_ONLY' })}
              className={`btn btn-sm ${form.visibility === 'MEMBERS_ONLY' ? 'btn-primary' : 'btn-outline'}`}
              disabled={submitting}
            >
              Private &mdash; join request required
            </button>
          </div>
        </div>

        {serverError && (
          <div style={{ background: 'var(--danger-light)', color: 'var(--danger)', padding: '12px 16px', borderRadius: 'var(--radius-md)', fontSize: '0.875rem', border: '1px solid var(--border-color)' }}>
            {serverError}
          </div>
        )}

        <button
          type="submit"
          className="btn btn-primary"
          disabled={submitting}
          style={{ padding: '12px', fontSize: '1rem', fontWeight: 700 }}
        >
          {submitting ? 'Creating community&hellip;' : 'Create Community'}
        </button>
      </form>
    </div>
  );
};
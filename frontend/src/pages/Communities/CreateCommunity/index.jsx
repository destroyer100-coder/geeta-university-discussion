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
      <section className="community-success-card" role="status">
        <span className="community-success-icon"><Icon name="checkCircle2" size={28} /></span>
        <h1>Community created</h1>
        <p><strong>{created.name}</strong> is now live. You’re the community owner.</p>
        <div className="community-success-actions">
          <button type="button" onClick={() => navigate(`/communities/${created.slug || created._id}`)} className="btn btn-primary">
            View Community
          </button>
          <button type="button" onClick={() => navigate('/communities')} className="btn btn-outline">
            Explore Communities
          </button>
        </div>
      </section>
    );
  }

  const validate = () => {
    const nextErrors = {};
    if (!form.name || !form.name.trim()) nextErrors.name = 'Community name is required.';
    else if (form.name.trim().length < 3) nextErrors.name = 'Name must be at least 3 characters.';
    else if (form.name.trim().length > 60) nextErrors.name = 'Name must be under 60 characters.';
    if (form.description && form.description.length > 500) nextErrors.description = 'Description must be under 500 characters.';
    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  };

  const handleChange = (key) => (event) => {
    setForm((current) => ({ ...current, [key]: event.target.value }));
    if (errors[key]) setErrors((current) => ({ ...current, [key]: null }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
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
    <div className="create-community-page">
      <header className="create-community-header">
        <button type="button" onClick={() => navigate('/communities')} className="btn btn-outline btn-sm">
          <Icon name="chevronLeft" size={16} aria-hidden="true" />
          Back to communities
        </button>
        <span className="page-eyebrow"><Icon name="users" size={13} /> BUILD YOUR CAMPUS NETWORK</span>
        <h1>Create a community</h1>
        <p>Bring students together around a department, club, subject or shared interest.</p>
      </header>

      <form onSubmit={handleSubmit} className="create-community-form" noValidate>
        <section className="create-community-section">
          <div className="create-community-section-heading">
            <span className="create-community-step">01</span>
            <div>
              <h2>Community details</h2>
              <p>Give your community a clear name and purpose.</p>
            </div>
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="community-name">Community name <span aria-hidden="true">*</span></label>
            <input
              id="community-name"
              className="form-control"
              type="text"
              placeholder="e.g. CSE Study Group"
              value={form.name}
              onChange={handleChange('name')}
              maxLength={60}
              disabled={submitting}
              required
              aria-invalid={Boolean(errors.name)}
              aria-describedby={errors.name ? 'community-name-error' : 'community-name-help'}
            />
            {errors.name ? (
              <span id="community-name-error" className="form-error" role="alert">{errors.name}</span>
            ) : (
              <span id="community-name-help" className="form-help">Use a name students will recognize. 3–60 characters.</span>
            )}
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="community-description">Description</label>
            <textarea
              id="community-description"
              className="form-control"
              placeholder="What is this community for? Who should join?"
              value={form.description}
              onChange={handleChange('description')}
              rows={4}
              maxLength={500}
              disabled={submitting}
              aria-invalid={Boolean(errors.description)}
              aria-describedby={errors.description ? 'community-description-error' : 'community-description-help'}
            />
            {errors.description ? (
              <span id="community-description-error" className="form-error" role="alert">{errors.description}</span>
            ) : (
              <span id="community-description-help" className="form-help">{form.description.length}/500 characters</span>
            )}
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="community-category">Category</label>
            <select
              id="community-category"
              className="form-control"
              value={form.category}
              onChange={handleChange('category')}
              disabled={submitting}
            >
              {COMMUNITY_CATEGORIES.map((category) => (
                <option key={category} value={category}>{category}</option>
              ))}
            </select>
            <span className="form-help">This helps students find your community.</span>
          </div>
        </section>

        <section className="create-community-section">
          <div className="create-community-section-heading">
            <span className="create-community-step">02</span>
            <div>
              <h2>Choose visibility</h2>
              <p>Decide who can discover and join this community.</p>
            </div>
          </div>

          <div className="visibility-options" role="group" aria-label="Community visibility">
            <button
              type="button"
              className={`visibility-option${form.visibility === 'PUBLIC' ? ' is-selected' : ''}`}
              onClick={() => setForm((current) => ({ ...current, visibility: 'PUBLIC' }))}
              disabled={submitting}
              aria-pressed={form.visibility === 'PUBLIC'}
            >
              <span className="visibility-option-icon"><Icon name="users" size={19} /></span>
              <span className="visibility-option-copy">
                <strong>Public community</strong>
                <small>Discoverable by everyone. Students can join directly.</small>
              </span>
              {form.visibility === 'PUBLIC' ? <Icon name="checkCircle2" size={18} /> : <span className="visibility-option-radio" aria-hidden="true" />}
            </button>

            <button
              type="button"
              className={`visibility-option${form.visibility === 'MEMBERS_ONLY' ? ' is-selected' : ''}`}
              onClick={() => setForm((current) => ({ ...current, visibility: 'MEMBERS_ONLY' }))}
              disabled={submitting}
              aria-pressed={form.visibility === 'MEMBERS_ONLY'}
            >
              <span className="visibility-option-icon"><Icon name="lock" size={19} /></span>
              <span className="visibility-option-copy">
                <strong>Private community</strong>
                <small>Students request to join. Moderators review requests.</small>
              </span>
              {form.visibility === 'MEMBERS_ONLY' ? <Icon name="checkCircle2" size={18} /> : <span className="visibility-option-radio" aria-hidden="true" />}
            </button>
          </div>
        </section>

        {serverError && <div className="form-server-error" role="alert">{serverError}</div>}

        <div className="create-community-submit">
          <button type="button" className="btn btn-outline" onClick={() => navigate('/communities')} disabled={submitting}>
            Cancel
          </button>
          <button type="submit" className="btn btn-primary" disabled={submitting}>
            {submitting ? 'Creating community…' : <><Icon name="plus" size={16} /> Create Community</>}
          </button>
        </div>
      </form>
    </div>
  );
};

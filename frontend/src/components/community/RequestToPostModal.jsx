import React, { useState } from 'react';
import { Icon } from '../common/Icons';
import { communitiesApi } from '../../services/api';

export const RequestToPostModal = ({ isOpen, onClose, community, initialTitle = '', initialBody = '', onSuccess }) => {
  const [reason, setReason] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  if (!isOpen || !community) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    try {
      const res = await communitiesApi.requestToPost(community._id, {
        title: initialTitle || 'Request to Publish Discussion',
        body: initialBody || 'Requesting posting permission for academic resource.',
        reason,
        draftPayload: {
          title: initialTitle,
          body: initialBody,
        },
      });

      if (res.success) {
        alert('Your request to post has been sent to the community moderators for approval!');
        if (onSuccess) onSuccess();
        onClose();
      }
    } catch (err) {
      setError(err.message || 'Failed to submit request');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      className="modal-overlay"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="modal-content" style={{ maxWidth: '520px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 20px', borderBottom: '1px solid var(--border-color)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{ width: 36, height: 36, borderRadius: '50%', background: 'var(--warning-light)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Icon name="lock" size={18} color="var(--warning)" />
            </div>
            <div>
              <h3 style={{ fontSize: '1.05rem', fontWeight: 700 }}>Request to Post</h3>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{community.name}</div>
            </div>
          </div>
          <button className="btn-icon" onClick={onClose}><Icon name="x" size={18} /></button>
        </div>

        <form onSubmit={handleSubmit} style={{ padding: '20px' }}>
          <div style={{ background: '#f8fafc', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-md)', padding: '12px', marginBottom: '16px' }}>
            <div style={{ fontSize: '0.825rem', fontWeight: 600, color: '#1e3a8a', marginBottom: '4px' }}>
              ℹ️ Community Posting Policy
            </div>
            <div style={{ fontSize: '0.775rem', color: 'var(--text-secondary)', lineHeight: 1.4 }}>
              Posting in <strong>{community.name}</strong> is restricted to members and approved contributors. Submitting this request allows moderators to review your content and grant posting permission.
            </div>
          </div>

          {error && (
            <div style={{ background: '#fef2f2', border: '1px solid #fecaca', color: '#ef4444', padding: '10px', borderRadius: 'var(--radius-md)', fontSize: '0.8rem', marginBottom: '16px' }}>
              {error}
            </div>
          )}

          <div className="form-group">
            <label className="form-label">Why would you like to post in this community? (Optional)</label>
            <textarea
              className="form-control"
              rows={3}
              placeholder="e.g. I have prepared placement roadmap notes and want to share with fellow CSE students..."
              value={reason}
              onChange={(e) => setReason(e.target.value)}
            />
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '20px' }}>
            <button type="button" className="btn btn-secondary" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className="btn btn-primary" disabled={submitting}>
              {submitting ? 'Submitting...' : 'Send Request to Moderators'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

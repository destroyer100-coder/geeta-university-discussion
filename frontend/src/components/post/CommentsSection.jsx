import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { Icon } from '../common/Icons';
import { useAuth } from '../../context/AuthContext';

// Helper for relative / clean timestamps
const readCommentStore = () => {
  try { return JSON.parse(localStorage.getItem('guf-comment-preview') || '{}'); } catch { return {}; }
};
const persistComments = (postId, comments) => {
  const store = readCommentStore();
  store[String(postId)] = comments;
  try { localStorage.setItem('guf-comment-preview', JSON.stringify(store)); } catch { /* Current component state remains usable. */ }
};
const formatTimeAgo = (dateString) => {
  if (!dateString) return '';
  const date = new Date(dateString);
  const now = new Date();
  const seconds = Math.floor((now - date) / 1000);
  if (seconds < 60) return 'Just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return date.toLocaleDateString();
};

export const CommentsSection = ({
  postId,
  initialComments = [],
  allowComments = true,
  canCommentReason = '',
  isPostAuthor = false,
  canMarkAccepted = false,
  canDeleteComments = false,
}) => {
  const { user } = useAuth();
  const [comments, setComments] = useState(() => [...initialComments, ...(readCommentStore()[String(postId)] || [])]);

  // Top composer state
  const [isComposerExpanded, setIsComposerExpanded] = useState(false);
  const [newCommentText, setNewCommentText] = useState('');
  const [submittingComment, setSubmittingComment] = useState(false);

  // Active inline reply state
  const [replyingToId, setReplyingToId] = useState(null);
  const [replyText, setReplyText] = useState('');
  const [submittingReply, setSubmittingReply] = useState(false);

  // Active inline edit state
  const [editingCommentId, setEditingCommentId] = useState(null);
  const [editText, setEditText] = useState('');
  const [savingEdit, setSavingEdit] = useState(false);

  // Active "More (...)" menu dropdown state
  const [activeMenuId, setActiveMenuId] = useState(null);

  // Synchronize when initialComments change
  React.useEffect(() => {
    setComments((current) => {
      const local = readCommentStore()[String(postId)] || [];
      const localIds = new Set(local.map((item) => String(item._id)));
      return [...initialComments, ...local.filter((item) => !initialComments.some((entry) => String(entry._id) === String(item._id)))];
    });
  }, [initialComments, postId]);

  const saveComments = (nextComments) => {
    setComments(nextComments);
    persistComments(postId, nextComments.filter((item) => item.isLocalPreview));
  };

  const localComment = (body, parentComment = null) => ({
    _id: 'local-comment-' + Date.now() + '-' + Math.random().toString(36).slice(2, 7),
    body,
    parentComment,
    createdAt: new Date().toISOString(),
    isEdited: false,
    isAccepted: false,
    isLiked: false,
    likesCount: 0,
    replies: [],
    author: user ? {
      _id: user._id,
      name: user.name,
      avatar: user.avatar,
      department: user.department,
      year: user.year,
    } : { name: 'Guest', _id: 'local-guest' },
    isLocalPreview: true,
  });

  const handlePostComment = (event) => {
    event?.preventDefault();
    if (!newCommentText.trim() || submittingComment) return;
    setSubmittingComment(true);
    const next = [...comments, localComment(newCommentText.trim())];
    saveComments(next);
    setNewCommentText('');
    setIsComposerExpanded(false);
    setSubmittingComment(false);
  };

  const handlePostReply = (parentCommentId) => {
    if (!replyText.trim() || submittingReply) return;
    setSubmittingReply(true);
    const reply = localComment(replyText.trim(), parentCommentId);
    const next = comments.map((comment) => comment._id === parentCommentId
      ? { ...comment, replies: [...(comment.replies || []), reply] }
      : comment
    );
    saveComments(next);
    setReplyText('');
    setReplyingToId(null);
    setSubmittingReply(false);
  };

  const updateComment = (commentId, updater) => {
    const next = comments.map((comment) => {
      if (comment._id === commentId) return updater(comment);
      if (comment.replies?.some((reply) => reply._id === commentId)) {
        return { ...comment, replies: comment.replies.map((reply) => reply._id === commentId ? updater(reply) : reply) };
      }
      return comment;
    });
    saveComments(next);
  };

  const handleLike = (commentId) => {
    updateComment(commentId, (comment) => {
      const liked = !comment.isLiked;
      return { ...comment, isLiked: liked, likesCount: Math.max(0, Number(comment.likesCount || 0) + (liked ? 1 : -1)) };
    });
  };

  const handleSaveEdit = (commentId) => {
    if (!editText.trim() || savingEdit) return;
    setSavingEdit(true);
    updateComment(commentId, (comment) => ({ ...comment, body: editText.trim(), isEdited: true }));
    setEditingCommentId(null);
    setEditText('');
    setSavingEdit(false);
  };

  const handleDelete = (commentId) => {
    if (!window.confirm('Hide this comment from your local preview?')) return;
    const next = comments
      .filter((comment) => comment._id !== commentId)
      .map((comment) => ({ ...comment, replies: (comment.replies || []).filter((reply) => reply._id !== commentId) }));
    saveComments(next);
    setActiveMenuId(null);
  };

  const handleAcceptAnswer = (commentId) => {
    saveComments(comments.map((comment) => ({ ...comment, isAccepted: comment._id === commentId ? !comment.isAccepted : false })));
  };

  const currentUserAvatar = user?.avatar || '';

  // Render single comment item (used for both root comments & replies)
  const renderCommentItem = (comment, isReply = false, parentId = null) => {
    const isAuthor = user && comment.author?._id === user._id;
    const canDelete = isAuthor || canDeleteComments || user?.role === 'admin';
    const canEdit = isAuthor || user?.role === 'admin';
    const isEditing = editingCommentId === comment._id;
    const isReplying = replyingToId === comment._id;
    const isMenuOpen = activeMenuId === comment._id;

    return (
      <div
        key={comment._id}
        style={{
          display: 'flex',
          gap: isReply ? '10px' : '12px',
          marginTop: isReply ? '12px' : '16px',
          position: 'relative',
        }}
      >
        {/* Left Avatar */}
        <Link to={`/profile/${comment.author?._id || 'user'}`}>
          {comment.author?.avatar ? (
            <img src={comment.author.avatar} alt={comment.author?.name || ''} style={{ width: isReply ? 32 : 40, height: isReply ? 32 : 40, borderRadius: '50%', objectFit: 'cover', border: '1px solid var(--border-color)' }} />
          ) : (
            <span className="comment-avatar-fallback" style={{ width: isReply ? 32 : 40, height: isReply ? 32 : 40 }}>{(comment.author?.name || 'U').trim().split(/\s+/).slice(0, 2).map((part) => part[0]).join('').toUpperCase()}</span>
          )}
        </Link>

        {/* Right Content */}
        <div style={{ flex: 1, minWidth: 0 }}>
          {/* Comment Bubble Box (LinkedIn style) */}
          <div
            style={{
              background: comment.isAccepted ? '#f0fdf4' : '#f8fafc',
              border: `1px solid ${comment.isAccepted ? '#bbf7d0' : 'var(--border-color)'}`,
              borderRadius: '0 12px 12px 12px',
              padding: '10px 14px',
              position: 'relative',
            }}
          >
            {/* Header: Name, Headline, Time, More (...) menu */}
            <div
              style={{
                display: 'flex',
                alignItems: 'flex-start',
                justifyContent: 'space-between',
                marginBottom: '4px',
              }}
            >
              <div>
                <Link
                  to={`/profile/${comment.author?._id || 'user'}`}
                  style={{
                    fontWeight: 700,
                    fontSize: '0.875rem',
                    color: 'var(--text-main)',
                    textDecoration: 'none',
                    marginRight: '6px',
                  }}
                >
                  {comment.author?.name || 'Community Member'}
                </Link>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                  {comment.author?.year || comment.author?.department || comment.author?.role || 'Student'} • {formatTimeAgo(comment.createdAt)} {comment.isEdited && '(edited)'}
                </div>
              </div>

              {/* Top-Right Menu & Accepted Badge */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', position: 'relative' }}>
                {comment.isAccepted && (
                  <span
                    className="badge badge-success"
                    style={{ fontSize: '0.7rem', padding: '2px 8px', display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                  >
                    <Icon name="checkCircle2" size={12} />
                    <span>Accepted Answer</span>
                  </span>
                )}

                {/* Mark as Accepted button for post author or moderator delegated mark_accepted_answers */}
                {!isReply && (isPostAuthor || canMarkAccepted) && (
                  <button
                    type="button"
                    className={`btn btn-sm ${comment.isAccepted ? 'btn-primary' : 'btn-outline'}`}
                    onClick={() => handleAcceptAnswer(comment._id)}
                    style={{ fontSize: '0.7rem', padding: '2px 8px' }}
                  >
                    {comment.isAccepted ? '✓ Accepted' : 'Mark Accepted'}
                  </button>
                )}

                {/* More (...) Dropdown Button */}
                {(canEdit || canDelete) && (
                  <div style={{ position: 'relative' }}>
                    <button
                      type="button"
                      className="btn-icon"
                      style={{ padding: '4px 6px', borderRadius: '50%' }}
                      onClick={() => setActiveMenuId(isMenuOpen ? null : comment._id)}
                      title="More options"
                    >
                      <Icon name="moreHorizontal" size={16} />
                    </button>

                    {isMenuOpen && (
                      <div
                        style={{
                          position: 'absolute',
                          right: 0,
                          top: '100%',
                          background: '#ffffff',
                          border: '1px solid var(--border-color)',
                          borderRadius: 'var(--radius-md)',
                          boxShadow: 'var(--shadow-lg)',
                          width: '140px',
                          padding: '4px',
                          zIndex: 50,
                          display: 'flex',
                          flexDirection: 'column',
                          gap: '2px',
                        }}
                      >
                        {canEdit && (
                          <button
                            type="button"
                            className="btn btn-sm"
                            style={{ justifyContent: 'flex-start', background: 'transparent', border: 'none', padding: '6px 10px', fontSize: '0.8rem' }}
                            onClick={() => {
                              setEditingCommentId(comment._id);
                              setEditText(comment.body);
                              setActiveMenuId(null);
                            }}
                          >
                            <span>✏️ Edit</span>
                          </button>
                        )}
                        {canDelete && (
                          <button
                            type="button"
                            className="btn btn-sm"
                            style={{ justifyContent: 'flex-start', background: 'transparent', border: 'none', padding: '6px 10px', fontSize: '0.8rem', color: '#ef4444' }}
                            onClick={() => handleDelete(comment._id)}
                          >
                            <span>🗑️ Delete</span>
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Comment Body / Edit Mode */}
            {isEditing ? (
              <div style={{ marginTop: '8px' }}>
                <textarea
                  className="form-control"
                  rows={3}
                  value={editText}
                  onChange={(e) => setEditText(e.target.value)}
                  style={{ fontSize: '0.875rem', marginBottom: '8px' }}
                />
                <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    onClick={() => {
                      setEditingCommentId(null);
                      setEditText('');
                    }}
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    className="btn btn-primary btn-sm"
                    disabled={savingEdit || !editText.trim()}
                    onClick={() => handleSaveEdit(comment._id)}
                  >
                    {savingEdit ? 'Saving...' : 'Save'}
                  </button>
                </div>
              </div>
            ) : (
              <div
                style={{
                  fontSize: '0.875rem',
                  lineHeight: 1.5,
                  color: 'var(--text-main)',
                  whiteSpace: 'pre-line',
                  wordBreak: 'break-word',
                  marginTop: '4px',
                }}
              >
                {comment.body}
              </div>
            )}
          </div>

          {/* Action Row: Like, Reply */}
          {!isEditing && (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '16px',
                marginTop: '4px',
                marginLeft: '6px',
                fontSize: '0.8rem',
              }}
            >
              {/* Like Button */}
              <button
                type="button"
                onClick={() => handleLike(comment._id)}
                style={{
                  border: 'none',
                  background: 'transparent',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                  color: comment.isLiked ? 'var(--primary)' : 'var(--text-muted)',
                  fontWeight: comment.isLiked ? 700 : 600,
                  fontSize: '0.8rem',
                  padding: '2px 4px',
                  borderRadius: '4px',
                }}
              >
                <span>👍</span>
                <span>Like</span>
                {(comment.likesCount || 0) > 0 && (
                  <span style={{ color: 'var(--primary)', marginLeft: '2px' }}>
                    • {comment.likesCount}
                  </span>
                )}
              </button>

              {/* Reply Button (Only for root comments) */}
              {!isReply && allowComments && (
                <button
                  type="button"
                  onClick={() => {
                    setReplyingToId(isReplying ? null : comment._id);
                    setReplyText('');
                  }}
                  style={{
                    border: 'none',
                    background: 'transparent',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px',
                    color: 'var(--text-muted)',
                    fontWeight: 600,
                    fontSize: '0.8rem',
                    padding: '2px 4px',
                    borderRadius: '4px',
                  }}
                >
                  <Icon name="messageSquare" size={13} />
                  <span>Reply</span>
                  {(comment.replies?.length || 0) > 0 && (
                    <span style={{ marginLeft: '2px' }}>• {comment.replies.length}</span>
                  )}
                </button>
              )}
            </div>
          )}

          {/* Inline Reply Composer */}
          {isReplying && (
            <div
              style={{
                display: 'flex',
                gap: '10px',
                marginTop: '10px',
                paddingLeft: '10px',
                borderLeft: '2px solid var(--border-color)',
              }}
            >
              {currentUserAvatar ? <img src={currentUserAvatar} alt="Me" style={{ width: 28, height: 28, borderRadius: '50%', objectFit: 'cover', marginTop: '4px' }} /> : <span className="comment-avatar-fallback" style={{ width: 28, height: 28 }}>{(user?.name || 'U').slice(0, 1).toUpperCase()}</span>}
              <div style={{ flex: 1 }}>
                <textarea
                  className="form-control"
                  rows={2}
                  placeholder={`Reply to ${comment.author?.name || 'member'}...`}
                  value={replyText}
                  onChange={(e) => setReplyText(e.target.value)}
                  autoFocus
                  style={{ fontSize: '0.825rem', marginBottom: '8px' }}
                />
                <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    onClick={() => {
                      setReplyingToId(null);
                      setReplyText('');
                    }}
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    className="btn btn-primary btn-sm"
                    disabled={submittingReply || !replyText.trim()}
                    onClick={() => handlePostReply(comment._id)}
                  >
                    {submittingReply ? 'Replying...' : 'Reply'}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Threaded Replies List */}
          {comment.replies && comment.replies.length > 0 && (
            <div
              style={{
                paddingLeft: '12px',
                borderLeft: '2px solid #e2e8f0',
                marginTop: '8px',
              }}
            >
              {comment.replies.map((reply) => renderCommentItem(reply, true, comment._id))}
            </div>
          )}
        </div>
      </div>
    );
  };

  const totalCount = comments.reduce(
    (acc, curr) => acc + 1 + (curr.replies?.length || 0),
    0
  );

  return (
    <section className="card" style={{ padding: '24px', marginTop: '20px' }}>
      <h3 style={{ fontSize: '1.15rem', fontWeight: 800, marginBottom: '18px' }}>
        Comments & Answers ({totalCount})
      </h3>

      {/* LINKEDIN-STYLE COMPACT TO EXPANDED COMPOSER */}
      {allowComments ? (
        <div style={{ marginBottom: '24px' }}>
          <div style={{ display: 'flex', gap: '12px', alignItems: 'flex-start' }}>
            {/* User Avatar */}
            {currentUserAvatar ? (
              <img src={currentUserAvatar} alt="Me" style={{ width: 40, height: 40, borderRadius: '50%', objectFit: 'cover', border: '1px solid var(--border-color)', marginTop: isComposerExpanded ? '4px' : '0' }} />
            ) : (
              <span className="comment-avatar-fallback" style={{ width: 40, height: 40 }}>{(user?.name || 'U').slice(0, 1).toUpperCase()}</span>
            )}

            {/* Composer Input Box */}
            <div style={{ flex: 1 }}>
              {!isComposerExpanded ? (
                // Compact Unexpanded Input Box (LinkedIn Initial State)
                <div
                  onClick={() => setIsComposerExpanded(true)}
                  style={{
                    border: '1px solid var(--border-color)',
                    borderRadius: '24px',
                    padding: '10px 18px',
                    background: '#ffffff',
                    color: 'var(--text-muted)',
                    fontSize: '0.875rem',
                    cursor: 'text',
                    transition: 'border-color 0.2s, box-shadow 0.2s',
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.borderColor = 'var(--primary)')}
                  onMouseLeave={(e) => (e.currentTarget.style.borderColor = 'var(--border-color)')}
                >
                  Add a comment or answer...
                </div>
              ) : (
                // Expanded Multi-line Composer (LinkedIn Typing State)
                <form onSubmit={handlePostComment}>
                  <textarea
                    className="form-control"
                    rows={4}
                    placeholder="What are your thoughts or insights on this discussion?"
                    value={newCommentText}
                    onChange={(e) => setNewCommentText(e.target.value)}
                    autoFocus
                    style={{
                      borderRadius: 'var(--radius-md)',
                      fontSize: '0.875rem',
                      padding: '12px',
                      marginBottom: '10px',
                      borderColor: 'var(--primary)',
                    }}
                  />
                  <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
                    <button
                      type="button"
                      className="btn btn-secondary btn-sm"
                      onClick={() => {
                        if (!newCommentText.trim() || window.confirm('Discard your comment?')) {
                          setIsComposerExpanded(false);
                          setNewCommentText('');
                        }
                      }}
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      className="btn btn-primary btn-sm"
                      disabled={submittingComment || !newCommentText.trim()}
                      style={{ padding: '6px 18px' }}
                    >
                      {submittingComment ? 'Posting...' : 'Comment'}
                    </button>
                  </div>
                </form>
              )}
            </div>
          </div>
        </div>
      ) : (
        <div
          style={{
            padding: '12px 16px',
            background: 'var(--bg-muted)',
            borderRadius: 'var(--radius-md)',
            fontSize: '0.85rem',
            color: 'var(--text-muted)',
            marginBottom: '20px',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
          }}
        >
          <Icon name="lock" size={16} />
          <span>{canCommentReason || 'Comments are locked for this discussion.'}</span>
        </div>
      )}

      {/* COMMENTS LIST */}
      {comments.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '32px 16px', color: 'var(--text-muted)' }}>
          <div style={{ fontSize: '2rem', marginBottom: '8px' }}>💬</div>
          <p style={{ fontSize: '0.9rem', margin: 0 }}>
            No comments yet. Be the first to share your thoughts!
          </p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          {comments.map((comment) => renderCommentItem(comment))}
        </div>
      )}
    </section>
  );
};

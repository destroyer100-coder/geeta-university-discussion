import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { Icon } from '../common/Icons';
import { postsApi, commentsApi } from '../../services/api';
import { useAuth } from '../../context/AuthContext';

// Helper for relative / clean timestamps
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
  const [comments, setComments] = useState(initialComments);

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
    setComments(initialComments);
  }, [initialComments]);

  // Handle Root Comment Submit
  const handlePostComment = async (e) => {
    e?.preventDefault();
    if (!newCommentText.trim() || submittingComment) return;

    setSubmittingComment(true);
    try {
      const res = await postsApi.addComment(postId, { body: newCommentText.trim() });
      if (res.success && res.data) {
        setComments((prev) => [...prev, res.data]);
        setNewCommentText('');
        setIsComposerExpanded(false);
      }
    } catch (err) {
      alert(err.message || 'Failed to post comment');
    } finally {
      setSubmittingComment(false);
    }
  };

  // Handle Nested Reply Submit
  const handlePostReply = async (parentCommentId) => {
    if (!replyText.trim() || submittingReply) return;

    setSubmittingReply(true);
    try {
      const res = await postsApi.addComment(postId, {
        body: replyText.trim(),
        parentComment: parentCommentId,
      });

      if (res.success && res.data) {
        setComments((prev) =>
          prev.map((c) => {
            if (c._id === parentCommentId) {
              return {
                ...c,
                replies: [...(c.replies || []), res.data],
              };
            }
            return c;
          })
        );
        setReplyText('');
        setReplyingToId(null);
      }
    } catch (err) {
      alert(err.message || 'Failed to post reply');
    } finally {
      setSubmittingReply(false);
    }
  };

  // Handle Like on Comment
  const handleLike = async (commentId) => {
    if (!user) {
      alert('Please log in to like comments');
      return;
    }

    // Optimistic update
    setComments((prev) =>
      prev.map((c) => {
        if (c._id === commentId) {
          const isLiked = !c.isLiked;
          return {
            ...c,
            isLiked,
            likesCount: isLiked ? (c.likesCount || 0) + 1 : Math.max(0, (c.likesCount || 0) - 1),
          };
        }
        if (c.replies) {
          return {
            ...c,
            replies: c.replies.map((r) => {
              if (r._id === commentId) {
                const isLiked = !r.isLiked;
                return {
                  ...r,
                  isLiked,
                  likesCount: isLiked ? (r.likesCount || 0) + 1 : Math.max(0, (r.likesCount || 0) - 1),
                };
              }
              return r;
            }),
          };
        }
        return c;
      })
    );

    try {
      await commentsApi.like(commentId);
    } catch (err) {
      console.error('Like comment failed:', err);
    }
  };

  // Handle Edit Submit
  const handleSaveEdit = async (commentId) => {
    if (!editText.trim() || savingEdit) return;

    setSavingEdit(true);
    try {
      const res = await commentsApi.update(commentId, { body: editText.trim() });
      if (res.success) {
        setComments((prev) =>
          prev.map((c) => {
            if (c._id === commentId) {
              return { ...c, body: editText.trim(), isEdited: true };
            }
            if (c.replies) {
              return {
                ...c,
                replies: c.replies.map((r) =>
                  r._id === commentId ? { ...r, body: editText.trim(), isEdited: true } : r
                ),
              };
            }
            return c;
          })
        );
        setEditingCommentId(null);
        setEditText('');
      }
    } catch (err) {
      alert(err.message || 'Failed to update comment');
    } finally {
      setSavingEdit(false);
    }
  };

  // Handle Delete Comment
  const handleDelete = async (commentId) => {
    if (!window.confirm('Are you sure you want to delete this comment?')) return;

    try {
      const res = await commentsApi.delete(commentId);
      if (res.success) {
        setComments((prev) =>
          prev
            .filter((c) => c._id !== commentId)
            .map((c) => ({
              ...c,
              replies: (c.replies || []).filter((r) => r._id !== commentId),
            }))
        );
        setActiveMenuId(null);
      }
    } catch (err) {
      alert(err.message || 'Failed to delete comment');
    }
  };

  // Handle Accept Answer toggle
  const handleAcceptAnswer = async (commentId) => {
    try {
      const res = await commentsApi.acceptAnswer(commentId);
      if (res.success) {
        setComments((prev) =>
          prev.map((c) => ({
            ...c,
            isAccepted: c._id === commentId ? res.isAccepted : false,
          }))
        );
      }
    } catch (err) {
      alert(err.message || 'Failed to accept answer');
    }
  };

  const currentUserAvatar =
    user?.avatar || 'https://api.dicebear.com/7.x/avataaars/svg?seed=user';

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
          <img
            src={
              comment.author?.avatar ||
              'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100'
            }
            alt={comment.author?.name || 'User'}
            style={{
              width: isReply ? 32 : 40,
              height: isReply ? 32 : 40,
              borderRadius: '50%',
              objectFit: 'cover',
              border: '1px solid var(--border-color)',
            }}
          />
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
              <img
                src={currentUserAvatar}
                alt="Me"
                style={{ width: 28, height: 28, borderRadius: '50%', objectFit: 'cover', marginTop: '4px' }}
              />
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
            <img
              src={currentUserAvatar}
              alt="Me"
              style={{
                width: 40,
                height: 40,
                borderRadius: '50%',
                objectFit: 'cover',
                border: '1px solid var(--border-color)',
                marginTop: isComposerExpanded ? '4px' : '0',
              }}
            />

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

import React, { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { postsApi, commentsApi, pollsApi } from '../../../services/api';
import { useAuth } from '../../../context/AuthContext';
import { Icon } from '../../../components/common/Icons';
import { CommentsSection } from '../../../components/post/CommentsSection';

export const DiscussionDetails = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [post, setPost] = useState(null);
  const [comments, setComments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [errorState, setErrorState] = useState(null);
  const [actionLoading, setActionLoading] = useState(false);

  // Review & Resubmit state
  const [showRejectInput, setShowRejectInput] = useState(false);
  const [rejectReason, setRejectReason] = useState('');
  const [showResubmitModal, setShowResubmitModal] = useState(false);
  const [resubmitTitle, setResubmitTitle] = useState('');
  const [resubmitBody, setResubmitBody] = useState('');

  const fetchPostAndComments = async () => {
    try {
      setErrorState(null);
      const [postRes, commRes] = await Promise.all([
        postsApi.getById(id),
        postsApi.getComments(id),
      ]);

      if (postRes.success) {
        setPost(postRes.data);
        setResubmitTitle(postRes.data.title || '');
        setResubmitBody(postRes.data.body || '');
      }
      if (commRes.success) setComments(commRes.data);
    } catch (err) {
      console.error('Failed to load discussion:', err);
      setErrorState(err.message || 'Discussion could not be loaded.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPostAndComments();
  }, [id]);

  // Optimistic Like with Rollback (Point 21)
  const handleLikePost = async () => {
    if (!post) return;
    const prevLiked = post.isLiked;
    const prevCount = post.likesCount ?? (post.likes?.length || 0);

    setPost((prev) => ({
      ...prev,
      isLiked: !prevLiked,
      likesCount: prevLiked ? Math.max(0, prevCount - 1) : prevCount + 1,
    }));

    try {
      const res = await postsApi.like(post._id);
      if (res.success) {
        setPost((prev) => ({ ...prev, isLiked: res.liked, likesCount: res.likesCount }));
      }
    } catch (e) {
      setPost((prev) => ({ ...prev, isLiked: prevLiked, likesCount: prevCount }));
      alert(e.message || 'Like failed');
    }
  };

  // Optimistic Save with Rollback (Point 21)
  const handleSavePost = async () => {
    if (!post) return;
    const prevSaved = post.isSaved;
    const prevCount = post.savesCount ?? (post.saves?.length || 0);

    setPost((prev) => ({
      ...prev,
      isSaved: !prevSaved,
      savesCount: prevSaved ? Math.max(0, prevCount - 1) : prevCount + 1,
    }));

    try {
      const res = await postsApi.save(post._id);
      if (res.success) {
        setPost((prev) => ({ ...prev, isSaved: res.saved, savesCount: res.savesCount }));
      }
    } catch (e) {
      setPost((prev) => ({ ...prev, isSaved: prevSaved, savesCount: prevCount }));
      alert(e.message || 'Save failed');
    }
  };

  // Optimistic Helpful Vote with Rollback (Point 21)
  const handleHelpfulPost = async () => {
    if (!post) return;
    const prevHelpful = post.isHelpful;
    const prevCount = post.helpfulCount ?? (post.helpfulVotes?.length || 0);

    setPost((prev) => ({
      ...prev,
      isHelpful: !prevHelpful,
      helpfulCount: prevHelpful ? Math.max(0, prevCount - 1) : prevCount + 1,
    }));

    try {
      const res = await postsApi.helpful(post._id);
      if (res.success) {
        setPost((prev) => ({
          ...prev,
          isHelpful: res.helpful,
          helpfulCount: res.helpfulCount,
        }));
      }
    } catch (e) {
      setPost((prev) => ({ ...prev, isHelpful: prevHelpful, helpfulCount: prevCount }));
      alert(e.message || 'Vote failed');
    }
  };

  // Moderator Review Approval / Rejection (Point 5)
  const handleReviewPost = async (action) => {
    if (actionLoading) return;
    setActionLoading(true);
    try {
      const res = await postsApi.review(post._id, { action, reviewNote: rejectReason });
      if (res.success) {
        alert(`Post ${action === 'approve' ? 'approved' : 'rejected'}.`);
        setShowRejectInput(false);
        fetchPostAndComments();
      }
    } catch (err) {
      alert(err.message || 'Review action failed.');
    } finally {
      setActionLoading(false);
    }
  };

  // Author Resubmission (Point 5)
  const handleResubmitPost = async (e) => {
    e.preventDefault();
    if (actionLoading) return;
    setActionLoading(true);
    try {
      const res = await postsApi.resubmit(post._id, {
        title: resubmitTitle,
        body: resubmitBody,
      });
      if (res.success) {
        alert('Post resubmitted for approval.');
        setShowResubmitModal(false);
        fetchPostAndComments();
      }
    } catch (err) {
      alert(err.message || 'Resubmit failed.');
    } finally {
      setActionLoading(false);
    }
  };

  // Pin Toggle (Point 7)
  const handleTogglePin = async () => {
    if (actionLoading) return;
    setActionLoading(true);
    try {
      const res = await postsApi.pin(post._id);
      if (res.success) {
        setPost((prev) => ({ ...prev, isPinned: res.isPinned }));
        alert(res.message);
      }
    } catch (err) {
      alert(err.message);
    } finally {
      setActionLoading(false);
    }
  };

  // Lock Toggle (Point 4)
  const handleToggleLock = async () => {
    if (actionLoading) return;
    setActionLoading(true);
    try {
      const res = await postsApi.lock(post._id);
      if (res.success) {
        setPost((prev) => ({
          ...prev,
          status: res.status,
          allowComments: res.status !== 'locked',
        }));
        alert(res.message);
      }
    } catch (err) {
      alert(err.message);
    } finally {
      setActionLoading(false);
    }
  };

  // Delete Post (Point 3, 15)
  const handleDeletePost = async () => {
    if (!window.confirm('Are you sure you want to permanently delete this discussion?')) return;
    try {
      const res = await postsApi.delete(post._id);
      if (res.success) {
        alert('Discussion deleted.');
        navigate('/');
      }
    } catch (err) {
      alert(err.message || 'Failed to delete post');
    }
  };

  const handleVotePoll = async (optionIdx) => {
    if (!post?.poll) return;
    try {
      const res = await pollsApi.vote(post.poll._id, optionIdx);
      if (res.success) {
        setPost((prev) => ({ ...prev, poll: res.data }));
      }
    } catch (e) {
      alert(e.message);
    }
  };



  if (loading) {
    return <div style={{ textAlign: 'center', padding: '60px' }}>Loading discussion details...</div>;
  }

  // Safe Deep-Link / Error Handling (Point 22)
  if (errorState || !post) {
    return (
      <div className="card" style={{ padding: '40px', textAlign: 'center', margin: '40px auto', maxWidth: '600px' }}>
        <div style={{ fontSize: '3rem', marginBottom: '16px' }}>🔒</div>
        <h2 style={{ fontSize: '1.4rem', fontWeight: 800, marginBottom: '8px' }}>
          Discussion Unavailable
        </h2>
        <p style={{ color: 'var(--text-muted)', marginBottom: '20px' }}>
          {errorState || 'This discussion is deleted, removed, or requires private community membership to view.'}
        </p>
        <Link to="/" className="btn btn-primary">
          Back to Discussions Feed
        </Link>
      </div>
    );
  }

  // Safe Tombstone Display (Point 4)
  if (post.isDeleted) {
    return (
      <div className="card" style={{ padding: '36px', textAlign: 'center', margin: '40px auto', maxWidth: '640px' }}>
        <div style={{ fontSize: '2.5rem', marginBottom: '12px' }}>🗑️</div>
        <h2 style={{ fontSize: '1.3rem', fontWeight: 800, marginBottom: '8px' }}>
          [Discussion Removed]
        </h2>
        <p style={{ color: 'var(--text-muted)', marginBottom: '20px' }}>
          This content was deleted by the author or removed by community moderation.
        </p>
        <Link to="/" className="btn btn-secondary">
          Return to Feed
        </Link>
      </div>
    );
  }

  const author = post.author || {};
  const community = post.community || {};
  const attachments = post.attachments || [];
  const folders = post.folders || [];
  const poll = post.poll;
  const isPostAuthor = user && author._id && user._id.toString() === author._id.toString();
  // Granular server-provided delegations for this exact community (rules §8)
  const modPerms = post.moderationPermissions || {};

  const videoAttachments = attachments.filter((a) => a.type === 'video');
  const imageAttachments = attachments.filter((a) => a.type === 'image');
  const fileAttachments = attachments.filter((a) => a.type === 'file' && !a.folder);
  const folderFiles = attachments.filter((a) => a.folder || a.folderRelativePath);
  const totalPollVotes =
    poll?.options?.reduce((acc, curr) => acc + (curr.votesCount || 0), 0) || 0;

  return (
    <div className="discussion-container">
      {/* Breadcrumb */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          fontSize: '0.8rem',
          color: 'var(--text-muted)',
          marginBottom: '16px',
        }}
      >
        <Link to="/">Home</Link>
        <span>&gt;</span>
        {community?.name && (community.slug || community._id) ? (
          <>
            <Link to={`/communities/${community.slug || community._id}`}>
              {community.name}
            </Link>
            <span>&gt;</span>
          </>
        ) : (
          <>
            <span style={{ color: 'var(--text-muted)' }}>Campus-Wide</span>
            <span>&gt;</span>
          </>
        )}
        <span
          style={{
            color: 'var(--text-main)',
            fontWeight: 600,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {post.title}
        </span>
      </div>

      {/* Moderation & State Banners (Point 4 & Point 5) */}
      {post.status === 'pending' && (
        <div
          style={{
            background: '#fef3c7',
            border: '1px solid #fde68a',
            borderRadius: 'var(--radius-md)',
            padding: '16px 20px',
            marginBottom: '18px',
          }}
        >
          <div style={{ fontWeight: 800, color: '#92400e', marginBottom: '4px' }}>
            ⏳ Post Pending Approval
          </div>
          <p style={{ fontSize: '0.85rem', color: '#78350f', margin: 0 }}>
            This post was submitted under community review policy. It is only visible to you and
            community moderators.
          </p>
          {modPerms.manageRequests && (
            <div style={{ marginTop: '12px', display: 'flex', gap: '8px', alignItems: 'center' }}>
              <button
                className="btn btn-primary btn-sm"
                onClick={() => handleReviewPost('approve')}
                disabled={actionLoading}
              >
                ✓ Approve & Publish
              </button>
              <button
                className="btn btn-secondary btn-sm"
                onClick={() => setShowRejectInput(!showRejectInput)}
                disabled={actionLoading}
              >
                ✕ Reject Post
              </button>
            </div>
          )}
          {showRejectInput && (
            <div style={{ marginTop: '10px' }}>
              <input
                type="text"
                className="form-control"
                placeholder="Reason for rejection (sent to author)..."
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                style={{ marginBottom: '6px' }}
              />
              <button
                className="btn btn-danger btn-sm"
                onClick={() => handleReviewPost('reject')}
                disabled={actionLoading}
              >
                Confirm Rejection
              </button>
            </div>
          )}
        </div>
      )}

      {post.status === 'rejected' && (
        <div
          style={{
            background: '#fee2e2',
            border: '1px solid #fca5a5',
            borderRadius: 'var(--radius-md)',
            padding: '16px 20px',
            marginBottom: '18px',
          }}
        >
          <div style={{ fontWeight: 800, color: '#991b1b', marginBottom: '4px' }}>
            ❌ Post Rejected by Moderator
          </div>
          <p style={{ fontSize: '0.85rem', color: '#7f1d1d', margin: 0 }}>
            {post.rejectionReason
              ? `Reason: ${post.rejectionReason}`
              : 'This post did not meet community posting guidelines.'}
          </p>
          {isPostAuthor && (
            <button
              className="btn btn-primary btn-sm"
              style={{ marginTop: '10px' }}
              onClick={() => setShowResubmitModal(true)}
            >
              Edit & Resubmit Post
            </button>
          )}
        </div>
      )}

      {(post.isDeleted || post.status === 'deleted' || post.status === 'removed') && (
        <div
          style={{
            background: '#fef2f2',
            border: '1px solid #fecaca',
            borderRadius: 'var(--radius-md)',
            padding: '12px 18px',
            marginBottom: '18px',
            fontSize: '0.85rem',
            color: '#991b1b',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
          }}
        >
          <span>🗑️ This discussion has been deleted or removed. Interactions and comments are disabled.</span>
        </div>
      )}

      {post.status === 'locked' && (
        <div
          style={{
            background: '#f1f5f9',
            border: '1px solid #cbd5e1',
            borderRadius: 'var(--radius-md)',
            padding: '12px 18px',
            marginBottom: '18px',
            fontSize: '0.85rem',
            color: '#334155',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
          }}
        >
          <span>🔒 Comments are closed for this discussion.</span>
        </div>
      )}

      {/* Main Discussion Card */}
      <article className="card" style={{ padding: '24px', marginBottom: '24px' }}>
        {/* Pinned Badge */}
        {post.isPinned && (
          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              backgroundColor: '#fef3c7',
              color: '#92400e',
              padding: '4px 10px',
              borderRadius: '6px',
              fontSize: '0.75rem',
              fontWeight: 700,
              marginBottom: '12px',
            }}
          >
            <span>📌 Pinned{community.name ? ` in ${community.name}` : ''}</span>
          </div>
        )}

        {/* Author Header */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: '18px',
            flexWrap: 'wrap',
            gap: '12px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <img
              src={
                author.avatar ||
                'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100'
              }
              alt={author.name}
              style={{ width: 46, height: 46, borderRadius: '50%', objectFit: 'cover' }}
            />
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                <span style={{ fontWeight: 800, fontSize: '1rem' }}>
                  {post.isAnonymous ? 'Anonymous Geeta Member' : author.name}
                </span>
                {author.verified && <Icon name="checkCircle2" size={16} color="#3b82f6" />}
                {community.name ? (
                  <Link to={`/communities/${community.slug || community._id}`}>
                    <span className="badge badge-primary">{community.name}</span>
                  </Link>
                ) : (
                  <span className="badge badge-accent">🌐 Campus-Wide</span>
                )}
              </div>
              <div style={{ fontSize: '0.775rem', color: 'var(--text-muted)' }}>
                {author.year || author.department} • Posted{' '}
                {new Date(post.createdAt).toLocaleDateString()}
              </div>
            </div>
          </div>

          {/* Action buttons (Pin, Lock, Delete) — each gated by its exact delegation */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            {modPerms.pin && (
              <button
                className="btn btn-secondary btn-sm"
                onClick={handleTogglePin}
                disabled={actionLoading}
              >
                {post.isPinned ? 'Unpin' : '📌 Pin'}
              </button>
            )}
            {modPerms.lock && (
              <button
                className="btn btn-secondary btn-sm"
                onClick={handleToggleLock}
                disabled={actionLoading}
              >
                {post.status === 'locked' ? 'Unlock' : '🔒 Lock'}
              </button>
            )}
            {(isPostAuthor || modPerms.delete) && (
              <button className="btn btn-danger btn-sm" onClick={handleDeletePost}>
                Delete
              </button>
            )}
          </div>
        </div>

        {/* Title */}
        <h1
          style={{
            fontSize: '1.45rem',
            fontWeight: 800,
            marginBottom: '12px',
            lineHeight: 1.3,
          }}
        >
          {post.title}
        </h1>

        {/* Tags */}
        {post.tags && post.tags.length > 0 && (
          <div className="post-tags" style={{ marginBottom: '16px' }}>
            {post.tags.map((t, idx) => (
              <span key={idx} className="tag-pill">
                #{t}
              </span>
            ))}
          </div>
        )}

        {/* Body */}
        <div
          style={{
            fontSize: '0.975rem',
            lineHeight: 1.7,
            color: 'var(--text-main)',
            marginBottom: '24px',
            whiteSpace: 'pre-line',
          }}
        >
          {post.body}
        </div>

        {/* Multi-Attachment Section */}
        {(attachments.length > 0 || folders.length > 0 || poll) && (
          <div className="attachments-gallery" style={{ marginBottom: '20px' }}>
            <div
              style={{
                fontSize: '0.85rem',
                fontWeight: 700,
                marginBottom: '10px',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
              }}
            >
              <Icon name="fileArchive" size={16} color="var(--primary)" />
              <span>Discussion Resources & Attachments</span>
            </div>

            {/* Video */}
            {videoAttachments.map((v, i) => (
              <div
                key={i}
                style={{
                  marginBottom: '14px',
                  borderRadius: 'var(--radius-md)',
                  overflow: 'hidden',
                  background: '#000',
                }}
              >
                <video
                  controls
                  preload="metadata"
                  style={{ width: '100%', maxHeight: '420px', display: 'block' }}
                  poster={v.metadata?.thumbnail}
                >
                  <source src={v.url} type={v.mimeType || 'video/mp4'} />
                  Your browser does not support the video tag.
                </video>
                <div
                  style={{
                    padding: '8px 14px',
                    background: '#0f172a',
                    color: '#fff',
                    fontSize: '0.8rem',
                    display: 'flex',
                    justifyContent: 'space-between',
                  }}
                >
                  <span>🎬 {v.originalName}</span>
                  <span>{(v.size / (1024 * 1024)).toFixed(1)} MB</span>
                </div>
              </div>
            ))}

            {/* Images */}
            {imageAttachments.length > 0 && (
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: imageAttachments.length > 1 ? '1fr 1fr' : '1fr',
                  gap: '10px',
                  marginBottom: '14px',
                }}
              >
                {imageAttachments.map((img, i) => (
                  <div
                    key={i}
                    style={{
                      borderRadius: 'var(--radius-md)',
                      overflow: 'hidden',
                      border: '1px solid var(--border-color)',
                    }}
                  >
                    <img
                      src={img.url}
                      alt={img.originalName}
                      style={{ width: '100%', maxHeight: '400px', objectFit: 'cover' }}
                    />
                  </div>
                ))}
              </div>
            )}

            {/* Files (PDF, ZIP) */}
            {fileAttachments.length > 0 && (
              <div
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '8px',
                  marginBottom: '14px',
                }}
              >
                {fileAttachments.map((file, i) => (
                  <a
                    key={i}
                    href={file.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="file-attachment-card"
                  >
                    <div className="file-icon-box">
                      <Icon name="fileText" size={20} color="var(--primary)" />
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div className="file-name">{file.originalName}</div>
                      <div className="file-size">
                        {(file.size / (1024 * 1024)).toFixed(2)} MB • {file.mimeType}
                      </div>
                    </div>
                    <div
                      className="btn btn-secondary"
                      style={{ padding: '6px 12px', fontSize: '0.8rem' }}
                    >
                      Download
                    </div>
                  </a>
                ))}
              </div>
            )}

            {/* Code Folder Hierarchy */}
            {folders.length > 0 && (
              <div className="folder-viewer-box" style={{ marginBottom: '14px' }}>
                <div
                  style={{
                    fontWeight: 700,
                    fontSize: '0.85rem',
                    marginBottom: '8px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                  }}
                >
                  <Icon name="folder" size={16} color="var(--accent)" />
                  <span>Code Folder Hierarchy</span>
                </div>
                <div className="folder-tree">
                  {folders.map((f, idx) => (
                    <div key={idx} style={{ paddingLeft: '8px', marginBottom: '4px' }}>
                      <div
                        style={{
                          fontWeight: 600,
                          display: 'flex',
                          alignItems: 'center',
                          gap: '6px',
                        }}
                      >
                        📁 {f.relativePath || f.name}
                      </div>
                      <div style={{ paddingLeft: '20px' }}>
                        {folderFiles
                          .filter(
                            (att) =>
                              att.folder === f._id || att.folderRelativePath === f.relativePath
                          )
                          .map((fFile, fIdx) => (
                            <div
                              key={fIdx}
                              style={{
                                fontSize: '0.8rem',
                                color: 'var(--text-muted)',
                                padding: '2px 0',
                                display: 'flex',
                                justifyContent: 'space-between',
                              }}
                            >
                              <span>📄 {fFile.originalName}</span>
                              <a
                                href={fFile.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                style={{ color: 'var(--primary)', textDecoration: 'none' }}
                              >
                                View
                              </a>
                            </div>
                          ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Poll */}
            {poll && (
              <div className="poll-container" style={{ marginBottom: '14px' }}>
                <div
                  style={{
                    fontWeight: 700,
                    fontSize: '0.9rem',
                    marginBottom: '10px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                  }}
                >
                  <Icon name="barChart2" size={16} color="var(--primary)" />
                  <span>{poll.question}</span>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  {poll.options.map((opt, optIdx) => {
                    const percent =
                      totalPollVotes > 0
                        ? Math.round(((opt.votesCount || 0) / totalPollVotes) * 100)
                        : 0;
                    const isVoted = poll.userVotedOption === optIdx;

                    return (
                      <div
                        key={optIdx}
                        className="poll-option-row"
                        onClick={() => handleVotePoll(optIdx)}
                        style={{
                          borderColor: isVoted ? 'var(--primary)' : 'var(--border-color)',
                          backgroundColor: isVoted ? 'var(--primary-light)' : '#ffffff',
                        }}
                      >
                        <div
                          className="poll-progress-fill"
                          style={{
                            width: `${percent}%`,
                            backgroundColor: isVoted ? '#bfdbfe' : '#f1f5f9',
                          }}
                        />
                        <span
                          className="poll-option-text"
                          style={{ fontWeight: isVoted ? 700 : 500 }}
                        >
                          {opt.text} {isVoted && '✓ (Your vote)'}
                        </span>
                        <span className="poll-option-stats">
                          {percent}% ({opt.votesCount || 0})
                        </span>
                      </div>
                    );
                  })}
                </div>
                <div
                  style={{
                    fontSize: '0.75rem',
                    color: 'var(--text-muted)',
                    marginTop: '8px',
                    display: 'flex',
                    justifyContent: 'space-between',
                  }}
                >
                  <span>{totalPollVotes} total votes</span>
                  <span>Click an option to cast or change vote</span>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Discussion Actions Footer */}
        {!post.isDeleted && post.status !== 'deleted' && post.status !== 'removed' && (
          <div className="post-actions-bar" style={{ marginTop: '16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <button
                className={`post-action-btn ${post.isLiked ? 'active-like' : ''}`}
                onClick={handleLikePost}
              >
                <Icon
                  name="heart"
                  size={16}
                  color={post.isLiked ? '#ef4444' : 'currentColor'}
                />
                <span>{post.likesCount ?? (post.likes?.length || 0)}</span>
              </button>

              <button
                className={`post-action-btn ${post.isHelpful ? 'active-helpful' : ''}`}
                onClick={handleHelpfulPost}
              >
                <Icon
                  name="award"
                  size={16}
                  color={post.isHelpful ? 'var(--primary)' : 'currentColor'}
                />
                <span>Helpful ({post.helpfulCount ?? (post.helpfulVotes?.length || 0)})</span>
              </button>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <button
                className="post-action-btn"
                onClick={() => {
                  navigator.clipboard?.writeText?.(window.location.href);
                  alert('Link copied to clipboard!');
                }}
              >
                <Icon name="share2" size={16} />
                <span>Share</span>
              </button>

              <button
                className={`post-action-btn ${post.isSaved ? 'active-save' : ''}`}
                onClick={handleSavePost}
              >
                <Icon
                  name="bookmark"
                  size={16}
                  color={post.isSaved ? '#f59e0b' : 'currentColor'}
                />
                <span>{post.isSaved ? 'Saved' : 'Save'}</span>
              </button>
            </div>
          </div>
        )}
      </article>

      {/* Resubmit Modal (Point 5) */}
      {showResubmitModal && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
            padding: '20px',
          }}
        >
          <div className="card" style={{ maxWidth: '600px', width: '100%', padding: '24px' }}>
            <h3 style={{ fontSize: '1.2rem', fontWeight: 800, marginBottom: '14px' }}>
              Edit and Resubmit Post for Review
            </h3>
            <form onSubmit={handleResubmitPost}>
              <div style={{ marginBottom: '12px' }}>
                <label style={{ fontSize: '0.8rem', fontWeight: 700, display: 'block', marginBottom: '4px' }}>
                  Title
                </label>
                <input
                  type="text"
                  className="form-control"
                  value={resubmitTitle}
                  onChange={(e) => setResubmitTitle(e.target.value)}
                  required
                />
              </div>
              <div style={{ marginBottom: '16px' }}>
                <label style={{ fontSize: '0.8rem', fontWeight: 700, display: 'block', marginBottom: '4px' }}>
                  Body
                </label>
                <textarea
                  className="form-control"
                  rows={6}
                  value={resubmitBody}
                  onChange={(e) => setResubmitBody(e.target.value)}
                  required
                />
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setShowResubmitModal(false)}
                >
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary" disabled={actionLoading}>
                  Resubmit for Approval
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* LinkedIn-style Comments & Answers Section */}
      <CommentsSection
        postId={post._id}
        initialComments={comments}
        allowComments={post.allowComments && post.canComment}
        canCommentReason={post.canCommentReason}
        isPostAuthor={isPostAuthor}
        canMarkAccepted={Boolean(modPerms.markAccepted)}
        canDeleteComments={Boolean(modPerms.delete)}
      />
    </div>
  );
};

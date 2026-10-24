import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Icon } from '../common/Icons';
import { postsApi, pollsApi } from '../../services/api';
import { useAuth } from '../../context/AuthContext';

export const PostCard = ({ post, onVotePollSuccess, onPostUpdated, modPermissions = null }) => {
  const { user } = useAuth();
  const [currentPost, setCurrentPost] = useState(post);
  const [voting, setVoting] = useState(false);
  const [isLiking, setIsLiking] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isHelpfulVoting, setIsHelpfulVoting] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);

  useEffect(() => {
    setCurrentPost(post);
  }, [post]);

  // Optimistic Like with Rollback (Point 21)
  const handleLike = async (e) => {
    e.preventDefault();
    if (isLiking) return;
    setIsLiking(true);

    const prevLiked = currentPost.isLiked;
    const prevCount = currentPost.likesCount ?? (currentPost.likes?.length || 0);

    setCurrentPost((prev) => ({
      ...prev,
      isLiked: !prevLiked,
      likesCount: prevLiked ? Math.max(0, prevCount - 1) : prevCount + 1,
    }));

    try {
      const res = await postsApi.like(currentPost._id);
      if (res.success) {
        setCurrentPost((prev) => ({
          ...prev,
          isLiked: res.liked,
          likesCount: res.likesCount,
        }));
      }
    } catch (err) {
      setCurrentPost((prev) => ({
        ...prev,
        isLiked: prevLiked,
        likesCount: prevCount,
      }));
      alert(err.message || 'Please log in to like');
    } finally {
      setIsLiking(false);
    }
  };

  // Optimistic Save with Rollback (Point 21)
  const handleSave = async (e) => {
    e.preventDefault();
    if (isSaving) return;
    setIsSaving(true);

    const prevSaved = currentPost.isSaved;
    const prevCount = currentPost.savesCount ?? (currentPost.saves?.length || 0);

    setCurrentPost((prev) => ({
      ...prev,
      isSaved: !prevSaved,
      savesCount: prevSaved ? Math.max(0, prevCount - 1) : prevCount + 1,
    }));

    try {
      const res = await postsApi.save(currentPost._id);
      if (res.success) {
        setCurrentPost((prev) => ({
          ...prev,
          isSaved: res.saved,
          savesCount: res.savesCount,
        }));
      }
    } catch (err) {
      setCurrentPost((prev) => ({
        ...prev,
        isSaved: prevSaved,
        savesCount: prevCount,
      }));
      alert(err.message || 'Please log in to save');
    } finally {
      setIsSaving(false);
    }
  };

  // Optimistic Helpful Vote with Rollback (Point 21)
  const handleHelpful = async (e) => {
    e.preventDefault();
    if (isHelpfulVoting) return;
    setIsHelpfulVoting(true);

    const prevHelpful = currentPost.isHelpful;
    const prevCount = currentPost.helpfulCount ?? (currentPost.helpfulVotes?.length || 0);

    setCurrentPost((prev) => ({
      ...prev,
      isHelpful: !prevHelpful,
      helpfulCount: prevHelpful ? Math.max(0, prevCount - 1) : prevCount + 1,
    }));

    try {
      const res = await postsApi.helpful(currentPost._id);
      if (res.success) {
        setCurrentPost((prev) => ({
          ...prev,
          isHelpful: res.helpful,
          helpfulCount: res.helpfulCount,
        }));
      }
    } catch (err) {
      setCurrentPost((prev) => ({
        ...prev,
        isHelpful: prevHelpful,
        helpfulCount: prevCount,
      }));
      alert(err.message || 'Please log in');
    } finally {
      setIsHelpfulVoting(false);
    }
  };

  // Pin / Unpin Post (Point 7)
  const handleTogglePin = async () => {
    if (actionLoading) return;
    setActionLoading(true);
    try {
      const res = await postsApi.pin(currentPost._id);
      if (res.success) {
        setCurrentPost((prev) => ({ ...prev, isPinned: res.isPinned }));
        if (onPostUpdated) onPostUpdated();
      }
    } catch (err) {
      alert(err.message || 'Failed to update pin state');
    } finally {
      setActionLoading(false);
    }
  };

  // Lock / Unlock Comments (Point 4)
  const handleToggleLock = async () => {
    if (actionLoading) return;
    setActionLoading(true);
    try {
      const res = await postsApi.lock(currentPost._id);
      if (res.success) {
        setCurrentPost((prev) => ({
          ...prev,
          status: res.status,
          allowComments: res.status !== 'locked',
        }));
        if (onPostUpdated) onPostUpdated();
      }
    } catch (err) {
      alert(err.message || 'Failed to update lock state');
    } finally {
      setActionLoading(false);
    }
  };

  const handleDeletePost = async () => {
    if (!window.confirm('Are you sure you want to delete this discussion?')) return;
    if (actionLoading) return;
    setActionLoading(true);
    try {
      const res = await postsApi.delete(currentPost._id);
      if (res.success) {
        setCurrentPost((prev) => ({ ...prev, status: 'deleted', isDeleted: true }));
        if (onPostUpdated) onPostUpdated();
      }
    } catch (err) {
      alert(err.message || 'Failed to delete discussion');
    } finally {
      setActionLoading(false);
    }
  };

  const handleVotePoll = async (optionIdx) => {
    if (!currentPost.poll || voting) return;
    setVoting(true);
    try {
      const res = await pollsApi.vote(currentPost.poll._id, optionIdx);
      if (res.success) {
        setCurrentPost({
          ...currentPost,
          poll: res.data,
        });
        if (onVotePollSuccess) onVotePollSuccess(res.data);
      }
    } catch (err) {
      alert(err.message || 'Could not record vote');
    } finally {
      setVoting(false);
    }
  };

  const author = currentPost.author || {};
  const community = currentPost.community || {};
  const attachments = currentPost.attachments || [];
  const folders = currentPost.folders || [];
  const poll = currentPost.poll;

  const isPostAuthor = Boolean(
    user && author._id && user._id.toString() === author._id.toString()
  );
  // Granular server-provided permissions (never inferred from role client-side).
  // modPermissions comes from the community payload; per-post flags come from getPostById.
  const perms = modPermissions || currentPost.moderationPermissions || null;
  const canPinThisPost = Boolean(perms?.pin || user?.role === 'admin');
  const canLockThisPost = Boolean(perms?.lock || user?.role === 'admin');
  const canDeletePost = Boolean(isPostAuthor || perms?.delete || user?.role === 'admin');

  // Group attachments
  const videoAttachments = attachments.filter((a) => a.type === 'video');
  const imageAttachments = attachments.filter((a) => a.type === 'image');
  const fileAttachments = attachments.filter((a) => a.type === 'file' && !a.folder);
  const folderFiles = attachments.filter((a) => a.folder || a.folderRelativePath);

  const totalPollVotes =
    poll?.options?.reduce((acc, curr) => acc + (curr.votesCount || 0), 0) || 0;

  const isDeletedPost = currentPost.isDeleted || currentPost.status === 'deleted' || currentPost.status === 'removed';

  if (isDeletedPost) {
    return (
      <article className="post-card" style={{ opacity: 0.8, backgroundColor: 'var(--bg-secondary, #f8fafc)', padding: '16px 20px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text-muted, #64748b)', fontStyle: 'italic', fontSize: '0.9rem' }}>
          <span>🗑️</span>
          <span>[This discussion was deleted or removed by community moderation.]</span>
        </div>
      </article>
    );
  }

  return (
    <article className="post-card">
      {/* Pinned Announcement Header (Point 7) */}
      {currentPost.isPinned && (
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
          <span>📌 Pinned in {community.name || 'Community'}</span>
        </div>
      )}

      {/* Header */}
      <div className="post-header">
        <div className="post-author-meta">
          <Link to={`/profile/${author._id || 'user'}`}>
            <img
              src={
                author.avatar ||
                'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100'
              }
              alt={author.name}
              className="post-avatar"
            />
          </Link>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
              <Link
                to={`/profile/${author._id || 'user'}`}
                style={{ fontWeight: 700, fontSize: '0.925rem', color: 'var(--text-main)' }}
              >
                {currentPost.isAnonymous ? 'Anonymous Member' : author.name}
              </Link>
              {author.verified && (
                <span
                  title="Verified Student"
                  style={{ color: '#3b82f6', display: 'flex', alignItems: 'center' }}
                >
                  <Icon name="checkCircle2" size={14} color="#3b82f6" />
                </span>
              )}
              {community?.name ? (
                <Link to={`/communities/${community.slug || community._id}`}>
                  <span className="badge badge-primary" style={{ fontSize: '0.7rem' }}>
                    {community.name}
                  </span>
                </Link>
              ) : (
                <span className="badge badge-accent" style={{ fontSize: '0.7rem' }}>
                  🌐 Campus-Wide
                </span>
              )}
            </div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
              {currentPost.isAnonymous
                ? 'Geeta University'
                : author.year || author.department || 'Student'}{' '}
              • {new Date(currentPost.createdAt).toLocaleDateString()}
            </div>
          </div>
        </div>

        {/* Post Type & State Badges (Point 4) */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
          {currentPost.status === 'locked' && (
            <span
              className="badge"
              style={{ backgroundColor: '#fee2e2', color: '#991b1b', fontSize: '0.7rem' }}
            >
              🔒 Locked
            </span>
          )}
          {currentPost.status === 'pending' && (
            <span
              className="badge"
              style={{ backgroundColor: '#fef3c7', color: '#92400e', fontSize: '0.7rem' }}
            >
              ⏳ Pending Approval
            </span>
          )}
          {currentPost.status === 'rejected' && (
            <span
              className="badge"
              style={{ backgroundColor: '#fee2e2', color: '#b91c1c', fontSize: '0.7rem' }}
            >
              ❌ Rejected
            </span>
          )}
          {currentPost.type === 'resource' && <span className="badge badge-accent">Resource</span>}
          {currentPost.type === 'question' && <span className="badge badge-primary">Question</span>}
          {currentPost.type === 'announcement' && (
            <span className="badge badge-danger">Official</span>
          )}
          {currentPost.type === 'discussion' && (
            <span className="badge badge-muted">Discussion</span>
          )}

          {/* Action controls (Pin/Lock require exact delegations; Delete for author/delegate) */}
          <div style={{ display: 'flex', gap: '4px', marginLeft: '4px' }}>
            {canPinThisPost && (
              <button
                className="btn btn-secondary btn-sm"
                style={{ padding: '2px 7px', fontSize: '0.675rem' }}
                onClick={handleTogglePin}
                title={currentPost.isPinned ? 'Unpin post' : 'Pin post'}
                disabled={actionLoading}
              >
                {currentPost.isPinned ? 'Unpin' : '📌 Pin'}
              </button>
            )}
            {canLockThisPost && (
              <button
                className="btn btn-secondary btn-sm"
                style={{ padding: '2px 7px', fontSize: '0.675rem' }}
                onClick={handleToggleLock}
                title={currentPost.status === 'locked' ? 'Unlock comments' : 'Lock comments'}
                disabled={actionLoading}
              >
                {currentPost.status === 'locked' ? 'Unlock' : '🔒 Lock'}
              </button>
            )}
            {canDeletePost && (
              <button
                className="btn btn-outline btn-sm"
                style={{ padding: '2px 7px', fontSize: '0.675rem', color: '#ef4444', borderColor: '#fca5a5' }}
                onClick={handleDeletePost}
                title="Delete discussion"
                disabled={actionLoading}
              >
                Delete
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Title & Body */}
      <Link to={`/discussions/${currentPost._id}`}>
        <h2 className="post-title">{currentPost.title}</h2>
      </Link>
      <div className="post-body-snippet">{currentPost.body}</div>

      {/* Tags */}
      {currentPost.tags && currentPost.tags.length > 0 && (
        <div className="post-tags">
          {currentPost.tags.map((t, idx) => (
            <span key={idx} className="tag-pill">
              #{t}
            </span>
          ))}
        </div>
      )}

      {/* ATTACHMENT SECTION: ONE post containing all attachments in the SAME post */}
      {(attachments.length > 0 || folders.length > 0 || poll) && (
        <div className="attachments-gallery">
          <div
            style={{
              fontSize: '0.8rem',
              fontWeight: 700,
              color: 'var(--text-main)',
              marginBottom: '8px',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
            }}
          >
            <Icon name="fileArchive" size={15} color="var(--primary)" />
            <span>
              Post Attachments & Media (
              {attachments.length + (folders.length > 0 ? 1 : 0) + (poll ? 1 : 0)})
            </span>
          </div>

          {/* 1. Video Attachment */}
          {videoAttachments.length > 0 && (
            <div style={{ marginBottom: '12px' }}>
              {videoAttachments.map((vid, idx) => (
                <div key={idx} className="video-player-box">
                  <video
                    controls
                    preload="metadata"
                    className="video-element"
                    poster={vid.metadata?.thumbnail || ''}
                    src={vid.url}
                  >
                    <source src={vid.url} type={vid.mimeType || 'video/mp4'} />
                    Your browser does not support HTML5 video.
                  </video>
                  <div
                    style={{
                      padding: '6px 10px',
                      fontSize: '0.75rem',
                      display: 'flex',
                      justifyContent: 'space-between',
                      background: '#f8fafc',
                    }}
                  >
                    <span>🎬 {vid.originalName}</span>
                    <span>{(vid.size / (1024 * 1024)).toFixed(1)} MB</span>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* 2. Image Attachments */}
          {imageAttachments.length > 0 && (
            <div
              className={`images-grid ${imageAttachments.length > 1 ? 'images-grid-multi' : ''}`}
            >
              {imageAttachments.map((img, idx) => (
                <div key={idx} className="image-attachment-wrapper">
                  <img src={img.url} alt={img.originalName} className="image-attachment-img" />
                </div>
              ))}
            </div>
          )}

          {/* 3. Document / File Attachments */}
          {fileAttachments.length > 0 && (
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: '8px',
                marginBottom: '12px',
              }}
            >
              {fileAttachments.map((file, idx) => (
                <a
                  key={idx}
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
                  <div className="btn btn-secondary" style={{ padding: '6px 12px', fontSize: '0.8rem' }}>
                    Download
                  </div>
                </a>
              ))}
            </div>
          )}

          {/* 4. Code Folder Hierarchy Display */}
          {folders.length > 0 && (
            <div className="folder-viewer-box">
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
                <span>Code Folder Hierarchy (Attached Project)</span>
              </div>
              <div className="folder-tree">
                {folders.map((f, idx) => (
                  <div key={idx} style={{ paddingLeft: '8px', marginBottom: '4px' }}>
                    <div style={{ fontWeight: 600, display: 'flex', alignItems: 'center', gap: '6px' }}>
                      📁 {f.relativePath || f.name}
                    </div>
                    {/* Render files in this folder */}
                    <div style={{ paddingLeft: '20px' }}>
                      {folderFiles
                        .filter((att) => att.folder === f._id || att.folderRelativePath === f.relativePath)
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

          {/* 5. Poll Widget (Interactive) */}
          {poll && (
            <div className="poll-container">
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
                      <span className="poll-option-text" style={{ fontWeight: isVoted ? 700 : 500 }}>
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

      {/* Post Actions Footer */}
      <div className="post-actions-bar">
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          {/* Like */}
          <button
            className={`post-action-btn ${currentPost.isLiked ? 'active-like' : ''}`}
            onClick={handleLike}
            title="Like this discussion"
            disabled={isLiking}
          >
            <Icon
              name="heart"
              size={16}
              color={currentPost.isLiked ? '#ef4444' : 'currentColor'}
            />
            <span>{currentPost.likesCount ?? (currentPost.likes?.length || 0)}</span>
          </button>

          {/* Comments */}
          <Link to={`/discussions/${currentPost._id}`} className="post-action-btn">
            <Icon name="messageSquare" size={16} />
            <span>{currentPost.commentsCount || 0} Comments</span>
          </Link>

          {/* Helpful */}
          <button
            className={`post-action-btn ${currentPost.isHelpful ? 'active-helpful' : ''}`}
            onClick={handleHelpful}
            title="Vote as Helpful"
            disabled={isHelpfulVoting}
          >
            <Icon
              name="award"
              size={16}
              color={currentPost.isHelpful ? 'var(--primary)' : 'currentColor'}
            />
            <span>Helpful ({currentPost.helpfulCount ?? (currentPost.helpfulVotes?.length || 0)})</span>
          </button>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          {/* Share */}
          <button
            className="post-action-btn"
            onClick={() => {
              if (actionLoading) return;
              setActionLoading(true);
              // Check if the source community has sharing disabled
              const sharePolicy = post.community?.permissions?.sharePolicy;
              const shareTarget = sharePolicy === 'DISABLED' ? null : undefined;
              postsApi
                .share(currentPost._id, {
                  targetCommunityId: shareTarget,
                })
                .then((res) => {
                  if (res.success) {
                    alert('Discussion shared successfully!');
                    setCurrentPost((prev) => ({
                      ...prev,
                      shareMessage: 'Shared',
                    }));
                    if (onPostUpdated) onPostUpdated();
                  } else {
                    alert(res.message || 'Failed to share.');
                  }
                })
                .catch((err) => {
                  alert(err.message || 'Failed to share.');
                })
                .finally(() => {
                  setActionLoading(false);
                });
            }}
            title="Share Discussion"
            disabled={actionLoading || post.community?.permissions?.sharePolicy === 'DISABLED'}
          >
            <Icon name="share2" size={16} />
            <span>Share</span>
          </button>

          {/* Save */}
          <button
            className={`post-action-btn ${currentPost.isSaved ? 'active-save' : ''}`}
            onClick={handleSave}
            title="Save for later"
            disabled={isSaving}
          >
            <Icon
              name="bookmark"
              size={16}
              color={currentPost.isSaved ? '#f59e0b' : 'currentColor'}
            />
            <span>{currentPost.isSaved ? 'Saved' : 'Save'}</span>
          </button>
        </div>
      </div>
    </article>
  );
};

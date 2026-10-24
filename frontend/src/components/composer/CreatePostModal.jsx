import React, { useState, useEffect, useRef } from 'react';
import { Icon } from '../common/Icons';
import { communitiesApi, postsApi, uploadsApi } from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import { RequestToPostModal } from '../community/RequestToPostModal';

// The audience selector only ever holds a community id string, or '' for
// Global/Campus-Wide (community = null). Anything that is not a non-empty
// string (e.g. a React click event that leaked in from an onClick handler)
// is coerced to '' so no object can ever reach an ObjectId/null field.
const sanitizeCommunityId = (value) => (typeof value === 'string' ? value : '');

// Post policy labels for UI display
const postPolicyLabels = {
  'EVERYONE': 'Open to all',
  'MEMBERS': 'Members Only',
  'APPROVED_USERS': 'Approved Users Only',
  'HEAD_MODS': 'Head & Mods Only',
  'CUSTOM': 'Custom (select users)',
};

const GLOBAL_PERMISSION_INFO = {
  community: null,
  permission: { allowed: true, requireApproval: false, reason: 'Campus-wide discussion: Open to all members' },
};

export const CreatePostModal = ({ isOpen, onClose, initialCommunityId = null, onPostCreated }) => {
  const { user } = useAuth();
  const [communities, setCommunities] = useState([]);
  const [selectedCommunityId, setSelectedCommunityId] = useState(() => sanitizeCommunityId(initialCommunityId));
  const [permissionInfo, setPermissionInfo] = useState(() =>
    sanitizeCommunityId(initialCommunityId) ? null : GLOBAL_PERMISSION_INFO
  );
  const [checkingPermission, setCheckingPermission] = useState(false);
  // Monotonic token so an in-flight permission lookup for a previously selected
  // community can never overwrite the state of the currently selected one.
  const permissionRequestRef = useRef(0);

  // Post form state
  const [activeTab, setActiveTab] = useState('edit'); // 'edit' | 'preview'
  const [postType, setPostType] = useState('discussion');
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [tagInput, setTagInput] = useState('');
  const [tags, setTags] = useState(['DSA', 'Placements']);
  const [isAnonymous, setIsAnonymous] = useState(false);
  const [allowComments, setAllowComments] = useState(true);
  const [isQuestion, setIsQuestion] = useState(false);

  // Attachment Dropdown State
  const [showAttachmentMenu, setShowAttachmentMenu] = useState(false);
  const [showLinkInput, setShowLinkInput] = useState(false);
  const [showPollBuilder, setShowPollBuilder] = useState(false);
  const [linkUrl, setLinkUrl] = useState('');
  const [linkTitle, setLinkTitle] = useState('');
  const [linkPreview, setLinkPreview] = useState(null);

  // Poll state
  const [pollQuestion, setPollQuestion] = useState('');
  const [pollOptions, setPollOptions] = useState(['', '']);

  // Staged multi-attachments
  const [attachments, setAttachments] = useState([]);
  const [folderPaths, setFolderPaths] = useState([]);
  const [poll, setPoll] = useState(null);

  // Hidden File Inputs
  const imageInputRef = useRef(null);
  const videoInputRef = useRef(null);
  const fileInputRef = useRef(null);

  // Modals & submission state
  const [showRequestModal, setShowRequestModal] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState(null);

  // Load communities
  useEffect(() => {
    if (isOpen) {
      const nextId = sanitizeCommunityId(initialCommunityId);
      setSelectedCommunityId(nextId);
      // Never carry permission state over from the previously selected audience.
      setPermissionInfo(nextId ? null : GLOBAL_PERMISSION_INFO);
      refreshPermission(nextId);
      communitiesApi.getAll().then((res) => {
        if (res.success && res.data) {
          setCommunities(res.data);
        }
      }).catch(() => {});
    }
  }, [isOpen, initialCommunityId]);

  const refreshPermission = async (communityId) => {
    const seq = ++permissionRequestRef.current;
    const targetId = sanitizeCommunityId(communityId);

    // Global / Campus-Wide: community = null, no membership required.
    if (!targetId) {
      setCheckingPermission(false);
      setPermissionInfo(GLOBAL_PERMISSION_INFO);
      return;
    }

    setCheckingPermission(true);
    try {
      const res = await communitiesApi.getById(targetId);
      if (seq !== permissionRequestRef.current) return; // stale response
      if (res.success && res.data) {
        setPermissionInfo({
          community: res.data,
          permission: res.data.currentUserPermission || { allowed: false, reason: 'Not logged in' },
        });
      }
    } catch {
      if (seq !== permissionRequestRef.current) return; // stale response
      setPermissionInfo(null);
    } finally {
      if (seq === permissionRequestRef.current) setCheckingPermission(false);
    }
  };

  useEffect(() => {
    refreshPermission(selectedCommunityId);
  }, [selectedCommunityId, user]);

  const handleQuickJoin = async () => {
    if (!user) {
      alert('Please log in first or select a demo persona from the top right menu.');
      return;
    }
    if (!sanitizeCommunityId(selectedCommunityId)) return;
    try {
      const res = await communitiesApi.join(sanitizeCommunityId(selectedCommunityId));
      if (res.success) {
        // Private communities return pending:true until a moderator approves
        if (res.pending) {
          alert(res.message || 'Your join request was sent to the community moderators for approval.');
        }
        refreshPermission(selectedCommunityId);
      }
    } catch (err) {
      alert(err.message || 'Failed to join community');
      refreshPermission(selectedCommunityId);
    }
  };

  // Escape closes the topmost layer: nested request modal first, then composer.
  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e) => {
      if (e.key !== 'Escape') return;
      if (showRequestModal) setShowRequestModal(false);
      else onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isOpen, showRequestModal, onClose]);

  if (!isOpen) return null;

  // Add tag handler
  const handleAddTag = () => {
    if (tagInput.trim() && !tags.includes(tagInput.trim())) {
      setTags([...tags, tagInput.trim()]);
      setTagInput('');
    }
  };

  const handleRemoveTag = (t) => {
    setTags(tags.filter((item) => item !== t));
  };

  // Upload handler for files / images / videos
  const handleFileUpload = async (e, forcedType) => {
    const files = Array.from(e.target.files);
    if (!files.length) return;

    setUploading(true);
    setError(null);

    const formData = new FormData();
    files.forEach((file) => {
      formData.append('files', file);
    });

    try {
      const res = await uploadsApi.uploadMultiple(formData);
      if (res.success && res.data) {
        const mapped = res.data.map((item) => ({
          type: forcedType || item.type,
          originalName: item.originalName,
          mimeType: item.mimeType,
          size: item.size,
          storageKey: item.filename,
          url: item.url,
          relativePath: item.originalName,
        }));

        setAttachments((prev) => [...prev, ...mapped]);
      }
    } catch (err) {
      setError(err.message || 'File upload failed');
    } finally {
      setUploading(false);
      setShowAttachmentMenu(false);
      // Reset input value so same file can be re-selected if needed
      e.target.value = '';
    }
  };

  const handleSaveLink = () => {
    if (linkUrl.trim()) {
      const formattedUrl = linkUrl.startsWith('http') ? linkUrl.trim() : `https://${linkUrl.trim()}`;
      setLinkPreview({
        url: formattedUrl,
        title: linkTitle.trim() || formattedUrl,
        description: 'External resource shared via Geeta University discussion forum.',
      });
      setShowLinkInput(false);
      setLinkUrl('');
      setLinkTitle('');
    }
  };

  const handleSavePoll = () => {
    const cleanOptions = pollOptions.map((o) => o.trim()).filter(Boolean);
    if (pollQuestion.trim() && cleanOptions.length >= 2) {
      setPoll({
        question: pollQuestion.trim(),
        options: cleanOptions,
      });
      setShowPollBuilder(false);
      setPollQuestion('');
      setPollOptions(['', '']);
    } else {
      alert('Poll requires a question and at least 2 non-empty options.');
    }
  };

  const handleAddFolderPrompt = () => {
    const folderName = prompt('Enter Folder Name (e.g. Code_Examples, Lab_Manuals):', 'Project_Files');
    if (folderName && folderName.trim()) {
      const cleanFolder = folderName.trim();
      if (!folderPaths.includes(cleanFolder)) {
        setFolderPaths((prev) => [...prev, cleanFolder]);
      }
      setShowAttachmentMenu(false);
    }
  };

  const handlePublish = async () => {
    if (!title.trim() || !body.trim()) {
      setError('Please provide a title and body description.');
      return;
    }

    setSubmitting(true);
    setError(null);

    // Global / Campus-Wide sends community = null. An id string is the only
    // other accepted shape - never an object.
    const targetCommunityId = sanitizeCommunityId(selectedCommunityId);

    const payload = {
      community: targetCommunityId || null,
      type: postType,
      title: title.trim(),
      body: body.trim(),
      tags,
      isAnonymous,
      allowComments,
      isQuestion,
      attachments,
      folderPaths,
      poll: poll && poll.question && poll.options?.length >= 2 ? poll : null,
      linkPreview,
    };

    try {
      const res = await postsApi.create(payload);
      if (res.success) {
        alert(res.message || 'Post published successfully!');
        if (onPostCreated) onPostCreated(res.data);
        onClose();
      }
    } catch (err) {
      if (err.status === 403 && err.data?.canRequest) {
        setShowRequestModal(true);
      } else {
        setError(err.message || 'Failed to publish post');
      }
    } finally {
      setSubmitting(false);
    }
  };

  const isAllowed = permissionInfo?.permission?.allowed;
  const requireApproval = permissionInfo?.permission?.requireApproval;
  const currentComm = permissionInfo?.community;

  return (
    <>
      {/* Hidden File Inputs for Attachment Types */}
      <input
        type="file"
        ref={imageInputRef}
        multiple
        accept="image/*"
        style={{ display: 'none' }}
        onChange={(e) => handleFileUpload(e, 'image')}
      />
      <input
        type="file"
        ref={videoInputRef}
        accept="video/*"
        style={{ display: 'none' }}
        onChange={(e) => handleFileUpload(e, 'video')}
      />
      <input
        type="file"
        ref={fileInputRef}
        multiple
        accept=".pdf,.doc,.docx,.zip,.txt,.ppt,.pptx,.xls,.xlsx"
        style={{ display: 'none' }}
        onChange={(e) => handleFileUpload(e, 'file')}
      />

      <div
        className="modal-overlay"
        id="create-post-modal"
        onClick={(e) => {
          if (e.target === e.currentTarget) onClose();
        }}
      >
        <div className="modal-content">
          {/* Header */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'nowrap', rowGap: '10px', padding: '16px 24px', borderBottom: '1px solid var(--border-color)', position: 'sticky', top: 0, flexShrink: 0, background: '#ffffff', zIndex: 2 }}>
            <div style={{ minWidth: 0 }}>
              <h2 style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--text-main)' }}>Create a Discussion</h2>
              <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', width: '100%' }}>
                Share ideas, ask questions, or post study materials to Geeta University.
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <div style={{ display: 'flex', background: 'var(--bg-muted)', borderRadius: 'var(--radius-md)', padding: '2px' }}>
                <button
                  type="button"
                  className={`btn btn-sm ${activeTab === 'edit' ? 'btn-primary' : ''}`}
                  onClick={() => setActiveTab('edit')}
                  style={{ borderRadius: 'var(--radius-sm)' }}
                >
                  Edit
                </button>
                <button
                  type="button"
                  className={`btn btn-sm ${activeTab === 'preview' ? 'btn-primary' : ''}`}
                  onClick={() => setActiveTab('preview')}
                  style={{ borderRadius: 'var(--radius-sm)' }}
                >
                  Preview
                </button>
              </div>
              <button className="btn-icon" onClick={onClose}><Icon name="x" size={20} /></button>
            </div>
          </div>

          <div style={{ padding: '20px 24px' }}>
            {/* Community Selector + Permission Indicator */}
            <div className="audience-selector" style={{ gap: '12px', alignItems: 'center', marginBottom: '16px', padding: '12px', background: 'var(--bg-muted)', borderRadius: 'var(--radius-md)', minWidth: 0, maxWidth: '100%' }}>
              <div style={{ minWidth: 0 }}>
                <label style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '4px', display: 'block' }}>
                  Target Audience / Community (Optional)
                </label>
                <select
                  className="form-control"
                  value={selectedCommunityId}
                  onChange={(e) => setSelectedCommunityId(e.target.value)}
                  style={{ fontWeight: 600, background: '#fff', minWidth: 0 }}
                >
                  <option value="">🌐 Campus-Wide (Global Discussion • Open to all)</option>
                  {communities.map((c) => (
                    <option key={c._id} value={c._id}>
                      {c.name} {c.permissions?.visibility === 'MEMBERS_ONLY' ? '(Private 🔒)' : '(Public 🌐)'}
                    </option>
                  ))}
                </select>
              </div>

              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: '0.725rem', fontWeight: 700, color: 'var(--text-muted)', marginBottom: '4px' }}>
                  Posting Permission
                </div>
                {checkingPermission ? (
                  <span className="badge badge-muted">Checking policy...</span>
                ) : !selectedCommunityId ? (
                  /* Global / Campus-Wide: community = null, no membership required */
                  <span className="badge badge-success" style={{ gap: '6px' }}>
                    <Icon name="users" size={12} />
                    <span>🌐 Open to all</span>
                  </span>
                ) : isAllowed ? (
                  requireApproval ? (
                    <span className="badge badge-warning" style={{ gap: '6px' }}>
                      <Icon name="clock" size={12} />
                      <span>Pending Admin Approval</span>
                    </span>
                  ) : (
                    <span className="badge badge-success" style={{ gap: '6px' }}>
                      <Icon name="check" size={12} />
                      <span>Direct Publish Allowed</span>
                    </span>
                  )
                ) : (
                  <span className="badge badge-danger" style={{ gap: '6px' }}>
                    <Icon name="lock" size={12} />
                    <span>
                      {postPolicyLabels[currentComm?.permissions?.postPolicy] ||
                        currentComm?.permissions?.postPolicy ||
                        'Restricted'}
                    </span>
                  </span>
                )}
              </div>
            </div>

            {/* Notice banner for restricted / private community */}
            {!isAllowed && !checkingPermission && currentComm && (
              <div style={{ background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 'var(--radius-md)', padding: '12px 16px', marginBottom: '16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '10px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <Icon name="info" size={20} color="#d97706" />
                  <div style={{ fontSize: '0.825rem', color: '#92400e' }}>
                    <strong>
                      {postPolicyLabels[currentComm?.permissions?.postPolicy] || 'Posting Restricted:'}{' '}
                    </strong>
                    {permissionInfo?.permission?.reason}
                  </div>
                </div>
                {currentComm?.permissions?.postPolicy === 'HEAD_MODS' ? (
                  currentComm?.permissions?.allowPostRequests && (
                    <button
                      type="button"
                      className="btn btn-warning btn-sm"
                      onClick={() => setShowRequestModal(true)}
                    >
                      Request to Post
                    </button>
                  )
                ) : (
                  currentComm?.permissions?.status === 'rejected' || currentComm?.currentUserMembership?.status === 'rejected' ? (
                    <div style={{ color: '#991b1b', fontSize: '0.825rem', fontWeight: 600 }}>
                      Join request rejected — you may request again
                    </div>
                  ) : (
                    <button
                      type="button"
                      className="btn btn-primary btn-sm"
                      onClick={handleQuickJoin}
                    >
                      {currentComm?.permissions?.status === 'pending' || currentComm?.currentUserMembership?.status === 'pending'
                        ? '🔒 Request to Join'
                        : '+ Join Community to Post'}
                    </button>
                  )
                )}
              </div>
            )}

            {error && (
              <div style={{ background: '#fef2f2', border: '1px solid #fecaca', color: '#ef4444', padding: '10px', borderRadius: 'var(--radius-md)', fontSize: '0.825rem', marginBottom: '16px' }}>
                {error}
              </div>
            )}

            {/* TAB: EDIT */}
            {activeTab === 'edit' ? (
              <>
                {/* Title */}
                <div className="form-group">
                  <input
                    type="text"
                    className="form-control"
                    placeholder="Discussion title (e.g. Complete DSA Roadmap for Placements)..."
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    style={{ fontSize: '1.05rem', fontWeight: 700, padding: '12px 14px' }}
                  />
                </div>

                {/* Toolbar (wraps on narrow screens so it never overflows the modal) */}
                <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '6px', padding: '6px 10px', background: 'var(--bg-muted)', border: '1px solid var(--border-color)', borderBottom: 'none', borderRadius: 'var(--radius-md) var(--radius-md) 0 0' }}>
                  <button type="button" className="btn-icon" onClick={() => setBody((prev) => prev + '**Bold Text**')} title="Bold"><strong>B</strong></button>
                  <button type="button" className="btn-icon" onClick={() => setBody((prev) => prev + '*Italic Text*')} title="Italic"><em>I</em></button>
                  <button type="button" className="btn-icon" onClick={() => setBody((prev) => prev + '\n```cpp\n// Code snippet\n```\n')} title="Code">&lt;/&gt;</button>
                  <button type="button" className="btn-icon" onClick={() => setBody((prev) => prev + '\n- Bullet point')} title="List">• List</button>
                  <button type="button" className="btn-icon" onClick={() => setBody((prev) => prev + '\n> Quote\n')} title="Quote">”</button>
                  <div style={{ height: 18, width: 1, background: 'var(--border-color)', margin: '0 4px' }} />
                  <select
                    className="form-control"
                    value={postType}
                    onChange={(e) => setPostType(e.target.value)}
                    style={{ width: 'auto', padding: '3px 8px', fontSize: '0.8rem', height: '30px' }}
                  >
                    <option value="discussion">Type: Discussion</option>
                    <option value="resource">Type: Resource</option>
                    <option value="question">Type: Question</option>
                    <option value="announcement">Type: Announcement</option>
                  </select>
                </div>

                {/* Body Textarea */}
                <div className="form-group" style={{ marginBottom: '16px' }}>
                  <textarea
                    className="form-control"
                    rows={6}
                    placeholder="Share details, questions, or resources..."
                    value={body}
                    onChange={(e) => setBody(e.target.value)}
                    style={{ borderRadius: '0 0 var(--radius-md) var(--radius-md)', resize: 'vertical' }}
                  />
                </div>

                {/* SINGLE "+ Add Attachment" BUTTON & MENU (Section 6 Requirement) */}
                <div style={{ border: '1px solid var(--border-color)', borderRadius: 'var(--radius-md)', padding: '14px', background: '#fafafa', marginBottom: '16px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '10px' }}>
                    <div style={{ position: 'relative' }}>
                      <button
                        type="button"
                        className="btn btn-primary btn-sm"
                        onClick={() => setShowAttachmentMenu(!showAttachmentMenu)}
                        style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', padding: '7px 16px', fontWeight: 600 }}
                      >
                        <Icon name="plus" size={16} />
                        <span>+ Add Attachment</span>
                        <Icon name="chevronDown" size={14} />
                      </button>

                      {/* Attachment Options Menu */}
                      {showAttachmentMenu && (
                        <div
                          style={{
                            position: 'absolute',
                            left: 0,
                            top: '115%',
                            background: '#ffffff',
                            border: '1px solid var(--border-color)',
                            borderRadius: 'var(--radius-md)',
                            boxShadow: 'var(--shadow-lg)',
                            width: '210px',
                            padding: '6px',
                            zIndex: 100,
                            display: 'flex',
                            flexDirection: 'column',
                            gap: '2px',
                          }}
                        >
                          <button
                            type="button"
                            className="btn btn-sm"
                            style={{ justifyContent: 'flex-start', background: 'transparent', border: 'none', padding: '8px 12px', fontSize: '0.825rem' }}
                            onClick={() => {
                              setShowAttachmentMenu(false);
                              imageInputRef.current?.click();
                            }}
                          >
                            <span style={{ marginRight: '8px' }}>🖼️</span>
                            <span>Image</span>
                          </button>
                          <button
                            type="button"
                            className="btn btn-sm"
                            style={{ justifyContent: 'flex-start', background: 'transparent', border: 'none', padding: '8px 12px', fontSize: '0.825rem' }}
                            onClick={() => {
                              setShowAttachmentMenu(false);
                              videoInputRef.current?.click();
                            }}
                          >
                            <span style={{ marginRight: '8px' }}>🎬</span>
                            <span>Video</span>
                          </button>
                          <button
                            type="button"
                            className="btn btn-sm"
                            style={{ justifyContent: 'flex-start', background: 'transparent', border: 'none', padding: '8px 12px', fontSize: '0.825rem' }}
                            onClick={() => {
                              setShowAttachmentMenu(false);
                              fileInputRef.current?.click();
                            }}
                          >
                            <span style={{ marginRight: '8px' }}>📄</span>
                            <span>File (PDF/Doc/Zip)</span>
                          </button>
                          <button
                            type="button"
                            className="btn btn-sm"
                            style={{ justifyContent: 'flex-start', background: 'transparent', border: 'none', padding: '8px 12px', fontSize: '0.825rem' }}
                            onClick={handleAddFolderPrompt}
                          >
                            <span style={{ marginRight: '8px' }}>📁</span>
                            <span>Folder</span>
                          </button>
                          <button
                            type="button"
                            className="btn btn-sm"
                            style={{ justifyContent: 'flex-start', background: 'transparent', border: 'none', padding: '8px 12px', fontSize: '0.825rem' }}
                            onClick={() => {
                              setShowAttachmentMenu(false);
                              setShowLinkInput(true);
                            }}
                          >
                            <span style={{ marginRight: '8px' }}>🔗</span>
                            <span>Link</span>
                          </button>
                          <button
                            type="button"
                            className="btn btn-sm"
                            style={{ justifyContent: 'flex-start', background: 'transparent', border: 'none', padding: '8px 12px', fontSize: '0.825rem' }}
                            onClick={() => {
                              setShowAttachmentMenu(false);
                              setShowPollBuilder(true);
                            }}
                          >
                            <span style={{ marginRight: '8px' }}>📊</span>
                            <span>Poll</span>
                          </button>
                        </div>
                      )}
                    </div>

                    {uploading && <span style={{ fontSize: '0.8rem', color: 'var(--primary)', fontWeight: 600 }}>Uploading media...</span>}
                  </div>

                  {/* Inline Link Input Box */}
                  {showLinkInput && (
                    <div style={{ marginTop: '12px', padding: '12px', background: '#ffffff', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-sm)' }}>
                      <div style={{ fontWeight: 700, fontSize: '0.85rem', marginBottom: '8px' }}>Attach Web Link:</div>
                      <input
                        type="url"
                        className="form-control"
                        placeholder="https://example.com/article"
                        value={linkUrl}
                        onChange={(e) => setLinkUrl(e.target.value)}
                        style={{ marginBottom: '6px' }}
                      />
                      <input
                        type="text"
                        className="form-control"
                        placeholder="Link Title / Description (optional)"
                        value={linkTitle}
                        onChange={(e) => setLinkTitle(e.target.value)}
                        style={{ marginBottom: '8px' }}
                      />
                      <div style={{ display: 'flex', gap: '8px' }}>
                        <button type="button" className="btn btn-primary btn-sm" onClick={handleSaveLink}>Attach Link</button>
                        <button type="button" className="btn btn-secondary btn-sm" onClick={() => setShowLinkInput(false)}>Cancel</button>
                      </div>
                    </div>
                  )}

                  {/* Inline Poll Builder Box */}
                  {showPollBuilder && (
                    <div style={{ marginTop: '12px', padding: '12px', background: '#ffffff', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-sm)' }}>
                      <div style={{ fontWeight: 700, fontSize: '0.85rem', marginBottom: '8px' }}>Create Poll:</div>
                      <input
                        type="text"
                        className="form-control"
                        placeholder="Poll Question (e.g. Which topic should we revise next?)"
                        value={pollQuestion}
                        onChange={(e) => setPollQuestion(e.target.value)}
                        style={{ marginBottom: '8px' }}
                      />
                      {pollOptions.map((opt, i) => (
                        <div key={i} style={{ display: 'flex', gap: '6px', marginBottom: '6px' }}>
                          <input
                            type="text"
                            className="form-control"
                            placeholder={`Option ${i + 1}`}
                            value={opt}
                            onChange={(e) => {
                              const updated = [...pollOptions];
                              updated[i] = e.target.value;
                              setPollOptions(updated);
                            }}
                          />
                          {pollOptions.length > 2 && (
                            <button
                              type="button"
                              className="btn btn-secondary btn-sm"
                              onClick={() => setPollOptions(pollOptions.filter((_, idx) => idx !== i))}
                            >
                              ✕
                            </button>
                          )}
                        </div>
                      ))}
                      {pollOptions.length < 6 && (
                        <button
                          type="button"
                          className="btn btn-outline btn-sm"
                          onClick={() => setPollOptions([...pollOptions, ''])}
                          style={{ marginBottom: '8px' }}
                        >
                          + Add Option
                        </button>
                      )}
                      <div style={{ display: 'flex', gap: '8px', marginTop: '4px' }}>
                        <button type="button" className="btn btn-primary btn-sm" onClick={handleSavePoll}>Attach Poll</button>
                        <button type="button" className="btn btn-secondary btn-sm" onClick={() => setShowPollBuilder(false)}>Cancel</button>
                      </div>
                    </div>
                  )}

                  {/* Staged Attachments Display */}
                  {(attachments.length > 0 || folderPaths.length > 0 || linkPreview || poll) && (
                    <div style={{ marginTop: '14px', borderTop: '1px solid var(--border-color)', paddingTop: '10px' }}>
                      <div style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', marginBottom: '8px' }}>
                        Attached Items:
                      </div>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                        {attachments.map((att, idx) => (
                          <div
                            key={idx}
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '6px',
                              padding: '5px 10px',
                              background: '#ffffff',
                              border: '1px solid var(--border-color)',
                              borderRadius: 'var(--radius-sm)',
                              fontSize: '0.8rem',
                            }}
                          >
                            <span>{att.type === 'video' ? '🎬' : att.type === 'image' ? '🖼️' : '📄'}</span>
                            <span>{att.originalName}</span>
                            <button
                              type="button"
                              onClick={() => setAttachments(attachments.filter((_, i) => i !== idx))}
                              style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: '#ef4444', fontWeight: 700, marginLeft: '4px' }}
                            >
                              ✕
                            </button>
                          </div>
                        ))}

                        {folderPaths.map((fName, idx) => (
                          <div
                            key={idx}
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '6px',
                              padding: '5px 10px',
                              background: '#ffffff',
                              border: '1px solid var(--border-color)',
                              borderRadius: 'var(--radius-sm)',
                              fontSize: '0.8rem',
                            }}
                          >
                            <span>📁 {fName}/</span>
                            <button
                              type="button"
                              onClick={() => setFolderPaths(folderPaths.filter((_, i) => i !== idx))}
                              style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: '#ef4444', fontWeight: 700, marginLeft: '4px' }}
                            >
                              ✕
                            </button>
                          </div>
                        ))}

                        {linkPreview && (
                          <div
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '6px',
                              padding: '5px 10px',
                              background: '#ffffff',
                              border: '1px solid var(--border-color)',
                              borderRadius: 'var(--radius-sm)',
                              fontSize: '0.8rem',
                            }}
                          >
                            <span>🔗 {linkPreview.title || linkPreview.url}</span>
                            <button
                              type="button"
                              onClick={() => setLinkPreview(null)}
                              style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: '#ef4444', fontWeight: 700, marginLeft: '4px' }}
                            >
                              ✕
                            </button>
                          </div>
                        )}

                        {poll && (
                          <div
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '6px',
                              padding: '5px 10px',
                              background: '#ffffff',
                              border: '1px solid var(--border-color)',
                              borderRadius: 'var(--radius-sm)',
                              fontSize: '0.8rem',
                            }}
                          >
                            <span>📊 Poll: {poll.question}</span>
                            <button
                              type="button"
                              onClick={() => setPoll(null)}
                              style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: '#ef4444', fontWeight: 700, marginLeft: '4px' }}
                            >
                              ✕
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>

                {/* Tags */}
                <div className="form-group">
                  <label className="form-label">Tags</label>
                  <div style={{ display: 'flex', gap: '8px', marginBottom: '8px' }}>
                    <input
                      type="text"
                      className="form-control"
                      placeholder="Add tag (e.g. DSA, Placements, WebDev)..."
                      value={tagInput}
                      onChange={(e) => setTagInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          handleAddTag();
                        }
                      }}
                    />
                    <button type="button" className="btn btn-secondary btn-sm" onClick={handleAddTag}>
                      Add
                    </button>
                  </div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                    {tags.map((t) => (
                      <span key={t} className="tag-pill" style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                        #{t}
                        <span style={{ cursor: 'pointer' }} onClick={() => handleRemoveTag(t)}>✕</span>
                      </span>
                    ))}
                  </div>
                </div>

                {/* Options */}
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '20px', padding: '12px', background: 'var(--bg-muted)', borderRadius: 'var(--radius-md)', marginBottom: '16px' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.85rem', cursor: 'pointer' }}>
                    <input type="checkbox" checked={isAnonymous} onChange={(e) => setIsAnonymous(e.target.checked)} />
                    <span>Post anonymously</span>
                  </label>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.85rem', cursor: 'pointer' }}>
                    <input type="checkbox" checked={allowComments} onChange={(e) => setAllowComments(e.target.checked)} />
                    <span>Allow comments</span>
                  </label>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.85rem', cursor: 'pointer' }}>
                    <input type="checkbox" checked={isQuestion} onChange={(e) => setIsQuestion(e.target.checked)} />
                    <span>Q&A Mode</span>
                  </label>
                </div>
              </>
            ) : (
              /* TAB: PREVIEW */
              <div style={{ padding: 'var(--ds-space-4)', background: '#f8fafc', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)' }}>
                {/* No uppercase transform: innerText must match visible copy,
                    and sentence case reads better for a micro-label (Taste). */}
                <div style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-light)', marginBottom: '12px' }}>
                  Live Preview
                </div>
                <h3 style={{ fontSize: '1.2rem', fontWeight: 800, marginBottom: '8px' }}>{title || 'Untitled Discussion'}</h3>
                <div style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', whiteSpace: 'pre-line', marginBottom: '14px' }}>
                  {body || 'Discussion body content preview will appear here...'}
                </div>

                {attachments.length > 0 && (
                  <div style={{ padding: '10px', background: '#ffffff', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-color)', marginBottom: '12px' }}>
                    <div style={{ fontSize: '0.75rem', fontWeight: 700, marginBottom: '6px' }}>Attachments ({attachments.length}):</div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                      {attachments.map((a, i) => (
                        <span key={i} className="file-item-pill" style={{ fontSize: '0.75rem', padding: '4px 8px' }}>
                          📄 {a.originalName}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {poll && (
                  <div style={{ padding: '12px', background: '#ffffff', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-color)' }}>
                    <strong>📊 {poll.question}</strong>
                    <div style={{ marginTop: '8px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                      {poll.options.map((opt, i) => (
                        <div key={i} style={{ padding: '6px 10px', background: '#f1f5f9', borderRadius: '4px', fontSize: '0.8rem' }}>
                          {opt}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Footer Actions */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '10px', padding: '16px 24px', borderTop: '1px solid var(--border-color)', background: '#fafafa' }}>
            <button type="button" className="btn btn-secondary" onClick={onClose}>
              Cancel
            </button>

            <div style={{ display: 'flex', gap: '10px' }}>
              {!isAllowed ? (
                currentComm?.permissions?.postPolicy === 'HEAD_MODS' ? (
                  <button
                    type="button"
                    className="btn btn-secondary"
                    disabled
                    style={{ opacity: 0.6, cursor: 'not-allowed' }}
                  >
                    🔒 Head/Moderator Only
                  </button>
                ) : (
                  currentComm?.permissions?.status === 'rejected' || currentComm?.currentUserMembership?.status === 'rejected' ? (
                    <div style={{ color: '#991b1b', fontSize: '0.825rem', fontWeight: 600 }}>
                      Join request rejected — you may request again
                    </div>
                  ) : (
                    <button
                      type="button"
                      className="btn btn-primary"
                      onClick={handleQuickJoin}
                    >
                      {currentComm?.permissions?.status === 'pending' || currentComm?.currentUserMembership?.status === 'pending'
                        ? '🔒 Request to Join'
                        : '+ Join Community to Post'}
                    </button>
                  )
                )
              ) : (
                <button
                  type="button"
                  id="submit-post-btn"
                  className="btn btn-primary"
                  onClick={handlePublish}
                  disabled={submitting}
                  style={{ padding: '10px 24px' }}
                >
                  <Icon name="send" size={16} color="#fff" />
                  <span>{submitting ? 'Publishing...' : requireApproval ? 'Submit for Approval' : 'Post Discussion'}</span>
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      <RequestToPostModal
        isOpen={showRequestModal}
        onClose={() => setShowRequestModal(false)}
        community={currentComm}
        initialTitle={title}
        initialBody={body}
        onSuccess={() => onClose()}
      />
    </>
  );
};

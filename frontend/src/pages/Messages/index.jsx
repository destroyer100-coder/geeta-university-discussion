import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useLocation, useSearchParams } from 'react-router-dom';
import { messagesApi, usersApi, communitiesApi } from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import { Icon } from '../../components/common/Icons';
import { PageHero } from '../../components/common/PageHero';

const getInitials = (name = '') =>
  name.trim().split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]).join('').toUpperCase() || 'U';
const getId = (value) => (value?._id || value || '').toString();
const readMap = (key) => {
  try { return JSON.parse(localStorage.getItem(key) || '{}'); } catch { return {}; }
};
const writeMap = (key, value) => {
  try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* In-memory state still works for this session. */ }
};
const readList = (key) => {
  try { return JSON.parse(localStorage.getItem(key) || '[]'); } catch { return []; }
};
const localPreviewMessage = (message) => ({
  ...message,
  _id: message._id || 'local-message-' + Date.now(),
  createdAt: message.createdAt || new Date().toISOString(),
  isLocalPreview: true,
});

export const MessagesPage = () => {
  const { user } = useAuth();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const routeUser = location.state?.selectedUser || null;
  const requestedUserId = searchParams.get('user');
  const [conversations, setConversations] = useState([]);
  const [groups, setGroups] = useState([]);
  const [selectedUser, setSelectedUser] = useState(null);
  const [selectedGroup, setSelectedGroup] = useState(null);
  const [messages, setMessages] = useState([]);
  const [messageText, setMessageText] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [activeListTab, setActiveListTab] = useState('all');
  const [loading, setLoading] = useState(true);
  const [loadingThread, setLoadingThread] = useState(false);
  const [errorNotice, setErrorNotice] = useState('');
  const [selectedFile, setSelectedFile] = useState(null);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [detailTab, setDetailTab] = useState('info');
  const [mutedGroupIds, setMutedGroupIds] = useState(() => readList('guf-muted-group-preview'));
  const fileInputRef = useRef(null);
  const threadEndRef = useRef(null);

  const loadConversations = async () => {
    setLoading(true);
    setErrorNotice('');
    try {
      const response = await messagesApi.getConversations();
      const serverRows = response?.success && Array.isArray(response.data) ? response.data : [];
      const cachedRows = readList('guf-community-cache').filter((item) => item.isLocalPreview);
      const serverIds = new Set(serverRows.map((item) => String(item._id)));
      const rows = [...cachedRows.filter((item) => !serverIds.has(String(item._id))), ...serverRows];
      setConversations(rows);

      if (requestedUserId) {
        const matching = rows.find((item) => getId(item.user) === requestedUserId);
        if (routeUser && getId(routeUser) === requestedUserId) setSelectedUser(routeUser);
        else if (matching?.user) setSelectedUser(matching.user);
        else {
          try {
            const profile = await usersApi.getProfile(requestedUserId);
            setSelectedUser(profile?.success ? profile.data : null);
          } catch {
            setSelectedUser(null);
          }
        }
        setSelectedGroup(null);
      } else if (!selectedGroup) {
        setSelectedUser((current) => {
          if (current && rows.some((item) => getId(item.user) === getId(current))) {
            return rows.find((item) => getId(item.user) === getId(current)).user;
          }
          return rows[0]?.user || current || null;
        });
      }
    } catch (error) {
      setConversations([]);
      if (requestedUserId && routeUser && getId(routeUser) === requestedUserId) {
        setSelectedUser(routeUser);
        setSelectedGroup(null);
      }
      setErrorNotice(error.message || 'Conversations could not be loaded. You can still use the local preview controls.');
    } finally {
      setLoading(false);
    }
  };

  const loadGroups = async () => {
    try {
      const response = await communitiesApi.getAll();
      const rows = response?.success && Array.isArray(response.data) ? response.data : [];
      const overrides = readMap('guf-community-membership-preview');
      setGroups(rows.filter((item) => {
        const id = String(item._id || '');
        const locallyJoined = Object.prototype.hasOwnProperty.call(overrides, id) ? Boolean(overrides[id]) : false;
        return locallyJoined || item.isCurrentUserMember || ['owner', 'moderator'].includes(item.currentUserRole) || item.currentUserMembershipStatus === 'joined';
      }).map((item) => Object.prototype.hasOwnProperty.call(overrides, String(item._id))
        ? { ...item, isCurrentUserMember: Boolean(overrides[String(item._id)]) }
        : item).filter((item) => item.isCurrentUserMember || ['owner', 'moderator'].includes(item.currentUserRole) || item.currentUserMembershipStatus === 'joined'));
    } catch {
      const cached = readList('guf-community-cache');
      const overrides = readMap('guf-community-membership-preview');
      setGroups(cached
        .map((item) => Object.prototype.hasOwnProperty.call(overrides, String(item._id)) ? { ...item, isCurrentUserMember: Boolean(overrides[String(item._id)]) } : item)
        .filter((item) => item.isCurrentUserMember || ['owner', 'moderator'].includes(item.currentUserRole) || item.currentUserMembershipStatus === 'joined'));
    }
  };

  useEffect(() => {
    loadConversations();
    loadGroups();
  }, [user?._id, requestedUserId, routeUser?._id]);

  const loadDirectThread = async (person) => {
    if (!person?._id) {
      setMessages([]);
      return;
    }
    setLoadingThread(true);
    setErrorNotice('');
    try {
      const response = await messagesApi.getWithUser(person._id);
      const serverMessages = response?.success && Array.isArray(response.data) ? response.data : [];
      const localMap = readMap('guf-direct-message-preview');
      const localMessages = localMap[String(person._id)] || [];
      setMessages([...serverMessages, ...localMessages].sort((a, b) =>
        new Date(a.createdAt || 0).getTime() - new Date(b.createdAt || 0).getTime()
      ));
    } catch (error) {
      const localMap = readMap('guf-direct-message-preview');
      setMessages(localMap[String(person._id)] || []);
      setErrorNotice(error.message || 'Messages could not be loaded. Local preview messages remain available.');
    } finally {
      setLoadingThread(false);
    }
  };

  useEffect(() => {
    if (selectedUser && !selectedGroup) loadDirectThread(selectedUser);
  }, [selectedUser?._id, selectedGroup?._id]);

  useEffect(() => {
    if (selectedGroup) {
      const groupMap = readMap('guf-group-message-preview');
      setMessages(groupMap[String(selectedGroup._id)] || []);
      setLoadingThread(false);
    }
  }, [selectedGroup?._id]);

  useEffect(() => {
    threadEndRef.current?.scrollIntoView?.({ behavior: 'smooth', block: 'end' });
  }, [messages.length, selectedUser?._id, selectedGroup?._id]);

  const visibleConversations = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    return conversations.filter((conversation) => {
      const person = conversation.user || {};
      const values = [person.name, person.department, conversation.lastMessage].filter(Boolean);
      const matchesSearch = !query || values.some((value) => String(value).toLowerCase().includes(query));
      const matchesUnread = activeListTab !== 'unread' || Number(conversation.unreadCount) > 0;
      return matchesSearch && matchesUnread;
    });
  }, [conversations, searchQuery, activeListTab]);

  const visibleGroups = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    return groups.filter((group) => [group.name, group.category, group.description]
      .filter(Boolean).some((value) => !query || String(value).toLowerCase().includes(query)));
  }, [groups, searchQuery]);

  const selectPerson = (person) => {
    setSelectedGroup(null);
    setSelectedUser(person);
    setMessageText('');
    setSelectedFile(null);
    setShowEmojiPicker(false);
  };

  const selectGroup = (group) => {
    setSelectedUser(null);
    setSelectedGroup(group);
    setDetailTab('info');
    setMessageText('');
    setSelectedFile(null);
    setShowEmojiPicker(false);
  };

  const saveLocalThread = (threadId, nextMessages, isGroup) => {
    const key = isGroup ? 'guf-group-message-preview' : 'guf-direct-message-preview';
    const store = readMap(key);
    store[String(threadId)] = nextMessages.filter((item) => item.isLocalPreview);
    writeMap(key, store);
  };

  const handleSendMessage = (event) => {
    event.preventDefault();
    if ((!selectedUser && !selectedGroup) || (!messageText.trim() && !selectedFile)) return;

    const message = localPreviewMessage({
      sender: getId(user) || 'local-preview-user',
      receiver: selectedUser?._id || null,
      body: messageText.trim() || (selectedFile ? 'Shared a file' : ''),
      attachment: selectedFile ? {
        name: selectedFile.name,
        size: selectedFile.size,
        type: selectedFile.type,
      } : null,
      read: true,
    });

    const nextMessages = [...messages, message];
    setMessages(nextMessages);
    if (selectedGroup) {
      saveLocalThread(selectedGroup._id, nextMessages, true);
    } else {
      saveLocalThread(selectedUser._id, nextMessages, false);
      setConversations((current) => {
        const id = String(selectedUser._id);
        const existing = current.find((item) => getId(item.user) === id);
        return [{
          _id: existing?._id || 'local-conversation-' + id,
          user: selectedUser,
          lastMessage: message.body,
          lastMessageAt: message.createdAt,
          unreadCount: 0,
          isLocalPreview: true,
        }, ...current.filter((item) => getId(item.user) !== id)];
      });
    }
    setMessageText('');
    setSelectedFile(null);
    setShowEmojiPicker(false);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleDeleteMessage = (messageId, unsend = false) => {
    const nextMessages = messages.map((message) => message._id === messageId
      ? { ...message, body: unsend ? 'This message was deleted.' : message.body, isDeleted: unsend, isHidden: !unsend }
      : message
    ).filter((message) => !message.isHidden);
    setMessages(nextMessages);
    if (selectedGroup) saveLocalThread(selectedGroup._id, nextMessages, true);
    else if (selectedUser) saveLocalThread(selectedUser._id, nextMessages, false);
  };

  const toggleGroupNotifications = () => {
    if (!selectedGroup) return;
    const id = String(selectedGroup._id);
    setMutedGroupIds((current) => {
      const next = current.includes(id) ? current.filter((value) => value !== id) : [...current, id];
      try { localStorage.setItem('guf-muted-group-preview', JSON.stringify(next)); } catch { /* in-memory state remains active */ }
      return next;
    });
  };

  const leaveGroupPreview = () => {
    if (!selectedGroup) return;
    const overrides = readMap('guf-community-membership-preview');
    overrides[String(selectedGroup._id)] = false;
    writeMap('guf-community-membership-preview', overrides);
    setGroups((current) => current.filter((item) => String(item._id) !== String(selectedGroup._id)));
    setSelectedGroup(null);
    setMessages([]);
  };

  const activeThread = selectedUser || selectedGroup;
  const isGroupThread = Boolean(selectedGroup);
  const unreadCount = conversations.reduce((total, item) => total + Number(item.unreadCount || 0), 0);
  const groupDetailItems = [
    { key: 'members', label: 'Members', icon: 'users' },
    { key: 'files', label: 'Shared Files', icon: 'folder' },
    { key: 'media', label: 'Media', icon: 'image' },
    { key: 'links', label: 'Links', icon: 'link' },
  ];

  return (
    <div className="page-shell page-messages">
      <PageHero icon="messageSquare" title="Messages" description="Connect, discuss and collaborate with your university community." />

      <section className="message-layout">
        <aside className="message-column message-conversations">
          <label className="message-conversation-search">
            <Icon name="search" size={17} />
            <input type="search" value={searchQuery} onChange={(event) => setSearchQuery(event.target.value)} placeholder="Search conversations..." aria-label="Search conversations" />
          </label>
          <div className="message-conversation-filters" role="tablist" aria-label="Message lists">
            <button type="button" className={activeListTab === 'all' ? 'active' : ''} aria-selected={activeListTab === 'all'} onClick={() => setActiveListTab('all')}>All</button>
            <button type="button" className={activeListTab === 'unread' ? 'active' : ''} aria-selected={activeListTab === 'unread'} onClick={() => setActiveListTab('unread')}>Unread ({unreadCount})</button>
            <button type="button" className={activeListTab === 'groups' ? 'active' : ''} aria-selected={activeListTab === 'groups'} onClick={() => setActiveListTab('groups')}>Groups</button>
          </div>

          <div className="message-conversation-list">
            {activeListTab === 'groups' ? (
              visibleGroups.length ? visibleGroups.map((group) => (
                <button type="button" key={group._id} className={'message-conversation-row' + (String(selectedGroup?._id) === String(group._id) ? ' is-selected' : '')} onClick={() => selectGroup(group)}>
                  {group.avatar ? <img src={group.avatar} alt="" className="message-avatar" loading="lazy" /> : <span className="message-avatar message-avatar-initials">{getInitials(group.name)}</span>}
                  <span className="message-conversation-copy"><strong>{group.name}</strong><small>{group.category || 'Community'} · Group</small></span>
                  {mutedGroupIds.includes(String(group._id)) ? <Icon name="bell" size={14} /> : null}
                </button>
              )) : <div className="message-empty-list">No joined communities are available in the Groups view.</div>
            ) : visibleConversations.length ? visibleConversations.map((conversation) => {
              const person = conversation.user || {};
              const isSelected = getId(selectedUser) === getId(person) && !selectedGroup;
              return (
                <button type="button" key={conversation._id || getId(person)} className={'message-conversation-row' + (isSelected ? ' is-selected' : '')} onClick={() => selectPerson(person)}>
                  {person.avatar ? <img src={person.avatar} alt="" className="message-avatar" loading="lazy" decoding="async" /> : <span className="message-avatar message-avatar-initials">{getInitials(person.name)}</span>}
                  <span className="message-conversation-copy"><strong>{person.name || 'University member'}</strong><small>{conversation.lastMessage || ''}</small></span>
                  {Number(conversation.unreadCount) > 0 ? <span className="message-unread-count">{conversation.unreadCount}</span> : null}
                </button>
              );
            }) : (
              <div className="message-empty-list">{activeListTab === 'unread' ? 'No unread conversations.' : conversations.length ? 'No conversations match this search.' : 'No conversations yet. Visit a member profile to start a direct message.'}</div>
            )}
          </div>
        </aside>

        <section className="message-column message-thread">
          {activeThread ? (
            <>
              <header className="message-thread-header">
                {selectedGroup ? (
                  selectedGroup.avatar ? <img src={selectedGroup.avatar} alt="" className="message-avatar" /> : <span className="message-avatar message-avatar-initials">{getInitials(selectedGroup.name)}</span>
                ) : selectedUser.avatar ? (
                  <img src={selectedUser.avatar} alt="" className="message-avatar" />
                ) : <span className="message-avatar message-avatar-initials">{getInitials(selectedUser.name)}</span>}
                <div className="message-thread-person">
                  <strong>{selectedGroup ? selectedGroup.name : selectedUser.name || 'University member'}</strong>
                  <span>{selectedGroup ? ((selectedGroup.memberCount || 0) + ' members · ' + (selectedGroup.category || 'Community')) : selectedUser.department || selectedUser.role || 'Direct conversation'}</span>
                </div>
                {selectedGroup
                  ? <button type="button" className="message-profile-link" aria-label="Group information" onClick={() => setDetailTab('info')}><Icon name="info" size={19} /></button>
                  : <Link to={selectedUser._id ? '/profile/' + selectedUser._id : '/people'} className="message-profile-link" title="View profile" aria-label="View profile"><Icon name="info" size={19} /></Link>}
              </header>

              {errorNotice ? <div className="message-error-notice">{errorNotice}</div> : null}
              <div className="message-thread-body">
                {loadingThread ? <div className="message-empty-thread">Loading messages...</div> : messages.length === 0 ? (
                  <div className="message-empty-thread">{selectedGroup ? 'No local preview messages in this group yet.' : 'No messages yet. Send a greeting to start your conversation.'}</div>
                ) : messages.map((message) => {
                  const isMine = getId(message.sender) === (getId(user) || 'local-preview-user');
                  return (
                    <div key={message._id} className={'message-bubble-wrap' + (isMine ? ' is-outgoing' : ' is-incoming')}>
                      <div className={'message-bubble' + (isMine ? ' message-bubble-outgoing' : '') + (message.isDeleted ? ' is-deleted' : '')}>
                        {message.body}
                        {message.attachment?.name ? <span className="message-attachment-chip"><Icon name="fileText" size={14} /> {message.attachment.name}</span> : null}
                      </div>
                      <div className="message-bubble-meta">
                        <time dateTime={message.createdAt}>{message.createdAt ? new Date(message.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}</time>
                        {message.isLocalPreview ? <>
                          {!message.isDeleted ? <button type="button" onClick={() => handleDeleteMessage(message._id, true)} title="Unsend local message">Unsend</button> : null}
                          <button type="button" onClick={() => handleDeleteMessage(message._id, false)} title="Delete local message">Delete</button>
                        </> : null}
                      </div>
                    </div>
                  );
                })}
                <div ref={threadEndRef} />
              </div>

              {showEmojiPicker ? <div className="message-emoji-picker">{['😀', '👍', '❤️', '🎉', '🙏', '😂'].map((emoji) => <button type="button" key={emoji} onClick={() => setMessageText((value) => value + emoji)}>{emoji}</button>)}</div> : null}
              {selectedFile ? <div className="message-attachment-pending"><Icon name="fileText" size={14} /><span>{selectedFile.name}</span><button type="button" onClick={() => { setSelectedFile(null); if (fileInputRef.current) fileInputRef.current.value = ''; }} aria-label="Remove attachment">×</button></div> : null}
              <form onSubmit={handleSendMessage} className="message-composer">
                <input ref={fileInputRef} type="file" hidden onChange={(event) => setSelectedFile(event.target.files?.[0] || null)} />
                <button type="button" className="message-composer-add" onClick={() => fileInputRef.current?.click()} aria-label="Attach file" title="Attach file"><Icon name="plus" size={19} /></button>
                <input type="text" className="form-control" placeholder={selectedGroup ? 'Type a message...' : 'Type a message to ' + (selectedUser.name || 'this member') + '...'} value={messageText} onChange={(event) => setMessageText(event.target.value)} aria-label="Message text" />
                <button type="button" className="message-composer-emoji" onClick={() => setShowEmojiPicker((value) => !value)} aria-label="Add emoji">☺</button>
                <button type="submit" className="btn btn-primary" disabled={!messageText.trim() && !selectedFile}><Icon name="send" size={17} /><span>Send</span></button>
              </form>
              <p className="message-local-note">{isGroupThread ? 'Group messages' : 'New direct messages'} are local previews in this frontend phase and are not sent to other members.</p>
            </>
          ) : (
            <div className="message-empty-thread">{errorNotice || 'Select a conversation or open a member profile to start a direct message.'}</div>
          )}
        </section>

        <aside className="message-column message-details">
          {selectedGroup ? (
            <>
              <div className="message-details-person">
                {selectedGroup.avatar ? <img src={selectedGroup.avatar} alt="" /> : <span className="message-avatar message-avatar-initials">{getInitials(selectedGroup.name)}</span>}
                <strong>{selectedGroup.name}</strong>
                <span>{selectedGroup.category || 'Community'} · {selectedGroup.memberCount || 0} members</span>
              </div>
              <div className="message-group-detail-links">
                {groupDetailItems.map((item) => <button type="button" key={item.key} className={detailTab === item.key ? 'active' : ''} onClick={() => setDetailTab(item.key)}><Icon name={item.icon} size={17} /><span>{item.label}</span><Icon name="chevronRight" size={15} /></button>)}
              </div>
              <div className="message-details-section">
                <div><Icon name={detailTab === 'info' ? 'info' : (groupDetailItems.find((item) => item.key === detailTab)?.icon || 'info')} size={18} /><strong>{detailTab === 'info' ? 'Group Info' : groupDetailItems.find((item) => item.key === detailTab)?.label}</strong></div>
                {detailTab === 'info' ? <><p>{selectedGroup.description || 'Community group conversation.'}</p><div className="message-group-tags">{[selectedGroup.category, selectedGroup.type].filter(Boolean).map((tag) => <span key={tag}>{tag}</span>)}</div><Link to={'/communities/' + (selectedGroup.slug || selectedGroup._id)}>Open Community <span>→</span></Link></> : <p>{detailTab === 'members' ? (selectedGroup.memberCount || 0) + ' members belong to this community.' : 'Shared ' + detailTab + ' are not available in the current community data.'}</p>}
              </div>
              <button type="button" className="btn btn-outline btn-sm message-group-mute" onClick={toggleGroupNotifications}><Icon name="bell" size={15} /> {mutedGroupIds.includes(String(selectedGroup._id)) ? 'Unmute Notifications' : 'Mute Notifications'}</button>
              <button type="button" className="message-group-leave" onClick={leaveGroupPreview}><Icon name="logOut" size={15} /> Leave Group (local preview)</button>
            </>
          ) : selectedUser ? (
            <>
              <div className="message-details-person">
                {selectedUser.avatar ? <img src={selectedUser.avatar} alt="" /> : <span className="message-avatar message-avatar-initials">{getInitials(selectedUser.name)}</span>}
                <strong>{selectedUser.name || 'University member'}</strong>
                <span>{[selectedUser.department, selectedUser.year].filter(Boolean).join(' · ') || selectedUser.role || 'University member'}</span>
              </div>
              <div className="message-details-section">
                <div><Icon name="userCheck" size={18} /><strong>Member information</strong></div>
                {selectedUser.department ? <p>{selectedUser.department}</p> : null}
                {selectedUser.year ? <p>{selectedUser.year}</p> : null}
                {selectedUser.bio ? <p>{selectedUser.bio}</p> : null}
                {selectedUser._id ? <Link to={'/profile/' + selectedUser._id}>View profile <span>→</span></Link> : null}
              </div>
            </>
          ) : <div className="message-empty-list">Member or group details appear here when a conversation is selected.</div>}
        </aside>
      </section>
    </div>
  );
};

export default MessagesPage;

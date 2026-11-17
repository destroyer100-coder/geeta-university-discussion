import React, { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { messagesApi, usersApi } from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import { Icon } from '../../components/common/Icons';
import { PageHero } from '../../components/common/PageHero';

const getInitials = (name = '') => name.trim().split(' ').filter(Boolean).slice(0, 2).map((part) => part[0]).join('').toUpperCase() || 'U';
const getId = (value) => (value?._id || value || '').toString();

export const MessagesPage = () => {
  const { user } = useAuth();
  const [searchParams] = useSearchParams();
  const requestedUserId = searchParams.get('user');
  const [conversations, setConversations] = useState([]);
  const [selectedUser, setSelectedUser] = useState(null);
  const [messages, setMessages] = useState([]);
  const [messageText, setMessageText] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [unreadOnly, setUnreadOnly] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadingThread, setLoadingThread] = useState(false);
  const [sending, setSending] = useState(false);
  const [errorNotice, setErrorNotice] = useState(null);

  const loadConversations = async () => {
    setLoading(true);
    try {
      const res = await messagesApi.getConversations();
      const list = res.success && Array.isArray(res.data) ? res.data : [];
      setConversations(list);

      if (requestedUserId) {
        const existing = list.find((item) => getId(item.user) === requestedUserId);
        if (existing && existing.user) {
          setSelectedUser(existing.user);
        } else {
          const profile = await usersApi.getProfile(requestedUserId);
          if (profile.success && profile.data) setSelectedUser(profile.data);
          else setSelectedUser(null);
        }
      } else {
        setSelectedUser((current) => {
          if (current && list.some((item) => getId(item.user) === getId(current))) {
            return list.find((item) => getId(item.user) === getId(current)).user;
          }
          return list[0] ? list[0].user : null;
        });
      }
    } catch (err) {
      console.error('Failed to load conversations:', err);
      setErrorNotice(err.message || 'Could not load conversations.');
    } finally {
      setLoading(false);
    }
  };

  const loadThread = async (otherUser) => {
    if (!otherUser || !otherUser._id) {
      setMessages([]);
      return;
    }
    setLoadingThread(true);
    setErrorNotice(null);
    try {
      const res = await messagesApi.getWithUser(otherUser._id);
      if (res.success) setMessages(Array.isArray(res.data) ? res.data : []);
    } catch (err) {
      console.error('Failed to load message thread:', err);
      setErrorNotice(err.message || 'Could not load messages.');
    } finally {
      setLoadingThread(false);
    }
  };

  useEffect(() => {
    loadConversations();
  }, [user?._id, requestedUserId]);

  useEffect(() => {
    if (selectedUser && selectedUser._id) loadThread(selectedUser);
  }, [selectedUser?._id]);

  const visibleConversations = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    return conversations.filter((conversation) => {
      const person = conversation.user || {};
      const values = [person.name, person.department, conversation.lastMessage].filter(Boolean);
      const matchesSearch = !query || values.some((value) => value.toLowerCase().includes(query));
      const matchesUnread = !unreadOnly || Number(conversation.unreadCount) > 0;
      return matchesSearch && matchesUnread;
    });
  }, [conversations, searchQuery, unreadOnly]);

  const handleSendMessage = async (event) => {
    event.preventDefault();
    if (!messageText.trim() || !selectedUser || !selectedUser._id || sending) return;

    setSending(true);
    setErrorNotice(null);
    try {
      const res = await messagesApi.sendMessage({
        receiverId: selectedUser._id,
        body: messageText.trim(),
      });
      if (res.success) {
        setMessageText('');
        await loadThread(selectedUser);
        const latest = await messagesApi.getConversations();
        if (latest.success && Array.isArray(latest.data)) setConversations(latest.data);
      }
    } catch (err) {
      setErrorNotice(err.message || 'Failed to deliver message.');
    } finally {
      setSending(false);
    }
  };

  const handleDeleteForMe = async (msgId) => {
    try {
      await messagesApi.deleteForMe(msgId);
      setMessages((current) => current.filter((message) => message._id !== msgId));
    } catch (err) {
      alert(err.message || 'Failed to delete message');
    }
  };

  const handleDeleteForEveryone = async (msgId) => {
    try {
      const res = await messagesApi.deleteForEveryone(msgId);
      if (res.success) {
        setMessages((current) => current.map((message) => message._id === msgId ? res.data : message));
      }
    } catch (err) {
      alert(err.message || 'Failed to delete message for everyone');
    }
  };

  if (loading) {
    return <div className="page-shell page-messages"><div className="loading-state">Loading conversations...</div></div>;
  }

  return (
    <div className="page-shell page-messages">
      <PageHero icon="messageSquare" title="Messages" description="Connect, discuss and collaborate with your university community." />

      <section className="message-layout">
        <aside className="message-column message-conversations">
          <label className="message-conversation-search">
            <Icon name="search" size={17} />
            <input
              type="search"
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              placeholder="Search messages..."
              aria-label="Search conversations"
            />
          </label>
          <div className="message-conversation-filters">
            <button type="button" className={!unreadOnly ? 'active' : ''} onClick={() => setUnreadOnly(false)}>All</button>
            <button type="button" className={unreadOnly ? 'active' : ''} onClick={() => setUnreadOnly(true)}>Unread</button>
          </div>
          <div className="message-conversation-list">
            {visibleConversations.length ? visibleConversations.map((conversation) => {
              const person = conversation.user || {};
              const isSelected = getId(selectedUser) === getId(person);
              return (
                <button
                  type="button"
                  key={conversation._id || getId(person)}
                  className={'message-conversation-row' + (isSelected ? ' is-selected' : '')}
                  onClick={() => setSelectedUser(person)}
                >
                  {person.avatar ? (
                    <img src={person.avatar} alt="" className="message-avatar" loading="lazy" decoding="async" />
                  ) : (
                    <span className="message-avatar message-avatar-initials">{getInitials(person.name)}</span>
                  )}
                  <span className="message-conversation-copy">
                    <strong>{person.name || 'University member'}</strong>
                    <small>{conversation.lastMessage || ''}</small>
                  </span>
                  {Number(conversation.unreadCount) > 0 ? <span className="message-unread-count">{conversation.unreadCount}</span> : null}
                </button>
              );
            }) : (
              <div className="message-empty-list">
                {conversations.length ? 'No conversations match this filter.' : 'No conversations yet. Visit a member profile to start a direct message.'}
              </div>
            )}
          </div>
        </aside>

        <section className="message-column message-thread">
          {selectedUser ? (
            <>
              <header className="message-thread-header">
                {selectedUser.avatar ? (
                  <img src={selectedUser.avatar} alt="" className="message-avatar" />
                ) : (
                  <span className="message-avatar message-avatar-initials">{getInitials(selectedUser.name)}</span>
                )}
                <div className="message-thread-person">
                  <strong>{selectedUser.name || 'University member'}</strong>
                  <span>{selectedUser.department || selectedUser.role || 'Direct conversation'}</span>
                </div>
                <Link to={selectedUser._id ? '/profile/' + selectedUser._id : '/people'} className="message-profile-link" title="View profile" aria-label="View profile">
                  <Icon name="info" size={19} />
                </Link>
              </header>

              {errorNotice ? <div className="message-error-notice">{errorNotice}</div> : null}

              <div className="message-thread-body">
                {loadingThread ? (
                  <div className="message-empty-thread">Loading messages...</div>
                ) : messages.length === 0 ? (
                  <div className="message-empty-thread">No messages yet. Send a greeting to start your conversation.</div>
                ) : (
                  messages.map((message) => {
                    const isMine = getId(message.sender) === getId(user);
                    return (
                      <div key={message._id} className={'message-bubble-wrap' + (isMine ? ' is-outgoing' : ' is-incoming')}>
                        <div className={'message-bubble' + (isMine ? ' message-bubble-outgoing' : '') + (message.isDeleted ? ' is-deleted' : '')}>
                          {message.body}
                        </div>
                        <div className="message-bubble-meta">
                          <time dateTime={message.createdAt}>
                            {message.createdAt ? new Date(message.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}
                          </time>
                          {!message.isDeleted && isMine ? (
                            <button type="button" onClick={() => handleDeleteForEveryone(message._id)} title="Delete for everyone">Unsend</button>
                          ) : null}
                          <button type="button" onClick={() => handleDeleteForMe(message._id)} title="Delete for me">Delete</button>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>

              <form onSubmit={handleSendMessage} className="message-composer">
                <input
                  type="text"
                  className="form-control"
                  placeholder={'Type a message to ' + (selectedUser.name || 'this member') + '...'}
                  value={messageText}
                  onChange={(event) => setMessageText(event.target.value)}
                  disabled={sending}
                  aria-label="Message text"
                />
                <button type="submit" className="btn btn-primary" disabled={sending || !messageText.trim()}>
                  <Icon name="send" size={17} />
                  <span>{sending ? 'Sending...' : 'Send'}</span>
                </button>
              </form>
            </>
          ) : (
            <div className="message-empty-thread">
              {errorNotice || 'Select a conversation or open a member profile to start a direct message.'}
            </div>
          )}
        </section>

        <aside className="message-column message-details">
          {selectedUser ? (
            <>
              <div className="message-details-person">
                {selectedUser.avatar ? (
                  <img src={selectedUser.avatar} alt="" />
                ) : (
                  <span className="message-avatar message-avatar-initials">{getInitials(selectedUser.name)}</span>
                )}
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
          ) : (
            <div className="message-empty-list">Member details appear here when a conversation is selected.</div>
          )}
        </aside>
      </section>
    </div>
  );
};

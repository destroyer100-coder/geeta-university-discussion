import React, { useState, useEffect } from 'react';
import { messagesApi, usersApi } from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import { Icon } from '../../components/common/Icons';

export const MessagesPage = () => {
  const { user } = useAuth();
  const [conversations, setConversations] = useState([]);
  const [selectedUser, setSelectedUser] = useState(null);
  const [messages, setMessages] = useState([]);
  const [messageText, setMessageText] = useState('');
  const [loading, setLoading] = useState(true);
  const [loadingThread, setLoadingThread] = useState(false);
  const [sending, setSending] = useState(false);
  const [errorNotice, setErrorNotice] = useState(null);

  const loadConversations = async () => {
    try {
      const res = await messagesApi.getConversations();
      if (res.success) {
        setConversations(res.data);
        if (!selectedUser && res.data.length > 0) {
          setSelectedUser(res.data[0].user);
        }
      }
    } catch (err) {
      console.error('Failed to load conversations:', err);
    } finally {
      setLoading(false);
    }
  };

  const loadThread = async (otherUser) => {
    if (!otherUser) return;
    setLoadingThread(true);
    setErrorNotice(null);
    try {
      const res = await messagesApi.getWithUser(otherUser._id);
      if (res.success) {
        setMessages(res.data);
      }
    } catch (err) {
      console.error('Failed to load message thread:', err);
      setErrorNotice(err.message || 'Could not load messages.');
    } finally {
      setLoadingThread(false);
    }
  };

  useEffect(() => {
    loadConversations();
  }, [user]);

  useEffect(() => {
    if (selectedUser) {
      loadThread(selectedUser);
    }
  }, [selectedUser]);

  const handleSendMessage = async (e) => {
    e.preventDefault();
    if (!messageText.trim() || !selectedUser) return;

    setSending(true);
    setErrorNotice(null);
    try {
      const res = await messagesApi.sendMessage({
        receiverId: selectedUser._id,
        body: messageText.trim(),
      });
      if (res.success) {
        setMessageText('');
        loadThread(selectedUser);
        loadConversations();
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
      setMessages(messages.filter((m) => m._id !== msgId));
    } catch (err) {
      alert(err.message || 'Failed to delete message');
    }
  };

  const handleDeleteForEveryone = async (msgId) => {
    try {
      const res = await messagesApi.deleteForEveryone(msgId);
      if (res.success) {
        setMessages(messages.map((m) => (m._id === msgId ? res.data : m)));
      }
    } catch (err) {
      alert(err.message || 'Failed to delete message for everyone');
    }
  };

  if (loading) {
    return <div style={{ textAlign: 'center', padding: '60px' }}>Loading conversations...</div>;
  }

  return (
    <div>
      <div style={{ marginBottom: '18px' }}>
        <h1 style={{ fontSize: '1.4rem', fontWeight: 800 }}>Direct Messages</h1>
        <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>
          Private peer-to-peer conversations across Geeta University departments
        </p>
      </div>

      <div
        className="card"
        style={{
          display: 'grid',
          gridTemplateColumns: '280px 1fr',
          minHeight: '520px',
          padding: 0,
          overflow: 'hidden',
        }}
      >
        {/* Left: Conversation List */}
        <div style={{ borderRight: '1px solid var(--border-color)', background: '#fafbfc' }}>
          <div style={{ padding: '14px 18px', borderBottom: '1px solid var(--border-color)', fontWeight: 700, fontSize: '0.9rem' }}>
            Chats ({conversations.length})
          </div>

          <div style={{ overflowY: 'auto', maxHeight: '520px' }}>
            {conversations.length === 0 ? (
              <div style={{ padding: '24px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                No conversations yet. Visit a peer profile to start a chat.
              </div>
            ) : (
              conversations.map((c) => {
                const isSelected = selectedUser && selectedUser._id === c.user?._id;
                return (
                  <div
                    key={c._id}
                    onClick={() => setSelectedUser(c.user)}
                    style={{
                      padding: '12px 16px',
                      borderBottom: '1px solid var(--border-color)',
                      cursor: 'pointer',
                      background: isSelected ? 'var(--primary-light)' : '#ffffff',
                      display: 'flex',
                      gap: '12px',
                      alignItems: 'center',
                    }}
                  >
                    <img
                      src={
                        c.user?.avatar ||
                        'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=80'
                      }
                      alt={c.user?.name}
                      style={{ width: 40, height: 40, borderRadius: '50%', objectFit: 'cover' }}
                    />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <strong style={{ fontSize: '0.875rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {c.user?.name || 'Student'}
                        </strong>
                        {c.unreadCount > 0 && (
                          <span
                            className="badge badge-primary"
                            style={{ padding: '2px 6px', fontSize: '0.65rem' }}
                          >
                            {c.unreadCount}
                          </span>
                        )}
                      </div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {c.lastMessage}
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Right: Active Chat Thread */}
        <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
          {selectedUser ? (
            <>
              {/* Header */}
              <div
                style={{
                  padding: '14px 20px',
                  borderBottom: '1px solid var(--border-color)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  background: '#ffffff',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <img
                    src={
                      selectedUser.avatar ||
                      'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=80'
                    }
                    alt={selectedUser.name}
                    style={{ width: 36, height: 36, borderRadius: '50%', objectFit: 'cover' }}
                  />
                  <div>
                    <strong style={{ fontSize: '0.95rem' }}>{selectedUser.name}</strong>
                    <div style={{ fontSize: '0.725rem', color: 'var(--text-muted)' }}>
                      {selectedUser.department || 'Geeta University'}
                    </div>
                  </div>
                </div>
              </div>

              {/* Error Notice / Block banner (Point 14 & 18) */}
              {errorNotice && (
                <div
                  style={{
                    padding: '10px 16px',
                    background: '#fee2e2',
                    color: '#991b1b',
                    fontSize: '0.8rem',
                    borderBottom: '1px solid #fca5a5',
                  }}
                >
                  ⚠️ {errorNotice}
                </div>
              )}

              {/* Messages Body */}
              <div
                style={{
                  flex: 1,
                  padding: '20px',
                  overflowY: 'auto',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '12px',
                  background: '#f8fafc',
                }}
              >
                {loadingThread ? (
                  <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>
                    Loading messages...
                  </div>
                ) : messages.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                    No messages yet. Send a greeting to start your conversation!
                  </div>
                ) : (
                  messages.map((msg) => {
                    const isMine = msg.sender?._id === user?._id || msg.sender === user?._id;
                    return (
                      <div
                        key={msg._id}
                        style={{
                          alignSelf: isMine ? 'flex-end' : 'flex-start',
                          maxWidth: '75%',
                          display: 'flex',
                          flexDirection: 'column',
                          alignItems: isMine ? 'flex-end' : 'flex-start',
                        }}
                      >
                        <div
                          style={{
                            padding: '10px 14px',
                            borderRadius: '12px',
                            background: isMine ? 'var(--primary)' : '#ffffff',
                            color: isMine ? '#ffffff' : 'var(--text-main)',
                            boxShadow: 'var(--shadow-sm)',
                            border: isMine ? 'none' : '1px solid var(--border-color)',
                            fontSize: '0.875rem',
                            lineHeight: 1.5,
                            fontStyle: msg.isDeleted ? 'italic' : 'normal',
                          }}
                        >
                          {msg.body}
                        </div>
                        <div
                          style={{
                            fontSize: '0.675rem',
                            color: 'var(--text-muted)',
                            marginTop: '3px',
                            display: 'flex',
                            gap: '8px',
                          }}
                        >
                          <span>{new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                          {!msg.isDeleted && isMine && (
                            <button
                              onClick={() => handleDeleteForEveryone(msg._id)}
                              style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: '#ef4444', fontSize: '0.675rem' }}
                              title="Delete for everyone"
                            >
                              Unsend
                            </button>
                          )}
                          <button
                            onClick={() => handleDeleteForMe(msg._id)}
                            style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: 'var(--text-muted)', fontSize: '0.675rem' }}
                            title="Delete for me"
                          >
                            Delete
                          </button>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>

              {/* Message Composer Input */}
              <form
                onSubmit={handleSendMessage}
                style={{
                  padding: '12px 18px',
                  borderTop: '1px solid var(--border-color)',
                  display: 'flex',
                  gap: '10px',
                  background: '#ffffff',
                }}
              >
                <input
                  type="text"
                  className="form-control"
                  placeholder={`Message ${selectedUser.name}...`}
                  value={messageText}
                  onChange={(e) => setMessageText(e.target.value)}
                  disabled={sending}
                />
                <button type="submit" className="btn btn-primary" disabled={sending || !messageText.trim()}>
                  {sending ? 'Sending...' : 'Send'}
                </button>
              </form>
            </>
          ) : (
            <div style={{ padding: '60px', textAlign: 'center', color: 'var(--text-muted)' }}>
              Select a conversation from the left to start messaging.
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Send, X, Smile, Search, MessageSquare, Shield, Clock, Check, CheckCheck } from 'lucide-react';
import Button from '../common/Button.jsx';
import Card from '../common/Card.jsx';
import TranslatedMessage from '../TranslatedMessage/TranslatedMessage.jsx';

const COMMON_EMOJIS = ['😊', '😂', '👍', '🔥', '🎉', '❤️', '🤔', '🙌', '👏', '🚀', '👋', '👀', '✨', '💯', '💡', '✅'];

const PrivateChatDrawer = ({
  isOpen,
  onClose,
  socket,
  currentUser,
  recipient, // { socketId, username, preferredLanguage }
  allowPrivateMessages = true,
  isCurrentUserHost = false,
  chatHistory
}) => {
  const [messages, setMessages] = useState(() => chatHistory || []);
  const [inputText, setInputText] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [showSearch, setShowSearch] = useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [isTyping, setIsTyping] = useState(false);
  const [peerIsTyping, setPeerIsTyping] = useState(false);
  
  const chatEndRef = useRef(null);
  const typingTimeoutRef = useRef(null);

  // Sync messages with chatHistory whenever it changes or recipient changes
  useEffect(() => {
    if (chatHistory !== undefined) {
      setMessages(chatHistory);
    }
  }, [chatHistory, recipient?.socketId]);

  // Settings from localStorage
  const autoTranslate = localStorage.getItem('setting_auto_translate') !== 'false';
  const translationDisplayMode = localStorage.getItem('setting_translation_display') || 'both';

  useEffect(() => {
    if (!socket || !recipient) return;

    // Reset messages when swapping recipients if no parent chatHistory provided
    if (chatHistory === undefined) {
      setMessages([]);
    }
    setPeerIsTyping(false);

    // Listen for incoming private messages
    const handlePrivateMessage = (data) => {
      if (chatHistory !== undefined) return; // Managed by parent meeting state
      // Check if message is from the active recipient
      if (data.senderSocketId === recipient.socketId) {
        setMessages((prev) => [...prev, {
          id: Math.random().toString(),
          sender: data.senderUsername,
          socketId: data.senderSocketId,
          text: data.message,
          translated: data.translatedMessage,
          fromLang: data.fromLang,
          toLang: data.toLang,
          timestamp: new Date(data.timestamp),
          status: 'read'
        }]);

        // Emit read receipt back
        socket.emit("private-message-read", { toSocketId: recipient.socketId });
      }
    };

    // Listen for sender confirmation receipt
    const handlePrivateMessageSent = (data) => {
      if (chatHistory !== undefined) return; // Managed by parent meeting state
      if (data.recipientSocketId === recipient.socketId) {
        setMessages((prev) => [...prev, {
          id: Math.random().toString(),
          sender: currentUser?.username || 'You',
          socketId: socket.id,
          text: data.message,
          timestamp: new Date(data.timestamp),
          status: 'sent'
        }]);
      }
    };

    // Listen for typing indicator
    const handlePrivateMessageTyping = (data) => {
      if (data.senderSocketId === recipient.socketId) {
        setPeerIsTyping(data.isTyping);
      }
    };

    // Listen for read confirmation
    const handlePrivateMessageRead = (data) => {
      if (data.senderSocketId === recipient.socketId) {
        setMessages((prev) => prev.map(msg => 
          msg.socketId === socket.id ? { ...msg, status: 'read' } : msg
        ));
      }
    };

    // Listen for delivery confirmation
    const handlePrivateMessageDelivered = (data) => {
      if (data.recipientSocketId === recipient.socketId) {
        setMessages((prev) => prev.map(msg => 
          msg.socketId === socket.id && msg.status === 'sent' ? { ...msg, status: 'delivered' } : msg
        ));
      }
    };

    socket.on("private-message", handlePrivateMessage);
    socket.on("private-message-sent", handlePrivateMessageSent);
    socket.on("private-message-typing", handlePrivateMessageTyping);
    socket.on("private-message-read", handlePrivateMessageRead);
    socket.on("private-message-delivered", handlePrivateMessageDelivered);

    // Mark current messages as read on open
    socket.emit("private-message-read", { toSocketId: recipient.socketId });

    return () => {
      socket.off("private-message", handlePrivateMessage);
      socket.off("private-message-sent", handlePrivateMessageSent);
      socket.off("private-message-typing", handlePrivateMessageTyping);
      socket.off("private-message-read", handlePrivateMessageRead);
      socket.off("private-message-delivered", handlePrivateMessageDelivered);
    };
  }, [socket, recipient, currentUser]);

  // Scroll to bottom on new messages
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, peerIsTyping]);

  const handleSend = () => {
    if (!inputText.trim() || !socket || !recipient) return;

    // Send private message via socket
    socket.emit("private-message", {
      toSocketId: recipient.socketId,
      message: inputText.trim()
    });

    setInputText('');
    setShowEmojiPicker(false);

    // Stop typing indicator
    if (isTyping) {
      setIsTyping(false);
      socket.emit("private-message-typing", { toSocketId: recipient.socketId, isTyping: false });
    }
  };

  const handleInputChange = (e) => {
    setInputText(e.target.value);

    if (!socket || !recipient) return;

    if (!isTyping) {
      setIsTyping(true);
      socket.emit("private-message-typing", { toSocketId: recipient.socketId, isTyping: true });
    }

    // Reset typing timeout
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    
    typingTimeoutRef.current = setTimeout(() => {
      setIsTyping(false);
      socket.emit("private-message-typing", { toSocketId: recipient.socketId, isTyping: false });
    }, 2000);
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter') handleSend();
  };

  const addEmoji = (emoji) => {
    setInputText((prev) => prev + emoji);
  };

  // Filter messages by search term
  const filteredMessages = messages.filter((msg) => {
    const textMatch = msg.text.toLowerCase().includes(searchQuery.toLowerCase());
    const transMatch = msg.translated?.toLowerCase().includes(searchQuery.toLowerCase());
    return textMatch || transMatch;
  });



  const renderMessageStatus = (msg) => {
    if (msg.socketId !== socket.id) return null;
    if (msg.status === 'read') return <CheckCheck size={14} color="var(--primary)" />;
    if (msg.status === 'delivered') return <CheckCheck size={14} color="var(--text-muted)" />;
    return <Check size={14} color="var(--text-muted)" />;
  };

  return (
    <AnimatePresence>
      {isOpen && recipient && (
        <motion.div
          initial={{ x: '100%', opacity: 0.9 }}
          animate={{ x: 0, opacity: 1 }}
          exit={{ x: '100%', opacity: 0.9 }}
          transition={{ type: 'spring', damping: 24, stiffness: 180 }}
          style={{
            position: 'fixed',
            top: 0,
            right: 0,
            width: '100%',
            maxWidth: '380px',
            height: '100vh',
            background: 'var(--surface)',
            borderLeft: '1px solid var(--border)',
            boxShadow: 'var(--shadow-lg)',
            zIndex: 1000,
            display: 'flex',
            flexDirection: 'column'
          }}
        >
          {/* Header */}
          <div style={{
            padding: '16px 20px',
            borderBottom: '1px solid var(--border)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            background: 'var(--background)'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <div style={{
                width: '38px',
                height: '38px',
                borderRadius: '50%',
                background: 'linear-gradient(135deg, var(--secondary), var(--accent))',
                color: '#ffffff',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontWeight: 700,
                fontSize: '0.95rem'
              }}>
                {recipient.username.charAt(0).toUpperCase()}
              </div>
              <div>
                <h3 style={{ fontSize: '0.95rem', fontWeight: 700, color: 'var(--text)', margin: 0 }}>
                  {recipient.username}
                </h3>
                <span style={{ fontSize: '0.75rem', color: 'var(--secondary)', display: 'flex', alignItems: 'center', gap: '4px', fontWeight: 500 }}>
                  <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: 'var(--secondary)', display: 'inline-block' }}></span>
                  Active Peer ({recipient.preferredLanguage?.toUpperCase()})
                </span>
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <button
                onClick={() => setShowSearch(!showSearch)}
                style={{
                  background: 'none',
                  border: 'none',
                  color: 'var(--text-muted)',
                  cursor: 'pointer',
                  padding: '6px'
                }}
              >
                <Search size={18} />
              </button>
              <button
                onClick={onClose}
                style={{
                  background: 'none',
                  border: 'none',
                  color: 'var(--text-muted)',
                  cursor: 'pointer',
                  padding: '6px'
                }}
              >
                <X size={20} />
              </button>
            </div>
          </div>

          {/* Read-only notification banner */}
          {!allowPrivateMessages && !isCurrentUserHost && (
            <div style={{
              background: 'rgba(239, 68, 68, 0.1)',
              borderBottom: '1px solid rgba(239, 68, 68, 0.2)',
              padding: '10px 16px',
              fontSize: '0.75rem',
              color: '#F87171',
              fontWeight: 600,
              textAlign: 'center'
            }}>
              ⚠️ Private messaging has been disabled by the host.
            </div>
          )}

          {/* Search bar */}
          {showSearch && (
            <div style={{ padding: '8px 16px', borderBottom: '1px solid var(--border)', background: 'var(--background)' }}>
              <input
                type="text"
                placeholder="Search messages..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                style={{
                  width: '100%',
                  padding: '8px 12px',
                  borderRadius: 'var(--radius-sm)',
                  border: '1px solid var(--border)',
                  background: 'var(--surface)',
                  color: 'var(--text)',
                  fontSize: '0.85rem',
                  outline: 'none'
                }}
              />
            </div>
          )}

          {/* Message List */}
          <div style={{
            flex: 1,
            padding: '20px',
            overflowY: 'auto',
            display: 'flex',
            flexDirection: 'column',
            gap: '16px',
            background: 'var(--background)'
          }}>
            {filteredMessages.length === 0 ? (
              <div style={{
                textAlign: 'center',
                color: 'var(--text-muted)',
                marginTop: '40px',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: '12px'
              }}>
                <MessageSquare size={36} opacity={0.3} />
                <p style={{ fontSize: '0.85rem', margin: 0 }}>This conversation is fully encrypted & private.</p>
              </div>
            ) : (
              filteredMessages.map((msg) => {
                const isMe = msg.socketId === socket.id;
                return (
                  <div
                    key={msg.id}
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: isMe ? 'flex-end' : 'flex-start',
                      width: '100%'
                    }}
                  >
                    <div style={{
                      maxWidth: '85%',
                      padding: '12px 14px',
                      borderRadius: isMe ? '16px 16px 4px 16px' : '16px 16px 16px 4px',
                      background: isMe ? 'var(--primary)' : 'var(--surface)',
                      color: isMe ? '#ffffff' : 'var(--text)',
                      boxShadow: 'var(--shadow)',
                      border: isMe ? 'none' : '1px solid var(--border)'
                    }}>
                      <TranslatedMessage
                        text={msg.text}
                        translation={msg.translated ? {
                          translatedMessage: msg.translated,
                          fromLang: msg.fromLang,
                          toLang: msg.toLang
                        } : null}
                        isMe={isMe}
                      />
                    </div>
                    <div style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px',
                      marginTop: '4px',
                      fontSize: '0.7rem',
                      color: 'var(--text-muted)'
                    }}>
                      <Clock size={10} />
                      {msg.timestamp.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })}
                      {renderMessageStatus(msg)}
                    </div>
                  </div>
                );
              })
            )}

            {/* Peer is Typing animation */}
            {peerIsTyping && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <div style={{
                  width: '30px',
                  height: '30px',
                  borderRadius: '50%',
                  background: 'var(--border)',
                  color: 'var(--text-muted)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '0.8rem',
                  fontWeight: 600
                }}>
                  {recipient.username.charAt(0).toUpperCase()}
                </div>
                <div style={{
                  background: 'var(--surface)',
                  padding: '8px 12px',
                  borderRadius: '12px',
                  border: '1px solid var(--border)'
                }}>
                  <div className="typing-indicator" style={{ display: 'flex', gap: '4px' }}>
                    <span className="dot" style={{ width: '6px', height: '6px', background: 'var(--text-muted)', borderRadius: '50%', display: 'inline-block' }}></span>
                    <span className="dot" style={{ width: '6px', height: '6px', background: 'var(--text-muted)', borderRadius: '50%', display: 'inline-block' }}></span>
                    <span className="dot" style={{ width: '6px', height: '6px', background: 'var(--text-muted)', borderRadius: '50%', display: 'inline-block' }}></span>
                  </div>
                </div>
              </div>
            )}

            <div ref={chatEndRef} />
          </div>

          {/* Emoji Picker Popover */}
          {showEmojiPicker && (
            <div style={{
              position: 'absolute',
              bottom: '76px',
              left: '16px',
              right: '16px',
              background: 'var(--surface)',
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius-md)',
              padding: '12px',
              boxShadow: 'var(--shadow-lg)',
              display: 'grid',
              gridTemplateColumns: 'repeat(8, 1fr)',
              gap: '8px',
              zIndex: 1010
            }}>
              {COMMON_EMOJIS.map((emoji) => (
                <button
                  key={emoji}
                  onClick={() => addEmoji(emoji)}
                  style={{
                    background: 'none',
                    border: 'none',
                    fontSize: '1.25rem',
                    cursor: 'pointer',
                    padding: '4px',
                    borderRadius: '4px'
                  }}
                  className="card-hover"
                >
                  {emoji}
                </button>
              ))}
            </div>
          )}

           {/* Typing Area Footer */}
          {!allowPrivateMessages && !isCurrentUserHost ? (
            <div style={{
              padding: '16px 20px',
              borderTop: '1px solid var(--border)',
              background: 'var(--surface)',
              color: 'var(--error)',
              fontSize: '0.8rem',
              fontWeight: 600,
              textAlign: 'center',
              width: '100%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px'
            }}>
              🔒 Private messaging has been disabled by the host.
            </div>
          ) : (
            <div style={{
              padding: '16px',
              borderTop: '1px solid var(--border)',
              background: 'var(--surface)',
              display: 'flex',
              gap: '10px',
              alignItems: 'center'
            }}>
              <button
                onClick={() => setShowEmojiPicker(!showEmojiPicker)}
                style={{
                  background: 'none',
                  border: 'none',
                  color: 'var(--text-muted)',
                  cursor: 'pointer',
                  padding: '6px'
                }}
              >
                <Smile size={20} />
              </button>

              <input
                type="text"
                placeholder="Type a secure message..."
                value={inputText}
                onChange={handleInputChange}
                onKeyPress={handleKeyPress}
                style={{
                  flex: 1,
                  padding: '10px 14px',
                  borderRadius: 'var(--radius-md)',
                  border: '1px solid var(--border)',
                  background: 'var(--background)',
                  color: 'var(--text)',
                  fontSize: '0.85rem',
                  outline: 'none'
                }}
              />

              <Button
                variant="primary"
                size="small"
                onClick={handleSend}
                style={{ padding: '8px 12px' }}
              >
                <Send size={16} />
              </Button>
            </div>
          )}

          {/* CSS for dot animations */}
          <style>{`
            .dot {
              animation: bounce 1.4s infinite ease-in-out both;
            }
            .dot:nth-child(1) { animation-delay: -0.32s; }
            .dot:nth-child(2) { animation-delay: -0.16s; }
            @keyframes bounce {
              0%, 80%, 100% { transform: scale(0); }
              40% { transform: scale(1.0); }
            }
          `}</style>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default PrivateChatDrawer;

import { useState, useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { apiService } from '../services/api';
import { Loader } from '../components/Loader';
import { getImageUrl } from '../utils/imageUtils';
import './Messages.css';

interface Participant {
  id: number;
  name: string;
  phone: string;
  email?: string;
}

interface Conversation {
  id: number;
  participants: Participant[];
  other_user?: Participant;
  last_message?: {
    id: number;
    content: string;
    created_at: string;
    sender_id: number;
  };
  is_read: boolean;
  created_at: string;
  updated_at: string;
}

interface Message {
  id: number;
  conversation_id: number;
  sender_id: number;
  content: string;
  file?: string | null;
  file_type?: string | null;
  file_name?: string | null;
  created_at: string;
  is_read: boolean;
  sender?: {
    id: number;
    name: string;
    phone: string;
    email?: string;
  };
}

export function Messages() {
  const { user, isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selectedConversation, setSelectedConversation] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [messagesLoading, setMessagesLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [showConversationsList, setShowConversationsList] = useState(true);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesListRef = useRef<HTMLDivElement>(null);

  // Check if conversationId is in location state (from ProductDetail chat button)
  useEffect(() => {
    if (location.state?.conversationId && user) {
      // Find and select the conversation
      const conv = conversations.find(c => c.id === location.state.conversationId);
      if (conv) {
        setSelectedConversation(conv);
        setShowConversationsList(false); // Hide conversations list on mobile when coming from product page
      }
    }
  }, [location.state, conversations, user]);

  useEffect(() => {
    if (!isAuthenticated || !user) {
      navigate('/login');
      return;
    }
    loadConversations();
  }, [isAuthenticated, user, navigate]);

  useEffect(() => {
    if (selectedConversation && user) {
      loadMessages(selectedConversation.id);
      // Mark messages as read when viewing conversation
      apiService.markMessagesAsRead(selectedConversation.id, user.id).catch(console.error);
    }
  }, [selectedConversation, user]);

  useEffect(() => {
    // Auto-scroll to bottom when messages are loaded (not loading)
    if (!messagesLoading && messages.length > 0) {
      // Use setTimeout to ensure DOM has updated
      const timer = setTimeout(() => {
        scrollToBottom();
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [messages, messagesLoading]);

  const scrollToBottom = () => {
    // Scroll only the messages list container, not the whole page
    if (messagesListRef.current) {
      messagesListRef.current.scrollTop = messagesListRef.current.scrollHeight;
    } else if (messagesEndRef.current) {
      // Fallback: only scroll if we're already near the bottom
      const container = messagesEndRef.current.closest('.messages-list');
      if (container) {
        const isNearBottom = container.scrollHeight - container.scrollTop - container.clientHeight < 200;
        if (isNearBottom) {
          messagesEndRef.current.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        }
      }
    }
  };

  const loadConversations = async () => {
    if (!user) return;
    try {
      setLoading(true);
      const data = await apiService.getConversations(user.id);
      setConversations(data);
      
      // If we have a conversationId in state, select it
      if (location.state?.conversationId) {
        const conv = data.find(c => c.id === location.state.conversationId);
        if (conv) {
          setSelectedConversation(conv);
        }
      }
    } catch (error) {
      console.error('Failed to load conversations:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadMessages = async (conversationId: number) => {
    if (!user) return;
    try {
      setMessagesLoading(true);
      const data = await apiService.getConversationMessages(conversationId, user.id);
      setMessages(data);
      // Scroll to bottom after messages are loaded
      setTimeout(() => {
        scrollToBottom();
      }, 150);
    } catch (error) {
      console.error('Failed to load messages:', error);
    } finally {
      setMessagesLoading(false);
    }
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim() || !selectedConversation || !user || sending) return;

    const messageContent = newMessage.trim();
    setNewMessage('');
    setSending(true);

    try {
      const sentMessage = await apiService.sendMessage(
        selectedConversation.id,
        user.id,
        messageContent
      );
      
      // Add message to local state immediately
      // Ensure sender has phone field
      const messageWithSender: Message = {
        ...sentMessage,
        sender: sentMessage.sender ? {
          id: sentMessage.sender.id,
          name: sentMessage.sender.name,
          phone: (sentMessage.sender as any).phone || user?.phone || '',
          email: (sentMessage.sender as any).email,
        } : undefined,
      };
      setMessages(prev => [...prev, messageWithSender]);
      
      // Update conversation's last_message
      setConversations(prev => prev.map(conv => 
        conv.id === selectedConversation.id
          ? {
              ...conv,
              last_message: {
                id: sentMessage.id,
                content: sentMessage.content,
                created_at: sentMessage.created_at,
                sender_id: sentMessage.sender_id,
              },
              updated_at: sentMessage.created_at,
            }
          : conv
      ));
    } catch (error) {
      console.error('Failed to send message:', error);
      alert('Failed to send message. Please try again.');
      setNewMessage(messageContent); // Restore message on error
    } finally {
      setSending(false);
    }
  };

  const formatTime = (dateString: string): string => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString();
  };

  const formatMessageTime = (dateString: string): string => {
    const date = new Date(dateString);
    return date.toLocaleTimeString('en-US', { 
      hour: 'numeric', 
      minute: '2-digit',
      hour12: true 
    });
  };

  // Parse product card from message content
  const parseProductCard = (content: string): {
    text: string;
    productName?: string;
    productPrice?: string;
    productImage?: string;
  } | null => {
    // Check if message contains product card format
    const productNameMatch = content.match(/📦\s*(.+?)(?:\n|$)/);
    const productPriceMatch = content.match(/💰\s*(.+?)(?:\n|$)/);
    const productImageMatch = content.match(/🖼️\s*(.+?)(?:\n|$)/);
    
    if (productNameMatch || productPriceMatch || productImageMatch) {
      const text = content.split('\n\n')[0] || content.split('\n')[0] || '';
      return {
        text: text.trim(),
        productName: productNameMatch?.[1]?.trim(),
        productPrice: productPriceMatch?.[1]?.trim(),
        productImage: productImageMatch?.[1]?.trim(),
      };
    }
    return null;
  };

  if (!isAuthenticated || !user) {
    return null;
  }

  if (loading) {
    return (
      <div className="messages-page">
        <Loader />
      </div>
    );
  }

  return (
    <div className="messages-page">
      <div className="messages-container">
        {/* Conversations Sidebar */}
        <div className={`conversations-sidebar ${!showConversationsList ? 'hidden-mobile' : ''}`}>
          <div className="conversations-header">
            <h2>Messages</h2>
          </div>
          <div className="conversations-list">
            {conversations.length === 0 ? (
              <div className="no-conversations">
                <p>No conversations yet.</p>
                <p className="hint">Start chatting with sellers from product pages!</p>
              </div>
            ) : (
              conversations.map((conv) => {
                const otherUser = conv.other_user || conv.participants.find(p => p.id !== user.id);
                const isSelected = selectedConversation?.id === conv.id;
                
                return (
                  <button
                    key={conv.id}
                    className={`conversation-item ${isSelected ? 'active' : ''} ${!conv.is_read ? 'unread' : ''}`}
                    onClick={() => {
                      setSelectedConversation(conv);
                      setShowConversationsList(false);
                    }}
                  >
                    <div className="conversation-avatar">
                      {otherUser?.name?.[0]?.toUpperCase() || 'U'}
                    </div>
                    <div className="conversation-info">
                      <div className="conversation-header-row">
                        <span className="conversation-name">
                          {otherUser?.name || 'Unknown User'}
                        </span>
                        {conv.last_message && (
                          <span className="conversation-time">
                            {formatTime(conv.last_message.created_at)}
                          </span>
                        )}
                      </div>
                      {conv.last_message && (
                        <p className="conversation-preview">
                          {conv.last_message.content.length > 50
                            ? `${conv.last_message.content.substring(0, 50)}...`
                            : conv.last_message.content}
                        </p>
                      )}
                    </div>
                    {!conv.is_read && <div className="unread-indicator" />}
                  </button>
                );
              })
            )}
          </div>
        </div>

        {/* Chat Area */}
        <div className={`chat-area ${showConversationsList && !selectedConversation ? 'hidden-mobile' : ''}`}>
          {selectedConversation ? (
            <>
              {/* Chat Header */}
              <div className="chat-header">
                <button
                  className="back-to-conversations-btn"
                  onClick={() => setShowConversationsList(true)}
                  aria-label="Back to conversations"
                >
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <polyline points="15 18 9 12 15 6"></polyline>
                  </svg>
                </button>
                {(() => {
                  const otherUser = selectedConversation.other_user || 
                    selectedConversation.participants.find(p => p.id !== user.id);
                  return (
                    <>
                      <div className="chat-header-user">
                        <div className="chat-avatar">
                          {otherUser?.name?.[0]?.toUpperCase() || 'U'}
                        </div>
                        <div>
                          <h3>{otherUser?.name || 'Unknown User'}</h3>
                          <p className="chat-status">Online</p>
                        </div>
                      </div>
                    </>
                  );
                })()}
              </div>

              {/* Messages List */}
              <div className="messages-list" ref={messagesListRef}>
                {messagesLoading ? (
                  <div className="messages-loading">
                    <Loader />
                  </div>
                ) : messages.length === 0 ? (
                  <div className="no-messages">
                    <p>No messages yet. Start the conversation!</p>
                  </div>
                ) : (
                  messages.map((message) => {
                    const isOwn = message.sender_id === user.id;
                    const productCard = message.content ? parseProductCard(message.content) : null;
                    
                    return (
                      <div
                        key={message.id}
                        className={`message-item ${isOwn ? 'own' : 'other'}`}
                      >
                        <div className="message-content">
                          {productCard ? (
                            <>
                              {productCard.text && (
                                <p className="message-text">{productCard.text}</p>
                              )}
                              <div className="product-card-message">
                                {productCard.productImage && (
                                  <img
                                    src={getImageUrl(productCard.productImage)}
                                    alt={productCard.productName || 'Product'}
                                    className="product-card-image"
                                    onError={(e) => {
                                      e.currentTarget.style.display = 'none';
                                    }}
                                  />
                                )}
                                <div className="product-card-info">
                                  {productCard.productName && (
                                    <h4 className="product-card-name">{productCard.productName}</h4>
                                  )}
                                  {productCard.productPrice && (
                                    <p className="product-card-price">{productCard.productPrice}</p>
                                  )}
                                </div>
                              </div>
                            </>
                          ) : (
                            message.content && (
                              <p className="message-text">{message.content}</p>
                            )
                          )}
                          {message.file && (
                            <div className="message-file">
                              {message.file_type?.startsWith('image/') ? (
                                <img
                                  src={getImageUrl(message.file)}
                                  alt={message.file_name || 'Attachment'}
                                  className="message-image"
                                />
                              ) : (
                                <a
                                  href={getImageUrl(message.file)}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="message-file-link"
                                >
                                  📎 {message.file_name || 'File'}
                                </a>
                              )}
                            </div>
                          )}
                          <span className="message-time">
                            {formatMessageTime(message.created_at)}
                          </span>
                        </div>
                      </div>
                    );
                  })
                )}
                <div ref={messagesEndRef} />
              </div>

              {/* Message Input */}
              <form className="message-input-form" onSubmit={handleSendMessage}>
                <input
                  type="text"
                  className="message-input"
                  placeholder="Type a message..."
                  value={newMessage}
                  onChange={(e) => setNewMessage(e.target.value)}
                  disabled={sending}
                />
                <button
                  type="submit"
                  className="send-button"
                  disabled={!newMessage.trim() || sending}
                >
                  {sending ? (
                    <Loader />
                  ) : (
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <line x1="22" y1="2" x2="11" y2="13"></line>
                      <polygon points="22 2 15 22 11 13 2 9 22 2"></polygon>
                    </svg>
                  )}
                </button>
              </form>
            </>
          ) : (
            <div className="no-conversation-selected">
              <div className="empty-state">
                <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
                </svg>
                <h3>Select a conversation</h3>
                <p>Choose a conversation from the sidebar to start chatting</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

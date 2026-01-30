import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { apiService, type CommentItem } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { getImageUrl, handleImageError } from '../utils/imageUtils';
import { Loader } from '../components/Loader';
import './Ads.css';

interface ExpiringPost {
  id: number;
  seller_id: number;
  seller_name: string;
  seller_image?: string;
  content: string;
  image?: string;
  expires_at: string;
  likes_count: number;
  comments_count: number;
  is_liked: boolean;
  created_at: string;
  product_id?: number;
}

export function Ads() {
  const { user, isAuthenticated } = useAuth();
  const [posts, setPosts] = useState<ExpiringPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);

  // Comments modal state
  const [activePostId, setActivePostId] = useState<number | null>(null);
  const [comments, setComments] = useState<CommentItem[]>([]);
  const [commentsLoading, setCommentsLoading] = useState(false);
  const [commentsError, setCommentsError] = useState<string | null>(null);
  const [newComment, setNewComment] = useState('');
  const [submittingComment, setSubmittingComment] = useState(false);
  const [replyToCommentId, setReplyToCommentId] = useState<number | null>(null);
  const [replyText, setReplyText] = useState('');
  const [submittingReplyId, setSubmittingReplyId] = useState<number | null>(null);
  const [likingPostId, setLikingPostId] = useState<number | null>(null);
  const [likingCommentId, setLikingCommentId] = useState<number | null>(null);

  const getSellerInitial = (name: unknown) => {
    const s = typeof name === 'string' ? name.trim() : '';
    return (s[0] || '?').toUpperCase();
  };

  const closeComments = () => {
    setActivePostId(null);
    setComments([]);
    setCommentsError(null);
    setCommentsLoading(false);
    setNewComment('');
    setReplyToCommentId(null);
    setReplyText('');
    setSubmittingReplyId(null);
  };

  const extractCommentText = (c: CommentItem) => String(c.comment ?? c.message ?? '');

  const loadComments = async (postId: number, productId?: number) => {
    setCommentsLoading(true);
    setCommentsError(null);
    try {
      const res = await apiService.getExpiringPostComments(postId, productId);
      const list = Array.isArray(res?.data) ? res.data : [];
      setComments(list);
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Failed to load comments';
      setCommentsError(msg);
      setComments([]);
    } finally {
      setCommentsLoading(false);
    }
  };

  const openComments = async (post: ExpiringPost) => {
    setActivePostId(post.id);
    await loadComments(post.id, post.product_id);
  };

  const toggleLikePost = async (post: ExpiringPost) => {
    if (likingPostId === post.id) return;
    setLikingPostId(post.id);
    try {
      const res = await apiService.toggleLikeExpiringPost(post.id);
      setPosts((prev) =>
        prev.map((p) => {
          if (p.id !== post.id) return p;
          // Always use the API response values if available
          const nextLiked = typeof res?.is_liked === 'boolean' ? res.is_liked : !p.is_liked;
          // Use API response likes_count if available, otherwise calculate based on toggle
          const nextLikes =
            typeof res?.likes_count === 'number'
              ? res.likes_count
              : p.is_liked
              ? Math.max(0, p.likes_count - 1) // If currently liked, unliking decreases count
              : p.likes_count + 1; // If not liked, liking increases count
          return { ...p, is_liked: nextLiked, likes_count: Math.max(0, nextLikes) };
        }),
      );
    } catch (e) {
      console.error('Failed to like post', e);
      setCommentsError(e instanceof Error ? e.message : 'Failed to like post');
    } finally {
      setLikingPostId(null);
    }
  };

  const toggleLikeComment = async (commentId: number) => {
    if (likingCommentId === commentId) return;
    setLikingCommentId(commentId);
    try {
      await apiService.toggleLikeComment(commentId);
      if (activePostId) {
        const post = posts.find((p) => p.id === activePostId);
        await loadComments(activePostId, post?.product_id);
      }
    } catch (e) {
      console.error('Failed to like comment', e);
      setCommentsError(e instanceof Error ? e.message : 'Failed to like comment');
    } finally {
      setLikingCommentId(null);
    }
  };

  const submitComment = async () => {
    if (!activePostId) return;
    const text = newComment.trim();
    if (!text) return;
    if (submittingComment) return;

    setSubmittingComment(true);
    setCommentsError(null);
    try {
      await apiService.addExpiringPostComment(activePostId, {
        user_id: user?.id,
        comment: text,
      });
      setNewComment('');
      const post = posts.find((p) => p.id === activePostId);
      await loadComments(activePostId, post?.product_id);
      // Best-effort update of the post's comment counter
      setPosts((prev) =>
        prev.map((p) => (p.id === activePostId ? { ...p, comments_count: p.comments_count + 1 } : p)),
      );
    } catch (e) {
      console.error('Failed to add comment', e);
      setCommentsError(e instanceof Error ? e.message : 'Failed to add comment');
    } finally {
      setSubmittingComment(false);
    }
  };

  const submitReply = async (commentId: number) => {
    const text = replyText.trim();
    if (!text) return;
    if (submittingReplyId === commentId) return;

    setSubmittingReplyId(commentId);
    setCommentsError(null);
    try {
      await apiService.replyToComment(commentId, {
        user_id: user?.id,
        comment: text,
      });
      setReplyText('');
      setReplyToCommentId(null);
      if (activePostId) {
        const post = posts.find((p) => p.id === activePostId);
        await loadComments(activePostId, post?.product_id);
      }
    } catch (e) {
      console.error('Failed to reply', e);
      setCommentsError(e instanceof Error ? e.message : 'Failed to reply');
    } finally {
      setSubmittingReplyId(null);
    }
  };

  useEffect(() => {
    // Only load posts if user is authenticated
    if (isAuthenticated) {
      loadPosts();
    } else {
      setLoading(false);
    }
  }, [page, isAuthenticated]);

  useEffect(() => {
    if (!activePostId) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeComments();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [activePostId]);

  const loadPosts = async () => {
    if (!isAuthenticated) {
      return;
    }

    if (page === 1) {
      setLoading(true);
    }
    setError(null);
    try {
      const response = await apiService.getExpiringPosts({
        page,
        user_id: user?.id,
      });
      const postsData = response.data || [];

      if (page === 1) {
        setPosts(postsData);
      } else {
        setPosts((prev) => [...prev, ...postsData]);
      }
      setHasMore(page < response.last_page);
    } catch (err) {
      console.error('Failed to load expiring posts:', err);
      const errorMessage = err instanceof Error ? err.message : 'Failed to load ads. Please try again later.';
      
      // Check if error is about user_id being required (not logged in)
      if (errorMessage.toLowerCase().includes('user id') || errorMessage.toLowerCase().includes('user_id')) {
        setError(null); // Don't show error, show login prompt instead
      } else {
        setError(errorMessage);
      }
      
      if (page === 1) {
        setPosts([]);
      }
      setHasMore(false);
    } finally {
      setLoading(false);
    }
  };

  const formatTimeRemaining = (expiresAt: string): string => {
    const now = new Date();
    const expires = new Date(expiresAt);
    const diff = expires.getTime() - now.getTime();

    if (diff <= 0) {
      return 'Expired';
    }

    const hours = Math.floor(diff / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));

    if (hours > 24) {
      const days = Math.floor(hours / 24);
      return `${days} day${days > 1 ? 's' : ''} left`;
    } else if (hours > 0) {
      return `${hours}h ${minutes}m left`;
    } else {
      return `${minutes}m left`;
    }
  };

  // Show login prompt if not authenticated
  if (!isAuthenticated) {
    return (
      <div className="ads-page">
        <div className="ads-container">
          <div className="ads-login-prompt">
            <div className="ads-login-icon">
              <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
                <circle cx="12" cy="7" r="4"></circle>
              </svg>
            </div>
            <h2 className="ads-login-title">Please Login to Access Ads</h2>
            <p className="ads-login-message">
              Sign in to your account to view expiring ads and limited-time offers from sellers.
            </p>
            <div className="ads-login-actions">
              <Link to="/login" className="ads-login-btn ads-login-btn-primary">
                Login
              </Link>
              <Link to="/register" className="ads-login-btn ads-login-btn-secondary">
                Sign Up
              </Link>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="ads-page">
      <div className="ads-container">
        <h1 className="ads-title">Expiring Ads</h1>
        <p className="ads-subtitle">Limited time offers from sellers</p>

        {loading && posts.length === 0 ? (
          <Loader />
        ) : error ? (
          <div className="ads-error">
            <div className="ads-error-title">Error Loading Ads</div>
            <div className="ads-error-message">{error}</div>
            <div className="ads-error-actions">
              <button onClick={() => loadPosts()} className="retry-btn">
                Retry
              </button>
              <button 
                onClick={() => {
                  console.log('API Base URL:', import.meta.env.VITE_API_BASE_URL || 'https://sagenashi.com/api/v3');
                  console.log('Current user:', user);
                }} 
                className="retry-btn"
                style={{ marginLeft: '0.5rem', background: '#7f8c8d' }}
              >
                Debug Info
              </button>
            </div>
          </div>
        ) : posts.length === 0 ? (
          <div className="ads-empty">No expiring ads available at the moment.</div>
        ) : (
          <>
            <div className="ads-feed">
              {posts.map((post) => (
                <article key={post.id} className="ad-card">
                  <div className="ad-header">
                    <Link
                      to={`/sellers/${post.seller_id}`}
                      className="ad-seller-info"
                    >
                      {post.seller_image ? (
                        <img
                          src={getImageUrl(post.seller_image)}
                          alt={post.seller_name}
                          className="ad-seller-avatar"
                          onError={handleImageError}
                          loading="lazy"
                        />
                      ) : (
                        <div className="ad-seller-avatar-placeholder">
                          {getSellerInitial(post.seller_name)}
                        </div>
                      )}
                      <div className="ad-seller-details">
                        <span className="ad-seller-name">{post.seller_name || 'Ocean Seller'}</span>
                        <span className="ad-time">
                          {new Date(post.created_at).toLocaleDateString()}
                        </span>
                      </div>
                    </Link>
                    <div className="ad-expires-badge">
                      {formatTimeRemaining(post.expires_at)}
                    </div>
                  </div>

                  {post.content && (
                    <div className="ad-content">{post.content}</div>
                  )}

                  {post.image && (
                    <div className="ad-image-container">
                      <img
                        src={getImageUrl(post.image)}
                        alt="Ad"
                        className="ad-image"
                        onError={handleImageError}
                        loading="lazy"
                      />
                    </div>
                  )}

                  <div className="ad-footer">
                    <div className="ad-stats">
                      <button
                        type="button"
                        className={`ad-stat ad-stat-btn ${post.is_liked ? 'ad-stat-btn-liked' : ''}`}
                        onClick={() => toggleLikePost(post)}
                        disabled={likingPostId === post.id}
                        aria-label={post.is_liked ? 'Unlike post' : 'Like post'}
                        title={post.is_liked ? 'Unlike' : 'Like'}
                      >
                        <svg
                          width="18"
                          height="18"
                          viewBox="0 0 24 24"
                          fill={post.is_liked ? 'currentColor' : 'none'}
                          stroke="currentColor"
                          strokeWidth="2"
                        >
                          <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"></path>
                        </svg>
                        {post.likes_count}
                      </button>
                      <button
                        type="button"
                        className="ad-stat ad-stat-btn"
                        onClick={() => openComments(post)}
                        aria-label="Open comments"
                        title="Comments"
                      >
                        <svg
                          width="18"
                          height="18"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                        >
                          <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
                        </svg>
                        {post.comments_count}
                      </button>
                    </div>
                    <Link
                      to={`/sellers/${post.seller_id}`}
                      className="ad-view-seller-btn"
                    >
                      View Seller
                    </Link>
                  </div>
                </article>
              ))}
            </div>

            {hasMore && (
              <button
                onClick={() => setPage((p) => p + 1)}
                className="load-more-btn"
                disabled={loading}
              >
                {loading ? 'Loading...' : 'Load More Ads'}
              </button>
            )}
          </>
        )}
      </div>

      {activePostId && (
        <div
          className="ads-modal-overlay"
          role="dialog"
          aria-modal="true"
          onClick={closeComments}
        >
          <div className="ads-modal" onClick={(e) => e.stopPropagation()}>
            <div className="ads-modal-header">
              <div className="ads-modal-title">Comments</div>
              <button type="button" className="ads-modal-close" onClick={closeComments} aria-label="Close">
                ×
              </button>
            </div>

            {commentsError && <div className="ads-modal-error">{commentsError}</div>}

            <div className="ads-modal-body">
              {commentsLoading ? (
                <Loader />
              ) : comments.length === 0 ? (
                <div className="ads-modal-empty">No comments yet. Be the first to comment.</div>
              ) : (
                <div className="ads-comments-list">
                  {comments.map((c) => (
                    <div key={c.id} className="ads-comment">
                      <div className="ads-comment-meta">
                        <div className="ads-comment-author">{c.user_name || `User ${c.user_id ?? ''}`.trim()}</div>
                        {c.created_at && (
                          <div className="ads-comment-time">
                            {new Date(c.created_at).toLocaleString()}
                          </div>
                        )}
                      </div>
                      <div className="ads-comment-text">{extractCommentText(c)}</div>
                      <div className="ads-comment-actions">
                        <button
                          type="button"
                          className="ads-comment-action"
                          onClick={() => toggleLikeComment(c.id)}
                          disabled={likingCommentId === c.id}
                        >
                          Like{typeof c.likes_count === 'number' ? ` (${c.likes_count})` : ''}
                        </button>
                        <button
                          type="button"
                          className="ads-comment-action"
                          onClick={() => setReplyToCommentId((prev) => (prev === c.id ? null : c.id))}
                        >
                          Reply
                        </button>
                      </div>

                      {replyToCommentId === c.id && (
                        <div className="ads-reply-box">
                          <textarea
                            className="ads-textarea"
                            rows={2}
                            placeholder="Write a reply…"
                            value={replyText}
                            onChange={(e) => setReplyText(e.target.value)}
                          />
                          <div className="ads-reply-actions">
                            <button
                              type="button"
                              className="ads-btn-secondary"
                              onClick={() => {
                                setReplyToCommentId(null);
                                setReplyText('');
                              }}
                            >
                              Cancel
                            </button>
                            <button
                              type="button"
                              className="ads-btn-primary"
                              onClick={() => submitReply(c.id)}
                              disabled={submittingReplyId === c.id}
                            >
                              {submittingReplyId === c.id ? 'Sending…' : 'Send Reply'}
                            </button>
                          </div>
                        </div>
                      )}

                      {Array.isArray(c.replies) && c.replies.length > 0 && (
                        <div className="ads-replies">
                          {c.replies.map((r) => (
                            <div key={r.id} className="ads-reply">
                              <div className="ads-comment-meta">
                                <div className="ads-comment-author">{r.user_name || `User ${r.user_id ?? ''}`.trim()}</div>
                                {r.created_at && (
                                  <div className="ads-comment-time">
                                    {new Date(r.created_at).toLocaleString()}
                                  </div>
                                )}
                              </div>
                              <div className="ads-comment-text">{extractCommentText(r)}</div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="ads-modal-footer">
              <textarea
                className="ads-textarea"
                rows={3}
                placeholder="Add a comment…"
                value={newComment}
                onChange={(e) => setNewComment(e.target.value)}
              />
              <button
                type="button"
                className="ads-btn-primary"
                onClick={submitComment}
                disabled={submittingComment || newComment.trim().length === 0}
              >
                {submittingComment ? 'Posting…' : 'Post Comment'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}


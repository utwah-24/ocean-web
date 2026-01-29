import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { apiService } from '../services/api';
import { useAuth } from '../context/AuthContext';
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
}

export function Ads() {
  const { user, isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const [posts, setPosts] = useState<ExpiringPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);

  useEffect(() => {
    // Only load posts if user is authenticated
    if (isAuthenticated) {
      loadPosts();
    } else {
      setLoading(false);
    }
  }, [page, isAuthenticated]);

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
          <div className="ads-loading">Loading ads...</div>
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
                          src={post.seller_image}
                          alt={post.seller_name}
                          className="ad-seller-avatar"
                        />
                      ) : (
                        <div className="ad-seller-avatar-placeholder">
                          {post.seller_name.charAt(0).toUpperCase()}
                        </div>
                      )}
                      <div className="ad-seller-details">
                        <span className="ad-seller-name">{post.seller_name}</span>
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
                      <img src={post.image} alt="Ad" className="ad-image" />
                    </div>
                  )}

                  <div className="ad-footer">
                    <div className="ad-stats">
                      <span className="ad-stat">
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
                      </span>
                      <span className="ad-stat">
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
                      </span>
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
    </div>
  );
}


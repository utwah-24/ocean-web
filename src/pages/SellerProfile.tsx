import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { apiService } from '../services/api';
import type { Product } from '../services/api';
import { ProductCard } from '../components/ProductCard';
import { getImageUrl, handleImageError } from '../utils/imageUtils';
import { useAuth } from '../context/AuthContext';
import { Loader } from '../components/Loader';
import './SellerProfile.css';
import './Ads.css';

interface Seller {
  id: number;
  shop_name: string;
  shop_image?: string;
  cover_image?: string;
  about?: string;
  location?: string;
  total_orders?: number;
  average_rating?: number;
  total_ratings?: number;
  created_at?: string;
}

interface ExpiringPost {
  id: number;
  seller_id: number;
  seller_name?: string;
  seller_image?: string;
  title?: string;
  content: string;
  image?: string;
  expires_at: string;
  likes_count: number;
  comments_count: number;
  is_liked?: boolean;
  created_at: string;
}

export function SellerProfile() {
  const { id } = useParams<{ id: string }>();
  const sellerId = Number(id);
  const { user, isAuthenticated } = useAuth();

  const [seller, setSeller] = useState<Seller | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [expiringPosts, setExpiringPosts] = useState<ExpiringPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [postsLoading, setPostsLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<'products' | 'description' | 'info'>('products');
  const [isFollowing, setIsFollowing] = useState<boolean>(false);
  const [followLoading, setFollowLoading] = useState(false);
  const [shareMenuOpen, setShareMenuOpen] = useState(false);

  useEffect(() => {
    if (!sellerId) return;
    (async () => {
      try {
        const [sellerRes, productsRes] = await Promise.all([
          apiService['request']<any>(`/sellers/${sellerId}`),
          apiService.getSellerProducts(sellerId),
        ]);
        // Normalize seller data to handle different API response formats
        const normalizedSeller: Seller = {
          id: sellerRes?.id ?? sellerRes?.seller_id ?? 0,
          shop_name: sellerRes?.shop_name ?? sellerRes?.shopName ?? sellerRes?.name ?? 'Unknown Seller',
          shop_image: sellerRes?.shop_image ?? sellerRes?.shopImage ?? sellerRes?.image ?? undefined,
          cover_image: sellerRes?.cover_image ?? sellerRes?.coverImage ?? undefined,
          about: sellerRes?.about ?? sellerRes?.description ?? undefined,
          location: sellerRes?.location ?? undefined,
          total_orders: sellerRes?.total_orders ?? sellerRes?.totalOrders ?? undefined,
          average_rating: sellerRes?.average_rating ?? sellerRes?.averageRating ?? undefined,
          total_ratings: sellerRes?.total_ratings ?? sellerRes?.totalRatings ?? undefined,
          created_at: sellerRes?.created_at ?? sellerRes?.createdAt ?? sellerRes?.joined_at ?? sellerRes?.joinedAt ?? undefined,
        };
        setSeller(normalizedSeller);
        setProducts(productsRes.data || []);
      } catch (e) {
        console.error('Failed to load seller profile:', e);
      } finally {
        setLoading(false);
      }
    })();
  }, [sellerId]);

  useEffect(() => {
    if (!sellerId) return;
    (async () => {
      setPostsLoading(true);
      try {
        const response = await apiService.getExpiringPostsBySeller(sellerId, { page: 1 });
        setExpiringPosts(response.data || []);
      } catch (e) {
        console.error('Failed to load expiring posts:', e);
        setExpiringPosts([]);
      } finally {
        setPostsLoading(false);
      }
    })();
  }, [sellerId]);

  if (!id || Number.isNaN(sellerId)) {
    return <div className="seller-page">Invalid seller.</div>;
  }

  if (loading) {
    return (
      <div className="seller-page">
        <Loader />
      </div>
    );
  }

  if (!seller) {
    return <div className="seller-page">Seller not found.</div>;
  }

  const joinedDate = seller.created_at
    ? (() => {
        try {
          const date = new Date(seller.created_at);
          // Check if date is valid
          if (isNaN(date.getTime())) {
            return '—';
          }
          return date.toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'long',
            day: 'numeric'
          });
        } catch (e) {
          console.warn('Failed to parse created_at date:', seller.created_at, e);
          return '—';
        }
      })()
    : '—';

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

  const handleToggleFollow = async () => {
    if (!isAuthenticated || !user?.id || followLoading) return;
    
    // Optimistic update - change UI immediately
    const previousFollowState = isFollowing;
    setIsFollowing(!isFollowing);
    setFollowLoading(true);
    
    try {
      const res = await apiService.toggleFollowSeller(sellerId, user.id);
      // Update based on server response
      const newFollowingState = typeof res?.is_following === 'boolean' 
        ? res.is_following 
        : !previousFollowState;
      setIsFollowing(newFollowingState);
    } catch (e) {
      console.error('Failed to toggle follow:', e);
      // Revert to previous state on error
      setIsFollowing(previousFollowState);
    } finally {
      setFollowLoading(false);
    }
  };

  const handleShare = (platform: string) => {
    const url = window.location.href;
    const text = `Check out ${seller?.shop_name} on Ocean Web!`;
    
    switch (platform) {
      case 'whatsapp':
        window.open(`https://wa.me/?text=${encodeURIComponent(`${text}\n${url}`)}`, '_blank');
        break;
      case 'snapchat':
        window.open(`https://www.snapchat.com/scan?attachmentUrl=${encodeURIComponent(url)}`, '_blank');
        break;
      case 'instagram':
        // Instagram doesn't have direct web sharing, so we'll copy to clipboard
        navigator.clipboard.writeText(`${text}\n${url}`).then(() => {
          alert('Link copied! You can now paste it on Instagram.');
        });
        break;
    }
    setShareMenuOpen(false);
  };

  const toggleShareMenu = () => {
    setShareMenuOpen(!shareMenuOpen);
  };

  // Check if image is a default/placeholder
  const isDefaultImage = (imageUrl: string | undefined): boolean => {
    if (!imageUrl) return true;
    const defaultPatterns = [
      'default.png',
      'default.jpg',
      'placeholder',
      'no-image',
      'avatar-placeholder'
    ];
    return defaultPatterns.some(pattern => imageUrl.toLowerCase().includes(pattern));
  };

  const hasValidImage = seller?.shop_image && !isDefaultImage(seller.shop_image);

  return (
    <div className="seller-page">
      <style>{`
        .seller-avatar.default-icon {
          background: linear-gradient(135deg, #f7f8fa 0%, #e9ecef 100%);
          position: relative;
          overflow: hidden;
          display: flex;
          align-items: center;
          justify-content: center;
        }
        .seller-avatar.default-icon::before {
          content: '';
          position: absolute;
          top: 0;
          left: 0;
          width: 100%;
          height: 100%;
          background: linear-gradient(135deg, rgba(255, 107, 53, 0.1) 0%, rgba(255, 140, 66, 0.05) 100%);
        }
        .seller-avatar.default-icon svg {
          width: 55%;
          height: 55%;
          position: relative;
          z-index: 1;
          color: #9ca3af;
          stroke-width: 1.5;
          filter: drop-shadow(0 1px 2px rgba(0, 0, 0, 0.05));
        }
        @media (max-width: 480px) {
          .seller-avatar.default-icon svg {
            width: 50%;
            height: 50%;
            stroke-width: 1.75;
          }
        }
      `}</style>
      <div className="seller-hero">
        <div className="seller-hero-content">
          {hasValidImage ? (
            <img
              src={getImageUrl(seller.shop_image)}
              alt={seller.shop_name}
              className="seller-avatar"
              onError={(e) => {
                // Replace with icon on error
                const target = e.currentTarget;
                target.style.display = 'none';
                if (target.nextElementSibling) {
                  (target.nextElementSibling as HTMLElement).style.display = 'flex';
                }
              }}
              loading="lazy"
            />
          ) : null}
          <div 
            className="seller-avatar default-icon" 
            style={{ display: hasValidImage ? 'none' : 'flex' }}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
              <circle cx="12" cy="7" r="4"></circle>
            </svg>
          </div>
          <div className="seller-main-info">
            <h1 className="seller-name">{seller.shop_name}</h1>
            <p className="seller-tagline">
              Home of modern & stylish products.
            </p>
            <div className="seller-meta">
              <div className="seller-meta-item">
                <span className="meta-label">Location</span>
                <span className="meta-value">{seller.location || '—'}</span>
              </div>
              <div className="seller-meta-item">
                <span className="meta-label">Joined</span>
                <span className="meta-value">{joinedDate}</span>
              </div>
              <div className="seller-meta-item">
                <span className="meta-label">Total Products</span>
                <span className="meta-value">{products.length}</span>
              </div>
            </div>
          </div>
          <div className="seller-cta-right">
            <div className="seller-share-container">
              <button
                className="seller-share-btn"
                onClick={toggleShareMenu}
                onMouseEnter={() => setShareMenuOpen(true)}
                onMouseLeave={() => setShareMenuOpen(false)}
              >
                <span className="button-top">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="18" cy="5" r="3"></circle>
                    <circle cx="6" cy="12" r="3"></circle>
                    <circle cx="18" cy="19" r="3"></circle>
                    <line x1="8.59" y1="13.51" x2="15.42" y2="17.49"></line>
                    <line x1="15.41" y1="6.51" x2="8.59" y2="10.49"></line>
                  </svg>
                  Share
                </span>
              </button>
              {shareMenuOpen && (
                <div 
                  className="share-dropdown"
                  onMouseEnter={() => setShareMenuOpen(true)}
                  onMouseLeave={() => setShareMenuOpen(false)}
                >
                  <button
                    className="share-dropdown-item whatsapp"
                    onClick={() => handleShare('whatsapp')}
                  >
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
                    </svg>
                    WhatsApp
                  </button>
                  <button
                    className="share-dropdown-item snapchat"
                    onClick={() => handleShare('snapchat')}
                  >
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M12.206.793c.99 0 4.347.276 5.93 3.821.529 1.193.403 3.219.299 4.847l-.003.06c-.012.18-.022.345-.03.51.075.045.203.09.401.09.3-.016.659-.12 1.033-.301.165-.088.344-.104.464-.104.182 0 .359.029.509.09.45.149.734.479.734.838.015.449-.39.839-1.213 1.168-.089.029-.209.075-.344.119-.45.135-1.139.36-1.333.81-.09.224-.061.524.12.868l.015.015c.06.136 1.526 3.475 4.791 4.014.255.044.435.27.42.509 0 .075-.015.149-.045.225-.24.569-1.273.988-3.146 1.271-.059.091-.12.375-.164.57-.029.179-.074.36-.134.553-.076.271-.27.405-.555.405h-.03c-.135 0-.313-.031-.538-.074-.36-.075-.765-.135-1.273-.135-.3 0-.599.015-.913.074-.6.104-1.123.464-1.723.884-.853.599-1.826 1.288-3.294 1.288-.06 0-.119-.015-.18-.015h-.149c-1.468 0-2.427-.675-3.279-1.288-.599-.42-1.107-.779-1.707-.884-.314-.045-.629-.074-.928-.074-.54 0-.958.089-1.272.149-.211.043-.391.074-.54.074-.374 0-.523-.224-.583-.42-.061-.192-.09-.389-.135-.567-.046-.181-.105-.494-.166-.57-1.918-.222-2.95-.642-3.189-1.226-.031-.063-.052-.15-.055-.225-.015-.243.165-.465.42-.509 3.264-.54 4.73-3.879 4.791-4.02l.016-.029c.18-.345.224-.645.119-.869-.195-.434-.884-.658-1.332-.809-.121-.029-.24-.074-.346-.119-1.107-.435-1.257-.93-1.197-1.273.09-.479.674-.793 1.168-.793.146 0 .27.029.383.074.42.194.789.3 1.104.3.234 0 .384-.06.465-.105-.046-.435-.105-1.124-.119-1.814-.015-.735-.015-1.829.121-2.639 1.04-3.146 3.445-3.821 5.948-3.821h.06z"/>
                    </svg>
                    Snapchat
                  </button>
                  <button
                    className="share-dropdown-item instagram"
                    onClick={() => handleShare('instagram')}
                  >
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M12 0C8.74 0 8.333.015 7.053.072 5.775.132 4.905.333 4.14.63c-.789.306-1.459.717-2.126 1.384S.935 3.35.63 4.14C.333 4.905.131 5.775.072 7.053.012 8.333 0 8.74 0 12s.015 3.667.072 4.947c.06 1.277.261 2.148.558 2.913.306.788.717 1.459 1.384 2.126.667.666 1.336 1.079 2.126 1.384.766.296 1.636.499 2.913.558C8.333 23.988 8.74 24 12 24s3.667-.015 4.947-.072c1.277-.06 2.148-.262 2.913-.558.788-.306 1.459-.718 2.126-1.384.666-.667 1.079-1.335 1.384-2.126.296-.765.499-1.636.558-2.913.06-1.28.072-1.687.072-4.947s-.015-3.667-.072-4.947c-.06-1.277-.262-2.149-.558-2.913-.306-.789-.718-1.459-1.384-2.126C21.319 1.347 20.651.935 19.86.63c-.765-.297-1.636-.499-2.913-.558C15.667.012 15.26 0 12 0zm0 2.16c3.203 0 3.585.016 4.85.071 1.17.055 1.805.249 2.227.415.562.217.96.477 1.382.896.419.42.679.819.896 1.381.164.422.36 1.057.413 2.227.057 1.266.07 1.646.07 4.85s-.015 3.585-.074 4.85c-.061 1.17-.256 1.805-.421 2.227-.224.562-.479.96-.899 1.382-.419.419-.824.679-1.38.896-.42.164-1.065.36-2.235.413-1.274.057-1.649.07-4.859.07-3.211 0-3.586-.015-4.859-.074-1.171-.061-1.816-.256-2.236-.421-.569-.224-.96-.479-1.379-.899-.421-.419-.69-.824-.9-1.38-.165-.42-.359-1.065-.42-2.235-.045-1.26-.061-1.649-.061-4.844 0-3.196.016-3.586.061-4.861.061-1.17.255-1.814.42-2.234.21-.57.479-.96.9-1.381.419-.419.81-.689 1.379-.898.42-.166 1.051-.361 2.221-.421 1.275-.045 1.65-.06 4.859-.06l.045.03zm0 3.678c-3.405 0-6.162 2.76-6.162 6.162 0 3.405 2.76 6.162 6.162 6.162 3.405 0 6.162-2.76 6.162-6.162 0-3.405-2.76-6.162-6.162-6.162zM12 16c-2.21 0-4-1.79-4-4s1.79-4 4-4 4 1.79 4 4-1.79 4-4 4zm7.846-10.405c0 .795-.646 1.44-1.44 1.44-.795 0-1.44-.646-1.44-1.44 0-.794.646-1.439 1.44-1.439.793-.001 1.44.645 1.44 1.439z"/>
                    </svg>
                    Instagram
                  </button>
                </div>
              )}
            </div>
            <button
              className={`seller-follow-btn ${isFollowing ? 'following' : ''}`}
              onClick={handleToggleFollow}
              disabled={!isAuthenticated}
            >
              <span className="button-top">
                {isFollowing ? 'Following' : 'Follow'}
              </span>
            </button>
          </div>
        </div>
        <div className="seller-tabs">
          <button
            className={`seller-tab ${activeTab === 'products' ? 'active' : ''}`}
            onClick={() => setActiveTab('products')}
          >
            Seller Products
          </button>
          <button
            className={`seller-tab ${activeTab === 'description' ? 'active' : ''}`}
            onClick={() => setActiveTab('description')}
          >
            Description
          </button>
          <button
            className={`seller-tab ${activeTab === 'info' ? 'active' : ''}`}
            onClick={() => setActiveTab('info')}
          >
            Extra Info
          </button>
        </div>
      </div>

      {activeTab === 'products' && (
        <div className="seller-products-section">
          <div className="seller-products-header">
            <h2>Products from {seller.shop_name}</h2>
            <Link to="/" className="back-home-link">
              Back to home
            </Link>
          </div>
          {products.length === 0 ? (
            <div className="seller-products-empty">
              This seller has no products yet.
            </div>
          ) : (
            <div className="seller-products-grid">
              {products.map((p) => (
                <ProductCard key={p.id} product={p} />
              ))}
            </div>
          )}
        </div>
      )}

      {activeTab === 'description' && (
        <div className="seller-products-section">
          <div className="seller-products-header">
            <h2>About {seller.shop_name}</h2>
            <Link to="/" className="back-home-link">
              Back to home
            </Link>
          </div>
          <div className="seller-description">
            {seller.about ? (
              <div className="seller-description-content">
                <p style={{ whiteSpace: 'pre-wrap', lineHeight: '1.8', color: '#555' }}>
                  {seller.about}
                </p>
              </div>
            ) : (
              <div className="seller-products-empty">
                No description available for this seller.
              </div>
            )}
          </div>
        </div>
      )}

      {activeTab === 'info' && (
        <div className="seller-products-section">
          <div className="seller-products-header">
            <h2>Additional Information</h2>
            <Link to="/" className="back-home-link">
              Back to home
            </Link>
          </div>
          <div className="seller-info">
            <div className="seller-info-grid">
              <div className="seller-info-item">
                <span className="info-label">Location</span>
                <span className="info-value">{seller.location || '—'}</span>
              </div>
              <div className="seller-info-item">
                <span className="info-label">Joined</span>
                <span className="info-value">{joinedDate}</span>
              </div>
              <div className="seller-info-item">
                <span className="info-label">Total Products</span>
                <span className="info-value">{products.length}</span>
              </div>
              {seller.total_orders !== undefined && (
                <div className="seller-info-item">
                  <span className="info-label">Total Orders</span>
                  <span className="info-value">{seller.total_orders}</span>
                </div>
              )}
              {seller.average_rating !== undefined && (
                <div className="seller-info-item">
                  <span className="info-label">Average Rating</span>
                  <span className="info-value">
                    ⭐ {seller.average_rating.toFixed(1)}
                    {seller.total_ratings !== undefined && ` (${seller.total_ratings} ratings)`}
                  </span>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {activeTab === 'products' && expiringPosts.length > 0 && (
        <div className="seller-products-section">
          <div className="seller-products-header">
            <h2>Expiring Posts from {seller.shop_name}</h2>
          </div>
          <div className="ads-feed">
            {expiringPosts.map((post) => (
              <article key={post.id} className="ad-card">
                <div className="ad-header">
                  <div className="ad-seller-info">
                    {seller.shop_image ? (
                      <img
                        src={getImageUrl(seller.shop_image)}
                        alt={seller.shop_name}
                        className="ad-seller-avatar"
                        onError={handleImageError}
                        loading="lazy"
                      />
                    ) : (
                      <div className="ad-seller-avatar-placeholder">
                        {seller.shop_name?.[0]?.toUpperCase() || 'S'}
                      </div>
                    )}
                    <div className="ad-seller-details">
                      <span className="ad-seller-name">{seller.shop_name || 'Ocean Seller'}</span>
                      <span className="ad-time">
                        {new Date(post.created_at).toLocaleDateString()}
                      </span>
                    </div>
                  </div>
                  <div className="ad-expires-badge">
                    {formatTimeRemaining(post.expires_at)}
                  </div>
                </div>

                {post.title && (
                  <div className="ad-content" style={{ fontWeight: 600, marginBottom: '0.5rem' }}>
                    {post.title}
                  </div>
                )}

                {post.content && (
                  <div className="ad-content">{post.content}</div>
                )}

                {post.image && (
                  <div className="ad-image-container">
                    <img
                      src={getImageUrl(post.image)}
                      alt={post.title || 'Ad'}
                      className="ad-image"
                      onError={handleImageError}
                      loading="lazy"
                    />
                  </div>
                )}

                <div className="ad-footer">
                  <div className="ad-stats">
                    <div className="ad-stat">
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
                    </div>
                    <div className="ad-stat">
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
                    </div>
                  </div>
                </div>
              </article>
            ))}
          </div>
        </div>
      )}

      {postsLoading && (
        <div className="seller-products-section">
          <Loader />
        </div>
      )}
    </div>
  );
}



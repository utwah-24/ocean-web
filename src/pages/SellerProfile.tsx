import { useEffect, useState, useRef } from 'react';
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
  const [shareMenuOpen, setShareMenuOpen] = useState(false);
  const shareDropdownRef = useRef<HTMLDivElement>(null);
  const [isFollowing, setIsFollowing] = useState<boolean>(false);
  const [followLoading, setFollowLoading] = useState(false);

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

  const handleShare = async (platform: 'whatsapp' | 'snapchat' | 'instagram') => {
    // Close the menu after selecting an option
    setShareMenuOpen(false);
    
    const profileUrl = window.location.href;
    const sellerName = seller?.shop_name || 'This seller';
    const shareText = `Check out ${sellerName} on Ocean! 🛍️\n\nHome of modern & stylish products.\n\n${profileUrl}`;

    // Check if Web Share API is available
    if (navigator.share) {
      try {
        await navigator.share({
          title: `${sellerName} - Ocean`,
          text: shareText,
          url: profileUrl
        });
        return;
      } catch (error) {
        if ((error as Error).name === 'AbortError') {
          // User cancelled, do nothing
          return;
        }
        console.log('Native share failed, using fallback:', error);
      }
    }

    // Platform-specific fallbacks
    switch (platform) {
      case 'whatsapp':
        const whatsappUrl = `https://wa.me/?text=${encodeURIComponent(shareText)}`;
        window.open(whatsappUrl, '_blank');
        break;
      
      case 'snapchat':
        // Copy link for Snapchat
        try {
          await navigator.clipboard.writeText(shareText);
          alert('✅ Link copied to clipboard!\n\nYou can now paste it in Snapchat.');
        } catch {
          alert(`Share this link on Snapchat:\n\n${profileUrl}`);
        }
        break;
      
      case 'instagram':
        // Copy link for Instagram
        try {
          await navigator.clipboard.writeText(shareText);
          alert('✅ Link copied to clipboard!\n\nYou can now paste it in Instagram.');
        } catch {
          alert(`Share this link on Instagram:\n\n${profileUrl}`);
        }
        break;
    }
  };

  const toggleShareMenu = () => {
    setShareMenuOpen(!shareMenuOpen);
  };

  // Close share menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (shareDropdownRef.current && !shareDropdownRef.current.contains(event.target as Node)) {
        setShareMenuOpen(false);
      }
    };

    if (shareMenuOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('touchstart', handleClickOutside as any);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('touchstart', handleClickOutside as any);
    };
  }, [shareMenuOpen]);

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
            <div className="seller-action-buttons">
              <button
                className={`seller-follow-btn ${isFollowing ? 'following' : ''}`}
                onClick={handleToggleFollow}
                disabled={!isAuthenticated}
              >
                <span className="button-top">
                  {isFollowing ? 'Following' : 'Follow'}
                </span>
              </button>
              
              <div className="seller-share-dropdown" ref={shareDropdownRef}>
                <button 
                  className="seller-share-btn" 
                  title="Share profile"
                  onClick={toggleShareMenu}
                >
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="20" height="20">
                    <circle cx="18" cy="5" r="3"></circle>
                    <circle cx="6" cy="12" r="3"></circle>
                    <circle cx="18" cy="19" r="3"></circle>
                    <line x1="8.59" y1="13.51" x2="15.42" y2="17.49"></line>
                    <line x1="15.41" y1="6.51" x2="8.59" y2="10.49"></line>
                  </svg>
                  <span>Share</span>
                </button>
                <div className={`seller-share-menu ${shareMenuOpen ? 'open' : ''}`}>
                  <button onClick={() => handleShare('whatsapp')} className="share-menu-item share-whatsapp">
                    <svg viewBox="0 0 24 24" fill="currentColor" width="18" height="18">
                      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
                    </svg>
                    WhatsApp
                  </button>
                  <button onClick={() => handleShare('snapchat')} className="share-menu-item share-snapchat">
                    <svg viewBox="0 0 24 24" fill="currentColor" width="18" height="18">
                      <path d="M12.206.793c.99 0 4.347.276 5.93 3.821.529 1.193.403 3.219.299 4.847l-.003.06c-.012.18-.022.345-.03.51.075.045.203.09.401.09.3-.016.659-.12 1.033-.301.165-.088.344-.104.464-.104.182 0 .359.029.509.09.45.149.734.479.734.838.015.449-.39.839-1.213 1.168-.089.029-.209.075-.344.119-.45.135-1.139.36-1.333.81-.09.224-.061.524.12.868.304.604 1.134 1.468 2.39 2.495.36.299.509.524.509.733 0 .164-.12.314-.346.434-.254.134-.947.409-1.746.689-.27.105-.418.211-.418.314 0 .045.03.104.105.21l.015.015c.314.52.47 1.094.43 1.563-.045.509-.314 1.003-.838 1.093-1.005.194-1.62-.469-2.326-1.273-.839-.959-1.798-2.041-3.532-2.041-.314 0-.629.03-.928.074-.045 0-.075.03-.12.044l-.015.015c-.031.135-.136.345-.405.689-.509.629-1.109 1.124-1.914 1.123h-.015c-.809 0-1.424-.479-1.94-1.093-.364-.434-.853-1.483-.853-1.844 0-.254.165-.404.375-.404.09 0 .195.03.315.09.524.329.793.494 1.093.494.152 0 .315-.074.509-.238.434-.359.569-1.048.584-1.393 0-.104-.03-.164-.104-.209C6.778 16.48 6.28 15.98 5.84 15.42c-.449-.599-.569-1.348-.299-1.933.254-.524.734-.823 1.274-.823.09 0 .18.015.27.03l.015.015c.914.195 1.559.39 2.039.39.42 0 .704-.18.918-.39.18-.179.3-.404.359-.629.06-.18.075-.374.045-.554-.031-.18-.106-.359-.226-.509-.511-.658-1.245-1.05-2.01-1.124-.718-.06-1.348.151-1.827.421-.285.165-.479.255-.629.255-.149 0-.27-.06-.374-.195-.376-.464-.421-1.124-.15-1.654.301-.555.809-.975 1.439-1.125.631-.15 1.229-.03 1.708.346.18.136.331.255.465.345.195.12.391.18.601.18.435 0 .855-.255 1.229-.72.465-.58.676-1.395.571-2.205-.074-.555-.301-.959-.674-1.169-.3-.164-.645-.239-1.02-.239-.51 0-1.05.15-1.545.405-.421.194-.764.434-1.019.674-.255.239-.421.495-.524.779-.075.195-.15.375-.254.539-.241.405-.584.734-1.02.914-.435.18-.914.255-1.394.195-.404-.06-.749-.225-1.019-.524-.27-.301-.405-.675-.405-1.108 0-.495.181-1.005.526-1.529.286-.435.675-.795 1.139-1.079.465-.285 1.005-.51 1.575-.659.57-.15 1.154-.24 1.709-.24z"/>
                    </svg>
                    Snapchat
                  </button>
                  <button onClick={() => handleShare('instagram')} className="share-menu-item share-instagram">
                    <svg viewBox="0 0 24 24" fill="currentColor" width="18" height="18">
                      <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"/>
                    </svg>
                    Instagram
                  </button>
                </div>
              </div>
            </div>
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



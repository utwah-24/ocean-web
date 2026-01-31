import { useEffect, useState, useRef } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { apiService } from '../services/api';
import type { Product } from '../services/api';
import { ProductCard } from '../components/ProductCard';
import { getImageUrl } from '../utils/imageUtils';
import { Loader } from '../components/Loader';
import './SellerProfile.css';

interface WorkingHour {
  day_of_week: string;
  opening_time: string;
  closing_time: string;
  is_available: number;
}

interface SellerRating {
  id: number;
  rating: number;
  comment?: string;
  user_name?: string;
  created_at: string;
}

interface SellerOrder {
  id: number;
  order_number?: string;
  total_amount: string;
  status: string;
  created_at: string;
}

interface SellerData {
  id: number;
  user_id: number;
  name: string;
  about: string;
  shop_name: string;
  seller_name: string;
  seller_phone: string;
  escrow_phone: string | null;
  latitude: number | null;
  longitude: number | null;
  shop_image: string;
  cover_image: string;
  location: string | null;
  status: string;
  offers_delivery: boolean;
  is_private: boolean;
  can_view_content: boolean;
  cart_enabled: boolean;
  cart_feature_available: boolean;
  cart_products_enabled: boolean;
  is_escrow: boolean;
  is_verified: boolean;
  average_rating: number;
  total_ratings: number;
  total_orders: number;
  followers_count: number;
  follow_request_status: string | null;
  products: Product[];
  working_hours: WorkingHour[];
  seller_ratings: SellerRating[];
  seller_orders: SellerOrder[];
}

export function MyProfile() {
  const { isAuthenticated, user } = useAuth();
  const navigate = useNavigate();
  
  const [sellerData, setSellerData] = useState<SellerData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'products' | 'description' | 'info' | 'hours' | 'orders'>('products');
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [shareMenuOpen, setShareMenuOpen] = useState(false);
  const shareDropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isAuthenticated || !user) {
      navigate('/login');
      return;
    }

    const fetchSellerData = async () => {
      try {
        setLoading(true);
        setError(null);

        // Check if we have cached seller data in localStorage
        const cacheKey = `seller_data_${user.id}`;
        const cachedData = localStorage.getItem(cacheKey);
        
        if (cachedData) {
          try {
            const parsed = JSON.parse(cachedData);
            const cacheAge = Date.now() - parsed.timestamp;
            // Use cache if it's less than 5 minutes old
            if (cacheAge < 5 * 60 * 1000) {
              console.log('[MyProfile] Using cached seller data');
              setSellerData(parsed.data);
              setLoading(false);
              // Fetch fresh data in background
              fetchFreshData(user.id, cacheKey);
              return;
            }
          } catch (e) {
            console.warn('[MyProfile] Invalid cache data, fetching fresh');
          }
        }

        // No cache or expired, fetch fresh data
        await fetchFreshData(user.id, cacheKey);
      } catch (err) {
        console.error('[MyProfile] Error fetching seller data:', err);
        setError(err instanceof Error ? err.message : 'Failed to load shop information');
        setLoading(false);
      }
    };

    const fetchFreshData = async (userId: number, cacheKey: string) => {
      // Strategy: Try multiple approaches in parallel for fastest resolution
      const sellerIdFromUser = (user as any).seller_id || (user as any).sellerId || (user as any).seller?.id;
      
      console.log('[MyProfile] User ID:', userId, 'Seller ID from user:', sellerIdFromUser);

      try {
        let sellerData: SellerData;

        if (sellerIdFromUser) {
          // Fast path: we have seller_id, fetch directly
          console.log('[MyProfile] Fetching seller data using seller_id:', sellerIdFromUser);
          sellerData = await apiService.getSeller(sellerIdFromUser);
        } else {
          // Slower path: try user.id as seller_id directly first (common pattern)
          // This avoids fetching all sellers
          console.log('[MyProfile] Trying user.id as seller_id:', userId);
          try {
            sellerData = await apiService.getSeller(userId);
            
            // Verify this seller actually belongs to the logged-in user
            if (sellerData.user_id !== userId) {
              console.warn('[MyProfile] Seller found but user_id mismatch, searching...');
              throw new Error('User ID mismatch');
            }
          } catch (directErr) {
            // Last resort: search through sellers (slower)
            console.log('[MyProfile] Direct lookup failed, searching by user_id');
            const sellersResponse = await apiService.getAllSellers({ page: 1 });
            const sellers = sellersResponse.data || [];
            const mySeller = sellers.find((s: any) => 
              s.user_id === userId || s.userId === userId
            );
            
            if (!mySeller) {
              throw new Error('No seller profile found for this user');
            }
            
            console.log('[MyProfile] Found seller:', mySeller.id);
            sellerData = await apiService.getSeller(mySeller.id);
          }
        }

        console.log('[MyProfile] Seller data received');
        
        // Cache the data
        try {
          localStorage.setItem(cacheKey, JSON.stringify({
            data: sellerData,
            timestamp: Date.now()
          }));
        } catch (e) {
          console.warn('[MyProfile] Failed to cache data:', e);
        }
        
        setSellerData(sellerData);
        setLoading(false);
      } catch (err) {
        throw err;
      }
    };

    fetchSellerData();
  }, [isAuthenticated, user, navigate]);

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

  const handleRefresh = async () => {
    if (!user || isRefreshing) return;
    
    setIsRefreshing(true);
    const cacheKey = `seller_data_${user.id}`;
    
    // Clear cache
    localStorage.removeItem(cacheKey);
    
    // Fetch fresh data
    try {
      const sellerIdFromUser = (user as any).seller_id || (user as any).sellerId || user.id;
      const data = await apiService.getSeller(sellerIdFromUser);
      
      // Update cache
      localStorage.setItem(cacheKey, JSON.stringify({
        data: data,
        timestamp: Date.now()
      }));
      
      setSellerData(data);
    } catch (err) {
      console.error('[MyProfile] Error refreshing data:', err);
    } finally {
      setIsRefreshing(false);
    }
  };

  if (loading) {
    return (
      <div className="seller-page">
        <Loader />
      </div>
    );
  }

  if (error) {
    return (
      <div className="seller-page">
        <div className="error-message">
          <h2>Error Loading Shop Information</h2>
          <p>{error}</p>
          <Link to="/" className="back-home-link">Back to Home</Link>
        </div>
      </div>
    );
  }

  if (!sellerData) {
    return (
      <div className="seller-page">
        <div className="error-message">
          <h2>Shop Not Found</h2>
          <p>Unable to load your shop information.</p>
          <Link to="/" className="back-home-link">Back to Home</Link>
        </div>
      </div>
    );
  }

  const formatTime = (time: string): string => {
    try {
      const [hours, minutes] = time.split(':');
      const hour = parseInt(hours, 10);
      const ampm = hour >= 12 ? 'PM' : 'AM';
      const displayHour = hour % 12 || 12;
      return `${displayHour}:${minutes} ${ampm}`;
    } catch {
      return time;
    }
  };

  const handleShare = async (platform: 'whatsapp' | 'snapchat' | 'instagram') => {
    // Close the menu after selecting an option
    setShareMenuOpen(false);
    
    const profileUrl = window.location.href;
    const sellerName = sellerData?.shop_name || 'My Shop';
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
        try {
          await navigator.clipboard.writeText(shareText);
          alert('✅ Link copied to clipboard!\n\nYou can now paste it in Snapchat.');
        } catch {
          alert(`Share this link on Snapchat:\n\n${profileUrl}`);
        }
        break;
      
      case 'instagram':
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

  const hasValidImage = sellerData?.shop_image && !isDefaultImage(sellerData.shop_image);

  return (
    <>
      <style>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
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
      <div className="seller-page">
      {/* Hero Section */}
      <div className="seller-hero">
        <div className="seller-hero-content">
          {hasValidImage ? (
            <img
              src={getImageUrl(sellerData.shop_image)}
              alt={sellerData.shop_name}
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
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <h1 className="seller-name">{sellerData.shop_name}</h1>
              <button
                onClick={handleRefresh}
                disabled={isRefreshing}
                style={{
                  background: 'transparent',
                  border: 'none',
                  cursor: isRefreshing ? 'not-allowed' : 'pointer',
                  padding: '4px',
                  display: 'flex',
                  alignItems: 'center',
                  opacity: isRefreshing ? 0.5 : 0.7,
                  transition: 'opacity 0.2s'
                }}
                title="Refresh shop data"
                onMouseEnter={(e) => !isRefreshing && (e.currentTarget.style.opacity = '1')}
                onMouseLeave={(e) => !isRefreshing && (e.currentTarget.style.opacity = '0.7')}
              >
                <svg 
                  width="20" 
                  height="20" 
                  viewBox="0 0 24 24" 
                  fill="none" 
                  stroke="currentColor" 
                  strokeWidth="2"
                  style={{
                    animation: isRefreshing ? 'spin 1s linear infinite' : 'none'
                  }}
                >
                  <polyline points="23 4 23 10 17 10"></polyline>
                  <polyline points="1 20 1 14 7 14"></polyline>
                  <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"></path>
                </svg>
              </button>
            </div>
            <p className="seller-tagline">My Shop</p>
            <div className="seller-meta">
              <div className="seller-meta-item">
                <span className="meta-label">Status</span>
                <span className="meta-value" style={{ 
                  color: sellerData.status === 'Open' ? '#10b981' : '#ef4444',
                  fontWeight: 600 
                }}>
                  {sellerData.status}
                </span>
              </div>
              <div className="seller-meta-item">
                <span className="meta-label">Location</span>
                <span className="meta-value">{sellerData.location || '—'}</span>
              </div>
              <div className="seller-meta-item">
                <span className="meta-label">Products</span>
                <span className="meta-value">{sellerData.products?.length || 0}</span>
              </div>
              <div className="seller-meta-item">
                <span className="meta-label">Followers</span>
                <span className="meta-value">{sellerData.followers_count}</span>
              </div>
            </div>
            {/* Features */}
            <div className="seller-features" style={{ display: 'flex', gap: '8px', marginTop: '12px', flexWrap: 'wrap' }}>
              {sellerData.is_verified && (
                <span className="feature-badge" style={{ background: '#3b82f6', color: 'white', padding: '4px 12px', borderRadius: '12px', fontSize: '12px' }}>
                  ✓ Verified
                </span>
              )}
              {sellerData.offers_delivery && (
                <span className="feature-badge" style={{ background: '#10b981', color: 'white', padding: '4px 12px', borderRadius: '12px', fontSize: '12px' }}>
                  🚚 Delivery Available
                </span>
              )}
              {sellerData.is_escrow && (
                <span className="feature-badge" style={{ background: '#f59e0b', color: 'white', padding: '4px 12px', borderRadius: '12px', fontSize: '12px' }}>
                  🔒 Escrow
                </span>
              )}
              {sellerData.cart_enabled && (
                <span className="feature-badge" style={{ background: '#8b5cf6', color: 'white', padding: '4px 12px', borderRadius: '12px', fontSize: '12px' }}>
                  🛒 Cart Enabled
                </span>
              )}
            </div>
          </div>
          
          <div className="seller-cta-right">
            <div className="seller-action-buttons">
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
        
        {/* Tabs */}
        <div className="seller-tabs">
          <button
            className={`seller-tab ${activeTab === 'products' ? 'active' : ''}`}
            onClick={() => setActiveTab('products')}
          >
            Products ({sellerData.products?.length || 0})
          </button>
          <button
            className={`seller-tab ${activeTab === 'description' ? 'active' : ''}`}
            onClick={() => setActiveTab('description')}
          >
            About
          </button>
          <button
            className={`seller-tab ${activeTab === 'info' ? 'active' : ''}`}
            onClick={() => setActiveTab('info')}
          >
            Shop Info
          </button>
          <button
            className={`seller-tab ${activeTab === 'hours' ? 'active' : ''}`}
            onClick={() => setActiveTab('hours')}
          >
            Working Hours
          </button>
          <button
            className={`seller-tab ${activeTab === 'orders' ? 'active' : ''}`}
            onClick={() => setActiveTab('orders')}
          >
            Orders ({sellerData.total_orders})
          </button>
        </div>
      </div>

      {/* Products Tab */}
      {activeTab === 'products' && (
        <div className="seller-products-section">
          <div className="seller-products-header">
            <h2>My Products</h2>
            <Link to="/" className="back-home-link">
              Back to home
            </Link>
          </div>
          {!sellerData.products || sellerData.products.length === 0 ? (
            <div className="seller-products-empty">
              You haven't added any products yet.
            </div>
          ) : (
            <div className="seller-products-grid">
              {sellerData.products.map((product) => (
                <ProductCard key={product.id} product={product} />
              ))}
            </div>
          )}
        </div>
      )}

      {/* Description Tab */}
      {activeTab === 'description' && (
        <div className="seller-products-section">
          <div className="seller-products-header">
            <h2>About My Shop</h2>
            <Link to="/" className="back-home-link">
              Back to home
            </Link>
          </div>
          <div className="seller-description">
            {sellerData.about && sellerData.about !== 'no seller about' ? (
              <div className="seller-description-content">
                <p style={{ whiteSpace: 'pre-wrap', lineHeight: '1.8', color: '#555' }}>
                  {sellerData.about}
                </p>
              </div>
            ) : (
              <div className="seller-products-empty">
                No description available. Add a description to tell customers about your shop!
              </div>
            )}
          </div>
        </div>
      )}

      {/* Shop Info Tab */}
      {activeTab === 'info' && (
        <div className="seller-products-section">
          <div className="seller-products-header">
            <h2>Shop Information</h2>
            <Link to="/" className="back-home-link">
              Back to home
            </Link>
          </div>
          <div className="seller-info">
            <div className="seller-info-grid">
              <div className="seller-info-item">
                <span className="info-label">Shop Name</span>
                <span className="info-value">{sellerData.shop_name}</span>
              </div>
              <div className="seller-info-item">
                <span className="info-label">Seller Name</span>
                <span className="info-value">{sellerData.seller_name}</span>
              </div>
              <div className="seller-info-item">
                <span className="info-label">Phone</span>
                <span className="info-value">{sellerData.seller_phone || '—'}</span>
              </div>
              {sellerData.escrow_phone && (
                <div className="seller-info-item">
                  <span className="info-label">Escrow Phone</span>
                  <span className="info-value">{sellerData.escrow_phone}</span>
                </div>
              )}
              <div className="seller-info-item">
                <span className="info-label">Location</span>
                <span className="info-value">{sellerData.location || '—'}</span>
              </div>
              <div className="seller-info-item">
                <span className="info-label">Status</span>
                <span className="info-value" style={{ 
                  color: sellerData.status === 'Open' ? '#10b981' : '#ef4444',
                  fontWeight: 600 
                }}>
                  {sellerData.status}
                </span>
              </div>
              <div className="seller-info-item">
                <span className="info-label">Total Products</span>
                <span className="info-value">{sellerData.products?.length || 0}</span>
              </div>
              <div className="seller-info-item">
                <span className="info-label">Total Orders</span>
                <span className="info-value">{sellerData.total_orders}</span>
              </div>
              <div className="seller-info-item">
                <span className="info-label">Followers</span>
                <span className="info-value">{sellerData.followers_count}</span>
              </div>
              <div className="seller-info-item">
                <span className="info-label">Average Rating</span>
                <span className="info-value">
                  {sellerData.average_rating > 0 
                    ? `⭐ ${sellerData.average_rating.toFixed(1)} (${sellerData.total_ratings} ratings)`
                    : 'No ratings yet'}
                </span>
              </div>
              <div className="seller-info-item">
                <span className="info-label">Shop Privacy</span>
                <span className="info-value">{sellerData.is_private ? 'Private' : 'Public'}</span>
              </div>
              <div className="seller-info-item">
                <span className="info-label">Delivery</span>
                <span className="info-value">{sellerData.offers_delivery ? 'Available' : 'Not Available'}</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Working Hours Tab */}
      {activeTab === 'hours' && (
        <div className="seller-products-section">
          <div className="seller-products-header">
            <h2>Working Hours</h2>
            <Link to="/" className="back-home-link">
              Back to home
            </Link>
          </div>
          <div className="seller-info">
            {sellerData.working_hours && sellerData.working_hours.length > 0 ? (
              <div className="working-hours-list" style={{ maxWidth: '600px', margin: '0 auto' }}>
                {sellerData.working_hours.map((hour, index) => (
                  <div 
                    key={index} 
                    className="working-hour-item" 
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      padding: '16px',
                      borderBottom: '1px solid #e5e7eb',
                      opacity: hour.is_available ? 1 : 0.5
                    }}
                  >
                    <span style={{ fontWeight: 600, minWidth: '120px' }}>{hour.day_of_week}</span>
                    {hour.is_available ? (
                      <span style={{ color: '#10b981' }}>
                        {formatTime(hour.opening_time)} - {formatTime(hour.closing_time)}
                      </span>
                    ) : (
                      <span style={{ color: '#ef4444' }}>Closed</span>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <div className="seller-products-empty">
                No working hours information available.
              </div>
            )}
          </div>
        </div>
      )}

      {/* Orders Tab */}
      {activeTab === 'orders' && (
        <div className="seller-products-section">
          <div className="seller-products-header">
            <h2>Recent Orders</h2>
            <Link to="/" className="back-home-link">
              Back to home
            </Link>
          </div>
          <div className="seller-info">
            {sellerData.seller_orders && sellerData.seller_orders.length > 0 ? (
              <div className="orders-list" style={{ maxWidth: '800px', margin: '0 auto' }}>
                {sellerData.seller_orders.map((order) => (
                  <div 
                    key={order.id}
                    className="order-item"
                    style={{
                      padding: '16px',
                      borderBottom: '1px solid #e5e7eb',
                      display: 'grid',
                      gridTemplateColumns: '1fr 1fr 1fr',
                      gap: '16px'
                    }}
                  >
                    <div>
                      <div style={{ fontSize: '12px', color: '#6b7280' }}>Order #{order.order_number || order.id}</div>
                      <div style={{ fontWeight: 600, marginTop: '4px' }}>
                        TZS {parseFloat(order.total_amount).toLocaleString()}
                      </div>
                    </div>
                    <div>
                      <div style={{ fontSize: '12px', color: '#6b7280' }}>Status</div>
                      <div style={{ fontWeight: 600, marginTop: '4px' }}>{order.status}</div>
                    </div>
                    <div>
                      <div style={{ fontSize: '12px', color: '#6b7280' }}>Date</div>
                      <div style={{ marginTop: '4px' }}>
                        {new Date(order.created_at).toLocaleDateString()}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="seller-products-empty">
                No orders yet.
              </div>
            )}
          </div>
        </div>
      )}
    </div>
    </>
  );
}


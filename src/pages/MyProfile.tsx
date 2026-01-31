import { useEffect, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { apiService } from '../services/api';
import type { Product } from '../services/api';
import { ProductCard } from '../components/ProductCard';
import { getImageUrl } from '../utils/imageUtils';
import { Loader } from '../components/Loader';
import './SellerProfile.css';
import './MyProfile.css';

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
          
          // CRITICAL: Verify this seller actually belongs to the logged-in user
          if (sellerData.user_id !== userId) {
            console.warn('[MyProfile] Cached seller_id does not match user_id. Seller user_id:', sellerData.user_id, 'Logged in user_id:', userId);
            console.log('[MyProfile] Searching for correct seller...');
            // Clear the incorrect seller_id from user object
            const updatedUser = { ...user };
            delete (updatedUser as any).seller_id;
            delete (updatedUser as any).sellerId;
            localStorage.setItem('user', JSON.stringify(updatedUser));
            // Fall through to search logic
            throw new Error('Seller ID mismatch - searching for correct seller');
          }
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
            
            console.log('[MyProfile] Found seller:', mySeller.id, 'for user_id:', userId);
            sellerData = await apiService.getSeller(mySeller.id);
            
            // Double-check the seller belongs to this user
            if (sellerData.user_id !== userId) {
              throw new Error(`Seller ${mySeller.id} does not belong to user ${userId}`);
            }
            
            // Update user object with correct seller_id for future use
            const updatedUser = { ...user, seller_id: mySeller.id };
            localStorage.setItem('user', JSON.stringify(updatedUser));
          }
        }
        
        // Final verification before setting state
        if (sellerData.user_id !== userId) {
          throw new Error(`Fetched seller does not belong to logged-in user. Expected user_id: ${userId}, got: ${sellerData.user_id}`);
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

  const handleRefresh = async () => {
    if (!user || isRefreshing) return;
    
    setIsRefreshing(true);
    const cacheKey = `seller_data_${user.id}`;
    
    // Clear cache
    localStorage.removeItem(cacheKey);
    
    // Fetch fresh data using the same logic as initial fetch
    try {
      const sellerIdFromUser = (user as any).seller_id || (user as any).sellerId || (user as any).seller?.id;
      
      let sellerData: SellerData;

      if (sellerIdFromUser) {
        // Fast path: we have seller_id, fetch directly
        console.log('[MyProfile] Refresh: Fetching seller data using seller_id:', sellerIdFromUser);
        sellerData = await apiService.getSeller(sellerIdFromUser);
        
        // CRITICAL: Verify this seller belongs to the logged-in user
        if (sellerData.user_id !== user.id) {
          console.warn('[MyProfile] Refresh: Cached seller_id does not match user_id. Seller user_id:', sellerData.user_id, 'Logged in user_id:', user.id);
          console.log('[MyProfile] Refresh: Searching for correct seller...');
          // Clear the incorrect seller_id from user object
          const updatedUser = { ...user };
          delete (updatedUser as any).seller_id;
          delete (updatedUser as any).sellerId;
          localStorage.setItem('user', JSON.stringify(updatedUser));
          // Fall through to search logic
          throw new Error('Seller ID mismatch - searching for correct seller');
        }
      } else {
        // Try user.id as seller_id directly first
        console.log('[MyProfile] Refresh: Trying user.id as seller_id:', user.id);
        try {
          sellerData = await apiService.getSeller(user.id);
          
          // Verify this seller actually belongs to the logged-in user
          if (sellerData.user_id !== user.id) {
            console.warn('[MyProfile] Refresh: Seller found but user_id mismatch, searching...');
            throw new Error('User ID mismatch');
          }
        } catch (directErr) {
          // Last resort: search through sellers
          console.log('[MyProfile] Refresh: Direct lookup failed, searching by user_id');
          const sellersResponse = await apiService.getAllSellers({ page: 1 });
          const sellers = sellersResponse.data || [];
          const mySeller = sellers.find((s: any) => 
            s.user_id === user.id || s.userId === user.id
          );
          
          if (!mySeller) {
            throw new Error('No seller profile found for this user');
          }
          
          console.log('[MyProfile] Refresh: Found seller:', mySeller.id, 'for user_id:', user.id);
          sellerData = await apiService.getSeller(mySeller.id);
          
          // Double-check the seller belongs to this user
          if (sellerData.user_id !== user.id) {
            throw new Error(`Seller ${mySeller.id} does not belong to user ${user.id}`);
          }
          
          // Update user object with correct seller_id for future use
          const updatedUser = { ...user, seller_id: mySeller.id };
          localStorage.setItem('user', JSON.stringify(updatedUser));
        }
      }
      
      // Final verification before setting state
      if (sellerData.user_id !== user.id) {
        throw new Error(`Fetched seller does not belong to logged-in user. Expected user_id: ${user.id}, got: ${sellerData.user_id}`);
      }

      // Update cache
      localStorage.setItem(cacheKey, JSON.stringify({
        data: sellerData,
        timestamp: Date.now()
      }));
      
      setSellerData(sellerData);
    } catch (err) {
      console.error('[MyProfile] Error refreshing data:', err);
      setError(err instanceof Error ? err.message : 'Failed to refresh seller data');
    } finally {
      setIsRefreshing(false);
    }
  };

  const handleShare = (platform: string) => {
    const url = window.location.href;
    const text = `Check out ${sellerData?.shop_name} on Ocean Web!`;
    
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
                <div key={product.id} className="product-card-wrapper">
                  <ProductCard product={product} />
                  <button
                    onClick={() => navigate(`/edit-product/${product.id}`)}
                    className="product-edit-btn"
                    title="Edit product"
                  >
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                      <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
                    </svg>
                  </button>
                </div>
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

      {/* Floating Action Button */}
      <button
        onClick={() => navigate('/add-product')}
        className="fab-add-product"
        title="Add New Product"
      >
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <line x1="12" y1="5" x2="12" y2="19"></line>
          <line x1="5" y1="12" x2="19" y2="12"></line>
        </svg>
      </button>
    </div>
    </>
  );
}


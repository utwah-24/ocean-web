import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { apiService } from '../services/api';
import { Loader } from '../components/Loader';
import { getImageUrl, handleImageError } from '../utils/imageUtils';
import './Network.css';

interface Seller {
  id: number;
  shop_name: string;
  shop_image?: string;
  about?: string;
  location?: string;
  products_count?: number;
  followers_count?: number;
  is_following?: boolean;
}

export function Network() {
  const [sellers, setSellers] = useState<Seller[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);

  useEffect(() => {
    loadSellers();
  }, []);

  const loadSellers = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await apiService.getAllSellers();
      
      // Normalize the response
      const sellersData = response?.data || (response as any)?.sellers || response || [];
      const normalizedSellers = Array.isArray(sellersData) ? sellersData : [];
      
      setSellers(normalizedSellers);
      
      // Fetch follower counts for all sellers
      loadFollowerCounts(normalizedSellers);
    } catch (err) {
      console.error('Failed to load sellers:', err);
      setError('Failed to load sellers. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const loadFollowerCounts = async (sellersToUpdate: Seller[]) => {
    try {
      console.log('[Network] Loading follower counts for', sellersToUpdate.length, 'sellers');
      
      // Fetch follower counts for all sellers in parallel
      const followersPromises = sellersToUpdate.map(async (seller) => {
        try {
          const response = await apiService.getSellerFollowers(seller.id);
          console.log(`[Network] Full response for seller ${seller.id} (${seller.shop_name}):`, response);
          
          // Handle different response formats
          const followersCount = response?.total_followers || 
                                response?.followers?.total || 
                                (response as any)?.data?.total_followers ||
                                0;
          
          console.log(`[Network] Extracted followers count for seller ${seller.id}:`, followersCount);
          
          return {
            id: seller.id,
            followers_count: followersCount
          };
        } catch (err) {
          console.error(`Failed to load followers for seller ${seller.id}:`, err);
          return {
            id: seller.id,
            followers_count: seller.followers_count || 0 // Keep existing count if fetch fails
          };
        }
      });

      const followersData = await Promise.all(followersPromises);
      console.log('[Network] Follower data loaded:', followersData);
      
      // Update sellers with follower counts
      setSellers(prevSellers => {
        const updated = prevSellers.map(seller => {
          const followerData = followersData.find(f => f.id === seller.id);
          return followerData 
            ? { ...seller, followers_count: followerData.followers_count }
            : seller;
        });
        console.log('[Network] Updated sellers with follower counts:', updated);
        return updated;
      });
    } catch (err) {
      console.error('Failed to load follower counts:', err);
    }
  };

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!searchQuery.trim()) {
      loadSellers();
      return;
    }

    try {
      setIsSearching(true);
      setError(null);
      
      const response = await apiService.globalSearch(searchQuery.trim(), {
        type: 'all'
      });
      
      console.log('[Network] Search response:', response);
      
      // Normalize the response - API returns: { success: true, data: { sellers: [...], products: [], meta: {...} } }
      const responseData = (response as any)?.data || response;
      const sellersData = responseData?.sellers || [];
      const normalizedSellers = Array.isArray(sellersData) ? sellersData : [];
      
      console.log('[Network] Sellers found:', normalizedSellers.length);
      
      setSellers(normalizedSellers);
      
      // Fetch follower counts for search results
      loadFollowerCounts(normalizedSellers);
    } catch (err) {
      console.error('Failed to search sellers:', err);
      setError('Failed to search. Please try again.');
    } finally {
      setIsSearching(false);
    }
  };

  const handleClearSearch = () => {
    setSearchQuery('');
    loadSellers();
  };

  if (loading) {
    return (
      <div className="network-page">
        <Loader />
      </div>
    );
  }

  if (error) {
    return (
      <div className="network-page">
        <div className="network-error">
          <h2>Error</h2>
          <p>{error}</p>
          <button onClick={loadSellers} className="retry-btn">
            Try Again
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="network-page">
      <div className="network-container">
        <div className="network-header">
          <h1 className="network-title">Network</h1>
          <p className="network-subtitle">Discover and connect with sellers on Ocean</p>
          
          <form onSubmit={handleSearch} className="network-search-form">
            <div className="search-input-wrapper">
              <svg 
                className="search-icon" 
                width="20" 
                height="20" 
                viewBox="0 0 24 24" 
                fill="none" 
                stroke="currentColor" 
                strokeWidth="2"
              >
                <circle cx="11" cy="11" r="8"></circle>
                <path d="m21 21-4.35-4.35"></path>
              </svg>
              <input
                type="text"
                placeholder="Search sellers by name, location..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="network-search-input"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={handleClearSearch}
                  className="clear-search-btn"
                  aria-label="Clear search"
                >
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <line x1="18" y1="6" x2="6" y2="18"></line>
                    <line x1="6" y1="6" x2="18" y2="18"></line>
                  </svg>
                </button>
              )}
            </div>
            <button 
              type="submit" 
              className="network-search-btn"
              disabled={isSearching}
            >
              {isSearching ? 'Searching...' : 'Search'}
            </button>
          </form>
        </div>

        {sellers.length === 0 ? (
          <div className="network-empty">
            <p>No sellers found.</p>
          </div>
        ) : (
          <div className="sellers-grid">
            {sellers.map((seller) => (
              <Link
                key={seller.id}
                to={`/sellers/${seller.id}`}
                className="seller-card"
              >
                <div className="seller-card-header">
                  <div className="seller-card-avatar">
                    {seller.shop_image ? (
                      <img
                        src={getImageUrl(seller.shop_image)}
                        alt={seller.shop_name}
                        onError={handleImageError}
                      />
                    ) : (
                      <div className="seller-avatar-placeholder">
                        {seller.shop_name?.charAt(0).toUpperCase() || 'S'}
                      </div>
                    )}
                  </div>
                  <div className="seller-card-info">
                    <h3 className="seller-card-name">{seller.shop_name || 'Unknown Seller'}</h3>
                    {seller.location && (
                      <p className="seller-card-location">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path>
                          <circle cx="12" cy="10" r="3"></circle>
                        </svg>
                        {seller.location}
                      </p>
                    )}
                  </div>
                </div>

                {seller.about && (
                  <p className="seller-card-about">
                    {seller.about.length > 100
                      ? `${seller.about.substring(0, 100)}...`
                      : seller.about}
                  </p>
                )}

                <div className="seller-card-stats">
                  <div className="seller-stat">
                    <span className="stat-value">
                      {seller.products_count || 0}
                    </span>
                    <span className="stat-label">Products</span>
                  </div>
                  <div className="seller-stat">
                    <span className="stat-value">
                      {seller.followers_count || 0}
                    </span>
                    <span className="stat-label">Followers</span>
                  </div>
                </div>

                <div className="seller-card-footer">
                  <span className="view-profile-btn">View Profile</span>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}


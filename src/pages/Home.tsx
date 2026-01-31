import { useState, useEffect, useCallback } from 'react';
import { apiService } from '../services/api';
import type { Product, Category } from '../services/api';
import { ProductCard } from '../components/ProductCard';
import { Loader } from '../components/Loader';
import Hero1 from '../assets/Hero-1.svg';
import Hero2 from '../assets/Hero-2.svg';
import Hero3 from '../assets/Hero-3.svg';
import Hero4 from '../assets/Hero-4.svg';
import './Home.css';

const heroImages = [Hero1, Hero2, Hero3, Hero4];

// Custom debounce hook
function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    return () => {
      clearTimeout(handler);
    };
  }, [value, delay]);

  return debouncedValue;
}

export function Home() {
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<number | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [isSearching, setIsSearching] = useState(false);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [currentHeroIndex, setCurrentHeroIndex] = useState(0);
  const [searchMode, setSearchMode] = useState(false); // Track if we're in search mode
  
  // Debounce search query to reduce API calls
  const debouncedSearchQuery = useDebounce(searchQuery, 400);

  useEffect(() => {
    loadCategories();
  }, []);

  useEffect(() => {
    loadProducts();
  }, [page]);

  // Hero slideshow effect
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentHeroIndex((prev) => (prev + 1) % heroImages.length);
    }, 5000); // Change image every 5 seconds

    return () => clearInterval(interval);
  }, []);

  const loadCategories = async () => {
    try {
      const response = await apiService.getCategories();
      setCategories(response.data || []);
    } catch (error) {
      console.error('Failed to load categories:', error);
      // Set empty array on error so UI doesn't break
      setCategories([]);
    }
  };

  const loadProducts = async () => {
    setLoading(true);
    try {
      // Use personalized products API for homepage
      const response = await apiService.getPersonalizedProducts({
        page,
      });
      const productsData = response.data || [];

      if (page === 1) {
        setProducts(productsData);
      } else {
        setProducts((prev) => [...prev, ...productsData]);
      }
      setHasMore(page < (response.last_page || 1));
    } catch (error) {
      console.error('Failed to load personalized products:', error);
      // Set empty array on error so UI doesn't break
      if (page === 1) {
        setProducts([]);
      }
      setHasMore(false);
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = useCallback((e: React.FormEvent) => {
    e.preventDefault();
    // Trigger search with current query
    performSearch(searchQuery);
  }, [searchQuery]);

  const performSearch = async (query: string) => {
    const trimmedQuery = query.trim();
    
    // If query is empty, reset to personalized products
    if (!trimmedQuery) {
      setSearchMode(false);
      setPage(1);
      loadProducts();
      return;
    }

    try {
      setIsSearching(true);
      setSearchMode(true);
      setLoading(true);
      
      console.log('[Home] Searching for:', trimmedQuery);
      
      const response = await apiService.globalSearch(trimmedQuery, {
        type: 'products',
        page: 1
      });
      
      console.log('[Home] Search response:', response);
      
      // Normalize response - can be in different formats
      const responseData = (response as any)?.data || response;
      const productsData = responseData?.products || (response as any)?.products || [];
      const normalizedProducts = Array.isArray(productsData) ? productsData : [];
      
      console.log('[Home] Products found:', normalizedProducts.length);
      
      setProducts(normalizedProducts);
      setHasMore(false); // Search results typically don't paginate
    } catch (error) {
      console.error('Failed to search products:', error);
      setProducts([]);
      setHasMore(false);
    } finally {
      setIsSearching(false);
      setLoading(false);
    }
  };

  // Auto-search when debounced query changes
  useEffect(() => {
    if (debouncedSearchQuery.trim()) {
      performSearch(debouncedSearchQuery);
    } else if (searchMode) {
      // Clear search mode when query is cleared
      setSearchMode(false);
      setPage(1);
      loadProducts();
    }
  }, [debouncedSearchQuery]);

  const handleCategoryClick = (categoryId: number | null) => {
    // For personalized feed, category filtering might not be supported
    // You can implement fallback to regular products API if needed
    setSelectedCategory(categoryId);
    setPage(1);
  };

  return (
    <div className="home">
      <section className="hero">
        <div className="hero-container">
          <div className="hero-content">
            <h1 className="hero-title">Welcome to Ocean E-commerce</h1>
            <p className="hero-subtitle">Discover amazing deals from trusted sellers</p>
          </div>
          <div className="hero-image-container">
            <img 
              src={heroImages[currentHeroIndex]} 
              alt="Featured" 
              className="hero-image"
              key={currentHeroIndex}
            />
            <div className="hero-dots">
              {heroImages.map((_, index) => (
                <button
                  key={index}
                  className={`hero-dot ${index === currentHeroIndex ? 'active' : ''}`}
                  onClick={() => setCurrentHeroIndex(index)}
                  aria-label={`Go to slide ${index + 1}`}
                />
              ))}
            </div>
          </div>
        </div>
      </section>

      {categories.length > 0 && (
        <section className="categories-section">
          <h2 className="section-title">Shop by Category</h2>
          <div className="categories-grid">
            <button
              className={`category-card ${selectedCategory === null ? 'active' : ''}`}
              onClick={() => handleCategoryClick(null)}
            >
              All Products
            </button>
            {categories.map((category) => (
              <button
                key={category.id}
                className={`category-card ${selectedCategory === category.id ? 'active' : ''}`}
                onClick={() => handleCategoryClick(category.id)}
              >
                {category.image && (
                  <img src={category.image} alt={category.name} className="category-image" />
                )}
                <span>{category.name}</span>
              </button>
            ))}
          </div>
        </section>
      )}

      <section className="products-section">
        <div className="section-header">
          <h2 className="section-title">
            {searchMode && searchQuery ? `Search Results for "${searchQuery}"` : 'Personalized for You'}
          </h2>
          <form onSubmit={handleSearch} className="search-form">
            <div style={{ position: 'relative', flex: 1 }}>
              <input
                type="text"
                placeholder="Search for products..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="search-input"
                style={{ paddingRight: searchQuery ? '40px' : '12px' }}
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  style={{
                    position: 'absolute',
                    right: '8px',
                    top: '50%',
                    transform: 'translateY(-50%)',
                    background: 'transparent',
                    border: 'none',
                    cursor: 'pointer',
                    padding: '4px',
                    display: 'flex',
                    alignItems: 'center',
                    opacity: 0.6,
                    transition: 'opacity 0.2s'
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.opacity = '1'}
                  onMouseLeave={(e) => e.currentTarget.style.opacity = '0.6'}
                  aria-label="Clear search"
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <line x1="18" y1="6" x2="6" y2="18"></line>
                    <line x1="6" y1="6" x2="18" y2="18"></line>
                  </svg>
                </button>
              )}
            </div>
            <button type="submit" className="search-btn" disabled={isSearching}>
              {isSearching ? 'Searching...' : 'Search'}
            </button>
          </form>
        </div>

        {loading && products.length === 0 ? (
          <Loader />
        ) : products.length === 0 ? (
          <div className="no-products">
            {searchMode 
              ? `No products found for "${searchQuery}". Try a different search term.` 
              : 'No products found. Try a different search or category.'}
          </div>
        ) : (
          <>
            <div className="products-grid">
              {products.map((product) => (
                <ProductCard key={product.id} product={product} />
              ))}
            </div>
            {hasMore && (
              <button
                onClick={() => setPage((p) => p + 1)}
                className="load-more-btn"
                disabled={loading}
              >
                {loading ? 'Loading...' : 'Load More'}
              </button>
            )}
          </>
        )}
      </section>
    </div>
  );
}


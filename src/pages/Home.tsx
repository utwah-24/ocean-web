import { useState, useEffect } from 'react';
import { apiService } from '../services/api';
import type { Product, Category } from '../services/api';
import { ProductCard } from '../components/ProductCard';
import './Home.css';

export function Home() {
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<number | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);

  useEffect(() => {
    loadCategories();
  }, []);

  useEffect(() => {
    loadProducts();
  }, [page]);

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

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    // For personalized feed, search might not be supported
    // You can implement fallback to regular products API if needed
    setPage(1);
    loadProducts();
  };

  const handleCategoryClick = (categoryId: number | null) => {
    // For personalized feed, category filtering might not be supported
    // You can implement fallback to regular products API if needed
    setSelectedCategory(categoryId);
    setPage(1);
  };

  return (
    <div className="home">
      <section className="hero">
        <div className="hero-content">
          <h1 className="hero-title">Welcome to Ocean</h1>
          <p className="hero-subtitle">Discover amazing products from trusted sellers</p>
          <form onSubmit={handleSearch} className="search-form">
            <input
              type="text"
              placeholder="Search for products..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="search-input"
            />
            <button type="submit" className="search-btn">Search</button>
          </form>
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
        <h2 className="section-title">Personalized for You</h2>

        {loading && products.length === 0 ? (
          <div className="loading">Loading products...</div>
        ) : products.length === 0 ? (
          <div className="no-products">No products found. Try a different search or category.</div>
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


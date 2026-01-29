import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { apiService } from '../services/api';
import type { Product } from '../services/api';
import { ProductCard } from '../components/ProductCard';
import './SellerProfile.css';

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

export function SellerProfile() {
  const { id } = useParams<{ id: string }>();
  const sellerId = Number(id);

  const [seller, setSeller] = useState<Seller | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!sellerId) return;
    (async () => {
      try {
        const [sellerRes, productsRes] = await Promise.all([
          apiService['request']<Seller>(`/sellers/${sellerId}`),
          apiService.getProducts({ seller_id: sellerId }),
        ]);
        setSeller(sellerRes);
        setProducts(productsRes.data || []);
      } catch (e) {
        console.error('Failed to load seller profile:', e);
      } finally {
        setLoading(false);
      }
    })();
  }, [sellerId]);

  if (!id || Number.isNaN(sellerId)) {
    return <div className="seller-page">Invalid seller.</div>;
  }

  if (loading) {
    return <div className="seller-page">Loading seller...</div>;
  }

  if (!seller) {
    return <div className="seller-page">Seller not found.</div>;
  }

  const joinedDate = seller.created_at
    ? new Date(seller.created_at).toLocaleDateString()
    : '—';

  return (
    <div className="seller-page">
      <div className="seller-hero">
        <div className="seller-cover" />
        <div className="seller-hero-content">
          <div className="seller-avatar">
            <span>{seller.shop_name?.[0]?.toUpperCase() || 'S'}</span>
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
            <button className="seller-follow-btn">Follow</button>
          </div>
        </div>
        <div className="seller-tabs">
          <button className="seller-tab active">Seller Products</button>
          <button className="seller-tab" disabled>
            Description
          </button>
          <button className="seller-tab" disabled>
            Extra Info
          </button>
        </div>
      </div>

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
    </div>
  );
}



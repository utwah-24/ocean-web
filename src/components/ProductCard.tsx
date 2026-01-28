import { Link } from 'react-router-dom';
import type { Product } from '../services/api';
import { useCart } from '../context/CartContext';
import { formatPrice } from '../utils/formatPrice';
import { getImageUrl, handleImageError } from '../utils/imageUtils';
import './ProductCard.css';

interface ProductCardProps {
  product: Product;
}

export function ProductCard({ product }: ProductCardProps) {
  const { addToCart } = useCart();

  const handleAddToCart = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    addToCart(product, 1);
  };

  const sellerName =
    product.seller_name ??
    // possible alternative shapes from different endpoints
    (product as any).sellerName ??
    (product as any).seller?.shop_name ??
    (product as any).seller?.shopName ??
    (product as any).seller?.name ??
    (product as any).shop_name ??
    (product as any).shopName ??
    (product as any).seller?.user?.name ??
    'Ocean Seller';

  return (
    <Link to={`/products/${product.id}`} className="product-card">
      <div className="product-image-container">
        <img
          src={getImageUrl(product.image)}
          alt={product.name}
          className="product-image"
          onError={handleImageError}
          loading="lazy"
        />
        <button
          className="add-to-cart-btn"
          onClick={handleAddToCart}
          aria-label="Add to cart"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"></path>
            <line x1="3" y1="6" x2="21" y2="6"></line>
            <path d="M16 10a4 4 0 0 1-8 0"></path>
          </svg>
        </button>
      </div>
      <div className="product-info">
        <h3 className="product-name">{product.name || 'Unnamed Product'}</h3>
        <p className="product-seller">by {sellerName}</p>
        <div className="product-price">
          {formatPrice(product.price)}
        </div>
      </div>
    </Link>
  );
}


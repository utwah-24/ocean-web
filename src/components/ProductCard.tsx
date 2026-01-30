import { Link } from 'react-router-dom';
import type { Product } from '../services/api';
import { formatPrice } from '../utils/formatPrice';
import { getImageUrl, handleImageError } from '../utils/imageUtils';
import './ProductCard.css';

interface ProductCardProps {
  product: Product;
}

export function ProductCard({ product }: ProductCardProps) {
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


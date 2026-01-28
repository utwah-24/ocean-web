import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { apiService } from '../services/api';
import { useCart } from '../context/CartContext';
import { formatPrice } from '../utils/formatPrice';
import { getImageUrl, handleImageError } from '../utils/imageUtils';
import './ProductDetail.css';

export function ProductDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { addToCart } = useCart();
  const [product, setProduct] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [quantity, setQuantity] = useState(1);
  const [selectedImage, setSelectedImage] = useState(0);
  const [justAdded, setJustAdded] = useState(false);

  useEffect(() => {
    if (id) {
      loadProduct();
    }
  }, [id]);

  const loadProduct = async () => {
    try {
      const data = await apiService.getProduct(Number(id));
      setProduct(data);
      if (data.additional_images && data.additional_images.length > 0) {
        setSelectedImage(0);
      }
    } catch (error) {
      console.error('Failed to load product:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleAddToCart = () => {
    if (product) {
      addToCart(product, quantity);
      setJustAdded(true);
      window.setTimeout(() => setJustAdded(false), 1500);
    }
  };

  const images = product
    ? [product.image, ...(product.additional_images || [])]
        .filter(Boolean)
        .map((img) => getImageUrl(img))
    : [];

  if (loading) {
    return <div className="loading-container">Loading product...</div>;
  }

  if (!product) {
    return (
      <div className="error-container">
        <h2>Product not found</h2>
        <button onClick={() => navigate('/')} className="back-btn">
          Go Back Home
        </button>
      </div>
    );
  }

  const sellerName =
    product.seller_name ??
    product.sellerName ??
    product.seller?.shop_name ??
    product.seller?.shopName ??
    product.seller?.name ??
    product.shop_name ??
    product.shopName ??
    product.seller?.user?.name ??
    'Ocean Seller';

  const sellerId =
    product.sellerId ??
    product.seller_id ??
    product.seller?.id ??
    0;

  return (
    <div className="product-detail">
      <button onClick={() => navigate(-1)} className="back-button">
        ← Back
      </button>

      <div className="product-detail-container">
        <div className="product-images">
          <div className="main-image">
            <img
              src={images[selectedImage] || getImageUrl(product.image)}
              alt={product.name}
              onError={handleImageError}
              loading="lazy"
            />
          </div>
          {images.length > 1 && (
            <div className="thumbnail-images">
              {images.map((img: string, index: number) => (
                <button
                  key={index}
                  className={`thumbnail ${selectedImage === index ? 'active' : ''}`}
                  onClick={() => setSelectedImage(index)}
                >
                  <img 
                    src={img} 
                    alt={`${product.name} ${index + 1}`}
                    onError={handleImageError}
                    loading="lazy"
                  />
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="product-info-detail">
          <h1 className="product-title">{product.name}</h1>

          <div className="seller-cta-banner">
            <div className="seller-cta-left">
              <div className="seller-cta-avatar">
                <span>{sellerName?.[0]?.toUpperCase() || 'S'}</span>
              </div>
              <div className="seller-cta-text">
                <div className="seller-cta-name-row">
                  <span className="seller-cta-label">Sold by</span>
                  <span className="seller-cta-name">{sellerName}</span>
                </div>
                {product.seller_rating && (
                  <div className="seller-cta-rating">
                    ⭐ {product.seller_rating}{' '}
                    <span className="rating-muted">
                      ({product.seller_total_ratings} ratings)
                    </span>
                  </div>
                )}
              </div>
            </div>
            {sellerId ? (
              <Link to={`/sellers/${sellerId}`} className="seller-cta-button">
                Visit Store
              </Link>
            ) : null}
          </div>

          <div className="product-price-large">
            {formatPrice(product.price)}
          </div>

          <div className="product-description">
            <h3>Description</h3>
            <p>{product.description || 'No description available.'}</p>
          </div>

          {product.seller_location && (
            <div className="seller-location">
              <strong>Location:</strong> {product.seller_location}
            </div>
          )}

          <div className="product-actions">
            <div className="quantity-selector">
              <label>Quantity:</label>
              <div className="quantity-controls">
                <button
                  onClick={() => setQuantity((q) => Math.max(1, q - 1))}
                  className="quantity-btn"
                >
                  −
                </button>
                <span className="quantity-value">{quantity}</span>
                <button
                  onClick={() => setQuantity((q) => q + 1)}
                  className="quantity-btn"
                >
                  +
                </button>
              </div>
            </div>

            <div className="product-action-buttons">
              <button onClick={handleAddToCart} className="add-to-cart-large">
                {justAdded ? 'Added!' : 'Add to Cart'}
              </button>
              <button onClick={() => navigate('/cart')} className="view-cart-large">
                View Cart
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}


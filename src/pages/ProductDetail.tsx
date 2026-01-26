import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
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
      alert('Product added to cart!');
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
          <div className="product-seller-info">
            <span>Sold by: {product.seller_name}</span>
            {product.seller_rating && (
              <span className="seller-rating">
                ⭐ {product.seller_rating} ({product.seller_total_ratings} ratings)
              </span>
            )}
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

            <button onClick={handleAddToCart} className="add-to-cart-large">
              Add to Cart
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}


import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { apiService } from '../services/api';
import { useCart } from '../context/CartContext';
import { formatPrice } from '../utils/formatPrice';
import { getImageUrl, handleImageError } from '../utils/imageUtils';
import { Loader } from '../components/Loader';
import logoImage from '../assets/logo.jpeg';
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
  const [generatingImage, setGeneratingImage] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);

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

  const generateShareImage = async (): Promise<Blob | null> => {
    try {
      console.log('Starting image generation...');
      
      if (!canvasRef.current) {
        console.error('Canvas ref is null');
        return null;
      }
      
      if (!product) {
        console.error('Product is null');
        return null;
      }

      const canvas = canvasRef.current;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        console.error('Failed to get canvas context');
        return null;
      }

      console.log('Canvas setup successful');

      // Set canvas size
      canvas.width = 1080;
      canvas.height = 1350;

      // Get seller name
      const sellerName =
        product.seller_name ??
        product.sellerName ??
        product.seller?.shop_name ??
        product.seller?.shopName ??
        product.seller?.name ??
        product.seller?.user?.name ??
        'Ocean Seller';
      
      console.log('Seller name:', sellerName);

      // Orange background
      console.log('Drawing background...');
      const gradient = ctx.createLinearGradient(0, 0, 0, canvas.height);
      gradient.addColorStop(0, '#ff6b35');
      gradient.addColorStop(1, '#ff8c42');
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // Corner brackets
      console.log('Drawing brackets...');
      ctx.strokeStyle = 'white';
      ctx.lineWidth = 8;
      const bracketSize = 60;
      const margin = 40;
    
    // Top-left bracket
    ctx.beginPath();
    ctx.moveTo(margin + bracketSize, margin);
    ctx.lineTo(margin, margin);
    ctx.lineTo(margin, margin + bracketSize);
    ctx.stroke();
    
    // Top-right bracket
    ctx.beginPath();
    ctx.moveTo(canvas.width - margin - bracketSize, margin);
    ctx.lineTo(canvas.width - margin, margin);
    ctx.lineTo(canvas.width - margin, margin + bracketSize);
    ctx.stroke();
    
    // Bottom-left bracket
    ctx.beginPath();
    ctx.moveTo(margin, canvas.height - margin - bracketSize);
    ctx.lineTo(margin, canvas.height - margin);
    ctx.lineTo(margin + bracketSize, canvas.height - margin);
    ctx.stroke();
    
    // Bottom-right bracket
    ctx.beginPath();
    ctx.moveTo(canvas.width - margin - bracketSize, canvas.height - margin);
    ctx.lineTo(canvas.width - margin, canvas.height - margin);
    ctx.lineTo(canvas.width - margin, canvas.height - margin - bracketSize);
    ctx.stroke();

      // Load and draw logo
      console.log('Loading logo...');
      try {
        const logo = new Image();
        logo.crossOrigin = 'anonymous';
        logo.src = logoImage;
        await new Promise((resolve) => {
          logo.onload = resolve;
          logo.onerror = () => resolve(null); // Continue even if logo fails
        });
        const logoSize = 120;
        if (logo.complete && logo.naturalHeight !== 0) {
          ctx.drawImage(logo, (canvas.width - logoSize) / 2, 80, logoSize, logoSize);
          console.log('Logo drawn successfully');
        } else {
          console.log('Logo failed to load');
        }
      } catch (error) {
        console.log('Logo error:', error);
      }

      // White card background
      console.log('Drawing card background...');
      const cardMargin = 130;
      const cardY = 240;
      const cardHeight = 950;
      ctx.fillStyle = 'white';
      ctx.shadowColor = 'rgba(0, 0, 0, 0.2)';
      ctx.shadowBlur = 30;
      ctx.shadowOffsetY = 10;
      const radius = 24;
    ctx.beginPath();
    ctx.moveTo(cardMargin + radius, cardY);
    ctx.lineTo(canvas.width - cardMargin - radius, cardY);
    ctx.quadraticCurveTo(canvas.width - cardMargin, cardY, canvas.width - cardMargin, cardY + radius);
    ctx.lineTo(canvas.width - cardMargin, cardY + cardHeight - radius);
    ctx.quadraticCurveTo(canvas.width - cardMargin, cardY + cardHeight, canvas.width - cardMargin - radius, cardY + cardHeight);
    ctx.lineTo(cardMargin + radius, cardY + cardHeight);
    ctx.quadraticCurveTo(cardMargin, cardY + cardHeight, cardMargin, cardY + cardHeight - radius);
    ctx.lineTo(cardMargin, cardY + radius);
    ctx.quadraticCurveTo(cardMargin, cardY, cardMargin + radius, cardY);
      ctx.closePath();
      ctx.fill();
      ctx.shadowColor = 'transparent';

      // Load and draw product image
      console.log('Loading product image...');
      const imgSize = 620;
      const imgX = (canvas.width - imgSize) / 2;
      const imgY = cardY + 40;
      
      try {
        // Fetch the image as a blob to avoid CORS issues
        const imageUrl = getImageUrl(product.image);
        console.log('Product image URL:', imageUrl);
        let imageBlob: Blob | null = null;
        
        try {
          const response = await fetch(imageUrl);
          imageBlob = await response.blob();
          console.log('Product image fetched as blob');
        } catch (fetchError) {
          console.log('Failed to fetch image, trying direct load', fetchError);
        }
      
        const productImg = new Image();
        
        if (imageBlob) {
          // Use blob URL to avoid CORS
          productImg.src = URL.createObjectURL(imageBlob);
          console.log('Using blob URL for product image');
        } else {
          // Fallback to direct URL
          productImg.src = imageUrl;
          console.log('Using direct URL for product image');
        }
        
        await new Promise((resolve) => {
          productImg.onload = () => {
            console.log('Product image loaded successfully');
            resolve(null);
          };
          productImg.onerror = (err) => {
            console.log('Product image load error:', err);
            resolve(null);
          };
          setTimeout(() => {
            console.log('Product image load timeout');
            resolve(null);
          }, 10000);
        });
        
        if (productImg.complete && productImg.naturalHeight !== 0) {
          console.log('Drawing product image...');
        ctx.save();
        ctx.beginPath();
        ctx.moveTo(imgX + 16, imgY);
        ctx.lineTo(imgX + imgSize - 16, imgY);
        ctx.quadraticCurveTo(imgX + imgSize, imgY, imgX + imgSize, imgY + 16);
        ctx.lineTo(imgX + imgSize, imgY + imgSize - 16);
        ctx.quadraticCurveTo(imgX + imgSize, imgY + imgSize, imgX + imgSize - 16, imgY + imgSize);
        ctx.lineTo(imgX + 16, imgY + imgSize);
        ctx.quadraticCurveTo(imgX, imgY + imgSize, imgX, imgY + imgSize - 16);
        ctx.lineTo(imgX, imgY + 16);
        ctx.quadraticCurveTo(imgX, imgY, imgX + 16, imgY);
        ctx.closePath();
        ctx.clip();
        ctx.drawImage(productImg, imgX, imgY, imgSize, imgSize);
          ctx.restore();
          console.log('Product image drawn successfully');
          
          // Clean up blob URL if used
          if (imageBlob) {
            URL.revokeObjectURL(productImg.src);
          }
        } else {
          console.log('Product image not complete or has no dimensions, using placeholder');
          // Draw placeholder if image fails
          ctx.save();
          ctx.fillStyle = '#f3f4f6';
          ctx.fillRect(imgX, imgY, imgSize, imgSize);
          ctx.fillStyle = '#9ca3af';
          ctx.font = '48px Arial';
          ctx.textAlign = 'center';
          ctx.fillText('Product Image', canvas.width / 2, imgY + imgSize / 2);
          ctx.restore();
        }
      } catch (error) {
        console.log('Product image exception:', error);
        // Draw placeholder
        ctx.fillStyle = '#f3f4f6';
        ctx.fillRect(imgX, imgY, imgSize, imgSize);
        ctx.fillStyle = '#9ca3af';
        ctx.font = '48px Arial';
        ctx.textAlign = 'center';
        ctx.fillText('Product Image', canvas.width / 2, imgY + imgSize / 2);
      }

      // Product name
      console.log('Drawing text content...');
      ctx.fillStyle = '#2c3e50';
      ctx.font = 'bold 42px Arial';
      ctx.textAlign = 'center';
      const productName = product.name.length > 40 ? product.name.substring(0, 40) + '...' : product.name;
      ctx.fillText(productName, canvas.width / 2, imgY + imgSize + 70);

      // Seller info
      const sellerY = imgY + imgSize + 130;
      ctx.fillStyle = '#6b7280';
      ctx.font = '28px Arial';
      ctx.fillText(sellerName, canvas.width / 2, sellerY);

      // Price
      ctx.fillStyle = '#ff6b35';
      ctx.font = 'bold 56px Arial';
      ctx.fillText(formatPrice(product.price), canvas.width / 2, sellerY + 80);

      // "Shop now on Ocean" button
      const btnY = sellerY + 160;
      const btnWidth = 400;
      const btnHeight = 60;
      const btnX = (canvas.width - btnWidth) / 2;
      ctx.fillStyle = '#f3f4f6';
      ctx.beginPath();
      ctx.moveTo(btnX + 30, btnY);
      ctx.lineTo(btnX + btnWidth - 30, btnY);
      ctx.quadraticCurveTo(btnX + btnWidth, btnY, btnX + btnWidth, btnY + 30);
      ctx.lineTo(btnX + btnWidth, btnY + btnHeight - 30);
      ctx.quadraticCurveTo(btnX + btnWidth, btnY + btnHeight, btnX + btnWidth - 30, btnY + btnHeight);
      ctx.lineTo(btnX + 30, btnY + btnHeight);
      ctx.quadraticCurveTo(btnX, btnY + btnHeight, btnX, btnY + btnHeight - 30);
      ctx.lineTo(btnX, btnY + 30);
      ctx.quadraticCurveTo(btnX, btnY, btnX + 30, btnY);
      ctx.closePath();
      ctx.fill();
      
      ctx.fillStyle = '#4b5563';
      ctx.font = '32px Arial';
      ctx.fillText('🛍️ Shop now on Ocean', canvas.width / 2, btnY + 42);

      // Convert to blob
      console.log('Converting canvas to blob...');
      return new Promise((resolve) => {
        canvas.toBlob((blob) => {
          if (blob) {
            console.log('Blob created successfully, size:', blob.size);
            resolve(blob);
          } else {
            console.error('Failed to create blob');
            resolve(null);
          }
        }, 'image/png');
      });
    } catch (error) {
      console.error('Error in generateShareImage:', error);
      return null;
    }
  };

  const handleShare = async (platform: 'whatsapp' | 'snapchat' | 'instagram') => {
    setGeneratingImage(true);
    
    try {
      const imageBlob = await generateShareImage();
      
      if (!imageBlob) {
        throw new Error('Failed to generate image');
      }

      const productUrl = window.location.href;
      const productTitle = product?.name || 'Check out this product';
      const productPrice = formatPrice(product?.price || '0');
      const shareText = `${productTitle} - ${productPrice}\n\nShop now on Ocean: ${productUrl}`;

      // Create a file from the blob
      const fileName = `ocean-${product?.name?.replace(/[^a-z0-9]/gi, '-').toLowerCase() || 'product'}.png`;
      const file = new File([imageBlob], fileName, { type: 'image/png' });

      // Check if Web Share API is available and supports files
      if (navigator.share && navigator.canShare && navigator.canShare({ files: [file] })) {
        try {
          await navigator.share({
            files: [file],
            title: productTitle,
            text: shareText,
          });
          return; // Successfully shared, exit
        } catch (shareError) {
          // User cancelled or share failed, fall back to platform-specific methods
          console.log('Native share cancelled or failed:', shareError);
        }
      }

      // Fallback to platform-specific sharing
      switch (platform) {
        case 'whatsapp':
          // For WhatsApp Web, we can only share text, not images directly
          // So we'll copy the image to clipboard and open WhatsApp
          try {
            // Try to copy image to clipboard
            if (navigator.clipboard && typeof ClipboardItem !== 'undefined') {
              await navigator.clipboard.write([
                new ClipboardItem({
                  'image/png': imageBlob
                })
              ]);
              
              // Open WhatsApp with text
              const whatsappUrl = `https://wa.me/?text=${encodeURIComponent(shareText)}`;
              window.open(whatsappUrl, '_blank');
              
              alert('✅ Image copied to clipboard!\n\nNow paste it in WhatsApp along with the message.');
            } else {
              throw new Error('Clipboard API not supported');
            }
          } catch (clipboardError) {
            console.log('Clipboard copy failed:', clipboardError);
            // Fallback: download the image
            const whatsappLink = document.createElement('a');
            whatsappLink.href = URL.createObjectURL(imageBlob);
            whatsappLink.download = fileName;
            whatsappLink.click();
            URL.revokeObjectURL(whatsappLink.href);
            
            // Open WhatsApp
            const whatsappUrl = `https://wa.me/?text=${encodeURIComponent(shareText)}`;
            setTimeout(() => {
              window.open(whatsappUrl, '_blank');
            }, 500);
            
            alert('✅ Image downloaded!\n\nPlease manually attach it to your WhatsApp message.');
          }
          break;
        
        case 'snapchat':
          // Copy image to clipboard
          try {
            if (navigator.clipboard && typeof ClipboardItem !== 'undefined') {
              await navigator.clipboard.write([
                new ClipboardItem({
                  'image/png': imageBlob
                })
              ]);
              alert('✅ Image copied to clipboard!\n\nOpen Snapchat and paste it to share.');
            } else {
              throw new Error('Clipboard API not supported');
            }
          } catch (clipboardError) {
            // Fallback: download the image
            const snapLink = document.createElement('a');
            snapLink.href = URL.createObjectURL(imageBlob);
            snapLink.download = fileName;
            snapLink.click();
            URL.revokeObjectURL(snapLink.href);
            alert('✅ Image downloaded!\n\nYou can now upload it on Snapchat.');
          }
          break;
        
        case 'instagram':
          // Copy image to clipboard
          try {
            if (navigator.clipboard && typeof ClipboardItem !== 'undefined') {
              await navigator.clipboard.write([
                new ClipboardItem({
                  'image/png': imageBlob
                })
              ]);
              
              // Also copy the product URL
              await navigator.clipboard.writeText(productUrl);
              
              alert('✅ Image copied to clipboard!\n\nOpen Instagram and paste it to share. The product link is also copied.');
            } else {
              throw new Error('Clipboard API not supported');
            }
          } catch (clipboardError) {
            // Fallback: download the image
            const instaLink = document.createElement('a');
            instaLink.href = URL.createObjectURL(imageBlob);
            instaLink.download = fileName;
            instaLink.click();
            URL.revokeObjectURL(instaLink.href);
            
            // Copy link to clipboard
            try {
              await navigator.clipboard.writeText(productUrl);
              alert('✅ Image downloaded and link copied!\n\nYou can now upload it on Instagram.');
            } catch {
              alert('✅ Image downloaded!\n\nYou can now upload it on Instagram.');
            }
          }
          break;
      }
    } catch (error) {
      console.error('Error generating share image:', error);
      alert('❌ Failed to generate share image. Please try again.');
    } finally {
      setGeneratingImage(false);
    }
  };

  const images = product
    ? [product.image, ...(product.additional_images || [])]
        .filter(Boolean)
        .map((img) => getImageUrl(img))
    : [];

  if (loading) {
    return (
      <div className="loading-container">
        <Loader />
      </div>
    );
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

  const sellerImage =
    product.seller_image ??
    product.seller?.shop_image ??
    product.seller?.image ??
    undefined;

  return (
    <div className="product-detail">
      {/* Hidden canvas for generating share images */}
      <canvas ref={canvasRef} style={{ display: 'none' }} />
      
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
              {sellerImage ? (
                <img
                  src={getImageUrl(sellerImage)}
                  alt={sellerName}
                  className="seller-cta-avatar"
                  onError={handleImageError}
                  loading="lazy"
                />
              ) : (
                <div className="seller-cta-avatar">
                  <span>{sellerName?.[0]?.toUpperCase() || 'S'}</span>
                </div>
              )}
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

          <div className="product-share-section">
            <h4 className="share-title">📸 Share this product</h4>
            <p className="share-description">Generate a beautiful image card and share it!</p>
            <div className="share-buttons">
              <button 
                onClick={() => handleShare('whatsapp')} 
                className="share-btn share-whatsapp"
                aria-label="Share on WhatsApp"
                disabled={generatingImage}
              >
                <svg viewBox="0 0 24 24" fill="currentColor" width="20" height="20">
                  <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
                </svg>
                <span>{generatingImage ? 'Generating...' : 'WhatsApp'}</span>
              </button>

              <button 
                onClick={() => handleShare('snapchat')} 
                className="share-btn share-snapchat"
                aria-label="Share on Snapchat"
                disabled={generatingImage}
              >
                <svg viewBox="0 0 24 24" fill="currentColor" width="20" height="20">
                  <path d="M12.206.793c.99 0 4.347.276 5.93 3.821.529 1.193.403 3.219.299 4.847l-.003.06c-.012.18-.022.345-.03.51.075.045.203.09.401.09.3-.016.659-.12 1.033-.301.165-.088.344-.104.464-.104.182 0 .359.029.509.09.45.149.734.479.734.838.015.449-.39.839-1.213 1.168-.089.029-.209.075-.344.119-.45.135-1.139.36-1.333.81-.09.224-.061.524.12.868.304.604 1.134 1.468 2.39 2.495.36.299.509.524.509.733 0 .164-.12.314-.346.434-.254.134-.947.409-1.746.689-.27.105-.418.211-.418.314 0 .045.03.104.105.21l.015.015c.314.52.47 1.094.43 1.563-.045.509-.314 1.003-.838 1.093-1.005.194-1.62-.469-2.326-1.273-.839-.959-1.798-2.041-3.532-2.041-.314 0-.629.03-.928.074-.045 0-.075.03-.12.044l-.015.015c-.031.135-.136.345-.405.689-.509.629-1.109 1.124-1.914 1.123h-.015c-.809 0-1.424-.479-1.94-1.093-.364-.434-.853-1.483-.853-1.844 0-.254.165-.404.375-.404.09 0 .195.03.315.09.524.329.793.494 1.093.494.152 0 .315-.074.509-.238.434-.359.569-1.048.584-1.393 0-.104-.03-.164-.104-.209C6.778 16.48 6.28 15.98 5.84 15.42c-.449-.599-.569-1.348-.299-1.933.254-.524.734-.823 1.274-.823.09 0 .18.015.27.03l.015.015c.914.195 1.559.39 2.039.39.42 0 .704-.18.918-.39.18-.179.3-.404.359-.629.06-.18.075-.374.045-.554-.031-.18-.106-.359-.226-.509-.511-.658-1.245-1.05-2.01-1.124-.718-.06-1.348.151-1.827.421-.285.165-.479.255-.629.255-.149 0-.27-.06-.374-.195-.376-.464-.421-1.124-.15-1.654.301-.555.809-.975 1.439-1.125.631-.15 1.229-.03 1.708.346.18.136.331.255.465.345.195.12.391.18.601.18.435 0 .855-.255 1.229-.72.465-.58.676-1.395.571-2.205-.074-.555-.301-.959-.674-1.169-.3-.164-.645-.239-1.02-.239-.51 0-1.05.15-1.545.405-.421.194-.764.434-1.019.674-.255.239-.421.495-.524.779-.075.195-.15.375-.254.539-.241.405-.584.734-1.02.914-.435.18-.914.255-1.394.195-.404-.06-.749-.225-1.019-.524-.27-.301-.405-.675-.405-1.108 0-.495.181-1.005.526-1.529.286-.435.675-.795 1.139-1.079.465-.285 1.005-.51 1.575-.659.57-.15 1.154-.24 1.709-.24z"/>
                </svg>
                <span>{generatingImage ? 'Generating...' : 'Snapchat'}</span>
              </button>

              <button 
                onClick={() => handleShare('instagram')} 
                className="share-btn share-instagram"
                aria-label="Share on Instagram"
                disabled={generatingImage}
              >
                <svg viewBox="0 0 24 24" fill="currentColor" width="20" height="20">
                  <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"/>
                </svg>
                <span>{generatingImage ? 'Generating...' : 'Instagram'}</span>
              </button>
            </div>
          </div>

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


import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { apiService } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { Loader } from '../components/Loader';
import { getImageUrl, handleImageError } from '../utils/imageUtils';
import './AddProduct.css';

interface Category {
  id: number;
  name: string;
  image?: string;
}

interface Subcategory {
  id: number;
  category_id: number;
  name: string;
  image?: string;
}

export function EditProduct() {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [loadingProduct, setLoadingProduct] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [subcategories, setSubcategories] = useState<Subcategory[]>([]);
  const [showCategorySheet, setShowCategorySheet] = useState(false);
  const [showSubcategorySheet, setShowSubcategorySheet] = useState(false);
  const [loadingSubcategories, setLoadingSubcategories] = useState(false);
  const [businessType, setBusinessType] = useState<'product' | 'service'>('product');
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    price: '',
    category_id: '',
    subcategory_id: '',
  });
  const [mainImage, setMainImage] = useState<File | null>(null);
  const [additionalImages, setAdditionalImages] = useState<File[]>([]);
  const [mainImagePreview, setMainImagePreview] = useState<string | null>(null);
  const [additionalImagePreviews, setAdditionalImagePreviews] = useState<string[]>([]);
  const [existingMainImage, setExistingMainImage] = useState<string | null>(null);
  const [existingAdditionalImages, setExistingAdditionalImages] = useState<string[]>([]);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [initialCategoryId, setInitialCategoryId] = useState<string | null>(null);

  useEffect(() => {
    if (!user) {
      navigate('/login');
      return;
    }

    const initialize = async () => {
      // Load categories first, then product
      await loadCategories();
      await loadProduct();
    };

    initialize();
  }, [id, user, navigate]);

  // Reload subcategories when category changes (but only if it's a new selection, not initial load)
  useEffect(() => {
    if (formData.category_id && formData.category_id !== '' && formData.category_id !== initialCategoryId) {
      const categoryIdNum = parseInt(formData.category_id);
      if (categoryIdNum && categoryIdNum > 0) {
        loadSubcategories();
      }
    }
  }, [formData.category_id, initialCategoryId]);

  const loadProduct = async () => {
    if (!id) return;
    
    try {
      setLoadingProduct(true);
      const product = await apiService.getProduct(parseInt(id));
      
      // Handle different response structures
      const productData = (product as any).product || product;
      
      // Extract category_id and subcategory_id, handling multiple possible formats
      let categoryId = productData.category_id;
      let subcategoryId = productData.subcategory_id;
      
      // Try alternative formats
      if (!categoryId || categoryId === 0) {
        categoryId = productData.category?.id || (product as any).category_id;
      }
      if (!subcategoryId || subcategoryId === 0) {
        subcategoryId = productData.subcategory?.id || (product as any).subcategory_id;
      }
      
      // Also check the raw product object
      if (!categoryId || categoryId === 0) {
        categoryId = (product as any).category_id;
      }
      if (!subcategoryId || subcategoryId === 0) {
        subcategoryId = (product as any).subcategory_id;
      }
      
      console.log('[EditProduct] Product data:', {
        category_id: categoryId,
        subcategory_id: subcategoryId,
        productDataKeys: Object.keys(productData),
        fullProduct: productData
      });
      
      const categoryIdStr = (categoryId && categoryId !== 0) ? categoryId.toString() : '';
      const subcategoryIdStr = (subcategoryId && subcategoryId !== 0) ? subcategoryId.toString() : '';
      
      setInitialCategoryId(categoryIdStr);
      
      setFormData({
        name: productData.name || '',
        description: productData.description || '',
        price: productData.price || '',
        category_id: categoryIdStr,
        subcategory_id: subcategoryIdStr,
      });

      if (productData.image) {
        setExistingMainImage(productData.image);
      }

      if (productData.additional_images && productData.additional_images.length > 0) {
        setExistingAdditionalImages(productData.additional_images);
      }

      // Load subcategories if category is set
      if (categoryId && categoryId !== 0) {
        await loadSubcategories();
      }
    } catch (err) {
      console.error('Failed to load product:', err);
      setError('Failed to load product details. Please make sure you own this product.');
    } finally {
      setLoadingProduct(false);
    }
  };

  const loadCategories = async () => {
    try {
      const response = await apiService.getCategories();
      const categoriesData = Array.isArray(response) ? response : (response.data || []);
      setCategories(categoriesData);
    } catch (err) {
      console.error('Failed to load categories:', err);
    }
  };

  const loadSubcategories = async () => {
    setLoadingSubcategories(true);
    try {
      const response = await apiService.getSubcategories();
      const subcategoriesData = Array.isArray(response) ? response : [];
      setSubcategories(subcategoriesData);
    } catch (err) {
      console.error('Failed to load subcategories:', err);
      setSubcategories([]);
    } finally {
      setLoadingSubcategories(false);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleMainImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setMainImage(file);
      setExistingMainImage(null); // Clear existing image preview
      const reader = new FileReader();
      reader.onloadend = () => {
        setMainImagePreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleAdditionalImagesChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length > 0) {
      setAdditionalImages(prev => [...prev, ...files]);
      
      files.forEach(file => {
        const reader = new FileReader();
        reader.onloadend = () => {
          setAdditionalImagePreviews(prev => [...prev, reader.result as string]);
        };
        reader.readAsDataURL(file);
      });
    }
  };

  const removeAdditionalImage = (index: number) => {
    setAdditionalImages(prev => prev.filter((_, i) => i !== index));
    setAdditionalImagePreviews(prev => prev.filter((_, i) => i !== index));
  };

  const removeExistingAdditionalImage = (index: number) => {
    setExistingAdditionalImages(prev => prev.filter((_, i) => i !== index));
  };

  const handleCategorySelect = (categoryId: number, _categoryName: string) => {
    setFormData(prev => ({
      ...prev,
      category_id: categoryId.toString(),
      subcategory_id: '', // Reset subcategory when category changes
    }));
    setShowCategorySheet(false);
    loadSubcategories();
  };

  const handleSubcategorySelect = (subcategoryId: number, _subcategoryName: string) => {
    setFormData(prev => ({
      ...prev,
      subcategory_id: subcategoryId.toString()
    }));
    setShowSubcategorySheet(false);
  };

  const getSelectedCategoryName = () => {
    const selectedCategory = categories.find(cat => cat.id.toString() === formData.category_id);
    return selectedCategory ? selectedCategory.name : 'Select Category';
  };

  const getSelectedSubcategoryName = () => {
    const selectedSubcategory = subcategories.find(sub => sub.id.toString() === formData.subcategory_id);
    return selectedSubcategory ? selectedSubcategory.name : 'Select Subcategory';
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!id) {
      setError('Product ID is missing');
      return;
    }

    const priceValue = parseFloat(formData.price);
    if (!formData.price || priceValue <= 0) {
      setError('Valid price is required');
      return;
    }

    if (priceValue > 99999999) {
      setError('Price cannot exceed 99,999,999 Tshs. Please enter a smaller amount.');
      return;
    }

    setLoading(true);

    try {
      // Update product details
      await apiService.updateCustomProductDetails(parseInt(id), {
        name: formData.name,
        description: formData.description,
        price: formData.price,
        category_id: formData.category_id ? parseInt(formData.category_id) : undefined,
        subcategory_id: formData.subcategory_id ? parseInt(formData.subcategory_id) : undefined,
      });

      // Update images if new ones are provided
      if (mainImage || additionalImages.length > 0) {
        const imageFormData = new FormData();
        
        if (mainImage) {
          imageFormData.append('image', mainImage);
        }

        additionalImages.forEach((image, index) => {
          imageFormData.append(`additional_images[${index}]`, image);
        });

        await apiService.updateCustomProductImages(parseInt(id), imageFormData);
      }

      alert('Product updated successfully!');
      navigate('/my-profile');
    } catch (err: any) {
      console.error('Failed to update product:', err);
      let errorMessage = err.message || 'Failed to update product. Please try again.';
      
      if (errorMessage.includes('selling_price') || errorMessage.includes('Out of range')) {
        errorMessage = 'Price value is too large. Please enter a price below 99,999,999 Tshs.';
      }
      
      setError(errorMessage);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!id) return;

    setLoading(true);
    try {
      await apiService.deleteCustomProduct(parseInt(id));
      alert('Product deleted successfully!');
      navigate('/my-profile');
    } catch (err: any) {
      console.error('Failed to delete product:', err);
      setError(err.message || 'Failed to delete product. Please try again.');
      setShowDeleteConfirm(false);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (showCategorySheet) {
          setShowCategorySheet(false);
        }
        if (showSubcategorySheet) {
          setShowSubcategorySheet(false);
        }
      }
    };

    if (showCategorySheet || showSubcategorySheet) {
      document.addEventListener('keydown', handleEscape);
      document.body.style.overflow = 'hidden';
    }

    return () => {
      document.removeEventListener('keydown', handleEscape);
      document.body.style.overflow = 'unset';
    };
  }, [showCategorySheet, showSubcategorySheet]);

  if (loadingProduct) {
    return (
      <div className="add-product-page">
        <div className="add-product-container">
          <div className="loading-container">
            <Loader />
            <p>Loading product details...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="add-product-page">
      <div className="add-product-header">
        <button onClick={() => navigate('/my-profile')} className="back-button" type="button">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <line x1="19" y1="12" x2="5" y2="12"></line>
            <polyline points="12 19 5 12 12 5"></polyline>
          </svg>
        </button>
        <h1 className="add-product-title">Edit Product</h1>
      </div>

      <div className="add-product-container">
        {error && (
          <div className="error-banner">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="10"></circle>
              <line x1="12" y1="8" x2="12" y2="12"></line>
              <line x1="12" y1="16" x2="12.01" y2="16"></line>
            </svg>
            {error}
          </div>
        )}

        {!loadingProduct && (
        <form onSubmit={handleSubmit} className="add-product-form">
          {/* Product Name */}
          <div className="form-group">
            <label htmlFor="name" className="form-label">
              Product Name <span className="required">*</span>
            </label>
            <div className="input-with-icon">
              <svg className="input-icon" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"></path>
                <line x1="3" y1="6" x2="21" y2="6"></line>
                <path d="M16 10a4 4 0 0 1-8 0"></path>
              </svg>
              <input
                type="text"
                id="name"
                name="name"
                value={formData.name}
                onChange={handleInputChange}
                className="form-input with-icon"
                placeholder="Enter product name"
                required
              />
            </div>
          </div>

          {/* Type of Business */}
          <div className="form-group">
            <label className="form-label">
              Type of Business <span className="required">*</span>
            </label>
            <div className="business-type-toggle">
              <button
                type="button"
                onClick={() => setBusinessType('product')}
                className={`toggle-option ${businessType === 'product' ? 'active' : ''}`}
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"></path>
                  <line x1="3" y1="6" x2="21" y2="6"></line>
                  <path d="M16 10a4 4 0 0 1-8 0"></path>
                </svg>
                <span>Product</span>
              </button>
              <button
                type="button"
                onClick={() => setBusinessType('service')}
                className={`toggle-option ${businessType === 'service' ? 'active' : ''}`}
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="12" cy="12" r="3"></circle>
                  <path d="M12 1v6m0 6v6M5.64 5.64l4.24 4.24m6.36 6.36l4.24 4.24M1 12h6m6 0h6M5.64 18.36l4.24-4.24m6.36-6.36l4.24-4.24"></path>
                </svg>
                <span>Service</span>
              </button>
            </div>
          </div>

          {/* Category */}
          <div className="form-group">
            <label className="form-label">
              Category
            </label>
            <button
              type="button"
              onClick={() => setShowCategorySheet(true)}
              className="category-select-button"
            >
              <svg className="category-icon" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <rect x="3" y="3" width="7" height="7"></rect>
                <rect x="14" y="3" width="7" height="7"></rect>
                <rect x="14" y="14" width="7" height="7"></rect>
                <rect x="3" y="14" width="7" height="7"></rect>
              </svg>
              <span className={formData.category_id ? 'selected' : 'placeholder'}>
                {getSelectedCategoryName()}
              </span>
              <svg className="select-arrow" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <polyline points="6 9 12 15 18 9"></polyline>
              </svg>
            </button>
          </div>

          {/* Subcategory - Only show if category is selected */}
          {formData.category_id && (
            <div className="form-group">
              <label className="form-label">
                Subcategory
              </label>
              <button
                type="button"
                onClick={() => setShowSubcategorySheet(true)}
                className="category-select-button"
                disabled={loadingSubcategories}
              >
                <svg className="category-icon" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M3 7v10a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-6l-2-2H5a2 2 0 0 0-2 2z"></path>
                </svg>
                <span className={formData.subcategory_id ? 'selected' : 'placeholder'}>
                  {loadingSubcategories ? 'Loading...' : getSelectedSubcategoryName()}
                </span>
                <svg className="select-arrow" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <polyline points="6 9 12 15 18 9"></polyline>
                </svg>
              </button>
            </div>
          )}

          {/* Price */}
          <div className="form-group">
            <label htmlFor="price" className="form-label">
              Price (Tshs) <span className="required">*</span>
            </label>
            <div className="input-with-icon">
              <svg className="input-icon" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <rect x="2" y="5" width="20" height="14" rx="2"></rect>
                <line x1="2" y1="10" x2="22" y2="10"></line>
              </svg>
              <input
                type="number"
                id="price"
                name="price"
                value={formData.price}
                onChange={handleInputChange}
                className="form-input with-icon"
                placeholder="Enter price"
                min="0"
                max="99999999"
                step="1"
                required
              />
            </div>
            <small className="form-helper-text">Maximum price: 99,999,999 Tshs</small>
          </div>

          {/* Description */}
          <div className="form-group">
            <label htmlFor="description" className="form-label">
              Description
            </label>
            <div className="textarea-wrapper">
              <svg className="textarea-icon" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                <polyline points="14 2 14 8 20 8"></polyline>
                <line x1="16" y1="13" x2="8" y2="13"></line>
                <line x1="16" y1="17" x2="8" y2="17"></line>
                <polyline points="10 9 9 9 8 9"></polyline>
              </svg>
              <textarea
                id="description"
                name="description"
                value={formData.description}
                onChange={handleInputChange}
                className="form-textarea with-icon"
                placeholder="Describe your product..."
                rows={5}
              />
            </div>
          </div>

          {/* Main Image */}
          <div className="form-group">
            <label className="form-label">
              Images <span className="required">*</span>
            </label>
            <div className="images-grid">
              {/* Main Image Upload */}
              <div className="image-upload-box">
                <input
                  type="file"
                  id="image"
                  accept="image/*"
                  onChange={handleMainImageChange}
                  className="file-input"
                />
                <label htmlFor="image" className="image-upload-label">
                  {mainImagePreview ? (
                    <div className="uploaded-image">
                      <img src={mainImagePreview} alt="Main product" />
                      <div className="image-overlay">
                        <span>Change</span>
                      </div>
                    </div>
                  ) : existingMainImage ? (
                    <div className="uploaded-image">
                      <img src={getImageUrl(existingMainImage)} alt="Main product" onError={handleImageError} />
                      <div className="image-overlay">
                        <span>Change</span>
                      </div>
                    </div>
                  ) : (
                    <div className="upload-placeholder">
                      <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                        <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
                        <circle cx="8.5" cy="8.5" r="1.5"></circle>
                        <polyline points="21 15 16 10 5 21"></polyline>
                      </svg>
                      <span>Add Photo</span>
                    </div>
                  )}
                </label>
              </div>

              {/* Existing Additional Images */}
              {existingAdditionalImages.map((imageUrl, index) => (
                <div key={`existing-${index}`} className="image-upload-box">
                  <div className="uploaded-image">
                    <img src={getImageUrl(imageUrl)} alt={`Additional ${index + 1}`} onError={handleImageError} />
                    <button
                      type="button"
                      onClick={() => removeExistingAdditionalImage(index)}
                      className="remove-image-btn"
                      aria-label="Remove image"
                    >
                      ×
                    </button>
                  </div>
                </div>
              ))}

              {/* New Additional Images */}
              {additionalImagePreviews.map((preview, index) => (
                <div key={`new-${index}`} className="image-upload-box">
                  <div className="uploaded-image">
                    <img src={preview} alt={`Additional ${index + 1}`} />
                    <button
                      type="button"
                      onClick={() => removeAdditionalImage(index)}
                      className="remove-image-btn"
                      aria-label="Remove image"
                    >
                      ×
                    </button>
                  </div>
                </div>
              ))}

              {/* Add More Button */}
              {(existingAdditionalImages.length + additionalImagePreviews.length) < 4 && (
                <div className="image-upload-box">
                  <input
                    type="file"
                    id="additional_images"
                    accept="image/*"
                    multiple
                    onChange={handleAdditionalImagesChange}
                    className="file-input"
                  />
                  <label htmlFor="additional_images" className="image-upload-label add-more">
                    <div className="upload-placeholder">
                      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <line x1="12" y1="5" x2="12" y2="19"></line>
                        <line x1="5" y1="12" x2="19" y2="12"></line>
                      </svg>
                    </div>
                  </label>
                </div>
              )}
            </div>
          </div>

          {/* Submit Button */}
          <div className="form-actions">
            <button
              type="button"
              onClick={() => navigate('/my-profile')}
              className="cancel-btn"
              disabled={loading}
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => setShowDeleteConfirm(true)}
              className="delete-btn"
              disabled={loading}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <polyline points="3 6 5 6 21 6"></polyline>
                <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                <line x1="10" y1="11" x2="10" y2="17"></line>
                <line x1="14" y1="11" x2="14" y2="17"></line>
              </svg>
              Delete Product
            </button>
            <button
              type="submit"
              className="submit-btn"
              disabled={loading}
            >
              {loading ? (
                <>
                  <Loader />
                  <span>Updating Product...</span>
                </>
              ) : (
                'Update Product'
              )}
            </button>
          </div>
        </form>
        )}

        {/* Delete Confirmation Modal */}
        {showDeleteConfirm && (
          <>
            <div 
              className="modal-overlay"
              onClick={() => setShowDeleteConfirm(false)}
            />
            <div className="delete-confirm-modal">
              <h3>Delete Product</h3>
              <p>Are you sure you want to delete this product? This action cannot be undone.</p>
              <div className="modal-actions">
                <button
                  type="button"
                  onClick={() => setShowDeleteConfirm(false)}
                  className="cancel-btn"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleDelete}
                  className="delete-confirm-btn"
                  disabled={loading}
                >
                  {loading ? 'Deleting...' : 'Delete'}
                </button>
              </div>
            </div>
          </>
        )}
      </div>

      {/* Category Bottom Sheet */}
      {showCategorySheet && (
        <>
          <div 
            className="bottom-sheet-overlay"
            onClick={() => setShowCategorySheet(false)}
          />
          <div className="bottom-sheet">
            <div className="bottom-sheet-handle">
              <div className="handle-bar"></div>
            </div>
            <div className="bottom-sheet-header">
              <h3 className="bottom-sheet-title">Select Category</h3>
              <button
                type="button"
                onClick={() => setShowCategorySheet(false)}
                className="bottom-sheet-close"
              >
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <line x1="18" y1="6" x2="6" y2="18"></line>
                  <line x1="6" y1="6" x2="18" y2="18"></line>
                </svg>
              </button>
            </div>
            <div className="bottom-sheet-content">
              {categories.length === 0 ? (
                <div className="empty-state">
                  <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                    <rect x="3" y="3" width="7" height="7"></rect>
                    <rect x="14" y="3" width="7" height="7"></rect>
                    <rect x="14" y="14" width="7" height="7"></rect>
                    <rect x="3" y="14" width="7" height="7"></rect>
                  </svg>
                  <p>No categories available</p>
                </div>
              ) : (
                <div className="category-grid">
                  {categories.map((category) => (
                    <button
                      key={category.id}
                      type="button"
                      onClick={() => handleCategorySelect(category.id, category.name)}
                      className={`category-card ${formData.category_id === category.id.toString() ? 'selected' : ''}`}
                    >
                      <div className="category-image-wrapper">
                        <img 
                          src={getImageUrl(category.image || '')}
                          alt={category.name}
                          className="category-image"
                          onError={handleImageError}
                        />
                      </div>
                      <span className="category-name">{category.name}</span>
                      {formData.category_id === category.id.toString() && (
                        <div className="category-check-badge">
                          <svg className="check-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                            <polyline points="20 6 9 17 4 12"></polyline>
                          </svg>
                        </div>
                      )}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </>
      )}

      {/* Subcategory Bottom Sheet */}
      {showSubcategorySheet && (
        <>
          <div 
            className="bottom-sheet-overlay"
            onClick={() => setShowSubcategorySheet(false)}
          />
          <div className="bottom-sheet">
            <div className="bottom-sheet-handle">
              <div className="handle-bar"></div>
            </div>
            <div className="bottom-sheet-header">
              <h3 className="bottom-sheet-title">Select Subcategory</h3>
              <button
                type="button"
                onClick={() => setShowSubcategorySheet(false)}
                className="bottom-sheet-close"
              >
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <line x1="18" y1="6" x2="6" y2="18"></line>
                  <line x1="6" y1="6" x2="18" y2="18"></line>
                </svg>
              </button>
            </div>
            <div className="bottom-sheet-content">
              {loadingSubcategories ? (
                <div className="empty-state">
                  <Loader />
                  <p>Loading subcategories...</p>
                </div>
              ) : subcategories.length === 0 ? (
                <div className="empty-state">
                  <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                    <path d="M3 7v10a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-6l-2-2H5a2 2 0 0 0-2 2z"></path>
                  </svg>
                  <p>No subcategories available</p>
                </div>
              ) : (
                <div className="category-grid">
                  {subcategories.map((subcategory) => (
                    <button
                      key={subcategory.id}
                      type="button"
                      onClick={() => handleSubcategorySelect(subcategory.id, subcategory.name)}
                      className={`category-card ${formData.subcategory_id === subcategory.id.toString() ? 'selected' : ''}`}
                    >
                      <div className="category-image-wrapper">
                        <img 
                          src={getImageUrl(subcategory.image || '')}
                          alt={subcategory.name}
                          className="category-image"
                          onError={handleImageError}
                        />
                      </div>
                      <span className="category-name">{subcategory.name}</span>
                      {formData.subcategory_id === subcategory.id.toString() && (
                        <div className="category-check-badge">
                          <svg className="check-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                            <polyline points="20 6 9 17 4 12"></polyline>
                          </svg>
                        </div>
                      )}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}


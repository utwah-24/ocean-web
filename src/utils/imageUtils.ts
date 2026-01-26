const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'https://sagenashi.com/api/v3';

/**
 * Processes an image URL to ensure it's a complete, valid URL
 * @param imageUrl - The image URL from the API (could be relative or absolute)
 * @returns A complete, valid image URL
 */
export function getImageUrl(imageUrl: string | null | undefined): string {
  if (!imageUrl || imageUrl.trim() === '') {
    return 'https://via.placeholder.com/400x400?text=No+Image';
  }

  // If it's already a full URL (starts with http:// or https://), return as is
  if (imageUrl.startsWith('http://') || imageUrl.startsWith('https://')) {
    return imageUrl;
  }

  // Extract base domain from API_BASE_URL
  // e.g., https://sagenashi.com/api/v3 -> https://sagenashi.com
  const baseUrlMatch = API_BASE_URL.match(/^(https?:\/\/[^\/]+)/);
  const baseDomain = baseUrlMatch ? baseUrlMatch[1] : 'https://sagenashi.com';

  // If it starts with /, it's a relative URL from the domain root
  if (imageUrl.startsWith('/')) {
    const fullUrl = `${baseDomain}${imageUrl}`;
    // Debug logging (can be removed in production)
    if (import.meta.env.DEV) {
      console.log('Image URL processed:', { original: imageUrl, processed: fullUrl });
    }
    return fullUrl;
  }

  // If it doesn't start with /, it might be relative to storage path
  // Common patterns: storage/products/image.jpg or /storage/products/image.jpg
  if (imageUrl.includes('storage/') || imageUrl.includes('uploads/')) {
    const fullUrl = `${baseDomain}/${imageUrl.startsWith('/') ? imageUrl.slice(1) : imageUrl}`;
    if (import.meta.env.DEV) {
      console.log('Image URL processed:', { original: imageUrl, processed: fullUrl });
    }
    return fullUrl;
  }

  // Otherwise, assume it's relative to the domain root
  const fullUrl = `${baseDomain}/${imageUrl}`;
  if (import.meta.env.DEV) {
    console.log('Image URL processed:', { original: imageUrl, processed: fullUrl });
  }
  return fullUrl;
}

/**
 * Handles image load errors with fallback
 */
export function handleImageError(e: React.SyntheticEvent<HTMLImageElement>) {
  const target = e.target as HTMLImageElement;
  // Only set fallback if it's not already the fallback image
  if (!target.src.includes('placeholder.com') && !target.src.includes('via.placeholder')) {
    target.src = 'https://via.placeholder.com/400x400?text=No+Image';
  }
}


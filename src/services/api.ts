// In development, use proxy to avoid CORS issues
// In production, use the full API URL
const API_BASE_URL = import.meta.env.DEV
  ? '/api/v3'  // Use Vite proxy in development
  : (import.meta.env.VITE_API_BASE_URL || 'https://sagenashi.com/api/v3');

export interface Product {
  id: number;
  name: string;
  description: string;
  price: string;
  image: string;
  sellerId: number;
  seller_name: string;
  seller_image?: string;
  category_id: number;
  subcategory_id: number;
  created_at: string;
  updated_at: string;
}

export interface Category {
  id: number;
  name: string;
  image?: string;
  created_at: string;
}

export interface CartItem {
  product: Product;
  quantity: number;
}

export interface CommentItem {
  id: number;
  user_id?: number;
  user_name?: string;
  comment?: string;
  message?: string;
  likes_count?: number;
  is_liked?: boolean;
  created_at?: string;
  replies?: CommentItem[];
}

function normalizeProduct(raw: any): Product {
  const nowIso = new Date().toISOString();

  const sellerName =
    raw?.seller_name ??
    raw?.sellerName ??
    (typeof raw?.seller === 'string' ? raw.seller : undefined) ??
    raw?.seller?.shop_name ??
    raw?.seller?.shopName ??
    raw?.seller?.name ??
    raw?.shop_name ??
    raw?.shopName ??
    raw?.seller?.user?.name ??
    'Ocean Seller';

  const image =
    raw?.image ??
    raw?.product_image ??
    raw?.main_image ??
    raw?.thumbnail ??
    raw?.media?.image ??
    '';

  return {
    id: Number(raw?.id ?? raw?.product_id ?? 0),
    name: String(raw?.name ?? raw?.product_name ?? raw?.title ?? 'Unnamed Product'),
    description: String(raw?.description ?? raw?.details ?? ''),
    price: String(raw?.price ?? raw?.amount ?? raw?.selling_price ?? raw?.sale_price ?? '0'),
    image: String(image),
    sellerId: Number(raw?.sellerId ?? raw?.seller_id ?? raw?.seller?.id ?? 0),
    seller_name: String(sellerName),
    seller_image: raw?.seller_image ?? raw?.seller?.shop_image ?? raw?.seller?.image ?? undefined,
    category_id: Number(raw?.category_id ?? raw?.category?.id ?? 0),
    subcategory_id: Number(raw?.subcategory_id ?? raw?.subcategory?.id ?? 0),
    created_at: String(raw?.created_at ?? nowIso),
    updated_at: String(raw?.updated_at ?? raw?.created_at ?? nowIso),
  };
}

class ApiService {
  private getAuthToken(): string | null {
    return localStorage.getItem('token');
  }

  private truncateForErrorBody(body: string, max = 300): string {
    const cleaned = body.replace(/\s+/g, ' ').trim();
    if (cleaned.length <= max) return cleaned;
    return `${cleaned.slice(0, max)}…`;
  }

  private isNotFoundError(err: unknown): boolean {
    const msg = err instanceof Error ? err.message : String(err);
    return (
      /\b404\b/.test(msg) ||
      /not found/i.test(msg) ||
      /could not be found/i.test(msg) ||
      /route .* could not be found/i.test(msg)
    );
  }

  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    const url = `${API_BASE_URL}${endpoint}`;
    
    try {
      const token = this.getAuthToken();
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        ...(options.headers as Record<string, string>),
      };

      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }

      // Add CSRF token header if needed (some APIs require this)
      // Note: For GET requests, CSRF is usually not required
      if (options.method && options.method !== 'GET') {
        headers['X-CSRF-TOKEN'] = '';
      }

      if (import.meta.env.DEV) {
        console.log(`[API] ${options.method || 'GET'} ${url}`, {
          headers,
          hasToken: !!token,
        });
      }

      const response = await fetch(url, {
        ...options,
        headers,
        redirect: 'follow', // Follow redirects but check final URL
      });

      if (import.meta.env.DEV) {
        console.log(`[API Response]`, {
          status: response.status,
          statusText: response.statusText,
          url: response.url,
          originalUrl: url,
          headers: Object.fromEntries(response.headers.entries()),
        });
      }

      // Check if we were redirected to an unexpected location
      const finalUrl = response.url;
      if (finalUrl !== url && !finalUrl.includes('sagenashi.com') && !finalUrl.includes('/api/')) {
        console.error('Unexpected redirect detected:', {
          original: url,
          final: finalUrl,
          status: response.status,
        });
        if (response.status === 200 && finalUrl.includes('localhost')) {
          throw new Error(
            `Server redirected to localhost. This usually means:\n` +
            `• The endpoint "${url}" doesn't exist on the server\n` +
            `• The endpoint requires authentication\n` +
            `• Server configuration issue\n\n` +
            `Please verify the endpoint exists and check if authentication is required.`
          );
        }
      }

      if (!response.ok) {
        const errorText = await response.text();
        let errorMessage = `API Error: ${response.status} ${response.statusText}`;
        try {
          const errorJson = JSON.parse(errorText);
          
          // Handle Laravel-style validation errors
          if (errorJson.errors && typeof errorJson.errors === 'object') {
            const validationErrors = Object.entries(errorJson.errors)
              .map(([field, messages]: [string, any]) => {
                const msg = Array.isArray(messages) ? messages.join(', ') : messages;
                return `${field}: ${msg}`;
              })
              .join('; ');
            errorMessage = validationErrors || errorJson.message || errorJson.error || errorMessage;
          } else {
            errorMessage = errorJson.message || errorJson.error || errorMessage;
          }
          
          // Log full error for debugging
          if (import.meta.env.DEV) {
            console.error('[API Error Response]', {
              status: response.status,
              errorJson,
              errorText,
            });
          }
        } catch {
          // If not JSON, use the text or status text
          errorMessage = errorText || errorMessage;
        }
        throw new Error(errorMessage);
      }

      // 204 No Content is valid JSON-less success
      if (response.status === 204) {
        return {} as T;
      }

      const contentType = response.headers.get('content-type');
      if (contentType && contentType.includes('application/json')) {
        return response.json();
      } else {
        // Don’t silently swallow HTML/text responses; it hides real server issues.
        const text = await response.text();
        const preview = this.truncateForErrorBody(text);
        throw new Error(
          `Expected JSON but got ${contentType || 'unknown content-type'} from ${url}.\n` +
          `Response preview: ${preview || '(empty)'}`
        );
      }
    } catch (error) {
      // Handle network errors or other fetch errors
      if (error instanceof TypeError) {
        const errorMessage = error.message.toLowerCase();
        console.error('Network error:', {
          error,
          url,
          message: error.message,
          apiBaseUrl: API_BASE_URL,
        });
        
        // Provide more specific error messages
        if (errorMessage.includes('failed to fetch') || errorMessage.includes('networkerror')) {
          throw new Error(
            `Unable to connect to the server at ${API_BASE_URL}. ` +
            `This could be due to:\n` +
            `• CORS policy blocking the request\n` +
            `• Server is down or unreachable\n` +
            `• Network firewall blocking the connection\n` +
            `• Incorrect API URL configuration\n\n` +
            `Please check the browser console for more details.`
          );
        } else if (errorMessage.includes('cors')) {
          throw new Error(
            `CORS error: The server at ${API_BASE_URL} is not allowing requests from this origin. ` +
            `Please contact the server administrator.`
          );
        }
        throw new Error(
          `Network error: ${error.message}. URL: ${url}`
        );
      }
      throw error;
    }
  }

  // Authentication
  async login(countryCode: string, phone: string, password: string) {
    // Backend expects country_code like "🇹🇿TZ" (flag + ISO2).
    // Accept inputs like "TZ" / "🇹🇿TZ" and normalize to flag+ISO2.
    const iso2 = countryCode.replace(/[^A-Za-z]/g, '').toUpperCase();
    const normalizedCountryCode = iso2.length === 2 ? `${isoToFlagEmoji(iso2)}${iso2}` : countryCode;

    // Clean phone number - remove any spaces, dashes, or special characters
    const cleanPhone = phone.replace(/\D/g, '');
    // Normalize: API expects phone without a leading 0 (e.g. 0712... -> 712...)
    let normalizedPhone = cleanPhone;
    if (normalizedPhone.length > 1) {
      normalizedPhone = normalizedPhone.replace(/^0+/, '');
    }
    
    const requestBody = {
      country_code: normalizedCountryCode,
      phone: normalizedPhone,
      password: password,
    };

    if (import.meta.env.DEV) {
      console.log('[Login API] Request body:', {
        ...requestBody,
        password: '***hidden***', // Don't log password
      });
    }

    try {
      const response = await this.request<{
        token: string;
        role: string;
        user: any;
      }>('/login', {
        method: 'POST',
        body: JSON.stringify(requestBody),
      });
      return response;
    } catch (error) {
      if (import.meta.env.DEV) {
        console.error('[Login API] Error details:', error);
      }
      throw error;
    }
  }

  async register(data: {
    name: string;
    phone: string;
    country_code: string;
    email: string;
    password: string;
    password_confirmation: string;
  }) {
    return this.request<{
      message: string;
      user: {
        id: number;
        email: string;
        phone: string;
        name: string;
        country: string;
        role: string;
      };
    }>('/register', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  // Products
  async getProducts(params?: {
    page?: number;
    category_id?: number;
    subcategory_id?: number;
    seller_id?: number;
    search?: string;
  }): Promise<{
    data: Product[];
    current_page: number;
    last_page: number;
    per_page: number;
    total: number;
  }> {
    const queryParams = new URLSearchParams();
    if (params?.page) queryParams.append('page', params.page.toString());
    if (params?.category_id) queryParams.append('category_id', params.category_id.toString());
    if (params?.subcategory_id) queryParams.append('subcategory_id', params.subcategory_id.toString());
    if (params?.seller_id) queryParams.append('seller_id', params.seller_id.toString());
    if (params?.search) queryParams.append('search', params.search);

    const query = queryParams.toString();
    return this.request(`/products${query ? `?${query}` : ''}`);
  }

  // Get Seller Products
  async getSellerProducts(
    sellerId: number,
    params?: {
      page?: number;
      category_id?: number;
      subcategory_id?: number;
    }
  ): Promise<{
    data: Product[];
  }> {
    const queryParams = new URLSearchParams();
    if (params?.page) queryParams.append('page', params.page.toString());
    if (params?.category_id) queryParams.append('category_id', params.category_id.toString());
    if (params?.subcategory_id) queryParams.append('subcategory_id', params.subcategory_id.toString());

    const query = queryParams.toString();
    const raw = await this.request<any>(`/sellers/${sellerId}/products${query ? `?${query}` : ''}`);

    // Handle response structure: { message: "...", products: [...] }
    const productsArray = raw?.products || raw?.data || [];
    const normalized = Array.isArray(productsArray)
      ? productsArray.map((p: any) => normalizeProduct(p))
      : [];

    return {
      data: normalized,
    };
  }

  // Personalized Products
  async getPersonalizedProducts(params?: {
    page?: number;
  }): Promise<{
    data: Product[];
    current_page?: number;
    last_page?: number;
    per_page?: number;
    total?: number;
  }> {
    const queryParams = new URLSearchParams();
    if (params?.page) queryParams.append('page', params.page.toString());

    const query = queryParams.toString();
    const raw = await this.request<any>(`/product-interactions/personalized${query ? `?${query}` : ''}`);

    // Some endpoints return `{ data: [...] }`, others `{ data: { data: [...] } }`, or even `[...]`
    const container =
      raw && typeof raw === 'object' && raw.data && typeof raw.data === 'object' && !Array.isArray(raw.data)
        ? raw.data
        : raw;

    const listCandidate =
      (container && Array.isArray(container.data) ? container.data : undefined) ??
      (raw && Array.isArray(raw.data) ? raw.data : undefined) ??
      (raw && Array.isArray(raw.products) ? raw.products : undefined) ??
      (Array.isArray(raw) ? raw : []);

    let products = (Array.isArray(listCandidate) ? listCandidate : []).map(normalizeProduct);

    // Enrich products missing seller_name by fetching sellers from /sellers/{id}
    try {
      const missingSellerIds = Array.from(
        new Set(
          products
            .filter((p) => !p.seller_name || p.seller_name === 'Ocean Seller')
            .map((p) => p.sellerId)
            .filter((id) => typeof id === 'number' && id > 0),
        ),
      );

      if (missingSellerIds.length > 0) {
        const sellerResponses = await Promise.all(
          missingSellerIds.map(async (id) => {
            try {
              const seller = await this.request<any>(`/sellers/${id}`);
              return { id, seller };
            } catch (e) {
              console.warn('Failed to fetch seller', id, e);
              return { id, seller: null as any };
            }
          }),
        );

        const sellerNameById = new Map<number, string>();
        sellerResponses.forEach(({ id, seller }) => {
          if (!seller) return;
          const nameFromApi =
            seller.shop_name ??
            seller.shopName ??
            seller.name ??
            seller.user?.name ??
            undefined;
          if (nameFromApi) {
            sellerNameById.set(id, String(nameFromApi));
          }
        });

        if (sellerNameById.size > 0) {
          products = products.map((p) => {
            if (!p.seller_name || p.seller_name === 'Ocean Seller') {
              const name = sellerNameById.get(p.sellerId);
              if (name) {
                return { ...p, seller_name: name };
              }
            }
            return p;
          });
        }
      }
    } catch (e) {
      console.warn('Failed to enrich products with seller names from /sellers', e);
      // Fallback to existing data; UI will still work with generic seller label
    }

    return {
      data: products,
      current_page: container?.current_page ?? raw?.current_page,
      last_page: container?.last_page ?? raw?.last_page,
      per_page: container?.per_page ?? raw?.per_page,
      total: container?.total ?? raw?.total,
    };
  }

  async getProduct(id: number): Promise<
    Product & {
      additional_images?: string[];
      seller_rating?: number;
      seller_total_ratings?: number;
      seller_status?: string;
      seller_is_online?: boolean;
      seller_phone?: string;
      seller_location?: string;
      seller_about?: string;
    }
  > {
    const raw = await this.request<any>(`/products/${id}`);
    // Normalize core product fields (including seller_name) while keeping all extra fields
    let normalized = normalizeProduct(raw);

    // If seller_name is still generic, try enriching from /sellers/{id}
    if (!normalized.seller_name || normalized.seller_name === 'Ocean Seller') {
      const sellerId =
        normalized.sellerId ??
        raw?.sellerId ??
        raw?.seller_id ??
        raw?.seller?.id ??
        0;

      if (sellerId && typeof sellerId === 'number') {
        try {
          const seller = await this.request<any>(`/sellers/${sellerId}`);
          const nameFromApi =
            seller.shop_name ??
            seller.shopName ??
            seller.name ??
            seller.user?.name ??
            undefined;
          if (nameFromApi) {
            normalized = {
              ...normalized,
              seller_name: String(nameFromApi),
            };
          }
        } catch (e) {
          console.warn('Failed to fetch seller for product detail', sellerId, e);
        }
      }
    }

    return {
      ...(raw || {}),
      ...normalized,
    };
  }

  // Categories
  async getCategories(): Promise<{ data: Category[] }> {
    const res = await this.request<{ data: Category[] }>('/categories');
    if (import.meta.env.DEV) {
      console.log('Categories API response:', res);
    }
    return res;
  }

  async getSubcategories(sellerId?: number): Promise<{ data: Array<{
    id: number;
    category_id: number;
    name: string;
    created_at: string;
  }> }> {
    const query = sellerId ? `?seller_id=${sellerId}` : '';
    return this.request(`/subcategories${query}`);
  }

  // Orders
  async createOrder(orderData: {
    order_items: Array<{
      product_id: number;
      quantity: number;
      price: string;
    }>;
    buyer_id: number;
    total_amount: number;
    delivery_fee: number;
    buyer_lat?: number;
    buyer_long?: number;
    payment_type: 'online' | 'escrow' | 'cash_on_delivery';
    msisdn?: string;
    provider?: string;
    escrow_fee_responsibility?: 'buyer' | 'seller';
  }) {
    return this.request<{
      success: boolean;
      message: string;
      orderId: number;
      transactionId?: string;
      referenceId?: string;
    }>('/create/order', {
      method: 'POST',
      body: JSON.stringify(orderData),
    });
  }

  async getOrders() {
    return this.request<{
      success: boolean;
      data: Array<any>;
    }>('/orders');
  }

  async getOrder(orderId: number) {
    return this.request<{
      success: boolean;
      data: any;
    }>(`/orders/${orderId}`);
  }

  async updateOrderStatus(orderId: number, status: string) {
    return this.request<{
      success: boolean;
      message: string;
    }>(`/orders/${orderId}/status`, {
      method: 'PUT',
      body: JSON.stringify({ status }),
    });
  }

  async approveOrder(orderId: number) {
    return this.request<{
      success: boolean;
      message: string;
    }>(`/orders/${orderId}/approve`, {
      method: 'POST',
    });
  }

  async requestPayment(paymentData: {
    amount: number;
    msisdn: string;
    order_id?: number;
    description?: string;
  }) {
    return this.request<{
      success: boolean;
      message: string;
      referenceId: string;
      transactionId?: string;
    }>('/ecommerce/client/purchases/request-to-pay', {
      method: 'POST',
      body: JSON.stringify(paymentData),
    });
  }

  async getPurchaseDetails(referenceId: string) {
    return this.request<{
      success: boolean;
      data: any;
    }>(`/ecommerce/client/purchases/${referenceId}`);
  }

  // Expiring Posts (Ads)
  async getExpiringPosts(params?: {
    page?: number;
    user_id?: number;
  }): Promise<{
    data: Array<{
      id: number;
      seller_id: number;
      seller_name: string;
      seller_image?: string;
      content: string;
      image?: string;
      expires_at: string;
      likes_count: number;
      comments_count: number;
      is_liked: boolean;
      created_at: string;
      product_id?: number;
    }>;
    current_page: number;
    last_page: number;
    next_page_url?: string;
  }> {
    const queryParams = new URLSearchParams();
    if (params?.page) queryParams.append('page', params.page.toString());
    if (params?.user_id) queryParams.append('user_id', params.user_id.toString());

    const query = queryParams.toString();
    // Use /expiring-posts to fetch all available expiring posts (not the personalized feed endpoint).
    const raw = await this.request<any>(`/expiring-posts${query ? `?${query}` : ''}`);

    // Handle nested data structure from API
    const container = raw?.data || raw;
    const postsData = container?.data || container || [];
    const userId = params?.user_id;

    const list = Array.isArray(postsData) ? postsData : [];
    const normalized = list
      .filter(Boolean)
      .map((p: any) => {
        const sellerName =
          p?.seller_name ??
          p?.seller?.shop_name ??
          p?.seller?.shopName ??
          p?.seller?.name ??
          p?.seller?.user?.name ??
          'Ocean Seller';

        // Check for is_liked in multiple possible locations
        // Also check if likes array contains current user (if user_id param was provided)
        let isLiked = false;
        
        if (typeof p?.is_liked === 'boolean') {
          isLiked = p.is_liked;
        } else if (typeof p?.liked === 'boolean') {
          isLiked = p.liked;
        } else if (Array.isArray(p?.likes) && userId) {
          // Check if current user is in the likes array
          isLiked = p.likes.some((like: any) => {
            const likeUserId = like?.user_id ?? like?.userId ?? like?.id ?? like?.user?.id;
            return likeUserId && Number(likeUserId) === Number(userId);
          });
        }

        return {
          id: Number(p?.id ?? 0),
          seller_id: Number(p?.seller_id ?? p?.sellerId ?? p?.seller?.id ?? 0),
          seller_name: String(sellerName || 'Ocean Seller'),
          seller_image: p?.seller_image ?? p?.seller?.shop_image ?? p?.seller?.image ?? undefined,
          content: String(p?.content ?? ''),
          image: p?.image ?? p?.media?.image ?? undefined,
          expires_at: String(p?.expires_at ?? p?.expiresAt ?? ''),
          likes_count: Number(p?.likes_count ?? p?.likes_count ?? (Array.isArray(p?.likes) ? p.likes.length : 0) ?? 0),
          comments_count: Number(p?.comments_count ?? p?.comments_count ?? (Array.isArray(p?.comments) ? p.comments.length : 0) ?? 0),
          is_liked: isLiked,
          created_at: String(p?.created_at ?? p?.createdAt ?? new Date().toISOString()),
          product_id: p?.product_id ? Number(p.product_id) : undefined,
        };
      });

    return {
      data: normalized,
      current_page: container?.current_page || raw?.current_page || 1,
      last_page: container?.last_page || raw?.last_page || 1,
      next_page_url: container?.next_page_url || raw?.next_page_url,
    };
  }

  async getExpiringPostsBySeller(
    sellerId: number,
    params?: { page?: number }
  ): Promise<{
    data: Array<{
      id: number;
      seller_id: number;
      seller_name?: string;
      seller_image?: string;
      title?: string;
      content: string;
      image?: string;
      expires_at: string;
      likes_count: number;
      comments_count: number;
      is_liked?: boolean;
      created_at: string;
    }>;
    current_page: number;
    last_page: number;
    next_page_url?: string;
  }> {
    const queryParams = new URLSearchParams();
    if (params?.page) queryParams.append('page', params.page.toString());

    const query = queryParams.toString();
    const raw = await this.request<any>(
      `/expiring-posts/seller/${sellerId}${query ? `?${query}` : ''}`
    );

    // Handle nested data structure from API
    const container = raw?.data || raw;
    const postsData = container?.data || container || [];

    const list = Array.isArray(postsData) ? postsData : [];
    const normalized = list
      .filter(Boolean)
      .map((p: any) => {
        const sellerName =
          p?.seller_name ??
          p?.seller?.shop_name ??
          p?.seller?.shopName ??
          p?.seller?.name ??
          p?.seller?.user?.name ??
          'Ocean Seller';

        return {
          id: Number(p?.id ?? 0),
          seller_id: Number(p?.seller_id ?? p?.sellerId ?? p?.seller?.id ?? 0),
          seller_name: sellerName ? String(sellerName) : undefined,
          seller_image: p?.seller_image ?? p?.seller?.shop_image ?? p?.seller?.image ?? undefined,
          title: p?.title ? String(p.title) : undefined,
          content: String(p?.content ?? ''),
          image: p?.image ?? p?.media?.image ?? undefined,
          expires_at: String(p?.expires_at ?? p?.expiresAt ?? ''),
          likes_count: Number(p?.likes_count ?? p?.likes ?? 0),
          comments_count: Number(p?.comments_count ?? p?.comments ?? 0),
          is_liked: p?.is_liked ?? p?.liked ?? false,
          created_at: String(p?.created_at ?? p?.createdAt ?? new Date().toISOString()),
        };
      });

    return {
      data: normalized,
      current_page: container?.current_page || raw?.current_page || 1,
      last_page: container?.last_page || raw?.last_page || 1,
      next_page_url: container?.next_page_url || raw?.next_page_url,
    };
  }

  async toggleLikeExpiringPost(postId: number): Promise<{
    status?: string;
    is_liked?: boolean;
    likes_count?: number;
    message?: string;
  }> {
    return this.request(`/expiring-posts/${postId}/like`, {
      method: 'POST',
    });
  }

  async getExpiringPostComments(postId: number, productId?: number): Promise<{ data: CommentItem[] }> {
    // Use product_id if available, otherwise use postId
    const idToUse = productId || postId;
    // Use the products comments endpoint as specified
    return await this.request(`/products/${idToUse}/comments`);
  }

  async addExpiringPostComment(postId: number, payload: { user_id?: number; comment: string }) {
    try {
      return await this.request(`/expiring-posts/${postId}/comments`, {
        method: 'POST',
        body: JSON.stringify(payload),
      });
    } catch (e) {
      if (!this.isNotFoundError(e)) throw e;
      return this.request(`/products/${postId}/comments`, {
        method: 'POST',
        body: JSON.stringify(payload),
      });
    }
  }

  async replyToComment(commentId: number, payload: { user_id?: number; comment: string }) {
    return this.request(`/comments/${commentId}/reply`, {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  }

  async toggleLikeComment(commentId: number) {
    // Swagger screenshot shows /toggle-like; docs sometimes use /like.
    try {
      return await this.request(`/comments/${commentId}/toggle-like`, { method: 'POST' });
    } catch (e) {
      if (!this.isNotFoundError(e)) throw e;
      return this.request(`/comments/${commentId}/like`, { method: 'POST' });
    }
  }

  // Seller Follow/Unfollow
  async toggleFollowSeller(sellerId: number, userId?: number): Promise<{
    status?: string;
    is_following?: boolean;
    message?: string;
  }> {
    const payload: any = {};
    if (userId) {
      payload.user_id = userId;
    }
    return this.request(`/sellers/${sellerId}/follow`, {
      method: 'POST',
      body: Object.keys(payload).length > 0 ? JSON.stringify(payload) : undefined,
    });
  }

  async getSellerFollowStatus(sellerId: number, userId?: number): Promise<{
    is_following?: boolean;
    is_private?: boolean;
    follow_request_pending?: boolean;
  }> {
    const queryParams = new URLSearchParams();
    if (userId) queryParams.append('user_id', userId.toString());
    const query = queryParams.toString();
    return this.request(`/sellers/${sellerId}/follow-status${query ? `?${query}` : ''}`);
  }

  // Get seller by ID
  async getSeller(sellerId: number): Promise<any> {
    return this.request(`/sellers/${sellerId}`);
  }

  // Get all sellers
  async getAllSellers(params?: {
    page?: number;
    search?: string;
  }): Promise<{
    data: Array<any>;
    current_page?: number;
    last_page?: number;
  }> {
    const queryParams = new URLSearchParams();
    if (params?.page) queryParams.append('page', params.page.toString());
    if (params?.search) queryParams.append('search', params.search);
    
    const query = queryParams.toString();
    return this.request(`/sellers${query ? `?${query}` : ''}`);
  }

  // Global search (products, sellers, etc.)
  async globalSearch(query: string, params?: {
    type?: 'all' | 'products' | 'sellers' | 'users';
    page?: number;
  }): Promise<{
    success?: boolean;
    data?: {
      sellers?: Array<any>;
      products?: Array<any>;
      meta?: any;
    };
    sellers?: Array<any>;
    products?: Array<any>;
    users?: Array<any>;
  }> {
    const queryParams = new URLSearchParams();
    queryParams.append('query', query);
    if (params?.type) queryParams.append('type', params.type);
    if (params?.page) queryParams.append('page', params.page.toString());
    
    const queryString = queryParams.toString();
    return this.request(`/search${queryString ? `?${queryString}` : ''}`);
  }

  // Get seller followers count
  async getSellerFollowers(sellerId: number, params?: {
    page?: number;
  }): Promise<{
    success: boolean;
    total_followers: number;
    followers: {
      current_page: number;
      data: Array<any>;
      total: number;
      per_page: number;
    };
    seller: any;
  }> {
    const queryParams = new URLSearchParams();
    if (params?.page) queryParams.append('page', params.page.toString());
    
    const query = queryParams.toString();
    return this.request(`/sellers/${sellerId}/followers${query ? `?${query}` : ''}`);
  }

  // Get sellers that the user is following
  async getFollowingSellers(params?: {
    page?: number;
  }): Promise<{
    success: boolean;
    total_following: number;
    following_sellers: {
      current_page: number;
      data: Array<{
        id: number;
        shop_name: string;
        shop_image?: string;
        location?: string;
        about?: string;
        products_count?: number;
        followers_count?: number;
        created_at: string;
      }>;
      total: number;
      per_page: number;
    };
  }> {
    const queryParams = new URLSearchParams();
    if (params?.page) queryParams.append('page', params.page.toString());
    
    const query = queryParams.toString();
    return this.request(`/following/sellers${query ? `?${query}` : ''}`);
  }

  // Add custom product
  async addCustomProduct(productData: FormData): Promise<{
    message: string;
    product: {
      id: number;
      name: string;
      description: string;
      price: number;
      product_type: string;
      status: string;
      image: string;
      additional_images: string[];
      plane_id: number;
      business_idea_id: number;
      subsidiary_plane_id: number;
      country_id: number;
      category_id: number;
      subcategory_id: number;
      created_at: string;
      updated_at: string;
    };
  }> {
    const token = this.getAuthToken();
    const headers: Record<string, string> = {
      'Accept': 'application/json',
    };

    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const url = `${API_BASE_URL}/seller/add-custom-product`;
    const response = await fetch(url, {
      method: 'POST',
      headers,
      body: productData,
    });

    if (!response.ok) {
      const errorText = await response.text();
      let errorMessage = `API Error: ${response.status} ${response.statusText}`;
      try {
        const errorJson = JSON.parse(errorText);
        if (errorJson.errors && typeof errorJson.errors === 'object') {
          const validationErrors = Object.entries(errorJson.errors)
            .map(([field, messages]: [string, any]) => {
              const msg = Array.isArray(messages) ? messages.join(', ') : messages;
              return `${field}: ${msg}`;
            })
            .join('; ');
          errorMessage = validationErrors || errorJson.message || errorJson.error || errorMessage;
        } else {
          errorMessage = errorJson.message || errorJson.error || errorMessage;
        }
      } catch {
        errorMessage = errorText || errorMessage;
      }
      throw new Error(errorMessage);
    }

    return response.json();
  }

  // Update custom product details
  async updateCustomProductDetails(productId: number, data: {
    name?: string;
    description?: string;
    price?: string;
    category_id?: number;
    subcategory_id?: number;
  }): Promise<any> {
    return this.request(`/seller/custom-products/${productId}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(data),
    });
  }

  // Update custom product images
  async updateCustomProductImages(productId: number, imageData: FormData): Promise<any> {
    const token = this.getAuthToken();
    const headers: Record<string, string> = {
      'Accept': 'application/json',
    };

    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const url = `${API_BASE_URL}/seller/custom-products/${productId}/images`;
    const response = await fetch(url, {
      method: 'POST',
      headers,
      body: imageData,
    });

    if (!response.ok) {
      throw new Error(`Failed to update product images: ${response.statusText}`);
    }

    return response.json();
  }

  // Delete custom product
  async deleteCustomProduct(productId: number): Promise<any> {
    return this.request(`/seller/custom-products/${productId}`, {
      method: 'DELETE',
    });
  }

  // ========== Messaging API Methods ==========

  // Get user conversations
  async getConversations(userId: number): Promise<Array<{
    id: number;
    participants: Array<{
      id: number;
      name: string;
      phone: string;
      email?: string;
    }>;
    other_user?: {
      id: number;
      name: string;
      phone: string;
      email?: string;
    };
    last_message?: {
      id: number;
      content: string;
      created_at: string;
      sender_id: number;
    };
    is_read: boolean;
    created_at: string;
    updated_at: string;
  }>> {
    const raw = await this.request<any>(`/chat/conversations/${userId}`);
    // Handle both { data: [...] } and direct array formats
    const conversations = Array.isArray(raw) ? raw : (raw?.data || []);
    // Process to add other_user field
    return conversations.map((conv: any) => {
      const otherUser = conv.participants?.find((p: any) => p.id !== userId);
      return {
        ...conv,
        other_user: otherUser,
      };
    });
  }

  // Get conversation messages
  async getConversationMessages(conversationId: number, userId: number): Promise<Array<{
    id: number;
    conversation_id: number;
    sender_id: number;
    content: string;
    file?: string | null;
    file_type?: string | null;
    file_name?: string | null;
    created_at: string;
    is_read: boolean;
    sender?: {
      id: number;
      name: string;
      phone: string;
      email?: string;
    };
  }>> {
    const raw = await this.request<any>(`/chat/conversations/${conversationId}/messages/${userId}`);
    // Handle both { data: [...] } and direct array formats
    return Array.isArray(raw) ? raw : (raw?.data || []);
  }

  // Create conversation
  async createConversation(senderId: number, receiverId: number): Promise<{
    conversation_id?: number;
    id: number;
    sender_id: number;
    receiver_id: number;
    created_at: string;
  }> {
    const raw = await this.request<any>('/chat/conversation', {
      method: 'POST',
      body: JSON.stringify({
        sender_id: senderId,
        receiver_id: receiverId,
      }),
    });
    // Handle both { data: {...} } and direct object formats
    const conversation = raw?.data || raw;
    return {
      conversation_id: conversation.conversation_id || conversation.id,
      id: conversation.id || conversation.conversation_id,
      sender_id: conversation.sender_id,
      receiver_id: conversation.receiver_id,
      created_at: conversation.created_at,
    };
  }

  // Send message (supports file attachments via FormData)
  async sendMessage(
    conversationId: number,
    senderId: number,
    content: string,
    file?: File
  ): Promise<{
    id: number;
    conversation_id: number;
    sender_id: number;
    content: string;
    file?: string | null;
    file_type?: string | null;
    file_name?: string | null;
    created_at: string;
    is_read: boolean;
    sender?: {
      id: number;
      name: string;
    };
  }> {
    const token = this.getAuthToken();
    const formData = new FormData();
    formData.append('sender_id', senderId.toString());
    formData.append('content', content);
    if (file) {
      formData.append('file', file);
    }

    const headers: Record<string, string> = {
      'Accept': 'application/json',
    };

    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const url = `${API_BASE_URL}/chat/send/${conversationId}`;
    const response = await fetch(url, {
      method: 'POST',
      headers,
      body: formData,
    });

    if (!response.ok) {
      const errorText = await response.text();
      let errorMessage = `API Error: ${response.status} ${response.statusText}`;
      try {
        const errorJson = JSON.parse(errorText);
        errorMessage = errorJson.message || errorJson.error || errorMessage;
      } catch {
        errorMessage = errorText || errorMessage;
      }
      throw new Error(errorMessage);
    }

    const raw = await response.json();
    return raw?.data || raw;
  }

  // Mark messages as read
  async markMessagesAsRead(conversationId: number, userId: number): Promise<{
    status: string;
    message: string;
  }> {
    return this.request(`/chat/conversations/${conversationId}/read/${userId}`, {
      method: 'POST',
    });
  }

  // Delete message
  async deleteMessage(messageId: number): Promise<{
    status: string;
    message: string;
  }> {
    return this.request(`/chat/messages/${messageId}`, {
      method: 'DELETE',
    });
  }

  // Delete conversation
  async deleteConversation(conversationId: number, userId: number): Promise<{
    status: string;
    message: string;
  }> {
    return this.request(`/chat/conversations/${conversationId}`, {
      method: 'DELETE',
      body: JSON.stringify({ user_id: userId }),
    });
  }
}

export const apiService = new ApiService();

function isoToFlagEmoji(iso2: string) {
  // "TZ" -> 🇹🇿 using Regional Indicator Symbols
  if (!/^[A-Z]{2}$/.test(iso2)) return '';
  const A = 0x1f1e6; // Regional indicator symbol letter A
  const codePoints = [...iso2].map((ch) => A + (ch.charCodeAt(0) - 65));
  return String.fromCodePoint(...codePoints);
}


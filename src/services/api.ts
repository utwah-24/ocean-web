const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'https://sagenashi.com/api/v3';

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

function normalizeProduct(raw: any): Product {
  const nowIso = new Date().toISOString();

  const sellerName =
    raw?.seller_name ??
    raw?.sellerName ??
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

  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    try {
      const token = this.getAuthToken();
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        ...(options.headers as Record<string, string>),
      };

      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }

      const response = await fetch(`${API_BASE_URL}${endpoint}`, {
        ...options,
        headers,
      });

      if (!response.ok) {
        const errorText = await response.text();
        let errorMessage = `API Error: ${response.status} ${response.statusText}`;
        try {
          const errorJson = JSON.parse(errorText);
          errorMessage = errorJson.message || errorJson.error || errorMessage;
        } catch {
          // If not JSON, use the text or status text
          errorMessage = errorText || errorMessage;
        }
        throw new Error(errorMessage);
      }

      const contentType = response.headers.get('content-type');
      if (contentType && contentType.includes('application/json')) {
        return response.json();
      } else {
        // If response is not JSON, return empty object for type safety
        return {} as T;
      }
    } catch (error) {
      // Handle network errors or other fetch errors
      if (error instanceof TypeError && error.message.includes('fetch')) {
        console.error('Network error:', error);
        throw new Error('Unable to connect to the server. Please check your internet connection.');
      }
      throw error;
    }
  }

  // Authentication
  async login(countryCode: string, phone: string, password: string) {
    return this.request<{
      token: string;
      role: string;
      user: any;
    }>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({
        country_code: countryCode,
        phone,
        password,
      }),
    });
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
      status: string;
      message: string;
      user: any;
      token: string;
    }>('/auth/register', {
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
    }>('/orders', {
      method: 'POST',
      body: JSON.stringify(orderData),
    });
  }
}

export const apiService = new ApiService();


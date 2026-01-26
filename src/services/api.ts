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
    return this.request(`/product-interactions/personalized${query ? `?${query}` : ''}`);
  }

  async getProduct(id: number): Promise<Product & {
    additional_images?: string[];
    seller_rating?: number;
    seller_total_ratings?: number;
    seller_status?: string;
    seller_is_online?: boolean;
    seller_phone?: string;
    seller_location?: string;
    seller_about?: string;
  }> {
    return this.request(`/products/${id}`);
  }

  // Categories
  async getCategories(): Promise<{ data: Category[] }> {
    return this.request('/categories');
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


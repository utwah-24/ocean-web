# API Documentation

## Base URL
The API base URL is configured via environment variable `API_BASE_URL` (typically `https://sagenashi.com/api/v3` or similar).

## Authentication
Most endpoints require authentication via Bearer token in the Authorization header:
```
Authorization: Bearer {token}
```

---

## Table of Contents
1. [Authentication](#authentication-endpoints)
2. [Products](#products-endpoints)
3. [Sellers](#sellers-endpoints)
4. [Orders](#orders-endpoints)
5. [Categories & Subcategories](#categories--subcategories-endpoints)
6. [Comments & Ratings](#comments--ratings-endpoints)
7. [Posts](#posts-endpoints)
8. [Chat & Messaging](#chat--messaging-endpoints)
9. [Payment](#payment-endpoints)
10. [POS/Employees](#posemployees-endpoints)
11. [Real-time Services](#real-time-services-endpoints)
12. [Device Management](#device-management-endpoints)
13. [Subscriptions](#subscriptions-endpoints)

---

## Authentication Endpoints

### Login
**POST** `/auth/login` or `/login`

**Request Body:**
```json
{
  "country_code": "255",
  "phone": "123456789",
  "password": "user_password",
  "device_token": "fcm_token_here" // Optional
}
```

**Response (200 OK):**
```json
{
  "token": "jwt_token_here",
  "role": "buyer|seller|dropper|employee",
  "user_type_role": "Employee|Shop Owner", // Optional
  "user": {
    "id": 1,
    "name": "John Doe",
    "phone": "123456789",
    "email": "user@example.com",
    "seller": {
      "id": 85
    }, // Optional - if user is a seller
    "dropper": {
      "id": 10
    }, // Optional - if user is a dropper
    "employee": {
      "id": 5,
      "seller_id": 85,
      "is_admin": false,
      "branch": {
        "id": 2
      },
      "permissions": {
        "can_create_products": true,
        "can_edit_products": true,
        "can_manage_inventory": true,
        "can_view_branch_info": true,
        "can_view_all_branches": false
      }
    } // Optional - if user is an employee
  }
}
```

### Register
**POST** `/auth/register`

**Request Body:**
```json
{
  "name": "John Doe",
  "phone": "123456789",
  "country_code": "255",
  "email": "user@example.com",
  "password": "password123",
  "password_confirmation": "password123"
}
```

**Response (201 Created):**
```json
{
  "status": "success",
  "message": "User registered successfully",
  "user": {
    "id": 1,
    "name": "John Doe",
    "phone": "123456789",
    "email": "user@example.com"
  },
  "token": "jwt_token_here"
}
```

---

## Products Endpoints

### Get All Products
**GET** `/products`

**Query Parameters:**
- `page` (optional): Page number for pagination
- `category_id` (optional): Filter by category
- `subcategory_id` (optional): Filter by subcategory
- `seller_id` (optional): Filter by seller
- `search` (optional): Search query

**Response (200 OK):**
```json
{
  "data": [
    {
      "id": 1,
      "name": "Product Name",
      "description": "Product description",
      "price": "10000.00",
      "image": "https://example.com/image.jpg",
      "sellerId": 85,
      "seller_name": "Shop Name",
      "seller_image": "https://example.com/seller.jpg",
      "category_id": 1,
      "subcategory_id": 2,
      "created_at": "2025-01-01T00:00:00Z",
      "updated_at": "2025-01-01T00:00:00Z"
    }
  ],
  "current_page": 1,
  "last_page": 10,
  "per_page": 15,
  "total": 150
}
```

### Get Product by ID
**GET** `/products/{id}`

**Response (200 OK):**
```json
{
  "id": 1,
  "name": "Product Name",
  "description": "Product description",
  "price": "10000.00",
  "image": "https://example.com/image.jpg",
  "additional_images": [
    "https://example.com/image2.jpg"
  ],
  "sellerId": 85,
  "seller_name": "Shop Name",
  "seller_image": "https://example.com/seller.jpg",
  "seller_rating": 4.5,
  "seller_total_ratings": 100,
  "seller_status": "Open",
  "seller_is_online": true,
  "seller_phone": "255123456789",
  "seller_location": "Dar es Salaam",
  "seller_about": "About the seller",
  "category_id": 1,
  "subcategory_id": 2,
  "created_at": "2025-01-01T00:00:00Z",
  "updated_at": "2025-01-01T00:00:00Z"
}
```

### Get Seller Products
**GET** `/sellers/{sellerId}/products`

**Query Parameters:**
- `page` (optional): Page number
- `category_id` (optional): Filter by category
- `subcategory_id` (optional): Filter by subcategory

**Response (200 OK):**
```json
{
  "data": [
    {
      "id": 1,
      "name": "Product Name",
      "price": "10000.00",
      "image": "https://example.com/image.jpg"
    }
  ],
  "current_page": 1,
  "last_page": 5
}
```

### Create Product
**POST** `/products`

**Headers:**
- `Authorization: Bearer {token}`
- `Content-Type: multipart/form-data`

**Request Body (multipart/form-data):**
- `seller_id`: Integer (required)
- `business_idea_id`: Integer (default: 1)
- `subcategory_id`: Integer (required)
- `name`: String (required)
- `description`: String (required)
- `price`: String (required)
- `image`: File (required) - Main product image
- `additional_images[]`: File[] (optional) - Additional product images
- `additional_images_crop_modes`: JSON string (optional) - Crop modes for additional images

**Response (201 Created):**
```json
{
  "status": "success",
  "message": "Product created successfully",
  "data": {
    "id": 1,
    "name": "Product Name",
    "price": "10000.00",
    "image": "https://example.com/image.jpg"
  }
}
```

---

## Sellers Endpoints

### Get All Sellers
**GET** `/sellers`

**Query Parameters:**
- `page` (optional): Page number
- `search` (optional): Search query
- `location` (optional): Filter by location

**Response (200 OK):**
```json
{
  "data": [
    {
      "id": 85,
      "user_id": 1,
      "shop_name": "My Shop",
      "shop_image": "https://example.com/shop.jpg",
      "cover_image": "https://example.com/cover.jpg",
      "about": "Shop description",
      "location": "Dar es Salaam",
      "total_orders": 150,
      "average_rating": 4.5,
      "total_ratings": 100,
      "status": "Open",
      "is_online": true,
      "last_seen": "2025-01-01T12:00:00Z",
      "created_at": "2025-01-01T00:00:00Z",
      "response_time": "Within 1 hour",
      "response_rate": "95%",
      "offers_delivery": true,
      "is_escrow": true,
      "escrow_phone": "255123456789"
    }
  ],
  "current_page": 1,
  "last_page": 10
}
```

### Get Seller by ID
**GET** `/sellers/{id}`

**Response (200 OK):**
```json
{
  "id": 85,
  "user_id": 1,
  "shop_name": "My Shop",
  "shop_image": "https://example.com/shop.jpg",
  "cover_image": "https://example.com/cover.jpg",
  "about": "Shop description",
  "location": "Dar es Salaam",
  "total_orders": 150,
  "average_rating": 4.5,
  "total_ratings": 100,
  "status": "Open",
  "is_online": true,
  "last_seen": "2025-01-01T12:00:00Z",
  "created_at": "2025-01-01T00:00:00Z",
  "seller_ratings": [],
  "response_time": "Within 1 hour",
  "response_rate": "95%",
  "offers_delivery": true,
  "is_escrow": true,
  "escrow_phone": "255123456789"
}
```

### Follow Seller
**POST** `/sellers/{id}/follow`

**Headers:**
- `Authorization: Bearer {token}`
- `Content-Type: application/json`

**Request Body:**
```json
{
  "user_id": 1
}
```

**Response (200 OK):**
```json
{
  "status": "success",
  "is_following": true,
  "message": "Successfully followed seller"
}
```

### Get Follow Status
**GET** `/sellers/{id}/follow-status?user_id={userId}`

**Response (200 OK):**
```json
{
  "is_following": true,
  "is_private": false,
  "follow_request_pending": false
}
```

### Get Seller Followers
**GET** `/sellers/{sellerId}/followers?user_id={userId}`

**Response (200 OK):**
```json
{
  "data": [
    {
      "id": 1,
      "name": "Follower Name",
      "phone": "123456789",
      "followed_at": "2025-01-01T00:00:00Z"
    }
  ],
  "current_page": 1,
  "last_page": 5
}
```

### Accept Follow Request
**POST** `/follow-requests/{requestId}/accept`

**Headers:**
- `Authorization: Bearer {token}`

**Response (200 OK):**
```json
{
  "status": "success",
  "message": "Follow request accepted"
}
```

### Reject Follow Request
**POST** `/follow-requests/{requestId}/reject`

**Headers:**
- `Authorization: Bearer {token}`

**Response (200 OK):**
```json
{
  "status": "success",
  "message": "Follow request rejected"
}
```

### Toggle Seller Private Mode
**POST** `/sellers/{sellerId}/toggle-private`

**Headers:**
- `Authorization: Bearer {token}`

**Response (200 OK):**
```json
{
  "status": "success",
  "is_private": true,
  "message": "Seller privacy toggled"
}
```

---

## Orders Endpoints

### Create Order
**POST** `/orders`

**Headers:**
- `Content-Type: application/json`

**Request Body:**
```json
{
  "order_items": [
    {
      "product_id": 1,
      "quantity": 2,
      "price": "10000.00"
    }
  ],
  "buyer_id": 1,
  "total_amount": 20000.00,
  "delivery_fee": 5000.00,
  "buyer_lat": -6.7924,
  "buyer_long": 39.2083,
  "payment_type": "online|escrow|cash_on_delivery",
  "msisdn": "255123456789",
  "provider": "pawapay|tigopesa|mpesa",
  "escrow_fee_responsibility": "buyer|seller",
  "number_of_payments": "1" // Optional, for installment payments
}
```

**Response (200/201 OK):**
```json
{
  "success": true,
  "message": "Order created successfully",
  "orderId": 123,
  "transactionId": "txn_123456", // For online payments
  "referenceId": "ref_123456" // For escrow payments
}
```

### Get Order Details
**GET** `/orders/{id}`

**Response (200 OK):**
```json
{
  "id": 123,
  "buyer_id": 1,
  "seller_id": 85,
  "status": "pending|processing|completed|cancelled",
  "total_amount": "20000.00",
  "delivery_fee": "5000.00",
  "payment_type": "online",
  "payment_status": "pending|completed|failed",
  "order_items": [
    {
      "id": 1,
      "product_id": 1,
      "product_name": "Product Name",
      "quantity": 2,
      "price": "10000.00"
    }
  ],
  "created_at": "2025-01-01T00:00:00Z",
  "updated_at": "2025-01-01T00:00:00Z"
}
```

### Get Buyer Orders
**GET** `/buyer/{buyerId}/orders`

**Query Parameters:**
- `order_id` (optional): Filter by specific order ID

**Response (200 OK):**
```json
{
  "success": true,
  "data": [
    {
      "id": 123,
      "buyer_id": 1,
      "seller_id": 85,
      "status": "completed",
      "total_amount": "20000.00",
      "created_at": "2025-01-01T00:00:00Z"
    }
  ]
}
```

---

## Categories & Subcategories Endpoints

### Get All Categories
**GET** `/categories`

**Response (200 OK):**
```json
{
  "data": [
    {
      "id": 1,
      "name": "Category Name",
      "image": "https://example.com/category.jpg",
      "created_at": "2025-01-01T00:00:00Z"
    }
  ]
}
```

### Get All Subcategories
**GET** `/subcategories`

**Query Parameters:**
- `seller_id` (optional): Filter by seller

**Response (200 OK):**
```json
{
  "data": [
    {
      "id": 1,
      "category_id": 1,
      "name": "Subcategory Name",
      "created_at": "2025-01-01T00:00:00Z"
    }
  ]
}
```

---

## Comments & Ratings Endpoints

### Get Product Comments
**GET** `/products/{productId}/comments`

**Response (200 OK):**
```json
{
  "data": [
    {
      "id": 1,
      "user_id": 1,
      "user_name": "John Doe",
      "comment": "Great product!",
      "likes_count": 5,
      "is_liked": false,
      "created_at": "2025-01-01T00:00:00Z"
    }
  ]
}
```

### Toggle Like Comment
**POST** `/comments/{commentId}/like`

**Headers:**
- `Authorization: Bearer {token}`

**Response (200 OK):**
```json
{
  "status": "success",
  "is_liked": true,
  "likes_count": 6
}
```

---

## Posts Endpoints

### Get Expiring Posts Feed
**GET** `/expiring-posts/feed`

**Query Parameters:**
- `page` (optional): Page number
- `user_id` (optional): User ID for personalized feed

**Headers:**
- `Authorization: Bearer {token}` (optional)

**Response (200 OK):**
```json
{
  "data": {
    "data": [
      {
        "id": 1,
        "seller_id": 85,
        "seller_name": "Shop Name",
        "seller_image": "https://example.com/seller.jpg",
        "content": "Post content",
        "image": "https://example.com/post.jpg",
        "expires_at": "2025-01-01T23:59:59Z",
        "likes_count": 10,
        "comments_count": 5,
        "is_liked": false,
        "created_at": "2025-01-01T00:00:00Z"
      }
    ],
    "current_page": 1,
    "last_page": 10,
    "next_page_url": "https://api.example.com/expiring-posts/feed?page=2"
  }
}
```

### Search Expiring Posts
**GET** `/expiring-posts` or `/expiring-posts/feed`

**Query Parameters:**
- `q` (optional): Search query
- `seller_name` (optional): Filter by seller name
- `seller_id` (optional): Filter by seller ID
- `page` (optional): Page number
- `user_id` (optional): User ID

**Response (200 OK):**
```json
{
  "data": {
    "data": [
      {
        "id": 1,
        "seller_id": 85,
        "content": "Post content",
        "expires_at": "2025-01-01T23:59:59Z"
      }
    ],
    "current_page": 1,
    "last_page": 5
  }
}
```

### Get Post by Code
**GET** `/expiring-posts/code/{code}`

**Response (200 OK):**
```json
{
  "data": {
    "id": 1,
    "code": "ABC123",
    "seller_id": 85,
    "content": "Post content",
    "expires_at": "2025-01-01T23:59:59Z"
  }
}
```

### Like Post
**POST** `/expiring-posts/{postId}/like`

**Headers:**
- `Authorization: Bearer {token}`

**Response (200 OK):**
```json
{
  "status": "success",
  "is_liked": true,
  "likes_count": 11
}
```

---

## Chat & Messaging Endpoints

### Create Conversation
**POST** `/conversations`

**Headers:**
- `Authorization: Bearer {token}`
- `Content-Type: application/json`

**Request Body:**
```json
{
  "sender_id": 1,
  "receiver_id": 2
}
```

**Response (200/201 OK):**
```json
{
  "data": {
    "conversation_id": 1,
    "id": 1,
    "sender_id": 1,
    "receiver_id": 2,
    "created_at": "2025-01-01T00:00:00Z"
  }
}
```

### Get Conversations
**GET** `/conversations`

**Headers:**
- `Authorization: Bearer {token}`

**Query Parameters:**
- `user_id`: User ID

**Response (200 OK):**
```json
{
  "data": [
    {
      "id": 1,
      "sender_id": 1,
      "receiver_id": 2,
      "receiver_name": "Jane Doe",
      "last_message": "Hello!",
      "last_message_time": "2025-01-01T12:00:00Z",
      "unread_count": 2
    }
  ]
}
```

### Get Messages
**GET** `/conversations/{conversationId}/messages`

**Headers:**
- `Authorization: Bearer {token}`

**Query Parameters:**
- `page` (optional): Page number

**Response (200 OK):**
```json
{
  "data": [
    {
      "id": 1,
      "conversation_id": 1,
      "sender_id": 1,
      "receiver_id": 2,
      "message": "Hello!",
      "created_at": "2025-01-01T12:00:00Z"
    }
  ],
  "current_page": 1,
  "last_page": 5
}
```

### Send Message
**POST** `/conversations/{conversationId}/messages`

**Headers:**
- `Authorization: Bearer {token}`
- `Content-Type: application/json`

**Request Body:**
```json
{
  "sender_id": 1,
  "receiver_id": 2,
  "message": "Hello!"
}
```

**Response (200/201 OK):**
```json
{
  "status": "success",
  "data": {
    "id": 1,
    "conversation_id": 1,
    "sender_id": 1,
    "receiver_id": 2,
    "message": "Hello!",
    "created_at": "2025-01-01T12:00:00Z"
  }
}
```

---

## Payment Endpoints

### Calculate Delivery Fee
**POST** `/calculate-delivery-fee`

**Request Body:**
```json
{
  "seller_lat": -6.7924,
  "seller_long": 39.2083,
  "buyer_lat": -6.8000,
  "buyer_long": 39.2000
}
```

**Response (200 OK):**
```json
{
  "delivery_fee": 5000.00,
  "distance_km": 5.2,
  "estimated_time": "30 minutes"
}
```

### Redeem Coupon
**POST** `/coupons/redeem`

**Headers:**
- `Authorization: Bearer {token}`
- `Content-Type: application/json`

**Request Body:**
```json
{
  "code": "COUPON123",
  "order_amount": 20000.00
}
```

**Response (200 OK):**
```json
{
  "status": "success",
  "discount_amount": 2000.00,
  "final_amount": 18000.00,
  "coupon": {
    "id": 1,
    "code": "COUPON123",
    "discount_percentage": 10
  }
}
```

### Check Payment Status
**GET** `/payments/{transactionId}/status`

**Response (200 OK):**
```json
{
  "success": true,
  "status": "completed|pending|failed",
  "transaction_id": "txn_123456",
  "amount": 20000.00,
  "message": "Payment completed successfully"
}
```

### Request Escrow Payment
**POST** `/ecommerce/client/purchases/request-to-pay`

**Request Body:**
```json
{
  "phoneNumber": "255123456789",
  "reference": "ref_123456"
}
```

**Response (200 OK):**
```json
{
  "success": true,
  "message": "Payment request sent",
  "reference": "ref_123456"
}
```

### Check Escrow Status
**GET** `/ecommerce/client/purchases/{referenceId}`

**Response (200 OK):**
```json
{
  "success": true,
  "status": "completed|pending|failed",
  "reference": "ref_123456",
  "amount": 20000.00
}
```

### PawaPay - Get Providers
**GET** `/api/v3/pawapay/providers`

**Query Parameters:**
- `country`: Country code (e.g., "TZA")
- `operationType`: Operation type (e.g., "DEPOSIT")

**Response (200 OK):**
```json
{
  "data": [
    {
      "id": "pawapay",
      "name": "PawaPay",
      "logo": "https://example.com/logo.png",
      "is_operational": true
    }
  ]
}
```

### PawaPay - Initiate Deposit
**POST** `/api/v3/pawapay/deposit/initiate`

**Request Body:**
```json
{
  "amount": 10000.00,
  "currency": "TZS",
  "provider": "pawapay",
  "msisdn": "255123456789",
  "customerMessage": "Subscription payment"
}
```

**Response (200 OK):**
```json
{
  "status": "success",
  "deposit_id": "dep_123456",
  "status": "PENDING",
  "message": "Deposit initiated"
}
```

### PawaPay - Check Deposit Status
**GET** `/api/v3/pawapay/deposit/{deposit_id}/status`

**Response (200 OK):**
```json
{
  "status": "COMPLETED|PENDING|FAILED|CANCELLED|REJECTED",
  "deposit_id": "dep_123456",
  "amount": 10000.00,
  "message": "Payment completed"
}
```

---

## POS/Employees Endpoints

### Get Employees
**GET** `/pos/employees`

**Query Parameters:**
- `user_id`: User ID (required)
- `branch_id` (optional): Filter by branch
- `active` (optional): Filter by active status (true/false)
- `is_admin` (optional): Filter by admin status (true/false)
- `page` (optional): Page number
- `per_page` (optional): Items per page

**Headers:**
- `Authorization: Bearer {token}`

**Response (200 OK):**
```json
{
  "data": [
    {
      "id": 1,
      "user_id": 2,
      "seller_id": 85,
      "branch_id": 2,
      "is_admin": false,
      "active": true,
      "permissions": {
        "can_create_products": true,
        "can_edit_products": true,
        "can_manage_inventory": true
      },
      "created_at": "2025-01-01T00:00:00Z"
    }
  ],
  "current_page": 1,
  "last_page": 5
}
```

### Create Employee
**POST** `/pos/employees`

**Headers:**
- `Authorization: Bearer {token}`
- `Content-Type: application/json`

**Request Body:**
```json
{
  "user_id": 2,
  "seller_id": 85,
  "branch_id": 2,
  "is_admin": false,
  "permissions": {
    "can_create_products": true,
    "can_edit_products": true,
    "can_manage_inventory": true
  }
}
```

**Response (201 Created):**
```json
{
  "status": "success",
  "data": {
    "id": 1,
    "user_id": 2,
    "seller_id": 85,
    "branch_id": 2
  }
}
```

### Get Employee Details
**GET** `/pos/employees/{id}?user_id={userId}`

**Headers:**
- `Authorization: Bearer {token}`

**Response (200 OK):**
```json
{
  "id": 1,
  "user_id": 2,
  "seller_id": 85,
  "branch_id": 2,
  "is_admin": false,
  "active": true,
  "permissions": {
    "can_create_products": true,
    "can_edit_products": true
  }
}
```

### Update Employee
**PUT/PATCH** `/pos/employees/{id}`

**Headers:**
- `Authorization: Bearer {token}`
- `Content-Type: application/json`

**Request Body:**
```json
{
  "is_admin": true,
  "permissions": {
    "can_create_products": true,
    "can_edit_products": true,
    "can_manage_inventory": true
  }
}
```

**Response (200 OK):**
```json
{
  "status": "success",
  "data": {
    "id": 1,
    "is_admin": true
  }
}
```

### Deactivate Employee
**DELETE** `/pos/employees/{id}`

**Headers:**
- `Authorization: Bearer {token}`

**Response (200 OK):**
```json
{
  "status": "success",
  "message": "Employee deactivated"
}
```

### Get Employee Performance
**GET** `/pos/employees/{id}/performance`

**Query Parameters:**
- `user_id`: User ID (required)
- `start_date`: Start date (YYYY-MM-DD) (required)
- `end_date`: End date (YYYY-MM-DD) (required)

**Headers:**
- `Authorization: Bearer {token}`

**Response (200 OK):**
```json
{
  "data": {
    "employee_id": 1,
    "start_date": "2025-01-01",
    "end_date": "2025-01-31",
    "total_orders": 50,
    "total_revenue": 1000000.00,
    "average_order_value": 20000.00,
    "products_created": 10,
    "products_edited": 5
  }
}
```

---

## Real-time Services Endpoints

### User Heartbeat/Status
**POST** `/realtime/heartbeat`

**Headers:**
- `Authorization: Bearer {token}`
- `Content-Type: application/json`

**Request Body:**
```json
{
  "user_id": 1,
  "status": "online|offline",
  "lat": -6.7924,
  "long": 39.2083
}
```

**Response (200 OK):**
```json
{
  "status": "success",
  "message": "Status updated"
}
```

---

## Device Management Endpoints

### Update Device Token
**POST** `/update-device-token`

**Headers:**
- `Authorization: Bearer {token}`
- `Content-Type: application/json`

**Request Body:**
```json
{
  "device_token": "fcm_token_here"
}
```

**Response (200 OK):**
```json
{
  "status": "success",
  "message": "Device token updated"
}
```

**Error Responses:**
- `401 Unauthorized`: Token expired or invalid
- `302 Found`: Redirect (usually indicates auth issue)

---

## Subscriptions Endpoints

### Get My Subscription
**GET** `/api/v3/subscription/my-subscription`

**Headers:**
- `Authorization: Bearer {token}`
- `Accept: application/json`

**Response (200 OK):**
```json
{
  "status": "success",
  "data": {
    "id": 3,
    "seller_id": 85,
    "plan_name": "Enterprise",
    "plan_type": "monthly",
    "amount": "0.00",
    "currency": "USD",
    "payguard_reference": "TEST123",
    "payment_status": "paid",
    "started_at": "2025-08-05T09:42:47.000000Z",
    "expires_at": "2025-09-05T09:42:47.000000Z",
    "is_active": true,
    "features": [
      "delivery",
      "cart",
      "analytics",
      "priority_support",
      "advanced_analytics",
      "enterprise_analytics",
      "custom_features"
    ],
    "boost_multiplier": 10,
    "created_at": "2025-08-05T09:42:47.000000Z",
    "updated_at": "2025-08-05T09:44:05.000000Z"
  },
  "has_subscription": true,
  "can_use_delivery": true,
  "can_use_cart": true,
  "can_use_analytics": true,
  "boost_multiplier": 10,
  "max_products": null,
  "max_posts_per_day": null
}
```

---

## Error Responses

### Standard Error Format
```json
{
  "status": "error",
  "message": "Error description",
  "errors": {
    "field_name": ["Error message for field"]
  }
}
```

### Common HTTP Status Codes
- `200 OK`: Request successful
- `201 Created`: Resource created successfully
- `400 Bad Request`: Invalid request data
- `401 Unauthorized`: Authentication required or token expired
- `403 Forbidden`: Insufficient permissions
- `404 Not Found`: Resource not found
- `422 Unprocessable Entity`: Validation errors
- `500 Internal Server Error`: Server error

---

## Notes

1. **Base URL**: All endpoints are relative to the `API_BASE_URL` environment variable
2. **Authentication**: Most endpoints require a Bearer token in the Authorization header
3. **Content-Type**: 
   - JSON endpoints use `application/json`
   - File upload endpoints use `multipart/form-data`
4. **Pagination**: List endpoints typically support pagination with `page` and `per_page` parameters
5. **Date Format**: All dates are in ISO 8601 format (e.g., `2025-01-01T00:00:00Z`)
6. **Currency**: Amounts are typically returned as strings to preserve precision
7. **Phone Numbers**: Phone numbers should include country code (e.g., `255123456789` for Tanzania)

---

## Version History

- **v3**: Current API version (as of 2025)
- Base URL includes `/api/v3` prefix

---

*Last Updated: January 2025*


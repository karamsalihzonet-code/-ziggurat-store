# ZIGGURAT - System Architecture & Design

---

## 1. High-Level Architecture

```
┌─────────────────────────────────────────────────────┐
│                   USER BROWSER                       │
│  (HTML5 Frontend - ziggurat-frontend.html)           │
│                                                      │
│  ┌──────────────┐  ┌────────────┐  ┌─────────────┐  │
│  │  Marketplace │  │   Seller   │  │   Buyer     │  │
│  │  Dashboard   │  │ Dashboard  │  │ Dashboard   │  │
│  └──────────────┘  └────────────┘  └─────────────┘  │
└────────────────────┬────────────────────────────────┘
                     │ HTTP/HTTPS
                     │ JSON API
                     ▼
┌─────────────────────────────────────────────────────┐
│             BACKEND SERVER (Node.js)                 │
│          (ziggurat-backend.js - Port 5000)          │
│                                                      │
│  ┌──────────────────────────────────────────────┐  │
│  │  Express.js Router & Middleware              │  │
│  │  - Authentication (JWT)                      │  │
│  │  - CORS & Security Headers (Helmet)          │  │
│  │  - File Upload Handler (Multer)              │  │
│  └──────────────────────────────────────────────┘  │
│                                                      │
│  ┌──────────────────────────────────────────────┐  │
│  │  API Routes                                  │  │
│  │  ├─ /api/auth       (Registration/Login)    │  │
│  │  ├─ /api/products   (Marketplace)            │  │
│  │  ├─ /api/seller     (Seller Operations)      │  │
│  │  ├─ /api/orders     (Purchase & Escrow)      │  │
│  │  ├─ /api/disputes   (Conflict Resolution)    │  │
│  │  └─ /api/reviews    (Ratings)                │  │
│  └──────────────────────────────────────────────┘  │
│                                                      │
│  ┌──────────────────────────────────────────────┐  │
│  │  Business Logic                              │  │
│  │  - Image Sanitization (Sharp)                │  │
│  │  - Password Hashing (Bcrypt)                 │  │
│  │  - Token Generation (JWT)                    │  │
│  │  - Escrow Management                         │  │
│  └──────────────────────────────────────────────┘  │
└────────────┬─────────────────────────────────┬─────┘
             │ SQL Queries                    │ File Storage
             │ Connection Pooling            │ /uploads/products/
             ▼                                 ▼
    ┌──────────────────┐            ┌──────────────────┐
    │   PostgreSQL     │            │  File System     │
    │   Database       │            │  (Local/S3/CDN)  │
    │                  │            │                  │
    │ ├─ users         │            │ Product Images   │
    │ ├─ stores        │            │ (Sanitized .webp)│
    │ ├─ products      │            │                  │
    │ ├─ orders        │            │ EXIF Removed ✓   │
    │ ├─ disputes      │            │                  │
    │ └─ reviews       │            │                  │
    └──────────────────┘            └──────────────────┘
```

---

## 2. Data Flow Diagrams

### 2.1 User Registration Flow

```
User Input
    │
    ▼
┌─────────────────────────────┐
│ POST /api/auth/register     │
│ {username, email, pass...}  │
└──────────────┬──────────────┘
               │
               ▼
    ┌──────────────────────┐
    │ Validate Input       │
    │ - Check email unique │
    │ - Check username     │
    └──────────┬───────────┘
               │
               ▼
    ┌──────────────────────┐
    │ Hash Password        │
    │ bcrypt 12 rounds     │
    └──────────┬───────────┘
               │
               ▼
    ┌──────────────────────┐
    │ Insert into DB       │
    │ (users table)        │
    └──────────┬───────────┘
               │
               ▼
    ┌──────────────────────┐
    │ Generate JWT Token   │
    │ (expires 7 days)     │
    └──────────┬───────────┘
               │
               ▼
    Return: Token + User Data
    Store in: localStorage
```

### 2.2 Product Upload & Image Processing

```
Seller Action
    │
    ▼
┌─────────────────────────────┐
│ Seller Fills Product Form    │
│ - Title, Description, Price  │
│ - Select Image File          │
└──────────────┬──────────────┘
               │
               ▼
┌─────────────────────────────┐
│ multipart/form-data Upload  │
│ /api/seller/products         │
└──────────────┬──────────────┘
               │
               ▼
    ┌──────────────────────┐
    │ File Validation      │
    │ - Check MIME type    │
    │ - Check file size    │
    │ (max 5MB)            │
    └──────────┬───────────┘
               │
               ▼
    ┌──────────────────────┐
    │ Image Sanitization   │
    │ (Sharp Library)      │
    │                      │
    │ 1. Remove EXIF       │ ◄─── Security!
    │ 2. Remove Metadata   │
    │ 3. Compress          │
    │ 4. Convert to WebP   │
    └──────────┬───────────┘
               │
               ▼
    ┌──────────────────────┐
    │ Save to Disk         │
    │ /uploads/products/   │
    │ 1735689012345.webp   │
    └──────────┬───────────┘
               │
               ▼
    ┌──────────────────────┐
    │ Save DB Record       │
    │ - title, price, url  │
    │ (products table)     │
    └──────────┬───────────┘
               │
               ▼
    Return: Product URL
    Display: Image on UI
```

### 2.3 Purchase & Escrow Flow

```
Buyer Clicks "PURCHASE NOW"
    │
    ▼
┌──────────────────────────┐
│ POST /api/orders         │
│ {productId: 1}           │
└────────────┬─────────────┘
             │
             ▼
    ┌────────────────────────┐
    │ Create Order Record    │
    │ - status: "pending"    │
    │ - amount held in       │
    │   escrow               │
    └────────────┬───────────┘
             │
             ▼
    ┌────────────────────────┐
    │ Notify Buyer           │
    │ "Awaiting Payment"     │
    └────────────┬───────────┘
             │
             ▼
Buyer Confirms Payment
    │
    ▼
┌──────────────────────────┐
│ POST /api/orders/:id/    │
│ confirm-payment          │
└────────────┬─────────────┘
             │
             ▼
    ┌────────────────────────┐
    │ Update Order Status    │
    │ → "payment_confirmed"  │
    │ Notify Seller          │
    │ "Deliver Product"      │
    └────────────┬───────────┘
             │
             ▼
    ┌────────────────────────┐
    │ Seller Delivers        │
    │ Product/Service        │
    │ (manual/instant link)  │
    └────────────┬───────────┘
             │
             ▼
Buyer Confirms Delivery
    │
    ▼
┌──────────────────────────┐
│ POST /api/orders/:id/    │
│ confirm-delivery         │
└────────────┬─────────────┘
             │
             ▼
    ┌────────────────────────┐
    │ Release Escrow         │
    │ ├─ Update Status       │
    │ │ → "completed"        │
    │ ├─ Release Funds to    │
    │ │ Seller               │
    │ └─ Enable Reviews      │
    └────────────┬───────────┘
             │
             ▼
    Transaction Complete ✓
```

### 2.4 Dispute Resolution Flow

```
Buyer/Seller Initiates Dispute
    │
    ▼
┌──────────────────────────┐
│ POST /api/disputes       │
│ {orderId, reason}        │
└────────────┬─────────────┘
             │
             ▼
    ┌────────────────────────┐
    │ Create Dispute Record  │
    │ - status: "open"       │
    │ - order held in escrow │
    │ - pending admin review │
    └────────────┬───────────┘
             │
             ▼
    ┌────────────────────────┐
    │ Notify Admin           │
    │ "Dispute Requires      │
    │ Review"                │
    └────────────┬───────────┘
             │
             ▼
Admin Reviews Dispute
    │
    ▼
┌──────────────────────────┐
│ POST /api/disputes/:id/  │
│ resolve                  │
└────────────┬─────────────┘
             │
             ▼
    ┌────────────────────────┐
    │ Two Options:           │
    │                        │
    │ A) Release to Seller   │
    │    └─ orderStatus:     │
    │       "completed"      │
    │                        │
    │ B) Refund to Buyer     │
    │    └─ orderStatus:     │
    │       "refunded"       │
    └────────────┬───────────┘
             │
             ▼
    Dispute Resolved ✓
    Funds Released
```

---

## 3. Database Schema

### Users Table
```sql
CREATE TABLE users (
  id SERIAL PRIMARY KEY,
  username VARCHAR(255) UNIQUE NOT NULL,
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,     -- bcrypt hash
  user_type VARCHAR(50),                   -- buyer, seller, admin
  created_at TIMESTAMP,
  updated_at TIMESTAMP,
  is_verified BOOLEAN,
  is_suspended BOOLEAN
);
```

### Stores Table
```sql
CREATE TABLE stores (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id),
  store_name VARCHAR(255),
  store_description TEXT,
  store_rating DECIMAL(3, 2),
  total_sales INTEGER,
  is_active BOOLEAN
);
```

### Products Table
```sql
CREATE TABLE products (
  id SERIAL PRIMARY KEY,
  store_id INTEGER REFERENCES stores(id),
  title VARCHAR(255),
  description TEXT,
  price DECIMAL(12, 2),
  category VARCHAR(100),
  image_url VARCHAR(500),              -- sanitized image path
  delivery_type VARCHAR(50),
  is_active BOOLEAN,
  stock_quantity INTEGER
);
```

### Orders Table
```sql
CREATE TABLE orders (
  id SERIAL PRIMARY KEY,
  buyer_id INTEGER REFERENCES users(id),
  seller_id INTEGER REFERENCES users(id),
  product_id INTEGER REFERENCES products(id),
  amount DECIMAL(12, 2),
  status VARCHAR(50),                  -- pending, payment_confirmed, 
                                       -- delivered, completed, disputed, refunded
  escrow_released BOOLEAN,             -- Escrow flag
  created_at TIMESTAMP,
  buyer_confirmed_delivery BOOLEAN
);

-- Status Flow:
-- pending → payment_confirmed → completed → (review)
--       ↓
--    disputed → (admin review) → refunded OR completed
```

### Disputes Table
```sql
CREATE TABLE disputes (
  id SERIAL PRIMARY KEY,
  order_id INTEGER REFERENCES orders(id),
  initiated_by INTEGER REFERENCES users(id),
  reason TEXT,
  status VARCHAR(50),                  -- open, resolved, closed
  admin_resolution TEXT,
  resolved_by INTEGER REFERENCES users(id),
  created_at TIMESTAMP
);
```

### Reviews Table
```sql
CREATE TABLE reviews (
  id SERIAL PRIMARY KEY,
  order_id INTEGER REFERENCES orders(id),
  reviewer_id INTEGER REFERENCES users(id),
  rating INTEGER,                      -- 1-5 stars
  review_text TEXT
);
```

---

## 4. Authentication & Security

### JWT Token Structure

```
Header:
{
  "alg": "HS256",
  "typ": "JWT"
}

Payload:
{
  "userId": 1,
  "userType": "seller",
  "iat": 1704067200,
  "exp": 1704672000  (7 days)
}

Signature:
HMACSHA256(
  base64UrlEncode(header) + "." +
  base64UrlEncode(payload),
  SECRET_KEY
)
```

### Password Hashing

```
User Input: "MyPassword123!"
    ↓
bcrypt.hash(password, 12)
    ↓
Salt Generated (round 12)
    ↓
Hash: $2b$12$aJ7K9nXz8mK2pLq4rS9vXeXmK9qL2xN5oP8sT1uV2wX3yZ4...
    ↓
Stored in Database
```

### API Authorization

```javascript
// Client sends:
Authorization: Bearer eyJhbGciOiJIUzI1NiIs...

// Server:
1. Extract token from header
2. Verify signature with JWT_SECRET
3. Check expiration time
4. Extract userId & userType
5. Allow/Deny based on permissions
```

---

## 5. Image Processing Pipeline

```
Original Image Upload
    ↓
    ├─ Type Check (JPEG, PNG, WebP)
    ├─ Size Check (< 5MB)
    └─ MIME validation
    ↓
File Stored Temporarily
    ↓
Sharp Processing:
    ├─ Read image data
    ├─ Remove all metadata
    │   └─ EXIF data (camera info, location)
    │   └─ IPTC data (keywords)
    │   └─ XMP data (editor info)
    ├─ Compress image
    └─ Convert to WebP format
    ↓
Save Final Image
    └─ /uploads/products/1735689012345.webp
    ↓
Delete Temporary File
    ↓
Store URL in Database
    └─ image_url: "/uploads/products/1735689012345.webp"
    ↓
Display on Frontend
    └─ <img src="/uploads/products/1735689012345.webp">
```

### Why WebP + Metadata Removal?

| Feature | Benefit |
|---------|---------|
| **EXIF Removal** | No location tracking, device fingerprinting |
| **WebP Format** | 25% smaller file size, better quality |
| **Compression** | Faster downloads, less storage |
| **No Metadata** | Privacy protection for sellers |

---

## 6. Security Layers

### 1. Transport Security
```
HTTPS/TLS
    ├─ Encrypt data in transit
    ├─ SSL/TLS certificates
    └─ Protection against MITM attacks
```

### 2. Authentication
```
JWT Tokens
    ├─ Stateless authentication
    ├─ No session storage needed
    └─ Time-limited (7 days)
```

### 3. Authorization
```
Role-Based Access Control (RBAC)
    ├─ buyer: Can buy, review
    ├─ seller: Can sell, upload products
    └─ admin: Can resolve disputes
```

### 4. Input Validation
```
All API Inputs
    ├─ Email format validation
    ├─ Password strength check
    ├─ SQL injection prevention
    │   └─ Parameterized queries
    └─ XSS prevention
        └─ Input sanitization
```

### 5. Output Encoding
```
Error Messages
    ├─ Generic messages to clients
    ├─ Stack traces NOT sent
    └─ Detailed logging server-side only
```

### 6. Password Security
```
User Passwords
    ├─ Bcrypt 12 rounds
    ├─ Salted hashes
    └─ Never stored in plain text
```

### 7. API Security
```
Helmet.js Headers
    ├─ X-Frame-Options (Clickjacking)
    ├─ X-Content-Type-Options
    ├─ Content-Security-Policy
    └─ Strict-Transport-Security
```

---

## 7. Escrow System Flow

```
Transaction States:

[Buyer Creates Order]
         ↓
    pending
    (Money not released yet)
         ↓
[Buyer Confirms Payment]
         ↓
    payment_confirmed
    (Seller notified, can start delivery)
         ↓
[Seller Delivers Product]
    (Link/File provided to buyer)
         ↓
[Buyer Confirms Delivery]
         ↓
    completed ← ESCROW RELEASED ✓
    (Money sent to Seller)
    (Buyer can review)

Alternative: Dispute
    payment_confirmed
         ↓
    [Buyer/Seller Initiates Dispute]
         ↓
    disputed
    (Escrow held, admin review)
         ↓
    [Admin Reviews & Decides]
         ↓
    completed → Money to Seller
    OR
    refunded → Money to Buyer
```

---

## 8. Performance Optimization

### Database
```
Indexes:
- products(store_id)
- orders(buyer_id)
- orders(seller_id)
- orders(status)

Connection Pool:
- Min: 2 connections
- Max: 20 connections
```

### Frontend
```
Lazy Loading:
- Images load on scroll
- Infinite pagination for products

Caching:
- localStorage for auth token
- sessionStorage for temp data

Compression:
- GZIP enabled
- WebP images (smaller files)
```

### Backend
```
Caching:
- Redis for session caching (optional)
- Database query caching

Rate Limiting:
- Implement on production
- Prevent brute force attacks

CDN:
- Serve images from CDN
- Reduce server load
```

---

## 9. Scaling Architecture

### Horizontal Scaling
```
                    ┌─ Node Server 1 (Port 5001)
Load Balancer ─────┼─ Node Server 2 (Port 5002)
                    └─ Node Server 3 (Port 5003)
                           ↓
                    Shared PostgreSQL
                           ↓
                    Shared S3/CDN Storage
```

### Vertical Scaling
```
Single Server
├─ More CPU cores
├─ More RAM (database caching)
└─ SSD storage (faster queries)
```

### Database Scaling
```
Primary DB (writes)
    ├─ Read Replica 1
    ├─ Read Replica 2
    └─ Read Replica 3
```

---

## 10. Deployment Architecture

### Development
```
localhost:3000  ← Frontend
localhost:5000  ← Backend
localhost:5432  ← PostgreSQL
```

### Production (Cloud)
```
CloudFront CDN → Images (cached)
                ↓
            Nginx (Reverse Proxy)
                ↓
    ┌───────────┼───────────┐
    ↓           ↓           ↓
App Server  App Server  App Server
(PM2)       (PM2)       (PM2)
                ↓
        RDS PostgreSQL
        (Managed DB)
                ↓
        S3/CloudStorage
        (Images + Backups)
```

---

## 11. API Rate Limiting Strategy

```javascript
// Recommended rate limits:

// Auth endpoints (strict)
/api/auth/login      → 5 requests/minute
/api/auth/register   → 2 requests/minute

// Product endpoints (normal)
/api/products        → 60 requests/minute
/api/seller/products → 30 requests/minute

// Order endpoints (normal)
/api/orders          → 20 requests/minute

// Dispute endpoints (strict)
/api/disputes        → 10 requests/minute
```

---

## 12. Future Enhancements

```
Phase 2:
├─ Multi-currency support
├─ Real crypto payment integration
├─ Advanced analytics dashboard
└─ Email notifications

Phase 3:
├─ Mobile app (React Native)
├─ API versioning
├─ GraphQL support
└─ Message system (buyer ↔ seller)

Phase 4:
├─ Video hosting for products
├─ Advanced search/filters
├─ Recommendation engine
└─ Affiliate program
```

---

**Architecture Version**: 1.0  
**Last Updated**: 2024  
**Maintainer**: Development Team

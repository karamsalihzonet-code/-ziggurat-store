# ZIGGURAT - Digital Products E-Commerce Platform
## Complete Setup & Deployment Guide

---

## Table of Contents
1. [Architecture Overview](#architecture-overview)
2. [System Requirements](#system-requirements)
3. [Installation & Setup](#installation--setup)
4. [Database Setup](#database-setup)
5. [Backend Configuration](#backend-configuration)
6. [Running the Platform](#running-the-platform)
7. [API Documentation](#api-documentation)
8. [Security Features](#security-features)
9. [Production Deployment](#production-deployment)

---

## Architecture Overview

### Technology Stack
- **Backend**: Node.js + Express.js
- **Database**: PostgreSQL
- **Frontend**: HTML5 + CSS3 + Vanilla JavaScript
- **Authentication**: JWT (JSON Web Tokens)
- **Image Processing**: Sharp (EXIF removal, WebP conversion)
- **Security**: Helmet, bcrypt, CORS

### Core Features
✅ **Zero-knowledge image processing** (EXIF metadata removed automatically)
✅ **Secure password hashing** with bcrypt
✅ **JWT-based stateless authentication**
✅ **Escrow system** for secure transactions
✅ **Dispute resolution** with admin intervention
✅ **Product upload** with sanitization
✅ **Dark mode UI** with modern design
✅ **Responsive design** for all devices

### Database Schema
- **users**: Authentication and user profiles
- **stores**: Seller storefronts
- **products**: Digital product listings
- **orders**: Purchase transactions
- **disputes**: Conflict resolution
- **reviews**: Buyer feedback

---

## System Requirements

### Prerequisites
- **Node.js** 16.0.0 or higher
- **PostgreSQL** 12 or higher
- **npm** 7.0.0 or higher
- **Linux/macOS** or WSL2 on Windows
- **4GB RAM** minimum (8GB recommended)
- **2GB disk space** for uploads

### Tested Platforms
- Ubuntu 20.04 LTS
- macOS 12+
- Debian 11
- CentOS 8

---

## Installation & Setup

### Step 1: Clone/Download Files
```bash
# Create project directory
mkdir ziggurat && cd ziggurat

# Copy the following files to this directory:
# - ziggurat-backend.js
# - package.json
# - .env.example
# - ziggurat-frontend.html
```

### Step 2: Install Dependencies
```bash
npm install
```

This installs:
- express (Web framework)
- pg (PostgreSQL client)
- bcrypt (Password hashing)
- jsonwebtoken (JWT auth)
- multer (File uploads)
- sharp (Image processing)
- helmet (Security headers)
- cors (Cross-origin requests)
- dotenv (Environment variables)

### Step 3: Create Environment File
```bash
cp .env.example .env
```

Edit `.env` with your configuration:
```env
DB_USER=ziggurat_user
DB_HOST=localhost
DB_NAME=ziggurat_db
DB_PASSWORD=YourSecurePassword123!
DB_PORT=5432
PORT=5000
NODE_ENV=development
JWT_SECRET=your-super-secret-key-minimum-32-characters-long-change-this
ALLOWED_ORIGINS=http://localhost:3000,http://localhost:5000
```

---

## Database Setup

### Step 1: Install PostgreSQL

**Ubuntu/Debian:**
```bash
sudo apt update
sudo apt install postgresql postgresql-contrib
```

**macOS (via Homebrew):**
```bash
brew install postgresql@14
```

**Windows:**
Download from: https://www.postgresql.org/download/windows/

### Step 2: Create Database User & Database

```bash
# Connect to PostgreSQL
sudo -u postgres psql

# Create user
CREATE USER ziggurat_user WITH PASSWORD 'YourSecurePassword123!';

# Create database
CREATE DATABASE ziggurat_db OWNER ziggurat_user;

# Grant privileges
ALTER ROLE ziggurat_user CREATEDB;

# Verify
\du
\l

# Exit
\q
```

### Step 3: Initialize Tables

Tables are created automatically when you start the backend for the first time. Check the logs:

```
✓ Database initialized successfully
```

### Step 4: Backup & Restore (Optional)

**Backup:**
```bash
pg_dump -U ziggurat_user ziggurat_db > backup.sql
```

**Restore:**
```bash
psql -U ziggurat_user ziggurat_db < backup.sql
```

---

## Backend Configuration

### Security Settings

**In production, update these in `.env`:**

```env
# Strong JWT secret (use: openssl rand -hex 32)
JWT_SECRET=a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6q7r8s9t0

# Secure database connection
DB_HOST=your-db-server.com
DB_SSL=true

# Restrict CORS origins
ALLOWED_ORIGINS=https://yourdomain.com

# Production mode
NODE_ENV=production
```

### File Upload Configuration

Maximum file size: **5MB** (in ziggurat-backend.js line 197)

To change:
```javascript
limits: { fileSize: 10 * 1024 * 1024 } // 10MB
```

### Session & Token Management

- **Token expiry**: 7 days (configurable in line 317)
- **Password rounds**: 12 (bcrypt cost factor, line 397)
- **CORS policy**: Whitelist origins in `.env`

---

## Running the Platform

### Start Backend Server

```bash
# Development mode (with auto-reload)
npm run dev

# Production mode
npm start
```

Expected output:
```
✓ Database initialized successfully
🚀 Ziggurat Backend running on http://localhost:5000
```

### Open Frontend

Open `ziggurat-frontend.html` in a web browser:
```bash
# Option 1: Direct file
open ziggurat-frontend.html

# Option 2: Local server (recommended)
python3 -m http.server 3000
# Then visit: http://localhost:3000
```

### Create Test Account

1. Click **LOGIN** in the header
2. Click **"Create account"**
3. Fill in details:
   - Username: `testuser`
   - Email: `test@example.com`
   - Password: `TestPass123!`
   - User Type: `Seller` or `Buyer`
4. Click **CREATE ACCOUNT**

---

## API Documentation

### Authentication Endpoints

#### Register User
```
POST /api/auth/register

Request:
{
  "username": "john_doe",
  "email": "john@example.com",
  "password": "SecurePass123!",
  "userType": "seller" | "buyer"
}

Response: 201 Created
{
  "message": "User registered successfully",
  "user": {
    "id": 1,
    "username": "john_doe",
    "email": "john@example.com"
  },
  "token": "eyJhbGciOiJIUzI1NiIs..."
}
```

#### Login User
```
POST /api/auth/login

Request:
{
  "email": "john@example.com",
  "password": "SecurePass123!"
}

Response: 200 OK
{
  "message": "Login successful",
  "user": {...},
  "token": "eyJhbGciOiJIUzI1NiIs..."
}
```

### Seller Endpoints

#### Create Store
```
POST /api/seller/store
Authorization: Bearer <token>

Request:
{
  "storeName": "Digital Assets Pro",
  "storeDescription": "High-quality digital products"
}

Response: 201 Created
{
  "message": "Store created successfully",
  "store": {
    "id": 1,
    "user_id": 1,
    "store_name": "Digital Assets Pro",
    ...
  }
}
```

#### Upload Product
```
POST /api/seller/products
Authorization: Bearer <token>
Content-Type: multipart/form-data

Form Data:
- storeId: 1
- title: "JavaScript Course"
- description: "Complete JavaScript tutorial"
- price: 19.99
- category: "courses"
- deliveryType: "instant_download" | "manual_delivery"
- image: <file>

Response: 201 Created
{
  "message": "Product created successfully",
  "product": {
    "id": 1,
    "store_id": 1,
    "title": "JavaScript Course",
    "price": "19.99",
    "image_url": "/uploads/products/1234567890.webp",
    ...
  }
}
```

#### Get Seller's Products
```
GET /api/seller/products/:storeId
Authorization: Bearer <token>

Response: 200 OK
{
  "products": [
    {
      "id": 1,
      "title": "JavaScript Course",
      "price": "19.99",
      ...
    }
  ]
}
```

### Marketplace Endpoints

#### Get All Products
```
GET /api/products?category=courses&search=javascript&page=1

Response: 200 OK
{
  "products": [...],
  "total": 42,
  "page": 1,
  "limit": 20
}
```

### Order & Escrow Endpoints

#### Create Order
```
POST /api/orders
Authorization: Bearer <token>

Request:
{
  "productId": 1
}

Response: 201 Created
{
  "message": "Order created. Awaiting payment confirmation.",
  "order": {
    "id": 1,
    "buyer_id": 5,
    "seller_id": 1,
    "product_id": 1,
    "amount": "19.99",
    "status": "pending",
    ...
  },
  "escrowInfo": {
    "orderId": 1,
    "amount": "19.99",
    "status": "ESCROW_HELD"
  }
}
```

#### Confirm Payment
```
POST /api/orders/:orderId/confirm-payment
Authorization: Bearer <token>

Response: 200 OK
{
  "message": "Payment confirmed. Seller notified.",
  "order": {
    ...
    "status": "payment_confirmed"
  }
}
```

#### Confirm Delivery
```
POST /api/orders/:orderId/confirm-delivery
Authorization: Bearer <token>

Response: 200 OK
{
  "message": "Delivery confirmed. Payment released to seller.",
  "order": {
    ...
    "status": "completed",
    "escrow_released": true
  }
}
```

### Dispute Endpoints

#### Initiate Dispute
```
POST /api/disputes
Authorization: Bearer <token>

Request:
{
  "orderId": 1,
  "reason": "Product not received"
}

Response: 201 Created
{
  "message": "Dispute created. Admin will review within 48 hours.",
  "dispute": {
    "id": 1,
    "order_id": 1,
    "initiated_by": 5,
    "reason": "Product not received",
    "status": "open"
  }
}
```

#### Resolve Dispute (Admin Only)
```
POST /api/disputes/:disputeId/resolve
Authorization: Bearer <token>

Request:
{
  "resolution": "Full refund issued to buyer",
  "releaseToSeller": false
}

Response: 200 OK
{
  "message": "Dispute resolved",
  "dispute": {
    ...
    "status": "resolved"
  },
  "orderStatus": "refunded"
}
```

### Review Endpoints

#### Post Review
```
POST /api/reviews
Authorization: Bearer <token>

Request:
{
  "orderId": 1,
  "rating": 5,
  "reviewText": "Excellent course, highly recommended!"
}

Response: 201 Created
{
  "message": "Review posted successfully",
  "review": {
    "id": 1,
    "order_id": 1,
    "rating": 5,
    "review_text": "..."
  }
}
```

---

## Security Features

### 1. Password Security
- Bcrypt hashing with 12 rounds
- Minimum password requirements (implement in frontend validation)
- Salt generation per password

### 2. Authentication
- JWT tokens with 7-day expiration
- Token refresh not implemented (add if needed)
- Stateless authentication (no server sessions)

### 3. Image Security
- EXIF metadata stripped automatically
- Converted to WebP format
- File type validation
- 5MB file size limit
- Stored outside web root in production

### 4. API Security
- Helmet.js security headers
- CORS restriction to whitelisted origins
- Authorization middleware on protected routes
- SQL injection prevention via parameterized queries

### 5. Database Security
- SSL connection support (configure in production)
- Encrypted password storage
- Role-based access (users table)
- Transaction support for order operations

### 6. Error Handling
- Generic error messages to clients (no stack traces)
- Detailed logging on server only
- No sensitive data in error responses

---

## Production Deployment

### Pre-Deployment Checklist

```bash
# 1. Update environment variables
nano .env
# - Change JWT_SECRET (use: openssl rand -hex 32)
# - Set NODE_ENV=production
# - Configure real database credentials
# - Update ALLOWED_ORIGINS to your domain

# 2. Install production dependencies only
npm ci --production

# 3. Enable SSL/TLS
# Update database connection: ssl: { rejectUnauthorized: false }

# 4. Set up reverse proxy (Nginx)
# Configure rate limiting
# Set up SSL certificates (Let's Encrypt)

# 5. Database backups
pg_dump -U ziggurat_user -d ziggurat_db -Fc > backup_$(date +%Y%m%d).dump

# 6. Monitor logs
# Set up log rotation
# Configure error tracking (Sentry, etc.)
```

### Deployment Platforms

#### Option 1: AWS (EC2 + RDS)
1. Launch EC2 instance (Ubuntu 20.04 LTS)
2. Create RDS PostgreSQL instance
3. Install Node.js and npm
4. Clone repository
5. Configure environment
6. Use PM2 for process management
7. Set up Nginx as reverse proxy
8. Configure CloudFront for CDN

#### Option 2: Heroku
```bash
heroku create ziggurat
heroku addons:create heroku-postgresql:standard-0
git push heroku main
```

#### Option 3: DigitalOcean App Platform
1. Connect GitHub repository
2. Create app from Dockerfile
3. Set environment variables
4. Provision managed PostgreSQL
5. Deploy

#### Option 4: Docker Containerization

Create `Dockerfile`:
```dockerfile
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --production
COPY . .
EXPOSE 5000
CMD ["node", "ziggurat-backend.js"]
```

Create `docker-compose.yml`:
```yaml
version: '3.8'
services:
  backend:
    build: .
    ports:
      - "5000:5000"
    environment:
      DB_HOST: db
      DB_NAME: ziggurat_db
      DB_USER: ziggurat_user
      DB_PASSWORD: password
    depends_on:
      - db
  db:
    image: postgres:14
    environment:
      POSTGRES_DB: ziggurat_db
      POSTGRES_USER: ziggurat_user
      POSTGRES_PASSWORD: password
    volumes:
      - postgres_data:/var/lib/postgresql/data

volumes:
  postgres_data:
```

Start with Docker:
```bash
docker-compose up -d
```

### Process Management (PM2)

```bash
npm install -g pm2

# Start application
pm2 start ziggurat-backend.js --name "ziggurat"

# Enable auto-restart on reboot
pm2 startup
pm2 save

# Monitor
pm2 monit

# Logs
pm2 logs ziggurat
```

### Nginx Configuration

```nginx
upstream ziggurat {
    server localhost:5000;
}

server {
    listen 80;
    server_name yourdomain.com;
    
    location / {
        proxy_pass http://ziggurat;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    }
}
```

### SSL Certificate (Let's Encrypt)

```bash
sudo apt install certbot python3-certbot-nginx
sudo certbot certonly --nginx -d yourdomain.com
sudo nginx -s reload
```

---

## Monitoring & Maintenance

### Health Check
```bash
curl http://localhost:5000/api/products
# Should return products list
```

### Database Maintenance
```sql
-- Check database size
SELECT pg_size_pretty(pg_database_size('ziggurat_db'));

-- Analyze query performance
ANALYZE;
VACUUM ANALYZE;

-- Check active connections
SELECT count(*) FROM pg_stat_activity;
```

### Performance Optimization
- Add indexes for frequently queried columns
- Implement caching (Redis)
- Use database connection pooling
- Optimize image storage (CDN)
- Compress responses (gzip)

### Backup Strategy
```bash
# Daily automated backups
0 2 * * * pg_dump -U ziggurat_user ziggurat_db | gzip > /backups/ziggurat_$(date +\%Y\%m\%d).sql.gz

# Keep 30 days of backups
find /backups -name "ziggurat_*.sql.gz" -mtime +30 -delete
```

---

## Troubleshooting

### Common Issues

**Issue**: Database connection error
```
Error: connect ECONNREFUSED 127.0.0.1:5432
```
**Solution**: 
- Verify PostgreSQL is running: `sudo systemctl status postgresql`
- Check credentials in `.env`
- Ensure database exists: `psql -U ziggurat_user -d ziggurat_db`

**Issue**: Port already in use
```
Error: listen EADDRINUSE: address already in use :::5000
```
**Solution**:
- Kill process: `lsof -ti:5000 | xargs kill -9`
- Or change PORT in `.env`

**Issue**: Image upload fails
```
Error: Image processing failed
```
**Solution**:
- Verify Sharp is installed: `npm list sharp`
- Check file permissions: `chmod 755 uploads/`
- Verify file size < 5MB

**Issue**: JWT authentication fails
```
Error: Invalid or expired token
```
**Solution**:
- Check token format in Authorization header: `Bearer <token>`
- Verify JWT_SECRET matches between requests
- Check token expiration (default 7 days)

---

## Support & Contributing

For issues, feature requests, or contributions:
1. Check documentation
2. Review API logs
3. Check database queries
4. Review security settings

---

**Version**: 1.0.0  
**Last Updated**: 2024  
**License**: MIT

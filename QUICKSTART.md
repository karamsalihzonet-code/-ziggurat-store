# ZIGGURAT - Quick Start (10 Minutes)

## Prerequisites
- Node.js 16+ (`node --version`)
- PostgreSQL 12+ (`psql --version`)
- npm (`npm --version`)

---

## 1. Setup PostgreSQL (2 min)

### Linux/Mac:
```bash
# Mac (Homebrew)
brew install postgresql@14

# Ubuntu/Debian
sudo apt install postgresql

# Start PostgreSQL
pg_ctl -D /usr/local/var/postgres start

# Or use system service
sudo systemctl start postgresql
```

### Create Database:
```bash
# Open PostgreSQL
psql postgres

# Run these commands:
CREATE USER ziggurat_user WITH PASSWORD 'ziggurat123';
CREATE DATABASE ziggurat_db OWNER ziggurat_user;
ALTER ROLE ziggurat_user CREATEDB;
\q
```

---

## 2. Setup Ziggurat (3 min)

### Install Dependencies:
```bash
cd ziggurat
npm install
```

### Configure Environment:
```bash
cp .env.example .env

# Edit .env (update password if needed):
nano .env
```

Make sure `.env` contains:
```
DB_PASSWORD=ziggurat123
NODE_ENV=development
JWT_SECRET=your-secret-key-min-32-chars
```

---

## 3. Start Backend (2 min)

```bash
npm run dev
```

Expected output:
```
✓ Database initialized successfully
🚀 Ziggurat Backend running on http://localhost:5000
```

---

## 4. Open Frontend (3 min)

**Option A: Direct Browser**
```bash
# Open ziggurat-frontend.html in your browser
open ziggurat-frontend.html
```

**Option B: Local Server** (Recommended)
```bash
# In another terminal
python3 -m http.server 3000

# Open: http://localhost:3000
```

---

## 5. Test It Out (1 min)

1. **Create Account**
   - Click "LOGIN" → "Create account"
   - Fill in: `testuser`, `test@example.com`, `test123`, `Seller`
   - Click "CREATE ACCOUNT"

2. **Add Product** (Seller)
   - Click "SELLER" in header
   - Click "+ ADD PRODUCT"
   - Fill in details:
     - Title: "My First Product"
     - Description: "Test product"
     - Price: 9.99
     - Delivery Type: "Instant Download"
   - Click "CREATE PRODUCT"

3. **Browse Products** (Buyer)
   - Create another account as "Buyer"
   - Click "MARKETPLACE"
   - See your product listed
   - Click product card to see details

---

## API Endpoints Reference

### Auth
```
POST /api/auth/register
POST /api/auth/login
```

### Products
```
GET /api/products
POST /api/seller/products (auth required)
GET /api/seller/products/:storeId (auth required)
```

### Orders
```
POST /api/orders (auth required)
POST /api/orders/:orderId/confirm-payment (auth required)
POST /api/orders/:orderId/confirm-delivery (auth required)
```

### Disputes
```
POST /api/disputes (auth required)
POST /api/disputes/:disputeId/resolve (admin only)
```

---

## Default Test Credentials

After first run, test with:
- **Email**: `test@example.com`
- **Password**: `test123`

---

## Stop Server

Press `Ctrl+C` in terminal running backend

---

## Common Issues

| Issue | Solution |
|-------|----------|
| Port 5000 in use | Change PORT in .env |
| Database connection error | Check PostgreSQL is running |
| CORS errors | Update ALLOWED_ORIGINS in .env |
| Image upload fails | Check file size < 5MB |

---

## Next Steps

1. ✅ Read [SETUP_GUIDE.md](./SETUP_GUIDE.md) for production setup
2. ✅ Review [Security Features](./SETUP_GUIDE.md#security-features)
3. ✅ Configure authentication and payments
4. ✅ Deploy to production (Heroku, AWS, DigitalOcean)

---

**Ready to scale? See SETUP_GUIDE.md for production deployment!**

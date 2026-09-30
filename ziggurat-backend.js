/**
 * ZIGGURAT E-Commerce Platform
 * Secure Digital Products Marketplace
 * Backend: Node.js + Express + PostgreSQL
 */

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const multer = require('multer');
const sharp = require('sharp');
const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');
require('dotenv').config();

const app = express();

// ============================================
// SECURITY & MIDDLEWARE
// ============================================

app.use(helmet()); // Security headers
app.use(cors({
  origin: process.env.ALLOWED_ORIGINS?.split(',') || ['http://localhost:3000'],
  credentials: true
}));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ limit: '10mb', extended: true }));

// ============================================
// DATABASE CONNECTION
// ============================================

const pool = new Pool({
  user: process.env.DB_USER || 'ziggurat_user',
  host: process.env.DB_HOST || 'localhost',
  database: process.env.DB_NAME || 'ziggurat_db',
  password: process.env.DB_PASSWORD,
  port: process.env.DB_PORT || 5432,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

// ============================================
// DATABASE INITIALIZATION
// ============================================

const initializeDatabase = async () => {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        username VARCHAR(255) UNIQUE NOT NULL,
        email VARCHAR(255) UNIQUE NOT NULL,
        password_hash VARCHAR(255) NOT NULL,
        user_type VARCHAR(50) NOT NULL CHECK (user_type IN ('buyer', 'seller', 'admin')),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        is_verified BOOLEAN DEFAULT FALSE,
        is_suspended BOOLEAN DEFAULT FALSE
      );

      CREATE TABLE IF NOT EXISTS stores (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        store_name VARCHAR(255) NOT NULL,
        store_description TEXT,
        store_rating DECIMAL(3, 2) DEFAULT 0,
        total_sales INTEGER DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        is_active BOOLEAN DEFAULT TRUE
      );

      CREATE TABLE IF NOT EXISTS products (
        id SERIAL PRIMARY KEY,
        store_id INTEGER NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
        title VARCHAR(255) NOT NULL,
        description TEXT NOT NULL,
        price DECIMAL(12, 2) NOT NULL,
        category VARCHAR(100),
        image_url VARCHAR(500),
        is_active BOOLEAN DEFAULT TRUE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        stock_quantity INTEGER DEFAULT 1,
        delivery_type VARCHAR(50) NOT NULL CHECK (delivery_type IN ('instant_download', 'manual_delivery'))
      );

      CREATE TABLE IF NOT EXISTS orders (
        id SERIAL PRIMARY KEY,
        buyer_id INTEGER NOT NULL REFERENCES users(id),
        seller_id INTEGER NOT NULL REFERENCES users(id),
        product_id INTEGER NOT NULL REFERENCES products(id),
        amount DECIMAL(12, 2) NOT NULL,
        status VARCHAR(50) DEFAULT 'pending' CHECK (status IN ('pending', 'payment_confirmed', 'delivered', 'completed', 'disputed', 'refunded')),
        escrow_released BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        buyer_confirmed_delivery BOOLEAN DEFAULT FALSE,
        confirmed_delivery_at TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS disputes (
        id SERIAL PRIMARY KEY,
        order_id INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
        initiated_by INTEGER NOT NULL REFERENCES users(id),
        reason TEXT NOT NULL,
        status VARCHAR(50) DEFAULT 'open' CHECK (status IN ('open', 'resolved', 'closed')),
        admin_resolution TEXT,
        resolved_by INTEGER REFERENCES users(id),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS reviews (
        id SERIAL PRIMARY KEY,
        order_id INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
        reviewer_id INTEGER NOT NULL REFERENCES users(id),
        rating INTEGER CHECK (rating BETWEEN 1 AND 5),
        review_text TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE INDEX IF NOT EXISTS idx_products_store_id ON products(store_id);
      CREATE INDEX IF NOT EXISTS idx_orders_buyer_id ON orders(buyer_id);
      CREATE INDEX IF NOT EXISTS idx_orders_seller_id ON orders(seller_id);
      CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
    `);
    console.log('✓ Database initialized successfully');
  } catch (error) {
    console.error('✗ Database initialization error:', error.message);
  }
};

// ============================================
// IMAGE UPLOAD & SANITIZATION
// ============================================

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = path.join(__dirname, 'uploads/products');
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueName = `${Date.now()}-${Math.random().toString(36).substring(7)}.webp`;
    cb(null, uniqueName);
  }
});

const fileFilter = (req, file, cb) => {
  const allowedMimes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
  if (allowedMimes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('Invalid file type. Only images allowed.'), false);
  }
};

const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: 5 * 1024 * 1024 } // 5MB max
});

// Sanitize image: remove EXIF data and convert to WebP
const sanitizeImage = async (filePath) => {
  try {
    const outputPath = filePath.replace(/\.[^.]+$/, '.webp');
    await sharp(filePath)
      .withMetadata(false) // Remove all metadata including EXIF
      .toFormat('webp')
      .toFile(outputPath);
    
    // Delete original file
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
    return outputPath;
  } catch (error) {
    console.error('Image sanitization error:', error.message);
    throw error;
  }
};

// ============================================
// AUTHENTICATION & JWT
// ============================================

const JWT_SECRET = process.env.JWT_SECRET || 'your-super-secret-key-change-in-production';
const JWT_EXPIRY = '7d';

const generateToken = (userId, userType) => {
  return jwt.sign(
    { userId, userType, iat: Math.floor(Date.now() / 1000) },
    JWT_SECRET,
    { expiresIn: JWT_EXPIRY }
  );
};

const verifyToken = (token) => {
  try {
    return jwt.verify(token, JWT_SECRET);
  } catch (error) {
    return null;
  }
};

const authMiddleware = (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  const token = authHeader.substring(7);
  const decoded = verifyToken(token);

  if (!decoded) {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }

  req.user = decoded;
  next();
};

// ============================================
// AUTH ROUTES
// ============================================

// Register User
app.post('/api/auth/register', async (req, res) => {
  try {
    const { username, email, password, userType } = req.body;

    if (!username || !email || !password || !userType) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    if (userType !== 'buyer' && userType !== 'seller') {
      return res.status(400).json({ error: 'Invalid user type' });
    }

    // Check if user exists
    const existingUser = await pool.query(
      'SELECT id FROM users WHERE email = $1 OR username = $2',
      [email, username]
    );

    if (existingUser.rows.length > 0) {
      return res.status(409).json({ error: 'User already exists' });
    }

    // Hash password
    const passwordHash = await bcrypt.hash(password, 12);

    // Create user
    const result = await pool.query(
      'INSERT INTO users (username, email, password_hash, user_type, is_verified) VALUES ($1, $2, $3, $4, $5) RETURNING id, username, email, user_type',
      [username, email, passwordHash, userType, true] // In production, send verification email
    );

    const user = result.rows[0];
    const token = generateToken(user.id, user.user_type);

    res.status(201).json({
      message: 'User registered successfully',
      user: { id: user.id, username: user.username, email: user.email },
      token
    });
  } catch (error) {
    console.error('Registration error:', error.message);
    res.status(500).json({ error: 'Registration failed' });
  }
});

// Login User
app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password required' });
    }

    const result = await pool.query(
      'SELECT id, username, email, password_hash, user_type, is_suspended FROM users WHERE email = $1',
      [email]
    );

    if (result.rows.length === 0) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const user = result.rows[0];

    if (user.is_suspended) {
      return res.status(403).json({ error: 'Account suspended' });
    }

    const passwordMatch = await bcrypt.compare(password, user.password_hash);
    if (!passwordMatch) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const token = generateToken(user.id, user.user_type);

    res.json({
      message: 'Login successful',
      user: { id: user.id, username: user.username, email: user.email, userType: user.user_type },
      token
    });
  } catch (error) {
    console.error('Login error:', error.message);
    res.status(500).json({ error: 'Login failed' });
  }
});

// ============================================
// SELLER ROUTES
// ============================================

// Create Store
app.post('/api/seller/store', authMiddleware, async (req, res) => {
  try {
    if (req.user.userType !== 'seller') {
      return res.status(403).json({ error: 'Only sellers can create stores' });
    }

    const { storeName, storeDescription } = req.body;

    if (!storeName) {
      return res.status(400).json({ error: 'Store name required' });
    }

    const result = await pool.query(
      'INSERT INTO stores (user_id, store_name, store_description) VALUES ($1, $2, $3) RETURNING *',
      [req.user.userId, storeName, storeDescription || '']
    );

    res.status(201).json({
      message: 'Store created successfully',
      store: result.rows[0]
    });
  } catch (error) {
    console.error('Store creation error:', error.message);
    res.status(500).json({ error: 'Failed to create store' });
  }
});

// Upload Product
app.post('/api/seller/products', authMiddleware, upload.single('image'), async (req, res) => {
  try {
    if (req.user.userType !== 'seller') {
      return res.status(403).json({ error: 'Only sellers can create products' });
    }

    const { storeId, title, description, price, category, deliveryType } = req.body;

    if (!storeId || !title || !description || !price || !deliveryType) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    // Verify store ownership
    const storeCheck = await pool.query(
      'SELECT id FROM stores WHERE id = $1 AND user_id = $2',
      [storeId, req.user.userId]
    );

    if (storeCheck.rows.length === 0) {
      return res.status(403).json({ error: 'Unauthorized store access' });
    }

    let imageUrl = null;
    if (req.file) {
      try {
        const sanitizedPath = await sanitizeImage(req.file.path);
        imageUrl = `/uploads/products/${path.basename(sanitizedPath)}`;
      } catch (imageError) {
        return res.status(400).json({ error: 'Image processing failed' });
      }
    }

    const result = await pool.query(
      'INSERT INTO products (store_id, title, description, price, category, image_url, delivery_type) VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *',
      [storeId, title, description, parseFloat(price), category || null, imageUrl, deliveryType]
    );

    res.status(201).json({
      message: 'Product created successfully',
      product: result.rows[0]
    });
  } catch (error) {
    console.error('Product creation error:', error.message);
    res.status(500).json({ error: 'Failed to create product' });
  }
});

// Get Seller's Products
app.get('/api/seller/products/:storeId', authMiddleware, async (req, res) => {
  try {
    const { storeId } = req.params;

    const storeCheck = await pool.query(
      'SELECT id FROM stores WHERE id = $1 AND user_id = $2',
      [storeId, req.user.userId]
    );

    if (storeCheck.rows.length === 0) {
      return res.status(403).json({ error: 'Unauthorized store access' });
    }

    const result = await pool.query(
      'SELECT * FROM products WHERE store_id = $1 ORDER BY created_at DESC',
      [storeId]
    );

    res.json({ products: result.rows });
  } catch (error) {
    console.error('Fetch products error:', error.message);
    res.status(500).json({ error: 'Failed to fetch products' });
  }
});

// ============================================
// BUYER & MARKETPLACE ROUTES
// ============================================

// Get All Products (Public)
app.get('/api/products', async (req, res) => {
  try {
    const { category, search, page = 1 } = req.query;
    const limit = 20;
    const offset = (page - 1) * limit;

    let query = 'SELECT p.*, s.store_name, s.store_rating FROM products p JOIN stores s ON p.store_id = s.id WHERE p.is_active = TRUE';
    const params = [];

    if (category) {
      query += ' AND p.category = $' + (params.length + 1);
      params.push(category);
    }

    if (search) {
      query += ' AND (p.title ILIKE $' + (params.length + 1) + ' OR p.description ILIKE $' + (params.length + 1) + ')';
      params.push(`%${search}%`);
    }

    query += ' ORDER BY p.created_at DESC LIMIT $' + (params.length + 1) + ' OFFSET $' + (params.length + 2);
    params.push(limit, offset);

    const result = await pool.query(query, params);
    const countResult = await pool.query('SELECT COUNT(*) FROM products WHERE is_active = TRUE');

    res.json({
      products: result.rows,
      total: parseInt(countResult.rows[0].count),
      page,
      limit
    });
  } catch (error) {
    console.error('Fetch products error:', error.message);
    res.status(500).json({ error: 'Failed to fetch products' });
  }
});

// ============================================
// ORDER & ESCROW ROUTES
// ============================================

// Create Order (Initiate Purchase)
app.post('/api/orders', authMiddleware, async (req, res) => {
  try {
    const { productId } = req.body;

    if (req.user.userType !== 'buyer') {
      return res.status(403).json({ error: 'Only buyers can create orders' });
    }

    // Get product details
    const productResult = await pool.query(
      'SELECT p.*, s.user_id as seller_id FROM products p JOIN stores s ON p.store_id = s.id WHERE p.id = $1 AND p.is_active = TRUE',
      [productId]
    );

    if (productResult.rows.length === 0) {
      return res.status(404).json({ error: 'Product not found' });
    }

    const product = productResult.rows[0];

    if (product.seller_id === req.user.userId) {
      return res.status(400).json({ error: 'Cannot purchase your own product' });
    }

    // Create order with escrow
    const result = await pool.query(
      'INSERT INTO orders (buyer_id, seller_id, product_id, amount, status) VALUES ($1, $2, $3, $4, $5) RETURNING *',
      [req.user.userId, product.seller_id, productId, product.price, 'pending']
    );

    const order = result.rows[0];

    res.status(201).json({
      message: 'Order created. Awaiting payment confirmation.',
      order,
      escrowInfo: {
        orderId: order.id,
        amount: order.amount,
        status: 'ESCROW_HELD',
        instructions: 'Amount is held in escrow until delivery is confirmed'
      }
    });
  } catch (error) {
    console.error('Order creation error:', error.message);
    res.status(500).json({ error: 'Failed to create order' });
  }
});

// Confirm Payment (Simulate payment processing)
app.post('/api/orders/:orderId/confirm-payment', authMiddleware, async (req, res) => {
  try {
    const { orderId } = req.params;

    // Get order
    const orderResult = await pool.query('SELECT * FROM orders WHERE id = $1', [orderId]);

    if (orderResult.rows.length === 0) {
      return res.status(404).json({ error: 'Order not found' });
    }

    const order = orderResult.rows[0];

    if (order.buyer_id !== req.user.userId) {
      return res.status(403).json({ error: 'Unauthorized' });
    }

    if (order.status !== 'pending') {
      return res.status(400).json({ error: 'Order already processed' });
    }

    // Update order status
    const updated = await pool.query(
      'UPDATE orders SET status = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2 RETURNING *',
      ['payment_confirmed', orderId]
    );

    res.json({
      message: 'Payment confirmed. Seller notified.',
      order: updated.rows[0]
    });
  } catch (error) {
    console.error('Payment confirmation error:', error.message);
    res.status(500).json({ error: 'Failed to confirm payment' });
  }
});

// Confirm Delivery (Buyer confirms receipt)
app.post('/api/orders/:orderId/confirm-delivery', authMiddleware, async (req, res) => {
  try {
    const { orderId } = req.params;

    const orderResult = await pool.query('SELECT * FROM orders WHERE id = $1', [orderId]);

    if (orderResult.rows.length === 0) {
      return res.status(404).json({ error: 'Order not found' });
    }

    const order = orderResult.rows[0];

    if (order.buyer_id !== req.user.userId) {
      return res.status(403).json({ error: 'Unauthorized' });
    }

    if (order.status !== 'payment_confirmed') {
      return res.status(400).json({ error: 'Invalid order status' });
    }

    // Update order and release escrow
    const updated = await pool.query(
      'UPDATE orders SET status = $1, buyer_confirmed_delivery = TRUE, confirmed_delivery_at = CURRENT_TIMESTAMP, escrow_released = TRUE, updated_at = CURRENT_TIMESTAMP WHERE id = $2 RETURNING *',
      ['completed', orderId]
    );

    res.json({
      message: 'Delivery confirmed. Payment released to seller.',
      order: updated.rows[0],
      escrowReleased: true
    });
  } catch (error) {
    console.error('Delivery confirmation error:', error.message);
    res.status(500).json({ error: 'Failed to confirm delivery' });
  }
});

// ============================================
// DISPUTE RESOLUTION
// ============================================

// Initiate Dispute
app.post('/api/disputes', authMiddleware, async (req, res) => {
  try {
    const { orderId, reason } = req.body;

    if (!orderId || !reason) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const orderResult = await pool.query('SELECT * FROM orders WHERE id = $1', [orderId]);

    if (orderResult.rows.length === 0) {
      return res.status(404).json({ error: 'Order not found' });
    }

    const order = orderResult.rows[0];

    if (order.buyer_id !== req.user.userId && order.seller_id !== req.user.userId) {
      return res.status(403).json({ error: 'Unauthorized' });
    }

    if (order.status === 'disputed' || order.status === 'refunded') {
      return res.status(400).json({ error: 'Dispute already exists for this order' });
    }

    // Create dispute
    const result = await pool.query(
      'INSERT INTO disputes (order_id, initiated_by, reason, status) VALUES ($1, $2, $3, $4) RETURNING *',
      [orderId, req.user.userId, reason, 'open']
    );

    // Update order status
    await pool.query('UPDATE orders SET status = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2', ['disputed', orderId]);

    res.status(201).json({
      message: 'Dispute created. Admin will review within 48 hours.',
      dispute: result.rows[0]
    });
  } catch (error) {
    console.error('Dispute creation error:', error.message);
    res.status(500).json({ error: 'Failed to create dispute' });
  }
});

// Admin: Resolve Dispute
app.post('/api/disputes/:disputeId/resolve', authMiddleware, async (req, res) => {
  try {
    // Check if user is admin (simplified - in production use roles table)
    if (req.user.userType !== 'admin') {
      return res.status(403).json({ error: 'Admin access required' });
    }

    const { disputeId } = req.params;
    const { resolution, releaseToSeller = false } = req.body;

    if (!resolution) {
      return res.status(400).json({ error: 'Resolution required' });
    }

    const disputeResult = await pool.query('SELECT * FROM disputes WHERE id = $1', [disputeId]);

    if (disputeResult.rows.length === 0) {
      return res.status(404).json({ error: 'Dispute not found' });
    }

    const dispute = disputeResult.rows[0];

    // Update dispute
    const updated = await pool.query(
      'UPDATE disputes SET status = $1, admin_resolution = $2, resolved_by = $3, updated_at = CURRENT_TIMESTAMP WHERE id = $4 RETURNING *',
      ['resolved', resolution, req.user.userId, disputeId]
    );

    // Update order status based on resolution
    const newStatus = releaseToSeller ? 'completed' : 'refunded';
    await pool.query(
      'UPDATE orders SET status = $1, escrow_released = $2, updated_at = CURRENT_TIMESTAMP WHERE id = $3',
      [newStatus, releaseToSeller, dispute.order_id]
    );

    res.json({
      message: 'Dispute resolved',
      dispute: updated.rows[0],
      orderStatus: newStatus
    });
  } catch (error) {
    console.error('Dispute resolution error:', error.message);
    res.status(500).json({ error: 'Failed to resolve dispute' });
  }
});

// ============================================
// REVIEW SYSTEM
// ============================================

// Post Review
app.post('/api/reviews', authMiddleware, async (req, res) => {
  try {
    const { orderId, rating, reviewText } = req.body;

    if (!orderId || !rating) {
      return res.status(400).json({ error: 'Order ID and rating required' });
    }

    if (rating < 1 || rating > 5) {
      return res.status(400).json({ error: 'Rating must be between 1 and 5' });
    }

    const orderResult = await pool.query('SELECT * FROM orders WHERE id = $1 AND buyer_id = $2 AND status = $3', 
      [orderId, req.user.userId, 'completed']);

    if (orderResult.rows.length === 0) {
      return res.status(404).json({ error: 'Completed order not found' });
    }

    const result = await pool.query(
      'INSERT INTO reviews (order_id, reviewer_id, rating, review_text) VALUES ($1, $2, $3, $4) RETURNING *',
      [orderId, req.user.userId, rating, reviewText || '']
    );

    res.status(201).json({
      message: 'Review posted successfully',
      review: result.rows[0]
    });
  } catch (error) {
    console.error('Review posting error:', error.message);
    res.status(500).json({ error: 'Failed to post review' });
  }
});

// ============================================
// ERROR HANDLING
// ============================================

app.use((err, req, res, next) => {
  console.error('Unhandled error:', err.message);
  
  // Don't leak error details to client in production
  const isDevelopment = process.env.NODE_ENV === 'development';
  
  res.status(500).json({
    error: 'Internal server error',
    ...(isDevelopment && { details: err.message })
  });
});

// ============================================
// SERVER START
// ============================================

const PORT = process.env.PORT || 5000;

const startServer = async () => {
  await initializeDatabase();
  
  app.listen(PORT, () => {
    console.log(`🚀 Ziggurat Backend running on http://localhost:${PORT}`);
  });
};

startServer();

module.exports = app;

const express = require('express');
const cors = require('cors');
const multer = require('multer');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const dotenv = require('dotenv');
const db = require('./db');
const { encrypt, decrypt } = require('./services/cryptoService');
const { extractProductFromImage } = require('./services/visionService');

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;
const JWT_SECRET = process.env.JWT_SECRET || 'inventory-tool-super-secret-key-12345';
const JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || 'inventory-tool-refresh-secret-54321';

// In-memory array to track valid refresh tokens (for simple token rotation)
let refreshTokens = [];

app.use(cors());
app.use(express.json());

// Set up Multer for memory storage of uploaded product photos
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 } // 5MB limit
});

// Middleware to authenticate JWT token
function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  
  if (!token) return res.status(401).json({ error: 'Access token missing' });

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) return res.status(403).json({ error: 'Invalid or expired token' });
    req.user = user;
    next();
  });
}

// Helper: Generate tokens
function generateAccessToken(user) {
  return jwt.sign(
    { userId: user.id, orgId: user.org_id, email: user.email, role: user.role },
    JWT_SECRET,
    { expiresIn: '30m' }
  );
}

function generateRefreshToken(user) {
  const token = jwt.sign(
    { userId: user.id, orgId: user.org_id, email: user.email, role: user.role },
    JWT_REFRESH_SECRET,
    { expiresIn: '7d' }
  );
  refreshTokens.push(token);
  return token;
}

// ----------------------------------------------------
// AUTHENTICATION ENDPOINTS
// ----------------------------------------------------

app.post('/api/auth/signup', async (req, res) => {
  const { orgName, email, password } = req.body;
  if (!orgName || !email || !password) {
    return res.status(400).json({ error: 'Organization name, email, and password are required' });
  }

  try {
    // Check if user already exists
    const existingUser = await db('users').where({ email }).first();
    if (existingUser) {
      return res.status(400).json({ error: 'User with this email already exists' });
    }

    const orgId = crypto.randomUUID();
    const userId = crypto.randomUUID();
    const locationId = crypto.randomUUID();
    const passwordHash = await bcrypt.hash(password, 10);

    await db.transaction(async tr => {
      // 1. Create Organization
      await tr('organizations').insert({
        id: orgId,
        name: orgName
      });

      // 2. Create User
      await tr('users').insert({
        id: userId,
        org_id: orgId,
        email,
        password_hash: passwordHash,
        role: 'admin'
      });

      // 3. Create Default Settings (Sandbox Mode ON initially)
      await tr('organization_settings').insert({
        org_id: orgId,
        vision_provider: 'gemini',
        vision_api_key_encrypted: null
      });

      // 4. Create Default Stock Location
      await tr('stock_locations').insert({
        id: locationId,
        org_id: orgId,
        name: 'Primary Warehouse',
        description: 'Default stock location created on setup.'
      });
    });

    res.status(201).json({ message: 'Signup successful! Organization and default location created.' });
  } catch (error) {
    console.error('Signup error:', error);
    res.status(500).json({ error: 'Failed to create organization. ' + error.message });
  }
});

app.post('/api/auth/login', async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password are required' });
  }

  try {
    const user = await db('users').where({ email }).first();
    if (!user) {
      return res.status(400).json({ error: 'Invalid email or password' });
    }

    const isMatch = await bcrypt.compare(password, user.password_hash);
    if (!isMatch) {
      return res.status(400).json({ error: 'Invalid email or password' });
    }

    const org = await db('organizations').where({ id: user.org_id }).first();
    const accessToken = generateAccessToken(user);
    const refreshToken = generateRefreshToken(user);

    res.json({
      accessToken,
      refreshToken,
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
        orgId: user.org_id,
        orgName: org.name
      }
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Login failed. ' + error.message });
  }
});

app.post('/api/auth/refresh', (req, res) => {
  const { token } = req.body;
  if (!token) return res.status(401).json({ error: 'Refresh token is required' });
  if (!refreshTokens.includes(token)) return res.status(403).json({ error: 'Invalid refresh token' });

  jwt.verify(token, JWT_REFRESH_SECRET, (err, user) => {
    if (err) return res.status(403).json({ error: 'Invalid or expired refresh token' });
    
    // Generate new access token
    const accessToken = jwt.sign(
      { userId: user.userId, orgId: user.orgId, email: user.email, role: user.role },
      JWT_SECRET,
      { expiresIn: '30m' }
    );
    res.json({ accessToken });
  });
});

app.post('/api/auth/logout', (req, res) => {
  const { token } = req.body;
  refreshTokens = refreshTokens.filter(t => t !== token);
  res.sendStatus(204);
});

// ----------------------------------------------------
// SETTINGS ENDPOINTS (BYOK Config)
// ----------------------------------------------------

app.get('/api/settings', authenticateToken, async (req, res) => {
  try {
    const settings = await db('organization_settings').where({ org_id: req.user.orgId }).first();
    if (!settings) {
      return res.status(404).json({ error: 'Settings not found' });
    }
    
    const hasKey = !!settings.vision_api_key_encrypted;
    
    res.json({
      visionProvider: settings.vision_provider,
      hasApiKey: hasKey,
      sandboxMode: !hasKey // sandbox is active if no key is saved
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to retrieve settings: ' + error.message });
  }
});

app.put('/api/settings', authenticateToken, async (req, res) => {
  const { visionProvider, apiKey, clearKey } = req.body;
  
  try {
    const updateData = {
      updated_at: db.fn.now()
    };
    
    if (visionProvider) {
      updateData.vision_provider = visionProvider;
    }
    
    if (clearKey) {
      updateData.vision_api_key_encrypted = null;
    } else if (apiKey) {
      updateData.vision_api_key_encrypted = encrypt(apiKey);
    }
    
    await db('organization_settings')
      .where({ org_id: req.user.orgId })
      .update(updateData);
      
    res.json({ message: 'Settings updated successfully' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to update settings: ' + error.message });
  }
});

// ----------------------------------------------------
// PRODUCT CATALOG ENDPOINTS
// ----------------------------------------------------

app.get('/api/products', authenticateToken, async (req, res) => {
  const { search, category, lowStock } = req.query;
  
  try {
    let query = db('products')
      .leftJoin('stock_levels', 'products.id', 'stock_levels.product_id')
      .select(
        'products.*',
        db.raw('COALESCE(SUM(stock_levels.quantity), 0) as total_quantity')
      )
      .where('products.org_id', req.user.orgId)
      .groupBy('products.id');

    if (search) {
      query = query.andWhere(function() {
        this.where('products.name', 'like', `%${search}%`)
            .orWhere('products.sku', 'like', `%${search}%`)
            .orWhere('products.barcode', 'like', `%${search}%`);
      });
    }

    if (category) {
      query = query.andWhere('products.category', category);
    }

    let products = await query;
    
    // SQLite can return string for aggregate SUM or COALESCE, let's format it to number
    products = products.map(p => ({
      ...p,
      total_quantity: Number(p.total_quantity)
    }));

    if (lowStock === 'true') {
      products = products.filter(p => p.total_quantity <= p.low_stock_threshold);
    }

    res.json(products);
  } catch (error) {
    res.status(500).json({ error: 'Failed to retrieve products: ' + error.message });
  }
});

app.post('/api/products', authenticateToken, async (req, res) => {
  const { name, sku, barcode, category, price, cost, description, primaryImageUrl, lowStockThreshold, initialStock } = req.body;
  
  if (!name || !sku) {
    return res.status(400).json({ error: 'Product name and SKU are required' });
  }

  try {
    const existingSku = await db('products').where({ org_id: req.user.orgId, sku }).first();
    if (existingSku) {
      return res.status(400).json({ error: 'Product SKU already exists' });
    }

    if (barcode) {
      const existingBarcode = await db('products').where({ org_id: req.user.orgId, barcode }).first();
      if (existingBarcode) {
        return res.status(400).json({ error: 'Product Barcode already exists' });
      }
    }

    const productId = crypto.randomUUID();
    const movementId = crypto.randomUUID();
    const levelId = crypto.randomUUID();

    // Get default location
    const defaultLoc = await db('stock_locations').where({ org_id: req.user.orgId }).first();
    if (!defaultLoc) {
      return res.status(500).json({ error: 'Default stock location missing' });
    }

    await db.transaction(async tr => {
      // 1. Insert product
      await tr('products').insert({
        id: productId,
        org_id: req.user.orgId,
        name,
        sku,
        barcode: barcode || null,
        category: category || 'Uncategorized',
        price: price || 0.00,
        cost: cost || 0.00,
        description: description || '',
        primary_image_url: primaryImageUrl || null,
        low_stock_threshold: lowStockThreshold || 5
      });

      // 2. Insert stock level
      await tr('stock_levels').insert({
        id: levelId,
        product_id: productId,
        location_id: defaultLoc.id,
        quantity: initialStock || 0
      });

      // 3. Log movement if initial stock is > 0
      if (initialStock && initialStock > 0) {
        await tr('stock_movements').insert({
          id: movementId,
          product_id: productId,
          location_id: defaultLoc.id,
          user_id: req.user.userId,
          quantity_delta: initialStock,
          reason: 'received',
          reference_note: 'Initial stock intake'
        });
      }
    });

    const newProduct = await db('products').where({ id: productId }).first();
    res.status(201).json({ ...newProduct, total_quantity: initialStock || 0 });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to create product: ' + error.message });
  }
});

app.get('/api/products/:id', authenticateToken, async (req, res) => {
  try {
    const product = await db('products').where({ id: req.params.id, org_id: req.user.orgId }).first();
    if (!product) {
      return res.status(404).json({ error: 'Product not found' });
    }

    const levels = await db('stock_levels')
      .join('stock_locations', 'stock_levels.location_id', 'stock_locations.id')
      .select('stock_locations.name as location_name', 'stock_levels.location_id', 'stock_levels.quantity')
      .where({ 'stock_levels.product_id': product.id });

    const movements = await db('stock_movements')
      .leftJoin('users', 'stock_movements.user_id', 'users.id')
      .join('stock_locations', 'stock_movements.location_id', 'stock_locations.id')
      .select('stock_movements.*', 'users.email as user_email', 'stock_locations.name as location_name')
      .where({ 'stock_movements.product_id': product.id })
      .orderBy('stock_movements.created_at', 'desc')
      .limit(30);

    const totalQuantity = levels.reduce((sum, l) => sum + l.quantity, 0);

    res.json({
      ...product,
      total_quantity: totalQuantity,
      locations: levels,
      movements
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch product details: ' + error.message });
  }
});

app.put('/api/products/:id', authenticateToken, async (req, res) => {
  const { name, sku, barcode, category, price, cost, description, primaryImageUrl, lowStockThreshold } = req.body;
  
  try {
    const product = await db('products').where({ id: req.params.id, org_id: req.user.orgId }).first();
    if (!product) {
      return res.status(404).json({ error: 'Product not found' });
    }

    // Verify sku collision
    if (sku && sku !== product.sku) {
      const existingSku = await db('products').where({ org_id: req.user.orgId, sku }).first();
      if (existingSku) return res.status(400).json({ error: 'SKU code is already in use by another product' });
    }

    // Verify barcode collision
    if (barcode && barcode !== product.barcode) {
      const existingBarcode = await db('products').where({ org_id: req.user.orgId, barcode }).first();
      if (existingBarcode) return res.status(400).json({ error: 'Barcode is already in use by another product' });
    }

    await db('products')
      .where({ id: req.params.id })
      .update({
        name: name || product.name,
        sku: sku || product.sku,
        barcode: barcode === undefined ? product.barcode : (barcode || null),
        category: category || product.category,
        price: price !== undefined ? price : product.price,
        cost: cost !== undefined ? cost : product.cost,
        description: description !== undefined ? description : product.description,
        primary_image_url: primaryImageUrl !== undefined ? primaryImageUrl : product.primary_image_url,
        low_stock_threshold: lowStockThreshold !== undefined ? lowStockThreshold : product.low_stock_threshold,
        updated_at: db.fn.now()
      });

    const updatedProduct = await db('products').where({ id: req.params.id }).first();
    res.json(updatedProduct);
  } catch (error) {
    res.status(500).json({ error: 'Failed to update product: ' + error.message });
  }
});

app.delete('/api/products/:id', authenticateToken, async (req, res) => {
  try {
    const affected = await db('products').where({ id: req.params.id, org_id: req.user.orgId }).del();
    if (!affected) return res.status(404).json({ error: 'Product not found' });
    res.json({ message: 'Product deleted successfully' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete product: ' + error.message });
  }
});

// Barcode Lookup: Query internal DB. If missing, look up public database (Open Food Facts API)
app.get('/api/products/lookup/:barcode', authenticateToken, async (req, res) => {
  const { barcode } = req.params;
  
  try {
    // 1. Check local database
    const localProduct = await db('products')
      .leftJoin('stock_levels', 'products.id', 'stock_levels.product_id')
      .select('products.*', db.raw('COALESCE(SUM(stock_levels.quantity), 0) as total_quantity'))
      .where({ 'products.org_id': req.user.orgId, 'products.barcode': barcode })
      .groupBy('products.id')
      .first();

    if (localProduct) {
      return res.json({ found: true, source: 'local', product: { ...localProduct, total_quantity: Number(localProduct.total_quantity) } });
    }

    // 2. Query Open Food Facts API (Completely free, no auth key required)
    // URL: https://world.openfoodfacts.org/api/v0/product/[barcode].json
    const externalUrl = `https://world.openfoodfacts.org/api/v0/product/${barcode}.json`;
    const response = await fetch(externalUrl);
    
    if (response.ok) {
      const data = await response.json();
      if (data.status === 1 && data.product) {
        const p = data.product;
        return res.json({
          found: false,
          source: 'open_food_facts',
          product: {
            name: p.product_name || '',
            brand: p.brands || '',
            category: p.categories ? p.categories.split(',')[0].trim() : 'Food & Beverage',
            description: p.generic_name || p.product_name || '',
            primaryImageUrl: p.image_url || null,
            barcode: barcode,
            suggestedSku: `OFF-${barcode.slice(-6)}`
          }
        });
      }
    }

    res.json({ found: false, source: null, product: null });
  } catch (error) {
    console.error('Barcode lookup error:', error);
    res.status(500).json({ error: 'Failed to look up barcode: ' + error.message });
  }
});

// ----------------------------------------------------
// PHOTO-TO-PRODUCT VISION API ENDPOINT
// ----------------------------------------------------

app.post('/api/products/from-photo', authenticateToken, upload.single('photo'), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No photo provided' });
  }

  try {
    const settings = await db('organization_settings').where({ org_id: req.user.orgId }).first();
    if (!settings) {
      return res.status(404).json({ error: 'Organization settings not found' });
    }

    let apiKey = null;
    let useSandbox = true;

    if (settings.vision_api_key_encrypted) {
      apiKey = decrypt(settings.vision_api_key_encrypted);
      useSandbox = false;
    }

    const extracted = await extractProductFromImage({
      imageBuffer: req.file.buffer,
      mimeType: req.file.mimetype,
      provider: settings.vision_provider || 'gemini',
      apiKey,
      useSandbox
    });

    res.json({
      success: true,
      sandbox: useSandbox,
      product: extracted
    });
  } catch (error) {
    console.error('Vision extraction error:', error);
    res.status(500).json({ error: 'Failed to analyze photo: ' + error.message });
  }
});

// ----------------------------------------------------
// STOCK MANAGEMENT ENDPOINTS
// ----------------------------------------------------

app.post('/api/stock/movements', authenticateToken, async (req, res) => {
  const { productId, locationId, quantityDelta, reason, referenceNote } = req.body;
  
  if (!productId || quantityDelta === undefined || !reason) {
    return res.status(400).json({ error: 'productId, quantityDelta, and reason are required' });
  }

  try {
    // Verify product ownership
    const product = await db('products').where({ id: productId, org_id: req.user.orgId }).first();
    if (!product) return res.status(404).json({ error: 'Product not found' });

    // Fallback to primary location if locationId omitted
    let targetLocationId = locationId;
    if (!targetLocationId) {
      const defaultLoc = await db('stock_locations').where({ org_id: req.user.orgId }).first();
      targetLocationId = defaultLoc.id;
    } else {
      const loc = await db('stock_locations').where({ id: targetLocationId, org_id: req.user.orgId }).first();
      if (!loc) return res.status(404).json({ error: 'Stock location not found' });
    }

    const movementId = crypto.randomUUID();

    await db.transaction(async tr => {
      // 1. Check if stock level row exists
      const level = await tr('stock_levels')
        .where({ product_id: productId, location_id: targetLocationId })
        .first();

      if (level) {
        // Update existing row
        const newQty = level.quantity + Number(quantityDelta);
        if (newQty < 0 && (reason === 'sold' || reason === 'adjustment')) {
          // Allow negative stock but warn or check? Let's cap at 0 or allow. Inventory apps usually allow negative stock or block.
          // Let's cap at 0 if you don't want negative, or just allow it. Let's allow but cap at 0 to avoid messy counts.
          // Actually, standard practice is to allow negative stock (sometimes) or prevent it. Let's block it to ensure safety.
          // return res.status(400).json({ error: `Insufficient stock. Current: ${level.quantity}, Delta: ${quantityDelta}` });
        }
        
        await tr('stock_levels')
          .where({ id: level.id })
          .update({
            quantity: newQty,
            updated_at: tr.fn.now()
          });
      } else {
        // Create new row
        if (Number(quantityDelta) < 0) {
          return res.status(400).json({ error: `Cannot initialize stock with negative quantity: ${quantityDelta}` });
        }
        await tr('stock_levels').insert({
          id: crypto.randomUUID(),
          product_id: productId,
          location_id: targetLocationId,
          quantity: quantityDelta
        });
      }

      // 2. Insert ledger movement log
      await tr('stock_movements').insert({
        id: movementId,
        product_id: productId,
        location_id: targetLocationId,
        user_id: req.user.userId,
        quantity_delta: quantityDelta,
        reason: reason,
        reference_note: referenceNote || null
      });
    });

    const updatedLevels = await db('stock_levels')
      .join('stock_locations', 'stock_levels.location_id', 'stock_locations.id')
      .select('stock_locations.name as location_name', 'stock_levels.location_id', 'stock_levels.quantity')
      .where({ 'stock_levels.product_id': productId });

    const totalQuantity = updatedLevels.reduce((sum, l) => sum + l.quantity, 0);

    res.json({
      productId,
      total_quantity: totalQuantity,
      locations: updatedLevels
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to record stock movement: ' + error.message });
  }
});

app.get('/api/stock/levels', authenticateToken, async (req, res) => {
  try {
    const levels = await db('stock_levels')
      .join('products', 'stock_levels.product_id', 'products.id')
      .join('stock_locations', 'stock_levels.location_id', 'stock_locations.id')
      .select(
        'products.name as product_name',
        'products.sku as product_sku',
        'stock_locations.name as location_name',
        'stock_levels.*'
      )
      .where('products.org_id', req.user.orgId);
    
    res.json(levels);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch stock levels: ' + error.message });
  }
});

// ----------------------------------------------------
// DASHBOARD ENDPOINT
// ----------------------------------------------------

app.get('/api/dashboard/summary', authenticateToken, async (req, res) => {
  try {
    // 1. SKU Count
    const products = await db('products').where({ org_id: req.user.orgId });
    const skuCount = products.length;

    // 2. Sum of stock levels and Valuation
    const levels = await db('stock_levels')
      .join('products', 'stock_levels.product_id', 'products.id')
      .select('stock_levels.quantity', 'products.cost', 'products.price', 'products.id', 'products.low_stock_threshold')
      .where('products.org_id', req.user.orgId);

    // Sum levels per product for low stock assessment
    const productQuantities = {};
    let totalStockCount = 0;
    let totalValuation = 0.0;

    levels.forEach(lvl => {
      totalStockCount += lvl.quantity;
      totalValuation += lvl.quantity * Number(lvl.cost || 0);
      productQuantities[lvl.product_id] = (productQuantities[lvl.product_id] || 0) + lvl.quantity;
    });

    let lowStockCount = 0;
    products.forEach(p => {
      const qty = productQuantities[p.id] || 0;
      if (qty <= p.low_stock_threshold) {
        lowStockCount++;
      }
    });

    // 3. Recent stock movements
    const recentMovements = await db('stock_movements')
      .join('products', 'stock_movements.product_id', 'products.id')
      .join('stock_locations', 'stock_movements.location_id', 'stock_locations.id')
      .leftJoin('users', 'stock_movements.user_id', 'users.id')
      .select(
        'stock_movements.*',
        'products.name as product_name',
        'products.sku as product_sku',
        'stock_locations.name as location_name',
        'users.email as user_email'
      )
      .where('products.org_id', req.user.orgId)
      .orderBy('stock_movements.created_at', 'desc')
      .limit(10);

    res.json({
      skuCount,
      totalStockCount,
      totalValuation: parseFloat(totalValuation.toFixed(2)),
      lowStockCount,
      recentMovements
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to fetch dashboard summary: ' + error.message });
  }
});

// Start express server
if (process.env.NODE_ENV !== 'production' || !process.env.VERCEL) {
  app.listen(PORT, () => {
    console.log(`Inventory Backend Server running on port ${PORT}`);
  });
}

module.exports = app;

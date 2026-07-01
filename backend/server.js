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
const { syncShopifyProducts } = require('./services/shopifyService');

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;
const JWT_SECRET = process.env.JWT_SECRET || 'inventory-tool-super-secret-key-12345';
const JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || 'inventory-tool-refresh-secret-54321';

let refreshTokens = [];

app.use(cors());
app.use(express.json());

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 }
});

async function authenticateToken(req, res, next) {
  try {
    let defaultOrg = await db('organizations').first();
    if (!defaultOrg) {
      const orgId = 'default-org-uuid';
      const userId = 'default-user-uuid';
      const locationId = 'default-loc-uuid';
      
      await db.transaction(async tr => {
        await tr('organizations').insert({ id: orgId, name: 'My Inventory' });
        await tr('users').insert({ id: userId, org_id: orgId, email: 'admin@vividinventory.local', password_hash: '', role: 'admin' });
        await tr('organization_settings').insert({ org_id: orgId, vision_provider: 'gemini', vision_api_key_encrypted: null });
        await tr('stock_locations').insert({ id: locationId, org_id: orgId, name: 'Primary Warehouse', description: 'Default warehouse' });
      });
      defaultOrg = { id: orgId, name: 'My Inventory' };
    }

    const defaultUser = await db('users').where({ org_id: defaultOrg.id }).first();
    
    req.user = {
      userId: defaultUser.id,
      orgId: defaultOrg.id,
      email: defaultUser.email,
      role: defaultUser.role
    };
    next();
  } catch (err) {
    console.error("Auto-login setup failed:", err);
    res.status(500).json({ error: 'Failed to initialize default database session: ' + err.message });
  }
}

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
    const existingUser = await db('users').where({ email }).first();
    if (existingUser) {
      return res.status(400).json({ error: 'User with this email already exists' });
    }

    const orgId = crypto.randomUUID();
    const userId = crypto.randomUUID();
    const locationId = crypto.randomUUID();
    const passwordHash = await bcrypt.hash(password, 10);

    await db.transaction(async tr => {
      await tr('organizations').insert({ id: orgId, name: orgName });
      await tr('users').insert({
        id: userId,
        org_id: orgId,
        email,
        password_hash: passwordHash,
        role: 'admin'
      });
      await tr('organization_settings').insert({
        org_id: orgId,
        vision_provider: 'gemini',
        vision_api_key_encrypted: null,
        shopify_shop_url: null,
        shopify_access_token_encrypted: null
      });
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
    res.status(500).json({ error: 'Login failed. ' + error.message });
  }
});

app.post('/api/auth/refresh', (req, res) => {
  const { token } = req.body;
  if (!token) return res.status(401).json({ error: 'Refresh token is required' });
  if (!refreshTokens.includes(token)) return res.status(403).json({ error: 'Invalid refresh token' });

  jwt.verify(token, JWT_REFRESH_SECRET, (err, user) => {
    if (err) return res.status(403).json({ error: 'Invalid or expired refresh token' });
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
// SETTINGS ENDPOINTS (BYOK & SHOPIFY CONFIG)
// ----------------------------------------------------

app.get('/api/settings', authenticateToken, async (req, res) => {
  try {
    const settings = await db('organization_settings').where({ org_id: req.user.orgId }).first();
    if (!settings) {
      return res.status(404).json({ error: 'Settings not found' });
    }
    
    res.json({
      visionProvider: settings.vision_provider,
      hasApiKey: !!settings.vision_api_key_encrypted,
      sandboxMode: !settings.vision_api_key_encrypted,
      shopifyShopUrl: settings.shopify_shop_url || '',
      hasShopifyToken: !!settings.shopify_access_token_encrypted
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to retrieve settings: ' + error.message });
  }
});

app.put('/api/settings', authenticateToken, async (req, res) => {
  const { visionProvider, apiKey, clearKey, shopifyShopUrl, shopifyAccessToken, clearShopify } = req.body;
  
  try {
    const updateData = { updated_at: db.fn.now() };
    
    if (visionProvider) updateData.vision_provider = visionProvider;
    
    if (clearKey) {
      updateData.vision_api_key_encrypted = null;
    } else if (apiKey) {
      updateData.vision_api_key_encrypted = encrypt(apiKey);
    }

    if (shopifyShopUrl !== undefined) {
      updateData.shopify_shop_url = shopifyShopUrl;
    }

    if (clearShopify) {
      updateData.shopify_access_token_encrypted = null;
      updateData.shopify_shop_url = null;
    } else if (shopifyAccessToken) {
      updateData.shopify_access_token_encrypted = encrypt(shopifyAccessToken);
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
// SHOPIFY INTEGRATION SYNC ENDPOINT
// ----------------------------------------------------

app.post('/api/integrations/shopify/sync', authenticateToken, async (req, res) => {
  try {
    const settings = await db('organization_settings').where({ org_id: req.user.orgId }).first();
    if (!settings) return res.status(404).json({ error: 'Settings not found' });

    let shopifyToken = null;
    let useSandbox = true;

    if (settings.shopify_access_token_encrypted) {
      shopifyToken = decrypt(settings.shopify_access_token_encrypted);
      useSandbox = false;
    }

    const result = await syncShopifyProducts({
      orgId: req.user.orgId,
      userId: req.user.userId,
      shopUrl: settings.shopify_shop_url,
      accessToken: shopifyToken,
      useSandbox
    });

    res.json({
      success: true,
      sandbox: useSandbox,
      ...result
    });
  } catch (error) {
    console.error('Shopify sync error:', error);
    res.status(500).json({ error: 'Failed to synchronize with Shopify: ' + error.message });
  }
});

// ----------------------------------------------------
// PRODUCT CATALOG ENDPOINTS (VARIANT-AWARE)
// ----------------------------------------------------

app.get('/api/products', authenticateToken, async (req, res) => {
  const { search, category, lowStock } = req.query;
  
  try {
    let query = db('products').where({ org_id: req.user.orgId });

    if (category) {
      query = query.andWhere({ category });
    }

    if (search) {
      query = query.andWhere(function() {
        this.where('name', 'like', `%${search}%`)
            .orWhere('description', 'like', `%${search}%`);
      });
    }

    const products = await query;
    const result = [];

    for (const p of products) {
      // Find variants of this product and aggregate their quantities
      let varQuery = db('product_variants')
        .leftJoin('stock_levels', 'product_variants.id', 'stock_levels.variant_id')
        .select(
          'product_variants.*',
          db.raw('COALESCE(SUM(stock_levels.quantity), 0) as total_quantity')
        )
        .where({ 'product_variants.product_id': p.id })
        .groupBy('product_variants.id');

      let variants = await varQuery;
      variants = variants.map(v => ({
        ...v,
        price: Number(v.price),
        cost: Number(v.cost),
        total_quantity: Number(v.total_quantity)
      }));

      // If searching, check if search queries matched SKU or Barcode in variants
      let matchedVariants = variants;
      if (search) {
        matchedVariants = variants.filter(v => 
          v.sku.toLowerCase().includes(search.toLowerCase()) || 
          (v.barcode && v.barcode.toLowerCase().includes(search.toLowerCase()))
        );
      }

      // If search query didn't match product details OR variant details, skip product
      if (search && matchedVariants.length === 0 && !p.name.toLowerCase().includes(search.toLowerCase())) {
        continue;
      }

      const totalQuantity = variants.reduce((sum, v) => sum + v.total_quantity, 0);
      const isLow = variants.some(v => v.total_quantity <= v.low_stock_threshold);

      result.push({
        ...p,
        variants: variants,
        total_quantity: totalQuantity,
        is_low_stock: isLow
      });
    }

    let finalResponse = result;
    if (lowStock === 'true') {
      finalResponse = result.filter(p => p.is_low_stock);
    }

    res.json(finalResponse);
  } catch (error) {
    res.status(500).json({ error: 'Failed to retrieve products: ' + error.message });
  }
});

app.post('/api/products', authenticateToken, async (req, res) => {
  const { name, category, description, primaryImageUrl, variants } = req.body;
  
  if (!name || !variants || variants.length === 0) {
    return res.status(400).json({ error: 'Product name and at least one variant are required' });
  }

  try {
    // Check SKU collisions in variants
    for (const v of variants) {
      const existingVar = await db('product_variants')
        .join('products', 'product_variants.product_id', 'products.id')
        .where({ 'products.org_id': req.user.orgId, 'product_variants.sku': v.sku })
        .first();
      if (existingVar) {
        return res.status(400).json({ error: `SKU code "${v.sku}" is already in use by another product` });
      }

      if (v.barcode) {
        const existingBarcode = await db('product_variants')
          .join('products', 'product_variants.product_id', 'products.id')
          .where({ 'products.org_id': req.user.orgId, 'product_variants.barcode': v.barcode })
          .first();
        if (existingBarcode) {
          return res.status(400).json({ error: `Barcode "${v.barcode}" is already in use by another product` });
        }
      }
    }

    const productId = crypto.randomUUID();
    const defaultLoc = await db('stock_locations').where({ org_id: req.user.orgId }).first();

    if (!defaultLoc) {
      return res.status(500).json({ error: 'Default stock location missing' });
    }

    await db.transaction(async tr => {
      // 1. Insert parent product
      await tr('products').insert({
        id: productId,
        org_id: req.user.orgId,
        name,
        category: category || 'General',
        description: description || '',
        primary_image_url: primaryImageUrl || null
      });

      // 2. Insert variants and stock values
      for (const v of variants) {
        const variantId = crypto.randomUUID();
        await tr('product_variants').insert({
          id: variantId,
          product_id: productId,
          name: v.name || 'Default',
          sku: v.sku,
          barcode: v.barcode || null,
          price: v.price || 0.00,
          cost: v.cost || 0.00,
          low_stock_threshold: v.lowStockThreshold || 5
        });

        const initialStock = parseInt(v.initialStock) || 0;
        await tr('stock_levels').insert({
          id: crypto.randomUUID(),
          variant_id: variantId,
          location_id: defaultLoc.id,
          quantity: initialStock
        });

        if (initialStock > 0) {
          await tr('stock_movements').insert({
            id: crypto.randomUUID(),
            variant_id: variantId,
            location_id: defaultLoc.id,
            user_id: req.user.userId,
            quantity_delta: initialStock,
            reason: 'received',
            reference_note: 'Initial product creation intake'
          });
        }
      }
    });

    res.status(201).json({ message: 'Product and variants created successfully', productId });
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

    const variants = await db('product_variants')
      .leftJoin('stock_levels', 'product_variants.id', 'stock_levels.variant_id')
      .select(
        'product_variants.*',
        db.raw('COALESCE(SUM(stock_levels.quantity), 0) as total_quantity')
      )
      .where({ 'product_variants.product_id': product.id })
      .groupBy('product_variants.id');

    // Fetch movements for all variants of this product
    const variantIds = variants.map(v => v.id);
    const movements = await db('stock_movements')
      .join('product_variants', 'stock_movements.variant_id', 'product_variants.id')
      .leftJoin('users', 'stock_movements.user_id', 'users.id')
      .join('stock_locations', 'stock_movements.location_id', 'stock_locations.id')
      .select(
        'stock_movements.*',
        'product_variants.name as variant_name',
        'product_variants.sku as variant_sku',
        'users.email as user_email',
        'stock_locations.name as location_name'
      )
      .whereIn('stock_movements.variant_id', variantIds)
      .orderBy('stock_movements.created_at', 'desc')
      .limit(30);

    res.json({
      ...product,
      variants: variants.map(v => ({
        ...v,
        price: Number(v.price),
        cost: Number(v.cost),
        total_quantity: Number(v.total_quantity)
      })),
      movements
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch product details: ' + error.message });
  }
});

app.delete('/api/products/:id', authenticateToken, async (req, res) => {
  try {
    const affected = await db('products').where({ id: req.params.id, org_id: req.user.orgId }).del();
    if (!affected) return res.status(404).json({ error: 'Product not found' });
    res.json({ message: 'Product and all associated variants deleted successfully' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete product: ' + error.message });
  }
});

// Barcode Lookup: Query variant tables. If missing, look up public database (Open Food Facts API)
app.get('/api/products/lookup/:barcode', authenticateToken, async (req, res) => {
  const { barcode } = req.params;
  
  try {
    // 1. Check local database for matched barcode
    const localVariant = await db('product_variants')
      .join('products', 'product_variants.product_id', 'products.id')
      .leftJoin('stock_levels', 'product_variants.id', 'stock_levels.variant_id')
      .select(
        'products.name as product_name',
        'products.id as product_id',
        'product_variants.*',
        db.raw('COALESCE(SUM(stock_levels.quantity), 0) as total_quantity')
      )
      .where({ 'products.org_id': req.user.orgId, 'product_variants.barcode': barcode })
      .groupBy('product_variants.id')
      .first();

    if (localVariant) {
      return res.json({
        found: true,
        source: 'local',
        product: {
          id: localVariant.product_id,
          name: localVariant.product_name,
          variantId: localVariant.id,
          variantName: localVariant.name,
          sku: localVariant.sku,
          price: Number(localVariant.price),
          total_quantity: Number(localVariant.total_quantity)
        }
      });
    }

    // 2. Query Open Food Facts API
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
    if (!settings) return res.status(404).json({ error: 'Organization settings not found' });

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
// STOCK MANAGEMENT ENDPOINTS (VARIANT-BASED)
// ----------------------------------------------------

app.post('/api/stock/movements', authenticateToken, async (req, res) => {
  const { variantId, locationId, quantityDelta, reason, referenceNote } = req.body;
  
  if (!variantId || quantityDelta === undefined || !reason) {
    return res.status(400).json({ error: 'variantId, quantityDelta, and reason are required' });
  }

  try {
    // Verify variant and product ownership
    const variant = await db('product_variants')
      .join('products', 'product_variants.product_id', 'products.id')
      .select('product_variants.id', 'products.org_id')
      .where({ 'product_variants.id': variantId, 'products.org_id': req.user.orgId })
      .first();

    if (!variant) return res.status(404).json({ error: 'Product variant not found' });

    let targetLocationId = locationId;
    if (!targetLocationId) {
      const defaultLoc = await db('stock_locations').where({ org_id: req.user.orgId }).first();
      targetLocationId = defaultLoc.id;
    } else {
      const loc = await db('stock_locations').where({ id: targetLocationId, org_id: req.user.orgId }).first();
      if (!loc) return res.status(404).json({ error: 'Stock location not found' });
    }

    await db.transaction(async tr => {
      const level = await tr('stock_levels')
        .where({ variant_id: variantId, location_id: targetLocationId })
        .first();

      if (level) {
        const newQty = level.quantity + Number(quantityDelta);
        await tr('stock_levels')
          .where({ id: level.id })
          .update({
            quantity: newQty,
            updated_at: tr.fn.now()
          });
      } else {
        if (Number(quantityDelta) < 0) {
          throw new Error(`Cannot initialize stock with negative quantity: ${quantityDelta}`);
        }
        await tr('stock_levels').insert({
          id: crypto.randomUUID(),
          variant_id: variantId,
          location_id: targetLocationId,
          quantity: quantityDelta
        });
      }

      await tr('stock_movements').insert({
        id: crypto.randomUUID(),
        variant_id: variantId,
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
      .where({ 'stock_levels.variant_id': variantId });

    const totalQuantity = updatedLevels.reduce((sum, l) => sum + l.quantity, 0);

    res.json({
      variantId,
      total_quantity: totalQuantity,
      locations: updatedLevels
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to record stock movement: ' + error.message });
  }
});

// ----------------------------------------------------
// DASHBOARD ENDPOINT
// ----------------------------------------------------

app.get('/api/dashboard/summary', authenticateToken, async (req, res) => {
  try {
    const products = await db('products').where({ org_id: req.user.orgId });
    const skuCount = products.length; // total parent products

    const levels = await db('stock_levels')
      .join('product_variants', 'stock_levels.variant_id', 'product_variants.id')
      .join('products', 'product_variants.product_id', 'products.id')
      .select(
        'stock_levels.quantity',
        'product_variants.cost',
        'product_variants.id',
        'product_variants.low_stock_threshold'
      )
      .where('products.org_id', req.user.orgId);

    let totalStockCount = 0;
    let totalValuation = 0.0;
    const variantQuantities = {};

    levels.forEach(lvl => {
      totalStockCount += lvl.quantity;
      totalValuation += lvl.quantity * Number(lvl.cost || 0);
      variantQuantities[lvl.id] = (variantQuantities[lvl.id] || 0) + lvl.quantity;
    });

    // Low stock items: check if any variant is under threshold
    const variants = await db('product_variants')
      .join('products', 'product_variants.product_id', 'products.id')
      .select('product_variants.id', 'product_variants.low_stock_threshold')
      .where('products.org_id', req.user.orgId);

    let lowStockCount = 0;
    let outOfStockCount = 0;
    variants.forEach(v => {
      const qty = variantQuantities[v.id] || 0;
      if (qty === 0) {
        outOfStockCount++;
      } else if (qty <= v.low_stock_threshold) {
        lowStockCount++;
      }
    });

    const recentMovements = await db('stock_movements')
      .join('product_variants', 'stock_movements.variant_id', 'product_variants.id')
      .join('products', 'product_variants.product_id', 'products.id')
      .join('stock_locations', 'stock_movements.location_id', 'stock_locations.id')
      .leftJoin('users', 'stock_movements.user_id', 'users.id')
      .select(
        'stock_movements.*',
        'products.name as product_name',
        'product_variants.name as variant_name',
        'product_variants.sku as product_sku',
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
      outOfStockCount,
      recentMovements
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to fetch dashboard summary: ' + error.message });
  }
});

// ----------------------------------------------------
// POS BATCH CHECKOUT ENDPOINT
// ----------------------------------------------------
app.post('/api/stock/checkout', authenticateToken, async (req, res) => {
  const { items } = req.body;
  if (!items || items.length === 0) {
    return res.status(400).json({ error: 'No items provided for checkout' });
  }
  
  const billId = crypto.randomBytes(4).toString('hex').toUpperCase();
  
  try {
    const defaultLoc = await db('stock_locations').where({ org_id: req.user.orgId }).first();
    if (!defaultLoc) return res.status(500).json({ error: 'Default stock location missing' });

    await db.transaction(async tr => {
      for (const item of items) {
        const variant = await tr('product_variants')
          .join('products', 'product_variants.product_id', 'products.id')
          .select('product_variants.id', 'products.org_id')
          .where({ 'product_variants.id': item.variantId, 'products.org_id': req.user.orgId })
          .first();
          
        if (!variant) throw new Error(`Product variant ${item.variantId} not found`);
        
        const level = await tr('stock_levels')
          .where({ variant_id: item.variantId, location_id: defaultLoc.id })
          .first();
          
        if (!level) throw new Error(`Stock level not initialized for variant ${item.variantId}`);
        
        const newQty = level.quantity - Number(item.quantity);
        
        await tr('stock_levels')
          .where({ id: level.id })
          .update({ quantity: newQty, updated_at: tr.fn.now() });
          
        await tr('stock_movements').insert({
          id: crypto.randomUUID(),
          variant_id: item.variantId,
          location_id: defaultLoc.id,
          user_id: req.user.userId,
          quantity_delta: -Number(item.quantity),
          reason: 'sold',
          reference_note: `POS Sale #${billId}`
        });
      }
    });
    
    res.json({ success: true, billId });
  } catch (error) {
    console.error("POS Checkout failed:", error);
    res.status(500).json({ error: 'Checkout transaction failed: ' + error.message });
  }
});

// ----------------------------------------------------
// RESET & SEED DEMO DATA ENDPOINT
// ----------------------------------------------------
app.post('/api/db/reset-demo', authenticateToken, async (req, res) => {
  try {
    // Run migrations to ensure all tables exist on the database
    await db.migrate.latest();

    const orgId = req.user.orgId;
    const userId = req.user.userId;
    
    let defaultLoc = await db('stock_locations').where({ org_id: orgId }).first();
    if (!defaultLoc) {
      const locationId = 'default-loc-uuid';
      await db('stock_locations').insert({
        id: locationId,
        org_id: orgId,
        name: 'Primary Warehouse',
        description: 'Default warehouse'
      });
      defaultLoc = { id: locationId };
    }
    
    await db.transaction(async tr => {
      // 1. Fetch variant ids for this organization to clear movements & levels
      const variants = await tr('product_variants')
        .join('products', 'product_variants.product_id', 'products.id')
        .select('product_variants.id')
        .where('products.org_id', orgId);
      
      const variantIds = variants.map(v => v.id);

      // Truncate tables for this organization
      await tr('system_audit_logs').where({ org_id: orgId }).del();
      await tr('purchase_order_items')
        .join('purchase_orders', 'purchase_order_items.purchase_order_id', 'purchase_orders.id')
        .where('purchase_orders.org_id', orgId)
        .del();
      await tr('purchase_orders').where({ org_id: orgId }).del();
      await tr('suppliers').where({ org_id: orgId }).del();

      if (variantIds.length > 0) {
        await tr('stock_movements').whereIn('variant_id', variantIds).del();
        await tr('stock_levels').whereIn('variant_id', variantIds).del();
        await tr('product_variants').whereIn('id', variantIds).del();
      }

      await tr('products').where({ org_id: orgId }).del();
         
      // Seed default suppliers
      const supplier1Id = crypto.randomUUID();
      const supplier2Id = crypto.randomUUID();
      await tr('suppliers').insert([
        { id: supplier1Id, org_id: orgId, name: "Elite Electronics Ltd", email: "sales@elite-electronics.in", phone: "+91 98765 43210", company: "Elite Electronics Ltd" },
        { id: supplier2Id, org_id: orgId, name: "PaperCorp India", email: "orders@papercorp.co.in", phone: "+91 99887 76655", company: "PaperCorp India" }
      ]);

      // Seed default products to match the screenshot + new multi-variant electronics!
      const demoProducts = [
        { 
          name: "A4 Paper Ream", 
          category: "Office Supplies", 
          description: "High-quality A4 printer paper ream.",
          variants: [{ name: "Default", sku: "OFF-001", barcode: "890103070001", cost: 180.00, price: 299.00, qty: 45 }]
        },
        { 
          name: "Wireless Mouse", 
          category: "Electronics", 
          description: "Ergonomic 2.4GHz wireless optical mouse.",
          variants: [{ name: "Default", sku: "ELC-002", barcode: "890103070002", cost: 350.00, price: 699.00, qty: 15 }]
        },
        { 
          name: "USB-C Cable 2m", 
          category: "Electronics", 
          description: "Braided fast charging USB-C to USB-C cable.",
          variants: [{ name: "Default", sku: "ELC-001", barcode: "890103070003", cost: 120.00, price: 249.00, qty: 30 }]
        },
        { 
          name: "Ballpoint Pens x12", 
          category: "Office Supplies", 
          description: "Pack of 12 smooth writing blue ink ballpoint pens.",
          variants: [{ name: "Default", sku: "OFF-002", barcode: "890103070004", cost: 60.00, price: 120.00, qty: 50 }]
        },
        { 
          name: "Bubble Wrap Roll", 
          category: "Packaging", 
          description: "Protective plastic bubble wrap cushioning roll.",
          variants: [{ name: "Default", sku: "PKG-001", barcode: "890103070005", cost: 250.00, price: 499.00, qty: 10 }]
        },
        { 
          name: "HDMI Cable 1.5m", 
          category: "Electronics", 
          description: "High-speed 4K HDMI male to male connection cable.",
          variants: [{ name: "Default", sku: "ELC-003", barcode: "890103070006", cost: 150.00, price: 349.00, qty: 25 }]
        },
        {
          name: "Mechanical Keyboard",
          category: "Electronics",
          description: "Tenkeyless RGB backlit mechanical gaming keyboard.",
          variants: [
            { name: "Blue Switches", sku: "ELC-004-BLU", barcode: "890103070007", cost: 1800.00, price: 3499.00, qty: 12 },
            { name: "Red Switches", sku: "ELC-004-RED", barcode: "890103070008", cost: 1800.00, price: 3499.00, qty: 8 }
          ]
        },
        {
          name: "Noise Cancelling Headphones",
          category: "Electronics",
          description: "Wireless over-ear active noise cancelling headphones.",
          variants: [
            { name: "Matte Black", sku: "ELC-005-BLK", barcode: "890103070009", cost: 4500.00, price: 8999.00, qty: 6 },
            { name: "Platinum Silver", sku: "ELC-005-SLV", barcode: "890103070010", cost: 4700.00, price: 9499.00, qty: 4 }
          ]
        },
        {
          name: "Dual-Port Wall Charger 65W",
          category: "Electronics",
          description: "GaN fast charger adapter with dual USB-C ports.",
          variants: [{ name: "Default", sku: "ELC-006", barcode: "890103070011", cost: 600.00, price: 1299.00, qty: 18 }]
        },
        {
          name: "FHD Web Camera 1080p",
          category: "Electronics",
          description: "1080p full high-definition USB web camera with microphone.",
          variants: [{ name: "Default", sku: "ELC-007", barcode: "890103070012", cost: 1100.00, price: 2199.00, qty: 14 }]
        }
      ];
      
      const billId = "SQMBCA6";
      const mappedVariants = [];
      
      for (const prod of demoProducts) {
        const pId = crypto.randomUUID();
        
        await tr('products').insert({
          id: pId,
          org_id: orgId,
          name: prod.name,
          category: prod.category,
          description: prod.description
        });
        
        for (const v of prod.variants) {
          const vId = crypto.randomUUID();
          
          await tr('product_variants').insert({
            id: vId,
            product_id: pId,
            name: v.name,
            sku: v.sku,
            barcode: v.barcode,
            price: v.price,
            cost: v.cost,
            low_stock_threshold: 5
          });

          mappedVariants.push({ vId, sku: v.sku, cost: v.cost });
          
          const checkoutQty = v.sku === 'PKG-001' || v.sku === 'ELC-003' || v.sku === 'ELC-002' ? 6 : 5;
          const initialQty = v.qty + checkoutQty;
          
          await tr('stock_levels').insert({
            id: crypto.randomUUID(),
            variant_id: vId,
            location_id: defaultLoc.id,
            quantity: v.qty
          });
          
          await tr('stock_movements').insert({
            id: crypto.randomUUID(),
            variant_id: vId,
            location_id: defaultLoc.id,
            user_id: userId,
            quantity_delta: initialQty,
            reason: 'received',
            reference_note: 'Initial Stock Intake'
          });
          
          await tr('stock_movements').insert({
            id: crypto.randomUUID(),
            variant_id: vId,
            location_id: defaultLoc.id,
            user_id: userId,
            quantity_delta: -checkoutQty,
            reason: 'sold',
            reference_note: `POS Sale #${billId}`,
            created_at: new Date('2026-07-01T12:00:00Z')
          });
        }
      }

      // Seed default POs
      const po1Id = crypto.randomUUID();
      const po2Id = crypto.randomUUID();
      await tr('purchase_orders').insert([
        { id: po1Id, org_id: orgId, supplier_id: supplier1Id, status: "PENDING", total_amount: 3500.00, created_at: new Date('2026-07-01T10:00:00Z') },
        { id: po2Id, org_id: orgId, supplier_id: supplier2Id, status: "RECEIVED", total_amount: 1800.00, created_at: new Date('2026-06-25T10:00:00Z') }
      ]);

      const mouseVar = mappedVariants.find(m => m.sku === 'ELC-002');
      const paperVar = mappedVariants.find(m => m.sku === 'OFF-001');

      if (mouseVar) {
        await tr('purchase_order_items').insert({
          id: crypto.randomUUID(),
          purchase_order_id: po1Id,
          variant_id: mouseVar.vId,
          quantity_ordered: 10,
          quantity_received: 0,
          cost_at_order: mouseVar.cost
        });
      }

      if (paperVar) {
        await tr('purchase_order_items').insert({
          id: crypto.randomUUID(),
          purchase_order_id: po2Id,
          variant_id: paperVar.vId,
          quantity_ordered: 10,
          quantity_received: 10,
          cost_at_order: paperVar.cost
        });
      }

      // Seed default system audit logs
      await tr('system_audit_logs').insert([
        { id: crypto.randomUUID(), org_id: orgId, user_id: userId, action_type: "LOGIN", description: "Default administrator session bypassed via auto-auth mode", created_at: new Date('2026-07-01T09:00:00Z') },
        { id: crypto.randomUUID(), org_id: orgId, user_id: userId, action_type: "SEED_DEMO", description: "Database seeded with default Stockwise HQ demo products and logs", created_at: new Date('2026-07-01T09:05:00Z') },
        { id: crypto.randomUUID(), org_id: orgId, user_id: userId, action_type: "UPDATE_SETTINGS", description: "Updated organization details to default configuration", created_at: new Date('2026-07-01T09:10:00Z') }
      ]);
    });
    
    res.json({ success: true });
  } catch (err) {
    console.error("Demo Seeding failed:", err);
    res.status(500).json({ error: 'Failed to reset and seed demo database: ' + err.message });
  }
});

// ----------------------------------------------------
// SUPPLIERS API
// ----------------------------------------------------
app.get('/api/suppliers', authenticateToken, async (req, res) => {
  try {
    const suppliers = await db('suppliers')
      .where({ org_id: req.user.orgId })
      .orderBy('name', 'asc');
    res.json(suppliers);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/suppliers', authenticateToken, async (req, res) => {
  const { name, email, phone, company } = req.body;
  if (!name) return res.status(400).json({ error: 'Name is required' });
  try {
    const id = crypto.randomUUID();
    await db('suppliers').insert({
      id,
      org_id: req.user.orgId,
      name,
      email,
      phone,
      company
    });
    
    // Log audit event
    await db('system_audit_logs').insert({
      id: crypto.randomUUID(),
      org_id: req.user.orgId,
      user_id: req.user.userId,
      action_type: "CREATE_PARTNER",
      description: `Created supplier partner: ${name} (${company})`
    });

    res.json({ id, name, email, phone, company });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ----------------------------------------------------
// PURCHASE ORDERS API
// ----------------------------------------------------
app.get('/api/purchase-orders', authenticateToken, async (req, res) => {
  try {
    const pos = await db('purchase_orders')
      .leftJoin('suppliers', 'purchase_orders.supplier_id', 'suppliers.id')
      .select('purchase_orders.*', 'suppliers.name as supplier_name')
      .where('purchase_orders.org_id', req.user.orgId)
      .orderBy('purchase_orders.created_at', 'desc');
      
    for (const po of pos) {
      po.items = await db('purchase_order_items')
        .join('product_variants', 'purchase_order_items.variant_id', 'product_variants.id')
        .join('products', 'product_variants.product_id', 'products.id')
        .select(
          'purchase_order_items.*',
          'products.name as product_name',
          'product_variants.name as variant_name',
          'product_variants.sku as product_sku'
        )
        .where({ purchase_order_id: po.id });
    }
    res.json(pos);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/purchase-orders', authenticateToken, async (req, res) => {
  const { supplierId, items } = req.body;
  if (!items || items.length === 0) {
    return res.status(400).json({ error: 'At least one item is required' });
  }
  
  const poId = crypto.randomUUID();
  
  try {
    let totalAmount = 0;
    items.forEach(item => {
      totalAmount += Number(item.cost) * Number(item.quantityOrdered);
    });
    
    await db.transaction(async tr => {
      await tr('purchase_orders').insert({
        id: poId,
        org_id: req.user.orgId,
        supplier_id: supplierId || null,
        status: 'DRAFT',
        total_amount: totalAmount
      });
      
      for (const item of items) {
        await tr('purchase_order_items').insert({
          id: crypto.randomUUID(),
          purchase_order_id: poId,
          variant_id: item.variantId,
          quantity_ordered: Number(item.quantityOrdered),
          quantity_received: 0,
          cost_at_order: Number(item.cost)
        });
      }

      await tr('system_audit_logs').insert({
        id: crypto.randomUUID(),
        org_id: req.user.orgId,
        user_id: req.user.userId,
        action_type: "CREATE_PO",
        description: `Created Purchase Order Draft #${poId.substring(0, 8)} totaling ₹${totalAmount.toFixed(2)}`
      });
    });
    
    res.json({ id: poId, success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.put('/api/purchase-orders/:id/status', authenticateToken, async (req, res) => {
  const { status } = req.body;
  const poId = req.params.id;
  
  try {
    const po = await db('purchase_orders')
      .where({ id: poId, org_id: req.user.orgId })
      .first();
    if (!po) return res.status(404).json({ error: 'Purchase order not found' });
    
    if (po.status === 'RECEIVED') {
      return res.status(400).json({ error: 'Purchase order has already been received' });
    }
    
    await db.transaction(async tr => {
      await tr('purchase_orders')
        .where({ id: poId })
        .update({ status, updated_at: tr.fn.now() });
        
      if (status === 'RECEIVED') {
        const items = await tr('purchase_order_items').where({ purchase_order_id: poId });
        const defaultLoc = await tr('stock_locations').where({ org_id: req.user.orgId }).first();
        if (!defaultLoc) throw new Error('Default stock location missing');
        
        for (const item of items) {
          await tr('purchase_order_items')
            .where({ id: item.id })
            .update({ quantity_received: item.quantity_ordered });
            
          const level = await tr('stock_levels')
            .where({ variant_id: item.variant_id, location_id: defaultLoc.id })
            .first();
            
          if (level) {
            await tr('stock_levels')
              .where({ id: level.id })
              .update({ quantity: level.quantity + item.quantity_ordered, updated_at: tr.fn.now() });
          } else {
            await tr('stock_levels').insert({
              id: crypto.randomUUID(),
              variant_id: item.variant_id,
              location_id: defaultLoc.id,
              quantity: item.quantity_ordered
            });
          }
          
          await tr('stock_movements').insert({
            id: crypto.randomUUID(),
            variant_id: item.variant_id,
            location_id: defaultLoc.id,
            user_id: req.user.userId,
            quantity_delta: item.quantity_ordered,
            reason: 'received',
            reference_note: `Received PO #${poId.substring(0, 8)}`
          });
        }
      }

      await tr('system_audit_logs').insert({
        id: crypto.randomUUID(),
        org_id: req.user.orgId,
        user_id: req.user.userId,
        action_type: "UPDATE_PO",
        description: `Updated Purchase Order #${poId.substring(0, 8)} status to ${status}`
      });
    });
    
    res.json({ success: true });
  } catch (err) {
    console.error("PO status change error:", err);
    res.status(500).json({ error: err.message });
  }
});

// ----------------------------------------------------
// USERS & ROLES API
// ----------------------------------------------------
app.get('/api/users', authenticateToken, async (req, res) => {
  try {
    const users = await db('users')
      .select('id', 'email', 'role', 'created_at')
      .where({ org_id: req.user.orgId })
      .orderBy('email', 'asc');
    res.json(users);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ----------------------------------------------------
// AUDIT LOGS API
// ----------------------------------------------------
app.get('/api/audit-logs', authenticateToken, async (req, res) => {
  try {
    const logs = await db('system_audit_logs')
      .leftJoin('users', 'system_audit_logs.user_id', 'users.id')
      .select('system_audit_logs.*', 'users.email as user_email')
      .where('system_audit_logs.org_id', req.user.orgId)
      .orderBy('system_audit_logs.created_at', 'desc')
      .limit(50);
    res.json(logs);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Start express server
if (process.env.NODE_ENV !== 'production' || !process.env.VERCEL) {
  app.listen(PORT, () => {
    console.log(`Inventory Backend Server running on port ${PORT}`);
  });
}

module.exports = app;

const crypto = require('crypto');
const db = require('../db');

// Mock data generator for Shopify Sandbox Testing
const MOCK_SHOPIFY_PRODUCTS = [
  {
    id: 9988771,
    title: "Vivid Graphic Tee",
    body_html: "Comfortable organic cotton tee with modern screen-printed design.",
    product_type: "Apparel",
    images: [{ src: "https://images.unsplash.com/photo-1521572267360-ee0c2909d518?w=300" }],
    variants: [
      { id: 111, title: "S / Obsidian Black", sku: "T-GRAPH-S-BLK", price: "24.99", barcode: "711122233301", inventory_quantity: 15 },
      { id: 112, title: "M / Obsidian Black", sku: "T-GRAPH-M-BLK", price: "24.99", barcode: "711122233302", inventory_quantity: 22 },
      { id: 113, title: "L / Obsidian Black", sku: "T-GRAPH-L-BLK", price: "26.99", barcode: "711122233303", inventory_quantity: 8 }
    ]
  },
  {
    id: 9988772,
    title: "Apex Running Shoes",
    body_html: "Lightweight mesh trainers with responsive sole technology.",
    product_type: "Footwear",
    images: [{ src: "https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=300" }],
    variants: [
      { id: 221, title: "US 9 / Neon Red", sku: "SHOE-APEX-9-RED", price: "89.99", barcode: "711122233304", inventory_quantity: 5 },
      { id: 222, title: "US 10 / Neon Red", sku: "SHOE-APEX-10-RED", price: "89.99", barcode: "711122233305", inventory_quantity: 12 }
    ]
  },
  {
    id: 9988773,
    title: "Minimalist Leather Backpack",
    body_html: "Full grain vintage leather backpack with dedicated 15 inch laptop sleeve.",
    product_type: "Bags",
    images: [{ src: "https://images.unsplash.com/photo-1553062407-98eeb64c6a62?w=300" }],
    variants: [
      { id: 331, title: "Default Title", sku: "BAG-LEATH-MIN", price: "120.00", barcode: "711122233306", inventory_quantity: 4 }
    ]
  }
];

async function syncShopifyProducts({ orgId, userId, shopUrl, accessToken, useSandbox }) {
  let productsToSync = [];

  if (useSandbox || !accessToken || !shopUrl) {
    // Simulate network delay
    await new Promise(resolve => setTimeout(resolve, 1500));
    productsToSync = MOCK_SHOPIFY_PRODUCTS;
  } else {
    // Call live Shopify REST Admin API
    // Clean shop URL: ensure it is in the form of "mystore.myshopify.com"
    let cleanUrl = shopUrl.replace(/^(https?:\/\/)?(www\.)?/, '').split('/')[0];
    const url = `https://${cleanUrl}/admin/api/2024-01/products.json?limit=50`;

    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'X-Shopify-Access-Token': accessToken,
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Shopify API error: ${response.statusText} (${response.status}) - ${errorText}`);
    }

    const data = await response.json();
    productsToSync = data.products || [];
  }

  // Get default stock location
  const defaultLoc = await db('stock_locations').where({ org_id: orgId }).first();
  if (!defaultLoc) {
    throw new Error('Default stock location missing in database.');
  }

  let createdCount = 0;
  let updatedCount = 0;

  for (const shopifyProd of productsToSync) {
    await db.transaction(async tr => {
      // 1. Check if product already synced (we check by name or store the Shopify ID in description/metadata,
      //    for simplicity we'll check if a product with the same name exists in this org)
      let product = await tr('products')
        .where({ org_id: orgId, name: shopifyProd.title })
        .first();

      const productId = product ? product.id : crypto.randomUUID();

      if (!product) {
        // Create parent product
        await tr('products').insert({
          id: productId,
          org_id: orgId,
          name: shopifyProd.title,
          category: shopifyProd.product_type || 'Shopify Sync',
          description: shopifyProd.body_html ? shopifyProd.body_html.replace(/<[^>]*>/g, '').slice(0, 500) : '',
          primary_image_url: shopifyProd.images && shopifyProd.images.length > 0 ? shopifyProd.images[0].src : null
        });
        createdCount++;
      } else {
        // Update parent product
        await tr('products')
          .where({ id: productId })
          .update({
            category: shopifyProd.product_type || 'Shopify Sync',
            primary_image_url: shopifyProd.images && shopifyProd.images.length > 0 ? shopifyProd.images[0].src : product.primary_image_url,
            updated_at: tr.fn.now()
          });
        updatedCount++;
      }

      // 2. Sync variants
      for (const shopifyVar of shopifyProd.variants) {
        const variantSku = shopifyVar.sku || `SPFY-${shopifyVar.id}`;
        
        // Check if variant exists
        let variant = await tr('product_variants')
          .where({ product_id: productId, sku: variantSku })
          .first();

        const variantId = variant ? variant.id : crypto.randomUUID();
        const variantName = shopifyVar.title === 'Default Title' ? 'Default' : shopifyVar.title;

        if (!variant) {
          // Create variant
          await tr('product_variants').insert({
            id: variantId,
            product_id: productId,
            name: variantName,
            sku: variantSku,
            barcode: shopifyVar.barcode || null,
            price: parseFloat(shopifyVar.price) || 0.00,
            cost: 0.00, // Shopify API doesn't return cost in standard product endpoint
            low_stock_threshold: 5
          });

          // Initialize stock level
          await tr('stock_levels').insert({
            id: crypto.randomUUID(),
            variant_id: variantId,
            location_id: defaultLoc.id,
            quantity: shopifyVar.inventory_quantity || 0
          });

          // Log stock movement
          if (shopifyVar.inventory_quantity && shopifyVar.inventory_quantity > 0) {
            await tr('stock_movements').insert({
              id: crypto.randomUUID(),
              variant_id: variantId,
              location_id: defaultLoc.id,
              user_id: userId,
              quantity_delta: shopifyVar.inventory_quantity,
              reason: 'received',
              reference_note: `Initial Shopify Sync (ID: ${shopifyVar.id})`
            });
          }
        } else {
          // Update variant price & barcode
          await tr('product_variants')
            .where({ id: variantId })
            .update({
              name: variantName,
              barcode: shopifyVar.barcode || variant.barcode,
              price: parseFloat(shopifyVar.price) || variant.price,
              updated_at: tr.fn.now()
            });

          // Optionally update quantity? In a real sync we can override stock levels
          // If we override:
          if (shopifyVar.inventory_quantity !== undefined) {
            const stockLevel = await tr('stock_levels')
              .where({ variant_id: variantId, location_id: defaultLoc.id })
              .first();

            const currentQty = stockLevel ? stockLevel.quantity : 0;
            const delta = shopifyVar.inventory_quantity - currentQty;

            if (delta !== 0) {
              if (stockLevel) {
                await tr('stock_levels')
                  .where({ id: stockLevel.id })
                  .update({ quantity: shopifyVar.inventory_quantity, updated_at: tr.fn.now() });
              } else {
                await tr('stock_levels').insert({
                  id: crypto.randomUUID(),
                  variant_id: variantId,
                  location_id: defaultLoc.id,
                  quantity: shopifyVar.inventory_quantity
                });
              }

              await tr('stock_movements').insert({
                id: crypto.randomUUID(),
                variant_id: variantId,
                location_id: defaultLoc.id,
                user_id: userId,
                quantity_delta: delta,
                reason: 'adjustment',
                reference_note: `Shopify inventory sync update`
              });
            }
          }
        }
      }
    });
  }

  return { createdCount, updatedCount };
}

module.exports = {
  syncShopifyProducts
};

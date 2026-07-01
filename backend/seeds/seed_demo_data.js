const crypto = require('crypto');

exports.seed = async function(knex) {
  const orgId = 'default-org-uuid';
  const userId = 'default-user-uuid';
  const locationId = 'default-loc-uuid';

  // Clear existing entries
  await knex('system_audit_logs').del();
  await knex('purchase_order_items').del();
  await knex('purchase_orders').del();
  await knex('suppliers').del();
  await knex('stock_movements').del();
  await knex('stock_levels').del();
  await knex('product_variants').del();
  await knex('products').del();
  await knex('stock_locations').del();
  await knex('organization_settings').del();
  await knex('users').del();
  await knex('organizations').del();

  // Insert base organization layout
  await knex('organizations').insert({ id: orgId, name: 'My Inventory' });
  await knex('users').insert({ id: userId, org_id: orgId, email: 'admin@vividinventory.local', password_hash: '', role: 'admin' });
  await knex('organization_settings').insert({ org_id: orgId, vision_provider: 'gemini', vision_api_key_encrypted: null });
  await knex('stock_locations').insert({ id: locationId, org_id: orgId, name: 'Primary Warehouse', description: 'Default warehouse' });

  // Seeding default suppliers
  const supplier1Id = crypto.randomUUID();
  const supplier2Id = crypto.randomUUID();
  await knex('suppliers').insert([
    { id: supplier1Id, org_id: orgId, name: "Elite Electronics Ltd", email: "sales@elite-electronics.in", phone: "+91 98765 43210", company: "Elite Electronics Ltd" },
    { id: supplier2Id, org_id: orgId, name: "PaperCorp India", email: "orders@papercorp.co.in", phone: "+91 99887 76655", company: "PaperCorp India" }
  ]);

  // Seeding default products to match the screenshot + new multi-variant electronics!
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

    await knex('products').insert({
      id: pId,
      org_id: orgId,
      name: prod.name,
      category: prod.category,
      description: prod.description
    });

    for (const v of prod.variants) {
      const vId = crypto.randomUUID();

      await knex('product_variants').insert({
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

      await knex('stock_levels').insert({
        id: crypto.randomUUID(),
        variant_id: vId,
        location_id: locationId,
        quantity: v.qty
      });

      await knex('stock_movements').insert({
        id: crypto.randomUUID(),
        variant_id: vId,
        location_id: locationId,
        user_id: userId,
        quantity_delta: initialQty,
        reason: 'received',
        reference_note: 'Initial Stock Intake'
      });

      await knex('stock_movements').insert({
        id: crypto.randomUUID(),
        variant_id: vId,
        location_id: locationId,
        user_id: userId,
        quantity_delta: -checkoutQty,
        reason: 'sold',
        reference_note: `POS Sale #${billId}`,
        created_at: new Date('2026-07-01T12:00:00Z')
      });
    }
  }

  // Seed default Purchase Orders
  const po1Id = crypto.randomUUID();
  const po2Id = crypto.randomUUID();
  
  await knex('purchase_orders').insert([
    { id: po1Id, org_id: orgId, supplier_id: supplier1Id, status: "PENDING", total_amount: 3500.00, created_at: new Date('2026-07-01T10:00:00Z') },
    { id: po2Id, org_id: orgId, supplier_id: supplier2Id, status: "RECEIVED", total_amount: 1800.00, created_at: new Date('2026-06-25T10:00:00Z') }
  ]);

  const mouseVar = mappedVariants.find(m => m.sku === 'ELC-002');
  const paperVar = mappedVariants.find(m => m.sku === 'OFF-001');

  if (mouseVar) {
    await knex('purchase_order_items').insert({
      id: crypto.randomUUID(),
      purchase_order_id: po1Id,
      variant_id: mouseVar.vId,
      quantity_ordered: 10,
      quantity_received: 0,
      cost_at_order: mouseVar.cost
    });
  }

  if (paperVar) {
    await knex('purchase_order_items').insert({
      id: crypto.randomUUID(),
      purchase_order_id: po2Id,
      variant_id: paperVar.vId,
      quantity_ordered: 10,
      quantity_received: 10,
      cost_at_order: paperVar.cost
    });
  }

  // Seed default System Audit Logs
  await knex('system_audit_logs').insert([
    { id: crypto.randomUUID(), org_id: orgId, user_id: userId, action_type: "LOGIN", description: "Default administrator session bypassed via auto-auth mode", created_at: new Date('2026-07-01T09:00:00Z') },
    { id: crypto.randomUUID(), org_id: orgId, user_id: userId, action_type: "SEED_DEMO", description: "Database seeded with default Stockwise HQ demo products and logs", created_at: new Date('2026-07-01T09:05:00Z') },
    { id: crypto.randomUUID(), org_id: orgId, user_id: userId, action_type: "UPDATE_SETTINGS", description: "Updated organization details to default configuration", created_at: new Date('2026-07-01T09:10:00Z') }
  ]);
};

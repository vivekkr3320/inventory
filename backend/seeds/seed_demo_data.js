const crypto = require('crypto');

exports.seed = async function(knex) {
  const orgId = 'default-org-uuid';
  const userId = 'default-user-uuid';
  const locationId = 'default-loc-uuid';

  // Clear existing entries
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

  // Seeding default products to match the screenshot
  const demoProducts = [
    { name: "A4 Paper Ream", sku: "OFF-001", barcode: "890103070001", category: "Office Supplies", cost: 180.00, price: 299.00, qty: 45 },
    { name: "Wireless Mouse", sku: "ELC-002", barcode: "890103070002", category: "Electronics", cost: 350.00, price: 699.00, qty: 15 },
    { name: "USB-C Cable 2m", sku: "ELC-001", barcode: "890103070003", category: "Electronics", cost: 120.00, price: 249.00, qty: 30 },
    { name: "Ballpoint Pens x12", sku: "OFF-002", barcode: "890103070004", category: "Office Supplies", cost: 60.00, price: 120.00, qty: 50 },
    { name: "Bubble Wrap Roll", sku: "PKG-001", barcode: "890103070005", category: "Packaging", cost: 250.00, price: 499.00, qty: 10 },
    { name: "HDMI Cable 1.5m", sku: "ELC-003", barcode: "890103070006", category: "Electronics", cost: 150.00, price: 349.00, qty: 25 }
  ];

  const billId = "SQMBCA6";

  for (const item of demoProducts) {
    const pId = crypto.randomUUID();
    const vId = crypto.randomUUID();

    await knex('products').insert({
      id: pId,
      org_id: orgId,
      name: item.name,
      category: item.category,
      description: `High-quality ${item.name} for business operations.`
    });

    await knex('product_variants').insert({
      id: vId,
      product_id: pId,
      name: "Default",
      sku: item.sku,
      barcode: item.barcode,
      price: item.price,
      cost: item.cost,
      low_stock_threshold: 5
    });

    const checkoutQty = item.sku === 'PKG-001' || item.sku === 'ELC-003' || item.sku === 'ELC-002' ? 6 : 5;
    const initialQty = item.qty + checkoutQty;

    await knex('stock_levels').insert({
      id: crypto.randomUUID(),
      variant_id: vId,
      location_id: locationId,
      quantity: item.qty
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
};

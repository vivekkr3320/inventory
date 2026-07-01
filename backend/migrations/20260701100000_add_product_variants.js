exports.up = function(knex) {
  return knex.schema
    // 1. Drop dependent tables to recreate them with variant links
    .dropTableIfExists('stock_movements')
    .dropTableIfExists('stock_levels')
    .dropTableIfExists('products')
    
    // 2. Re-create products table (as parent container)
    .createTable('products', table => {
      table.string('id', 36).primary();
      table.string('org_id', 36).references('id').inTable('organizations').onDelete('CASCADE');
      table.string('name', 255).notNullable();
      table.string('category', 100).defaultTo('General');
      table.text('description');
      table.text('primary_image_url');
      table.timestamp('created_at').defaultTo(knex.fn.now());
      table.timestamp('updated_at').defaultTo(knex.fn.now());
    })

    // 3. Create product_variants table
    .createTable('product_variants', table => {
      table.string('id', 36).primary();
      table.string('product_id', 36).references('id').inTable('products').onDelete('CASCADE');
      table.string('name', 255).notNullable(); // e.g. "S / Red" or "Default"
      table.string('sku', 100).notNullable();
      table.string('barcode', 100);
      table.decimal('price', 12, 2).defaultTo(0.00);
      table.decimal('cost', 12, 2).defaultTo(0.00);
      table.integer('low_stock_threshold').defaultTo(5);
      table.timestamp('created_at').defaultTo(knex.fn.now());
      table.timestamp('updated_at').defaultTo(knex.fn.now());
      table.unique(['product_id', 'sku']); // SKU must be unique per product
      table.unique(['product_id', 'barcode']); // Barcode must be unique per product
    })

    // 4. Re-create stock_levels pointing to variant_id
    .createTable('stock_levels', table => {
      table.string('id', 36).primary();
      table.string('variant_id', 36).references('id').inTable('product_variants').onDelete('CASCADE');
      table.string('location_id', 36).references('id').inTable('stock_locations').onDelete('CASCADE');
      table.integer('quantity').defaultTo(0);
      table.timestamp('updated_at').defaultTo(knex.fn.now());
      table.unique(['variant_id', 'location_id']);
    })

    // 5. Re-create stock_movements pointing to variant_id
    .createTable('stock_movements', table => {
      table.string('id', 36).primary();
      table.string('variant_id', 36).references('id').inTable('product_variants').onDelete('CASCADE');
      table.string('location_id', 36).references('id').inTable('stock_locations').onDelete('CASCADE');
      table.string('user_id', 36).references('id').inTable('users').onDelete('SET NULL');
      table.integer('quantity_delta').notNullable();
      table.string('reason', 100).notNullable(); // received, sold, adjustment, damaged
      table.text('reference_note');
      table.timestamp('created_at').defaultTo(knex.fn.now());
    })

    // 6. Alter organization_settings to add Shopify integration fields
    .alterTable('organization_settings', table => {
      table.string('shopify_shop_url', 255);
      table.text('shopify_access_token_encrypted');
    });
};

exports.down = function(knex) {
  return knex.schema
    .alterTable('organization_settings', table => {
      table.dropColumn('shopify_access_token_encrypted');
      table.dropColumn('shopify_shop_url');
    })
    .dropTableIfExists('stock_movements')
    .dropTableIfExists('stock_levels')
    .dropTableIfExists('product_variants')
    .dropTableIfExists('products');
};

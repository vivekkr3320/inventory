exports.up = function(knex) {
  return knex.schema
    .createTable('organizations', table => {
      table.string('id', 36).primary();
      table.string('name', 255).notNullable();
      table.timestamp('created_at').defaultTo(knex.fn.now());
    })
    .createTable('users', table => {
      table.string('id', 36).primary();
      table.string('org_id', 36).references('id').inTable('organizations').onDelete('CASCADE');
      table.string('email', 255).unique().notNullable();
      table.string('password_hash', 255).notNullable();
      table.string('role', 50).defaultTo('staff');
      table.timestamp('created_at').defaultTo(knex.fn.now());
    })
    .createTable('organization_settings', table => {
      table.string('org_id', 36).primary().references('id').inTable('organizations').onDelete('CASCADE');
      table.string('vision_provider', 50).defaultTo('gemini');
      table.text('vision_api_key_encrypted');
      table.timestamp('updated_at').defaultTo(knex.fn.now());
    })
    .createTable('products', table => {
      table.string('id', 36).primary();
      table.string('org_id', 36).references('id').inTable('organizations').onDelete('CASCADE');
      table.string('name', 255).notNullable();
      table.string('sku', 100).notNullable();
      table.string('barcode', 100);
      table.string('category', 100);
      table.decimal('price', 12, 2).defaultTo(0.00);
      table.decimal('cost', 12, 2).defaultTo(0.00);
      table.text('description');
      table.text('primary_image_url');
      table.integer('low_stock_threshold').defaultTo(5);
      table.timestamp('created_at').defaultTo(knex.fn.now());
      table.timestamp('updated_at').defaultTo(knex.fn.now());
      table.unique(['org_id', 'sku']);
      table.unique(['org_id', 'barcode']);
    })
    .createTable('stock_locations', table => {
      table.string('id', 36).primary();
      table.string('org_id', 36).references('id').inTable('organizations').onDelete('CASCADE');
      table.string('name', 255).notNullable();
      table.text('description');
      table.timestamp('created_at').defaultTo(knex.fn.now());
    })
    .createTable('stock_levels', table => {
      table.string('id', 36).primary();
      table.string('product_id', 36).references('id').inTable('products').onDelete('CASCADE');
      table.string('location_id', 36).references('id').inTable('stock_locations').onDelete('CASCADE');
      table.integer('quantity').defaultTo(0);
      table.timestamp('updated_at').defaultTo(knex.fn.now());
      table.unique(['product_id', 'location_id']);
    })
    .createTable('stock_movements', table => {
      table.string('id', 36).primary();
      table.string('product_id', 36).references('id').inTable('products').onDelete('CASCADE');
      table.string('location_id', 36).references('id').inTable('stock_locations').onDelete('CASCADE');
      table.string('user_id', 36).references('id').inTable('users').onDelete('SET NULL');
      table.integer('quantity_delta').notNullable();
      table.string('reason', 100).notNullable(); // received, sold, adjustment, damaged
      table.text('reference_note');
      table.timestamp('created_at').defaultTo(knex.fn.now());
    });
};

exports.down = function(knex) {
  return knex.schema
    .dropTableIfExists('stock_movements')
    .dropTableIfExists('stock_levels')
    .dropTableIfExists('stock_locations')
    .dropTableIfExists('products')
    .dropTableIfExists('organization_settings')
    .dropTableIfExists('users')
    .dropTableIfExists('organizations');
};

exports.up = function(knex) {
  return knex.schema
    .createTable('suppliers', table => {
      table.string('id').primary();
      table.string('org_id').notNullable().references('id').inTable('organizations').onDelete('CASCADE');
      table.string('name').notNullable();
      table.string('email');
      table.string('phone');
      table.string('company');
      table.timestamp('created_at').defaultTo(knex.fn.now());
      table.timestamp('updated_at').defaultTo(knex.fn.now());
    })
    .createTable('purchase_orders', table => {
      table.string('id').primary();
      table.string('org_id').notNullable().references('id').inTable('organizations').onDelete('CASCADE');
      table.string('supplier_id').references('id').inTable('suppliers').onDelete('SET NULL');
      table.string('status').notNullable().defaultTo('DRAFT'); // DRAFT, PENDING, RECEIVED
      table.decimal('total_amount', 12, 2).defaultTo(0.00);
      table.timestamp('created_at').defaultTo(knex.fn.now());
      table.timestamp('updated_at').defaultTo(knex.fn.now());
    })
    .createTable('purchase_order_items', table => {
      table.string('id').primary();
      table.string('purchase_order_id').notNullable().references('id').inTable('purchase_orders').onDelete('CASCADE');
      table.string('variant_id').notNullable().references('id').inTable('product_variants').onDelete('CASCADE');
      table.integer('quantity_ordered').notNullable().defaultTo(0);
      table.integer('quantity_received').notNullable().defaultTo(0);
      table.decimal('cost_at_order', 12, 2).notNullable().defaultTo(0.00);
      table.timestamp('created_at').defaultTo(knex.fn.now());
    })
    .createTable('system_audit_logs', table => {
      table.string('id').primary();
      table.string('org_id').notNullable().references('id').inTable('organizations').onDelete('CASCADE');
      table.string('user_id').references('id').inTable('users').onDelete('SET NULL');
      table.string('action_type').notNullable(); // e.g. LOGIN, SYNC_SHOPIFY, SEED_DEMO, UPDATE_SETTINGS
      table.text('description').notNullable();
      table.timestamp('created_at').defaultTo(knex.fn.now());
    });
};

exports.down = function(knex) {
  return knex.schema
    .dropTableIfExists('system_audit_logs')
    .dropTableIfExists('purchase_order_items')
    .dropTableIfExists('purchase_orders')
    .dropTableIfExists('suppliers');
};

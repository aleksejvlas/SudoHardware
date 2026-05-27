/**
 * Order model
 */

const pool = require('../config/database');
let ordersSchemaEnsuredPromise = null;

function parseOrderItems(rawItems, orderId = 'unknown') {
  if (!rawItems) return [];

  if (Array.isArray(rawItems)) {
    return rawItems;
  }

  if (rawItems && typeof rawItems === 'object') {
    if (Array.isArray(rawItems.items)) {
      return rawItems.items;
    }
    return [];
  }

  if (typeof rawItems === 'string' || Buffer.isBuffer(rawItems)) {
    const text = Buffer.isBuffer(rawItems) ? rawItems.toString('utf8') : rawItems;
    try {
      const parsed = JSON.parse(text);
      if (Array.isArray(parsed)) return parsed;
      if (parsed && typeof parsed === 'object' && Array.isArray(parsed.items)) return parsed.items;
    } catch (e) {
      console.warn(` Не можна парсити items для замовлення ${orderId}:`, e.message);
    }
  }

  return [];
}

async function ensureOrdersSchema() {
  if (ordersSchemaEnsuredPromise) {
    return ordersSchemaEnsuredPromise;
  }

  ordersSchemaEnsuredPromise = (async () => {
    try {
      await pool.query('ALTER TABLE orders ADD COLUMN customer_address TEXT');
      console.log(' Додано колонку orders.customer_address');
    } catch (error) {
      if (error.code !== 'ER_DUP_FIELDNAME') {
        throw error;
      }
    }
  })();

  return ordersSchemaEnsuredPromise;
}

const orderModel = {
  create: async (orderData) => {
    try {
      await ensureOrdersSchema();

      const date = new Date().toISOString().slice(0, 10).replace(/-/g, '');
      const random = Math.floor(Math.random() * 90000) + 10000;
      const orderNumber = `ORD-${date}-${random}`;

      const query = `
        INSERT INTO orders (order_number, customer_name, customer_email, customer_phone, customer_address, items, total_price, status)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `;

      const [result] = await pool.query(query, [
        orderNumber,
        orderData.customer_name,
        orderData.customer_email,
        orderData.customer_phone || '',
        orderData.customer_address || '',
        JSON.stringify(orderData.items || []),
        orderData.total_price,
        'pending'
      ]);

      return {
        id: result.insertId,
        order_number: orderNumber,
        ...orderData,
        status: 'pending',
        created_at: new Date().toISOString()
      };
    } catch (error) {
      throw new Error(`Помилка при створенні замовлення: ${error.message}`);
    }
  },

  findById: async (id) => {
    try {
      const query = 'SELECT * FROM orders WHERE id = ?';
      const [rows] = await pool.query(query, [id]);
      if (rows.length === 0) return null;

      const order = rows[0];
      order.items = parseOrderItems(order.items, order.id);
      return order;
    } catch (error) {
      throw new Error(`Помилка при отриманні замовлення: ${error.message}`);
    }
  },

  findByOrderNumber: async (orderNumber) => {
    try {
      const query = 'SELECT * FROM orders WHERE order_number = ?';
      const [rows] = await pool.query(query, [orderNumber]);
      if (rows.length === 0) return null;

      const order = rows[0];
      order.items = parseOrderItems(order.items, order.id);
      return order;
    } catch (error) {
      throw new Error(`Помилка при отриманні замовлення: ${error.message}`);
    }
  },

  findByEmail: async (email) => {
    try {
      const query = 'SELECT * FROM orders WHERE customer_email = ? ORDER BY created_at DESC';
      const [rows] = await pool.query(query, [email]);

      return rows.map(order => {
        order.items = parseOrderItems(order.items, order.id);
        return order;
      });
    } catch (error) {
      throw new Error(`Помилка при отриманні замовлень: ${error.message}`);
    }
  },

  findAll: async (limit = 50, offset = 0) => {
    try {
      const query = 'SELECT * FROM orders ORDER BY created_at DESC LIMIT ? OFFSET ?';
      const [rows] = await pool.query(query, [limit, offset]);

      return rows.map(order => {
        order.items = parseOrderItems(order.items, order.id);
        return order;
      });
    } catch (error) {
      throw new Error(`Помилка при отриманні замовлень: ${error.message}`);
    }
  },

  updateStatus: async (id, status) => {
    try {
      const validStatuses = ['pending', 'confirmed', 'shipped', 'delivered', 'cancelled'];
      if (!validStatuses.includes(status)) {
        throw new Error(`Невалідний статус: ${status}`);
      }

      const query = 'UPDATE orders SET status = ? WHERE id = ?';
      const [result] = await pool.query(query, [status, id]);
      return result.affectedRows > 0;
    } catch (error) {
      throw new Error(`Помилка при оновленні статусу: ${error.message}`);
    }
  },

  delete: async (id) => {
    try {
      const query = 'DELETE FROM orders WHERE id = ?';
      const [result] = await pool.query(query, [id]);
      return result.affectedRows > 0;
    } catch (error) {
      throw new Error(`Помилка при видаленні замовлення: ${error.message}`);
    }
  },

  /**
   * Повертає список найпопулярніших товарів за кількістю продажів.
   * @param {number} limit - Максимальна кількість товарів
   * @param {object} options - Додаткові опції
   * @param {string[]} options.excludeStatuses - Статуси, які треба виключити
   * @returns {Promise<Array<{productId:number,totalQty:number}>>}
   */
  getPopularProductCounts: async (limit = 6, options = {}) => {
    try {
      const maxLimit = 50;
      const safeLimit = Math.min(Math.max(parseInt(limit, 10) || 6, 1), maxLimit);
      const excludeStatuses = Array.isArray(options.excludeStatuses)
        ? options.excludeStatuses.filter(Boolean)
        : ['cancelled'];

      let query = 'SELECT id, items, status FROM orders';
      const params = [];
      if (excludeStatuses.length > 0) {
        const placeholders = excludeStatuses.map(() => '?').join(',');
        query += ` WHERE status NOT IN (${placeholders})`;
        params.push(...excludeStatuses);
      }

      const [rows] = await pool.query(query, params);
      const counts = new Map();

      rows.forEach(order => {
        const items = parseOrderItems(order.items, order.id);
        items.forEach(item => {
          const rawId = item?.id ?? item?.product_id ?? item?.productId;
          const productId = parseInt(rawId, 10);
          if (!Number.isFinite(productId)) return;

          const quantity = parseInt(item?.quantity, 10);
          const safeQty = Number.isFinite(quantity) && quantity > 0 ? quantity : 1;
          counts.set(productId, (counts.get(productId) || 0) + safeQty);
        });
      });

      const sorted = Array.from(counts.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, safeLimit)
        .map(([productId, totalQty]) => ({ productId, totalQty }));

      return sorted;
    } catch (error) {
      throw new Error(`Помилка при обчисленні популярності: ${error.message}`);
    }
  }
};

module.exports = orderModel;

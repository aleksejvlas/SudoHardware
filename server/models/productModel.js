// Product model for products table
const pool = require("../config/database");
function parseSpecs(rawSpecs, productId) {
  if (!rawSpecs) return {};
  try {
    const parsed = typeof rawSpecs === "string" ? JSON.parse(rawSpecs) : rawSpecs;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return {};
    }
    return parsed;
  } catch (error) {
    console.warn(` Некоректний JSON specs у товарі ID=${productId}: ${error.message}`);
    return {};
  }
}
function normalizeSpecsForDb(specs) {
  if (specs === undefined) return undefined;
  if (specs === null) return null;
  return typeof specs === "string" ? specs : JSON.stringify(specs);
}
const productModel = {
  getAll: async (filters = {}) => {
    try {
      let query = "SELECT * FROM products WHERE 1=1";
      const params = [];
      if (filters.category) {
        query += " AND category = ?";
        params.push(filters.category);
      }
      if (filters.search) {
        query += " AND name LIKE ?";
        params.push(`%${filters.search}%`);
      }
      const validSorts = ["price_asc", "price_desc", "name_asc", "name_desc"];
      if (filters.sort && validSorts.includes(filters.sort)) {
        query +=
          filters.sort === "price_asc"
            ? " ORDER BY price ASC"
            : filters.sort === "price_desc"
              ? " ORDER BY price DESC"
              : filters.sort === "name_desc"
                ? " ORDER BY name DESC"
                : " ORDER BY name ASC";
      } else {
        query += " ORDER BY name ASC";
      }
      // SECURITY: Enforce maximum limit (prevent DoS)
      let limit = parseInt(filters.limit) || 20;
      const MAX_LIMIT = 100; // Maximum items per request
      limit = Math.min(limit, MAX_LIMIT);
      const offset = Math.max(0, parseInt(filters.offset) || 0);
      query += " LIMIT ? OFFSET ?";
      params.push(limit, offset);
      const [rows] = await pool.query(query, params);
      return rows.map((product) => ({
        ...product,
        specs: parseSpecs(product.specs, product.id),
      }));
    } catch (error) {
      throw new Error(`Помилка при отриманні товарів: ${error.message}`);
    }
  },
  getById: async (id) => {
    try {
      const [rows] = await pool.query("SELECT * FROM products WHERE id = ?", [id]);
      if (!rows[0]) return null;
      return { ...rows[0], specs: parseSpecs(rows[0].specs, rows[0].id) };
    } catch (error) {
      throw new Error(`Помилка при отриманні товару: ${error.message}`);
    }
  },
  getByIds: async (ids = []) => {
    try {
      if (!Array.isArray(ids) || ids.length === 0) {
        return [];
      }
      const normalizedIds = ids.map((id) => parseInt(id, 10)).filter((id) => Number.isFinite(id));
      if (normalizedIds.length === 0) {
        return [];
      }
      const placeholders = normalizedIds.map(() => "?").join(",");
      const [rows] = await pool.query(
        `SELECT * FROM products WHERE id IN (${placeholders})`,
        normalizedIds,
      );
      const byId = new Map(
        rows.map((row) => [row.id, { ...row, specs: parseSpecs(row.specs, row.id) }]),
      );
      return normalizedIds.map((id) => byId.get(id)).filter(Boolean);
    } catch (error) {
      throw new Error(`Error getting products by ids: ${error.message}`);
    }
  },
  getByCategory: async (category) => {
    try {
      const [rows] = await pool.query(
        "SELECT * FROM products WHERE category = ? ORDER BY name ASC",
        [category],
      );
      return rows.map((product) => ({
        ...product,
        specs: parseSpecs(product.specs, product.id),
      }));
    } catch (error) {
      throw new Error(`Помилка при отриманні товарів категорії: ${error.message}`);
    }
  },
  create: async (productData) => {
    try {
      const query = `        INSERT INTO products         (name, price, category, stock, description, image_url, specs)        VALUES (?, ?, ?, ?, ?, ?, ?)      `;
      const specsForDb = normalizeSpecsForDb(productData.specs);
      const [result] = await pool.query(query, [
        productData.name,
        productData.price,
        productData.category,
        productData.stock || 0,
        productData.description || "",
        productData.image_url || "",
        specsForDb === undefined ? null : specsForDb,
      ]);
      return result.insertId;
    } catch (error) {
      throw new Error(`Помилка при створенні товару: ${error.message}`);
    }
  },
  update: async (id, productData) => {
    try {
      const updates = [];
      const params = [];
      if (productData.name !== undefined) {
        updates.push("name = ?");
        params.push(productData.name);
      }
      if (productData.price !== undefined) {
        updates.push("price = ?");
        params.push(productData.price);
      }
      if (productData.category !== undefined) {
        updates.push("category = ?");
        params.push(productData.category);
      }
      if (productData.stock !== undefined) {
        updates.push("stock = ?");
        params.push(productData.stock);
      }
      if (productData.description !== undefined) {
        updates.push("description = ?");
        params.push(productData.description);
      }
      if (productData.image_url !== undefined) {
        updates.push("image_url = ?");
        params.push(productData.image_url);
      }
      if (productData.specs !== undefined) {
        updates.push("specs = ?");
        params.push(normalizeSpecsForDb(productData.specs));
      }
      if (updates.length === 0) {
        return false;
      }
      const query = `UPDATE products SET ${updates.join(", ")} WHERE id = ?`;
      params.push(id);
      const [result] = await pool.query(query, params);
      return result.affectedRows > 0;
    } catch (error) {
      throw new Error(`Помилка при оновленні товару: ${error.message}`);
    }
  },
  delete: async (id) => {
    try {
      const [result] = await pool.query("DELETE FROM products WHERE id = ?", [id]);
      return result.affectedRows > 0;
    } catch (error) {
      throw new Error(`Помилка при видаленні товару: ${error.message}`);
    }
  },
  count: async () => {
    try {
      const [rows] = await pool.query("SELECT COUNT(*) as count FROM products");
      return rows[0].count;
    } catch (error) {
      throw new Error(`Помилка при підрахунку товарів: ${error.message}`);
    }
  },
  decreaseStock: async (productId, quantity) => {
    try {
      const [result] = await pool.query(
        "UPDATE products SET stock = stock - ? WHERE id = ? AND stock >= ?",
        [quantity, productId, quantity],
      );
      if (result.affectedRows === 0) {
        throw new Error(`Недостатньо під на складі. Товар №${productId}, потрібно: ${quantity}`);
      }
      return true;
    } catch (error) {
      throw new Error(`Помилка при оновленні запасів: ${error.message}`);
    }
  },
};
module.exports = productModel;

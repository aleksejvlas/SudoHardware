// Модель для управління відгуками про товари
// Методи для взаємодії з таблицею reviews в базі даних

const pool = require('../config/database');
let reviewsSchemaEnsuredPromise = null;

async function ensureReviewsSchema(force = false) {
  if (force) {
    reviewsSchemaEnsuredPromise = null;
  }

  if (reviewsSchemaEnsuredPromise) {
    return reviewsSchemaEnsuredPromise;
  }

  reviewsSchemaEnsuredPromise = (async () => {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS reviews (
        id INT AUTO_INCREMENT PRIMARY KEY,
        product_id INT NOT NULL,
        user_id INT,
        author_name VARCHAR(255) NOT NULL,
        rating INT NOT NULL CHECK (rating >= 1 AND rating <= 5),
        title VARCHAR(255),
        comment TEXT,
        helpful_count INT DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL,
        INDEX idx_product_id (product_id),
        INDEX idx_user_id (user_id),
        INDEX idx_rating (rating),
        INDEX idx_created_at (created_at)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

    const columnsToAdd = [
      'ALTER TABLE reviews ADD COLUMN user_id INT',
      'ALTER TABLE reviews ADD COLUMN title VARCHAR(255)',
      'ALTER TABLE reviews ADD COLUMN comment TEXT',
      'ALTER TABLE reviews ADD COLUMN helpful_count INT DEFAULT 0',
      'ALTER TABLE reviews ADD COLUMN updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP'
    ];

    for (const statement of columnsToAdd) {
      try {
        await pool.query(statement);
      } catch (error) {
        if (error.code !== 'ER_DUP_FIELDNAME') {
          throw error;
        }
      }
    }
  })().catch((error) => {
    reviewsSchemaEnsuredPromise = null;
    throw error;
  });

  return reviewsSchemaEnsuredPromise;
}

async function withReviewsSchema(operation) {
  try {
    await ensureReviewsSchema();
    return await operation();
  } catch (error) {
    if (error && error.code === 'ER_NO_SUCH_TABLE') {
      await ensureReviewsSchema(true);
      return await operation();
    }
    throw error;
  }
}

const reviewModel = {
  /**
   * Створює новий відгук для товару
   * @param {object} reviewData - Об'єкт з даними відгуку
   * @param {number} reviewData.product_id - ID товару
   * @param {number} reviewData.user_id - ID користувача (опціонально)
   * @param {string} reviewData.author_name - Ім'я автора
   * @param {number} reviewData.rating - Оцінка (1-5)
   * @param {string} reviewData.title - Заголовок відгуку
   * @param {string} reviewData.comment - Текст відгуку
   * @returns {Promise<number>} ID нового відгуку
   */
  create: async (reviewData) => {
    try {
      return await withReviewsSchema(async () => {
        // Валідація оцінки
        const rating = parseInt(reviewData.rating);
        if (rating < 1 || rating > 5) {
          throw new Error('Оцінка має бути від 1 до 5');
        }

        const query = `
          INSERT INTO reviews 
          (product_id, user_id, author_name, rating, title, comment)
          VALUES (?, ?, ?, ?, ?, ?)
        `;

        const [result] = await pool.query(query, [
          reviewData.product_id,
          reviewData.user_id || null,
          reviewData.author_name,
          rating,
          reviewData.title || '',
          reviewData.comment || ''
        ]);

        return result.insertId;
      });
    } catch (error) {
      throw new Error(`Помилка при створенні відгуку: ${error.message}`);
    }
  },

  /**
   * Отримує всі відгуки (для адміна)
   * @param {object} filters - Параметри фільтрації
   * @param {string} filters.search - Пошук по автору, тексту або товару
   * @param {number} filters.product_id - Фільтр по товару
   * @param {number} filters.rating - Фільтр по оцінці
   * @param {number} filters.limit - Ліміт
   * @param {number} filters.offset - Зміщення
   * @returns {Promise<Array>} Масив відгуків
   */
  getAll: async (filters = {}) => {
    try {
      return await withReviewsSchema(async () => {
        let query = `
          SELECT 
            r.id,
            r.product_id,
            r.user_id,
            r.author_name,
            r.rating,
            r.title,
            r.comment,
            r.helpful_count,
            r.created_at,
            r.updated_at,
            p.name AS product_name,
            u.username
          FROM reviews r
          LEFT JOIN products p ON r.product_id = p.id
          LEFT JOIN users u ON r.user_id = u.id
          WHERE 1=1
        `;

        const params = [];
        const search = typeof filters.search === 'string' ? filters.search.trim() : '';
        const productId = parseInt(filters.product_id, 10);
        const rating = parseInt(filters.rating, 10);

        if (Number.isFinite(productId)) {
          query += ' AND r.product_id = ?';
          params.push(productId);
        }

        if (Number.isFinite(rating)) {
          query += ' AND r.rating = ?';
          params.push(rating);
        }

        if (search) {
          const likeValue = `%${search}%`;
          query += ' AND (r.author_name LIKE ? OR r.title LIKE ? OR r.comment LIKE ? OR p.name LIKE ?)';
          params.push(likeValue, likeValue, likeValue, likeValue);
        }

        query += ' ORDER BY r.created_at DESC';

        let limit = parseInt(filters.limit, 10) || 50;
        const MAX_LIMIT = 200;
        limit = Math.min(limit, MAX_LIMIT);
        const offset = Math.max(0, parseInt(filters.offset, 10) || 0);

        query += ' LIMIT ? OFFSET ?';
        params.push(limit, offset);

        const [rows] = await pool.query(query, params);
        return rows || [];
      });
    } catch (error) {
      throw new Error(`Помилка при отриманні всіх відгуків: ${error.message}`);
    }
  },

  /**
   * Отримує всі відгуки для конкретного товару
   * @param {number} productId - ID товару
   * @param {object} filters - Об'єкт з параметрами фільтрації
   * @param {number} filters.limit - Максимальна кількість результатів
   * @param {number} filters.offset - Зміщення від початку списку
   * @returns {Promise<Array>} Массив відгуків
   */
  getByProductId: async (productId, filters = {}) => {
    try {
      return await withReviewsSchema(async () => {
        let query = `
          SELECT 
            r.id,
            r.product_id,
            r.user_id,
            r.author_name,
            r.rating,
            r.title,
            r.comment,
            r.helpful_count,
            r.created_at,
            u.username
          FROM reviews r
          LEFT JOIN users u ON r.user_id = u.id
          WHERE r.product_id = ?
          ORDER BY r.created_at DESC
        `;

        const params = [productId];

        // Пагінація
        let limit = parseInt(filters.limit) || 10;
        const MAX_LIMIT = 100;
        limit = Math.min(limit, MAX_LIMIT);

        const offset = Math.max(0, parseInt(filters.offset) || 0);

        query += ' LIMIT ? OFFSET ?';
        params.push(limit, offset);

        const [reviews] = await pool.query(query, params);

        return reviews || [];
      });
    } catch (error) {
      throw new Error(`Помилка при отриманні відгуків: ${error.message}`);
    }
  },

  /**
   * Отримує статистику оцінок для товару
   * @param {number} productId - ID товару
   * @returns {Promise<object>} Об'єкт зі статистикою
   */
  getStats: async (productId) => {
    try {
      return await withReviewsSchema(async () => {
        const query = `
          SELECT 
            COUNT(*) as total_reviews,
            AVG(rating) as average_rating,
            SUM(CASE WHEN rating = 5 THEN 1 ELSE 0 END) as count_5_stars,
            SUM(CASE WHEN rating = 4 THEN 1 ELSE 0 END) as count_4_stars,
            SUM(CASE WHEN rating = 3 THEN 1 ELSE 0 END) as count_3_stars,
            SUM(CASE WHEN rating = 2 THEN 1 ELSE 0 END) as count_2_stars,
            SUM(CASE WHEN rating = 1 THEN 1 ELSE 0 END) as count_1_stars
          FROM reviews
          WHERE product_id = ?
        `;

        const [stats] = await pool.query(query, [productId]);

        return stats && stats.length > 0 ? stats[0] : {
          total_reviews: 0,
          average_rating: 0,
          count_5_stars: 0,
          count_4_stars: 0,
          count_3_stars: 0,
          count_2_stars: 0,
          count_1_stars: 0
        };
      });
    } catch (error) {
      throw new Error(`Помилка при отриманні статистики: ${error.message}`);
    }
  },

  /**
   * Отримує один відгук за ID
   * @param {number} reviewId - ID відгуку
   * @returns {Promise<object|null>} Відгук або null
   */
  getById: async (reviewId) => {
    try {
      return await withReviewsSchema(async () => {
        const query = `
          SELECT 
            r.*,
            u.username
          FROM reviews r
          LEFT JOIN users u ON r.user_id = u.id
          WHERE r.id = ?
        `;

        const [reviews] = await pool.query(query, [reviewId]);

        return reviews && reviews.length > 0 ? reviews[0] : null;
      });
    } catch (error) {
      throw new Error(`Помилка при отриманні відгуку: ${error.message}`);
    }
  },

  /**
   * Оновлює відгук (може змінити оцінку, коментар тощо)
   * @param {number} reviewId - ID відгуку
   * @param {object} updateData - Об'єкт з новими даними
   * @returns {Promise<boolean>} Успішність операції
   */
  update: async (reviewId, updateData) => {
    try {
      return await withReviewsSchema(async () => {
        const allowedFields = ['rating', 'title', 'comment'];
        const updates = [];
        const values = [];

        for (const field of allowedFields) {
          if (field in updateData) {
            if (field === 'rating') {
              const rating = parseInt(updateData[field]);
              if (rating < 1 || rating > 5) {
                throw new Error('Оцінка має бути від 1 до 5');
              }
              updates.push(`${field} = ?`);
              values.push(rating);
            } else {
              updates.push(`${field} = ?`);
              values.push(updateData[field]);
            }
          }
        }

        if (updates.length === 0) {
          throw new Error('Немає полів для оновлення');
        }

        updates.push('updated_at = NOW()');

        const query = `UPDATE reviews SET ${updates.join(', ')} WHERE id = ?`;
        values.push(reviewId);

        const [result] = await pool.query(query, values);

        return result.affectedRows > 0;
      });
    } catch (error) {
      throw new Error(`Помилка при оновленні відгуку: ${error.message}`);
    }
  },

  /**
   * Видаляє відгук
   * @param {number} reviewId - ID відгуку
   * @returns {Promise<boolean>} Успішність операції
   */
  delete: async (reviewId) => {
    try {
      return await withReviewsSchema(async () => {
        const query = 'DELETE FROM reviews WHERE id = ?';
        const [result] = await pool.query(query, [reviewId]);

        return result.affectedRows > 0;
      });
    } catch (error) {
      throw new Error(`Помилка при видаленні відгуку: ${error.message}`);
    }
  },

  /**
   * Збільшує лічильник "корисних" голосів для відгуку
   * @param {number} reviewId - ID відгуку
   * @returns {Promise<boolean>} Успішність операції
   */
  incrementHelpful: async (reviewId) => {
    try {
      return await withReviewsSchema(async () => {
        const query = `UPDATE reviews SET helpful_count = helpful_count + 1 WHERE id = ?`;
        const [result] = await pool.query(query, [reviewId]);

        return result.affectedRows > 0;
      });
    } catch (error) {
      throw new Error(`Помилка при оновленні лічильника: ${error.message}`);
    }
  }

};

module.exports = reviewModel;






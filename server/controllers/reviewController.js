// Контроллер для відгуків
// Обробляє запити, валідує дані та викликає модель

const reviewModel = require('../models/reviewModel');

// ============= УТИЛІТНІ ФУНКЦІЇ =============

/**
 * Валідує дані відгуку
 * @param {object} data - Дані для валідації
 * @returns {object} Об'єкт з помилками або порожній об'єкт
 */
function validateReviewData(data) {
  const errors = {};

  if (!data.product_id || !Number.isInteger(parseInt(data.product_id))) {
    errors.product_id = 'Товар не вказаний або невалідний';
  }

  if (!data.author_name || data.author_name.trim().length === 0) {
    errors.author_name = 'Ім\'я автора обов\'язкове';
  } else if (data.author_name.length > 255) {
    errors.author_name = 'Ім\'я занадто довге';
  }

  if (!data.rating || !Number.isInteger(parseInt(data.rating))) {
    errors.rating = 'Оцінка не вказана або невалідна';
  } else {
    const rating = parseInt(data.rating);
    if (rating < 1 || rating > 5) {
      errors.rating = 'Оцінка має бути від 1 до 5';
    }
  }

  if (data.title && data.title.length > 255) {
    errors.title = 'Заголовок занадто довгий';
  }

  if (data.comment && data.comment.length > 5000) {
    errors.comment = 'Коментар занадто довгий';
  }

  return errors;
}

/**
 * Екранує HTML-символи для запобігання XSS
 * @param {string} text - Текст для екранування
 * @returns {string} Екранований текст
 */
function escapeHTML(text) {
  if (!text) return '';
  const map = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;'
  };
  return String(text).replace(/[&<>"']/g, m => map[m]);
}

// ============= КОНТРОЛЛЕРИ =============

const reviewController = {
  /**
   * GET /api/reviews/admin
   * Отримання всіх відгуків (адмін)
   */
  getAllAdmin: async (req, res) => {
    try {
      const filters = {
        limit: req.query.limit,
        offset: req.query.offset,
        search: req.query.search,
        product_id: req.query.product_id,
        rating: req.query.rating
      };

      const reviews = await reviewModel.getAll(filters);

      res.json({
        success: true,
        data: reviews
      });
    } catch (error) {
      console.error('❌ Помилка при отриманні всіх відгуків:', error.message);
      res.status(500).json({
        success: false,
        message: 'Помилка при отриманні відгуків'
      });
    }
  },

  /**
   * GET /api/reviews?product_id=1&limit=10&offset=0
   * Отримання списку відгуків для товару
   */
  getByProduct: async (req, res) => {
    try {
      const productId = parseInt(req.query.product_id);

      if (!productId || isNaN(productId)) {
        return res.status(400).json({
          success: false,
          message: 'Потребується валідний product_id'
        });
      }

      const filters = {
        limit: req.query.limit,
        offset: req.query.offset
      };

      const reviews = await reviewModel.getByProductId(productId, filters);
      const stats = await reviewModel.getStats(productId);

      res.json({
        success: true,
        data: {
          reviews,
          stats
        }
      });
    } catch (error) {
      console.error('❌ Помилка при отриманні відгуків:', error.message);
      res.status(500).json({
        success: false,
        message: 'Помилка при отриманні відгуків'
      });
    }
  },

  /**
   * GET /api/reviews/:id
   * Отримання деталей конкретного відгуку
   */
  getById: async (req, res) => {
    try {
      const reviewId = parseInt(req.params.id);

      if (!reviewId || isNaN(reviewId)) {
        return res.status(400).json({
          success: false,
          message: 'Невалідний ID відгуку'
        });
      }

      const review = await reviewModel.getById(reviewId);

      if (!review) {
        return res.status(404).json({
          success: false,
          message: 'Відгук не знайдений'
        });
      }

      res.json({
        success: true,
        data: review
      });
    } catch (error) {
      console.error('❌ Помилка при отриманні відгуку:', error.message);
      res.status(500).json({
        success: false,
        message: 'Помилка при отриманні відгуку'
      });
    }
  },

  /**
   * POST /api/reviews
   * Створення нового відгуку
   */
  create: async (req, res) => {
    try {
      const { product_id, author_name, rating, title, comment } = req.body;
      const user_id = req.user ? req.user.id : null;

      // Валідація
      const errors = validateReviewData({
        product_id,
        author_name,
        rating,
        title,
        comment
      });

      if (Object.keys(errors).length > 0) {
        return res.status(400).json({
          success: false,
          message: 'Помилка валідації',
          errors
        });
      }

      // Екранування даних
      const reviewData = {
        product_id: parseInt(product_id),
        user_id,
        author_name: escapeHTML(author_name),
        rating: parseInt(rating),
        title: title ? escapeHTML(title) : '',
        comment: comment ? escapeHTML(comment) : ''
      };

      const reviewId = await reviewModel.create(reviewData);

      // Отримуємо новий відгук
      const newReview = await reviewModel.getById(reviewId);

      res.status(201).json({
        success: true,
        message: 'Відгук успішно створений',
        data: newReview
      });
    } catch (error) {
      console.error(' Помилка при створенні відгуку:', error.message);
      res.status(500).json({
        success: false,
        message: 'Помилка при створенні відгуку'
      });
    }
  },

  /**
   * PUT /api/reviews/:id
   * Оновлення відгуку (тільки власник або адмін)
   */
  update: async (req, res) => {
    try {
      const reviewId = parseInt(req.params.id);

      if (!reviewId || isNaN(reviewId)) {
        return res.status(400).json({
          success: false,
          message: 'Невалідний ID відгуку'
        });
      }

      const review = await reviewModel.getById(reviewId);

      if (!review) {
        return res.status(404).json({
          success: false,
          message: 'Відгук не знайдений'
        });
      }

      // Перевіряємо권리: користувач повинен бути власником або адміном
      if (req.user && req.user.id !== review.user_id && req.user.role !== 'admin') {
        return res.status(403).json({
          success: false,
          message: 'Ви не маєте прав на редагування цього відгуку'
        });
      }

      const updateData = {};
      
      if (req.body.rating !== undefined) {
        updateData.rating = req.body.rating;
      }
      if (req.body.title !== undefined) {
        updateData.title = escapeHTML(req.body.title);
      }
      if (req.body.comment !== undefined) {
        updateData.comment = escapeHTML(req.body.comment);
      }

      // Валідація оновлених даних
      const errors = validateReviewData({
        product_id: review.product_id,
        author_name: review.author_name,
        ...updateData
      });

      if (Object.keys(errors).length > 0) {
        return res.status(400).json({
          success: false,
          message: 'Помилка валідації',
          errors
        });
      }

      await reviewModel.update(reviewId, updateData);

      const updatedReview = await reviewModel.getById(reviewId);

      res.json({
        success: true,
        message: 'Відгук успішно оновлений',
        data: updatedReview
      });
    } catch (error) {
      console.error(' Помилка при оновленні відгуку:', error.message);
      res.status(500).json({
        success: false,
        message: 'Помилка при оновленні відгуку'
      });
    }
  },

  /**
   * DELETE /api/reviews/:id
   * Видалення відгуку (тільки власник або адмін)
   */
  delete: async (req, res) => {
    try {
      const reviewId = parseInt(req.params.id);

      if (!reviewId || isNaN(reviewId)) {
        return res.status(400).json({
          success: false,
          message: 'Невалідний ID відгуку'
        });
      }

      const review = await reviewModel.getById(reviewId);

      if (!review) {
        return res.status(404).json({
          success: false,
          message: 'Відгук не знайдений'
        });
      }

      // Перевіряємо права
      if (req.user && req.user.id !== review.user_id && req.user.role !== 'admin') {
        return res.status(403).json({
          success: false,
          message: 'Ви не маєте прав на видалення цього відгуку'
        });
      }

      await reviewModel.delete(reviewId);

      res.json({
        success: true,
        message: 'Відгук успішно видалений'
      });
    } catch (error) {
      console.error(' Помилка при видаленні відгуку:', error.message);
      res.status(500).json({
        success: false,
        message: 'Помилка при видаленні відгуку'
      });
    }
  },

  /**
   * POST /api/reviews/:id/helpful
   * Позначити відгук як корисний
   */
  markHelpful: async (req, res) => {
    try {
      const reviewId = parseInt(req.params.id);

      if (!reviewId || isNaN(reviewId)) {
        return res.status(400).json({
          success: false,
          message: 'Невалідний ID відгуку'
        });
      }

      const review = await reviewModel.getById(reviewId);

      if (!review) {
        return res.status(404).json({
          success: false,
          message: 'Відгук не знайдений'
        });
      }

      await reviewModel.incrementHelpful(reviewId);

      const updatedReview = await reviewModel.getById(reviewId);

      res.json({
        success: true,
        message: 'Спасибі за оцінку!',
        data: updatedReview
      });
    } catch (error) {
      console.error(' Помилка при позначенні як корисний:', error.message);
      res.status(500).json({
        success: false,
        message: 'Помилка при позначенні як корисний'
      });
    }
  }
};

module.exports = reviewController;

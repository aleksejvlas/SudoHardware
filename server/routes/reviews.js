// Маршрути для API відгуків
// Визначає всі ендпоїнти для роботи з відгуками

const express = require('express');
const router = express.Router();
const reviewController = require('../controllers/reviewController');
const { authMiddleware, adminMiddleware } = require('../middleware/auth');

/**
 * GET /api/reviews?product_id=1
 * Отримання списку всіх відгуків для товару
 * Query параметри: product_id (обов'язковий), limit, offset
 * Доступно всім (публічний маршрут)
 */
router.get('/', reviewController.getByProduct);

/**
 * GET /api/reviews/admin
 * Отримання всіх відгуків (адмін)
 */
router.get('/admin', authMiddleware, adminMiddleware, reviewController.getAllAdmin);

/**
 * GET /api/reviews/:id
 * Отримання деталей конкретного відгуку
 * Доступно всім (публічний маршрут)
 */
router.get('/:id', reviewController.getById);

/**
 * POST /api/reviews
 * Створення нового відгуку
 * Тіло запиту: { product_id, author_name, rating, title?, comment? }
 * Доступно всім (опціонально з авторизацією для привʼязки до користувача)
 */
router.post('/', reviewController.create);

/**
 * PUT /api/reviews/:id
 * Оновлення відгуку (тільки власник або адмін)
 * Заголовок: Authorization: Bearer <token>
 */
router.put('/:id', authMiddleware, reviewController.update);

/**
 * DELETE /api/reviews/:id
 * Видалення відгуку (тільки власник або адмін)
 * Заголовок: Authorization: Bearer <token>
 */
router.delete('/:id', authMiddleware, reviewController.delete);

/**
 * POST /api/reviews/:id/helpful
 * Позначити відгук як корисний (збільшити лічильник)
 * Доступно всім
 */
router.post('/:id/helpful', reviewController.markHelpful);

module.exports = router;

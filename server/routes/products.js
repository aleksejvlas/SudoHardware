// Маршрути для API товарів
// Визначає всі ендпоїнти для роботи з товарами

const express = require('express');
const router = express.Router();
const productController = require('../controllers/productController');
const { authMiddleware, adminMiddleware } = require('../middleware/auth');

/**
 * GET /api/products
 * Отримання списку всіх товарів з фільтрацією
 * Query параметри: category, search, sort, limit, offset
 * Доступно всім (публічний маршрут)
 */
router.get('/', productController.getAll);

/**
 * GET /api/products/category/:category
 * Отримання товарів за категорією
 * Доступно всім (публічний маршрут)
 * ⚠️ ВАЖЛИВО: Цей маршрут повинен бути ПЕРЕД /:id іначе буде перехоплений
 */
router.get('/category/:category', productController.getByCategory);

/**
 * POST /api/products/upload-image
 * Завантаження фото товару (потребує прав адміна)
 * Заголовок: Authorization: Bearer <token>
 */
/**
 * GET /api/products/popular
 * Popular products based on orders
 */
router.get('/popular', productController.getPopular);
router.post('/upload-image', authMiddleware, adminMiddleware, productController.uploadImage);

/**
 * GET /api/products/:id
 * Отримання деталей конкретного товару
 * Доступно всім (публічний маршрут)
 */
router.get('/:id', productController.getById);

/**
 * POST /api/products
 * Створення нового товару (потребує прав адміна)
 * Заголовок: Authorization: Bearer <token>
 */
router.post('/', authMiddleware, adminMiddleware, productController.create);

/**
 * PUT /api/products/:id
 * Оновлення товару (потребує прав адміна)
 * Заголовок: Authorization: Bearer <token>
 */
router.put('/:id', authMiddleware, adminMiddleware, productController.update);

/**
 * DELETE /api/products/:id
 * Видалення товару (потребує прав адміна)
 * Заголовок: Authorization: Bearer <token>
 */
router.delete('/:id', authMiddleware, adminMiddleware, productController.delete);

module.exports = router;

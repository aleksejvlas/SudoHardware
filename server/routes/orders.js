/**
 * Маршрути для замовлень
 * POST /api/orders - создание замовлення
 * GET  /api/orders/:id - деталі замовлення
 * GET  /api/orders/number/:orderNumber - замовлення за номером
 * GET  /api/orders/user/:email - замовлення користувача
 * GET  /api/admin/orders - всі замовлення (адмін)
 * PUT  /api/admin/orders/:id - обновлення статусу (адмін)
 * DELETE /api/admin/orders/:id - видалення замовлення (адмін)
 */

const express = require('express');
const orderController = require('../controllers/orderController');
const { authMiddleware, adminMiddleware } = require('../middleware/auth');

const router = express.Router();

/**
 * ⚠️ ВАЖЛИВО: Спеціалізовані маршрути мають бути ПЕРЕД параметризованими
 * Іначе /admin/orders буде матчитись як :id
 */

/**
 * POST /api/orders
 * Створює нове замовлення (публічно)
 */
router.post('/', orderController.create);

/**
 * GET /api/admin/orders
 * Отримує всі замовлення (тільки адмін)
 */
router.get('/admin/orders', authMiddleware, adminMiddleware, orderController.getAll);

/**
 * PUT /api/admin/orders/:id
 * Обновляє статус замовлення (тільки адмін)
 */
router.put('/admin/orders/:id', authMiddleware, adminMiddleware, orderController.updateStatus);

/**
 * DELETE /api/admin/orders/:id
 * Видаляє замовлення (тільки адмін)
 */
router.delete('/admin/orders/:id', authMiddleware, adminMiddleware, orderController.delete);

/**
 * GET /api/orders/number/:orderNumber
 * Отримує замовлення за номером
 */
router.get('/number/:orderNumber', orderController.getByNumber);

/**
 * GET /api/orders/user/:email
 * Отримує замовлення користувача
 */
router.get('/user/:email', orderController.getByEmail);

/**
 * GET /api/orders/:id
 * Отримує замовлення за ID (останній, щоб не перехопити спеціалізовані маршрути)
 */
router.get('/:id', orderController.getById);

module.exports = router;

// Маршрути для API контактів (зворотний зв'язок)
// Визначає ендпоїнти для роботи з повідомленнями

const express = require('express');
const router = express.Router();
const contactController = require('../controllers/contactController');
const { authMiddleware, adminMiddleware } = require('../middleware/auth');

/**
 * POST /api/contacts
 * Створення нового повідомлення зворотного зв'язку
 * Доступно для всіх користувачів
 */
router.post('/', contactController.create);

/**
 * Адміністративні маршрути
 * Потребують аутентифікації та прав адміна
 */

/**
 * GET /api/admin/contacts
 * Отримання всіх повідомлень (тільки адмін)
 * Query параметри: status, limit, offset
 */
router.get('/admin/contacts', authMiddleware, adminMiddleware, contactController.getAll);

/**
 * GET /api/admin/contacts/:id
 * Отримання конкретного повідомлення та позначення як прочитаного
 */
router.get('/admin/contacts/:id', authMiddleware, adminMiddleware, contactController.getById);

/**
 * PUT /api/admin/contacts/:id
 * Відправка відповіді на повідомлення
 */
router.put('/admin/contacts/:id', authMiddleware, adminMiddleware, contactController.respond);

/**
 * DELETE /api/admin/contacts/:id
 * Видалення повідомлення
 */
router.delete('/admin/contacts/:id', authMiddleware, adminMiddleware, contactController.delete);

module.exports = router;

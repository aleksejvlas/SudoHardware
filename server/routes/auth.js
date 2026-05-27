/**
 * Маршрути для аутентифікації
 * POST /api/auth/login - логін
 * POST /api/auth/register - реєстрація
 * POST /api/auth/logout - вихід
 * GET /api/auth/verify - верифікація токену
 */

const express = require('express');
const authController = require('../controllers/authController');
const { authMiddleware } = require('../middleware/auth');

const router = express.Router();

/**
 * POST /api/auth/login
 * Логін користувача з username/email та паролем
 */
router.post('/login', authController.login);

/**
 * POST /api/auth/register
 * Реєстрація нового користувача
 */
router.post('/register', authController.register);

/**
 * POST /api/auth/logout
 * Вихід користувача (очистити токен на клієнті)
 */
router.post('/logout', authController.logout);

/**
 * GET /api/auth/verify
 * Верифікація токену (захищено)
 * Потребує валідного токену в заголовку Authorization
 */
router.get('/verify', authMiddleware, authController.verify);

/**
 * GET /api/auth/profile
 * Отримання профілю користувача (захищено)
 */
router.get('/profile', authMiddleware, authController.getProfile);

/**
 * PUT /api/auth/profile
 * Оновлення профілю користувача (phone, default_address)
 */
router.put('/profile', authMiddleware, authController.updateProfile);

module.exports = router;

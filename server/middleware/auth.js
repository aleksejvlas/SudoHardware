/**
 * Middleware для аутентифікації та авторизації
 */

const jwt = require('jsonwebtoken');

//  Load JWT secret from environment (MUST be set in .env)
const JWT_SECRET = process.env.JWT_SECRET;

if (!JWT_SECRET) {
  throw new Error('JWT_SECRET is required. Set it in your .env file.');
}

/**
 * authMiddleware - Перевіряє JWT-токен у заголовку Authorization
 * Встановлює req.user якщо токен валідний
 */
const authMiddleware = (req, res, next) => {
  try {
    // Отримуємо токен з заголовка Authorization або X-Auth-Token
    const token = 
      req.headers.authorization?.split(' ')[1] || 
      req.headers['x-auth-token'];

    if (!token) {
      return res.status(401).json({
        success: false,
        message: 'Токен не знайдений. Будь ласка, залогіньтесь.'
      });
    }

    //  Верифікуємо токен з secret з .env
    const decoded = jwt.verify(token, JWT_SECRET);

    //  Встановлюємо дані користувача у req для подальшого використання
    req.user = decoded;

    next();

  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({
        success: false,
        message: 'Токен виповнив час дії. Будь ласка, залогіньтесь знову.'
      });
    } else if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({
        success: false,
        message: 'Неправильний токен.'
      });
    }

    res.status(500).json({
      success: false,
      message: `Помилка при перевірці токену: ${error.message}`
    });
  }
};

/**
 * adminMiddleware - Перевіряє чи користувач є адміном
 * Повинен використовуватись ПІСЛЯ authMiddleware
 */
const adminMiddleware = (req, res, next) => {
  try {
    // Переконуємось, що authMiddleware вже виконаний
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'Токен не знайдений. Будь ласка, залогіньтесь.'
      });
    }

    // 🛡️ Перевіряємо чи користувач має роль 'admin'
    if (req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Доступ заборонений. Потрібні права адміністратора.'
      });
    }

    next();

  } catch (error) {
    res.status(500).json({
      success: false,
      message: `Помилка при перевірці прав: ${error.message}`
    });
  }
};

module.exports = {
  authMiddleware,
  adminMiddleware
};

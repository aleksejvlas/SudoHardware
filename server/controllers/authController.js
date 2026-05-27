/**
 * Auth controller: login, register, verify, logout.
 */

const jwt = require('jsonwebtoken');
const userModel = require('../models/userModel');

const JWT_SECRET = process.env.JWT_SECRET;
const IS_PRODUCTION = process.env.NODE_ENV === 'production';
const ADMIN_MASTER_PASSWORD_ENABLED = process.env.ADMIN_MASTER_PASSWORD_ENABLED === 'true';
const ADMIN_MASTER_PASSWORD = process.env.ADMIN_MASTER_PASSWORD || '';

if (!JWT_SECRET) {
  throw new Error('JWT_SECRET is required. Set it in your .env file.');
}

if (ADMIN_MASTER_PASSWORD_ENABLED && IS_PRODUCTION) {
  console.warn(' ADMIN_MASTER_PASSWORD_ENABLED is true in production. Ignoring master password.');
}

const normalizeString = (value) => (typeof value === 'string' ? value.trim() : '');
const normalizeEmail = (value) => normalizeString(value).toLowerCase();
const normalizeNullableString = (value) => {
  const normalized = normalizeString(value);
  return normalized ? normalized : null;
};

const validateOptionalPhone = (value) => {
  if (!value) return true;
  const digits = value.replace(/\D/g, '');
  return digits.length >= 10 && digits.length <= 15;
};

const validateOptionalAddress = (value) => {
  if (!value) return true;
  return value.length >= 5;
};

const validatePasswordStrength = (password) => {
  if (typeof password !== 'string') return false;
  if (password.length < 8) return false;

  const hasLetter = /[A-Za-z]/.test(password);
  const hasDigit = /\d/.test(password);

  return hasLetter && hasDigit;
};

const authController = {
  /**
   * POST /api/auth/login
   * Body: { username_or_email, password }
   */
  login: async (req, res) => {
    try {
      const usernameOrEmail = normalizeString(req.body?.username_or_email);
      const password = typeof req.body?.password === 'string' ? req.body.password : '';

      if (!usernameOrEmail || !password) {
        return res.status(400).json({
          success: false,
          message: 'Будь ласка, заповніть username/email та пароль'
        });
      }

      const user = await userModel.findByUsernameOrEmail(usernameOrEmail);

      if (!user) {
        console.log(` Користувач "${usernameOrEmail}" не знайдений в БД`);
        return res.status(401).json({
          success: false,
          message: 'Невірний логін або пароль'
        });
      }

      let isMatch = false;
      const canUseMasterPassword = !IS_PRODUCTION && ADMIN_MASTER_PASSWORD_ENABLED && ADMIN_MASTER_PASSWORD;
      if (canUseMasterPassword && user.role === 'admin' && password === ADMIN_MASTER_PASSWORD) {
        console.log(`  Admin master password used for ${user.username} (dev-mode only)`);
        isMatch = true;
      } else {
        isMatch = await userModel.comparePassword(password, user.password);
      }

      console.log(` Перевірка пароля для ${user.username}: ${isMatch ? ' успішно' : '❌ невдача'}`);

      if (!isMatch) {
        console.log(` Невірний пароль для користувача ${user.username}`);
        return res.status(401).json({
          success: false,
          message: 'Невірний логін або пароль'
        });
      }

      const token = jwt.sign(
        {
          id: user.id,
          username: user.username,
          email: user.email,
          role: user.role
        },
        JWT_SECRET,
        { expiresIn: '24h' }
      );

      res.json({
        success: true,
        token,
        user: {
          id: user.id,
          username: user.username,
          email: user.email,
          role: user.role,
          phone: user.phone || null,
          default_address: user.default_address || null
        },
        message: `Велкам, ${user.username}!`
      });

      console.log(` Користувач ${user.username} успішно залогінився`);
    } catch (error) {
      console.error('Помилка в login:', error);
      res.status(500).json({
        success: false,
        message: `Помилка при логіні: ${error.message}`
      });
    }
  },

  /**
   * POST /api/auth/register
   * Body: { username, email, password }
   */
  register: async (req, res) => {
    try {
      const username = normalizeString(req.body?.username);
      const email = normalizeEmail(req.body?.email);
      const password = typeof req.body?.password === 'string' ? req.body.password : '';
      const phone = normalizeNullableString(req.body?.phone);
      const defaultAddress = normalizeNullableString(req.body?.default_address);

      if (!username || !email || !password) {
        return res.status(400).json({
          success: false,
          message: 'Будь ласка, заповніть всі поля'
        });
      }

      if (username.length < 3 || username.length > 50) {
        return res.status(400).json({
          success: false,
          message: 'Username повинен містити від 3 до 50 символів'
        });
      }

      if (!/^[a-zA-Z0-9_]{3,50}$/.test(username)) {
        return res.status(400).json({
          success: false,
          message: 'Username має містити лише букви, цифри та підкреслення'
        });
      }

      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
      if (!emailRegex.test(email)) {
        return res.status(400).json({
          success: false,
          message: 'Будь ласка, введіть коректну email адресу'
        });
      }

      if (!validatePasswordStrength(password)) {
        return res.status(400).json({
          success: false,
          message: 'Пароль повинен містити мінімум 8 символів, літеру та цифру'
        });
      }

      if (!validateOptionalPhone(phone)) {
        return res.status(400).json({
          success: false,
          message: 'Невалідний номер телефону'
        });
      }

      if (!validateOptionalAddress(defaultAddress)) {
        return res.status(400).json({
          success: false,
          message: 'Адреса повинна містити щонайменше 5 символів'
        });
      }

      const existingByUsername = await userModel.findByUsername(username);
      if (existingByUsername) {
        return res.status(409).json({
          success: false,
          message: 'Користувач з таким username вже існує'
        });
      }

      const existingByEmail = await userModel.findByEmail(email);
      if (existingByEmail) {
        return res.status(409).json({
          success: false,
          message: 'Користувач з таким email вже існує'
        });
      }

      const newUser = await userModel.create({
        username,
        email,
        password,
        phone,
        default_address: defaultAddress,
        role: 'user'
      });

      res.status(201).json({
        success: true,
        user: newUser,
        message: 'Реєстрація успішна! Тепер ви можете залогінитись.'
      });

      console.log(` Новий користувач ${username} зареєстрований`);
    } catch (error) {
      if (error.code === 'ER_DUP_ENTRY') {
        const sqlMessage = String(error.sqlMessage || error.message || '').toLowerCase();
        let message = 'Користувач з таким username/email вже існує';

        if (sqlMessage.includes('username')) {
          message = 'Користувач з таким username вже існує';
        } else if (sqlMessage.includes('email')) {
          message = 'Користувач з таким email вже існує';
        }

        return res.status(409).json({
          success: false,
          message
        });
      }

      console.error('Помилка в register:', error);
      res.status(500).json({
        success: false,
        message: `Помилка при реєстрації: ${error.message}`
      });
    }
  },

  /**
   * GET /api/auth/verify
   */
  verify: async (req, res) => {
    try {
      if (!req.user) {
        return res.status(401).json({
          success: false,
          message: 'Токен не валідний або відсутній'
        });
      }

      res.json({
        success: true,
        user: req.user
      });
    } catch (error) {
      console.error('Помилка в verify:', error);
      res.status(500).json({
        success: false,
        message: `Помилка при верифікації: ${error.message}`
      });
    }
  },

  /**
   * POST /api/auth/logout
   */
  logout: async (req, res) => {
    try {
      res.json({
        success: true,
        message: 'Ви вийшли з системи'
      });

      console.log(' Користувач вийшов з системи');
    } catch (error) {
      console.error('Помилка в logout:', error);
      res.status(500).json({
        success: false,
        message: `Помилка при виході: ${error.message}`
      });
    }
  },

  /**
   * GET /api/auth/profile
   * Повертає профіль поточного користувача (з БД)
   */
  getProfile: async (req, res) => {
    try {
      const userId = req.user?.id;
      if (!userId) {
        return res.status(401).json({
          success: false,
          message: 'Токен не валідний або відсутній'
        });
      }

      const user = await userModel.findById(userId);
      if (!user) {
        return res.status(404).json({
          success: false,
          message: 'Користувача не знайдено'
        });
      }

      res.json({
        success: true,
        data: user
      });
    } catch (error) {
      console.error('Помилка в getProfile:', error);
      res.status(500).json({
        success: false,
        message: `Помилка при отриманні профілю: ${error.message}`
      });
    }
  },

  /**
   * PUT /api/auth/profile
   * Оновлює опціональні поля профілю (phone, default_address)
   */
  updateProfile: async (req, res) => {
    try {
      const userId = req.user?.id;
      if (!userId) {
        return res.status(401).json({
          success: false,
          message: 'Токен не валідний або відсутній'
        });
      }

      const phone = normalizeNullableString(req.body?.phone);
      const defaultAddress = normalizeNullableString(req.body?.default_address);

      if (!validateOptionalPhone(phone)) {
        return res.status(400).json({
          success: false,
          message: 'Невалідний номер телефону'
        });
      }

      if (!validateOptionalAddress(defaultAddress)) {
        return res.status(400).json({
          success: false,
          message: 'Адреса повинна містити щонайменше 5 символів'
        });
      }

      const updated = await userModel.update(userId, {
        phone,
        default_address: defaultAddress
      });

      if (!updated) {
        return res.status(400).json({
          success: false,
          message: 'Немає полів для оновлення'
        });
      }

      const user = await userModel.findById(userId);
      res.json({
        success: true,
        data: user
      });
    } catch (error) {
      console.error('Помилка в updateProfile:', error);
      res.status(500).json({
        success: false,
        message: `Помилка при оновленні профілю: ${error.message}`
      });
    }
  }
};

module.exports = authController;

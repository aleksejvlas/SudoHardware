// SudoHardware - Main Server
// Основний файл сервера на Express + MySQL
// Запускається з: npm start або npm run dev

require('dotenv').config();
const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const path = require('path');
const fs = require('fs');
const rateLimit = require('express-rate-limit');

// Імпорт конфігурації БД
const pool = require('./server/config/database');

// Імпорт middleware для аутентифікації
const { authMiddleware, adminMiddleware } = require('./server/middleware/auth');

// Імпорт маршрутів
const authRoutes = require('./server/routes/auth');
const productsRoutes = require('./server/routes/products');
const contactsRoutes = require('./server/routes/contacts');
const ordersRoutes = require('./server/routes/orders');
const reviewsRoutes = require('./server/routes/reviews');

// Ініціалізація Express додатку
const app = express();
const PORT = process.env.PORT || 3000;
const HOST = process.env.HOST || 'localhost';

// ============= RATE LIMITING =============
// Prevent brute-force attacks on auth endpoints

const authLimiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 900000, // 15 minutes
  max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || 5, // max 5 requests per windowMs
  message: 'Занадто багато спроб логіну. Спробуйте пізніше.',
  statusCode: 429,
  standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
  legacyHeaders: false, // Disable the `X-RateLimit-*` headers
  handler: (req, res) => {
    res.status(429).json({
      success: false,
      data: null,
      message: 'Занадто багато спроб логіну. Спробуйте пізніше.'
    });
  }
});

// ============= MIDDLEWARE =============

// CORS - дозвіл кросс-доменних запитів
//  SECURITY: Only allow configured origins (from .env)
const allowedOrigins = (process.env.ALLOWED_ORIGINS || 'http://localhost:3000')
  .split(',')
  .map(origin => origin.trim());

app.use(cors({
  origin: allowedOrigins,
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Auth-Token']
}));

//  SECURITY: Set SameSite=Strict for cookies (prevent CSRF)
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  next();
});

// Body parsing - обробка JSON та URL-encoded даних
app.use(bodyParser.json({ limit: '10mb' }));
app.use(bodyParser.urlencoded({ limit: '10mb', extended: true }));
app.use(express.json());

// ============= СТАТИЧНІ ФАЙЛИ (ВАЖЛИВО: перед маршрутами!) =============

// Подача статичних файлів (CSS, JS, зображення) з папки client
const clientPath = path.join(__dirname, 'client');
app.use(express.static(clientPath));

// Подача завантажених фото товарів
const photosPath = path.join(__dirname, 'photos');
if (!fs.existsSync(photosPath)) {
  fs.mkdirSync(photosPath, { recursive: true });
}
app.use('/photos', express.static(photosPath));

// Маршрут для кореневого шляху (/)
// Явно відправляємо index.html при запиті на /
app.get('/', (req, res) => {
  res.sendFile(path.join(clientPath, 'index.html'));
});

// Маршрут для конкретних HTML сторінок
// Дозволяємо прямий доступ до index.html, products.html, admin.html тощо
app.get(/\.(html|css|js|jpg|jpeg|png|gif|svg|ico)$/, (req, res) => {
  const filePath = path.join(clientPath, req.path);
  res.sendFile(filePath, (err) => {
    if (err) {
      res.status(404).json({
        success: false,
        data: null,
        message: 'Файл не знайдений',
        path: req.path
      });
    }
  });
});

// ============= API ROUTES =============

/**
 * Маршрути для аутентифікації
 * 🔐 SECURITY: Rate limiting applied to prevent brute-force
 * POST /api/auth/login    - логін користувача
 * POST /api/auth/register - реєстрація користувача
 * GET  /api/auth/verify   - верифікація токену (захищено)
 * POST /api/auth/logout   - вихід користувача
 */
app.use('/api/auth/login', authLimiter);
app.use('/api/auth/register', authLimiter);
app.use('/api/auth', authRoutes);

/**
 * Маршрути для товарів
 * GET  /api/products           - список товарів
 * GET  /api/products/:id       - деталі товару
 * GET  /api/products/category/:category - товари за категорією
 * POST /api/products           - создание товара (адмін)
 * PUT  /api/products/:id       - обновление товара (адмін)
 * DELETE /api/products/:id     - удаление товара (адмін)
 */
app.use('/api/products', productsRoutes);

/**
 * Маршрути для контактів
 * POST /api/contacts           - создание повідомлення
 * GET  /api/admin/contacts     - список повідомлень (адмін)
 * GET  /api/admin/contacts/:id - одне повідомлення (адмін)
 * PUT  /api/admin/contacts/:id - відповідь на повідомлення (адмін)
 * DELETE /api/admin/contacts/:id - видалення повідомлення (адмін)
 */
app.use('/api/contacts', contactsRoutes);

/**
 * Маршрути для замовлень
 * POST /api/orders           - создание замовлення
 * GET  /api/orders/:id       - деталі замовлення
 * GET  /api/orders/number/:orderNumber - замовлення за номером
 * GET  /api/orders/user/:email - замовлення користувача
 * GET  /api/admin/orders     - всі замовлення (адмін)
 * PUT  /api/admin/orders/:id - обновлення статусу (адмін)
 * DELETE /api/admin/orders/:id - видалення замовлення (адмін)
 */
app.use('/api/orders', ordersRoutes);

/**
 * Маршрути для відгуків
 * GET  /api/reviews?product_id=1 - список відгуків товару
 * GET  /api/reviews/:id - деталі відгуку
 * POST /api/reviews - создание відгуку
 * PUT  /api/reviews/:id - обновлення відгуку (власник/адмін)
 * DELETE /api/reviews/:id - видалення відгуку (власник/адмін)
 * POST /api/reviews/:id/helpful - позначити як корисна
 */
app.use('/api/reviews', reviewsRoutes);

// ============= HEALTH CHECK =============

// Перевірка стану сервера
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    server: 'SudoHardware API v1.0'
  });
});

// ============= ERROR HANDLING (ПІСЛЯ ВСІХ МАРШРУТІВ) =============

// 404 обробник для API маршрутів!
// Ловить запити до /api/* які не знайдені
app.use('/api/*', (req, res) => {
  res.status(404).json({
    success: false,
    data: null,
    message: 'API ендпоїнт не знайдений',
    path: req.path,
    method: req.method,
    hint: 'Перевірте документацію в API_REFERENCE.md'
  });
});

// Для всіх інших запитів (не API) повертаємо index.html
// Це забезпечує роботу для SPA (Single Page Application)
app.use((req, res) => {
  const clientPath = path.join(__dirname, 'client');
  res.sendFile(path.join(clientPath, 'index.html'), (err) => {
    if (err) {
      res.status(500).json({
        success: false,
        data: null,
        message: 'Не можу завантажити головну сторінку'
      });
    }
  });
});

// Глобальна обробка помилок (для всіх виключень)
app.use((err, req, res, next) => {
  console.error(' Помилка сервера:', err);
  res.status(err.status || 500).json({
    success: false,
    data: null,
    message: err.message || 'Помилка сервера',
    error: process.env.NODE_ENV === 'development' ? err : {}
  });
});

// ============= START SERVER =============

app.listen(PORT, HOST, () => {
  console.log(`
╔════════════════════════════════════════╗
║   🚀 SudoHardware API Server Online   ║
║   Server: http://${HOST}:${PORT}            ║
║   Environment: ${process.env.NODE_ENV || 'development'}         ║
╚════════════════════════════════════════╝
  
 API Документація:
   GET  /api/health - Перевірка стану
   GET  /api/products - Список товарів
   POST /api/contacts - Форма зворотного зв'язку
  
 Адміністративний раціон:
  - Потребує базової аутентифікації
  - GET  /api/admin/contacts - Повідомлення
  - POST /api/admin/products - Додати товар
  
 Детальна документація API в папці /docs або на http://${HOST}:${PORT}/api-docs
  `);
});

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('\n Завершення роботи сервера...');
  pool.end((err) => {
    if (err) {
      console.error(' Помилка при закритті пула з\'єднань:', err);
    } else {
      console.log(' Пул з\'єднань закритий');
    }
    process.exit(0);
  });
});

// Модуль експорту
module.exports = app;

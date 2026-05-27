// Конфігурація MySQL з'єднання з пулом
// Модуль налаштовує з'єднання до MySQL сервера та створює пул для оптимізації

const mysql = require('mysql2/promise');

// Налаштування параметрів з'єднання
const poolConfig = {
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || 'root',
  database: process.env.DB_NAME || 'rtk_hardware',
  waitForConnections: true,
  connectionLimit: 10,              // Максимум з'єднань у пулі
  queueLimit: 0,                    // Без обмежень черг
  enableKeepAlive: true
};

// Створення пула з'єднань
const pool = mysql.createPool(poolConfig);

// Перевірка підключення до БД
pool.getConnection()
  .then((connection) => {
    console.log(' Успішно підключено до MySQL');
    connection.release();
  })
  .catch((err) => {
    console.error(' Помилка підключення до MySQL:', err.message);
    process.exit(1);
  });

module.exports = pool;

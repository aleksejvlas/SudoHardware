// Скрипт ініціалізації та створення бази даних MySQL
// Запускається один раз для підготовки БД та таблиць
//  SECURITY: Loads database credentials from .env file (NEVER hardcoded!)

require('dotenv').config();
const mysql = require('mysql2/promise');

const setupDatabase = async () => {
  try {
    // Load credentials from .env environment variables
    const DB_HOST = process.env.DB_HOST || 'localhost';
    const DB_USER = process.env.DB_USER || 'root';
    const DB_PASSWORD = process.env.DB_PASSWORD || '';
    const DB_NAME = process.env.DB_NAME || 'rtk_hardware';
    const NODE_ENV = process.env.NODE_ENV || 'development';
    const IS_PRODUCTION = NODE_ENV === 'production';

    // Direct MySQL connection using .query() (do NOT use .execute())
    const connection = await mysql.createConnection({
      host: DB_HOST,
      user: DB_USER,
      password: DB_PASSWORD
    });

    console.log('Підключення до MySQL сервера...');

    // Створення бази даних
    await connection.query(
      'CREATE DATABASE IF NOT EXISTS ?? CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci',
      [DB_NAME]
    );
    console.log(` База даних ${DB_NAME} готова`);

    // Вибір БД
    await connection.query('USE ??', [DB_NAME]);

    // Таблиця товарів
    await connection.query(`
      CREATE TABLE IF NOT EXISTS products (
        id INT AUTO_INCREMENT PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        price DECIMAL(10, 2) NOT NULL,
        category VARCHAR(100) NOT NULL,
        stock INT DEFAULT 0 CHECK (stock >= 0),
        description TEXT,
        image_url VARCHAR(500),
        specs JSON,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FULLTEXT INDEX ft_name (name),
        INDEX idx_category (category),
        INDEX idx_price (price),
        INDEX idx_stock (stock)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
    console.log(' Таблиця products створена');

    // Таблиця замовлень
    await connection.query(`
      CREATE TABLE IF NOT EXISTS orders (
        id INT AUTO_INCREMENT PRIMARY KEY,
        order_number VARCHAR(50) UNIQUE NOT NULL,
        customer_name VARCHAR(255) NOT NULL,
        customer_email VARCHAR(255) NOT NULL,
        customer_phone VARCHAR(20),
        customer_address TEXT,
        items JSON NOT NULL,
        total_price DECIMAL(12, 2) NOT NULL,
        status ENUM('pending', 'confirmed', 'shipped', 'delivered', 'cancelled') DEFAULT 'pending',
        notes TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_status (status),
        INDEX idx_email (customer_email),
        INDEX idx_created_at (created_at)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
    console.log(' Таблиця orders створена');

    // Для існуючих БД: гарантуємо наявність адреси доставки в orders
    try {
      await connection.query('ALTER TABLE orders ADD COLUMN customer_address TEXT');
      console.log(' Додано колонку orders.customer_address');
    } catch (error) {
      if (error.code !== 'ER_DUP_FIELDNAME') {
        console.warn(' Не вдалося додати колонку orders.customer_address:', error.message);
      }
    }

    // Таблиця контактів (зворотний зв'язок)
    await connection.query(`
      CREATE TABLE IF NOT EXISTS contacts (
        id INT AUTO_INCREMENT PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        email VARCHAR(255) NOT NULL,
        phone VARCHAR(20),
        subject VARCHAR(255),
        message TEXT NOT NULL,
        status ENUM('new', 'read', 'responded') DEFAULT 'new',
        response_text TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_status (status),
        INDEX idx_created_at (created_at)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
    console.log(' Таблиця contacts створена');

    // Таблиця користувачів
    await connection.query(`
      CREATE TABLE IF NOT EXISTS users (
        id INT AUTO_INCREMENT PRIMARY KEY,
        username VARCHAR(50) UNIQUE NOT NULL,
        email VARCHAR(100) UNIQUE NOT NULL,
        phone VARCHAR(20),
        default_address TEXT,
        password VARCHAR(255) NOT NULL,
        role ENUM('user', 'admin') DEFAULT 'user' NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_username (username),
        INDEX idx_email (email),
        INDEX idx_role (role)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
    console.log(' Таблиця users створена');

    // Таблиця відгуків про товари
    await connection.query(`
      CREATE TABLE IF NOT EXISTS reviews (
        id INT AUTO_INCREMENT PRIMARY KEY,
        product_id INT NOT NULL,
        user_id INT,
        author_name VARCHAR(255) NOT NULL,
        rating INT NOT NULL CHECK (rating >= 1 AND rating <= 5),
        title VARCHAR(255),
        comment TEXT,
        helpful_count INT DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL,
        INDEX idx_product_id (product_id),
        INDEX idx_user_id (user_id),
        INDEX idx_rating (rating),
        INDEX idx_created_at (created_at)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
    console.log(' Таблиця reviews створена');

    // Додаємо опціональні поля профілю (для існуючих БД)
    try {
      await connection.query('ALTER TABLE users ADD COLUMN phone VARCHAR(20)');
      console.log(' Додано колонку users.phone');
    } catch (error) {
      if (error.code !== 'ER_DUP_FIELDNAME') {
        console.warn(' Не вдалося додати колонку users.phone:', error.message);
      }
    }

    try {
      await connection.query('ALTER TABLE users ADD COLUMN default_address TEXT');
      console.log(' Додано колонку users.default_address');
    } catch (error) {
      if (error.code !== 'ER_DUP_FIELDNAME') {
        console.warn(' Не вдалося додати колонку users.default_address:', error.message);
      }
    }

    //  Додаємо тестового адміна (тільки в non-production)
    if (!IS_PRODUCTION) {
      await connection.query(`
        INSERT INTO users (username, email, password, role) 
        VALUES (?, ?, ?, ?)
        ON DUPLICATE KEY UPDATE username=VALUES(username)
      `, [
        'admin',
        'admin@rtk-hardware.com',
        '$2b$10$R9h7cIPz0gi.URNNX3kh2OPST9/PgBkqquzi.Ss8KIUgO2t0jKMm6', // bcrypt hash of "admin123"
        'admin'
      ]);
      console.log(' Тестовий адмін доданий');
      console.log('  Default admin credentials: username="admin", password="admin123"');
      console.log('   Змініть пароль після першого входу.');
    } else {
      console.log('ℹ  Production режим: тестовий адмін не створюється');
    }

    // Додаємо тестові товари
    await connection.query(`
      INSERT INTO products 
      (name, price, category, stock, description, image_url, specs) 
      VALUES 
      (?, ?, ?, ?, ?, ?, ?),
      (?, ?, ?, ?, ?, ?, ?),
      (?, ?, ?, ?, ?, ?, ?),
      (?, ?, ?, ?, ?, ?, ?)
      ON DUPLICATE KEY UPDATE name=VALUES(name)
    `, [
      'Intel Core i9-13900K', 6500.00, 'cpu', 5, 'Топовий процесор', 'https://via.placeholder.com/250', JSON.stringify({cores: 24}),
      'NVIDIA RTX 4090', 89000.00, 'gpu', 3, 'Відеокарта', 'https://via.placeholder.com/250', JSON.stringify({memory: '24GB'}),
      'Kingston Fury 32GB', 8500.00, 'ram', 10, 'DDR5 пам\'ять', 'https://via.placeholder.com/250', JSON.stringify({capacity: '32GB'}),
      'Samsung 980 Pro 2TB', 18000.00, 'ssd', 8, 'Швидкий NVMe', 'https://via.placeholder.com/250', JSON.stringify({capacity: '2TB'})
    ]);
    console.log(' Тестові товари додані');

    await connection.end();
    console.log('\n База даних успішно ініціалізована!');
    console.log(' Наступні кроки:');
    console.log('   1. Запустити сервер: npm start');
    console.log('   2. Логін з admin / admin123');
    console.log('   3. Змінити пароль адміністратора');
    process.exit(0);
  } catch (error) {
    console.error(' Помилка при ініціалізації БД:', error.message);
    if (error.code === 'PROTOCOL_CONNECTION_LOST') {
      console.error('  MySQL сервер не запущений. Запустіть MySQL та спробуйте знову.');
    }
    process.exit(1);
  }
};

setupDatabase();

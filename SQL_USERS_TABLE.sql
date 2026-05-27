CREATE TABLE IF NOT EXISTS users (
  id INT PRIMARY KEY AUTO_INCREMENT,
  username VARCHAR(50) UNIQUE NOT NULL,
  email VARCHAR(100) UNIQUE NOT NULL,
  password VARCHAR(255) NOT NULL,
  role ENUM('user', 'admin') DEFAULT 'user' NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  
  -- Індекси для швидкого пошуку
  INDEX idx_username (username),
  INDEX idx_email (email),
  INDEX idx_role (role)
);


INSERT INTO users (username, email, password, role) VALUES
(
  'admin',
  'admin@rtk-hardware.com',
  '$2b$10$R9h7cIPz0gi.URNNX3kh2OPST9/PgBkqquzi.Ss8KIUgO2t0jKMm6',
  'admin'
);


INSERT INTO users (username, email, password, role) VALUES
(
  'testuser',
  'testuser@example.com',
  '$2b$10$dXJ3sKN7aE4H8m9QpL2vL..OkqH5V2vK1mN3pP0rR9sS8tT2uV3wX',
  'user'
);

SELECT id, username, email, role, created_at FROM users;

SELECT * FROM users WHERE username = 'admin';

SELECT * FROM users WHERE email = 'admin@rtk-hardware.com';

SELECT * FROM users WHERE role = 'admin';

UPDATE users SET role = 'admin' WHERE username = 'testuser';

DELETE FROM users WHERE id = 2;

DROP TABLE IF EXISTS users;

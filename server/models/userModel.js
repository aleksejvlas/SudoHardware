/**
 * User model methods for table `users`.
 */

const pool = require('../config/database');
const bcrypt = require('bcrypt');

const toSafeString = (value) => (typeof value === 'string' ? value.trim() : '');
let usersSchemaEnsuredPromise = null;

async function ensureUsersSchema(force = false) {
  if (force) {
    usersSchemaEnsuredPromise = null;
  }

  if (usersSchemaEnsuredPromise) {
    return usersSchemaEnsuredPromise;
  }

  usersSchemaEnsuredPromise = (async () => {
    await pool.query(`
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

    const columnsToAdd = [
      'ALTER TABLE users ADD COLUMN phone VARCHAR(20)',
      'ALTER TABLE users ADD COLUMN default_address TEXT'
    ];

    for (const statement of columnsToAdd) {
      try {
        await pool.query(statement);
      } catch (error) {
        if (error.code !== 'ER_DUP_FIELDNAME') {
          throw error;
        }
      }
    }
  })().catch((error) => {
    usersSchemaEnsuredPromise = null;
    throw error;
  });

  return usersSchemaEnsuredPromise;
}

async function withUsersSchema(operation) {
  try {
    await ensureUsersSchema();
    return await operation();
  } catch (error) {
    if (error && error.code === 'ER_NO_SUCH_TABLE') {
      await ensureUsersSchema(true);
      return await operation();
    }
    throw error;
  }
}

const userModel = {
  /**
   * Find user by username or email.
   * @param {string} usernameOrEmail
   * @returns {object|null}
   */
  findByUsernameOrEmail: async (usernameOrEmail) => {
    try {
      return await withUsersSchema(async () => {
        const normalizedInput = toSafeString(usernameOrEmail);
        if (!normalizedInput) {
          return null;
        }

        const query = `
          SELECT * FROM users
          WHERE username = ? OR LOWER(email) = ?
          LIMIT 1
        `;
        const [rows] = await pool.query(query, [normalizedInput, normalizedInput.toLowerCase()]);
        return rows[0] || null;
      });
    } catch (error) {
      throw new Error(`Помилка при пошуку користувача: ${error.message}`);
    }
  },

  /**
   * Find user by username.
   * @param {string} username
   * @returns {object|null}
   */
  findByUsername: async (username) => {
    try {
      return await withUsersSchema(async () => {
        const normalizedUsername = toSafeString(username);
        if (!normalizedUsername) {
          return null;
        }

        const query = `
          SELECT * FROM users
          WHERE username = ?
          LIMIT 1
        `;
        const [rows] = await pool.query(query, [normalizedUsername]);
        return rows[0] || null;
      });
    } catch (error) {
      throw new Error(`Помилка при пошуку користувача: ${error.message}`);
    }
  },

  /**
   * Find user by email.
   * @param {string} email
   * @returns {object|null}
   */
  findByEmail: async (email) => {
    try {
      return await withUsersSchema(async () => {
        const normalizedEmail = toSafeString(email).toLowerCase();
        if (!normalizedEmail) {
          return null;
        }

        const query = `
          SELECT * FROM users
          WHERE LOWER(email) = ?
          LIMIT 1
        `;
        const [rows] = await pool.query(query, [normalizedEmail]);
        return rows[0] || null;
      });
    } catch (error) {
      throw new Error(`Помилка при пошуку користувача: ${error.message}`);
    }
  },

  /**
   * Find user by id (without password).
   * @param {number} id
   * @returns {object|null}
   */
  findById: async (id) => {
    try {
      return await withUsersSchema(async () => {
        const query = 'SELECT id, username, email, role, phone, default_address, created_at FROM users WHERE id = ?';
        const [rows] = await pool.query(query, [id]);
        return rows[0] || null;
      });
    } catch (error) {
      throw new Error(`Помилка при отриманні користувача: ${error.message}`);
    }
  },

  /**
   * Compare plain password with hash.
   * @param {string} plainPassword
   * @param {string} hashedPassword
   * @returns {boolean}
   */
  comparePassword: async (plainPassword, hashedPassword) => {
    try {
      return await bcrypt.compare(plainPassword, hashedPassword);
    } catch (error) {
      throw new Error(`Помилка при порівнянні паролів: ${error.message}`);
    }
  },

  /**
   * Create user with hashed password.
   * @param {object} userData
   * @returns {object}
   */
  create: async (userData) => {
    try {
      return await withUsersSchema(async () => {
        const hashedPassword = await bcrypt.hash(userData.password, 10);

        const query = `
          INSERT INTO users (username, email, phone, default_address, password, role)
          VALUES (?, ?, ?, ?, ?, ?)
        `;
        const [result] = await pool.query(query, [
          userData.username,
          userData.email,
          userData.phone || null,
          userData.default_address || null,
          hashedPassword,
          userData.role || 'user'
        ]);

        return {
          id: result.insertId,
          username: userData.username,
          email: userData.email,
          phone: userData.phone || null,
          default_address: userData.default_address || null,
          role: userData.role || 'user'
        };
      });
    } catch (error) {
      const wrappedError = new Error(`Помилка при створенні користувача: ${error.message}`);
      wrappedError.code = error.code;
      wrappedError.errno = error.errno;
      wrappedError.sqlState = error.sqlState;
      wrappedError.sqlMessage = error.sqlMessage;
      throw wrappedError;
    }
  },

  /**
   * Get all users for admin pages.
   * @returns {array}
   */
  getAll: async () => {
    try {
      return await withUsersSchema(async () => {
        const query = 'SELECT id, username, email, role FROM users ORDER BY created_at DESC';
        const [rows] = await pool.query(query);
        return rows;
      });
    } catch (error) {
      throw new Error(`Помилка при отриманні користувачів: ${error.message}`);
    }
  },

  /**
   * Update user.
   * @param {number} id
   * @param {object} updateData
   * @returns {boolean}
   */
  update: async (id, updateData) => {
    try {
      return await withUsersSchema(async () => {
        let query = 'UPDATE users SET ';
        const updates = [];
        const params = [];

        if (updateData.username) {
          updates.push('username = ?');
          params.push(updateData.username);
        }
        if (updateData.email) {
          updates.push('email = ?');
          params.push(updateData.email);
        }
        if (updateData.password) {
          const hashedPassword = await bcrypt.hash(updateData.password, 10);
          updates.push('password = ?');
          params.push(hashedPassword);
        }
        if (updateData.role) {
          updates.push('role = ?');
          params.push(updateData.role);
        }
        if (updateData.phone !== undefined) {
          updates.push('phone = ?');
          params.push(updateData.phone || null);
        }
        if (updateData.default_address !== undefined) {
          updates.push('default_address = ?');
          params.push(updateData.default_address || null);
        }

        if (updates.length === 0) return false;

        query += updates.join(', ') + ' WHERE id = ?';
        params.push(id);

        const [result] = await pool.query(query, params);
        return result.affectedRows > 0;
      });
    } catch (error) {
      throw new Error(`Помилка при оновленні користувача: ${error.message}`);
    }
  },

  /**
   * Delete user.
   * @param {number} id
   * @returns {boolean}
   */
  delete: async (id) => {
    try {
      return await withUsersSchema(async () => {
        const query = 'DELETE FROM users WHERE id = ?';
        const [result] = await pool.query(query, [id]);
        return result.affectedRows > 0;
      });
    } catch (error) {
      throw new Error(`Помилка при видаленні користувача: ${error.message}`);
    }
  }
};

module.exports = userModel;

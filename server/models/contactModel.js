// Модель для роботи з повідомленнями зворотного зв'язку
// Методи для роботи з таблицею contacts

const pool = require('../config/database');

const contactModel = {
  // Створення нового повідомлення
  create: async (contactData) => {
    try {
      const query = `
        INSERT INTO contacts 
        (name, email, phone, subject, message)
        VALUES (?, ?, ?, ?, ?)
      `;
      const [result] = await pool.query(query, [
        contactData.name,
        contactData.email,
        contactData.phone || null,
        contactData.subject || '',
        contactData.message
      ]);
      return result.insertId;
    } catch (error) {
      throw new Error(`Помилка при збереженні контакту: ${error.message}`);
    }
  },

  // Отримання всіх повідомлень (для адміна)
  //  SECURITY: Enforces maximum limit to prevent DoS attacks
  getAll: async (filters = {}) => {
    try {
      let query = 'SELECT * FROM contacts WHERE 1=1';
      const params = [];

      // Фільтр за статусом
      if (filters.status) {
        query += ' AND status = ?';
        params.push(filters.status);
      }

      //  SECURITY: Enforce maximum limit (prevent DoS)
      let limit = parseInt(filters.limit) || 50;
      const MAX_LIMIT = 100; // Maximum items per request
      limit = Math.min(limit, MAX_LIMIT);

      const offset = Math.max(0, parseInt(filters.offset) || 0);

      // Сортування за датою (новіші спочатку)
      query += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';
      params.push(limit, offset);

      const [rows] = await pool.query(query, params);
      return rows;
    } catch (error) {
      throw new Error(`Помилка при отриманні контактів: ${error.message}`);
    }
  },

  // Отримання одного повідомлення за ID
  getById: async (id) => {
    try {
      const [rows] = await pool.query('SELECT * FROM contacts WHERE id = ?', [id]);
      return rows[0] || null;
    } catch (error) {
      throw new Error(`Помилка при отриманні контакту: ${error.message}`);
    }
  },

  // Оновлення статусу та відповіді
  respond: async (id, responseText) => {
    try {
      const query = `
        UPDATE contacts 
        SET status = 'responded', response_text = ?
        WHERE id = ?
      `;
      const [result] = await pool.query(query, [responseText, id]);
      return result.affectedRows > 0;
    } catch (error) {
      throw new Error(`Помилка при відповіді на контакт: ${error.message}`);
    }
  },

  // Позначення як прочитаного
  markAsRead: async (id) => {
    try {
      const [result] = await pool.query(
        'UPDATE contacts SET status = ? WHERE id = ? AND status != ?',
        ['read', id, 'responded']
      );
      return result.affectedRows > 0;
    } catch (error) {
      throw new Error(`Помилка при позначенні контакту: ${error.message}`);
    }
  },

  // Видалення повідомлення
  delete: async (id) => {
    try {
      const [result] = await pool.query('DELETE FROM contacts WHERE id = ?', [id]);
      return result.affectedRows > 0;
    } catch (error) {
      throw new Error(`Помилка при видаленні контакту: ${error.message}`);
    }
  }
};

module.exports = contactModel;

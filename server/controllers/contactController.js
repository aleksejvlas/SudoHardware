// Контролер для контактів (зворотний зв'язок)
// Обробляє запити для форми повідомлень
//  SECURITY: Input size validation to prevent DoS attacks

const contactModel = require('../models/contactModel');

// Input constraints to prevent DoS attacks
const CONSTRAINTS = {
  NAME_MIN: 3,
  NAME_MAX: 100,
  EMAIL_MIN: 5,
  EMAIL_MAX: 100,
  PHONE_MIN: 7,
  PHONE_MAX: 20,
  SUBJECT_MIN: 3,
  SUBJECT_MAX: 200,
  MESSAGE_MIN: 10,
  MESSAGE_MAX: 5000
};

const contactController = {
  // POST /api/contacts - Створення повідомлення
  create: async (req, res) => {
    try {
      const { name, email, phone, subject, message } = req.body;

      //  Валідація обов'язкових полів
      if (!name || !email || !message) {
        return res.status(400).json({
          success: false,
          message: 'Ім\'я, email та повідомлення обов\'язкові'
        });
      }

      //  Валідація name (3-100 символів)
      if (name.length < CONSTRAINTS.NAME_MIN || name.length > CONSTRAINTS.NAME_MAX) {
        return res.status(400).json({
          success: false,
          message: `Ім'я повинно містити від ${CONSTRAINTS.NAME_MIN} до ${CONSTRAINTS.NAME_MAX} символів`
        });
      }

      //  Валідація email формату та довжини
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
      if (!emailRegex.test(email)) {
        return res.status(400).json({
          success: false,
          message: 'Невалідний формат email'
        });
      }

      if (email.length < CONSTRAINTS.EMAIL_MIN || email.length > CONSTRAINTS.EMAIL_MAX) {
        return res.status(400).json({
          success: false,
          message: `Email має бути від ${CONSTRAINTS.EMAIL_MIN} до ${CONSTRAINTS.EMAIL_MAX} символів`
        });
      }

      if (phone && (phone.length < CONSTRAINTS.PHONE_MIN || phone.length > CONSTRAINTS.PHONE_MAX)) {
        return res.status(400).json({
          success: false,
          message: `Телефон має бути від ${CONSTRAINTS.PHONE_MIN} до ${CONSTRAINTS.PHONE_MAX} символів`
        });
      }

      if (subject && (subject.length < CONSTRAINTS.SUBJECT_MIN || subject.length > CONSTRAINTS.SUBJECT_MAX)) {
        return res.status(400).json({
          success: false,
          message: `Тема має бути від ${CONSTRAINTS.SUBJECT_MIN} до ${CONSTRAINTS.SUBJECT_MAX} символів`
        });
      }

      //  Валідація message (10-5000 символів)
      if (message.length < CONSTRAINTS.MESSAGE_MIN || message.length > CONSTRAINTS.MESSAGE_MAX) {
        return res.status(400).json({
          success: false,
          message: `Повідомлення повинно містити від ${CONSTRAINTS.MESSAGE_MIN} до ${CONSTRAINTS.MESSAGE_MAX} символів`
        });
      }

      // Очищуємо входні дані від окрайніх пробілів
      const cleanData = {
        name: name.trim(),
        email: email.trim().toLowerCase(),
        phone: phone?.trim() || null,
        subject: subject?.trim() || null,
        message: message.trim()
      };

      const contactId = await contactModel.create(cleanData);

      res.status(201).json({
        success: true,
        message: 'Ваше повідомлення успішно відправлено. Ми вам скоро відповімо!',
        id: contactId
      });
    } catch (error) {
      console.error('Помилка в create contact:', error);
      res.status(500).json({
        success: false,
        message: error.message || 'Помилка при відправці повідомлення'
      });
    }
  },

  // GET /api/admin/contacts - Отримання всіх повідомлень (для адміна)
  getAll: async (req, res) => {
    try {
      const filters = {
        status: req.query.status,
        limit: req.query.limit,
        offset: req.query.offset
      };

      console.log(` Contact getAll: filters=${JSON.stringify(filters)}, user=${req.user?.username}`);
      const contacts = await contactModel.getAll(filters);
      console.log(` Contact getAll: отримано ${contacts.length} контактів`);

      res.json({
        success: true,
        data: contacts,
        count: contacts.length
      });
    } catch (error) {
      console.error('Помилка в getAll contacts:', error);
      res.status(500).json({
        success: false,
        message: error.message
      });
    }
  },

  // GET /api/admin/contacts/:id - Отримання одного повідомлення
  getById: async (req, res) => {
    try {
      const { id } = req.params;

      if (!id || isNaN(id)) {
        return res.status(400).json({
          success: false,
          message: 'ID повідомлення повинен бути числом'
        });
      }

      const contact = await contactModel.getById(id);

      if (!contact) {
        return res.status(404).json({
          success: false,
          message: 'Повідомлення не знайдено'
        });
      }

      // Позначаємо як прочитане
      await contactModel.markAsRead(id);

      res.json({
        success: true,
        data: contact
      });
    } catch (error) {
      console.error('Помилка в getById contact:', error);
      res.status(500).json({
        success: false,
        message: error.message
      });
    }
  },

  // PUT /api/admin/contacts/:id - Відповідь на повідомлення
  respond: async (req, res) => {
    try {
      const { id } = req.params;
      const { response_text } = req.body;

      if (!response_text) {
        return res.status(400).json({
          success: false,
          message: 'Текст відповіді обов\'язковий'
        });
      }

      const success = await contactModel.respond(id, response_text);

      if (!success) {
        return res.status(404).json({
          success: false,
          message: 'Повідомлення не знайдено'
        });
      }

      res.json({
        success: true,
        message: 'Відповідь успішно відправлена'
      });
    } catch (error) {
      console.error('Помилка в respond:', error);
      res.status(500).json({
        success: false,
        message: error.message
      });
    }
  },

  // DELETE /api/admin/contacts/:id - Видалення повідомлення
  delete: async (req, res) => {
    try {
      const { id } = req.params;

      if (!id || isNaN(id)) {
        return res.status(400).json({
          success: false,
          message: 'ID повідомлення повинен бути числом'
        });
      }

      const success = await contactModel.delete(id);

      if (!success) {
        return res.status(404).json({
          success: false,
          message: 'Повідомлення не знайдено'
        });
      }

      res.json({
        success: true,
        message: 'Повідомлення видалено'
      });
    } catch (error) {
      console.error('Помилка в delete:', error);
      res.status(500).json({
        success: false,
        message: error.message
      });
    }
  }
};

module.exports = contactController;

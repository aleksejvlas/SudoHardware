/**
 * Контролер для замовлень
 * Обробляє створення замовлень, отримання статусу тощо
 */

const orderModel = require('../models/orderModel');
const productModel = require('../models/productModel');
const pool = require('../config/database');
const normalizeString = (value) => (typeof value === 'string' ? value.trim() : '');
const normalizePhoneDigits = (value) => normalizeString(value).replace(/\D/g, '');
const toPositiveInt = (value) => {
  const num = Number.parseInt(value, 10);
  return Number.isInteger(num) && num > 0 ? num : null;
};

function successResponse(res, data, message, statusCode = 200) {
  return res.status(statusCode).json({
    success: true,
    data,
    message
  });
}

function errorResponse(res, statusCode, message, data = null) {
  return res.status(statusCode).json({
    success: false,
    data,
    message
  });
}

const orderController = {

  create: async (req, res) => {
    try {
      const customer_name = normalizeString(req.body?.customer_name);
      const customer_email = normalizeString(req.body?.customer_email).toLowerCase();
      const customer_phone = normalizeString(req.body?.customer_phone);
      const customer_address = normalizeString(req.body?.customer_address);
      const items = Array.isArray(req.body?.items) ? req.body.items : null;
      const total_price = Number(req.body?.total_price);

      //  Валідація вхідних даних
      if (!customer_name || !customer_email || !customer_phone || !customer_address || !items || !Number.isFinite(total_price)) {
        return res.status(400).json({
          success: false,
          data: null,
          message: 'Будь ласка, заповніть всі обов\'язкові поля'
        });
      }

      if (total_price <= 0) {
        return res.status(400).json({
          success: false,
          data: null,
          message: 'Сума замовлення повинна бути більшою за 0'
        });
      }

      if (!Array.isArray(items) || items.length === 0) {
        return res.status(400).json({
          success: false,
          data: null,
          message: 'Кошик порожній'
        });
      }

      if (customer_name.length < 3) {
        return res.status(400).json({
          success: false,
          data: null,
          message: 'Ім\'я повинно містити щонайменше 3 символи'
        });
      }

      if (customer_address.length < 5) {
        return res.status(400).json({
          success: false,
          data: null,
          message: 'Адреса повинна містити щонайменше 5 символів'
        });
      }

      // Валідація email
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(customer_email)) {
        return res.status(400).json({
          success: false,
          data: null,
          message: 'Невалідна email адреса'
        });
      }

      //  Попередня перевірка всіх товарів перед створенням замовлення
      // Це запобігає часткову редукцію запасів при невдачі
      const phoneDigits = normalizePhoneDigits(customer_phone);
      if (phoneDigits.length < 10 || phoneDigits.length > 15) {
        return res.status(400).json({
          success: false,
          data: null,
          message: 'Невалідний номер телефону (допустимо 10-15 цифр)'
        });
      }

      const normalizedItems = [];
      for (const item of items) {
        const itemId = toPositiveInt(item?.product_id ?? item?.id);
        const quantity = toPositiveInt(item?.quantity);

        if (!itemId || !quantity) {
          return res.status(400).json({
            success: false,
            data: null,
            message: 'Некоректні дані товарів у кошику'
          });
        }

        normalizedItems.push({
          ...item,
          product_id: itemId,
          quantity
        });
      }

      try {
        for (const item of normalizedItems) {
          const itemId = item.product_id || item.id;
          const quantity = item.quantity;
          
          // Перевіряємо чи товар існує та отримуємо його деталі
          const product = await productModel.getById(itemId);
          if (!product) {
            return errorResponse(
              res,
              400,
              ` Товар з ID ${itemId} не знайдений у каталозі`,
              { product_id: itemId }
            );
          }
          
          // Перевіряємо чи достатньо запасів
          if (product.stock < quantity) {
            return errorResponse(
              res,
              400,
              ` Недостатньо запасів для товару "${product.name}". Доступно: ${product.stock}, потрібно: ${quantity}`,
              {
                product_id: itemId,
                product_name: product.name,
                available_stock: product.stock,
                required_quantity: quantity
              }
            );
          }
        }
        console.log(' Попередня перевірка запасів успішна');
      } catch (preCheckError) {
        console.error(' Помилка при попередній перевірці запасів:', preCheckError);
        return errorResponse(res, 500, `Помилка при перевірці запасів: ${preCheckError.message}`);
      }

      //  Створюємо замовлення
      const order = await orderModel.create({
        customer_name,
        customer_email,
        customer_phone,
        customer_address,
        items: normalizedItems,
        total_price
      });

      // Зменшуємо запаси для кожного товару та відстежуємо зміни
      const decreasedItems = [];
      try {
        for (const item of normalizedItems) {
          const itemId = item.product_id || item.id;
          const quantity = item.quantity;
          
          try {
            await productModel.decreaseStock(itemId, quantity);
            decreasedItems.push({ itemId, quantity });
            console.log(` Запаси зменшені для товару ID=${itemId} на ${quantity} одиниць`);
          } catch (stockError) {
            console.error(` Помилка при зменшенні запасів для товару ID=${itemId}:`, stockError.message);
            
            try {
              for (const decreased of decreasedItems) {
                await pool.query('UPDATE products SET stock = stock + ? WHERE id = ?', [decreased.quantity, decreased.itemId]);
                console.log(`🔄 Запаси ВІДНОВЛЕНІ для товару ID=${decreased.itemId} на ${decreased.quantity} одиниць`);
              }
            } catch (rollbackError) {
              console.error(' КРИТИЧНА ПОМИЛКА: Не вдалось відновити запаси:', rollbackError);
            }
            
            // Видаляємо замовлення що було створено
            if (order && order.id) {
              await orderModel.delete(order.id);
              console.log(` Замовлення ID=${order.id} видалене через помилку запасів`);
            }
            
            // Отримуємо деталі товару для кращої помилки
            const product = await productModel.getById(itemId);
            return errorResponse(
              res,
              400,
              ` Недостатньо запасів для товару "${product?.name || `ID ${itemId}`}". ${stockError.message}`,
              {
                product_id: itemId,
                product_name: product?.name,
                error_detail: stockError.message
              }
            );
          }
        }
        console.log(` Всі запаси успішно оновлені для замовлення ${order.order_number}`);
      } catch (stockError) {
        console.error(` КРИТИЧНА помилка при оновленні запасів:`, stockError);
        
        // Останній відкат
        try {
          for (const decreased of decreasedItems) {
            await pool.query('UPDATE products SET stock = stock + ? WHERE id = ?', [decreased.quantity, decreased.itemId]);
          }
        } catch (rollbackError) {
          console.error(' КРИТИЧНА ПОМИЛКА при откаті:', rollbackError);
        }
        
        // Видаляємо замовлення
        if (order && order.id) {
          await orderModel.delete(order.id);
        }
        
        return errorResponse(
          res,
          500,
          ' Помилка оновлення запасів товарів. Замовлення скасовано.',
          { error_detail: stockError.message }
        );
      }

      // 📤 Повертаємо успішне створення
      successResponse(res, order, `Замовлення ${order.order_number} успішно створено!`, 201);

      console.log(` Замовлення від ${customer_email} успішно оформлено (№ ${order.order_number})`);

    } catch (error) {
      console.error('Помилка в create:', error);
      errorResponse(res, 500, `Помилка при створенні замовлення: ${error.message}`);
    }
  },

  /**
   * Отримує замовлення за ID
   * GET /api/orders/:id
   * Повертає: { success, order }
   */
  getById: async (req, res) => {
    try {
      const { id } = req.params;

      const order = await orderModel.findById(id);
      
      if (!order) {
        return errorResponse(res, 404, 'Замовлення не знайдено');
      }

      successResponse(res, order, 'Замовлення отримано успішно');

    } catch (error) {
      console.error('Помилка в getById:', error);
      errorResponse(res, 500, `Помилка при отриманні замовлення: ${error.message}`);
    }
  },

  /**
   * Отримує замовлення за номером
   * GET /api/orders/number/:orderNumber
   * Повертає: { success, order }
   */
  getByNumber: async (req, res) => {
    try {
      const { orderNumber } = req.params;

      const order = await orderModel.findByOrderNumber(orderNumber);
      
      if (!order) {
        return errorResponse(res, 404, 'Замовлення не знайдено');
      }

      successResponse(res, order, 'Замовлення отримано успішно');

    } catch (error) {
      console.error('Помилка в getByNumber:', error);
      errorResponse(res, 500, `Помилка при отриманні замовлення: ${error.message}`);
    }
  },

  /**
   * Отримує замовлення користувача за його email
   * GET /api/orders/user/:email
   * Повертає: { success, orders[] }
   */
  getByEmail: async (req, res) => {
    try {
      const { email } = req.params;

      const orders = await orderModel.findByEmail(email);

      successResponse(res, orders, `Отримано ${orders.length} замовлень`);

    } catch (error) {
      console.error('Помилка в getByEmail:', error);
      errorResponse(res, 500, `Помилка при отриманні замовлень: ${error.message}`);
    }
  },

  /**
   * Отримує всі замовлення (тільки для адміна)
   * GET /api/admin/orders
   * Повертає: { success, data: orders[], total }
   */
  getAll: async (req, res) => {
    try {
      const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 50));
      const offset = Math.max(0, parseInt(req.query.offset, 10) || 0);
      console.log(`?? getAll: limit=${limit}, offset=${offset}, user=${req.user?.username}`);
      const orders = await orderModel.findAll(limit, offset);
      console.log(` getAll: отримано ${orders.length} замовлень`);

      successResponse(res, orders, `Отримано ${orders.length} замовлень`);

    } catch (error) {
      console.error('Помилка в getAll:', error);
      errorResponse(res, 500, `Помилка при отриманні замовлень: ${error.message}`);
    }
  },

  /**
   * Обновляє статус замовлення (тільки для адміна)
   * PUT /api/admin/orders/:id
   * Тіло: { status }
   * Повертає: { success, message }
   */
  updateStatus: async (req, res) => {
    try {
      const { id } = req.params;
      const { status } = req.body;

      if (!status) {
        return errorResponse(res, 400, 'Статус не вказаний');
      }

      const updated = await orderModel.updateStatus(id, status);

      if (!updated) {
        return errorResponse(res, 404, 'Замовлення не знайдено');
      }

      successResponse(res, { id, status }, `Статус замовлення оновлено на: ${status}`);

    } catch (error) {
      console.error('Помилка в updateStatus:', error);
      errorResponse(res, 500, `Помилка при оновленні статусу: ${error.message}`);
    }
  },

  /**
   * Видаляє замовлення (тільки для адміна)
   * DELETE /api/admin/orders/:id
   * Повертає: { success, message }
   */
  delete: async (req, res) => {
    try {
      const { id } = req.params;

      const deleted = await orderModel.delete(id);

      if (!deleted) {
        return errorResponse(res, 404, 'Замовлення не знайдено');
      }

      successResponse(res, { id }, 'Замовлення успішно видалено');

    } catch (error) {
      console.error('Помилка в delete:', error);
      errorResponse(res, 500, `Помилка при видаленні замовлення: ${error.message}`);
    }
  }
};

module.exports = orderController;


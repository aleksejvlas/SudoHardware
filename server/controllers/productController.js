// Контролер для товарів
// Обробляє запити, валідує дані та викликає модель

const productModel = require('../models/productModel');
const orderModel = require('../models/orderModel');
const fs = require('fs/promises');
const path = require('path');
const crypto = require('crypto');

const PHOTOS_DIR = path.join(__dirname, '..', '..', 'photos');
const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;
const ALLOWED_IMAGE_TYPES = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/gif': 'gif'
};

// ============= УТИЛІТНІ ФУНКЦІЇ ВАЛІДАЦІЇ =============

/**
 *  Валідує URL зображення
 * @param {string} url - URL для перевірки
 * @returns {boolean} True якщо URL валід
 */
function isValidImageURL(url) {
  if (!url) return true; // Optional field

  if (/^\/photos\/[a-zA-Z0-9._-]+$/.test(url)) {
    return true;
  }
  
  try {
    // Перевіряємо чи це валідний URL
    const urlObj = new URL(url);
    
    // Запобігаємо javascript: injections
    if (urlObj.protocol === 'javascript:' || urlObj.protocol === 'data:') {
      return false;
    }
    
    // Дозволяємо тільки http/https
    if (urlObj.protocol !== 'http:' && urlObj.protocol !== 'https:') {
      return false;
    }
    
    return true;
  } catch (e) {
    return false;
  }
}

/**
 *  Валідує JSON specs
 * @param {string|object} specs - Specs для перевірки
 * @returns {object} Валідний JSON об'єкт або null
 */
function validateAndParseSpecs(specs) {
  if (!specs) return null;
  
  try {
    if (typeof specs === 'string') {
      const parsed = JSON.parse(specs);
      // Убедитеся, что это объект
      if (typeof parsed !== 'object' || Array.isArray(parsed)) {
        return null;
      }
      return parsed;
    } else if (typeof specs === 'object' && !Array.isArray(specs)) {
      return specs;
    }
    return null;
  } catch (e) {
    console.warn(' Невалідний JSON specs:', e.message);
    return null;
  }
}

async function saveBase64Image(uploadData) {
  if (!uploadData || typeof uploadData !== 'object') {
    throw new Error('Дані зображення відсутні');
  }

  const { file_name, mime_type, data } = uploadData;
  const extension = ALLOWED_IMAGE_TYPES[mime_type];
  if (!extension) {
    throw new Error('Непідтримуваний формат зображення');
  }

  if (typeof file_name !== 'string' || !file_name.trim()) {
    throw new Error('Некоректна назва файлу');
  }

  if (typeof data !== 'string' || !data.trim()) {
    throw new Error('Порожні дані зображення');
  }

  const normalizedData = data.includes(',') ? data.split(',')[1] : data;
  const buffer = Buffer.from(normalizedData, 'base64');
  if (!buffer.length) {
    throw new Error('Не вдалося декодувати файл');
  }

  if (buffer.length > MAX_UPLOAD_BYTES) {
    throw new Error('Розмір фото перевищує 5MB');
  }

  await fs.mkdir(PHOTOS_DIR, { recursive: true });

  const safeBaseName = path.parse(file_name).name.replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 50) || 'product';
  const fileName = `${safeBaseName}_${Date.now()}_${crypto.randomBytes(4).toString('hex')}.${extension}`;
  const filePath = path.join(PHOTOS_DIR, fileName);

  await fs.writeFile(filePath, buffer);
  return `/photos/${fileName}`;
}

const productController = {
  uploadImage: async (req, res) => {
    try {
      const imageUrl = await saveBase64Image(req.body);

      res.status(201).json({
        success: true,
        data: { image_url: imageUrl },
        message: 'Фото успішно завантажено'
      });
    } catch (error) {
      res.status(400).json({
        success: false,
        data: null,
        message: error.message
      });
    }
  },
  // GET /api/products - Отримання всіх товарів
  getAll: async (req, res) => {
    try {
      const filters = {
        category: req.query.category,
        search: req.query.search,
        sort: req.query.sort,
        limit: req.query.limit,
        offset: req.query.offset
      };

      const products = await productModel.getAll(filters);
      const total = await productModel.count();

      res.json({
        success: true,
        data: products,
        message: `Отримано ${products.length} товарів`,
        meta: {
          total: total,
          count: products.length
        }
      });
    } catch (error) {
      console.error('Помилка в getAll:', error);
      res.status(500).json({
        success: false,
        data: null,
        message: error.message
      });
    }
  },
  // GET /api/products/popular - Popular products based on orders
  getPopular: async (req, res) => {
    try {
      const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 6, 1), 24);
      const popularity = await orderModel.getPopularProductCounts(limit, { excludeStatuses: ['cancelled'] });

      let products = [];
      if (popularity.length > 0) {
        const ids = popularity.map(item => item.productId);
        products = await productModel.getByIds(ids);
      }

      if (products.length < limit) {
        const fallback = await productModel.getAll({ limit });
        const existingIds = new Set(products.map(product => product.id));
        fallback.forEach(product => {
          if (products.length >= limit) return;
          if (!existingIds.has(product.id)) {
            products.push(product);
            existingIds.add(product.id);
          }
        });
      }

      res.json({
        success: true,
        data: products,
        meta: {
          count: products.length,
          source: popularity.length > 0 ? 'orders' : 'fallback'
        }
      });
    } catch (error) {
      console.error('Error in getPopular:', error);
      res.status(500).json({
        success: false,
        data: null,
        message: error.message
      });
    }
  },

  // GET /api/products/:id - Отримання одного товару
  getById: async (req, res) => {
    try {
      const { id } = req.params;

      if (!id || isNaN(id)) {
        return res.status(400).json({
          success: false,
          data: null,
          message: 'ID товару повинен бути числом'
        });
      }

      const product = await productModel.getById(id);

      if (!product) {
        return res.status(404).json({
          success: false,
          data: null,
          message: 'Товар не знайдений'
        });
      }

      res.json({
        success: true,
        data: product,
        message: 'Товар отримано успішно'
      });
    } catch (error) {
      console.error('Помилка в getById:', error);
      res.status(500).json({
        success: false,
        data: null,
        message: error.message
      });
    }
  },

  // GET /api/products/category/:category - Товари за категорією
  getByCategory: async (req, res) => {
    try {
      const { category } = req.params;

      if (!category) {
        return res.status(400).json({
          success: false,
          data: null,
          message: 'Категорія необхідна'
        });
      }

      const products = await productModel.getByCategory(category);

      res.json({
        success: true,
        data: products,
        message: `Отримано ${products.length} товарів категорії ${category}`,
        meta: {
          category: category,
          count: products.length
        }
      });
    } catch (error) {
      console.error('Помилка в getByCategory:', error);
      res.status(500).json({
        success: false,
        data: null,
        message: error.message
      });
    }
  },

  // POST /api/products - Створення товару (тільки для адміна)
  create: async (req, res) => {
    try {
      const { name, price, category, stock, description, image_url, specs } = req.body;

      //  Валідація обов'язкових полів
      if (!name || price === undefined || price === null || !category) {
        return res.status(400).json({
          success: false,
          message: 'Назва, ціна та категорія обов\'язкові',
          data: null
        });
      }

      if (isNaN(price) || price <= 0) {
        return res.status(400).json({
          success: false,
          message: 'Ціна повинна бути додатним числом',
          data: null
        });
      }

      if (stock !== undefined && (isNaN(stock) || Number(stock) < 0)) {
        return res.status(400).json({
          success: false,
          message: 'Кількість товару не може бути від\'ємною',
          data: null
        });
      }

      if (image_url && !isValidImageURL(image_url)) {
        return res.status(400).json({
          success: false,
          message: 'Невалідний шлях фото. Дозволені: http/https URL або /photos/filename.ext',
          data: null
        });
      }

      const parsedSpecs = validateAndParseSpecs(specs);
      if (specs && !parsedSpecs) {
        return res.status(400).json({
          success: false,
          message: 'Specs повинні бути валідним JSON об\'єктом',
          data: null
        });
      }

      console.log(`👤 Адмін ${req.user.username} створює товар: ${name}`);

      //  Створюємо товар
      const result = await productModel.create({
        name,
        price,
        category,
        stock: stock || 0,
        description,
        image_url: image_url || null,
        specs: parsedSpecs || null
      });

      //  Повертаємо результат з ID товару
      res.status(201).json({
        success: true,
        message: 'Товар успішно створений',
        data: {
          id: result,
          name,
          price,
          category,
          stock: stock || 0,
          description,
          image_url: image_url || null,
          specs: parsedSpecs
        }
      });

      console.log(` Товар ${name} успішно створений (ID: ${result})`);

    } catch (error) {
      console.error(' Помилка в create:', error);
      res.status(500).json({
        success: false,
        message: error.message,
        data: null
      });
    }
  },

  // PUT /api/products/:id - Оновлення товару
  update: async (req, res) => {
    try {
      const { id } = req.params;
      const { name, price, category, stock, description, image_url, specs } = req.body;

      if (!id || isNaN(id)) {
        return res.status(400).json({
          success: false,
          message: 'ID товару повинен бути числом',
          data: null
        });
      }

      if (price !== undefined && (isNaN(price) || price <= 0)) {
        return res.status(400).json({
          success: false,
          message: 'Ціна повинна бути додатним числом',
          data: null
        });
      }

      if (stock !== undefined && (isNaN(stock) || Number(stock) < 0)) {
        return res.status(400).json({
          success: false,
          message: 'Кількість товару не може бути від\'ємною',
          data: null
        });
      }

      // 🔒 Валідація image_url
      if (image_url && !isValidImageURL(image_url)) {
        return res.status(400).json({
          success: false,
          message: 'Невалідний шлях фото. Дозволені: http/https URL або /photos/filename.ext',
          data: null
        });
      }

      const parsedSpecs = validateAndParseSpecs(specs);
      if (specs && !parsedSpecs) {
        return res.status(400).json({
          success: false,
          message: 'Specs повинні бути валідним JSON об\'єктом',
          data: null
        });
      }

      console.log(`👤 Адмін ${req.user.username} редагує товар ID=${id}`);

      const updateData = {};
      if (name !== undefined) updateData.name = name;
      if (price !== undefined) updateData.price = price;
      if (category !== undefined) updateData.category = category;
      if (stock !== undefined) updateData.stock = stock;
      if (description !== undefined) updateData.description = description;
      if (image_url !== undefined) updateData.image_url = image_url;
      if (specs !== undefined) updateData.specs = parsedSpecs || null;

      if (Object.keys(updateData).length === 0) {
        return res.status(400).json({
          success: false,
          message: 'Немає полів для оновлення',
          data: null
        });
      }

      const success = await productModel.update(id, updateData);

      if (!success) {
        return res.status(404).json({
          success: false,
          message: 'Товар не знайдений',
          data: null
        });
      }

      // Отримуємо оновлений товар для відповіді
      const updatedProduct = await productModel.getById(id);

      res.json({
        success: true,
        message: 'Товар успішно оновлений',
        data: updatedProduct
      });

      console.log(` Товар ID=${id} успішно оновлений`);

    } catch (error) {
      console.error('❌ Помилка в update:', error);
      res.status(500).json({
        success: false,
        message: error.message,
        data: null
      });
    }
  },

  delete: async (req, res) => {
    try {
      const { id } = req.params;

      if (!id || isNaN(id)) {
        return res.status(400).json({
          success: false,
          data: null,
          message: 'ID товару повинен бути числом'
        });
      }

      console.log(`👤 Адмін ${req.user.username} видаляє товар ID=${id}`);

      const success = await productModel.delete(id);

      if (!success) {
        return res.status(404).json({
          success: false,
          data: null,
          message: 'Товар не знайдений'
        });
      }

      res.json({
        success: true,
        data: { id: id },
        message: 'Товар успішно видалений'
      });

      console.log(` Товар ID=${id} успішно видалений`);

    } catch (error) {
      console.error(' Помилка в delete:', error);
      res.status(500).json({
        success: false,
        data: null,
        message: error.message
      });
    }
  }
};

module.exports = productController;

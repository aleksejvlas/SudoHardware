/**
 * Модуль фронтенду: завантаження товарів, фільтри, кошик, авторизація.
 * Коротко: API-запити, рендер каталогу, робота з кошиком і формами.
 */

// ============= ГЛОБАЛЬНІ ЗМІННІ =============

let currentUser = null; // Буде завантажена з localStorage
let API_BASE_URL = window.API_BASE_URL || 'http://localhost:3000/api';

// Кошик товарів - відновлюється з localStorage
let cart = JSON.parse(localStorage.getItem('rtk_cart')) || [];

// Глобальна змінна для зберігання всіх отриманих товарів
let allProducts = [];

// ============= ІНІЦІАЛІЗАЦІЯ =============

// Завантажуємо користувача з localStorage на старті
(function initAuth() {
  const userJSON = localStorage.getItem('rtk_user');
  if (userJSON) {
    try {
      currentUser = JSON.parse(userJSON);
      console.log(`👤 Користувач завантажений: ${currentUser.username}`);
    } catch (e) {
      console.warn('⚠️ Помилка при парсуванні користувача:', e);
      currentUser = null;
    }
  } else {
    console.log('👥 Користувач не залогінений');
  }
})();

/**
 * Синхронізує currentUser з localStorage.
 * @returns {object|null}
 */
function syncCurrentUserFromStorage() {
  const userJSON = localStorage.getItem('rtk_user');
  if (!userJSON) {
    currentUser = null;
    return null;
  }

  try {
    currentUser = JSON.parse(userJSON);
    return currentUser;
  } catch (error) {
    console.warn('Помилка парсингу rtk_user. Очищаємо сесію:', error);
    localStorage.removeItem('rtk_user');
    currentUser = null;
    return null;
  }
}

/**
 * Повертає поточного користувача або null.
 * @returns {object|null}
 */
function getCurrentUser() {
  return syncCurrentUserFromStorage();
}

/**
 * Перевіряє чи користувач залогінений.
 * @returns {boolean}
 */
function isLoggedIn() {
  return getCurrentUser() !== null;
}

/**
 * Перевіряє чи користувач має роль admin.
 * @returns {boolean}
 */
function isAdmin() {
  const user = getCurrentUser();
  return Boolean(user && user.role === 'admin');
}

/**
 * Оновлює кнопку авторизації у хедері.
 */
function updateAuthUI() {
  const authBtn = document.getElementById('authBtn');
  document.querySelectorAll('.admin-link').forEach(link => {
    link.style.display = 'none';
  });
  if (!authBtn) return;

  const user = getCurrentUser();
  if (user) {
    const displayName = user.username || user.email || 'Профіль';
    authBtn.textContent = `👤 ${displayName}`;
    authBtn.classList.remove('btn-outline');
    authBtn.classList.add('btn-secondary');
    authBtn.onclick = () => {
      window.location.href = 'profile.html';
    };
    return;
  }

  authBtn.textContent = 'Увійти';
  authBtn.classList.remove('btn-secondary');
  authBtn.classList.add('btn-outline');
  authBtn.onclick = () => {
    window.location.href = 'auth.html';
  };
}

/**
 * Вихід з сесії без очищення кошика.
 */
async function handleLogout() {
  const token = localStorage.getItem('rtk_token');

  if (token) {
    try {
      await fetch(`${API_BASE_URL}/auth/logout`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
    } catch (error) {
      console.warn('Не вдалося виконати logout на сервері:', error);
    }
  }

  localStorage.removeItem('rtk_token');
  localStorage.removeItem('rtk_user');
  currentUser = null;

  updateAuthUI();
  showNotification('Ви вийшли з системи', 'success');

  setTimeout(() => {
    window.location.href = 'auth.html';
  }, 600);
}

// Дозволяє іншим скриптам синхронізувати UI після логіну/логауту.
window.notifyAuthChange = function notifyAuthChange() {
  syncCurrentUserFromStorage();
  updateAuthUI();
};

// ============= УТИЛІТНІ ФУНКЦІЇ =============

/**
 * Універсальна функція для API запитів
 * @param {string} endpoint - Адреса ендпоїнту (без /api)
 * @param {string} method - HTTP метод (GET, POST, PUT, DELETE)
 * @param {object} data - Дані для отправки (для POST/PUT)
 * @returns {Promise} Результат запиту
 */
async function apiCall(endpoint, method = 'GET', data = null) {
  try {
    const options = {
      method: method,
      headers: {
        'Content-Type': 'application/json'
      }
    };

    // Добавляем таймаут запроса через AbortController
    const controller = new AbortController();
    const timeout = (window.API_CONFIG && window.API_CONFIG.TIMEOUT) || 10000;
    const timeoutId = setTimeout(() => controller.abort(), timeout);
    options.signal = controller.signal;

    // Додаємо auth токен якщо є
    if (currentUser && currentUser.token) {
      options.headers['Authorization'] = `Bearer ${currentUser.token}`;
      options.headers['X-Auth-Token'] = currentUser.token;
    }

    // Додаємо тіло запиту для POST/PUT
    if (data && (method === 'POST' || method === 'PUT')) {
      options.body = JSON.stringify(data);
    }

    const url = `${API_BASE_URL}${endpoint}`;
    console.log(`🌐 API Request: ${method} ${url}`);
    const response = await fetch(url, options);
    clearTimeout(timeoutId);

    if (!response.ok) {
      let errorText = `Помилка HTTP: ${response.status}`;
      try {
        const errorData = await response.json();
        errorText = errorData.message || errorText;
      } catch (e) {
        // ignore JSON parse errors
      }
      throw new Error(errorText);
    }

    // Обробка JSON відповіді
    const responseData = await response.json();
    return {
      success: true,
      data: responseData
    };

  } catch (error) {
    // Detect abort
    if (error.name === 'AbortError') {
      console.error('Помилка API: перевищено час очікування запиту');
      return { success: false, error: 'Час очікування запиту вичерпано' };
    }
    console.error('Помилка API:', error);
    return { success: false, error: error.message };
  }
}

// ✅ БЕЗПЕКА: Функція для екранування HTML спецсимволів (запобігання XSS)
/**
 * Екранує HTML спецсимволи для безпечного виведення в DOM
 * @param {string} str - Рядок для екранування
 * @returns {string} Екранований рядок
 */
function escapeHTML(str) {
  if (typeof str !== 'string') return '';
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

/**
 * Форматує ціну в гривні
 * @param {number} price - Ціна в гривнях
 * @returns {string} Форматована ціна з символом грн
 */
function formatPrice(price) {
  return new Intl.NumberFormat('uk-UA', {
    style: 'currency',
    currency: 'UAH'
  }).format(price);
}

function getCategoryLabel(category) {
  if (!category) return '';
  const map = typeof CATEGORY_NAME_MAP !== 'undefined' ? CATEGORY_NAME_MAP : null;
  if (map && typeof map === 'object' && map[category]) {
    return map[category];
  }
  return String(category).toUpperCase();
}

// ✅ КРАЩА РЕАЛІЗАЦІЯ - Toast Notification
function showNotification(message, type = 'info', duration = 3000) {
  // Створюємо контейнер для уведомлень якщо його немає
  let container = document.getElementById('notifications-container');
  if (!container) {
    container = document.createElement('div');
    container.id = 'notifications-container';
    container.style.cssText = `
      position: fixed;
      bottom: 20px;
      left: 20px;
      z-index: 10000;
      display: flex;
      flex-direction: column;
      gap: 10px;
      max-width: 400px;
    `;
    document.body.appendChild(container);
  }

  // Створюємо toast елемент
  const toast = document.createElement('div');
  const bgColor = type === 'success' ? '#10b981' : type === 'error' ? '#ef4444' : '#3b82f6';
  const icon = type === 'success' ? '✓' : type === 'error' ? '✕' : 'ℹ';
  toast.style.cssText = `
    background: ${bgColor};
    color: white;
    padding: 1rem 1.5rem;
    border-radius: 8px;
    box-shadow: 0 4px 12px rgba(0,0,0,0.3);
    font-weight: 500;
    animation: slideInLeft 0.3s ease;
    max-width: 100%;
    word-break: break-word;
    font-family: 'Inter', sans-serif;
  `;
  toast.textContent = `${icon} ${message}`;
  container.appendChild(toast);

  // Автоматичне видалення
  setTimeout(() => {
    toast.style.animation = 'slideOutLeft 0.3s ease';
    setTimeout(() => toast.remove(), 300);
  }, duration);

  console.log(`[${type.toUpperCase()}] ${message}`);
}

// ============= ФУНКЦІЇ РОБОТИ З ТОВАРАМИ =============

/**
 * 🚀 Debounce утилітна функція для оптимізації перевироблення
 * Затримує виконання функції до припинення основного потоку подій
 * @param {function} func - Функція для виклику
 * @param {number} delay - Затримка в мілісекундах (за замовчуванням 300ms)
 * @returns {function} Debounced функція
 */
function debounce(func, delay = 300) {
  let timeoutId;
  return function(...args) {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => func.apply(this, args), delay);
  };
}

/**
 * Збирає всі активні фільтри з форми (категорії + підфільтри)
 * @returns {object} Об'єкт з усіма активними фільтрами
 */
function collectActiveFilters() {
  const filters = {
    categories: [],
    search: '',
    sort: 'default'
  };
  const subfilterConfig = typeof SUBFILTER_CONFIG !== 'undefined' ? SUBFILTER_CONFIG : null;

  // 1️⃣ Збираємо обрані категорії
  const categoryCheckboxes = document.querySelectorAll('#categoryFilters input[type="checkbox"]:checked');
  categoryCheckboxes.forEach(cb => {
    filters.categories.push(cb.value);
  });

  // 2️⃣ Динамічно збираємо підфільтри на основі конфігурації
  filters.categories.forEach(category => {
    const categoryConfig = subfilterConfig ? subfilterConfig[category] : null;
    
    if (categoryConfig) {
      // Для кожного фільтру в конфігурації (e.g., "manufacturer", "cores", "socket")
      for (const [filterKey, filterConfig] of Object.entries(categoryConfig)) {
        // Використовуємо htmlName з конфіга (e.g. "gpu-vram", "cpu-cores")
        const checkboxSelector = `input[name="${filterConfig.htmlName}"]:checked`;
        const filterCheckboxes = document.querySelectorAll(checkboxSelector);
        
        if (filterCheckboxes.length > 0) {
          filters[filterKey] = [];
          filterCheckboxes.forEach(cb => {
            filters[filterKey].push(cb.value);
          });
        }
      }
    }
  });

  // 3️⃣ Збираємо пошук
  const searchInput = document.getElementById('search');
  if (searchInput) {
    filters.search = searchInput.value.toLowerCase();
  }

  // 4️⃣ Збираємо сортування
  const sortSelect = document.getElementById('sortSelect');
  if (sortSelect) {
    filters.sort = sortSelect.value;
  }

  console.log('📋 Активні фільтри (з конфігу):', filters);
  return filters;
}

/**
 * Normalizes any value for case-insensitive text search.
 * @param {any} value
 * @returns {string}
 */
function normalizeForSearch(value) {
  if (value === null || value === undefined) return '';
  const asString = typeof value === 'string' ? value : JSON.stringify(value);
  return asString
    .replace(/\([^)]*\)/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

/**
 * Parses product specs from object/string into key-value object.
 * @param {string|object|null} specsData
 * @returns {object}
 */
function parseSpecs(specsData) {
  if (!specsData) return {};
  if (typeof specsData === 'object' && !Array.isArray(specsData)) return specsData;
  if (typeof specsData !== 'string') return {};

  const trimmed = specsData.trim();
  if (!trimmed) return {};

  // JSON-first parsing (current API shape).
  if ((trimmed.startsWith('{') && trimmed.endsWith('}')) || (trimmed.startsWith('[') && trimmed.endsWith(']'))) {
    try {
      const parsed = JSON.parse(trimmed);
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        return parsed;
      }
    } catch (error) {
      // Continue to pipe parsing fallback.
    }
  }

  // Legacy pipe format fallback: "key:value|key2:value2"
  const specs = {};
  trimmed.split('|').forEach(pair => {
    const separatorIndex = pair.indexOf(':');
    if (separatorIndex === -1) return;
    const key = pair.slice(0, separatorIndex).trim();
    const value = pair.slice(separatorIndex + 1).trim();
    if (!key || !value) return;
    specs[key.toLowerCase()] = value.toLowerCase();
  });
  return specs;
}

function normalizeSocketValue(value) {
  return String(value || '').trim().toLowerCase();
}

function normalizeManufacturerValue(value) {
  return String(value || '').trim().toLowerCase();
}

function formatSocketLabel(value) {
  const raw = String(value || '').trim();
  if (!raw) return '';
  return raw === raw.toLowerCase() ? raw.toUpperCase() : raw;
}

function formatManufacturerLabel(value) {
  return String(value || '').trim();
}

function ensureSocketOptions(category, containerId, inputName) {
  const container = document.getElementById(containerId);
  if (!container || !Array.isArray(allProducts)) {
    return;
  }

  const existingInputs = Array.from(container.querySelectorAll(`input[name="${inputName}"]`));
  const existingNormalized = new Set(existingInputs.map(input => normalizeSocketValue(input.value)));
  const discovered = [];

  allProducts.forEach(product => {
    if (!product || product.category !== category) {
      return;
    }
    const specs = parseSpecs(product.specs);
    const socketRaw = specs && specs.socket ? String(specs.socket).trim() : '';
    if (!socketRaw) {
      return;
    }
    const normalized = normalizeSocketValue(socketRaw);
    if (!normalized || existingNormalized.has(normalized)) {
      return;
    }
    existingNormalized.add(normalized);
    discovered.push(socketRaw);
  });

  if (discovered.length === 0) {
    return;
  }

  discovered
    .sort((a, b) => a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' }))
    .forEach(socketRaw => {
      const label = formatSocketLabel(socketRaw);
      if (!label) {
        return;
      }

      const wrapper = document.createElement('label');
      const input = document.createElement('input');
      input.type = 'checkbox';
      input.name = inputName;
      input.value = socketRaw;
      wrapper.appendChild(input);
      wrapper.append(` ${label}`);
      container.appendChild(wrapper);

      input.addEventListener('change', () => {
        const filtered = applyFilters();
        displayProducts(filtered);
      });
    });
}

function ensureDynamicSocketFilters() {
  ensureSocketOptions('cpu', 'cpuSocketOptions', 'cpu-socket');
  ensureSocketOptions('mobo', 'moboSocketOptions', 'mobo-socket');
}

function ensureManufacturerOptions(category, containerId, inputName) {
  const container = document.getElementById(containerId);
  if (!container || !Array.isArray(allProducts)) {
    return;
  }

  const existingInputs = Array.from(container.querySelectorAll(`input[name="${inputName}"]`));
  const existingNormalized = new Set(existingInputs.map(input => normalizeManufacturerValue(input.value)));
  const discovered = [];

  allProducts.forEach(product => {
    if (!product || product.category !== category) {
      return;
    }
    const specs = parseSpecs(product.specs);
    const manufacturerRaw = specs && specs.manufacturer ? String(specs.manufacturer).trim() : '';
    if (!manufacturerRaw) {
      return;
    }

    const normalized = normalizeManufacturerValue(manufacturerRaw);
    if (!normalized || existingNormalized.has(normalized)) {
      return;
    }

    existingNormalized.add(normalized);
    discovered.push(manufacturerRaw);
  });

  if (discovered.length === 0) {
    return;
  }

  discovered
    .sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }))
    .forEach(manufacturerRaw => {
      const label = formatManufacturerLabel(manufacturerRaw);
      if (!label) {
        return;
      }

      const wrapper = document.createElement('label');
      const input = document.createElement('input');
      input.type = 'checkbox';
      input.name = inputName;
      input.value = manufacturerRaw;
      wrapper.appendChild(input);
      wrapper.append(` ${label}`);
      container.appendChild(wrapper);

      input.addEventListener('change', () => {
        const filtered = applyFilters();
        displayProducts(filtered);
      });
    });
}

function ensureDynamicManufacturerFilters() {
  ensureManufacturerOptions('cpu', 'cpuManufacturerOptions', 'cpu-manufacturer');
  ensureManufacturerOptions('gpu', 'gpuManufacturerOptions', 'gpu-manufacturer');
}

const SPEC_KEY_LABELS = {
  manufacturer: 'MFG',
  memory: 'VRAM',
  capacity: 'CAP',
  speed: 'SPD',
  cores: 'CORES',
  threads: 'THR',
  socket: 'SOC',
  interface: 'BUS',
  type: 'TYPE',
  power: 'PWR',
  tdp: 'TDP',
  form_factor: 'FORM',
  rpm: 'RPM',
  cache: 'CACHE',
  efficiency: 'EFF',
  series: 'SER'
};

/**
 * Converts raw spec key into compact uppercase label for product tags.
 * @param {string} rawKey
 * @returns {string}
 */
function formatSpecKey(rawKey) {
  const key = String(rawKey || '').trim().toLowerCase();
  if (!key) return '';
  return SPEC_KEY_LABELS[key] || key.replace(/[_\s]+/g, '').slice(0, 8).toUpperCase();
}

/**
 * Normalizes spec values for compact UI tags.
 * @param {any} value
 * @returns {string}
 */
function normalizeSpecValue(value) {
  if (value === null || value === undefined) return '';
  const normalized = String(value).replace(/\s+/g, ' ').trim();
  return normalized.slice(0, 22);
}

/**
 * Builds compact product spec tags for Bento cards.
 * @param {object} product
 * @param {number} maxTags
 * @returns {string[]}
 */
function collectProductSpecTags(product, maxTags = 4) {
  const specs = parseSpecs(product ? product.specs : null);
  const tags = [];

  if (product && product.id !== undefined && product.id !== null) {
    tags.push(`SKU:${product.id}`);
  }

  for (const [rawKey, rawValue] of Object.entries(specs)) {
    if (tags.length >= maxTags) break;
    const key = formatSpecKey(rawKey);
    const value = normalizeSpecValue(rawValue);
    if (!key || !value) continue;
    tags.push(`${key}:${value}`);
  }

  return tags.slice(0, maxTags);
}

/**
 * Renders HTML for compact spec tags.
 * @param {object} product
 * @param {number} maxTags
 * @returns {string}
 */
function renderProductSpecTags(product, maxTags = 4) {
  const tags = collectProductSpecTags(product, maxTags);
  if (tags.length === 0) {
    return '<span class="spec-tag">Н/Д</span>';
  }
  return tags.map(tag => `<span class="spec-tag">${escapeHTML(tag)}</span>`).join('');
}

/**
 * Renders stock status line for product card.
 * @param {object} product
 * @returns {string}
 */
function renderStockStatus(product) {
  const stock = Number(product && product.stock ? product.stock : 0);
  if (stock > 0) {
    return `<span class="stock-status in-stock">В наявності: ${stock}</span>`;
  }
  return '<span class="stock-status out-of-stock">Немає в наявності</span>';
}

function hasVisibleDescription(rawDescription) {
  const normalized = String(rawDescription || '').trim();
  if (!normalized) return false;
  return normalized.toLowerCase() !== 'немає опису';
}

/**
 * Renders a single product card in Bento layout.
 * @param {object} product
 * @param {object} options
 * @returns {string}
 */
function renderProductCard(product, options = {}) {
  const descriptionLimit = Number.isFinite(options.descriptionLimit) ? options.descriptionLimit : 60;
  const specsLimit = Number.isFinite(options.specsLimit) ? options.specsLimit : 4;
  const name = escapeHTML(product && product.name ? product.name : '');
  const descriptionRaw = product && product.description ? String(product.description).trim() : '';
  const shouldRenderDescription = hasVisibleDescription(descriptionRaw);
  const truncatedDescription = shouldRenderDescription && descriptionRaw.length > descriptionLimit
    ? `${descriptionRaw.slice(0, descriptionLimit)}...`
    : descriptionRaw;
  const imageUrl = escapeHTML((product && product.image_url) || 'https://via.placeholder.com/250');
  const category = escapeHTML(getCategoryLabel(product && product.category));
  const price = formatPrice(product && product.price ? product.price : 0);
  const stock = Number(product && product.stock ? product.stock : 0);
  const disabledAttr = stock <= 0 ? 'disabled' : '';

  return `
    <div class="product-card" data-product-id="${product.id}">
      <div class="product-image">
        <img src="${imageUrl}"
             alt="${name}"
             onerror="this.src='https://via.placeholder.com/250?text=No+Image'">
      </div>

      <div class="product-info">
        <h3 class="product-name">${name}</h3>
        <p class="product-category">${category}</p>
        ${shouldRenderDescription ? `<p class="product-description">${escapeHTML(truncatedDescription)}</p>` : ''}

        <div class="product-specs">
          <div class="spec-tags">${renderProductSpecTags(product, specsLimit)}</div>
          ${renderStockStatus(product)}
        </div>

        <div class="product-footer">
          <span class="product-price">${price}</span>
          <button class="btn-add-cart" onclick="addToCart(${product.id})" ${disabledAttr}>
            Купити
          </button>
        </div>
      </div>
    </div>
  `;
}

/**
 * Adds click navigation for product cards inside a container.
 * Skips clicks on "add to cart" buttons.
 * @param {HTMLElement} container
 */
function attachProductCardNavigation(container) {
  if (!container) return;

  container.querySelectorAll('.product-card').forEach(card => {
    card.addEventListener('click', function(e) {
      // Не переходимо на деталі якщо клікнули на кнопку "Купити"
      if (e.target.closest('.btn-add-cart')) {
        return;
      }

      const productId = this.getAttribute('data-product-id');
      if (productId) {
        window.location.href = `product-detail.html?id=${productId}`;
      }
    });

    // Додаємо стиль для указівника
    card.style.cursor = 'pointer';
  });
}

/**
 * Checks if text value exists in the selected product fields.
 * @param {object} product
 * @param {string} searchValue
 * @param {string[]} searchFields
 * @returns {boolean}
 */
function searchProductField(product, searchValue, searchFields) {
  const needle = normalizeForSearch(searchValue);
  if (!needle) return false;

  const escapedNeedle = needle.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const needleRegex = new RegExp(escapedNeedle);

  for (const field of searchFields) {
    if (field === 'specs') {
      const specsObj = parseSpecs(product.specs);
      for (const [key, value] of Object.entries(specsObj)) {
        const haystack = normalizeForSearch(`${key} ${value}`);
        if (haystack.includes(needle) || needleRegex.test(haystack)) {
          return true;
        }
      }
      continue;
    }

    const haystack = normalizeForSearch(product[field]);
    if (haystack.includes(needle) || needleRegex.test(haystack)) {
      return true;
    }
  }

  return false;
}

/**
 * Matches product against currently selected category/sub-filters.
 * @param {object} product
 * @param {object} filters
 * @returns {boolean}
 */
function matchesFilters(product, filters) {
  if (filters.categories && filters.categories.length > 0 && !filters.categories.includes(product.category)) {
    return false;
  }

  const subfilterConfig = typeof SUBFILTER_CONFIG !== 'undefined' ? SUBFILTER_CONFIG : null;
  const categoryConfig = subfilterConfig ? subfilterConfig[product.category] : null;
  if (!categoryConfig) {
    return true;
  }

  for (const [filterKey, filterConfig] of Object.entries(categoryConfig)) {
    const selectedValues = filters[filterKey] || [];
    if (selectedValues.length === 0) continue;

    const searchFields = Array.isArray(filterConfig.searchFields) && filterConfig.searchFields.length > 0
      ? filterConfig.searchFields
      : ['name', 'description', 'specs'];

    const hasMatch = selectedValues.some(selectedValue => {
      const normalizedSelected = normalizeForSearch(selectedValue);
      return searchProductField(product, normalizedSelected, searchFields);
    });

    if (!hasMatch) {
      return false;
    }
  }

  return true;
}

/**
 * Застосовує всі активні фільтри та сортування
 * @returns {array} Відфільтровані та відсортовані товари
 */
function applyFilters() {
  // Збираємо актуальні фільтри з форми
  const filters = collectActiveFilters();

  // Фільтруємо товари
  let filtered = allProducts.filter(product => matchesFilters(product, filters));
  console.log(`🔍 Після фільтрації категорії/підфільтрів: ${filtered.length} товарів`);

  // Пошук за текстом (якщо введено)
  if (filters.search) {
    const searchLower = filters.search.toLowerCase();
    filtered = filtered.filter(p => 
      p.name.toLowerCase().includes(searchLower) ||
      (p.description && p.description.toLowerCase().includes(searchLower))
    );
    console.log(`🔎 Після пошуку "${filters.search}": ${filtered.length} товарів`);
  }

  // Сортування
  switch (filters.sort) {
    case 'price-asc':
      filtered.sort((a, b) => a.price - b.price);
      console.log('💰 Сортування: Ціна зростаюча');
      break;
    case 'price-desc':
      filtered.sort((a, b) => b.price - a.price);
      console.log('💰 Сортування: Ціна спадаюча');
      break;
    case 'name-asc':
      filtered.sort((a, b) => a.name.localeCompare(b.name, 'uk'));
      console.log('🔤 Сортування: Назва А-Я');
      break;
    default:
      console.log('📋 Сортування: За замовчуванням');
  }

  return filtered;
}

/**
 * Оновлює видимість підфільтрів залежно від обраних категорій
 */
function updateSubFilters() {
  const subFiltersContainer = document.getElementById('subFilters');
  
  // Якщо контейнера немає - вихід
  if (!subFiltersContainer) {
    console.warn('⚠️ Контейнер #subFilters не знайдений');
    return;
  }

  // Збираємо актуальні фільтри щоб перевірити обрані категорії
  const filters = collectActiveFilters();

  // Показуємо/приховуємо контейнер підфільтрів
  if (filters.categories.length > 0) {
    subFiltersContainer.classList.add('active');
    console.log('✅ Підфільтри активовані, категорії:', filters.categories);
  } else {
    subFiltersContainer.classList.remove('active');
    // Сховуємо всі підфільтри
    const allFilterDivs = subFiltersContainer.querySelectorAll('.sub-filter-group');
    allFilterDivs.forEach(div => div.style.display = 'none');
    console.log('⚠️ Підфільтри деактивовані');
    return;
  }

  // Отримуємо посилання на всі фільтр-групи
  const cpuFiltersDiv = document.getElementById('cpuFilters');
  const gpuFiltersDiv = document.getElementById('gpuFilters');
  const ramFiltersDiv = document.getElementById('ramFilters');
  const ssdFiltersDiv = document.getElementById('ssdFilters');
  const hddFiltersDiv = document.getElementById('hddFilters');
  const moboFiltersDiv = document.getElementById('moboFilters');
  const psuFiltersDiv = document.getElementById('psuFilters');

  // Перевіряємо наявність категорій
  const hasCPU = filters.categories.includes('cpu');
  const hasGPU = filters.categories.includes('gpu');
  const hasRAM = filters.categories.includes('ram');
  const hasSSD = filters.categories.includes('ssd');
  const hasHDD = filters.categories.includes('hdd');
  const hasMOBO = filters.categories.includes('mobo');
  const hasPSU = filters.categories.includes('psu');

  // Показуємо/приховуємо фільтри залежно від обраних категорій
  if (cpuFiltersDiv) {
    cpuFiltersDiv.style.display = hasCPU ? 'block' : 'none';
    if (hasCPU) console.log('⚙️ CPU фільтри показані');
  }
  if (gpuFiltersDiv) {
    gpuFiltersDiv.style.display = hasGPU ? 'block' : 'none';
    if (hasGPU) console.log('📺 GPU фільтри показані');
  }
  if (ramFiltersDiv) {
    ramFiltersDiv.style.display = hasRAM ? 'block' : 'none';
    if (hasRAM) console.log('🔷 RAM фільтри показані');
  }
  if (ssdFiltersDiv) {
    ssdFiltersDiv.style.display = hasSSD ? 'block' : 'none';
    if (hasSSD) console.log('💾 SSD фільтри показані');
  }
  if (hddFiltersDiv) {
    hddFiltersDiv.style.display = hasHDD ? 'block' : 'none';
    if (hasHDD) console.log('💽 HDD фільтри показані');
  }
  if (moboFiltersDiv) {
    moboFiltersDiv.style.display = hasMOBO ? 'block' : 'none';
    if (hasMOBO) console.log('🖥️ MOBO фільтри показані');
  }
  if (psuFiltersDiv) {
    psuFiltersDiv.style.display = hasPSU ? 'block' : 'none';
    if (hasPSU) console.log('⚡ PSU фільтри показані');
  }
}

/**
 * Завантажує список товарів з сервера
 * ✅ З ПОЛІПШЕНОЮ ОБРОБКОЮ ПОМИЛОК
 * @param {object} filters - Фільтри (category, search, sort)
 */
async function loadProducts(filters = {}) {
  console.log('📥 Завантаження товарів з API...');

  // Формуємо query параметри
  const queryParams = new URLSearchParams();
  if (filters.category) queryParams.append('category', filters.category);
  if (filters.search) queryParams.append('search', filters.search);
  if (filters.sort) queryParams.append('sort', filters.sort);
  // Більша кількість за замовчуванням, щоб нові товари не "випадали" з перших 20
  if (filters.limit) {
    queryParams.append('limit', filters.limit);
  } else {
    queryParams.append('limit', '100');
  }

  // Тестові товари як fallback, якщо БД недоступна
  const FALLBACK_PRODUCTS = [
    // CPU
    {id: 1, name: 'Intel Core i9-13900K', price: 6500.00, category: 'cpu', stock: 5, description: 'Топовий процесор для ігор та роботи', image_url: 'https://via.placeholder.com/250?text=CPU+i9', specs: {cores: 24, threads: 32, tdp: 253, socket: 'LGA1700'}},
    {id: 2, name: 'AMD Ryzen 7 7700X', price: 4200.00, category: 'cpu', stock: 8, description: 'Гідний процесор середнього рівня', image_url: 'https://via.placeholder.com/250?text=CPU+Ryzen', specs: {cores: 8, threads: 16, tdp: 105, socket: 'AM5'}},
    {id: 3, name: 'Intel Core i7-13700K', price: 5200.00, category: 'cpu', stock: 6, description: 'Потужний процесор для роботи і ігор', image_url: 'https://via.placeholder.com/250?text=CPU+i7', specs: {cores: 16, threads: 24, tdp: 253, socket: 'LGA1700'}},
    {id: 4, name: 'AMD Ryzen 5 7600X', price: 2800.00, category: 'cpu', stock: 12, description: 'Доступний процесор для повсякденного використання', image_url: 'https://via.placeholder.com/250?text=CPU+R5', specs: {cores: 6, threads: 12, tdp: 105, socket: 'AM5'}},
    
    // GPU
    {id: 5, name: 'NVIDIA RTX 4090', price: 89000.00, category: 'gpu', stock: 3, description: 'Найпотужніша відеокарта на ринку', image_url: 'https://via.placeholder.com/250?text=RTX+4090', specs: {memory: '24GB GDDR6X', cuda: 16384, series: 'RTX 40'}},
    {id: 6, name: 'NVIDIA RTX 4080', price: 55000.00, category: 'gpu', stock: 5, description: 'Топовий флагман для 4K ігор', image_url: 'https://via.placeholder.com/250?text=RTX+4080', specs: {memory: '16GB GDDR6X', cuda: 9728, series: 'RTX 40'}},
    {id: 7, name: 'NVIDIA RTX 3080 Ti', price: 35000.00, category: 'gpu', stock: 4, description: 'Поточна відеокарта попередньої генерації', image_url: 'https://via.placeholder.com/250?text=RTX+3080', specs: {memory: '12GB GDDR6X', cuda: 10240, series: 'RTX 30'}},
    {id: 8, name: 'AMD Radeon RX 7900 XTX', price: 48000.00, category: 'gpu', stock: 6, description: 'Могутня AMD відеокарта', image_url: 'https://via.placeholder.com/250?text=RX+7900', specs: {memory: '24GB GDDR6', cuda: 0, series: 'RX 7000'}},
    {id: 9, name: 'NVIDIA RTX 4070', price: 28000.00, category: 'gpu', stock: 10, description: 'Гідна видеокарта для 1440p', image_url: 'https://via.placeholder.com/250?text=RTX+4070', specs: {memory: '12GB GDDR6', cuda: 5888, series: 'RTX 40'}},
    {id: 10, name: 'AMD Radeon RX 7800 XT', price: 32000.00, category: 'gpu', stock: 7, description: 'Чудова альтернатива RTX', image_url: 'https://via.placeholder.com/250?text=RX+7800', specs: {memory: '16GB GDDR6', cuda: 0, series: 'RX 7000'}},
    
    // RAM
    {id: 11, name: 'Kingston Fury Beast 32GB DDR5', price: 8500.00, category: 'ram', stock: 10, description: 'Швидка оперативна пам\'ять DDR5', image_url: 'https://via.placeholder.com/250?text=RAM+32GB', specs: {capacity: '32GB', speed: 'DDR5-6000'}},
    {id: 12, name: 'G.Skill Trident Z5 32GB DDR5', price: 9200.00, category: 'ram', stock: 8, description: 'Екстремально швидка пам\'ять для OverClock', image_url: 'https://via.placeholder.com/250?text=RAM+Trident', specs: {capacity: '32GB', speed: 'DDR5-6400'}},
    
    // SSD
    {id: 13, name: 'Samsung 980 Pro 2TB NVMe', price: 18000.00, category: 'ssd', stock: 8, description: 'SSD накопичувач з максимальною швидкістю', image_url: 'https://via.placeholder.com/250?text=SSD+Samsung', specs: {capacity: '2TB', interface: 'NVMe M.2'}},
    {id: 14, name: 'WD Black SN850X 1TB', price: 9500.00, category: 'ssd', stock: 12, description: 'Швидкий SSD від WD', image_url: 'https://via.placeholder.com/250?text=SSD+WD+Black', specs: {capacity: '1TB', interface: 'NVMe M.2'}},
  ];

  try {
    const result = await apiCall(`/products?${queryParams.toString()}`);

    // ✅ Перевірка статусу від API
    if (!result.success || !result.data) {
      throw new Error(result.error || 'Невалідна відповідь від сервера');
    }

    const data = result.data.data || result.data;
    if (!data || data.length === 0) {
      throw new Error('Товари не знайдені в базі даних');
    }

    console.log(`✅ Завантажено ${data.length} товарів`);
    allProducts = data;

  } catch (error) {
    console.error('❌ Помилка при завантаженні товарів:', error);
    
    // ✅ Показуємо дружану помилку користувачу
    const errorMessage = error.message || 'Неповідомлена помилка';
    showNotification(`Помилка при завантаженні товарів: ${errorMessage}`, 'error');
    
    // ✅ Використовуємо fallback товари
    console.warn('⚠️ Використовуємо тестові товари...');
    allProducts = FALLBACK_PRODUCTS;
  }
  
  // Динамічно додаємо нові сокети у фільтри, якщо вони є в товарах
  ensureDynamicSocketFilters();
  // Динамічно додаємо нових виробників у фільтри CPU/GPU
  ensureDynamicManufacturerFilters();

  // Відображаємо відфільтровані товари
  const filtered = applyFilters();
  displayProducts(filtered);
}

/**
 * Отримує деталі одного товару
 * @param {number} productId - ID товару
 */
async function getProductDetails(productId) {
  const result = await apiCall(`/products/${productId}`);
  if (result.success) {
    return result.data.data;
  } else {
    showNotification(`Товар не знайдений: ${result.error}`, 'error');
    return null;
  }
}

/**
 * Завантажує та відображає популярні товари на головній сторінці
 * Показує топ товарів на основі замовлень (з фолбеком)
 */
async function displayFeaturedProducts() {
  const featuredGridContainer = document.getElementById('featuredGrid');
  
  // Якщо контейнера нема - не потрібно завантажувати
  if (!featuredGridContainer) {
    console.log('ℹ️ Контейнер #featuredGrid не знайдений - пропускаємо загрузку популярних товарів');
    return;
  }

  console.log('📌 Завантаження популярних товарів...');

  let featured = [];

  // 1) Пробуємо отримати реальні популярні товари з бекенду
  try {
    const popularResult = await apiCall('/products/popular?limit=6');
    if (popularResult.success && popularResult.data) {
      const popularData = popularResult.data.data || popularResult.data;
      if (Array.isArray(popularData) && popularData.length > 0) {
        featured = popularData.slice(0, 6);
      }
    }
  } catch (error) {
    console.warn('⚠️ Не вдалося завантажити популярні товари з API:', error);
  }

  try {
    // 2) Якщо популярних нема - беремо з already loaded або робимо фолбек
    if (featured.length === 0 && allProducts && allProducts.length > 0) {
      console.log(`✅ Використовуємо вже завантажені товари (всього ${allProducts.length})`);
      featured = allProducts.slice(0, 6);
    }

    if (featured.length === 0) {
      const result = await apiCall('/products?limit=6');

      if (!result.success || !result.data) {
        throw new Error(result.error || 'Невалідна відповідь від сервера');
      }

      const data = result.data.data || result.data;
      if (!data || data.length === 0) {
        throw new Error('Товари не знайдені');
      }

      featured = data.slice(0, 6);
    }

    console.log(`📍 Вибрано ${featured.length} популярних товарів`);

    const productsHTML = featured
      .map(product => renderProductCard(product, { descriptionLimit: 60, specsLimit: 4 }))
      .join('');

    featuredGridContainer.innerHTML = productsHTML;
    attachProductCardNavigation(featuredGridContainer);
    console.log('✅ Популярні товари відображені');

  } catch (error) {
    console.error('❌ Помилка при завантаженні популярних товарів:', error);
    featuredGridContainer.innerHTML = '<p class="no-products" style="grid-column: 1/-1; text-align: center; padding: 2rem; color: var(--text-muted);">😢 Помилка при завантаженні товарів</p>';
  }
}

/**
 * Відображає товари на сторінці
 * @param {array} products - Масив товарів
 */
function displayProducts(products) {
  const container = document.getElementById('products-container') || 
                   document.querySelector('.products-grid');

  if (!container) {
    console.warn('⚠️ Container для товарів не знайдений');
    return;
  }

  // Якщо товарів нема
  if (products.length === 0) {
    container.innerHTML = '<p class="no-products" style="grid-column: 1/-1; text-align: center; padding: 3rem; color: var(--text-muted);">😢 Товари не знайдені. Спробуйте змінити фільтри.</p>';
    return;
  }

  // 🧹 Очищуємо контейнер перед рендерингом нових товарів
  container.innerHTML = '';

  // Генеруємо HTML для кожного товару
  const productsHTML = products
    .map(product => renderProductCard(product, { descriptionLimit: 60, specsLimit: 5 }))
    .join('');

  container.innerHTML = productsHTML;

  // Додаємо обробники кліків для переходу на сторінку деталей
  attachProductCardNavigation(container);

  // Оновлюємо лічильник знайдених товарів
  const itemsFound = document.getElementById('itemsFound');
  if (itemsFound) {
    itemsFound.textContent = `Знайдено: ${products.length}`;
  }
}

// ============= ФУНКЦІЇ УПРАВЛІННЯ КОШИКОМ =============

/**
 * Додає товар до кошика
 * @param {number} productId - ID товару
 */
async function addToCart(productId) {
  console.log(`➕ Додавання товару id=${productId} до кошика`);
  
  // Шукаємо товар у локальних даних (використовуємо allProducts)
  let product = allProducts.find(p => p.id === productId);

  // Якщо не знайдено - завантажуємо з сервера
  if (!product) {
    console.warn(`⚠️ Товар id=${productId} не знайдений в локальному списку, завантажуємо з сервера`);
    product = await getProductDetails(productId);
  }

  if (!product) {
    console.error(`❌ Не вдалося знайти товар id=${productId}`);
    showNotification('Не вдалося додати товар до кошика', 'error');
    return;
  }

  // ✅ НОВЕ: Перевірка наявності запасів
  if (product.stock <= 0) {
    console.warn(`⚠️ Товар id=${productId} немає в наявності`);
    showNotification('Товар відсутній на складі', 'error');
    return;
  }

  // Перевіряємо чи товар вже в кошику
  const existingItem = cart.find(item => item.id === productId);

  if (existingItem) {
    // ✅ НОВЕ: Перевірка чи не перевищено доступну кількість
    if (existingItem.quantity >= product.stock) {
      console.warn(`⚠️ Товар id=${productId} неможливо додати - перевищено доступну кількість`);
      showNotification(`Доступно лише ${product.stock} ${product.stock === 1 ? 'одиниця' : 'одиниць'} цього товару`, 'error');
      return;
    }
    existingItem.quantity += 1;
    console.log(`📦 Товар вже в кошику. Збільшена кількість на 1. Всього: ${existingItem.quantity}`);
  } else {
    cart.push({
      id: product.id,
      name: product.name,
      price: product.price,
      image_url: product.image_url,
      quantity: 1
    });
    console.log(`🆕 Товар доданий до кошика`);
  }

  // 🔍 DEBUG: Логуємо стан кошика перед зберіганням
  console.log(`✅ Поточний стан кошика:`, cart);

  // Зберігаємо кошик в localStorage з ключем 'rtk_cart'
  localStorage.setItem('rtk_cart', JSON.stringify(cart));
  console.log(`💾 Кошик збережений в localStorage['rtk_cart']`);

  // Оновлюємо UI
  updateCartCount();
  updateCartUI();
  showNotification(`"${product.name}" додано до кошика`, 'success');
}

/**
 * Видаляє товар з кошика
 * @param {number} productId - ID товару
 */
function removeFromCart(productId) {
  console.log(`❌ Видалення товару id=${productId} з кошика`);
  cart = cart.filter(item => item.id !== productId);
  localStorage.setItem('rtk_cart', JSON.stringify(cart));
  console.log(`✅ Товар видалений. Новий стан кошика:`, cart);
  updateCartUI();  // ← Викликаємо updateCartUI() замість displayCart()
}

/**
 * Оновлює кількість товару в кошику
 * @param {number} productId - ID товару
 * @param {number} quantity - Нова кількість
 */
function updateCartQuantity(productId, quantity) {
  const quantityNum = parseInt(quantity);
  console.log(`🔢 Оновлення кількості товару id=${productId} на ${quantityNum}`);
  
  const item = cart.find(item => item.id === productId);
  if (item) {
    if (quantityNum <= 0) {
      console.log(`➖ Видалення товару (кількість <= 0)`);
      removeFromCart(productId);
    } else {
      // ✅ НОВЕ: Перевірка наявності запасів у товарі
      const product = allProducts.find(p => p.id === productId);
      if (product && quantityNum > product.stock) {
        console.warn(`⚠️ Кількість перевищує доступні запаси (${product.stock})`);
        showNotification(`Доступно лише ${product.stock} ${product.stock === 1 ? 'одиниця' : 'одиниць'} цього товару`, 'error');
        return;
      }
      item.quantity = quantityNum;
      localStorage.setItem('rtk_cart', JSON.stringify(cart));
      console.log(`✅ Оновлено. Новий стан кошика:`, cart);
      updateCartUI();  // ← Викликаємо updateCartUI() замість displayCart()
    }
  } else {
    console.warn(`⚠️ Товар id=${productId} не знайдений в кошику`);
  }
}

/**
 * Оновлює лічильник товарів у кошику
 */
function updateCartCount() {
  const cartCountElements = document.querySelectorAll('#cartCount, .cart-count');
  const totalItems = cart.reduce((sum, item) => sum + item.quantity, 0);
  
  cartCountElements.forEach(el => {
    el.textContent = totalItems;
    el.style.display = totalItems > 0 ? 'flex' : 'none';
  });
}

/**
 * Рендерить вміст кошика (окремо від UI оновлення)
 * @returns {string} HTML для відображення товарів
 */
function renderCart() {
  // 🔍 DEBUG: Перевіряємо масив товарів перед рендерингом
  console.log('🛒 renderCart() виконується. Вміст кошика:', cart);
  console.log(`📊 Кількість товарів: ${cart.length}`);

  if (cart.length === 0) {
    console.log('⚠️ Кошик порожній');
    return '<p class="empty-cart">🛒 Кошик порожній</p>';
  }

  // Генеруємо HTML для кожного товару в кошику
  const cartHTML = cart.map(item => {
    console.log(`📦 Товар: ${item.name}, кількість: ${item.quantity}`);
    return `
    <div class="cart-item" data-product-id="${item.id}">
      <img src="${escapeHTML(item.image_url)}" alt="${escapeHTML(item.name)}" 
           onerror="this.src='https://via.placeholder.com/80'">
      <div class="item-details">
        <h4>${escapeHTML(item.name)}</h4>
        <p>${formatPrice(item.price)} x${item.quantity}</p>
  <span class="item-subtotal">${formatPrice(item.price * item.quantity)}</span>
      </div>
      <div class="item-controls">
        <button onclick="updateCartQuantity(${item.id}, ${item.quantity - 1})">-</button>
        <input type="number" value="${item.quantity}" 
               onchange="updateCartQuantity(${item.id}, parseInt(this.value))">
        <button onclick="updateCartQuantity(${item.id}, ${item.quantity + 1})">+</button>
      </div>
      <button class="remove-btn" onclick="removeFromCart(${item.id})">✕</button>
    </div>
  `;
  }).join('');

  // Обчислюємо суму
  const total = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
  console.log('💰 Сума кошика:', formatPrice(total));

  return cartHTML;
}

/**
 * Оновлює UI кошика (викликає renderCart та оновлює контейнери)
 */
function updateCartUI() {
  console.log('🔄 updateCartUI() викликається');
  
  // Оновлюємо контейнер з товарами
  const cartContainer = document.getElementById('cart-container');
  if (cartContainer) {
    const renderedCart = renderCart();
    cartContainer.innerHTML = renderedCart;
    console.log('✅ Контейнер #cart-container оновлений');
  } else {
    console.warn('⚠️ Контейнер #cart-container не знайдений');
  }

  // Оновлюємо загальну суму
  const total = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
  const cartTotalEl = document.getElementById('cartTotal');
  if (cartTotalEl) {
    cartTotalEl.textContent = formatPrice(total);
    console.log('✅ Лічильник суми оновлений:', formatPrice(total));
  }

  // Оновлюємо лічильник товарів
  updateCartCount();
}

/**
 * Відображає вміст кошика (основна функція для відкриття модалки)
 */
function displayCart() {
  console.log('📱 displayCart() викликається - відкриття модалки кошика');
  
  // Оновлюємо UI через updateCartUI()
  updateCartUI();

  // Показуємо модальне вікно
  const cartModal = document.getElementById('cartModal');
  if (cartModal) {
    cartModal.classList.add('visible');
    // Додаємо клас на body щоб вимкнути горизонтальний скрол при відкритому кошику
    document.body.classList.add('cart-open');
    console.log('✅ Модалка кошика відкрита');
  } else {
    console.warn('⚠️ Модальне вікно #cartModal не знайдено');
  }
}

/**
 * Відкриває модальне вікно при оформленні замовлення
 * ✅ ЗАМІСТЬ prompt() - красива форма
 * ✅ ЯКЩО КОРИСТУВАЧ ЗАЛОГІНЕНИЙ - ПІДСТАВЛЯЮТЬСЯ ЙОГО ДАНІ
 */
async function checkout() {
  if (!Array.isArray(cart) || cart.length === 0) {
    showNotification('Кошик порожній. Додайте товари перед оформленням.', 'error');
    return;
  }

  // Отримуємо користувача якщо він залогінений
  const user = getCurrentUser();

  // Отримуємо або створюємо контейнер для форми
  let checkoutModal = document.getElementById('checkoutModal');
  
  if (!checkoutModal) {
    checkoutModal = document.createElement('div');
    checkoutModal.id = 'checkoutModal';
    checkoutModal.className = 'checkout-modal';
    
    // Визначаємо значення за замовчуванням (з акаунту або пусто)
    const defaultName = user ? user.username : '';
    const defaultEmail = user ? user.email : '';
    const defaultPhone = user ? (user.phone || '') : '';
    const defaultAddress = user ? (user.default_address || '') : '';

    checkoutModal.innerHTML = `
      <div class="checkout-content">
        <button type="button" class="checkout-close" onclick="closeCheckoutModal()">✕</button>
        <h3>Оформлення замовлення</h3>
        
        ${user ? `
          <div style="
            background: var(--primary);
            opacity: 0.1;
            padding: 1rem;
            border-radius: 8px;
            margin-bottom: 1.5rem;
            border-left: 4px solid var(--primary);
          ">
            <p style="margin: 0; color: var(--text-main); font-size: 0.9rem;">
              ✅ Дані вашого профілю автоматично підставлені. Ви можете їх змінити при необхідності.
            </p>
          </div>
        ` : ''}
        
        <div class="checkout-summary">
          <p>Товарів у кошику: <strong id="checkoutItemCount">0</strong></p>
          <p>Сума: <strong id="checkoutTotal">0 грн</strong></p>
        </div>
        <form id="checkoutForm">
          <div class="form-group">
            <label>Ваше ім'я:</label>
            <input 
              type="text" 
              id="checkout-name" 
              placeholder="Іван Петренко"
              value="${defaultName}"
              required
            >
          </div>
          <div class="form-group">
            <label>Email:</label>
            <input 
              type="email" 
              id="checkout-email" 
              placeholder="vashen@example.com"
              value="${defaultEmail}"
              required
            >
          </div>
          <div class="form-group">
            <label>Телефон:</label>
            <input 
              type="tel" 
              id="checkout-phone" 
              placeholder="+380991234567"
              value="${defaultPhone}"
              required
            >
          </div>
          <div class="form-group">
            <label>Адреса доставки:</label>
            <textarea 
              id="checkout-address" 
              placeholder="м. Київ, вул. Хрещатик, 1"
              required 
              rows="3"
            >${defaultAddress}</textarea>
          </div>
          <div class="form-actions">
            <button type="submit" class="btn btn-primary" style="flex: 1;">
              Підтвердити замовлення
            </button>
            <button 
              type="button" 
              class="btn btn-secondary" 
              style="flex: 1;"
              onclick="closeCheckoutModal()"
            >
              Скасувати
            </button>
          </div>
        </form>
      </div>
    `;
    document.body.appendChild(checkoutModal);

    // Обробник форми - видаляємо старий обробник перед додаванням нового
    const checkoutForm = document.getElementById('checkoutForm');
    const newForm = checkoutForm.cloneNode(true);
    checkoutForm.parentNode.replaceChild(newForm, checkoutForm);
    
    newForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      
      if (!Array.isArray(cart) || cart.length === 0) {
        showNotification('Кошик порожній. Додайте товари перед оформленням.', 'error');
        return;
      }

      const name = document.getElementById('checkout-name').value.trim();
      const email = document.getElementById('checkout-email').value.trim();
      const phone = document.getElementById('checkout-phone').value.trim();
      const address = document.getElementById('checkout-address').value.trim();

      // ✅ Валідація
      if (!name || !email || !phone || !address) {
        showNotification('Будь ласка, заповніть усі поля', 'error');
        return;
      }

      if (name.length < 3) {
        showNotification('Ім\'я повинно містити щонайменше 3 символи', 'error');
        return;
      }

      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email)) {
        showNotification('Введіть дійсну email-адресу', 'error');
        return;
      }

      // ✅ НОВЕ: Валідація телефону (мінімум 10 цифр)
      const phoneDigits = phone.replace(/\D/g, '');
      if (phoneDigits.length < 10) {
        showNotification('Введіть коректний номер телефону (мінімум 10 цифр)', 'error');
        return;
      }

      if (address.length < 5) {
        showNotification('Введіть повну адресу доставки', 'error');
        return;
      }

      const totalPrice = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);

      // Відправляємо замовлення
      const result = await apiCall('/orders', 'POST', {
        customer_name: name,
        customer_email: email,
        customer_phone: phone,
        customer_address: address,
        total_price: totalPrice,
        items: cart
      });

      if (result.success) {
        showNotification("Замовлення успішно оформлено! Ми скоро з вами зв'яжемося", 'success');
        cart = [];
        localStorage.removeItem('rtk_cart');
        updateCartCount();
        closeCheckoutModal();
        
        // Закриваємо кошик
        const cartModal = document.getElementById('cartModal');
        if (cartModal) {
          cartModal.classList.remove('visible');
          document.body.classList.remove('cart-open');
        }
      } else {
        showNotification(`Помилка: ${result.error}`, 'error');
      }
    });
  }

  // Оновлюємо значення полів при кожному відкритті (якщо є дані профілю)
  if (user) {
    const nameInput = document.getElementById('checkout-name');
    const emailInput = document.getElementById('checkout-email');
    const phoneInput = document.getElementById('checkout-phone');
    const addressInput = document.getElementById('checkout-address');

    if (nameInput) nameInput.value = user.username || '';
    if (emailInput) emailInput.value = user.email || '';
    if (phoneInput) phoneInput.value = user.phone || '';
    if (addressInput) addressInput.value = user.default_address || '';
  }

  // Оновлюємо інформацію
  const totalPrice = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
  document.getElementById('checkoutItemCount').textContent = cart.length;
  document.getElementById('checkoutTotal').textContent = formatPrice(totalPrice);

  checkoutModal.classList.add('visible');
}

/**
 * Закриває модальне вікно оформлення
 */
function closeCheckoutModal() {
  const modal = document.getElementById('checkoutModal');
  if (modal) {
    modal.classList.remove('visible');
  }
}

// ============= ФОРМА ЗВОРОТНОГО ЗВ'ЯЗКУ =============


async function submitContactForm(event) {
  if (event) event.preventDefault();

  const form = document.getElementById('contactForm') || event?.target;
  const formData = new FormData(form);

  const contactData = {
    name: (formData.get('name') || '').trim(),
    email: (formData.get('email') || '').trim(),
    phone: (formData.get('phone') || '').trim(),
    subject: (formData.get('subject') || '').trim(),
    message: (formData.get('message') || '').trim()
  };

  if (!contactData.name || !contactData.email || !contactData.message) {
    showNotification('Будь ласка, заповніть усі обов\'язкові поля коректно', 'error');
    return;
  }

  if (contactData.message.length < 10) {
    showNotification('Повідомлення повинно містити щонайменше 10 символів', 'error');
    return;
  }

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(contactData.email)) {
    showNotification('Будь ласка, введіть коректну email-адресу', 'error');
    return;
  }

  const result = await apiCall('/contacts', 'POST', contactData);

  if (result.success) {
    showNotification('Ваше повідомлення успішно надіслано! Дякуємо!', 'success');
    form.reset();
  } else {
    showNotification(`Помилка під час надсилання: ${result.error}`, 'error');
  }
}

// ============= INITIALIZATION (ініціалізація) =============

/**
 * Ініціалізує обробники подій для фільтрів категорій
 */
function initializeCategoryFilters() {
  const categoryCheckboxes = document.querySelectorAll('#categoryFilters input[type="checkbox"]');
  
  categoryCheckboxes.forEach(checkbox => {
    checkbox.addEventListener('change', (e) => {
      const value = e.target.value;
      
      console.log(`${e.target.checked ? '✓' : '✗'} Категорія: ${value}`);

      // Очищуємо підфільтри при вимиканні категорії
      if (!e.target.checked) {
        if (value === 'gpu') {
          // Вимикаємо GPU підфільтри
          document.querySelectorAll('input[name="gpu-memory"]').forEach(cb => cb.checked = false);
          document.querySelectorAll('input[name="gpu-series"]').forEach(cb => cb.checked = false);
        } else if (value === 'cpu') {
          // Вимикаємо CPU підфільтри
          document.querySelectorAll('input[name="cpu-cores"]').forEach(cb => cb.checked = false);
          document.querySelectorAll('input[name="cpu-socket"]').forEach(cb => cb.checked = false);
        }
      }

      // Оновлюємо видимість підфільтрів та фільтруємо товари
      updateSubFilters();
      const filtered = applyFilters();
      displayProducts(filtered);
    });
  });
}

/**
 * Ініціалізує обробники для всіх підфільтрів на основі SUBFILTER_CONFIG
 * УНІВЕРСАЛЬНА функція для всіх категорій
 */
function initializeSubFilters() {
  const subfilterConfig = typeof SUBFILTER_CONFIG !== 'undefined' ? SUBFILTER_CONFIG : null;
  if (!subfilterConfig) {
    console.log('ℹ️ SUBFILTER_CONFIG не завантажено, підфільтри пропущено');
    return;
  }

  // Для кожної категорії в конфігурації
  for (const [categoryKey, categoryConfig] of Object.entries(subfilterConfig)) {
    // Для кожного фільтру в категорії (e.g., "manufacturer", "cores", "vram")
    for (const [filterKey, filterConfig] of Object.entries(categoryConfig)) {
      // Шукаємо всі чекбокси з name: "category-filterkey" (e.g. "cpu-manufacturer")
      const checkboxSelector = `input[name="${categoryKey}-${filterKey}"]`;
      const checkboxes = document.querySelectorAll(checkboxSelector);

      checkboxes.forEach(checkbox => {
        checkbox.addEventListener('change', (e) => {
          const status = e.target.checked ? '✓' : '✗';
          console.log(`${status} ${categoryKey}-${filterKey}: ${e.target.value}`);
          
          // Перепрацьовуємо фільтри та відображаємо товари
          const filtered = applyFilters();
          displayProducts(filtered);
        });
      });
    }
  }

  console.log('✅ Підфільтри ініціалізовані (динамічна конфігурація)');
}

/**
 * Ініціалізує додаток при завантаженні сторінки
 */
document.addEventListener('DOMContentLoaded', () => {
  console.log('🚀 РТК Hardware App запущена');

  //  Оновлюємо стан кнопки входу на основі переточного користувача
  updateAuthUI();

  //  ЧИТАЄМО ПАРАМЕТРИ З URL (напр. ?type=cpu)
  const urlParams = new URLSearchParams(window.location.search);
  const typeParam = urlParams.get('type');
  
  if (typeParam) {
    console.log(`📌 Знайдено параметр type в URL: ${typeParam}`);
  }

  // Завантажуємо товари
  loadProducts().finally(() => {
    displayFeaturedProducts();
  });


  updateCartCount();

  initializeCategoryFilters();
  
  initializeSubFilters();

  if (typeParam) {
    const categoryCheckbox = document.querySelector(`#categoryFilters input[value="${typeParam}"]`);
    if (categoryCheckbox) {
      categoryCheckbox.checked = true;
      console.log(`✅ Чекбокс категорії "${typeParam}" встановлено як обраний`);
      
      // Застосовуємо фільтри для правильного відображення товарів
      updateSubFilters();
      const filtered = applyFilters();
      displayProducts(filtered);
      console.log(`🔄 Фільтри застосовано для категорії "${typeParam}"`);
    } else {
      console.warn(`⚠️ Чекбокс для категорії "${typeParam}" не знайдений`);
    }
  }

  // Встановлюємо обробники подій для пошуку та сортування
  const searchInput = document.getElementById('search');
  if (searchInput) {
    const debouncedSearch = debounce((e) => {
      console.log(` Пошук: "${e.target.value}"`);
      const filtered = applyFilters();
      displayProducts(filtered);
    }, 300); // 300ms затримка

    searchInput.addEventListener('input', debouncedSearch);
  }

  const sortSelect = document.getElementById('sortSelect');
  if (sortSelect) {
    sortSelect.addEventListener('change', (e) => {
      console.log(`↕ Сортування: ${e.target.value}`);
      const filtered = applyFilters();
      displayProducts(filtered);
    });
  }

  // Форма контакту використовує inline onsubmit у HTML.
  // Не додаємо другий submit-обробник, щоб уникнути подвійної відправки.

  // ========== ОБРОБНИКИ МОДАЛКИ КОШИКА ==========
  
  // Кнопка для відкриття кошика
  const cartBtn = document.getElementById('cartBtn');
  if (cartBtn) {
    cartBtn.addEventListener('click', () => {
      console.log(' Клік на кнопку кошика - відкриття модалки');
      displayCart();
    });
  } else {
    console.warn(' Кнопка #cartBtn не знайдена');
  }

  // Кнопка для закриття кошика
  const closeCartBtn = document.getElementById('closeCart');
  if (closeCartBtn) {
    closeCartBtn.addEventListener('click', () => {
      console.log(' Клік на закриття кошика - закриття модалки');
      const cartModal = document.getElementById('cartModal');
      if (cartModal) {
        cartModal.classList.remove('visible');
        // Видаляємо клас, що блокує горизонтальний скрол
        document.body.classList.remove('cart-open');
      }
    });
  } else {
    console.warn(' Кнопка #closeCart не знайдена');
  }

  // Закриття модалки при кліку за межами (на overlay)
  const cartModal = document.getElementById('cartModal');
  if (cartModal) {
    cartModal.addEventListener('click', (e) => {
      // Закриваємо модалку тільки при кліку на фон/overlay (не на вміст панелі)
      if (e.target === cartModal) {
        console.log(' Клік на overlay - закриття модалки');
        cartModal.classList.remove('visible');
        document.body.classList.remove('cart-open');
      }
    });
  }

  //  ЗАКРИТТЯ МОДАЛКИ ПРИ НАТИСКАННІ ESCAPE
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' || e.code === 'Escape') {
      const cartModal = document.getElementById('cartModal');
      if (cartModal && cartModal.classList.contains('visible')) {
        console.log(' Escape - закриття модалки кошика');
        cartModal.classList.remove('visible');
        document.body.classList.remove('cart-open');
      }
    }
  });

  // ==========  МОБІЛЬНЕ МЕНЮ ==========
  const mobileMenuBtn = document.getElementById('mobileMenuBtn');
  const mainNav = document.getElementById('mainNav');

  if (mobileMenuBtn && mainNav) {
    mobileMenuBtn.addEventListener('click', () => {
      const isActive = mainNav.classList.toggle('active');
      mobileMenuBtn.classList.toggle('active');
      mobileMenuBtn.setAttribute('aria-expanded', isActive);
      console.log('📱 Мобільне меню ' + (isActive ? 'відкрито' : 'закрито'));
    });

    // Закриємо меню при кліку на посилання
    mainNav.querySelectorAll('a').forEach(link => {
      link.addEventListener('click', () => {
        mainNav.classList.remove('active');
        mobileMenuBtn.classList.remove('active');
        mobileMenuBtn.setAttribute('aria-expanded', 'false');
      });
    });
  }

  // ==========  МОБІЛЬНЕ МЕНЮ ФІЛЬТРІВ ==========
  const filtersSidebar = document.querySelector('.filters-sidebar');
  const filtersToggleBtn = document.getElementById('filtersToggleBtn');

  if (filtersToggleBtn && filtersSidebar) {
    // Обробник для кнопки фільтрів
    filtersToggleBtn.addEventListener('click', () => {
      filtersSidebar.classList.toggle('active');
      const isActive = filtersSidebar.classList.contains('active');
      filtersToggleBtn.setAttribute('aria-expanded', isActive);
      console.log(' Фільтри ' + (isActive ? 'відкрито' : 'закрито'));
    });

    // Додаємо обробник для закриття фільтрів при кліку за межами
    document.addEventListener('click', (e) => {
      if (filtersSidebar.classList.contains('active') &&
          !filtersSidebar.contains(e.target) && 
          !filtersToggleBtn?.contains(e.target)) {
        filtersSidebar.classList.remove('active');
        filtersToggleBtn.setAttribute('aria-expanded', 'false');
      }
    });

    // Закриваємо фільтри при зміні на мобільних (опціонально)
    document.querySelectorAll('.filters-sidebar input[type="checkbox"], .filters-sidebar select').forEach(elem => {
      elem.addEventListener('change', () => {
        console.log(' Фільтр змінений');
      });
    });
  }

  // ==========  АДАПТИВНА ОБРОБКА МАСШТАБУВАННЯ ВІКНА ==========
  window.addEventListener('resize', () => {
    const width = window.innerWidth;
    // На великих екранах закриваємо мобільні меню
    if (width > 1024) {
      mainNav?.classList.remove('active');
      mobileMenuBtn?.classList.remove('active');
      mobileMenuBtn?.setAttribute('aria-expanded', 'false');
      filtersSidebar?.classList.remove('active');
      filtersToggleBtn?.setAttribute('aria-expanded', 'false');
    }
  });


  // ==========  СИНХРОНІЗАЦІЯ КОШИКА ЧЕРЕЗ ВКЛАДКИ ==========
  // Слухаємо зміни в localStorage з інших вкладок браузера
  window.addEventListener('storage', (event) => {
    if (event.key === 'rtk_cart') {
      console.log('📡 Кошик оновлений в іншій вкладці');
      try {
        cart = JSON.parse(event.newValue) || [];
        updateCartUI();
        showNotification(' Кошик синхронізований', 'info', 2000);
      } catch (e) {
        console.error(' Помилка при синхронізації кошика:', e);
      }
    }
    
    // Також слухаємо оновлення користувача
    if (event.key === 'rtk_user') {
      console.log('👤 Користувач оновлений в іншій вкладці');
      try {
        currentUser = JSON.parse(event.newValue) || null;
        if (window.notifyAuthChange) {
          window.notifyAuthChange();
        }
      } catch (e) {
        console.error(' Помилка при синхронізації користувача:', e);
      }
    }
  });

  console.log(' Ініціалізація завершена');
});

// Експорт функцій для використання в HTML (як onclick handlers)
window.loadProducts = loadProducts;
window.apiCall = apiCall;
window.displayFeaturedProducts = displayFeaturedProducts;
window.addToCart = addToCart;
window.removeFromCart = removeFromCart;
window.updateCartQuantity = updateCartQuantity;
window.renderCart = renderCart;
window.updateCartUI = updateCartUI;
window.updateCartCount = updateCartCount;
window.displayCart = displayCart;
window.checkout = checkout;
window.submitContactForm = submitContactForm;
window.applyFilters = applyFilters;
if (typeof matchesFilters === 'function') {
  window.matchesFilters = matchesFilters;
}
if (typeof parseSpecs === 'function') {
  window.parseSpecs = parseSpecs;
}

//  Експорт функцій аутентифікації
window.updateAuthUI = updateAuthUI;
window.handleLogout = handleLogout;
window.isLoggedIn = isLoggedIn;
window.getCurrentUser = getCurrentUser;
window.isAdmin = isAdmin;

// Admin panel logic: products, orders, contacts

const ADMIN_API_BASE_URL = window.API_BASE_URL || 'http://localhost:3000/api';
const baseFormatPrice = typeof window.formatPrice === 'function' ? window.formatPrice : null;
let adminProductsById = new Map();
let editingProductId = null;
let editingProductImageUrl = null;
let adminReviewsById = new Map();
let editingReviewId = null;
const ADMIN_LAST_SEEN_KEYS = {
  orders: 'rtk_admin_last_seen_orders_at',
  reviews: 'rtk_admin_last_seen_reviews_at'
};
const ADMIN_POLL_INTERVAL_MS = 30000;
let adminPollTimer = null;
const adminNewState = {
  orders: false,
  reviews: false
};
const ADMIN_DYNAMIC_SPEC_OPTION_CONFIG = [
  { category: 'gpu', specKey: 'manufacturer', selectId: 'gpu-manufacturer' },
  { category: 'gpu', specKey: 'memory', selectId: 'gpu-memory' },
  { category: 'gpu', specKey: 'series', selectId: 'gpu-series' },
  { category: 'gpu', specKey: 'interface', selectId: 'gpu-interface' },
  { category: 'cpu', specKey: 'manufacturer', selectId: 'cpu-manufacturer' },
  { category: 'cpu', specKey: 'socket', selectId: 'cpu-socket' }
];

// ==================== Utilities ====================

function escapeHTML(str) {
  if (typeof str !== 'string') return '';
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

function getCurrentUser() {
  try {
    const userJson = localStorage.getItem('rtk_user');
    return userJson ? JSON.parse(userJson) : null;
  } catch (e) {
    return null;
  }
}

function getAuthToken() {
  return localStorage.getItem('rtk_token');
}

function showNotification(message, type = 'info', duration = 3000) {
  if (window.showNotification && window.showNotification !== showNotification) {
    return window.showNotification(message, type, duration);
  }

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

  setTimeout(() => {
    toast.style.animation = 'slideOutLeft 0.3s ease';
    setTimeout(() => toast.remove(), 300);
  }, duration);
}

async function apiCall(endpoint, method = 'GET', data = null) {
  if (window.apiCall && window.apiCall !== apiCall) {
    return window.apiCall(endpoint, method, data);
  }

  const options = {
    method,
    headers: {
      'Content-Type': 'application/json'
    }
  };

  const token = getAuthToken();
  if (token) {
    options.headers['Authorization'] = `Bearer ${token}`;
    options.headers['X-Auth-Token'] = token;
  }

  if (data && (method === 'POST' || method === 'PUT')) {
    options.body = JSON.stringify(data);
  }

  const response = await fetch(`${ADMIN_API_BASE_URL}${endpoint}`, options);
  if (!response.ok) {
    let errorText = `HTTP ${response.status}`;
    try {
      const err = await response.json();
      errorText = err.message || errorText;
    } catch (e) {
      // ignore
    }
    return { success: false, error: errorText };
  }

  const payload = await response.json();
  return { success: true, data: payload };
}

function extractList(payload) {
  if (Array.isArray(payload)) return payload;
  if (!payload || typeof payload !== 'object') return [];
  if (Array.isArray(payload.data)) return payload.data;
  if (Array.isArray(payload.orders)) return payload.orders;
  if (Array.isArray(payload.contacts)) return payload.contacts;
  if (Array.isArray(payload.items)) return payload.items;
  return [];
}

function normalizeOrderItems(rawItems) {
  if (Array.isArray(rawItems)) return rawItems;
  if (rawItems && typeof rawItems === 'object') {
    if (Array.isArray(rawItems.items)) return rawItems.items;
  }
  if (typeof rawItems === 'string') {
    try {
      const parsed = JSON.parse(rawItems);
      if (Array.isArray(parsed)) return parsed;
      if (parsed && Array.isArray(parsed.items)) return parsed.items;
    } catch (e) {
      // ignore
    }
  }
  return [];
}

function toNumber(value, fallback = 0) {
  const num = Number(value);
  return Number.isFinite(num) ? num : fallback;
}

function toInt(value, fallback = 1) {
  const num = parseInt(value, 10);
  return Number.isFinite(num) ? num : fallback;
}

function getItemName(item) {
  if (!item || typeof item !== 'object') return '';
  return item.name || item.product_name || item.title || item.productTitle || item.product?.name || '';
}

function formatPrice(value) {
  if (baseFormatPrice && baseFormatPrice !== formatPrice) {
    return baseFormatPrice(value);
  }
  return `₴${toNumber(value, 0).toFixed(2)}`;
}

function parseTimestamp(value) {
  if (!value) return null;
  const ms = Date.parse(value);
  return Number.isFinite(ms) ? ms : null;
}

function getItemCreatedAtMs(item) {
  if (!item || typeof item !== 'object') return null;
  return parseTimestamp(item.created_at || item.createdAt || item.date);
}

function getLatestCreatedAtMs(items) {
  if (!Array.isArray(items)) return null;
  let latest = null;
  items.forEach(item => {
    const ms = getItemCreatedAtMs(item);
    if (!Number.isFinite(ms)) return;
    if (!latest || ms > latest) latest = ms;
  });
  return latest;
}

function getAdminLastSeen(entity) {
  const key = ADMIN_LAST_SEEN_KEYS[entity];
  if (!key) return null;
  const raw = localStorage.getItem(key);
  const ms = Number(raw);
  return Number.isFinite(ms) ? ms : null;
}

function setAdminLastSeen(entity, timestampMs) {
  const key = ADMIN_LAST_SEEN_KEYS[entity];
  if (!key || !Number.isFinite(timestampMs)) return;
  localStorage.setItem(key, String(timestampMs));
}

function setAdminTabHasNew(tabName, hasNew) {
  const tabBtn = document.querySelector(`.admin-tab-btn[data-tab="${tabName}"]`);
  if (!tabBtn) return;
  tabBtn.classList.toggle('has-new', Boolean(hasNew));
}

function setAdminNewState(entity, hasNew) {
  adminNewState[entity] = Boolean(hasNew);
  setAdminTabHasNew(entity, hasNew);
}

function updateAdminNewIndicator(entity, latestMs) {
  if (!Number.isFinite(latestMs)) {
    setAdminNewState(entity, false);
    return;
  }

  const lastSeen = getAdminLastSeen(entity);
  if (!Number.isFinite(lastSeen)) {
    setAdminLastSeen(entity, latestMs);
    setAdminNewState(entity, false);
    return;
  }

  const hasNew = latestMs > lastSeen;
  if (hasNew && !adminNewState[entity]) {
    const message = entity === 'orders' ? 'Є нові замовлення' : 'Є нові відгуки';
    showNotification(message, 'info', 4500);
  }
  setAdminNewState(entity, hasNew);
}

async function checkForNewAdminItems() {
  try {
    const [ordersRes, reviewsRes] = await Promise.all([
      apiCall('/orders/admin/orders?limit=1', 'GET'),
      apiCall('/reviews/admin?limit=1', 'GET')
    ]);

    if (ordersRes?.success) {
      const orders = extractList(ordersRes.data);
      const latestOrderMs = getLatestCreatedAtMs(orders);
      updateAdminNewIndicator('orders', latestOrderMs);
    }

    if (reviewsRes?.success) {
      const reviews = extractList(reviewsRes.data);
      const latestReviewMs = getLatestCreatedAtMs(reviews);
      updateAdminNewIndicator('reviews', latestReviewMs);
    }
  } catch (error) {
    console.warn('Admin poll error:', error);
  }
}

function startAdminPolling() {
  if (adminPollTimer) {
    clearInterval(adminPollTimer);
  }
  checkForNewAdminItems();
  adminPollTimer = setInterval(checkForNewAdminItems, ADMIN_POLL_INTERVAL_MS);
}

function normalizeSpecs(specs) {
  if (!specs) return {};
  if (typeof specs === 'object' && !Array.isArray(specs)) return specs;
  if (typeof specs === 'string') {
    try {
      const parsed = JSON.parse(specs);
      return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
    } catch (e) {
      return {};
    }
  }
  return {};
}

function normalizeDynamicOptionValue(value) {
  if (value === undefined || value === null) return '';
  return String(value).trim();
}

function normalizeDynamicOptionKey(value) {
  return normalizeDynamicOptionValue(value).toLowerCase();
}

function syncDynamicSpecSelectOptions(products = []) {
  ADMIN_DYNAMIC_SPEC_OPTION_CONFIG.forEach(config => {
    const select = document.getElementById(config.selectId);
    if (!select) return;

    Array.from(select.querySelectorAll('option[data-generated="1"]')).forEach(option => option.remove());

    const existingKeys = new Set(
      Array.from(select.options)
        .filter(option => option.value !== 'other')
        .map(option => normalizeDynamicOptionKey(option.value))
    );

    const discovered = new Map();

    products.forEach(product => {
      if (!product || product.category !== config.category) return;
      const specs = normalizeSpecs(product.specs);
      const rawValue = normalizeDynamicOptionValue(specs[config.specKey]);
      if (!rawValue) return;

      const key = normalizeDynamicOptionKey(rawValue);
      if (!key || existingKeys.has(key) || discovered.has(key)) return;
      discovered.set(key, rawValue);
    });

    if (discovered.size === 0) return;

    const otherOption = Array.from(select.options).find(option => option.value === 'other');
    const sortedValues = Array.from(discovered.values())
      .sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base', numeric: true }));

    sortedValues.forEach(rawValue => {
      const option = document.createElement('option');
      option.value = rawValue;
      option.textContent = rawValue;
      option.dataset.generated = '1';

      if (otherOption) {
        select.insertBefore(option, otherOption);
      } else {
        select.appendChild(option);
      }
    });
  });
}

function setInputValue(id, value) {
  const input = document.getElementById(id);
  if (!input) return;
  input.value = value === undefined || value === null ? '' : String(value);
}

function setSelectWithCustom(selectId, customInputId, value) {
  const select = document.getElementById(selectId);
  const customInput = document.getElementById(customInputId);
  if (!select) return;

  const normalized = value === undefined || value === null ? '' : String(value);
  if (!normalized) {
    select.value = '';
    if (customInput) {
      customInput.value = '';
      customInput.style.display = 'none';
    }
    return;
  }

  const matchedOption = Array.from(select.options).find(option =>
    normalizeDynamicOptionKey(option.value) === normalizeDynamicOptionKey(normalized)
  );
  if (matchedOption) {
    select.value = matchedOption.value;
    if (customInput) {
      customInput.value = '';
      customInput.style.display = 'none';
    }
    return;
  }

  if (Array.from(select.options).some(option => option.value === 'other')) {
    select.value = 'other';
    if (customInput) {
      customInput.value = normalized;
      customInput.style.display = 'block';
    }
    return;
  }

  select.value = '';
}

function resetProductSpecsFields() {
  document.querySelectorAll('.spec-field').forEach(field => {
    if (field instanceof HTMLInputElement || field instanceof HTMLSelectElement || field instanceof HTMLTextAreaElement) {
      field.value = '';
    }
  });

  [
    'gpu-manufacturer-custom',
    'gpu-memory-custom',
    'gpu-series-custom',
    'gpu-interface-custom',
    'cpu-manufacturer-custom',
    'cpu-socket-custom'
  ].forEach(id => {
    const customInput = document.getElementById(id);
    if (customInput) customInput.style.display = 'none';
  });
}

function fillProductSpecs(category, rawSpecs) {
  const specs = normalizeSpecs(rawSpecs);

  switch (category) {
    case 'gpu':
      setSelectWithCustom('gpu-manufacturer', 'gpu-manufacturer-custom', specs.manufacturer);
      setSelectWithCustom('gpu-memory', 'gpu-memory-custom', specs.memory);
      setSelectWithCustom('gpu-series', 'gpu-series-custom', specs.series);
      setSelectWithCustom('gpu-interface', 'gpu-interface-custom', specs.interface);
      break;
    case 'cpu':
      setSelectWithCustom('cpu-manufacturer', 'cpu-manufacturer-custom', specs.manufacturer);
      setInputValue('cpu-cores', specs.cores);
      setInputValue('cpu-threads', specs.threads);
      setSelectWithCustom('cpu-socket', 'cpu-socket-custom', specs.socket);
      setInputValue('cpu-tdp', specs.tdp);
      break;
    case 'ram':
      setInputValue('ram-capacity', specs.capacity);
      setInputValue('ram-type', specs.type);
      setInputValue('ram-speed', specs.speed);
      break;
    case 'ssd':
      setInputValue('ssd-capacity', specs.capacity);
      setInputValue('ssd-type', specs.type);
      setInputValue('ssd-speed', specs.speed);
      break;
    case 'hdd':
      setInputValue('hdd-capacity', specs.capacity);
      setInputValue('hdd-rpm', specs.rpm);
      setInputValue('hdd-cache', specs.cache);
      break;
    case 'mobo':
      setInputValue('mobo-socket', specs.socket);
      setInputValue('mobo-form', specs.form_factor);
      setInputValue('mobo-ram-slots', specs.ram_slots);
      break;
    case 'psu':
      setInputValue('psu-power', specs.power);
      setInputValue('psu-type', specs.type);
      setInputValue('psu-efficiency', specs.efficiency);
      break;
  }
}

function setProductFormMode(isEditMode) {
  const title = document.getElementById('productFormTitle');
  const submitBtn = document.getElementById('productSubmitBtn');
  const cancelBtn = document.getElementById('cancelEditProductBtn');

  if (title) {
    title.textContent = isEditMode ? 'Редагування товару' : 'Додати новий товар';
  }
  if (submitBtn) {
    submitBtn.textContent = isEditMode ? '💾 Зберегти зміни' : '➕ Додати товар';
  }
  if (cancelBtn) {
    cancelBtn.style.display = isEditMode ? 'inline-flex' : 'none';
  }
}

function resetProductForm() {
  editingProductId = null;
  editingProductImageUrl = null;

  const form = document.getElementById('addProductForm');
  if (form) form.reset();

  resetProductSpecsFields();
  updateProductSpecs();
  setProductFormMode(false);
}

function readFileAsDataURL(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(new Error('Не вдалося прочитати файл'));
    reader.readAsDataURL(file);
  });
}

async function uploadProductImage(file) {
  const allowedMimeTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
  const maxBytes = 5 * 1024 * 1024;

  if (!allowedMimeTypes.includes(file.type)) {
    throw new Error('Дозволені формати: JPG, PNG, WEBP, GIF');
  }

  if (file.size > maxBytes) {
    throw new Error('Фото має бути менше 5MB');
  }

  const dataUrl = await readFileAsDataURL(file);
  const base64Data = typeof dataUrl === 'string' ? dataUrl.split(',')[1] : null;
  if (!base64Data) {
    throw new Error('Некоректні дані зображення');
  }

  const uploadResult = await apiCall('/products/upload-image', 'POST', {
    file_name: file.name,
    mime_type: file.type,
    data: base64Data
  });

  if (!uploadResult.success || !uploadResult.data?.data?.image_url) {
    throw new Error(uploadResult.error || 'Не вдалося завантажити фото');
  }

  return uploadResult.data.data.image_url;
}

// ==================== Access control ====================

function redirectUnauthorizedAdminAccess() {
  const user = getCurrentUser();
  if (user) {
    window.location.replace('profile.html');
    return;
  }
  window.location.replace('auth.html');
}

async function verifyAdminSession() {
  const user = getCurrentUser();

  if (!user || user.role !== 'admin') {
    return false;
  }

  const token = getAuthToken();
  if (!token) {
    return false;
  }

  try {
    const response = await fetch(`${ADMIN_API_BASE_URL}/auth/verify`, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${token}`,
        'X-Auth-Token': token,
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      return false;
    }

    const payload = await response.json();
    return Boolean(payload?.success && payload?.user?.role === 'admin');
  } catch (error) {
    console.warn('Admin verify session failed:', error);
    return false;
  }
}

async function protectAdminPage() {
  const isAllowed = await verifyAdminSession();
  if (!isAllowed) {
    redirectUnauthorizedAdminAccess();
    return false;
  }

  document.documentElement.classList.add('admin-authorized');
  return true;
}

function handleAdminLogout() {
  if (adminPollTimer) {
    clearInterval(adminPollTimer);
    adminPollTimer = null;
  }
  localStorage.removeItem('rtk_user');
  localStorage.removeItem('rtk_token');
  showNotification('Ви вийшли з акаунту', 'success');
  setTimeout(() => {
    window.location.href = 'index.html';
  }, 1000);
}

// ==================== Tabs ====================

function switchAdminTab(tabName) {
  document.querySelectorAll('.admin-tab-content').forEach(tab => {
    tab.style.display = 'none';
  });

  const selectedTab = document.getElementById(`${tabName}Tab`);
  if (selectedTab) {
    selectedTab.style.display = 'block';
  }

  document.querySelectorAll('.admin-tab-btn').forEach(btn => {
    btn.classList.remove('active');
  });
  const activeBtn = document.querySelector(`.admin-tab-btn[data-tab="${tabName}"]`);
  if (activeBtn) activeBtn.classList.add('active');

  if (tabName === 'dashboard') {
    loadAdminDashboard();
  } else if (tabName === 'products') {
    loadProducts();
  } else if (tabName === 'orders') {
    loadOrders();
  } else if (tabName === 'reviews') {
    loadReviews();
  } else if (tabName === 'contacts') {
    loadContacts();
  }
}

// ==================== Dashboard ====================

async function loadAdminDashboard() {
  try {
    const [productsRes, ordersRes, contactsRes] = await Promise.all([
      apiCall('/products?limit=10000', 'GET'),
      apiCall('/orders/admin/orders?limit=10000', 'GET'),
      apiCall('/contacts/admin/contacts?limit=10000', 'GET')
    ]);

    if (!productsRes.success || !ordersRes.success || !contactsRes.success) {
      throw new Error('Не вдалося завантажити статистику');
    }

    const products = extractList(productsRes.data);
    const orders = extractList(ordersRes.data);
    const contacts = extractList(contactsRes.data);

    document.getElementById('totalProducts').textContent = products.length;
    document.getElementById('totalOrders').textContent = orders.length;
    document.getElementById('totalContacts').textContent = contacts.length;
    document.getElementById('totalUsers').textContent = '—';
  } catch (error) {
    console.error('Dashboard error:', error);
    showNotification('Помилка завантаження панелі', 'error');
  }
}

// ==================== Products ====================

async function loadProducts() {
  try {
    const result = await apiCall('/products?limit=10000', 'GET');
    if (!result.success) throw new Error(result.error || 'Не вдалося завантажити товари');

    const products = extractList(result.data);
    adminProductsById = new Map(products.map(product => [Number(product.id), product]));
    syncDynamicSpecSelectOptions(products);
    const productsList = document.getElementById('productsList');

    if (!products || products.length === 0) {
      productsList.innerHTML = '<p style="color: var(--text-muted); text-align: center;">Немає товарів.</p>';
      return;
    }

    const tableWrap = document.createElement('div');
    tableWrap.className = 'admin-table-wrap';

    const table = document.createElement('table');
    table.className = 'admin-table';
    table.innerHTML = `
      <thead>
        <tr>
          <th>Назва</th>
          <th class="admin-align-center">Категорія</th>
          <th class="admin-align-right">Ціна</th>
          <th class="admin-align-center">Кількість</th>
          <th class="admin-align-center">Дії</th>
        </tr>
      </thead>
      <tbody></tbody>
    `;

    productsList.innerHTML = '';
    tableWrap.appendChild(table);
    productsList.appendChild(tableWrap);

    const tbody = table.querySelector('tbody');

    products.forEach(product => {
      const row = document.createElement('tr');
      row.setAttribute('data-product-id', product.id);
      row.className = 'admin-table-row';
      row.innerHTML = `
        <td>${escapeHTML(product.name)}</td>
        <td class="admin-align-center">${escapeHTML(product.category || '—')}</td>
        <td class="admin-align-right admin-cell-strong">${formatPrice(product.price)}</td>
        <td class="admin-align-center">${product.stock}</td>
        <td class="admin-align-center admin-actions-cell">
          <button class="btn btn-sm admin-table-action" onclick="editProduct(${product.id})">✏️ Редагувати</button>
          <button class="btn btn-danger admin-table-action" onclick="deleteProduct(${product.id})">🗑️ Видалити</button>
        </td>
      `;
      tbody.appendChild(row);
    });

    updateProductSpecs();
  } catch (error) {
    console.error('Load products error:', error);
    document.getElementById('productsList').innerHTML = `<p style="color: red;">Помилка: ${error.message}</p>`;
  }
}

function updateProductSpecs() {
  const category = document.getElementById('product-category').value;
  document.querySelectorAll('.specs-section').forEach(section => {
    section.style.display = 'none';
  });

  if (category === 'gpu') {
    document.getElementById('gpuSpecs').style.display = 'grid';
  } else if (category === 'cpu') {
    document.getElementById('cpuSpecs').style.display = 'grid';
  } else if (category === 'ram') {
    document.getElementById('ramSpecs').style.display = 'grid';
  } else if (category === 'ssd') {
    document.getElementById('ssdSpecs').style.display = 'grid';
  } else if (category === 'hdd') {
    document.getElementById('hddSpecs').style.display = 'grid';
  } else if (category === 'mobo') {
    document.getElementById('moboSpecs').style.display = 'grid';
  } else if (category === 'psu') {
    document.getElementById('psuSpecs').style.display = 'grid';
  }

  setupCustomInputListeners();
}

function setupCustomInputListeners() {
  const bindOnce = (element, key, handler) => {
    if (!element) return;
    const marker = `listener${key}`;
    if (element.dataset[marker]) return;
    element.addEventListener('change', handler);
    element.dataset[marker] = '1';
  };

  const gpuMemory = document.getElementById('gpu-memory');
  const gpuMemoryCustom = document.getElementById('gpu-memory-custom');
  const gpuSeries = document.getElementById('gpu-series');
  const gpuSeriesCustom = document.getElementById('gpu-series-custom');
  const gpuInterface = document.getElementById('gpu-interface');
  const gpuInterfaceCustom = document.getElementById('gpu-interface-custom');
  const gpuManufacturer = document.getElementById('gpu-manufacturer');
  const gpuManufacturerCustom = document.getElementById('gpu-manufacturer-custom');

  bindOnce(gpuMemory, 'GpuMemory', () => {
    if (gpuMemoryCustom) {
      gpuMemoryCustom.style.display = gpuMemory.value === 'other' ? 'block' : 'none';
    }
  });

  bindOnce(gpuSeries, 'GpuSeries', () => {
    if (gpuSeriesCustom) {
      gpuSeriesCustom.style.display = gpuSeries.value === 'other' ? 'block' : 'none';
    }
  });

  bindOnce(gpuManufacturer, 'GpuManufacturer', () => {
    if (gpuManufacturerCustom) {
      gpuManufacturerCustom.style.display = gpuManufacturer.value === 'other' ? 'block' : 'none';
    }
  });

  bindOnce(gpuInterface, 'GpuInterface', () => {
    if (gpuInterfaceCustom) {
      gpuInterfaceCustom.style.display = gpuInterface.value === 'other' ? 'block' : 'none';
    }
  });

  const cpuSocket = document.getElementById('cpu-socket');
  const cpuSocketCustom = document.getElementById('cpu-socket-custom');
  const cpuManufacturer = document.getElementById('cpu-manufacturer');
  const cpuManufacturerCustom = document.getElementById('cpu-manufacturer-custom');
  bindOnce(cpuSocket, 'CpuSocket', () => {
    if (cpuSocketCustom) {
      cpuSocketCustom.style.display = cpuSocket.value === 'other' ? 'block' : 'none';
    }
  });

  bindOnce(cpuManufacturer, 'CpuManufacturer', () => {
    if (cpuManufacturerCustom) {
      cpuManufacturerCustom.style.display = cpuManufacturer.value === 'other' ? 'block' : 'none';
    }
  });
}

function collectProductSpecs() {
  const category = document.getElementById('product-category').value;
  const specs = {};

  switch (category) {
    case 'gpu': {
      const gpuManufacturer = document.getElementById('gpu-manufacturer').value;
      const gpuManufacturerCustom = document.getElementById('gpu-manufacturer-custom').value.trim();
      const gpuMemory = document.getElementById('gpu-memory').value;
      const gpuMemoryCustom = document.getElementById('gpu-memory-custom').value.trim();
      const gpuSeries = document.getElementById('gpu-series').value;
      const gpuSeriesCustom = document.getElementById('gpu-series-custom').value.trim();
      const gpuInterface = document.getElementById('gpu-interface').value;
      const gpuInterfaceCustom = document.getElementById('gpu-interface-custom').value.trim();

      const resolvedGpuManufacturer = gpuManufacturer === 'other' ? gpuManufacturerCustom : gpuManufacturer;
      if (resolvedGpuManufacturer) specs.manufacturer = resolvedGpuManufacturer;
      specs.memory = gpuMemory === 'other' ? gpuMemoryCustom : gpuMemory;
      specs.series = gpuSeries === 'other' ? gpuSeriesCustom : gpuSeries;
      const resolvedGpuInterface = gpuInterface === 'other' ? gpuInterfaceCustom : gpuInterface;
      if (resolvedGpuInterface) specs.interface = resolvedGpuInterface;
      break;
    }
    case 'cpu': {
      const cpuManufacturer = document.getElementById('cpu-manufacturer').value;
      const cpuManufacturerCustom = document.getElementById('cpu-manufacturer-custom').value.trim();
      const cpuCores = document.getElementById('cpu-cores').value;
      const cpuThreads = document.getElementById('cpu-threads').value;
      const cpuSocket = document.getElementById('cpu-socket').value;
      const cpuSocketCustom = document.getElementById('cpu-socket-custom').value.trim();
      const cpuTdp = document.getElementById('cpu-tdp').value;

      const resolvedCpuManufacturer = cpuManufacturer === 'other' ? cpuManufacturerCustom : cpuManufacturer;
      if (resolvedCpuManufacturer) specs.manufacturer = resolvedCpuManufacturer;
      if (cpuCores) specs.cores = cpuCores;
      if (cpuThreads) specs.threads = cpuThreads;
      specs.socket = cpuSocket === 'other' ? cpuSocketCustom : cpuSocket;
      if (cpuTdp) specs.tdp = cpuTdp;
      break;
    }
    case 'ram': {
      const ramCapacity = document.getElementById('ram-capacity').value;
      const ramType = document.getElementById('ram-type').value;
      const ramSpeed = document.getElementById('ram-speed').value;

      if (ramCapacity) specs.capacity = ramCapacity;
      if (ramType) specs.type = ramType;
      if (ramSpeed) specs.speed = ramSpeed;
      break;
    }
    case 'ssd': {
      const ssdCapacity = document.getElementById('ssd-capacity').value;
      const ssdType = document.getElementById('ssd-type').value;
      const ssdSpeed = document.getElementById('ssd-speed').value;

      if (ssdCapacity) specs.capacity = ssdCapacity;
      if (ssdType) specs.type = ssdType;
      if (ssdSpeed) specs.speed = ssdSpeed;
      break;
    }
    case 'hdd': {
      const hddCapacity = document.getElementById('hdd-capacity').value;
      const hddRpm = document.getElementById('hdd-rpm').value;
      const hddCache = document.getElementById('hdd-cache').value;

      if (hddCapacity) specs.capacity = hddCapacity;
      if (hddRpm) specs.rpm = hddRpm;
      if (hddCache) specs.cache = hddCache;
      break;
    }
    case 'mobo': {
      const moboSocket = document.getElementById('mobo-socket').value;
      const moboForm = document.getElementById('mobo-form').value;
      const moboRamSlots = document.getElementById('mobo-ram-slots').value;

      if (moboSocket) specs.socket = moboSocket;
      if (moboForm) specs.form_factor = moboForm;
      if (moboRamSlots) specs.ram_slots = moboRamSlots;
      break;
    }
    case 'psu': {
      const psuPower = document.getElementById('psu-power').value;
      const psuType = document.getElementById('psu-type').value;
      const psuEfficiency = document.getElementById('psu-efficiency').value;

      if (psuPower) specs.power = psuPower;
      if (psuType) specs.type = psuType;
      if (psuEfficiency) specs.efficiency = psuEfficiency;
      break;
    }
  }

  return specs;
}

async function handleAddProduct(event) {
  event.preventDefault();

  const name = document.getElementById('product-name').value.trim();
  const price = parseFloat(document.getElementById('product-price').value);
  const category = document.getElementById('product-category').value;
  const stock = parseInt(document.getElementById('product-stock').value, 10);
  const description = document.getElementById('product-description').value.trim();
  const imageUrlInput = document.getElementById('product-image-url').value.trim();
  const imageFileInput = document.getElementById('product-image-file');
  const imageFile = imageFileInput && imageFileInput.files ? imageFileInput.files[0] : null;

  if (!name || isNaN(price) || !category || isNaN(stock)) {
    showNotification('Заповніть усі поля', 'error');
    return;
  }

  if (price <= 0) {
    showNotification('Ціна повинна бути більшою за 0', 'error');
    return;
  }

  if (stock < 0) {
    showNotification('Кількість не може бути від’ємною', 'error');
    return;
  }

  try {
    const specs = collectProductSpecs();
    let imageUrl = imageUrlInput || null;
    const isEditMode = editingProductId !== null;

    if (imageFile) {
      imageUrl = await uploadProductImage(imageFile);
    }

    const payload = {
      name,
      price,
      category,
      stock,
      description: description || '',
      image_url: imageUrl,
      specs
    };

    const result = isEditMode
      ? await apiCall(`/products/${editingProductId}`, 'PUT', payload)
      : await apiCall('/products', 'POST', payload);

    if (result.success) {
      showNotification(isEditMode ? 'Товар успішно оновлено' : 'Товар успішно додано', 'success');
      resetProductForm();
      await loadProducts();
    } else {
      showNotification(result.error || 'Не вдалося зберегти товар', 'error');
    }
  } catch (error) {
    console.error('Save product error:', error);
    showNotification(`Помилка: ${error.message}`, 'error');
  }
}

async function editProduct(productId) {
  const id = Number(productId);
  let product = adminProductsById.get(id);

  if (!product) {
    const response = await apiCall(`/products/${id}`, 'GET');
    if (!response.success || !response.data?.data) {
      showNotification('Не вдалося завантажити товар для редагування', 'error');
      return;
    }
    product = response.data.data;
  }

  editingProductId = id;
  editingProductImageUrl = product.image_url || null;

  const form = document.getElementById('addProductForm');
  if (form) form.reset();
  resetProductSpecsFields();

  setInputValue('product-name', product.name);
  setInputValue('product-price', product.price);
  setInputValue('product-category', product.category);
  setInputValue('product-stock', product.stock);
  setInputValue('product-description', product.description);
  setInputValue('product-image-url', product.image_url);

  updateProductSpecs();
  fillProductSpecs(product.category, product.specs);
  setProductFormMode(true);

  const productsTab = document.getElementById('productsTab');
  if (productsTab) {
    productsTab.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
  showNotification(`Редагування: ${product.name}`, 'info');
}

function cancelProductEdit() {
  resetProductForm();
  showNotification('Режим редагування скасовано', 'info');
}

async function updateProductData(productId, data) {
  try {
    const result = await apiCall(`/products/${productId}`, 'PUT', data);
    if (!result.success) throw new Error(result.error || 'Не вдалося оновити товар');
    showNotification('Товар оновлено', 'success');
    loadProducts();
  } catch (error) {
    console.error('Update product error:', error);
    showNotification(`Помилка: ${error.message}`, 'error');
  }
}

async function deleteProduct(productId) {
  if (!confirm('Ви впевнені, що хочете видалити товар?')) return;

  try {
    const result = await apiCall(`/products/${productId}`, 'DELETE');
    if (!result.success) throw new Error(result.error || 'Не вдалося видалити товар');
    showNotification('Товар видалено', 'success');
    loadProducts();
  } catch (error) {
    console.error('Delete product error:', error);
    showNotification(`Помилка: ${error.message}`, 'error');
  }
}

// ==================== Orders ====================

async function loadOrders(options = {}) {
  const markAsSeen = options.markAsSeen !== false;
  const lastSeen = getAdminLastSeen('orders');
  const highlightCutoff = Number.isFinite(lastSeen) ? lastSeen : null;

  try {
    const result = await apiCall('/orders/admin/orders?limit=10000', 'GET');
    if (!result.success) throw new Error(result.error || 'Не вдалося завантажити замовлення');

    const orders = extractList(result.data);
    const ordersList = document.getElementById('ordersList');

    if (!orders || orders.length === 0) {
      ordersList.innerHTML = '<p style="color: var(--text-muted); text-align: center;">Немає замовлень.</p>';
      if (markAsSeen) {
        setAdminNewState('orders', false);
      }
      return;
    }

    ordersList.innerHTML = '';

    orders.forEach(order => {
      const statusBadgeColor = {
        pending: '#f59e0b',
        confirmed: '#3b82f6',
        shipped: '#8b5cf6',
        delivered: '#10b981',
        cancelled: '#ef4444'
      }[order.status] || '#6b7280';

      const orderCard = document.createElement('div');
      orderCard.className = 'admin-order-card';
      orderCard.style.setProperty('--admin-status-color', statusBadgeColor);

      const createdAtMs = getItemCreatedAtMs(order);
      const isNew = highlightCutoff !== null && Number.isFinite(createdAtMs) && createdAtMs > highlightCutoff;
      if (isNew) {
        orderCard.classList.add('admin-new-item');
      }

      const normalizedItems = normalizeOrderItems(order.items);
      const itemsHTML = normalizedItems.length > 0
        ? normalizedItems.map(item => {
            const nameValue = getItemName(item);
            const name = nameValue || (item?.id || item?.product_id ? `ID ${item.id || item.product_id}` : 'Товар');
            const quantity = toInt(item?.quantity ?? item?.qty ?? item?.count, 1);
            const price = toNumber(item?.price ?? item?.unit_price ?? item?.unitPrice ?? item?.cost, 0);
            const lineTotalValue = item?.total ?? item?.total_price ?? (price * quantity);
            const lineTotal = toNumber(lineTotalValue, 0).toFixed(2);
            return `<li>• ${escapeHTML(String(name))} x${quantity} = ₴${lineTotal}</li>`;
          }).join('')
        : '<li>Немає товарів у замовленні</li>';

      orderCard.innerHTML = `
        <div class="admin-order-id">
          <p class="admin-order-label">Замовлення №</p>
          <p class="admin-order-number">${order.order_number || order.id}</p>
        </div>
        
        <div class="admin-order-main">
          <div class="admin-order-meta">
            <div>
              <p class="admin-order-meta-label">Клієнт</p>
              <p class="admin-order-meta-value">${escapeHTML(order.customer_name || '—')}</p>
            </div>
            <div>
              <p class="admin-order-meta-label">Email</p>
              <p class="admin-order-meta-value">${escapeHTML(order.customer_email || '—')}</p>
            </div>
            <div>
              <p class="admin-order-meta-label">Дата</p>
              <p class="admin-order-meta-value">${order.created_at ? new Date(order.created_at).toLocaleDateString('uk-UA') : '—'}</p>
            </div>
            <div>
              <p class="admin-order-meta-label">Сума</p>
              <p class="admin-order-meta-value admin-order-total">${formatPrice(order.total_price ?? order.total ?? 0)}</p>
            </div>
          </div>
          
          <p class="admin-order-items-title">Товари:</p>
          <ul class="admin-order-items">
            ${itemsHTML}
          </ul>
        </div>
        
        <div class="admin-order-controls">
          <label for="status-${order.id}" class="admin-order-meta-label">Статус</label>
          <select id="status-${order.id}" class="admin-order-status-select" onchange="updateOrderStatus(${order.id}, this.value)">
            <option value="pending" ${order.status === 'pending' ? 'selected' : ''}>⏳ Очікує</option>
            <option value="confirmed" ${order.status === 'confirmed' ? 'selected' : ''}>✅ Підтверджено</option>
            <option value="shipped" ${order.status === 'shipped' ? 'selected' : ''}>📦 Відправлено</option>
            <option value="delivered" ${order.status === 'delivered' ? 'selected' : ''}>🎉 Доставлено</option>
            <option value="cancelled" ${order.status === 'cancelled' ? 'selected' : ''}>❌ Скасовано</option>
          </select>
          <button class="btn btn-danger admin-order-delete-btn" onclick="deleteOrder(${order.id})">🗑️ Видалити</button>
        </div>
      `;

      ordersList.appendChild(orderCard);
    });

    if (markAsSeen) {
      const latestOrderMs = getLatestCreatedAtMs(orders);
      if (Number.isFinite(latestOrderMs)) {
        setAdminLastSeen('orders', latestOrderMs);
      }
      setAdminNewState('orders', false);
    }
  } catch (error) {
    console.error('Load orders error:', error);
    document.getElementById('ordersList').innerHTML = `<p style="color: red;">Помилка: ${error.message}</p>`;
  }
}

async function updateOrderStatus(orderId, newStatus) {
  try {
    const result = await apiCall(`/orders/admin/orders/${orderId}`, 'PUT', { status: newStatus });
    if (!result.success) throw new Error(result.error || 'Не вдалося оновити статус');
    showNotification('Статус замовлення оновлено', 'success');
  } catch (error) {
    console.error('Update order error:', error);
    showNotification(`Помилка: ${error.message}`, 'error');
  }
}

async function deleteOrder(orderId) {
  if (!confirm('Ви впевнені, що хочете видалити замовлення?')) return;

  try {
    const result = await apiCall(`/orders/admin/orders/${orderId}`, 'DELETE');
    if (!result.success) throw new Error(result.error || 'Не вдалося видалити замовлення');
    showNotification('Замовлення видалено', 'success');
    loadOrders();
  } catch (error) {
    console.error('Delete order error:', error);
    showNotification(`Помилка: ${error.message}`, 'error');
  }
}

// ==================== Contacts ====================

async function loadContacts() {
  try {
    const result = await apiCall('/contacts/admin/contacts?limit=10000', 'GET');
    if (!result.success) throw new Error(result.error || 'Не вдалося завантажити контакти');

    const contacts = extractList(result.data);
    const contactsList = document.getElementById('contactsList');

    if (!contacts || contacts.length === 0) {
      contactsList.innerHTML = '<p style="color: var(--text-muted); text-align: center;">Немає контактів.</p>';
      return;
    }

    contactsList.innerHTML = '';

    contacts.forEach(contact => {
      const contactCard = document.createElement('div');
      contactCard.className = 'admin-contact-card';
      contactCard.style.setProperty('--admin-contact-accent', contact.responded ? '#10b981' : '#f59e0b');

      contactCard.innerHTML = `
        <div class="admin-contact-grid">
          <div>
            <p class="admin-order-meta-label">Від</p>
            <p class="admin-order-meta-value">${escapeHTML(contact.name || '—')}</p>
          </div>
          <div>
            <p class="admin-order-meta-label">Email</p>
            <p class="admin-order-meta-value admin-break-word">${escapeHTML(contact.email || '—')}</p>
          </div>
          <div>
            <p class="admin-order-meta-label">Телефон</p>
            <p class="admin-order-meta-value">${escapeHTML(contact.phone || 'Не вказано')}</p>
          </div>
          <div>
            <p class="admin-order-meta-label">Дата</p>
            <p class="admin-order-meta-value">${contact.created_at ? new Date(contact.created_at).toLocaleDateString('uk-UA') : '—'}</p>
          </div>
        </div>
        
        <div class="admin-contact-message">
          <p class="admin-contact-section-title">Повідомлення:</p>
          <p class="admin-contact-text">${escapeHTML(contact.message || 'Без повідомлення')}</p>
        </div>

        ${contact.response_text ? `
          <div class="admin-contact-response">
            <p class="admin-contact-section-title admin-contact-response-title">Відповідь:</p>
            <p class="admin-contact-text">${escapeHTML(contact.response_text)}</p>
          </div>
        ` : ''}
        
        <div class="admin-contact-actions">
          <button class="btn btn-primary" onclick="respondToContact(${contact.id})">💬 Відповісти</button>
          <button class="btn btn-danger" onclick="deleteContact(${contact.id})">🗑️ Видалити</button>
        </div>
      `;

      contactsList.appendChild(contactCard);
    });
  } catch (error) {
    console.error('Load contacts error:', error);
    document.getElementById('contactsList').innerHTML = `<p style="color: red;">Помилка: ${error.message}</p>`;
  }
}

function respondToContact(contactId) {
  const response = prompt('Введіть відповідь:');
  if (!response || response.trim() === '') return;
  sendContactResponse(contactId, response.trim());
}

async function sendContactResponse(contactId, responseText) {
  try {
    const result = await apiCall(`/contacts/admin/contacts/${contactId}`, 'PUT', {
      response_text: responseText
    });
    if (!result.success) throw new Error(result.error || 'Не вдалося надіслати відповідь');
    showNotification('Відповідь надіслана', 'success');
    loadContacts();
  } catch (error) {
    console.error('Respond contact error:', error);
    showNotification(`Помилка: ${error.message}`, 'error');
  }
}

async function deleteContact(contactId) {
  if (!confirm('Ви впевнені, що хочете видалити контакт?')) return;

  try {
    const result = await apiCall(`/contacts/admin/contacts/${contactId}`, 'DELETE');
    if (!result.success) throw new Error(result.error || 'Не вдалося видалити контакт');
    showNotification('Контакт видалено', 'success');
    loadContacts();
  } catch (error) {
    console.error('Delete contact error:', error);
    showNotification(`Помилка: ${error.message}`, 'error');
  }
}

// ==================== Reviews ====================

function setReviewFormMode(isEditMode) {
  const title = document.getElementById('reviewFormTitle');
  const submitBtn = document.getElementById('reviewSubmitBtn');
  const cancelBtn = document.getElementById('cancelEditReviewBtn');
  const ratingInput = document.getElementById('review-rating');
  const titleInput = document.getElementById('review-title');
  const commentInput = document.getElementById('review-comment');

  if (title) {
    title.textContent = isEditMode ? 'Редагування відгуку' : 'Виберіть відгук для редагування';
  }
  if (submitBtn) {
    submitBtn.textContent = isEditMode ? 'Зберегти зміни' : 'Зберегти відгук';
    submitBtn.disabled = !isEditMode;
  }
  if (cancelBtn) {
    cancelBtn.style.display = isEditMode ? 'inline-flex' : 'none';
  }

  [ratingInput, titleInput, commentInput].forEach(input => {
    if (input) input.disabled = !isEditMode;
  });
}

function resetReviewForm() {
  editingReviewId = null;
  setInputValue('review-product', '');
  setInputValue('review-author', '');
  setInputValue('review-rating', '');
  setInputValue('review-title', '');
  setInputValue('review-comment', '');
  setReviewFormMode(false);
}

function formatReviewAuthor(review) {
  const authorName = review.author_name || '—';
  if (review.username && review.username !== authorName) {
    return `${authorName} (${review.username})`;
  }
  return authorName;
}

function truncateText(text, maxLength = 140) {
  if (!text) return '—';
  const normalized = String(text);
  if (normalized.length <= maxLength) return normalized;
  return `${normalized.slice(0, maxLength).trim()}…`;
}

async function loadReviews(options = {}) {
  const markAsSeen = options.markAsSeen !== false;
  const lastSeen = getAdminLastSeen('reviews');
  const highlightCutoff = Number.isFinite(lastSeen) ? lastSeen : null;

  try {
    const result = await apiCall('/reviews/admin?limit=10000', 'GET');
    if (!result.success) throw new Error(result.error || 'Не вдалося завантажити відгуки');

    const reviews = extractList(result.data);
    adminReviewsById = new Map(reviews.map(review => [Number(review.id), review]));

    const reviewsList = document.getElementById('reviewsList');
    if (!reviewsList) return;

    if (!reviews || reviews.length === 0) {
      reviewsList.innerHTML = '<p class="admin-muted-text">Немає відгуків.</p>';
      if (markAsSeen) {
        setAdminNewState('reviews', false);
      }
      return;
    }

    const tableWrap = document.createElement('div');
    tableWrap.className = 'admin-table-wrap';

    const table = document.createElement('table');
    table.className = 'admin-table';
    table.innerHTML = `
      <thead>
        <tr>
          <th>Товар</th>
          <th>Автор</th>
          <th class="admin-align-center">Оцінка</th>
          <th>Відгук</th>
          <th class="admin-align-center">Дата</th>
          <th class="admin-align-center">Дії</th>
        </tr>
      </thead>
      <tbody></tbody>
    `;

    reviewsList.innerHTML = '';
    tableWrap.appendChild(table);
    reviewsList.appendChild(tableWrap);

    const tbody = table.querySelector('tbody');

    reviews.forEach(review => {
      const row = document.createElement('tr');
      row.className = 'admin-table-row';

      const productLabel = review.product_name
        ? escapeHTML(review.product_name)
        : `ID ${review.product_id}`;
      const authorLabel = escapeHTML(formatReviewAuthor(review));
      const titlePart = review.title ? `${review.title}: ` : '';
      const commentSnippet = escapeHTML(truncateText(`${titlePart}${review.comment || ''}`));
      const createdAt = review.created_at ? new Date(review.created_at).toLocaleDateString('uk-UA') : '—';

      const createdAtMs = getItemCreatedAtMs(review);
      const isNew = highlightCutoff !== null && Number.isFinite(createdAtMs) && createdAtMs > highlightCutoff;
      if (isNew) {
        row.classList.add('admin-new-row');
      }

      row.innerHTML = `
        <td>${productLabel}</td>
        <td>${authorLabel}</td>
        <td class="admin-align-center admin-cell-strong">${review.rating ?? '—'}</td>
        <td>${commentSnippet}</td>
        <td class="admin-align-center">${createdAt}</td>
        <td class="admin-align-center admin-actions-cell">
          <button class="btn btn-sm admin-table-action" onclick="editReview(${review.id})">Редагувати</button>
          <button class="btn btn-danger admin-table-action" onclick="deleteReview(${review.id})">Видалити</button>
        </td>
      `;

      tbody.appendChild(row);
    });

    if (markAsSeen) {
      const latestReviewMs = getLatestCreatedAtMs(reviews);
      if (Number.isFinite(latestReviewMs)) {
        setAdminLastSeen('reviews', latestReviewMs);
      }
      setAdminNewState('reviews', false);
    }
  } catch (error) {
    console.error('Load reviews error:', error);
    const reviewsList = document.getElementById('reviewsList');
    if (reviewsList) {
      reviewsList.innerHTML = `<p style="color: red;">Помилка: ${error.message}</p>`;
    }
  }
}

function editReview(reviewId) {
  const id = Number(reviewId);
  const review = adminReviewsById.get(id);
  if (!review) {
    showNotification('Не вдалося знайти відгук', 'error');
    return;
  }

  editingReviewId = id;

  const productLabel = review.product_name ? review.product_name : `ID ${review.product_id}`;
  const authorLabel = formatReviewAuthor(review);

  setInputValue('review-product', productLabel);
  setInputValue('review-author', authorLabel);
  setInputValue('review-rating', review.rating || 5);
  setInputValue('review-title', review.title || '');
  setInputValue('review-comment', review.comment || '');

  setReviewFormMode(true);

  const reviewsTab = document.getElementById('reviewsTab');
  if (reviewsTab) {
    reviewsTab.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
}

async function handleReviewSave(event) {
  event.preventDefault();

  if (!editingReviewId) {
    showNotification('Оберіть відгук зі списку', 'error');
    return;
  }

  const ratingValue = parseInt(document.getElementById('review-rating').value, 10);
  const title = document.getElementById('review-title').value.trim();
  const comment = document.getElementById('review-comment').value.trim();

  if (!Number.isFinite(ratingValue) || ratingValue < 1 || ratingValue > 5) {
    showNotification('Оцінка має бути від 1 до 5', 'error');
    return;
  }

  try {
    const payload = {
      rating: ratingValue,
      title,
      comment
    };

    const result = await apiCall(`/reviews/${editingReviewId}`, 'PUT', payload);
    if (!result.success) throw new Error(result.error || 'Не вдалося оновити відгук');

    showNotification('Відгук оновлено', 'success');
    resetReviewForm();
    loadReviews();
  } catch (error) {
    console.error('Update review error:', error);
    showNotification(`Помилка: ${error.message}`, 'error');
  }
}

function cancelReviewEdit() {
  resetReviewForm();
  showNotification('Редагування відгуку скасовано', 'info');
}

async function deleteReview(reviewId) {
  if (!confirm('Ви впевнені, що хочете видалити відгук?')) return;

  try {
    const result = await apiCall(`/reviews/${reviewId}`, 'DELETE');
    if (!result.success) throw new Error(result.error || 'Не вдалося видалити відгук');
    showNotification('Відгук видалено', 'success');
    if (editingReviewId === Number(reviewId)) {
      resetReviewForm();
    }
    loadReviews();
  } catch (error) {
    console.error('Delete review error:', error);
    showNotification(`Помилка: ${error.message}`, 'error');
  }
}

// ==================== Init ====================

document.addEventListener('DOMContentLoaded', async () => {
  if (!(await protectAdminPage())) return;

  const logoutBtn = document.getElementById('logoutBtn');
  if (logoutBtn) logoutBtn.onclick = handleAdminLogout;

  const adminUserBtn = document.getElementById('adminUserBtn');
  if (adminUserBtn) {
    const user = getCurrentUser();
    if (user) adminUserBtn.textContent = ` ${user.username}`;
  }

  setProductFormMode(false);
  updateProductSpecs();
  resetReviewForm();

  loadAdminDashboard();
  startAdminPolling();
});

// Expose for inline handlers
window.switchAdminTab = switchAdminTab;
window.handleAddProduct = handleAddProduct;
window.updateProductSpecs = updateProductSpecs;
window.editProduct = editProduct;
window.cancelProductEdit = cancelProductEdit;
window.deleteProduct = deleteProduct;
window.updateOrderStatus = updateOrderStatus;
window.deleteOrder = deleteOrder;
window.respondToContact = respondToContact;
window.handleReviewSave = handleReviewSave;
window.editReview = editReview;
window.cancelReviewEdit = cancelReviewEdit;
window.deleteReview = deleteReview;

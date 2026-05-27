/**
 * Модуль профілю: вкладки, дані користувача, замовлення та налаштування.
 */

const PROFILE_API_BASE_URL = window.API_BASE_URL || 'http://localhost:3000/api';
const USER_STORAGE_KEY = 'rtk_user';
const TOKEN_STORAGE_KEY = 'rtk_token';

function escapeHTML(str) {
  if (typeof str !== 'string') return '';
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

function notify(message, type = 'info') {
  if (typeof window.showNotification === 'function') {
    window.showNotification(message, type);
    return;
  }

  if (type === 'error') {
    console.error(message);
    return;
  }
  console.log(message);
}

function getStoredUser() {
  try {
    if (typeof window.getCurrentUser === 'function') {
      return window.getCurrentUser();
    }
    const raw = localStorage.getItem(USER_STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch (error) {
    console.warn('Не вдалося прочитати користувача з localStorage:', error);
    return null;
  }
}

function setStoredUser(user) {
  localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(user));
}

function setTabContentVisibility(element, isVisible) {
  if (!element) return;
  element.classList.toggle('is-visible', isVisible);
  element.style.display = isVisible ? 'block' : 'none';
}

function switchProfileTab(tab) {
  const isOrdersTab = tab === 'orders';

  const ordersContent = document.getElementById('ordersContent');
  const settingsContent = document.getElementById('settingsContent');
  const ordersTab = document.getElementById('ordersTab');
  const settingsTab = document.getElementById('settingsTab');

  setTabContentVisibility(ordersContent, isOrdersTab);
  setTabContentVisibility(settingsContent, !isOrdersTab);

  if (ordersTab) {
    ordersTab.classList.toggle('active', isOrdersTab);
  }
  if (settingsTab) {
    settingsTab.classList.toggle('active', !isOrdersTab);
  }
}

function updateProfileUI(user) {
  if (!user) return;

  const profileUsername = document.getElementById('profileUsername');
  const profileEmail = document.getElementById('profileEmail');
  const profileRole = document.getElementById('profileRole');
  const profileCreatedAt = document.getElementById('profileCreatedAt');

  if (profileUsername) profileUsername.textContent = user.username || '—';
  if (profileEmail) profileEmail.textContent = user.email || '—';
  if (profileRole) {
    profileRole.textContent = user.role === 'admin' ? '👨‍💼 Адміністратор' : '👤 Користувач';
  }
  if (profileCreatedAt && user.created_at) {
    profileCreatedAt.textContent = new Date(user.created_at).toLocaleDateString('uk-UA');
  }

  const settingsUsername = document.getElementById('settingsUsername');
  const settingsEmail = document.getElementById('settingsEmail');
  const settingsRole = document.getElementById('settingsRole');
  const settingsPhone = document.getElementById('settingsPhone');
  const settingsDefaultAddress = document.getElementById('settingsDefaultAddress');

  if (settingsUsername) settingsUsername.value = user.username || '';
  if (settingsEmail) settingsEmail.value = user.email || '';
  if (settingsRole) settingsRole.value = user.role === 'admin' ? 'Адміністратор' : 'Користувач';
  if (settingsPhone) settingsPhone.value = user.phone || '';
  if (settingsDefaultAddress) settingsDefaultAddress.value = user.default_address || '';

  const adminSection = document.getElementById('adminSection');
  if (adminSection) {
    adminSection.style.display = user.role === 'admin' ? 'grid' : 'none';
  }
}

function formatOrderDate(dateString) {
  if (!dateString) return '—';
  const date = new Date(dateString);
  if (Number.isNaN(date.getTime())) return '—';

  return new Intl.DateTimeFormat('uk-UA', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  }).format(date);
}

function formatOrderPrice(price) {
  return new Intl.NumberFormat('uk-UA', {
    style: 'currency',
    currency: 'UAH'
  }).format(Number(price) || 0);
}

function getStatusBadge(status) {
  const normalized = String(status || '').toLowerCase();
  const statusMap = {
    pending: { color: '#f59e0b', emoji: '⏳', label: 'Очікує' },
    confirmed: { color: '#3b82f6', emoji: '✅', label: 'Підтверджено' },
    processing: { color: '#6366f1', emoji: '⚙️', label: 'В обробці' },
    shipped: { color: '#10b981', emoji: '📦', label: 'Відправлено' },
    delivered: { color: '#059669', emoji: '🎉', label: 'Доставлено' },
    cancelled: { color: '#ef4444', emoji: '✖', label: 'Скасовано' }
  };

  return statusMap[normalized] || { color: '#6b7280', emoji: 'ℹ', label: 'Невідомо' };
}

function normalizeOrderItems(items) {
  if (Array.isArray(items)) return items;

  if (items && typeof items === 'object') {
    if (Array.isArray(items.items)) return items.items;
    return [];
  }

  if (typeof items === 'string') {
    try {
      const parsed = JSON.parse(items);
      if (Array.isArray(parsed)) return parsed;
      if (parsed && Array.isArray(parsed.items)) return parsed.items;
    } catch (error) {
      return [];
    }
  }

  return [];
}

function getOrderItemsCount(order) {
  const items = normalizeOrderItems(order?.items);
  if (items.length === 0) return 0;
  return items.reduce((sum, item) => {
    const quantity = Number(item?.quantity ?? item?.qty ?? item?.count ?? 1);
    return sum + (Number.isFinite(quantity) && quantity > 0 ? quantity : 1);
  }, 0);
}

function renderOrders(orders) {
  const ordersList = document.getElementById('ordersList');
  if (!ordersList) return;

  ordersList.innerHTML = orders.map(order => {
    const statusBadge = getStatusBadge(order.status);
    const itemsCount = getOrderItemsCount(order);

    return `
      <article class="profile-card profile-order-card" style="--profile-status-color: ${statusBadge.color};">
        <div class="profile-order-header">
          <div class="profile-order-meta">
            <h4 class="profile-order-title">
              Замовлення #${escapeHTML(String(order.order_number || order.id || '—'))}
            </h4>
            <p class="profile-muted">Дата: ${formatOrderDate(order.created_at)}</p>
            <p class="profile-muted">Клієнт: ${escapeHTML(order.customer_name || 'Невідомо')}</p>
            <p class="profile-muted">Товарів: ${itemsCount}</p>
          </div>

          <div class="profile-order-aside">
            <p class="profile-order-total">
              ${formatOrderPrice(order.total_price)}
            </p>
            <span class="profile-order-status">
              ${statusBadge.emoji} ${statusBadge.label}
            </span>
          </div>
        </div>
      </article>
    `;
  }).join('');
}
async function refreshUserProfile() {
  if (typeof window.apiCall !== 'function') return null;

  try {
    const result = await window.apiCall('/auth/profile', 'GET');
    if (!result.success) return null;

    const payload = result.data || {};
    if (payload.success === false) return null;

    const userData = payload.data || payload.user;
    if (!userData) return null;

    const current = getStoredUser() || {};
    const updated = {
      ...current,
      ...userData,
      token: current.token
    };

    setStoredUser(updated);
    return updated;
  } catch (error) {
    console.warn('Не вдалося оновити профіль із сервера:', error);
    return null;
  }
}

function loadUserProfile() {
  const user = getStoredUser();
  if (!user) {
    window.location.href = 'auth.html';
    return;
  }

  updateProfileUI(user);
}

async function loadUserOrders() {
  const user = getStoredUser();
  if (!user || !user.email) return;

  const ordersMessage = document.getElementById('ordersMessage');
  const ordersList = document.getElementById('ordersList');

  if (ordersMessage) {
    ordersMessage.style.display = 'block';
    ordersMessage.textContent = 'Завантаження замовлень...';
  }

  if (!ordersList) return;

  try {
    if (typeof window.apiCall !== 'function') {
      throw new Error('API недоступне');
    }

    const endpoint = `/orders/user/${encodeURIComponent(user.email)}`;
    const result = await window.apiCall(endpoint, 'GET');

    if (!result.success) {
      throw new Error(result.error || 'Не вдалося отримати замовлення');
    }

    const payload = result.data || {};
    if (payload.success === false) {
      throw new Error(payload.message || 'Не вдалося отримати замовлення');
    }

    const orders = Array.isArray(payload.data)
      ? payload.data
      : (Array.isArray(payload.orders) ? payload.orders : []);

    if (!Array.isArray(orders) || orders.length === 0) {
      if (ordersMessage) {
        ordersMessage.style.display = 'block';
        ordersMessage.textContent = 'У вас поки що немає замовлень.';
      }
      ordersList.innerHTML = `
        <p style="text-align: center; color: var(--text-muted); padding: 1rem 0 2rem;">
          Почніть покупки з <a href="products.html" style="color: var(--primary); text-decoration: underline;">каталогу</a>.
        </p>
      `;
      return;
    }

    if (ordersMessage) {
      ordersMessage.style.display = 'none';
    }
    renderOrders(orders);
  } catch (error) {
    console.error('Помилка під час завантаження замовлень:', error);
    if (ordersMessage) {
      ordersMessage.style.display = 'block';
      ordersMessage.textContent = `Помилка: ${error.message}`;
    }
    ordersList.innerHTML = `
      <p style="text-align: center; color: var(--text-muted);">
        Не вдалося завантажити замовлення. Спробуйте пізніше.
      </p>
    `;
    notify(`Помилка: ${error.message}`, 'error');
  }
}

async function saveProfile() {
  const settingsPhone = document.getElementById('settingsPhone');
  const settingsDefaultAddress = document.getElementById('settingsDefaultAddress');

  const phone = settingsPhone ? settingsPhone.value.trim() : '';
  const defaultAddress = settingsDefaultAddress ? settingsDefaultAddress.value.trim() : '';

  if (phone) {
    const digits = phone.replace(/\D/g, '');
    if (digits.length < 10) {
      notify('Введіть коректний номер телефону (мінімум 10 цифр)', 'error');
      return;
    }
  }

  if (defaultAddress && defaultAddress.length < 5) {
    notify('Адреса повинна містити щонайменше 5 символів', 'error');
    return;
  }

  try {
    if (typeof window.apiCall !== 'function') {
      throw new Error('API недоступне');
    }

    const result = await window.apiCall('/auth/profile', 'PUT', {
      phone: phone || null,
      default_address: defaultAddress || null
    });

    if (!result.success || result.data?.success === false) {
      throw new Error(result.error || result.data?.message || 'Не вдалося оновити профіль');
    }

    const userData = result.data?.data || result.data?.user;
    if (userData) {
      const current = getStoredUser() || {};
      const updated = {
        ...current,
        ...userData,
        token: current.token
      };
      setStoredUser(updated);
      updateProfileUI(updated);
    }

    if (typeof window.notifyAuthChange === 'function') {
      window.notifyAuthChange();
    }

    notify('Профіль оновлено', 'success');
  } catch (error) {
    console.error('Помилка оновлення профілю:', error);
    notify(`Помилка: ${error.message}`, 'error');
  }
}

async function handleLogout() {
  const token = localStorage.getItem(TOKEN_STORAGE_KEY);

  if (token) {
    try {
      await fetch(`${PROFILE_API_BASE_URL}/auth/logout`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
    } catch (error) {
      console.warn('Не вдалося завершити сесію на сервері:', error);
    }
  }

  localStorage.removeItem(USER_STORAGE_KEY);
  localStorage.removeItem(TOKEN_STORAGE_KEY);

  if (typeof window.notifyAuthChange === 'function') {
    window.notifyAuthChange();
  }

  notify('Ви вийшли з акаунту', 'success');
  setTimeout(() => {
    window.location.href = 'auth.html';
  }, 700);
}

function initCartButtons() {
  const cartBtn = document.getElementById('cartBtn');
  if (cartBtn) {
    cartBtn.addEventListener('click', () => {
      if (typeof window.displayCart === 'function') {
        window.displayCart();
      }
    });
  }

  const closeCartBtn = document.getElementById('closeCart');
  if (closeCartBtn) {
    closeCartBtn.addEventListener('click', () => {
      const cartModal = document.getElementById('cartModal');
      if (cartModal) {
        cartModal.classList.remove('visible');
        document.body.classList.remove('cart-open');
      }
    });
  }
}

function initMobileMenu() {
  const mobileMenuBtn = document.getElementById('mobileMenuBtn');
  const mainNav = document.getElementById('mainNav');
  if (!mobileMenuBtn || !mainNav) return;

  mobileMenuBtn.addEventListener('click', () => {
    const isActive = mainNav.classList.toggle('active');
    mobileMenuBtn.classList.toggle('active');
    mobileMenuBtn.setAttribute('aria-expanded', String(isActive));
  });

  mainNav.querySelectorAll('a').forEach(link => {
    link.addEventListener('click', () => {
      mainNav.classList.remove('active');
      mobileMenuBtn.classList.remove('active');
      mobileMenuBtn.setAttribute('aria-expanded', 'false');
    });
  });
}

document.addEventListener('DOMContentLoaded', () => {
  const user = getStoredUser();
  if (!user) {
    window.location.href = 'auth.html';
    return;
  }

  switchProfileTab('orders');
  loadUserProfile();

  refreshUserProfile().then(freshUser => {
    if (freshUser) {
      updateProfileUI(freshUser);
    }
  });

  loadUserOrders();

  if (typeof window.updateCartCount === 'function') {
    window.updateCartCount();
  }
  if (typeof window.updateAuthUI === 'function') {
    window.updateAuthUI();
  }

  initCartButtons();
  initMobileMenu();
});

window.switchProfileTab = switchProfileTab;
window.loadUserProfile = loadUserProfile;
window.loadUserOrders = loadUserOrders;
window.handleLogout = handleLogout;
window.saveProfile = saveProfile;



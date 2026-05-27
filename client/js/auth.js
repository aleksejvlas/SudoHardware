/**
 * Модуль аутентифікації: логін, реєстрація, зберігання токену, вихід.
 * Короткі правила: зберігаємо токен у localStorage для демонстрації.
 */

// ============= КОНФІГУРАЦІЯ =============

const AUTH_API_BASE_URL = window.API_BASE_URL || 'http://localhost:3000/api';

// Ключ для зберігання користувача в localStorage
const USER_STORAGE_KEY = 'rtk_user';

/**
 * Перемикає вкладки: 'login' або 'register'.
 * @param {string} tab - 'login' або 'register'
 */
function switchTab(tab) {
  console.log(`🔄 Перемикання вкладки: ${tab}`);

  clearAuthMessage();

  const loginForm = document.getElementById('loginForm');
  const registerForm = document.getElementById('registerForm');
  const loginTab = document.getElementById('loginTab');
  const registerTab = document.getElementById('registerTab');

  const isLoginTab = tab !== 'register';

  if (loginForm) {
    loginForm.classList.toggle('is-visible', isLoginTab);
    loginForm.setAttribute('aria-hidden', String(!isLoginTab));
  }
  if (registerForm) {
    registerForm.classList.toggle('is-visible', !isLoginTab);
    registerForm.setAttribute('aria-hidden', String(isLoginTab));
  }

  if (loginTab) {
    loginTab.classList.toggle('active', isLoginTab);
    loginTab.setAttribute('aria-pressed', String(isLoginTab));
  }
  if (registerTab) {
    registerTab.classList.toggle('active', !isLoginTab);
    registerTab.setAttribute('aria-pressed', String(!isLoginTab));
  }
}

// ============= ОСНОВНІ ФУНКЦІЇ =============

/**
 * Логін користувача
 * Відправляє username/email та пароль на сервер
 * При успіху зберігає токен і користувача в localStorage
 * Після входу переводить у профіль або на головну
 */
function clearAuthMessage() {
  const authMessage = document.getElementById('authMessage');
  if (!authMessage) return;

  authMessage.textContent = '';
  authMessage.style.display = 'none';
}

function showAuthMessage(message, type = 'info') {
  const authMessage = document.getElementById('authMessage');
  if (!authMessage) return;

  let borderColor = '#3b82f6';
  let bgColor = 'rgba(59, 130, 246, 0.15)';
  let textColor = '#93c5fd';

  if (type === 'error') {
    borderColor = '#ef4444';
    bgColor = 'rgba(239, 68, 68, 0.16)';
    textColor = '#fecaca';
  } else if (type === 'success') {
    borderColor = '#10b981';
    bgColor = 'rgba(16, 185, 129, 0.16)';
    textColor = '#a7f3d0';
  }

  authMessage.style.display = 'block';
  authMessage.style.border = `1px solid ${borderColor}`;
  authMessage.style.background = bgColor;
  authMessage.style.color = textColor;
  authMessage.textContent = message;
}

async function handleLogin(event) {
  if (event) {
    event.preventDefault();
  }

  clearAuthMessage();
  console.log('🔐 Спроба логіну...');

  try {
    const usernameOrEmail = document.getElementById('email-input')?.value?.trim();
    const password = document.getElementById('password-input')?.value;

    if (!usernameOrEmail || !password) {
      const message = 'Будь ласка, заповніть усі поля';
      showAuthMessage(message, 'error');
      showNotification(message, 'error');
      return;
    }

    const response = await fetch(`${AUTH_API_BASE_URL}/auth/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        username_or_email: usernameOrEmail,
        password: password
      })
    });

    let data = null;
    try {
      data = await response.json();
    } catch (parseError) {
      data = null;
    }

    if (!response.ok || !data?.success) {
      const serverMessage = data?.message || data?.error || '';
      const message = response.status === 401
        ? (serverMessage || 'Невірний логін або пароль')
        : (serverMessage || `Помилка логіну (HTTP ${response.status || 'ERR'})`);

      showAuthMessage(message, 'error');
      showNotification(message, 'error');
      return;
    }

    console.log('✅ Логін успішний:', data.user.username);
    clearAuthMessage();

    localStorage.setItem('rtk_token', data.token);
    localStorage.setItem(USER_STORAGE_KEY, JSON.stringify({
      id: data.user.id,
      username: data.user.username,
      email: data.user.email,
      role: data.user.role,
      phone: data.user.phone || null,
      default_address: data.user.default_address || null,
      token: data.token
    }));

    showNotification(`Вітаємо, ${data.user.username}! 🎉`, 'success');

    if (window.notifyAuthChange) {
      window.notifyAuthChange();
    }

    if (data.user.role === 'admin') {
      setTimeout(() => {
        window.location.href = '/profile.html';
      }, 1000);
    } else {
      setTimeout(() => {
        window.location.href = '/index.html';
      }, 1000);
    }

  } catch (error) {
    console.error('❌ Помилка при логіні:', error);
    const message = `Помилка: ${error.message}`;
    showAuthMessage(message, 'error');
    showNotification(message, 'error');
  }
}

async function handleRegister(event) {
  if (event) {
    event.preventDefault();
  }

  clearAuthMessage();
  console.log('📝 Спроба реєстрації...');

  try {
    const username = document.getElementById('register-username')?.value?.trim();
    const email = document.getElementById('register-email')?.value?.trim()?.toLowerCase();
    const phone = document.getElementById('register-phone')?.value?.trim();
    const defaultAddress = document.getElementById('register-default-address')?.value?.trim();
    const password = document.getElementById('register-password')?.value;
    const passwordConfirm = document.getElementById('register-password-confirm')?.value;

    if (!username || !email || !password || !passwordConfirm) {
      const message = 'Будь ласка, заповніть усі поля';
      showAuthMessage(message, 'error');
      showNotification(message, 'error');
      return;
    }

    if (password !== passwordConfirm) {
      const message = 'Паролі не збігаються';
      showAuthMessage(message, 'error');
      showNotification(message, 'error');
      return;
    }

    const hasLetter = /[A-Za-z]/.test(password);
    const hasDigit = /\d/.test(password);
    if (password.length < 8 || !hasLetter || !hasDigit) {
      const message = 'Пароль: мінімум 8 символів, літера і цифра';
      showAuthMessage(message, 'error');
      showNotification(message, 'error');
      return;
    }

    if (username.length < 3 || username.length > 50) {
      const message = "Ім'я користувача повинно містити від 3 до 50 символів";
      showAuthMessage(message, 'error');
      showNotification(message, 'error');
      return;
    }

    if (!/^[a-zA-Z0-9_]{3,50}$/.test(username)) {
      const message = "Ім'я користувача може містити лише букви, цифри та _";
      showAuthMessage(message, 'error');
      showNotification(message, 'error');
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
    if (!emailRegex.test(email)) {
      const message = 'Будь ласка, введіть коректну email-адресу';
      showAuthMessage(message, 'error');
      showNotification(message, 'error');
      return;
    }

    if (phone) {
      const phoneDigits = phone.replace(/\D/g, '');
      if (phoneDigits.length < 10) {
        const message = 'Введіть коректний номер телефону (мінімум 10 цифр)';
        showAuthMessage(message, 'error');
        showNotification(message, 'error');
        return;
      }
    }

    if (defaultAddress && defaultAddress.length < 5) {
      const message = 'Адреса повинна містити щонайменше 5 символів';
      showAuthMessage(message, 'error');
      showNotification(message, 'error');
      return;
    }

    const response = await fetch(`${AUTH_API_BASE_URL}/auth/register`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        username,
        email,
        password,
        phone: phone || undefined,
        default_address: defaultAddress || undefined
      })
    });

    let data = null;
    try {
      data = await response.json();
    } catch (parseError) {
      data = null;
    }

    if (!response.ok || !data?.success) {
      const serverMessage = data?.message || data?.error || '';
      const message = serverMessage || `Помилка реєстрації (HTTP ${response.status || 'ERR'})`;

      showAuthMessage(message, 'error');
      showNotification(message, 'error');
      return;
    }

    const successMessage = 'Реєстрація успішна! Тепер ви можете увійти.';
    showAuthMessage(successMessage, 'success');
    showNotification(successMessage, 'success');

    if (event?.target) {
      event.target.reset();
    }

    setTimeout(() => {
      switchTab('login');
    }, 1200);

  } catch (error) {
    console.error('❌ Помилка при реєстрації:', error);
    const message = `Помилка: ${error.message}`;
    showAuthMessage(message, 'error');
    showNotification(message, 'error');
  }
}

async function handleLogout() {
  console.log('🔒 Вихід з системи...');

  try {
    // 1️⃣ Відправляємо запит на вихід (опціонально)
    const token = localStorage.getItem('rtk_token');
    if (token) {
      await fetch(`${AUTH_API_BASE_URL}/auth/logout`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
    }

    // 2️⃣ Видаляємо дані з localStorage
    // ⚠️ ВАЖЛИВО: НЕ ВИДАЛЯЄМО rtk_cart - користувач не повинен втратити товари в кошику!
    localStorage.removeItem('rtk_token');
    localStorage.removeItem('rtk_user');
    // localStorage.removeItem('rtk_cart');  // ✅ ЗАКОМПОНОВАНО - зберігаємо кошик

    console.log('✅ Дані користувача видалені з localStorage (кошик збережений)');
    showNotification('Ви вийшли з системи', 'success');

    // 3️⃣ Редиректимо на сторінку логіну
    setTimeout(() => {
      window.location.href = '/auth.html';
    }, 1000);

  } catch (error) {
    console.error('❌ Помилка при виході:', error);
    showNotification(`Помилка: ${error.message}`, 'error');
  }
}

/**
 * Перевіряє чи користувач залогінені й отримує його дані
 * Повертає об'єкт користувача або null
 */
function getCurrentUser() {
  try {
    const userJson = localStorage.getItem(USER_STORAGE_KEY);
    if (!userJson) {
      return null;
    }

    const user = JSON.parse(userJson);
    return user;
  } catch (error) {
    console.error('❌ Помилка при отриманні користувача:', error);
    return null;
  }
}

/**
 * Отримує збережений JWT-токен
 */
function getAuthToken() {
  return localStorage.getItem('rtk_token');
}

/**
 * Перевіряє чи користувач є адміном
 */
function isAdmin() {
  const user = getCurrentUser();
  return user && user.role === 'admin';
}

/**
 * Перевіряє чи користувач залогінений
 */
function isLoggedIn() {
  return getCurrentUser() !== null;
}

/**
 * Показує повідомлення користувачу
 * ✅ ДЕЛЬНА РЕАЛІЗАЦІЯ - Toast Notification (як в app.js)
 * @param {string} message - Текст повідомлення
 * @param {string} type - Тип ('success', 'error', 'info')
 */
function showNotification(message, type = 'info', duration = 3000) {
  // Якщо app.js вже загружена - використовуємо її функцію
  if (window.showNotification && window.showNotification !== showNotification) {
    return window.showNotification(message, type, duration);
  }

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

  // Автоматичне видалення після тайм-ауту
  setTimeout(() => {
    toast.style.animation = 'slideOutLeft 0.3s ease';
    setTimeout(() => {
      toast.remove();
      // Видаляємо контейнер якщо він порожній
      if (container.children.length === 0) {
        container.remove();
      }
    }, 300);
  }, duration);

  console.log(`[${type.toUpperCase()}] ${message}`);
}

/**
 * Перевіряє чи токен валідний на сервері
 * Викликається при завантаженні сторінки
 */
async function verifyToken() {
  const token = getAuthToken();
  if (!token) {
    return false;
  }

  try {
    const response = await fetch(`${AUTH_API_BASE_URL}/auth/verify`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });

    const data = await response.json();
    return data.success;
  } catch (error) {
    console.error('❌ Помилка при верифікації токену:', error);
    return false;
  }
}

/**
 * Захищає адміністративні сторінки
 * Викликається при завантаженні admin.html
 */
function protectAdminPage() {
  const user = getCurrentUser();

  if (!user || user.role !== 'admin') {
    console.warn('⚠️ Доступ заборонений! Користувач не є адміном.');
    alert('Доступ заборонено. Потрібні права адміністратора.');
    window.location.href = '/auth.html';
    return false;
  }

  console.log(`✅ Адміністративний доступ дозволено для ${user.username}`);
  return true;
}

/**
 * Ініціалізація при завантаженні сторінки
 */
document.addEventListener('DOMContentLoaded', () => {
  console.log('🚀 Auth модуль ініціалізований');
  switchTab('login');

  // Перевіряємо чи користувач залогінений
  const user = getCurrentUser();
  if (user) {
    console.log(`👤 Користувач залогінений як: ${user.username} (${user.role})`);
  } else {
    console.log('👥 Користувач не залогінений');
  }

  // 🔧 Обробники вже встановлені через onsubmit атрибут в HTML
  // Не додаємо додаткові addEventListener щоб не дублювати виклики

  // Встановлюємо обробник для кнопки логауту
  const logoutBtn = document.getElementById('logoutBtn');
  if (logoutBtn) {
    logoutBtn.addEventListener('click', handleLogout);
    console.log('✅ Обробник для кнопки логауту встановлений');
  }

  // Обновляємо UI залежно від статусу логіну
  updateAuthUI();
});

/**
 * Обновляє UI залежно від того, залогінений ли користувач
 * Показує/приховує кнопки логіну та логауту
 */
function updateAuthUI() {
  const user = getCurrentUser();
  const loginBtn = document.getElementById('loginBtn') || document.getElementById('cartBtn');
  const logoutBtn = document.getElementById('logoutBtn');
  const userNameEl = document.getElementById('userName');

  if (user) {
    // Користувач залогінений
    if (loginBtn) loginBtn.style.display = 'none';
    if (logoutBtn) logoutBtn.style.display = 'inline-block';
    if (userNameEl) userNameEl.textContent = `${user.username}`;

    console.log(`✅ UI обновлено: користувач ${user.username} залогінений`);
  } else {
    // Користувач не залогінений
    if (loginBtn) loginBtn.style.display = 'inline-block';
    if (logoutBtn) logoutBtn.style.display = 'none';
    if (userNameEl) userNameEl.textContent = '';

    console.log('✅ UI обновлено: користувач не залогінений');
  }
}

// Експорт функцій для використання в HTML та інших модулів
window.handleLogin = handleLogin;
window.handleLogout = handleLogout;
window.handleRegister = handleRegister;
window.switchTab = switchTab;
window.getCurrentUser = getCurrentUser;
window.getAuthToken = getAuthToken;
window.isAdmin = isAdmin;
window.isLoggedIn = isLoggedIn;
window.protectAdminPage = protectAdminPage;
window.updateAuthUI = updateAuthUI;

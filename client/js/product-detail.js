let currentProduct = null;
let currentProductId = null;

function hasVisibleDescription(rawDescription) {
  const normalized = String(rawDescription || '').trim();
  if (!normalized) return false;
  return normalized.toLowerCase() !== 'немає опису';
}

document.addEventListener('DOMContentLoaded', async () => {
  const urlParams = new URLSearchParams(window.location.search);
  currentProductId = parseInt(urlParams.get('id'), 10);

  if (!currentProductId || Number.isNaN(currentProductId)) {
    showError('Товар не знайдено');
    return;
  }

  await loadProduct();
  await loadReviews();
  setupEventHandlers();

  updateAuthUI();
  updateCartDisplay();
});

async function loadProduct() {
  try {
    const response = await fetch(`${API_BASE_URL}/products/${currentProductId}`);

    if (!response.ok) {
      throw new Error('Товар не знайдено');
    }

    const data = await response.json();
    currentProduct = data.data || data;

    if (!currentProduct || !currentProduct.id) {
      throw new Error('Невалідні дані товару');
    }

    renderProductDetails();

    document.getElementById('loadingSpinner').style.display = 'none';
    document.getElementById('productContent').style.display = 'block';
  } catch (error) {
    console.error('Помилка при завантаженні товару:', error);
    showError(`Помилка при завантаженні товару: ${error.message}`);
  }
}

async function loadReviews() {
  try {
    const response = await fetch(`${API_BASE_URL}/reviews?product_id=${currentProductId}&limit=50`);

    if (!response.ok) {
      console.warn('Не вдалося завантажити відгуки');
      return;
    }

    const data = await response.json();
    const reviewsData = data.data || {};
    const reviews = reviewsData.reviews || [];
    const stats = reviewsData.stats || {};

    renderReviewsStats(stats);
    renderReviewsList(reviews);
  } catch (error) {
    console.error('Помилка при завантаженні відгуків:', error);
  }
}

function renderProductDetails() {
  const category = getCategoryLabel(currentProduct.category);
  const price = formatPrice(currentProduct.price);
  const specs = parseSpecs(currentProduct.specs);
  const descriptionElement = document.getElementById('productDescription');
  const descriptionRaw = currentProduct && currentProduct.description
    ? String(currentProduct.description).trim()
    : '';
  const shouldRenderDescription = hasVisibleDescription(descriptionRaw);

  document.getElementById('productName').textContent = currentProduct.name || '';
  document.getElementById('productCategory').textContent = category || 'Невідома категорія';

  if (descriptionElement) {
    descriptionElement.textContent = shouldRenderDescription ? descriptionRaw : '';
    descriptionElement.style.display = shouldRenderDescription ? '' : 'none';
  }

  document.getElementById('productPrice').textContent = price;
  document.getElementById('productImage').src = currentProduct.image_url || 'https://via.placeholder.com/500';
  document.getElementById('productImage').alt = currentProduct.name || '';
  document.title = `${currentProduct.name} — SudoHardware`;

  const stockStatus = document.getElementById('stockStatus');
  const stock = Number(currentProduct.stock || 0);

  if (stock > 0) {
    stockStatus.textContent = `В наявності: ${stock}`;
    stockStatus.classList.add('in-stock');
    stockStatus.classList.remove('out-of-stock');
  } else {
    stockStatus.textContent = 'Немає в наявності';
    stockStatus.classList.add('out-of-stock');
    stockStatus.classList.remove('in-stock');
  }

  const addToCartBtn = document.getElementById('addToCartBtn');
  addToCartBtn.disabled = stock <= 0;
  if (stock <= 0) {
    addToCartBtn.style.opacity = '0.5';
    addToCartBtn.style.cursor = 'not-allowed';
  }

  renderProductSpecs(specs);
}

function renderProductSpecs(specs) {
  const specsList = document.getElementById('specsList');

  if (!specs || Object.keys(specs).length === 0) {
    document.getElementById('specsContainer').style.display = 'none';
    return;
  }

  specsList.innerHTML = Object.entries(specs)
    .slice(0, 8)
    .map(([key, value]) => `
      <div class="spec-item">
        <span class="spec-label">${escapeHTML(key)}</span>
        <span class="spec-value">${escapeHTML(String(value))}</span>
      </div>
    `)
    .join('');
}

function renderReviewsStats(stats) {
  const totalReviews = parseInt(stats.total_reviews || 0, 10);
  const avgRating = parseFloat(stats.average_rating || 0).toFixed(1);

  document.getElementById('avgRating').textContent = totalReviews > 0 ? avgRating : 'Немає оцінок';
  document.getElementById('totalReviews').textContent = totalReviews;
  document.getElementById('avgRatingStars').innerHTML = renderStarsForRating(Math.round(avgRating));

  const ratingDistribution = document.getElementById('ratingDistribution');
  if (totalReviews > 0) {
    ratingDistribution.innerHTML = [5, 4, 3, 2, 1]
      .map(rating => {
        const count = parseInt(stats[`count_${rating}_stars`] || 0, 10);
        const percentage = totalReviews > 0 ? Math.round((count / totalReviews) * 100) : 0;

        return `
          <div class="rating-bar">
            <div class="rating-bar-label">${rating}★</div>
            <div class="rating-bar-fill">
              <div class="rating-bar-progress" style="width: ${percentage}%"></div>
            </div>
            <div class="rating-bar-count">${count}</div>
          </div>
        `;
      })
      .join('');
  }
}

function renderReviewsList(reviews) {
  const reviewsList = document.getElementById('reviewsList');

  if (!reviews || reviews.length === 0) {
    reviewsList.innerHTML = '<div class="no-reviews">Ще немає відгуків. Будьте перші!</div>';
    return;
  }

  reviewsList.innerHTML = reviews
    .map(review => `
      <div class="review-card">
        <div class="review-header">
          <span class="review-author">${escapeHTML(review.author_name)}</span>
          <span class="review-date">${formatDate(review.created_at)}</span>
        </div>

        <div class="review-rating">
          ${renderStarsForRating(review.rating)}
        </div>

        ${review.title ? `<div class="review-title">${escapeHTML(review.title)}</div>` : ''}
        ${review.comment ? `<div class="review-comment">${escapeHTML(review.comment)}</div>` : ''}

        <div class="review-footer">
          <button class="helpful-btn" onclick="markReviewAsHelpful(${review.id})">
            👍 Корисна (${review.helpful_count || 0})
          </button>
        </div>
      </div>
    `)
    .join('');
}

function setupEventHandlers() {
  const reviewForm = document.getElementById('reviewForm');
  if (reviewForm) {
    reviewForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      await submitReview();
    });
  }

  const addToCartBtn = document.getElementById('addToCartBtn');
  if (addToCartBtn) {
    addToCartBtn.addEventListener('click', () => {
      addToCart(currentProductId);
    });
  }
}

async function submitReview() {
  try {
    const authorName = document.getElementById('authorName').value.trim();
    const rating = document.querySelector('input[name="rating"]:checked')?.value;
    const title = document.getElementById('reviewTitle').value.trim();
    const comment = document.getElementById('reviewComment').value.trim();

    if (!authorName) {
      showNotification("Введіть ваше ім'я", 'error');
      return;
    }

    if (!rating) {
      showNotification('Виберіть оцінку', 'error');
      return;
    }

    const response = await fetch(`${API_BASE_URL}/reviews`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        product_id: currentProductId,
        author_name: authorName,
        rating: parseInt(rating, 10),
        title: title || undefined,
        comment: comment || undefined
      })
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Помилка при публікації відгуку');
    }

    document.getElementById('reviewForm').reset();
    showNotification('Відгук успішно опубліковано! Дякуємо!', 'success');

    await loadReviews();
  } catch (error) {
    console.error('Помилка при відправленні відгуку:', error);
    showNotification(`Помилка: ${error.message}`, 'error');
  }
}

async function markReviewAsHelpful(reviewId) {
  try {
    const response = await fetch(`${API_BASE_URL}/reviews/${reviewId}/helpful`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      throw new Error('Помилка при позначенні як корисна');
    }

    showNotification('Спасибі за оцінку!', 'success');
    await loadReviews();
  } catch (error) {
    console.error('Помилка:', error);
    showNotification(`Помилка: ${error.message}`, 'error');
  }
}

function showError(message) {
  const spinner = document.getElementById('loadingSpinner');
  spinner.innerHTML = `
    <div style="color: var(--danger); padding: 2rem;">
      <p>✖ ${message}</p>
      <p><a href="products.html" style="color: var(--primary); text-decoration: underline;">Повернутися до каталогу</a></p>
    </div>
  `;
  spinner.style.display = 'block';
  document.getElementById('productContent').style.display = 'none';
}

function renderStarsForRating(rating) {
  let stars = '';
  for (let i = 1; i <= 5; i++) {
    stars += `<span class="star ${i <= rating ? 'filled' : ''}">★</span>`;
  }
  return stars;
}

function formatDate(dateString) {
  const date = new Date(dateString);
  const now = new Date();
  const diff = now - date;

  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);

  if (minutes < 60) {
    return `${minutes} хв. тому`;
  }
  if (hours < 24) {
    return `${hours} год. тому`;
  }
  if (days < 30) {
    return `${days} дн. тому`;
  }

  const options = { day: 'numeric', month: 'long', year: 'numeric' };
  return date.toLocaleDateString('uk-UA', options);
}

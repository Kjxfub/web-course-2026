// ЛР №7: fetch + async/await, бесконечный скролл, обработка ошибок и поиск.
const API = 'https://jsonplaceholder.typicode.com/posts';
const PAGE_SIZE = 10;
const TOTAL_POSTS = 100;

// Вымышленные заведения выступают визуальными авторами; userId API сохраняется отдельно.
const venues = [
  { name: 'VELVET ROOM', category: 'lounge', type: 'Лаундж', description: 'Бархатный свет, живая музыка и разговоры, которые не хочется заканчивать.', image: 'jazz.webp', theme: 'amber', rating: 5, monogram: 'VR', label: 'LIVE JAZZ / COCKTAILS' },
  { name: 'RED HAZE', category: 'hookah', type: 'Кальянная', description: 'Густой дым, алые отблески и собственный ритм после полуночи.', image: 'hookah.webp', theme: 'smoke', rating: 5, monogram: 'RH', label: 'SMOKE / LATE NIGHT' },
  { name: 'EIGHT BALL', category: 'billiards', type: 'Бильярдная', description: 'Тёмный сукно, точный удар и ещё одна партия под авторский коктейль.', image: 'billiards.webp', theme: 'ruby', rating: 4, monogram: '8B', label: 'BILLIARDS / SOCIAL CLUB' },
  { name: 'ROUGE 27', category: 'bar', type: 'Коктейль-бар', description: 'Красный бархат, ледяные бокалы и эстетика удачной ночи.', image: 'roulette.webp', theme: 'scarlet', rating: 4, monogram: 'R27', label: 'SIGNATURE COCKTAILS' },
  { name: 'LUCKY BLUE', category: 'bar', type: 'Бар', description: 'Музыка, яркие детали и бокалы, за которыми собираются друзья.', image: 'dice.webp', theme: 'cobalt', rating: 3, monogram: 'LB', label: 'BAR / GOOD LUCK' },
  { name: 'NOIR TABLE', category: 'restaurant', type: 'Ресторан', description: 'Ужин с видом на огни города и настроение большого вечера.', image: 'jazz.webp', theme: 'midnight', rating: 5, monogram: 'NT', label: 'DINNER / CITY LIGHTS' },
  { name: 'EMBER SMOKE', category: 'hookah', type: 'Кальянная', description: 'Тёплый полумрак, пряные ароматы и медленно струящийся дым.', image: 'hookah.webp', theme: 'smoke', rating: 4, monogram: 'ES', label: 'HOOKAH / SLOW EVENINGS' },
  { name: 'CORNER POCKET', category: 'billiards', type: 'Бильярдная', description: 'Хорошая игра, приглушённый свет и приятная компания.', image: 'billiards.webp', theme: 'bronze', rating: 4, monogram: 'CP', label: 'POOL / NIGHT CLUB' },
  { name: 'CHERRY HOUR', category: 'lounge', type: 'Лаундж', description: 'Мягкие диваны, музыка на виниле и неспешный вечер без планов.', image: 'roulette.webp', theme: 'scarlet', rating: 3, monogram: 'CH', label: 'LOUNGE / VINYL' },
  { name: 'GOLDEN HOUR', category: 'restaurant', type: 'Ресторан', description: 'Авторская кухня, золото вечерних огней и немного джаза.', image: 'jazz.webp', theme: 'amber', rating: 5, monogram: 'GH', label: 'DINING / JAZZ' }
];

const postsGrid = document.getElementById('postsGrid');
const loadingState = document.getElementById('loadingState');
const errorState = document.getElementById('errorState');
const errorMessage = document.getElementById('errorMessage');
const endState = document.getElementById('endState');
const emptyState = document.getElementById('emptyState');
const loadedCount = document.getElementById('loadedCount');
const filterStatus = document.getElementById('filterStatus');
const feedHint = document.getElementById('feedHint');
const scrollSentinel = document.getElementById('scrollSentinel');
const searchInput = document.getElementById('searchInput');

const allPosts = []; // Все загруженные посты хранятся в одном массиве.
let nextOffset = 0;
let isLoading = false;
let isFinished = false;
let hasError = false;
let searchText = '';
let category = 'all';
let debounceTimer;

function escapeHTML(value) {
  return String(value).replace(/[&<>"']/g, char => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  })[char]);
}

function venueFor(post) {
  return venues[(Number(post.id) - 1 + venues.length) % venues.length];
}

function makePostCard(post) {
  const venue = venueFor(post);
  const article = document.createElement('article');
  article.className = 'venue-card';
  article.dataset.theme = venue.theme;
  article.dataset.category = venue.category;

  const stars = Array.from({ length: 5 }, (_, i) =>
    `<span class="${i < venue.rating ? 'star-full' : 'star-empty'}">★</span>`
  ).join('');

  article.innerHTML = `
    <div class="card-visual ${venue.category === 'hookah' ? 'has-smoke' : ''}">
      <img src="assets/${venue.image}" alt="Атмосфера заведения ${escapeHTML(venue.name)}" loading="lazy">
      <div class="visual-pattern" aria-hidden="true"></div>
      ${venue.category === 'hookah' ? '<div class="smoke-cloud" aria-hidden="true"></div>' : ''}
      <div class="visual-top"><span class="visual-number">N° ${String(post.id).padStart(3, '0')}</span><span class="visual-location">MINSK / BY</span></div>
      <div class="visual-bottom"><span class="visual-label">${escapeHTML(venue.label)}</span><h3>${escapeHTML(venue.name)}</h3></div>
    </div>
    <div class="card-content">
      <div class="card-author"><span class="venue-avatar">${escapeHTML(venue.monogram)}</span>
        <div class="author-meta"><strong>${escapeHTML(venue.name)}</strong><span>${escapeHTML(venue.type)} · Минск</span></div>
        <div class="rating" title="Демонстрационный рейтинг: ${venue.rating} из 5" aria-label="Демонстрационный рейтинг: ${venue.rating} из 5"><span class="rating-stars">${stars}</span><b>${venue.rating}.0</b></div>
      </div>
      <p class="venue-description">${escapeHTML(venue.description)}</p>
      <div class="post-copy"><div class="post-eyebrow">ПУБЛИКАЦИЯ / <span>POST ${String(post.id).padStart(3, '0')}</span></div>
        <h4>${escapeHTML(post.title)}</h4><p>${escapeHTML(post.body)}</p>
      </div>
      <div class="card-bottom"><span>API USER ID <b>${escapeHTML(post.userId)}</b></span><span>POST ID <b>${escapeHTML(post.id)}</b></span><span class="card-bottom-symbol" aria-hidden="true">✳</span></div>
    </div>`;
  return article;
}

function hasActiveFilter() {
  return searchText !== '' || category !== 'all';
}

function renderPosts() {
  const visiblePosts = allPosts.filter(post => {
    const titleMatches = post.title.toLocaleLowerCase().includes(searchText);
    const categoryMatches = category === 'all' || venueFor(post).category === category;
    return titleMatches && categoryMatches;
  });
  const fragment = document.createDocumentFragment();
  for (const post of visiblePosts) fragment.appendChild(makePostCard(post));
  postsGrid.replaceChildren(fragment);

  loadedCount.textContent = allPosts.length;
  filterStatus.textContent = hasActiveFilter()
    ? `НАЙДЕНО: ${visiblePosts.length} ИЗ ${allPosts.length} ЗАГРУЖЕННЫХ`
    : 'ПОКАЗАНЫ ВСЕ ЗАГРУЖЕННЫЕ';
  emptyState.hidden = !(hasActiveFilter() && visiblePosts.length === 0);
  updateState();
}

function updateState() {
  loadingState.hidden = !isLoading;
  errorState.hidden = !hasError;
  endState.hidden = !isFinished || hasActiveFilter();
  scrollSentinel.hidden = isLoading || hasError || isFinished || hasActiveFilter();
  feedHint.textContent = hasActiveFilter()
    ? 'Поиск и категории фильтруют только загруженные посты. Сбросьте фильтры, чтобы продолжить подгрузку.'
    : isFinished ? 'Конец коллекции — все публикации загружены.'
    : 'Листайте вниз — новые публикации появятся автоматически.';
}

async function loadMorePosts() {
  if (isLoading || isFinished || hasError || hasActiveFilter()) return;
  isLoading = true;
  updateState();

  try {
    // Каждая порция загружается отдельным fetch внутри try/catch.
    const response = await fetch(`${API}?_start=${nextOffset}&_limit=${PAGE_SIZE}`);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const newPosts = await response.json();
    if (!Array.isArray(newPosts)) throw new Error('Некорректный ответ сервера');

    allPosts.push(...newPosts);
    nextOffset += newPosts.length;
    isFinished = newPosts.length < PAGE_SIZE || nextOffset >= TOTAL_POSTS;
    renderPosts();
  } catch (error) {
    hasError = true;
    errorMessage.textContent = `Не удалось загрузить посты (${error.message}). Проверьте интернет и попробуйте снова.`;
  } finally {
    isLoading = false;
    updateState();
  }
}

// Подгрузка за 250 px до нижней границы списка.
const observer = new IntersectionObserver(entries => {
  if (entries[0].isIntersecting) loadMorePosts();
}, { rootMargin: '0px 0px 250px 0px' });
observer.observe(scrollSentinel);

// Дебаунс 300 мс: фильтр работает на клиенте, без сетевых запросов.
searchInput.addEventListener('input', () => {
  clearTimeout(debounceTimer);
  debounceTimer = setTimeout(() => {
    searchText = searchInput.value.trim().toLocaleLowerCase();
    renderPosts();
  }, 300);
});

document.querySelectorAll('[data-category]').forEach(button => {
  button.addEventListener('click', () => {
    category = button.dataset.category;
    document.querySelectorAll('[data-category]').forEach(chip => {
      const active = chip === button;
      chip.classList.toggle('is-active', active);
      chip.setAttribute('aria-pressed', String(active));
    });
    renderPosts();
  });
});

document.getElementById('retryButton').addEventListener('click', () => {
  hasError = false;
  loadMorePosts();
});

// При открытии страницы сразу получаем первую порцию из 10 постов.
loadMorePosts();

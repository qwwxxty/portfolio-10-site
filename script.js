/* =========================================================
   Емаль — інтерфейс, прокрутка, завантаження 3D, слоти відео
   ========================================================= */

/* ---------------------------------------------------------
   СЛОТИ ВІДЕО (див. VIDEOS.md)
   Поклади файли в assets/video/ (назва.webm + назва.mp4)
   і перемкни потрібний слот на true. Поки false — у слоті
   працює графіка з коду, і зайвих запитів немає.
   --------------------------------------------------------- */
const VIDEO = {
  hero:  { on: false, src: 'assets/video/hero' },          // сцена 1, фон
  crown: { on: false, src: 'assets/video/crown-scrub' },   // сцена 4, крутиться скролом
  cardA: { on: false, src: 'assets/video/card-microscope' }, // сцена 5, скляна картка 1
  cardB: { on: false, src: 'assets/video/card-kids' },     // сцена 5, скляна картка 2
};

const root = document.documentElement;
const params = new URLSearchParams(location.search);
const isStatic = root.classList.contains('is-static');
const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
const coarse = matchMedia('(pointer: coarse)').matches;
const desktopMQ = matchMedia('(min-width: 1024px)');

/* Рівень якості: телефон — менше частинок і без bloom; слабке залізо — «lite» */
const cores = navigator.hardwareConcurrency || 4;
const memory = navigator.deviceMemory || 4;
let tier = (coarse || innerWidth < 768) ? 'mobile' : 'desktop';
if (params.has('lite') || (tier === 'mobile' && (cores <= 4 || memory <= 3))) tier = 'lite';
if (tier === 'lite') root.classList.add('is-lite');

const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];
const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
const smooth = (t) => t * t * (3 - 2 * t);

/* =========================================================
   1. Шапка, меню, навігація
   ========================================================= */
const topbar = $('#topbar');
const heroVideo = $('[data-slot="hero"]');
const crownVideo = $('[data-slot="crown"]');
let scrubLoop = 0;      // цикл перемотки відео сцени 4
let crownNear = false;  // сцена 4 поруч із екраном
const menu = $('#menu');
const menuBtn = $('#menu-btn');
const dock = $('#dock');

function setMenu(open) {
  menuBtn.setAttribute('aria-expanded', String(open));
  menuBtn.querySelector('.menu-btn__label').textContent = open ? 'Закрити' : 'Меню';
  menu.hidden = !open;
  root.classList.toggle('has-menu', open);
  if (open) menu.querySelector('a').focus();
  window.__stage?.setPaused?.(open);
}
menuBtn.addEventListener('click', () => setMenu(menu.hidden));
menu.addEventListener('click', (e) => { if (e.target.closest('a')) setMenu(false); });
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && !menu.hidden) { setMenu(false); menuBtn.focus(); }
});
desktopMQ.addEventListener('change', (e) => { if (e.matches && !menu.hidden) setMenu(false); });

/* Підсвітка активного розділу в навігації */
const navLinks = $$('.topnav a');
const navTargets = navLinks.map((a) => $(a.getAttribute('href'))).filter(Boolean);
const navIO = new IntersectionObserver((entries) => {
  entries.forEach((en) => {
    if (!en.isIntersecting) return;
    navLinks.forEach((a) => {
      if (a.getAttribute('href') === '#' + en.target.id) a.setAttribute('aria-current', 'true');
      else a.removeAttribute('aria-current');
    });
  });
}, { rootMargin: '-45% 0px -50% 0px' });
navTargets.forEach((t) => navIO.observe(t));

/* Нижня панель ховається, коли форма запису вже на екрані */
const bookForm = $('#book-form');
new IntersectionObserver(([en]) => dock.classList.toggle('is-hidden', en.isIntersecting), { threshold: 0.15 })
  .observe(bookForm);

/* =========================================================
   2. Прайс-шкала: зразок висувається; запис з послугою
   ========================================================= */
const tabs = $$('.tab');
tabs.forEach((tab) => {
  tab.addEventListener('click', (e) => {
    if (e.target.closest('a')) return;
    const was = tab.classList.contains('is-out');
    tabs.forEach((t) => t.classList.remove('is-out'));
    if (!was) tab.classList.add('is-out');
  });
});

const serviceSelect = $('#f-service');
document.addEventListener('click', (e) => {
  const link = e.target.closest('[data-service]');
  if (!link) return;
  const val = link.dataset.service;
  const opt = [...serviceSelect.options].find((o) => o.value === val || o.text === val);
  if (opt) serviceSelect.value = opt.value;
});

/* =========================================================
   3. Форма запису (Formspree; без секретів у коді)
   ========================================================= */
const formStatus = $('#form-status');
bookForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  const name = $('#f-name');
  const phone = $('#f-phone');
  const digits = phone.value.replace(/\D/g, '');
  let bad = null;
  name.removeAttribute('aria-invalid');
  phone.removeAttribute('aria-invalid');
  if (!name.value.trim()) bad = name;
  else if (digits.length < 10 || digits.length > 12) bad = phone;
  if (bad) {
    bad.setAttribute('aria-invalid', 'true');
    bad.focus();
    formStatus.className = 'form-status is-err';
    formStatus.textContent = bad === name ? 'Підкажіть, як до вас звертатися.' : 'Перевірте номер: потрібно 10–12 цифр.';
    return;
  }

  // Поки в action стоїть заглушка — нічого не відправляємо (демо)
  if (bookForm.action.includes('YOUR_FORM_ID')) {
    formStatus.className = 'form-status is-ok';
    formStatus.textContent = `Дякуємо, ${name.value.trim()}! Це демо-форма, тож заявка нікуди не пішла. На справжньому сайті адміністраторка передзвонила б за 15 хвилин.`;
    bookForm.reset();
    return;
  }

  const btn = bookForm.querySelector('[type=submit]');
  btn.disabled = true;
  formStatus.className = 'form-status';
  formStatus.textContent = 'Надсилаємо…';
  try {
    const res = await fetch(bookForm.action, {
      method: 'POST', body: new FormData(bookForm), headers: { Accept: 'application/json' },
    });
    if (!res.ok) throw new Error(String(res.status));
    formStatus.className = 'form-status is-ok';
    formStatus.textContent = 'Заявку отримали! Передзвонимо протягом 15 хвилин у робочий час.';
    bookForm.reset();
  } catch {
    formStatus.className = 'form-status is-err';
    formStatus.textContent = 'Не вдалося надіслати. Подзвоніть нам: 050 000 00 00 — або напишіть у Telegram.';
  } finally {
    btn.disabled = false;
  }
});

/* =========================================================
   4. «Зараз відчинено / зачинено» за київським часом
   ========================================================= */
function updateOpenStatus() {
  const el = $('#open-status');
  try {
    const parts = new Intl.DateTimeFormat('en-GB', {
      timeZone: 'Europe/Kyiv', weekday: 'short', hour: '2-digit', minute: '2-digit', hour12: false,
    }).formatToParts(new Date());
    const get = (t) => parts.find((p) => p.type === t)?.value;
    const day = get('weekday');
    const mins = Number(get('hour')) * 60 + Number(get('minute'));
    const weekday = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'].includes(day);
    const open = weekday ? mins >= 480 && mins < 1200 : day === 'Sat' ? mins >= 540 && mins < 900 : false;
    const close = weekday ? '20:00' : '15:00';
    el.classList.toggle('is-open', open);
    el.textContent = open ? `Зараз відчинено, до ${close}` : 'Зараз зачинено — залиште заявку, передзвонимо зранку';
  } catch { el.textContent = ''; }
}
updateOpenStatus();
setInterval(updateOpenStatus, 60_000);

/* =========================================================
   5. Прокрутка → номер сцени для 3D
   f — «плаваючий» номер сцени: 0…5. Ціле число — сцена стоїть,
   дробове — перехід між сценами.
   ========================================================= */
const scenes = $$('.scene');
const meterNum = $('#meter-num');
const meterFill = $('#meter-fill');
const meterName = $('#meter-name');
let metrics = [];
let vh = innerHeight;
let vw = innerWidth;

const state = {
  f: 0,            // сцена (плаваюча)
  local: new Float32Array(scenes.length), // прогрес сцени від входу до виходу
  pin: new Float32Array(scenes.length),   // прогрес «приклеєної» частини сцени
  arrive: new Float32Array(scenes.length), // прибуття: від появи верху сцени до +1.4 екрана
  pointer: { x: 0, y: 0 },
  crownVideo: false,
  desktop: desktopMQ.matches,
  vw, vh,
};

function measure() {
  const y = scrollY;
  vh = innerHeight; vw = innerWidth;
  metrics = scenes.map((s) => {
    const r = s.getBoundingClientRect();
    return { top: r.top + y, h: r.height };
  });
  state.desktop = desktopMQ.matches;
  state.vw = vw; state.vh = vh;
}

function computeScroll() {
  const y = scrollY;
  const n = metrics.length;
  let f = n - 1;
  for (let i = 0; i < n - 1; i++) {
    const end = metrics[i].top + metrics[i].h;
    const t0 = end - 0.8 * vh;
    const t1 = end - 0.2 * vh;
    if (y < t0) { f = i; break; }
    if (y < t1) { f = i + smooth((y - t0) / (t1 - t0)); break; }
  }
  state.f = f;
  for (let i = 0; i < n; i++) {
    const m = metrics[i];
    state.local[i] = clamp((y + vh - m.top) / (m.h + vh));
    state.pin[i] = clamp((y - m.top) / Math.max(1, m.h - vh));
    state.arrive[i] = clamp((y - m.top + 0.9 * vh) / (1.4 * vh));
  }
}

let lastMeter = -1;
const shadeCodes = ['B1', 'A1', 'B2', 'D2', 'A2', 'C1', 'C2', 'D4'];
const scanPct = $('#scan-pct');
const scanShade = $('#scan-shade');
function updateHud() {
  const idx = Math.round(state.f);
  if (idx !== lastMeter) {
    lastMeter = idx;
    meterNum.textContent = String(idx + 1).padStart(2, '0');
    meterName.textContent = scenes[idx]?.dataset.name || '';
  }
  meterFill.style.transform = `scaleY(${(state.f / (scenes.length - 1)).toFixed(4)})`;
  root.classList.toggle('is-end', scrollY + vh > document.body.scrollHeight - 40);
  topbar.classList.toggle('is-solid', scrollY > 40);

  // Сцена 4: показник «сканування»
  const p = state.pin[3];
  scanPct.textContent = String(Math.round(p * 100));
  scanShade.textContent = shadeCodes[Math.min(shadeCodes.length - 1, Math.floor(p * shadeCodes.length))];
  scrubVideo();
}

let ticking = false;
function onScroll() {
  if (ticking) return;
  ticking = true;
  requestAnimationFrame(() => { computeScroll(); updateHud(); ticking = false; });
}
addEventListener('scroll', onScroll, { passive: true });

let resizeTimer;
addEventListener('resize', () => {
  clearTimeout(resizeTimer);
  resizeTimer = setTimeout(() => { measure(); computeScroll(); updateHud(); }, 120);
});
new ResizeObserver(() => { measure(); computeScroll(); }).observe($('main'));

addEventListener('pointermove', (e) => {
  if (e.pointerType === 'touch') return;
  state.pointer.x = (e.clientX / vw) * 2 - 1;
  state.pointer.y = -(e.clientY / vh) * 2 + 1;
}, { passive: true });

measure();
computeScroll();
updateHud();

/* =========================================================
   6. Слоти відео: підвантажуємо, лише коли сцена близько
   ========================================================= */
function attachSources(video, base) {
  if (video.dataset.loaded) return;
  video.dataset.loaded = '1';
  video.preload = 'auto';
  [['webm', 'video/webm'], ['mp4', 'video/mp4']].forEach(([ext, type]) => {
    const s = document.createElement('source');
    s.src = `${base}.${ext}`; s.type = type;
    video.appendChild(s);
  });
  video.load();
}

if (!isStatic) {
  const near = (el, cb) => {
    const io = new IntersectionObserver(([en]) => { if (en.isIntersecting) { cb(); io.disconnect(); } }, { rootMargin: '100% 0px' });
    io.observe(el);
  };
  // Фон першої сцени вантажимо вже після інтро, щоб не важчала перша загрузка;
  // на слабких телефонах і з увімкненою економією трафіку — не вантажимо зовсім
  const saveData = navigator.connection?.saveData;
  if (VIDEO.hero.on && tier !== 'lite' && !saveData) {
    const startHero = () => near($('#intro'), () => {
      attachSources(heroVideo, VIDEO.hero.src);
      heroVideo.classList.add('is-on');
      heroVideo.play().catch(() => {});
    });
    addEventListener('emal:intro-done', () => setTimeout(startHero, 1500), { once: true });
  }
  if (VIDEO.crown.on) {
    near($('#koronka'), () => {
      attachSources(crownVideo, VIDEO.crown.src);
      crownVideo.classList.add('is-on');
      crownVideo.pause();
      // коли відео є, частинкова коронка в 3D гасне, щоб не дублювати
      crownVideo.addEventListener('loadeddata', () => { state.crownVideo = true; scrubVideo(); }, { once: true });
    });
    new IntersectionObserver(([en]) => { crownNear = en.isIntersecting; scrubVideo(); }, { rootMargin: '50% 0px' })
      .observe($('#koronka'));
  }
}

/* Відео за прокруткою: поки сцена 4 поруч, кожен кадр підтягуємо currentTime до прокрутки.
   Нову позицію ставимо, лише коли попередня вже відмотана (video.seeking === false). */
function scrubTick() {
  scrubLoop = 0;
  if (!crownNear) return;
  const v = crownVideo;
  if (v.duration && !v.seeking) {
    const target = state.pin[3] * (v.duration - 0.05);
    const d = target - v.currentTime;
    if (Math.abs(d) > 1 / 50) v.currentTime = v.currentTime + d * 0.5;
  }
  scrubLoop = requestAnimationFrame(scrubTick);
}
function scrubVideo() {
  if (crownNear && !scrubLoop && crownVideo.classList.contains('is-on')) scrubLoop = requestAnimationFrame(scrubTick);
}

/* =========================================================
   7. Поява тексту (GSAP + ScrollTrigger, якщо завантажилися)
   ========================================================= */
const gsap = window.gsap;
const ScrollTrigger = window.ScrollTrigger;
const canAnimate = !!(gsap && ScrollTrigger) && !isStatic && !reduceMotion;

function splitName() {
  const el = $('[data-split]');
  if (!el || el.dataset.splitDone) return [];
  el.dataset.splitDone = '1';
  const text = el.textContent.trim();
  el.textContent = '';
  const sr = document.createElement('span');
  sr.className = 'visually-hidden';
  sr.textContent = text;
  const vis = document.createElement('span');
  vis.setAttribute('aria-hidden', 'true');
  [...text].forEach((ch) => {
    const s = document.createElement('span');
    s.className = 'ch';
    s.textContent = ch;
    vis.appendChild(s);
  });
  el.append(sr, vis);
  return $$('.ch', el);
}

let introPlayed = false;
function playIntroText() {
  if (introPlayed || !canAnimate) return;
  introPlayed = true;
  const letters = splitName();
  const heroBits = $$('#intro [data-reveal]');
  gsap.set(heroBits, { opacity: 0, y: 26 });
  const tl = gsap.timeline({ defaults: { ease: 'power3.out' } });
  tl.from(letters, { yPercent: 70, opacity: 0, filter: 'blur(10px)', duration: 1.3, stagger: 0.08 }, 0.15)
    .to(heroBits, { opacity: 1, y: 0, duration: 0.9, stagger: 0.09 }, 0.55);
}

function setupReveals() {
  if (!canAnimate) return;
  gsap.registerPlugin(ScrollTrigger);
  const items = $$('[data-reveal]').filter((el) => !el.closest('#intro'));
  gsap.set(items, { opacity: 0, y: 26 });
  gsap.set('#intro [data-reveal]', { opacity: 0, y: 26 });
  ScrollTrigger.batch(items, {
    start: 'top 90%',
    once: true,
    onEnter: (batch) => gsap.to(batch, { opacity: 1, y: 0, duration: 0.9, ease: 'power3.out', stagger: 0.08, overwrite: true }),
  });
  // страховка: якщо елемент уже вище екрана (перехід за якорем) — показати одразу
  addEventListener('hashchange', () => ScrollTrigger.refresh());
}

/* =========================================================
   8. Завантаження 3D: прогрес, «Пропустити інтро», запасний план
   ========================================================= */
const loader = $('#loader');
const loaderBar = $('#loader-bar');
const loaderPct = $('#loader-pct');
const loaderStep = $('#loader-step');
let loaderClosed = false;
let shownPct = 0;

function setProgress(p, label) {
  const pct = Math.round(clamp(p) * 100);
  if (pct < shownPct) return;
  shownPct = pct;
  loaderBar.style.transform = `scaleX(${pct / 100})`;
  loaderPct.textContent = String(pct);
  if (label) loaderStep.textContent = label;
}

function closeLoader({ skipped = false } = {}) {
  if (loaderClosed) return;
  loaderClosed = true;
  dispatchEvent(new Event('emal:intro-done'));
  loader.classList.add('is-done');
  root.classList.remove('is-loading');
  setTimeout(() => { loader.hidden = true; }, 800);
  if (skipped) {
    window.__stage?.skipIntro?.();
    // інтро не граємо: увесь текст першого екрана одразу на місці, фокус — на вмісті
    if (canAnimate) { introPlayed = true; gsap.set('#intro [data-reveal]', { opacity: 1, y: 0 }); }
    $('#main').focus({ preventScroll: true });
  } else {
    playIntroText();
  }
}

$('#skip-intro').addEventListener('click', () => closeLoader({ skipped: true }));

/* Відкат на статичну версію з поясненням причини (видно в ?diag і в консолі) */
function fallbackToStatic(reason) {
  console.warn('Емаль: 3D-сцену вимкнено, показуємо статичну версію. Причина:', reason);
  root.classList.remove('is-loading', 'is-ready');
  root.classList.add('is-static');
  root.dataset.why = 'gpu';
  root.dataset.whyText = String(reason);
  window.__stage?.setPaused?.(true);
  // без анімацій: увесь текст одразу на місці
  if (gsap) {
    window.ScrollTrigger?.getAll?.().forEach((t) => t.kill());
    gsap.set('[data-reveal]', { opacity: 1, y: 0 });
  }
  closeLoader();
  updateDiag();
}

async function bootStage() {
  setProgress(0.04, 'Вмикаємо світло в кабінеті');
  // запасний план: якщо щось завантажується надто довго — відкриваємо сайт з постерами
  const failSafe = setTimeout(() => closeLoader(), 12000);
  const fonts = document.fonts?.ready?.then(() => setProgress(0.2, 'Розкладаємо інструменти')) ?? Promise.resolve();
  try {
    const mod = await import('./assets/js/stage.js');
    setProgress(0.45, 'Полімеризуємо емаль');
    await fonts;
    const stage = await mod.createStage({
      canvas: $('#stage'),
      tier,
      state,
      adaptive: !params.has('noadapt'), // ?noadapt — для перевірки якості без автоспрощення
      videos: {
        cardA: VIDEO.cardA.on ? VIDEO.cardA.src : null,
        cardB: VIDEO.cardB.on ? VIDEO.cardB.src : null,
      },
      onProgress: (p, label) => setProgress(0.45 + p * 0.55, label),
      onFail: (reason) => fallbackToStatic(reason),
    });
    window.__stage = stage;
    root.classList.add('is-ready');
    setProgress(1, 'Готово');
    clearTimeout(failSafe);
    stage.start();
    if (!loaderClosed) setTimeout(() => closeLoader(), 350);
    else stage.skipIntro();
  } catch (err) {
    // WebGL не запустився, бібліотека не завантажилася або шейдер не скомпілювався — показуємо постери
    clearTimeout(failSafe);
    fallbackToStatic(err?.message || String(err));
  }
}

/* =========================================================
   9. «Менше руху» в системі (на Windows це вимкнений перемикач
   «Ефекти анімації»): за замовчуванням поважаємо — показуємо
   статичну версію, але даємо кнопку увімкнути 3D свідомо.
   ========================================================= */
const motionNote = $('#motion-note');
if (root.dataset.why === 'reduced-motion' && motionNote) {
  motionNote.hidden = false;
  $('#motion-on').addEventListener('click', () => {
    try { localStorage.setItem('emal-motion', 'on'); } catch { /* приватний режим */ }
    location.replace(location.pathname + '?motion' + location.hash);
  });
}
const motionOff = $('#motion-off');
if (motionOff) {
  motionOff.addEventListener('click', (e) => {
    e.preventDefault();
    try { localStorage.removeItem('emal-motion'); } catch { /* ігноруємо */ }
    location.replace(location.pathname + '?static' + location.hash);
  });
}

/* =========================================================
   10. Діагностика: додай ?diag до адреси — у кутку з'явиться
   панель: режим, причина, відеокарта (рушій ANGLE), рівень, FPS.
   ========================================================= */
const WHY = {
  'reduced-motion': 'у системі ввімкнено «менше руху» (Windows: Параметри → Спеціальні можливості → Візуальні ефекти → Ефекти анімації)',
  'no-webgl2': 'браузер не дав WebGL2 (вимкнене апаратне прискорення або відеокарта в чорному списку)',
  param: 'відкрито з ?static',
};
let diagEl = null;
function probeGpu() {
  try {
    const c = document.createElement('canvas');
    const gl = c.getContext('webgl2') || c.getContext('webgl');
    if (!gl) return 'WebGL недоступний';
    const ext = gl.getExtension('WEBGL_debug_renderer_info');
    const name = String(ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER));
    gl.getExtension('WEBGL_lose_context')?.loseContext();
    return name;
  } catch { return 'не вдалося визначити'; }
}
function updateDiag() {
  if (!diagEl) return;
  const st = window.__stage?.stats?.();
  const mode = root.classList.contains('is-static') ? 'статичний' : root.classList.contains('is-ready') ? '3D' : 'завантаження';
  const why = root.dataset.whyText || WHY[root.dataset.why] || '—';
  const lines = [
    `Режим: ${mode}`,
    `Причина: ${mode === '3D' ? '—' : why}`,
    `Відеокарта: ${st?.gpu || diagEl.dataset.gpu}`,
    `Менше руху в системі: ${reduceMotion ? 'так' : 'ні'}`,
    st ? `Рівень: ${st.tier} · FPS ${st.fps} · DPR ${st.dpr} · частинок ${st.drawn} · bloom ${st.bloom ? 'так' : 'ні'}` : '',
    st && st.black !== null ? `Чорних пікселів: ${Math.round(st.black * 100)}%` : '',
  ].filter(Boolean);
  diagEl.textContent = lines.join('\n');
}
if (params.has('diag')) {
  diagEl = document.createElement('pre');
  diagEl.className = 'diag';
  diagEl.setAttribute('aria-live', 'polite');
  diagEl.dataset.gpu = probeGpu();
  document.body.appendChild(diagEl);
  updateDiag();
  setInterval(updateDiag, 1000);
  console.info('Емаль · діагностика:', diagEl.dataset.gpu, '| менше руху:', reduceMotion, '| режим:', root.className);
}

if (isStatic) {
  // Статична версія: без завантажувача й анімацій
  loader.hidden = true;
} else {
  setupReveals();
  bootStage();
}

/* Рендер на паузі, коли вкладка прихована */
document.addEventListener('visibilitychange', () => window.__stage?.setPaused?.(document.hidden));

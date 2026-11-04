/* =========================================================
   Форми для частинок. Кожна частинка має «адресу» в кожній
   сцені: у хмарі, у зубі, на хвилі, у віялі зразків, у коронці
   й у зубній дузі. Шейдер перетікає між цими адресами.
   Генератор детермінований: форма однакова при кожному відкритті.
   ========================================================= */

export function rng(seed = 1) {
  let a = seed >>> 0;
  return function () {
    a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const smin = (a, b, k) => { const h = Math.max(k - Math.abs(a - b), 0) / k; return Math.min(a, b) - h * h * k * 0.25; };
const smax = (a, b, k) => -smin(-a, -b, k);

function roundBox(px, py, pz, bx, by, bz, r) {
  const qx = Math.abs(px) - bx + r, qy = Math.abs(py) - by + r, qz = Math.abs(pz) - bz + r;
  const out = Math.hypot(Math.max(qx, 0), Math.max(qy, 0), Math.max(qz, 0));
  return out + Math.min(Math.max(qx, Math.max(qy, qz)), 0) - r;
}
const sphere = (x, y, z, r) => Math.hypot(x, y, z) - r;

/* «Корінь»: відрізок зі змінним радіусом */
function cone(px, py, pz, ax, ay, az, bx, by, bz, ra, rb) {
  const bax = bx - ax, bay = by - ay, baz = bz - az;
  const pax = px - ax, pay = py - ay, paz = pz - az;
  const h = clamp((pax * bax + pay * bay + paz * baz) / (bax * bax + bay * bay + baz * baz), 0, 1);
  return Math.hypot(pax - bax * h, pay - bay * h, paz - baz * h) - (ra + (rb - ra) * h);
}

/* Моляр: крона з чотирма горбками, фісура хрестом, два корені */
export function sdMolar(x, y, z) {
  let d = roundBox(x, y - 0.55, z, 0.80, 0.42, 0.70, 0.36);
  d = smin(d, sphere(x - 0.40, y - 0.95, z - 0.34, 0.40), 0.30);
  d = smin(d, sphere(x + 0.40, y - 0.95, z - 0.34, 0.40), 0.30);
  d = smin(d, sphere(x - 0.40, y - 0.92, z + 0.34, 0.38), 0.30);
  d = smin(d, sphere(x + 0.40, y - 0.92, z + 0.34, 0.38), 0.30);
  const groove = Math.min(Math.abs(x) - 0.045, Math.abs(z) - 0.045);
  d = smax(d, -Math.max(groove, 1.0 - y), 0.14);
  const r1 = cone(x, y, z, 0.34, 0.15, 0.02, 0.52, -1.95, 0.10, 0.36, 0.09);
  const r2 = cone(x, y, z, -0.34, 0.15, -0.02, -0.46, -1.85, -0.08, 0.36, 0.09);
  return smin(d, Math.min(r1, r2), 0.32);
}

/* Коронка: лише верхня частина зуба */
export function sdCrown(x, y, z) {
  return smax(sdMolar(x, y, z), 0.04 - y, 0.06);
}

/* Точки на поверхні SDF: випадкова точка біля поверхні + крок Ньютона на поверхню */
function sampleSDF(sdf, bounds, n, rnd, out, stride, offset, { scale = 1, shift = [0, 0, 0], interior = 0.08 } = {}) {
  const [x0, x1, y0, y1, z0, z1] = bounds;
  const e = 0.004;
  let i = 0;
  let guard = 0;
  const nInterior = Math.floor(n * interior);
  while (i < n && guard < n * 400) {
    guard++;
    let x = x0 + rnd() * (x1 - x0);
    let y = y0 + rnd() * (y1 - y0);
    let z = z0 + rnd() * (z1 - z0);
    const d = sdf(x, y, z);
    if (i < nInterior) {
      if (d > -0.06) continue;
    } else {
      if (Math.abs(d) > 0.12) continue;
      for (let k = 0; k < 2; k++) {
        const dd = sdf(x, y, z);
        const gx = sdf(x + e, y, z) - sdf(x - e, y, z);
        const gy = sdf(x, y + e, z) - sdf(x, y - e, z);
        const gz = sdf(x, y, z + e) - sdf(x, y, z - e);
        const gl = Math.hypot(gx, gy, gz) || 1;
        x -= (gx / gl) * dd; y -= (gy / gl) * dd; z -= (gz / gl) * dd;
      }
    }
    const o = (offset + i) * stride;
    out[o] = (x + shift[0]) * scale;
    out[o + 1] = (y + shift[1]) * scale;
    out[o + 2] = (z + shift[2]) * scale;
    i++;
  }
  return i;
}

/* Півширина зразка шкали на висоті t (0 — шийка, 1 — ріжучий край) */
function tabHalfWidth(t) {
  let hw = 0.2 + 0.07 * Math.sin(Math.min(t / 0.55, 1) * Math.PI / 2);
  if (t > 0.8) hw *= Math.sqrt(Math.max(0, 1 - ((t - 0.8) / 0.2) ** 2));
  if (t < 0.05) hw *= 0.75 + 0.25 * (t / 0.05);
  return hw;
}

/* Розміри зубів від центру дуги: різці, ікло, премоляри, моляри (ширина, висота, глибина) */
const ARCH_DIMS = [
  [0.36, 0.44, 0.18], [0.30, 0.40, 0.17], [0.32, 0.46, 0.22], [0.31, 0.37, 0.25],
  [0.31, 0.36, 0.26], [0.44, 0.34, 0.33], [0.42, 0.33, 0.32], [0.38, 0.31, 0.30],
];

export function archPoint(s) {
  const th = s * 1.85;
  return {
    x: 2.15 * Math.sin(th),
    z: 1.75 * Math.cos(th * 0.92) - 0.55,
    th,
  };
}

/**
 * Генерує всі атрибути частинок.
 * @param {number} count кількість частинок
 * @param {(p:number,label:string)=>void} onStep прогрес 0…1
 */
export async function buildParticles(count, onStep = () => {}) {
  const rnd = rng(20261104);
  const pause = () => new Promise((r) => setTimeout(r, 0));

  const chaos = new Float32Array(count * 3); // одинична куля: інтро-хмара і пил
  const tooth = new Float32Array(count * 3);
  const crown = new Float32Array(count * 3);
  const grid = new Float32Array(count * 2);
  const fan = new Float32Array(count * 4);
  const arch = new Float32Array(count * 4);
  const rand = new Float32Array(count * 4);

  // 1. Хмара + випадкові параметри
  for (let i = 0; i < count; i++) {
    const u = rnd(), v = rnd(), w = rnd();
    const th = u * Math.PI * 2, ph = Math.acos(2 * v - 1), r = Math.cbrt(w);
    chaos[i * 3] = r * Math.sin(ph) * Math.cos(th);
    chaos[i * 3 + 1] = r * Math.sin(ph) * Math.sin(th);
    chaos[i * 3 + 2] = r * Math.cos(ph);
    rand[i * 4] = rnd();      // затримка перельоту
    rand[i * 4 + 1] = rnd();  // розмір
    rand[i * 4 + 2] = rnd();  // колір
    rand[i * 4 + 3] = rnd();  // фаза мерехтіння
  }
  onStep(0.1, 'Розкладаємо інструменти');
  await pause();

  // 2. Зуб (моляр), центр по висоті, висота ≈ 3.45
  sampleSDF(sdMolar, [-1.35, 1.35, -2.15, 1.45, -1.15, 1.15], count, rnd, tooth, 3, 0, { shift: [0, 0.35, 0], scale: 1.0, interior: 0.08 });
  onStep(0.45, 'Полімеризуємо емаль');
  await pause();

  // 3. Коронка, збільшена
  sampleSDF(sdCrown, [-1.3, 1.3, 0.0, 1.45, -1.1, 1.1], count, rnd, crown, 3, 0, { shift: [0, -0.74, 0], scale: 1.35, interior: 0.05 });
  onStep(0.7, 'Фрезеруємо коронку');
  await pause();

  // 4. Хвиля: частинки лягають у рядки — читається як спокійні лінії води
  const rows = count > 15000 ? 44 : 30;
  for (let i = 0; i < count; i++) {
    const row = i % rows;
    grid[i * 2] = rnd() * 2 - 1;
    grid[i * 2 + 1] = (row / (rows - 1)) * 2 - 1 + (rnd() - 0.5) * 0.012;
  }

  // 5. Віяло: 8 зразків шкали, координати відносно точки підвісу
  const S = 1.6;
  for (let i = 0; i < count; i++) {
    const tab = i % 8;
    const r = rnd();
    let x, y, z;
    if (r < 0.1) { // ручка
      x = (rnd() - 0.5) * 0.12; y = -rnd() * 0.5; z = (rnd() - 0.5) * 0.05;
    } else {
      const t = rnd();
      const hw = tabHalfWidth(t);
      y = -0.45 - t * 1.3;
      if (r < 0.38) { x = (rnd() < 0.5 ? -1 : 1) * hw; } // контур
      else { x = (rnd() * 2 - 1) * hw * Math.sqrt(rnd()); }
      z = (rnd() - 0.5) * 0.08;
    }
    fan[i * 4] = x * S; fan[i * 4 + 1] = y * S; fan[i * 4 + 2] = z * S; fan[i * 4 + 3] = tab;
  }
  onStep(0.8, 'Добираємо відтінок');
  await pause();

  // 6. Зубна дуга: 16 зубів верхньої щелепи (вигляд згори)
  const weights = [];
  for (let j = 0; j < 16; j++) {
    const c = Math.round(Math.abs(j - 7.5) - 0.5);
    const [w, h] = ARCH_DIMS[c];
    weights.push(w * h);
  }
  const wsum = weights.reduce((a, b) => a + b, 0);
  const cum = [];
  weights.reduce((acc, w, j) => { cum[j] = (acc + w) / wsum; return acc + w; }, 0);
  for (let i = 0; i < count; i++) {
    const u = rnd();
    let j = cum.findIndex((c) => u <= c);
    if (j < 0) j = 15;
    const c = Math.round(Math.abs(j - 7.5) - 0.5);
    const [w, h, d] = ARCH_DIMS[c];
    const s = (j - 7.5) / 7.5;
    const { x: cx, z: cz } = archPoint(s);
    const a2 = archPoint(s + 0.01);
    const tx = a2.x - cx, tz = a2.z - cz;
    const tl = Math.hypot(tx, tz) || 1;
    const ux = tx / tl, uz = tz / tl; // дотична
    // точка на еліпсоїді (поверхня; трохи сплюснута жувальна поверхня)
    const th = rnd() * Math.PI * 2, ph = Math.acos(2 * rnd() - 1);
    let ex = Math.sin(ph) * Math.cos(th), ey = Math.cos(ph), ez = Math.sin(ph) * Math.sin(th);
    if (ey > 0.6) ey = 0.6 + (ey - 0.6) * 0.4;
    ex *= w / 2; ey *= h / 2; ez *= d / 2;
    arch[i * 4] = cx + ex * ux - ez * uz;
    arch[i * 4 + 1] = ey;
    arch[i * 4 + 2] = cz + ex * uz + ez * ux;
    arch[i * 4 + 3] = j;
  }
  onStep(1, 'Готуємо крісло');
  return { chaos, tooth, crown, grid, fan, arch, rand };
}

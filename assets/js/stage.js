/* =========================================================
   Емаль — 3D-сцена (Three.js r180)
   Один простір, шість «станцій» одна під одною. Камера
   опускається за прокруткою, частинки перелітають між формами,
   світлова лінія (промінь полімеризаційної лампи) веде погляд.
   ========================================================= */
import * as THREE from 'three';
import { buildParticles, archPoint } from './shapes.js';

const SPACING = 14;             // відстань між станціями по вертикалі
const LAST = 5;                 // остання станція (0…5)
const FOV = 35;

/* Кольори палітри (DESIGN.md) */
const HEX = {
  bg: '#05161D', surface: '#11262E', text: '#E7F3F3',
  rose: '#F4858A', mint: '#52C69F', ivory: '#EFE4C7',
};

/* Композиція кожної станції.
   R — радіус об'єкта (для «вписування» в кадр),
   dir — звідки дивиться камера, look — куди,
   desk/mob — де на екрані центр об'єкта (частки ширини/висоти) і розмір рамки. */
const STATIONS = [
  { R: 1.95, dir: [0.0, 0.10, 1], look: [0, 0, 0],
    desk: { cx: 0.71, cy: 0.52, bw: 0.40, bh: 0.62 }, mob: { cx: 0.5, cy: 0.225, bw: 0.58, bh: 0.26 } },
  { R: 3.7, dir: [0.0, 0.48, 1], look: [0, -0.7, 0],
    desk: { cx: 0.72, cy: 0.52, bw: 0.56, bh: 0.80 }, mob: { cx: 0.5, cy: 0.29, bw: 1.05, bh: 0.40 } },
  { R: 2.45, dir: [0.0, 0.05, 1], look: [0, 0.15, 0],
    desk: { cx: 0.72, cy: 0.42, bw: 0.40, bh: 0.60 }, mob: { cx: 0.5, cy: 0.28, bw: 0.80, bh: 0.32 } },
  { R: 1.6, dir: [0.0, 0.16, 1], look: [0, 0, 0],
    desk: { cx: 0.70, cy: 0.52, bw: 0.36, bh: 0.56 }, mob: { cx: 0.5, cy: 0.33, bw: 0.62, bh: 0.30 } },
  { R: 3.1, dir: [0.0, 0.0, 1], look: [0, 0.1, 0],
    desk: { cx: 0.73, cy: 0.50, bw: 0.46, bh: 0.72 }, mob: { cx: 0.5, cy: 0.28, bw: 0.95, bh: 0.34 } },
  { R: 2.45, dir: [0.0, 0.95, 0.72], look: [0, 0, 0.15],
    desk: { cx: 0.79, cy: 0.27, bw: 0.32, bh: 0.34 }, mob: { cx: 0.5, cy: 0.27, bw: 0.92, bh: 0.30 } },
];

const TIERS = {
  desktop: { count: 26000, dpr: 1.75, bloom: true, octaves: 5, size: 0.025 },
  mobile: { count: 11000, dpr: 1.5, bloom: false, octaves: 3, size: 0.031 },
  lite: { count: 6500, dpr: 1.0, bloom: false, octaves: 2, size: 0.035 },
};

/* ---------- GLSL ---------- */
// Simplex noise 3D — Ian McEwan, Stefan Gustavson (Ashima Arts), MIT License
const NOISE = /* glsl */`
vec3 mod289(vec3 x){return x-floor(x*(1.0/289.0))*289.0;}
vec4 mod289(vec4 x){return x-floor(x*(1.0/289.0))*289.0;}
vec4 permute(vec4 x){return mod289(((x*34.0)+10.0)*x);}
vec4 taylorInvSqrt(vec4 r){return 1.79284291400159-0.85373472095314*r;}
float snoise(vec3 v){
  const vec2 C=vec2(1.0/6.0,1.0/3.0); const vec4 D=vec4(0.0,0.5,1.0,2.0);
  vec3 i=floor(v+dot(v,C.yyy)); vec3 x0=v-i+dot(i,C.xxx);
  vec3 g=step(x0.yzx,x0.xyz); vec3 l=1.0-g; vec3 i1=min(g.xyz,l.zxy); vec3 i2=max(g.xyz,l.zxy);
  vec3 x1=x0-i1+C.xxx; vec3 x2=x0-i2+C.yyy; vec3 x3=x0-D.yyy;
  i=mod289(i);
  vec4 p=permute(permute(permute(i.z+vec4(0.0,i1.z,i2.z,1.0))+i.y+vec4(0.0,i1.y,i2.y,1.0))+i.x+vec4(0.0,i1.x,i2.x,1.0));
  float n_=0.142857142857; vec3 ns=n_*D.wyz-D.xzx;
  vec4 j=p-49.0*floor(p*ns.z*ns.z); vec4 x_=floor(j*ns.z); vec4 y_=floor(j-7.0*x_);
  vec4 x=x_*ns.x+ns.yyyy; vec4 y=y_*ns.x+ns.yyyy; vec4 h=1.0-abs(x)-abs(y);
  vec4 b0=vec4(x.xy,y.xy); vec4 b1=vec4(x.zw,y.zw);
  vec4 s0=floor(b0)*2.0+1.0; vec4 s1=floor(b1)*2.0+1.0; vec4 sh=-step(h,vec4(0.0));
  vec4 a0=b0.xzyw+s0.xzyw*sh.xxyy; vec4 a1=b1.xzyw+s1.xzyw*sh.zzww;
  vec3 p0=vec3(a0.xy,h.x); vec3 p1=vec3(a0.zw,h.y); vec3 p2=vec3(a1.xy,h.z); vec3 p3=vec3(a1.zw,h.w);
  vec4 norm=taylorInvSqrt(vec4(dot(p0,p0),dot(p1,p1),dot(p2,p2),dot(p3,p3)));
  p0*=norm.x; p1*=norm.y; p2*=norm.z; p3*=norm.w;
  vec4 m=max(0.5-vec4(dot(x0,x0),dot(x1,x1),dot(x2,x2),dot(x3,x3)),0.0); m=m*m;
  return 105.0*dot(m*m,vec4(dot(p0,x0),dot(p1,x1),dot(p2,x2),dot(p3,x3)));
}`;

const PARTICLE_VERT = /* glsl */`
uniform float uTime, uFrom, uTo, uT, uSpacing, uPR, uSize, uViewH;
uniform float uFanSpread, uArchLight, uWaveAmp, uCrownFade, uIntroSpread, uScanY;
uniform mat3 uRotTooth, uRotCrown;
uniform vec3 uPointer; uniform float uPointerK;
uniform vec3 uMint, uRose, uPearl, uIvory;
attribute vec3 aTooth; attribute vec3 aCrown; attribute vec2 aGrid;
attribute vec4 aFan; attribute vec4 aArch; attribute vec4 aRand;
varying vec3 vColor; varying float vAlpha;
${NOISE}
vec3 st(float k){ return vec3(0.0, -k*uSpacing, 0.0); }
// ПОРТАТИВНІСТЬ (Windows): Chrome/Edge на Windows перекладають GLSL у Direct3D (HLSL).
// Там pow(x, y) з x < 0 дає NaN, а перевернутий smoothstep(1, 0, x) не визначений,
// тому квадрати пишемо як x*x, а «зворотні» плавні переходи — як 1.0 - smoothstep(0, 1, x).
// Важкий шум (snoise) лишаємо лише там, де без нього ніяк: Direct3D компілює його довго.
vec3 waveAt(vec2 g){
  float x = g.x*6.4, z = g.y*3.4;
  float y = sin(x*0.85 + uTime*0.5)*0.30 + sin(z*1.25 - uTime*0.38 + x*0.35)*0.22;
  y += sin(x*0.37 + z*0.61 + uTime*0.21)*0.20 + sin(x*0.53 - z*0.29 - uTime*0.17)*0.18;
  return vec3(x, y*uWaveAmp - 0.7, z);
}
vec3 fanAt(vec4 f){
  float a = (f.w - 3.5) * uFanSpread;
  float c = cos(a), s = sin(a);
  vec2 p = vec2(c*f.x - s*f.y, s*f.x + c*f.y);
  return vec3(p.x, p.y + 1.55, f.z + (3.5 - abs(f.w - 3.5))*0.07);
}
vec3 dustAt(){
  vec3 p = position * vec3(5.8, 3.8, 3.2);
  return p + vec3(sin(p.y*0.6 + p.z*0.3 + uTime*0.30), sin(p.z*0.5 + p.x*0.4 + uTime*0.25), sin(p.x*0.4 - p.y*0.3 - uTime*0.20))*0.45;
}
vec3 target(float k){
  if (k < -0.5) return position * uIntroSpread + st(0.0);
  if (k < 0.5) return uRotTooth * aTooth + st(0.0);
  if (k < 1.5) return waveAt(aGrid) + st(1.0);
  if (k < 2.5) return fanAt(aFan) + st(2.0);
  if (k < 3.5) return uRotCrown * aCrown + st(3.0);
  if (k < 4.5) return dustAt() + st(4.0);
  return aArch.xyz + st(5.0);
}
float wK(float k, float e){
  return (abs(uFrom - k) < 0.5 ? 1.0 - e : 0.0) + (abs(uTo - k) < 0.5 ? e : 0.0);
}
void main(){
  float t = clamp((uT - aRand.x*0.4)/0.6, 0.0, 1.0);
  float e = t*t*(3.0 - 2.0*t);
  vec3 a = target(uFrom);
  vec3 b = uTo == uFrom ? a : target(uTo);
  vec3 p = mix(a, b, e);
  float fly = sin(3.14159*e);
  vec3 q = p*0.16 + vec3(aRand.w*7.0, 0.0, uTime*0.05);
  p += vec3(snoise(q), snoise(q + 19.1), snoise(q + 37.7)) * fly * 1.9;
  p += sin(p.yzx*3.1 + uTime*(0.8 + aRand.w) + aRand.w*20.0) * vec3(0.016, 0.016, 0.0);
  vec3 d = p - uPointer; float dl = length(d) + 1e-4;
  p += d/dl * max(0.0, 1.0 - dl/1.15) * uPointerK;

  float rose = step(0.9, aRand.z);
  vec3 col = mix(uMint, uPearl, smoothstep(0.12, 0.85, aRand.z));
  col = mix(col, uRose, rose);
  float wArch = wK(5.0, e);
  float lit = smoothstep(aArch.w - 0.9, aArch.w + 0.1, uArchLight);
  col = mix(col, uPearl, wArch*lit*0.55*(1.0 - rose));
  col = mix(col, mix(uPearl, uIvory, 0.7), wK(2.0, e)*0.6*(1.0 - rose));
  // сцена 4: смуга сканера йде знизу вгору; нижче неї — «відскановано»
  float wCrown = wK(3.0, e);
  float sb = (aCrown.y - uScanY)/0.07;
  float band = exp(-sb*sb);
  float scanned = step(aCrown.y, uScanY);
  col = mix(col, mix(uMint, uPearl, scanned), wCrown*0.75*(1.0 - rose));
  col = mix(col, uRose, wCrown*band*0.85);
  float alpha = 0.6 + 0.4*sin(uTime*(0.7 + aRand.w*1.7) + aRand.w*40.0);
  alpha *= mix(1.0, 0.4 + 0.65*lit, wArch);
  alpha *= mix(1.0, (0.4 + 0.35*scanned + band*1.3)*(1.0 - 0.85*uCrownFade), wCrown);
  alpha *= 1.0 + fly*0.5;
  vColor = col; vAlpha = alpha;

  vec4 mv = modelViewMatrix * vec4(p, 1.0);
  gl_Position = projectionMatrix * mv;
  float size = uSize * (0.45 + aRand.y*aRand.y*1.7) * (1.0 + fly*0.5);
  // частинки біля самої камери не роздуваються на весь екран
  gl_PointSize = clamp(size * uPR * uViewH / max(-mv.z, 0.05), 1.0, 48.0*uPR);
}`;

const PARTICLE_FRAG = /* glsl */`
varying vec3 vColor; varying float vAlpha;
void main(){
  float d = length(gl_PointCoord - 0.5);
  if (d > 0.5) discard;
  float a = 1.0 - smoothstep(0.0, 0.5, d); a *= a;
  float core = 1.0 - smoothstep(0.0, 0.16, d);
  gl_FragColor = vec4(vColor*(1.0 + core*0.8), a*vAlpha);
  #include <colorspace_fragment>
}`;

const NEBULA_VERT = /* glsl */`
void main(){ gl_Position = vec4(position.xy, 0.9999, 1.0); }`;

const NEBULA_FRAG = /* glsl */`
uniform vec2 uRes; uniform float uTime, uF, uOct, uMintAmt, uRoseAmt;
uniform vec2 uFocus; uniform vec3 uBg, uMint, uRose;
float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7)))*43758.5453); }
float vnoise(vec2 p){
  vec2 i = floor(p), f = fract(p); vec2 u = f*f*(3.0 - 2.0*f);
  return mix(mix(hash(i), hash(i + vec2(1,0)), u.x), mix(hash(i + vec2(0,1)), hash(i + vec2(1,1)), u.x), u.y);
}
float fbm(vec2 p){
  float s = 0.0, a = 0.5;
  for (int i = 0; i < 5; i++){ if (float(i) >= uOct) break; s += a*vnoise(p); p = p*2.03 + vec2(1.7, 9.2); a *= 0.5; }
  return s;
}
void main(){
  vec2 uv = gl_FragCoord.xy / uRes;
  float asp = uRes.x / uRes.y;
  vec2 p = vec2((uv.x - 0.5)*asp, uv.y - 0.5);
  vec2 fc = vec2((uFocus.x - 0.5)*asp, (1.0 - uFocus.y) - 0.5);
  float n = fbm(p*1.7 + vec2(0.0, -uF*0.9) + uTime*0.012);
  float n2 = fbm(p*3.4 + vec2(uTime*0.02, -uF*1.3) + n);
  vec2 dm = p - fc;
  float gm = exp(-dot(dm, dm)*3.6);
  vec2 rc = fc + vec2(0.38*sin(uF*1.3 + 2.4), -0.22 + 0.14*cos(uF*0.9));
  vec2 dr = p - rc;
  float gr = exp(-dot(dr, dr)*4.6);
  vec3 col = uBg;
  // дрібні лінійні значення: після переходу в sRGB сяйво лишається стриманим (фон — 60% площі)
  col += uMint * gm * (0.010 + 0.024*n) * uMintAmt;
  col += uRose * gr * (0.008 + 0.022*n2) * uRoseAmt;
  col += uMint * 0.004 * smoothstep(0.55, 0.85, n2);
  float vig = 1.0 - smoothstep(0.2, 1.25, length(p*vec2(0.8, 1.0)));
  col *= mix(0.62, 1.0, vig);
  col += (hash(gl_FragCoord.xy + fract(uTime)*91.0) - 0.5) / 255.0;
  gl_FragColor = vec4(max(col, 0.0), 1.0);
  #include <colorspace_fragment>
}`;

const LINE_VERT = /* glsl */`
varying float vX; varying vec3 vN; varying vec3 vV;
void main(){
  vX = uv.x;
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  vN = normalize(normalMatrix * normal); vV = normalize(-mv.xyz);
  gl_Position = projectionMatrix * mv;
}`;

const LINE_FRAG = /* glsl */`
uniform float uHead, uTail, uTime, uHalo, uGain; uniform vec3 uMint, uRose, uPearl;
varying float vX; varying vec3 vN; varying vec3 vV;
void main(){
  float x = vX;
  if (x > uHead) discard;
  float tail = smoothstep(uHead - uTail, uHead - uTail*0.55, x);
  if (tail <= 0.001) discard;
  float hd = (uHead - x)/0.004;
  float head = exp(-hd*hd);
  float run = uHead - uTail*0.75*fract(uTime*0.09);
  float sp = (x - run)/0.003;
  float spark = exp(-sp*sp);
  vec3 col = mix(uMint, uRose, smoothstep(uHead - uTail*0.45, uHead, x));
  col = mix(col, uPearl, head*0.7);
  float facing = clamp(abs(dot(normalize(vN), normalize(vV))), 0.0, 1.0);
  float f2 = facing*facing;
  float a = uHalo > 0.5 ? f2*sqrt(facing)*0.11 : 0.9;
  float inten = uGain * (0.65 + head*3.0 + spark*1.4);
  gl_FragColor = vec4(col*inten, a*tail);
  #include <colorspace_fragment>
}`;

const CARD_VERT = /* glsl */`
varying vec2 vUv; varying vec3 vN; varying vec3 vV;
void main(){
  vUv = uv;
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  vN = normalize(normalMatrix * normal); vV = normalize(-mv.xyz);
  gl_Position = projectionMatrix * mv;
}`;

const CARD_FRAG = /* glsl */`
uniform sampler2D uMap; uniform float uHasMap, uTime, uOpacity, uSeed;
uniform vec3 uTint, uPearl, uMint, uRose, uBg;
varying vec2 vUv; varying vec3 vN; varying vec3 vV;
${NOISE}
float sdRound(vec2 p, vec2 b, float r){ vec2 q = abs(p) - b + r; return length(max(q, 0.0)) + min(max(q.x, q.y), 0.0) - r; }
// зоряний пил, який видно крізь товсте скло (зсувається з кутом огляду — заломлення)
float star(vec2 p){
  vec2 i = floor(p); vec2 f = fract(p) - 0.5;
  float h = fract(sin(dot(i, vec2(41.3, 289.1)))*43758.5453);
  vec2 o = vec2(fract(h*13.1), fract(h*7.7)) - 0.5;
  return (1.0 - smoothstep(0.0, 0.09, length(f - o*0.6))) * step(0.78, h);
}
vec3 caustics(vec2 uv){
  vec2 p = uv*vec2(3.0, 3.75);
  float t = uTime*0.25 + uSeed*10.0;
  float c = 0.0;
  for (int i = 0; i < 3; i++){
    float fi = float(i);
    vec2 q = p*(1.0 + fi*0.6) + vec2(snoise(vec3(p*0.7, t + fi)), snoise(vec3(p*0.7 + 4.0, t - fi)))*0.9;
    float s = abs(sin(q.x*2.1 + t) * sin(q.y*1.7 - t*0.8));
    s = s*s*s;
    c += s*s / (1.0 + fi);
  }
  float body = 1.0 - smoothstep(0.1, 0.85, length(uv - vec2(0.5, 0.42)));
  return uBg*0.9 + uTint*(c*0.32 + body*0.05) + uPearl*c*c*0.10;
}
void main(){
  vec2 p = (vUv - 0.5)*vec2(0.8, 1.0)*2.0;
  float d = sdRound(p, vec2(0.8, 1.0), 0.16);
  if (d > 0.0) discard;
  vec2 bend = vec2(snoise(vec3(vUv*2.5, uTime*0.12 + uSeed)), snoise(vec3(vUv*2.5 + 9.0, uTime*0.12)))*0.018;
  vec2 cuv = vUv + bend + (vUv - 0.5)*0.04*smoothstep(-0.25, 0.0, d);
  vec3 content = uHasMap > 0.5 ? texture2D(uMap, clamp(cuv*0.94 + 0.03, 0.0, 1.0)).rgb : caustics(cuv);
  // заломлення: зірки за склом зсуваються залежно від кута огляду
  vec2 refr = normalize(vV).xy*0.9 + bend*6.0;
  vec2 suv = vUv*vec2(7.0, 8.75) + refr*3.0 + uSeed*17.0;
  float stars = star(suv) + 0.55*star(suv*1.8 + 3.1);
  content += uPearl*stars*(uHasMap > 0.5 ? 0.15 : 0.7);
  float rim = smoothstep(-0.07, 0.0, d);
  float fr = clamp(1.0 - abs(dot(normalize(vN), normalize(vV))), 0.0, 1.0);
  float fres = fr*fr;
  float sweep = 1.0 - smoothstep(0.0, 0.09, abs((vUv.x*0.8 + vUv.y)*0.62 - fract(uTime*0.06 + uSeed)*1.8 + 0.2));
  // дисперсія на краю: м'ята з одного боку, корал з іншого
  vec3 disp = (uMint*smoothstep(0.0, 0.8, p.x) + uRose*smoothstep(0.0, 0.8, -p.x)) * smoothstep(-0.2, 0.0, d) * 0.35;
  vec3 col = content*0.9 + uPearl*(rim*0.34 + sweep*0.14) + uMint*fres*0.25 + disp;
  // скло: прозора середина, щільніший край
  float alpha = uOpacity * (uHasMap > 0.5 ? mix(0.92, 1.0, rim) : mix(0.62, 0.95, rim));
  gl_FragColor = vec4(col, alpha);
  #include <colorspace_fragment>
}`;

/* ---------- Допоміжне ---------- */
const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
const lerp = (a, b, t) => a + (b - a) * t;
const smooth = (t) => t * t * (3 - 2 * t);
const easeOut = (t) => 1 - Math.pow(1 - t, 3);

/* Світлова лінія: контрольні точки по станціях; повертає криву і межі кожного мотиву */
function buildLinePath() {
  const pts = [];
  const marks = []; // [start, end] індекси контрольних точок для кожної станції
  const y = (k) => -k * SPACING;
  const push = (x, yy, z) => pts.push(new THREE.Vector3(x, yy, z));

  // 0. Спіраль навколо зуба
  push(-3.2, 4.2, -1.5);
  let s = pts.length;
  for (let i = 0; i <= 16; i++) {
    const t = i / 16;
    const a = -0.65 * Math.PI + t * 3.3 * Math.PI;
    const r = 2.15 + 0.15 * Math.sin(t * 9.0);
    push(r * Math.cos(a), 2.7 - t * 5.1, r * Math.sin(a));
  }
  marks.push([s, pts.length - 1]);
  push(1.4, -6.5, 1.2);
  push(-2.8, -10.2, 0.6);
  // 1. Ковзання над хвилею
  s = pts.length;
  [[-6.2, 1.5, 1.6], [-3.1, 1.0, -0.7], [0, 1.6, 1.2], [3.1, 0.9, -0.5], [6.2, 1.4, 1.0]].forEach(([x, dy, z]) => push(x, y(1) + dy, z));
  marks.push([s, pts.length - 1]);
  push(4.6, -18.5, 0.5);
  push(3.6, -23.4, 0.6);
  // 2. Дуга під кінчиками зразків
  s = pts.length;
  for (let i = 0; i <= 10; i++) {
    const a = 1.25 - (i / 10) * 2.5;
    push(3.35 * Math.sin(a), y(2) + 1.55 - 3.35 * Math.cos(a), 0.55);
  }
  marks.push([s, pts.length - 1]);
  push(-3.7, -32.5, 0.4);
  push(-2.4, -37.5, 0.8);
  // 3. Кільце сканера навколо коронки
  s = pts.length;
  for (let i = 0; i <= 18; i++) {
    const t = i / 18;
    const a = Math.PI + t * 2.6 * Math.PI;
    push(1.85 * Math.cos(a), y(3) + 0.35 - t * 0.7, 1.85 * Math.sin(a));
  }
  marks.push([s, pts.length - 1]);
  push(1.8, -47.2, 1.4);
  push(-1.2, -52.0, 1.0);
  // 4. Петля між скляними картками
  s = pts.length;
  [[-3.4, 0.9, 0.9], [-1.75, -0.95, 1.15], [0.15, 1.15, 0.7], [1.95, -0.8, 0.95], [3.5, 0.6, 0.5]].forEach(([x, dy, z]) => push(x, y(4) + dy, z));
  marks.push([s, pts.length - 1]);
  push(3.1, -61.2, 0.5);
  push(2.9, -66.4, 0.9);
  // 5. Обведення зубної дуги
  s = pts.length;
  for (let i = 0; i <= 20; i++) {
    const sv = 1.08 - (i / 20) * 2.16;
    const { x, z } = archPoint(sv);
    const nx = x * 1.17, nz = (z + 0.55) * 1.2 - 0.55;
    push(nx, y(5) + 0.05, nz + 0.1);
  }
  marks.push([s, pts.length - 1]);

  const curve = new THREE.CatmullRomCurve3(pts, false, 'centripetal');
  // частка довжини дуги для контрольної точки j
  const N = 4000;
  const lengths = curve.getLengths(N);
  const total = lengths[N];
  const frac = (j) => lengths[Math.round((j / (pts.length - 1)) * N)] / total;
  const segs = marks.map(([a, b]) => [frac(a), frac(b)]);
  return { curve, segs, total };
}

/* ---------- Сцена ---------- */
export async function createStage({ canvas, tier = 'desktop', state, videos = {}, adaptive = true, onProgress = () => {}, onFail = () => {} }) {
  const Q = { ...TIERS[tier] || TIERS.desktop };

  const renderer = new THREE.WebGLRenderer({
    canvas, antialias: false, alpha: false, powerPreference: 'high-performance', stencil: false, depth: true,
  });
  renderer.setClearColor(HEX.bg, 1);

  // Яка відеокарта й який рушій (на Windows зазвичай «ANGLE … Direct3D11») — для ?diag
  const glc = renderer.getContext();
  const dbgInfo = glc.getExtension('WEBGL_debug_renderer_info');
  const gpu = String(dbgInfo ? glc.getParameter(dbgInfo.UNMASKED_RENDERER_WEBGL) : glc.getParameter(glc.RENDERER));

  // Якщо шейдер не скомпілювався (буває на окремих драйверах) — не показуємо порожнє полотно, а відкочуємося на постери
  let shaderError = '';
  renderer.debug.onShaderError = (gl, program, vs, fs) => {
    shaderError = [gl.getProgramInfoLog(program), gl.getShaderInfoLog(vs), gl.getShaderInfoLog(fs)].filter(Boolean).join('\n').slice(0, 600) || 'невідома помилка';
    console.error('Емаль: шейдер не скомпілювався на цій відеокарті →', gpu, '\n', shaderError);
  };
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  let dpr = Math.min(window.devicePixelRatio || 1, Q.dpr);
  renderer.setPixelRatio(dpr);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(FOV, 1, 0.1, 200);

  const C = Object.fromEntries(Object.entries(HEX).map(([k, v]) => [k, new THREE.Color(v)]));

  /* Туманність-тло */
  const nebulaU = {
    uRes: { value: new THREE.Vector2(1, 1) }, uTime: { value: 0 }, uF: { value: 0 }, uOct: { value: Q.octaves },
    uMintAmt: { value: 1 }, uRoseAmt: { value: 1 }, uFocus: { value: new THREE.Vector2(0.7, 0.5) },
    uBg: { value: C.bg }, uMint: { value: C.mint }, uRose: { value: C.rose },
  };
  const nebula = new THREE.Mesh(
    new THREE.PlaneGeometry(2, 2),
    new THREE.ShaderMaterial({ vertexShader: NEBULA_VERT, fragmentShader: NEBULA_FRAG, uniforms: nebulaU, depthTest: false, depthWrite: false }),
  );
  nebula.frustumCulled = false;
  nebula.renderOrder = -10;
  scene.add(nebula);

  /* Частинки */
  onProgress(0.05, 'Розкладаємо інструменти');
  const data = await buildParticles(Q.count, (p, label) => onProgress(0.05 + p * 0.6, label));
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(data.chaos, 3));
  geo.setAttribute('aTooth', new THREE.BufferAttribute(data.tooth, 3));
  geo.setAttribute('aCrown', new THREE.BufferAttribute(data.crown, 3));
  geo.setAttribute('aGrid', new THREE.BufferAttribute(data.grid, 2));
  geo.setAttribute('aFan', new THREE.BufferAttribute(data.fan, 4));
  geo.setAttribute('aArch', new THREE.BufferAttribute(data.arch, 4));
  geo.setAttribute('aRand', new THREE.BufferAttribute(data.rand, 4));

  const pU = {
    uTime: { value: 0 }, uFrom: { value: -1 }, uTo: { value: 0 }, uT: { value: 0 }, uSpacing: { value: SPACING },
    uPR: { value: dpr }, uSize: { value: Q.size }, uViewH: { value: 900 },
    uFanSpread: { value: 0.05 }, uArchLight: { value: -1 }, uWaveAmp: { value: 1 }, uCrownFade: { value: 0 },
    uIntroSpread: { value: 9 }, uScanY: { value: -1.1 },
    uRotTooth: { value: new THREE.Matrix3() }, uRotCrown: { value: new THREE.Matrix3() },
    uPointer: { value: new THREE.Vector3(0, 999, 0) }, uPointerK: { value: 0 },
    uMint: { value: C.mint }, uRose: { value: C.rose }, uPearl: { value: C.text }, uIvory: { value: C.ivory },
  };
  const points = new THREE.Points(geo, new THREE.ShaderMaterial({
    vertexShader: PARTICLE_VERT, fragmentShader: PARTICLE_FRAG, uniforms: pU,
    transparent: true, depthTest: false, depthWrite: false, blending: THREE.AdditiveBlending,
  }));
  points.frustumCulled = false;
  points.renderOrder = 2;
  scene.add(points);
  onProgress(0.7, 'Наводимо промінь');

  /* Світлова лінія */
  const { curve, segs } = buildLinePath();
  const lineU = (halo) => ({
    uHead: { value: 0 }, uTail: { value: 0.05 }, uTime: { value: 0 }, uHalo: { value: halo ? 1 : 0 },
    uGain: { value: Q.bloom ? 1.25 : 0.95 }, uMint: { value: C.mint }, uRose: { value: C.rose }, uPearl: { value: C.text },
  });
  const tubeSegs = tier === 'desktop' ? 2400 : 1400;
  const lineCore = new THREE.Mesh(
    new THREE.TubeGeometry(curve, tubeSegs, 0.011, 5, false),
    new THREE.ShaderMaterial({ vertexShader: LINE_VERT, fragmentShader: LINE_FRAG, uniforms: lineU(false), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }),
  );
  const lineHalo = new THREE.Mesh(
    new THREE.TubeGeometry(curve, Math.round(tubeSegs * 0.6), 0.06, 6, false),
    new THREE.ShaderMaterial({ vertexShader: LINE_VERT, fragmentShader: LINE_FRAG, uniforms: lineU(true), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }),
  );
  lineCore.frustumCulled = lineHalo.frustumCulled = false;
  lineHalo.renderOrder = 1;
  lineCore.renderOrder = 3;
  scene.add(lineHalo, lineCore);

  /* Скляні картки (сцена 5) — у двох можуть бути відео */
  const cards = [];
  const cardGeo = new THREE.PlaneGeometry(1.5, 1.875, 1, 1);
  const cardDefs = [
    { pos: [-1.75, 0.55, 0.35], rot: [0.04, 0.38, -0.06], tint: C.mint, video: videos.cardA },
    { pos: [0.15, -0.35, -0.55], rot: [-0.03, -0.06, 0.03], tint: C.text, video: null },
    { pos: [1.95, 0.6, 0.05], rot: [0.05, -0.36, 0.07], tint: C.rose, video: videos.cardB },
  ];
  cardDefs.forEach((def, i) => {
    const u = {
      uMap: { value: null }, uHasMap: { value: 0 }, uTime: { value: 0 }, uOpacity: { value: 0 }, uSeed: { value: i * 0.37 },
      uTint: { value: def.tint }, uPearl: { value: C.text }, uMint: { value: C.mint }, uRose: { value: C.rose }, uBg: { value: C.bg },
    };
    const m = new THREE.Mesh(cardGeo, new THREE.ShaderMaterial({
      vertexShader: CARD_VERT, fragmentShader: CARD_FRAG, uniforms: u, transparent: true, depthWrite: false, side: THREE.DoubleSide,
    }));
    m.position.set(def.pos[0], def.pos[1] - 4 * SPACING, def.pos[2]);
    m.rotation.set(...def.rot);
    m.renderOrder = 4;
    m.visible = false;
    m.userData = { base: [...def.pos], rot: [...def.rot], video: def.video, el: null };
    scene.add(m);
    cards.push(m);
  });

  function ensureCardVideo(card) {
    const src = card.userData.video;
    if (!src || card.userData.el) return;
    const v = document.createElement('video');
    v.muted = true; v.loop = true; v.playsInline = true; v.preload = 'auto'; v.crossOrigin = 'anonymous';
    v.setAttribute('aria-hidden', 'true');
    ['webm', 'mp4'].forEach((ext) => {
      const s = document.createElement('source');
      s.src = `${src}.${ext}`; s.type = `video/${ext}`;
      v.appendChild(s);
    });
    card.userData.el = v;
    v.addEventListener('loadeddata', () => {
      const tex = new THREE.VideoTexture(v);
      tex.colorSpace = THREE.SRGBColorSpace;
      card.material.uniforms.uMap.value = tex;
      card.material.uniforms.uHasMap.value = 1;
    }, { once: true });
    v.load();
  }

  /* Постобробка: bloom лише на десктопі (вантажимо модулі тільки там) */
  let composer = null;
  let bloomPass = null;
  async function setupBloom() {
    const [{ EffectComposer }, { RenderPass }, { UnrealBloomPass }, { OutputPass }] = await Promise.all([
      import('three/addons/postprocessing/EffectComposer.js'),
      import('three/addons/postprocessing/RenderPass.js'),
      import('three/addons/postprocessing/UnrealBloomPass.js'),
      import('three/addons/postprocessing/OutputPass.js'),
    ]);
    composer = new EffectComposer(renderer);
    composer.addPass(new RenderPass(scene, camera));
    bloomPass = new UnrealBloomPass(new THREE.Vector2(512, 512), 0.75, 0.55, 0.32);
    composer.addPass(bloomPass);
    composer.addPass(new OutputPass());
  }
  if (Q.bloom) {
    onProgress(0.8, 'Вмикаємо лампу');
    try { await setupBloom(); } catch (e) { console.warn('bloom вимкнено', e); Q.bloom = false; }
  }

  /* Розмір */
  let W = 1, H = 1;
  function resize() {
    const w = canvas.clientWidth || window.innerWidth;
    const h = canvas.clientHeight || window.innerHeight;
    if (Math.abs(w - W) < 1 && Math.abs(h - H) < 1) return;
    W = w; H = h;
    renderer.setPixelRatio(dpr);
    renderer.setSize(W, H, false);
    camera.aspect = W / H;
    camera.updateProjectionMatrix();
    nebulaU.uRes.value.set(W * dpr, H * dpr);
    pU.uViewH.value = H;
    pU.uPR.value = dpr;
    if (composer) {
      composer.setPixelRatio(dpr);
      composer.setSize(W, H);
      bloomPass.resolution.set(W * dpr * 0.5, H * dpr * 0.5);
    }
  }
  resize();
  new ResizeObserver(resize).observe(canvas);

  /* Компіляція шейдерів заздалегідь, щоб перший кадр не смикався.
     compileAsync не блокує сторінку: на Windows (Direct3D) компіляція помітно довша, ніж на Mac. */
  onProgress(0.9, 'Готуємо крісло');
  cards.forEach((c) => { c.visible = true; });
  if (renderer.compileAsync && renderer.extensions.has('KHR_parallel_shader_compile')) {
    await Promise.race([renderer.compileAsync(scene, camera), new Promise((r) => setTimeout(r, 20000))]);
  } else {
    renderer.compile(scene, camera);
  }
  render(); // пробний кадр: тут three.js перевіряє програми (і компілює bloom)
  cards.forEach((c) => { c.visible = false; });
  if (shaderError) throw new Error('шейдер не скомпілювався: ' + shaderError.split('\n')[0]);
  onProgress(1, 'Готово');

  /* ---------- Стан анімації ---------- */
  let time = 0;
  let last = 0;
  let raf = 0;
  let paused = false;
  let running = false;
  let introT = 0;              // 0…1, частинки збираються в зуб
  let sf = state.f;            // згладжена сцена
  const ptr = new THREE.Vector2(0, 0);
  const ray = new THREE.Raycaster();
  const plane = new THREE.Plane();
  const tmpV = new THREE.Vector3();
  const look = new THREE.Vector3();
  const camPos = new THREE.Vector3();
  const rotE = new THREE.Euler();
  const m4 = new THREE.Matrix4();
  let pointerK = 0;
  const frames = [];
  let degradeChecked = 0;

  function comp(k, desktop) {
    const s = STATIONS[clamp(k, 0, LAST)];
    return desktop ? s.desk : s.mob;
  }

  function lerpStation(f) {
    const i0 = Math.floor(clamp(f, 0, LAST));
    const i1 = Math.min(LAST, i0 + 1);
    const t = smooth(clamp(f - i0, 0, 1));
    const d = state.desktop;
    const a = comp(i0, d), b = comp(i1, d);
    const A = STATIONS[i0], B = STATIONS[i1];
    return {
      cx: lerp(a.cx, b.cx, t), cy: lerp(a.cy, b.cy, t), bw: lerp(a.bw, b.bw, t), bh: lerp(a.bh, b.bh, t),
      R: lerp(A.R, B.R, t),
      dir: [0, 1, 2].map((j) => lerp(A.dir[j], B.dir[j], t)),
      look: [0, 1, 2].map((j) => lerp(A.look[j], B.look[j], t)),
    };
  }

  function update(dt) {
    time += dt;
    // інтро: хмара → зуб
    if (introT < 1) introT = Math.min(1, introT + dt / 2.8);
    const intro = easeOut(introT);

    // згладжування прокрутки
    const k = 1 - Math.exp(-dt * 5.5);
    sf += (state.f - sf) * k;
    if (Math.abs(state.f - sf) < 1e-4) sf = state.f;

    // частинки: з якої форми в яку
    const fEff = sf - (1 - intro);
    let from = Math.floor(fEff);
    let t = fEff - from;
    from = clamp(from, -1, LAST);
    let to = Math.min(from + 1, LAST);
    if (fEff >= LAST) { from = LAST; to = LAST; t = 0; }
    pU.uFrom.value = from; pU.uTo.value = to; pU.uT.value = t;
    pU.uTime.value = time;

    // локальні параметри сцен
    const L = state.local, P = state.pin, A = state.arrive || state.local;
    pU.uFanSpread.value = lerp(0.05, 0.24, smooth(clamp(A[2] * 1.6 - 0.3)));
    pU.uArchLight.value = lerp(-1, 16.5, clamp(A[5]));
    pU.uWaveAmp.value = 0.85 + 0.25 * Math.sin(time * 0.6);
    pU.uCrownFade.value = state.crownVideo ? 1 : 0;
    pU.uScanY.value = lerp(-1.1, 1.1, clamp(P[3] * 1.1));

    // обертання зуба й коронки (+ легкий нахил за курсором)
    ptr.x += (state.pointer.x - ptr.x) * Math.min(1, dt * 3);
    ptr.y += (state.pointer.y - ptr.y) * Math.min(1, dt * 3);
    rotE.set(-0.12 - ptr.y * 0.16, time * 0.22 + ptr.x * 0.4, 0.06);
    pU.uRotTooth.value.setFromMatrix4(m4.makeRotationFromEuler(rotE));
    rotE.set(0.22 - ptr.y * 0.1, P[3] * Math.PI * 2.2 + time * 0.06, 0);
    pU.uRotCrown.value.setFromMatrix4(m4.makeRotationFromEuler(rotE));

    // камера: вписуємо об'єкт у рамку композиції
    const c = lerpStation(sf);
    const tanH = Math.tan(THREE.MathUtils.degToRad(FOV / 2));
    const dV = c.R / (tanH * c.bh);
    const dH = c.R / (tanH * camera.aspect * c.bw);
    let dist = Math.max(dV, dH) * (1 + (1 - intro) * 0.35);
    const centerY = -clamp(sf, 0, LAST) * SPACING;
    tmpV.set(...c.dir).normalize();
    camPos.set(tmpV.x * dist + ptr.x * 0.35, centerY + tmpV.y * dist + ptr.y * 0.25, tmpV.z * dist);
    camera.position.copy(camPos);
    look.set(c.look[0], centerY + c.look[1], c.look[2]);
    camera.lookAt(look);
    camera.setViewOffset(W, H, W * 0.5 - c.cx * W, H * 0.5 - c.cy * H, W, H);
    camera.updateMatrixWorld();
    nebulaU.uFocus.value.set(c.cx, c.cy);
    nebulaU.uTime.value = time;
    nebulaU.uF.value = sf;
    nebulaU.uRoseAmt.value = 0.6 + 0.6 * Math.max(Math.exp(-Math.pow(sf - 0, 2) * 3), Math.exp(-Math.pow(sf - 5, 2) * 2), 0.5 * Math.exp(-Math.pow(sf - 3, 2) * 3));
    nebulaU.uMintAmt.value = 0.9 + 0.3 * Math.exp(-Math.pow(sf - 1, 2) * 2);

    // курсор: точка на площині станції, частинки розступаються
    const hasPointer = Math.abs(state.pointer.x) + Math.abs(state.pointer.y) > 0;
    pointerK += ((hasPointer ? 0.55 : 0) - pointerK) * Math.min(1, dt * 2);
    if (hasPointer) {
      ray.setFromCamera(ptr, camera);
      camera.getWorldDirection(tmpV);
      plane.setFromNormalAndCoplanarPoint(tmpV.negate(), look);
      if (ray.ray.intersectPlane(plane, tmpV)) pU.uPointer.value.copy(tmpV);
    }
    pU.uPointerK.value = pointerK;

    // світлова лінія: голова йде за сценою
    const fl = clamp(sf, 0, LAST);
    const i0 = Math.floor(fl), i1 = Math.min(LAST, i0 + 1), tt = fl - i0;
    const segA = segs[i0], segB = segs[i1];
    let head = lerp(segA[1], segB[1], smooth(tt));
    let tail = lerp(segA[1] - segA[0], segB[1] - segB[0], smooth(tt)) + 0.035;
    if (intro < 1) { head = lerp(segs[0][0], head, intro); tail = Math.min(tail, Math.max(0.01, head - segs[0][0] + 0.02)); }
    [lineCore, lineHalo].forEach((m) => {
      m.material.uniforms.uHead.value = head;
      m.material.uniforms.uTail.value = tail;
      m.material.uniforms.uTime.value = time;
    });

    // скляні картки: видно лише біля сцени 5
    const vis = 1 - smooth(clamp((Math.abs(sf - 4) - 0.35) / 0.6));
    cards.forEach((card, i) => {
      card.visible = vis > 0.01;
      const u = card.material.uniforms;
      u.uOpacity.value = vis;
      u.uTime.value = time;
      const [bx, by, bz] = card.userData.base;
      const [rx, ry, rz] = card.userData.rot;
      card.position.set(bx, by - 4 * SPACING + Math.sin(time * 0.6 + i * 1.7) * 0.08 + (1 - vis) * (i - 1) * 0.6, bz);
      card.rotation.set(rx - ptr.y * 0.12, ry + ptr.x * 0.18 + Math.sin(time * 0.4 + i) * 0.04, rz);
      if (card.userData.video) {
        if (Math.abs(sf - 4) < 1.2) ensureCardVideo(card);
        const v = card.userData.el;
        if (v) { if (vis > 0.05 && v.paused) v.play().catch(() => {}); else if (vis <= 0.05 && !v.paused) v.pause(); }
      }
    });
  }

  function render() {
    if (composer && Q.bloom) composer.render();
    else renderer.render(scene, camera);
  }

  /* Адаптивна якість: якщо кадрів мало — спрощуємо */
  function adapt(dt) {
    frames.push(dt);
    if (frames.length < 90) return;
    const avg = frames.reduce((a, b) => a + b, 0) / frames.length;
    frames.length = 0;
    const fps = 1 / avg;
    stats.fps = Math.round(fps);
    if (!adaptive || degradeChecked > 4) return;
    degradeChecked++;
    const target = tier === 'desktop' ? 45 : 28;
    if (fps >= target) return;
    if (Q.bloom) { Q.bloom = false; lineCore.material.uniforms.uGain.value = 0.95; return; }
    if (dpr > 1) { dpr = Math.max(1, dpr - 0.5); W = 0; resize(); return; }
    const n = geo.drawRange.count === Infinity ? Q.count : geo.drawRange.count;
    if (n > 4000) geo.setDrawRange(0, Math.floor(n * 0.7));
  }

  /* Страховка від «чорного екрана»: фон-туманність ніколи не буває чистим #000,
     тож якщо після рендеру більшість пікселів чорні — шейдери на цій відеокарті рахують NaN
     або не малюють. Тоді вимикаємо 3D і показуємо постери. Перевіряємо двічі на старті. */
  let failed = false;
  let frameNo = 0;
  let probe = null;
  // Читаємо три рядки пікселів асинхронно (буфер + fence), щоб не зупиняти відеокарту
  function startProbe() {
    const gl = renderer.getContext();
    const w = gl.drawingBufferWidth, h = gl.drawingBufferHeight;
    renderer.setRenderTarget(null);
    const buf = gl.createBuffer();
    gl.bindBuffer(gl.PIXEL_PACK_BUFFER, buf);
    gl.bufferData(gl.PIXEL_PACK_BUFFER, w * 4 * 3, gl.STREAM_READ);
    [0.25, 0.5, 0.75].forEach((fy, i) => gl.readPixels(0, Math.floor(h * fy), w, 1, gl.RGBA, gl.UNSIGNED_BYTE, i * w * 4));
    gl.bindBuffer(gl.PIXEL_PACK_BUFFER, null);
    const sync = gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0);
    gl.flush();
    probe = { buf, sync, w, tries: 0 };
  }
  function pollProbe() {
    const gl = renderer.getContext();
    const p = probe;
    p.tries++;
    if (gl.clientWaitSync(p.sync, 0, 0) === gl.TIMEOUT_EXPIRED && p.tries < 120) return null;
    gl.deleteSync(p.sync);
    const data = new Uint8Array(p.w * 4 * 3);
    gl.bindBuffer(gl.PIXEL_PACK_BUFFER, p.buf);
    gl.getBufferSubData(gl.PIXEL_PACK_BUFFER, 0, data);
    gl.bindBuffer(gl.PIXEL_PACK_BUFFER, null);
    gl.deleteBuffer(p.buf);
    probe = null;
    let black = 0, total = 0;
    for (let i = 0; i < data.length; i += 4 * 5) {
      total++;
      if (data[i] + data[i + 1] + data[i + 2] === 0) black++;
    }
    return total ? black / total : 0;
  }
  function fail(reason) {
    if (failed) return;
    failed = true;
    setPaused(true);
    onFail(reason);
  }

  function frame(now) {
    if (paused) { running = false; return; }
    raf = requestAnimationFrame(frame);
    const real = last ? (now - last) / 1000 : 1 / 60;
    const dt = Math.min(0.05, real);
    last = now;
    const t0 = performance.now();
    update(dt);
    stats.jsMs = stats.jsMs * 0.95 + (performance.now() - t0) * 0.05;
    render();
    frameNo++;
    if ((frameNo === 30 || frameNo === 240) && !probe) startProbe();
    else if (probe) {
      const share = pollProbe();
      if (share !== null) {
        stats.black = +share.toFixed(3);
        if (share > 0.3 || params.has('failtest')) { fail(`чорний кадр (${Math.round(share * 100)}% пікселів)`); return; }
      }
    }
    adapt(real);
  }

  const params = new URLSearchParams(location.search);
  const stats = { fps: 0, tier, particles: Q.count, jsMs: 0, gpu, black: null };

  function start() {
    if (running) return;
    running = true; paused = false; last = 0;
    raf = requestAnimationFrame(frame);
  }
  function setPaused(p) {
    if (p) { paused = true; cancelAnimationFrame(raf); running = false; }
    else if (!document.hidden) start();
  }

  // Пауза, коли полотно не на екрані
  new IntersectionObserver(([en]) => setPaused(!en.isIntersecting)).observe(canvas);

  canvas.addEventListener('webglcontextlost', (e) => {
    e.preventDefault();
    fail('втрачено WebGL-контекст (драйвер відеокарти скинув його)');
  });

  return {
    start,
    setPaused,
    skipIntro() { introT = 1; sf = state.f; },
    stats: () => ({
      ...stats, dpr, bloom: Q.bloom, drawn: geo.drawRange.count === Infinity ? Q.count : geo.drawRange.count, sf: +sf.toFixed(3),
      line: [lineCore.material.uniforms.uHead.value, lineCore.material.uniforms.uTail.value].map((v) => +v.toFixed(4)), segs,
    }),
  };
}

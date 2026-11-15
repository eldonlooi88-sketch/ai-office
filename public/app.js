// AI 团队办公室 · 现代简约风 3D 前端
import * as THREE from './vendor/three.module.js';
import { OrbitControls } from './vendor/addons/OrbitControls.js';
import { RoundedBoxGeometry } from './vendor/addons/RoundedBoxGeometry.js';
import { mergeGeometries } from './vendor/addons/BufferGeometryUtils.js';

// ---------------- 常量 ----------------
const STATUS = {
  working:  { label: '工作中',   color: '#5fa67c' },
  thinking: { label: '思考中',   color: '#8f7fc4' },
  browsing: { label: '浏览网页', color: '#5b93c7' },
  help:     { label: '需要帮助', color: '#d2685a' },
  idle:     { label: '空闲',     color: '#a39d94' },
  done:     { label: '已完成',   color: '#cf9f3e' },
};
const P = { // 现代简约配色
  oak: '#d2b48c', oakDark: '#b8936a', walnut: '#8a6447', white: '#f5f3ef', offwhite: '#ebe6df', greige: '#d8cfc3',
  charcoal: '#3b3e44', graphite: '#55595f', sage: '#9fb3a0', terracotta: '#c8805f', dusty: '#86a1b8', mustard: '#d6ad5c',
  oat: '#d9cdbb', blush: '#e2b8a6', leaf: '#6f9a6e', leafDark: '#557d58', brass: '#c3a46b', glass: '#dcecef',
};
const FONT = '"PingFang SC","Noto Sans CJK SC","Microsoft YaHei","Helvetica Neue",sans-serif';
const isMobile = matchMedia('(max-width: 760px), (pointer: coarse)').matches;
const WALL_H = 3.2;

// ---------------- 渲染器 / 场景 ----------------
const container = document.getElementById('scene');
const renderer = new THREE.WebGLRenderer({ antialias: !isMobile || devicePixelRatio < 2, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(devicePixelRatio, isMobile ? 1.5 : 2));
renderer.setSize(innerWidth, innerHeight);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.05;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
container.appendChild(renderer.domElement);

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(45, innerWidth / innerHeight, 0.5, 300);
const controls = new OrbitControls(camera, renderer.domElement);
function homeCamera() {
  const portrait = innerWidth / innerHeight < 0.9;
  camera.fov = portrait ? 55 : 45; camera.updateProjectionMatrix();
  if (portrait) { camera.position.set(34, 66, -1); controls.target.set(0, 0, -1); } // 竖屏：从侧面俯视，长边沿屏幕纵向（双指缩放看细节）
  else { const k = innerWidth / innerHeight < 1.5 ? 1.15 : 1.0, off = innerWidth > 1100 ? 2.5 : 0; camera.position.set(off, 25 * k, 33 * k); controls.target.set(off, 0, 0.3); }
}
controls.enableDamping = true; controls.dampingFactor = 0.08;
controls.maxPolarAngle = Math.PI * 0.46; controls.minDistance = 6; controls.maxDistance = 110;
controls.touches = { ONE: THREE.TOUCH.ROTATE, TWO: THREE.TOUCH.DOLLY_PAN };
homeCamera();

const hemi = new THREE.HemisphereLight(0xfff6ea, 0xcbbfae, 1.5); scene.add(hemi);
const sun = new THREE.DirectionalLight(0xfff1de, 2.3);
sun.position.set(-18, 34, 22);
sun.castShadow = true;
sun.shadow.mapSize.set(isMobile ? 1024 : 2048, isMobile ? 1024 : 2048);
Object.assign(sun.shadow.camera, { left: -38, right: 38, top: 30, bottom: -30, near: 5, far: 100 });
sun.shadow.bias = -0.0004; sun.shadow.normalBias = 0.02; sun.shadow.radius = 5;
scene.add(sun);
const lampLights = [[-23.5, -8.5], [-16, -8.6], [-8, -7.8], [6, -8.5], [-11, 6], [-1.5, 6.5], [8.5, 6], [-24, 5.5]].map(([x, z]) => {
  const l = new THREE.PointLight(0xffb469, 0, 16, 1.5); l.position.set(x, 3.2, z); scene.add(l); return l;
});

// ---------------- 材质 / 几何工具 ----------------
const matCache = new Map();
function std(color, o = {}) {
  const key = color + '|' + (o.rough ?? '') + '|' + (o.metal ?? '') + '|' + (o.map ? o.map.uuid : '');
  if (!matCache.has(key)) matCache.set(key, new THREE.MeshStandardMaterial({ color, roughness: o.rough ?? 0.82, metalness: o.metal ?? 0, map: o.map || null }));
  return matCache.get(key);
}
const M = (m) => typeof m === 'string' ? std(m) : m;
const glassMat = new THREE.MeshStandardMaterial({ color: P.glass, roughness: 0.08, metalness: 0.1, transparent: true, opacity: 0.16, depthWrite: false });
function place(mesh, parent, x, y, z, o = {}) {
  mesh.position.set(x, y, z);
  if (o.ry) mesh.rotation.y = o.ry; if (o.rx) mesh.rotation.x = o.rx; if (o.rz) mesh.rotation.z = o.rz;
  mesh.castShadow = o.shadow !== false; mesh.receiveShadow = true;
  (parent || scene).add(mesh); return mesh;
}
// y 为底部高度
const B = (w, h, d, m, x, y, z, o = {}, parent) => place(new THREE.Mesh(new THREE.BoxGeometry(w, h, d), M(m)), parent, x, y + h / 2, z, o);
const R = (w, h, d, r, m, x, y, z, o = {}, parent) => place(new THREE.Mesh(new RoundedBoxGeometry(w, h, d, 2, Math.min(r, w / 2, h / 2, d / 2)), M(m)), parent, x, y + h / 2, z, o);
const C = (rt, rb, h, m, x, y, z, o = {}, parent, seg = 20) => place(new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, seg), M(m)), parent, x, y + h / 2, z, o);
const S = (r, m, x, y, z, o = {}, parent, seg = 18) => place(new THREE.Mesh(new THREE.SphereGeometry(r, seg, Math.max(8, seg * 0.7 | 0)), M(m)), parent, x, y, z, o);
const CAP = (r, len, m, x, y, z, o = {}, parent) => place(new THREE.Mesh(new THREE.CapsuleGeometry(r, len, 4, 12), M(m)), parent, x, y, z, o);

// ---------------- 画布纹理 ----------------
function canvasTex(w, h, draw, repeat) {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  const ctx = c.getContext('2d'); draw(ctx, w, h);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
  if (repeat) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(repeat[0], repeat[1]); }
  t.userData = { canvas: c, ctx }; return t;
}
// 伪随机（保证每次纹理一致）
let seed = 7; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
function shade(hex, k) { const c = new THREE.Color(hex); c.offsetHSL(0, 0, k); return '#' + c.getHexString(); }
function woodTex(base, plankW = 64, vari = 0.06) {
  return canvasTex(512, 512, (g, w, h) => {
    for (let x = 0; x < w; x += plankW) {
      let y = -rnd() * 200;
      while (y < h) {
        const len = 160 + rnd() * 200;
        g.fillStyle = shade(base, (rnd() - 0.5) * vari); g.fillRect(x, y, plankW, len);
        g.strokeStyle = 'rgba(80,50,30,.06)'; g.lineWidth = 1;
        for (let k = 0; k < 5; k++) { const gx = x + 6 + rnd() * (plankW - 12); g.beginPath(); g.moveTo(gx, y); g.bezierCurveTo(gx + 4, y + len * 0.3, gx - 4, y + len * 0.7, gx + 2, y + len); g.stroke(); }
        g.fillStyle = 'rgba(70,45,25,.18)'; g.fillRect(x, y, plankW, 1.5);
        y += len;
      }
      g.fillStyle = 'rgba(70,45,25,.16)'; g.fillRect(x, 0, 1.5, h);
    }
  }, [1, 1]);
}
function soften(hex, k = 0.28) { const c = new THREE.Color(hex), hsl = {}; c.getHSL(hsl); c.setHSL(hsl.h, hsl.s * 0.62, Math.min(0.72, hsl.l * 0.95 + 0.06)); return '#' + c.lerp(new THREE.Color('#e9e4dc'), k * 0.5).getHexString(); }
function grainTex(base) { // 家具木纹：无拼块，只有细纹
  return canvasTex(512, 512, (g, w, h) => {
    g.fillStyle = base; g.fillRect(0, 0, w, h);
    for (let k = 0; k < 90; k++) { const x = rnd() * w; g.strokeStyle = `rgba(90,60,35,${0.03 + rnd() * 0.05})`; g.lineWidth = 1 + rnd() * 1.5;
      g.beginPath(); g.moveTo(x, 0); g.bezierCurveTo(x + 10 - rnd() * 20, h * 0.33, x + 10 - rnd() * 20, h * 0.66, x + 6 - rnd() * 12, h); g.stroke(); }
  }, [1, 1]);
}
function concreteTex(base) {
  return canvasTex(256, 256, (g, w, h) => {
    g.fillStyle = base; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 1400; i++) { g.fillStyle = `rgba(${rnd() > 0.5 ? '255,255,255' : '90,80,70'},${rnd() * 0.05})`; g.fillRect(rnd() * w, rnd() * h, 2 + rnd() * 3, 2 + rnd() * 3); }
  }, [1, 1]);
}
function tileTex(base, line) {
  return canvasTex(128, 128, (g, w, h) => { g.fillStyle = base; g.fillRect(0, 0, w, h); g.fillStyle = line; g.fillRect(0, 0, w, 2); g.fillRect(0, 0, 2, h);
    for (let i = 0; i < 120; i++) { g.fillStyle = `rgba(120,110,100,${rnd() * 0.08})`; g.fillRect(rnd() * w, rnd() * h, 2, 2); } }, [1, 1]);
}
function rr(g, x, y, w, h, r) {
  g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r);
  g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath();
}
function fitText(g, text, maxW) {
  if (g.measureText(text).width <= maxW) return text;
  let s = text; while (s.length && g.measureText(s + '…').width > maxW) s = s.slice(0, -1);
  return s + '…';
}
function wrap2(g, text, maxW) {
  const chars = Array.from(text || ''), lines = []; let cur = '', used = 0;
  for (const ch of chars) { if (g.measureText(cur + ch).width > maxW) { lines.push(cur); cur = ch; if (lines.length === 2) break; } else cur += ch; used++; }
  if (lines.length < 2 && cur) lines.push(cur);
  if (lines.length === 2 && used < chars.length) lines[1] = fitText(g, lines[1] + '……', maxW);
  return lines.slice(0, 2);
}
function panel(w, h, tex, x, y, z, o = {}, parent) {
  const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), o.lit ? new THREE.MeshStandardMaterial({ map: tex, roughness: 0.9, transparent: !!o.transparent })
    : new THREE.MeshBasicMaterial({ map: tex, transparent: !!o.transparent, toneMapped: false, depthWrite: !o.transparent }));
  m.position.set(x, y, z); if (o.ry) m.rotation.y = o.ry; if (o.rx) m.rotation.x = o.rx; m.receiveShadow = !!o.lit;
  (parent || scene).add(m); return m;
}
function plaqueTex(text, bg = P.charcoal, fg = '#f5f3ef', w = 512, h = 128) {
  return canvasTex(w, h, (g) => { g.fillStyle = bg; rr(g, 0, 0, w, h, 18); g.fill();
    g.font = `600 ${h * 0.42}px ${FONT}`; g.fillStyle = fg; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(text, w / 2, h / 2 + 2); });
}
function floorLabel(text) {
  return canvasTex(1024, 192, (g, w, h) => { g.font = `600 110px ${FONT}`; g.fillStyle = 'rgba(70,60,50,.28)'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(text, w / 2, h / 2); });
}

const oakMat = std('#ffffff', { map: grainTex('#cfae86'), rough: 0.6 });
const walnutMat = std('#ffffff', { map: grainTex('#7a563c'), rough: 0.55 });
const daySky = canvasTex(256, 256, (g) => { const gr = g.createLinearGradient(0, 0, 0, 256); gr.addColorStop(0, '#a9cfe6'); gr.addColorStop(1, '#e9f2f4'); g.fillStyle = gr; g.fillRect(0, 0, 256, 256);
  g.fillStyle = 'rgba(255,255,255,.85)'; for (const [x, y, r] of [[60, 70, 18], [82, 64, 24], [108, 72, 16], [190, 110, 14], [206, 105, 18]]) { g.beginPath(); g.arc(x, y, r, 0, 7); g.fill(); }
  for (let i = 0; i < 12; i++) { g.fillStyle = ['#c3d0d6', '#b4c4cc', '#cfd9dd'][i % 3]; const bh = 60 + (i * 47 % 90); g.fillRect(i * 22, 256 - bh, 20, bh); g.fillStyle = 'rgba(255,255,255,.35)'; for (let y = 256 - bh + 8; y < 250; y += 12) g.fillRect(i * 22 + 4, y, 12, 4); } });
const nightSky = canvasTex(256, 256, (g) => { const gr = g.createLinearGradient(0, 0, 0, 256); gr.addColorStop(0, '#141826'); gr.addColorStop(1, '#2a2f45'); g.fillStyle = gr; g.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 12; i++) { g.fillStyle = '#1b1f2c'; const bh = 60 + (i * 47 % 90); g.fillRect(i * 22, 256 - bh, 20, bh); g.fillStyle = '#f2c57c'; for (let y = 256 - bh + 8; y < 250; y += 12) if ((i * 7 + y) % 3) g.fillRect(i * 22 + 4, y, 5, 4); }
  g.fillStyle = '#f3ead2'; g.beginPath(); g.arc(200, 45, 12, 0, 7); g.fill(); });
const windowMats = [];
function windowAt(side, c, w, y0 = 0.7, h = 2.1) {
  const g = new THREE.Group(); scene.add(g);
  if (side === 'back') { g.position.set(c, 0, FZ0 + 0.01); }
  else if (side === 'left') { g.position.set(FX0 + 0.01, 0, c); g.rotation.y = Math.PI / 2; }
  else { g.position.set(FX1 - 0.01, 0, c); g.rotation.y = -Math.PI / 2; }
  B(w + 0.14, h + 0.14, 0.05, P.charcoal, 0, y0 - 0.07, 0, { shadow: false }, g);
  const m = new THREE.MeshBasicMaterial({ map: daySky, toneMapped: false }); windowMats.push(m);
  const p = new THREE.Mesh(new THREE.PlaneGeometry(w, h), m); p.position.set(0, y0 + h / 2, 0.03); g.add(p);
  for (let i = 1; i < Math.round(w / 1.2); i++) B(0.035, h, 0.04, P.charcoal, -w / 2 + i * w / Math.round(w / 1.2), y0, 0.05, { shadow: false }, g);
  B(w + 0.2, 0.04, 0.2, P.white, 0, y0 - 0.06, 0.1, { shadow: false }, g);
}
function glassSeg(x1, z1, x2, z2, h) {
  const alongX = z1 === z2, len = alongX ? Math.abs(x2 - x1) : Math.abs(z2 - z1);
  if (len < 0.05) return;
  const cx = (x1 + x2) / 2, cz = (z1 + z2) / 2;
  const pane = new THREE.Mesh(alongX ? new THREE.BoxGeometry(len, h, 0.04) : new THREE.BoxGeometry(0.04, h, len), glassMat);
  pane.position.set(cx, h / 2, cz); pane.renderOrder = 1; scene.add(pane);
  const fr = (y, th) => B(alongX ? len : 0.07, th, alongX ? 0.07 : len, P.charcoal, cx, y, cz, { shadow: false });
  fr(0, 0.08); fr(h - 0.06, 0.06); fr(1.05, 0.03);
  const n = Math.max(1, Math.round(len / 1.8));
  for (let i = 0; i <= n; i++) { const t = i / n; B(0.06, h, 0.06, P.charcoal, alongX ? x1 + (x2 - x1) * t : cx, 0, alongX ? cz : z1 + (z2 - z1) * t, { shadow: false }); }
}
function solidSeg(x1, z1, x2, z2, h, m, y0 = 0) {
  const alongX = z1 === z2, len = alongX ? Math.abs(x2 - x1) : Math.abs(z2 - z1);
  if (len < 0.05) return;
  B(alongX ? len : 0.2, h, alongX ? 0.2 : len, m, (x1 + x2) / 2, y0, (z1 + z2) / 2);
}
// ---------------- 家具 ----------------
const bulbMats = [];
function chair(x, z, ry, color, parent, o = {}) { // 人面朝 +z，靠背在 -z
  const g = new THREE.Group(); g.position.set(x, 0, z); g.rotation.y = ry; (parent || scene).add(g);
  if (o.office) { // 人体工学椅：五星脚 + 网面靠背 + 扶手
    for (let i = 0; i < 5; i++) { const a = i / 5 * Math.PI * 2; B(0.04, 0.04, 0.3, P.charcoal, Math.sin(a) * 0.15, 0.04, Math.cos(a) * 0.15, { ry: a, shadow: false }, g); S(0.03, P.charcoal, Math.sin(a) * 0.29, 0.03, Math.cos(a) * 0.29, { shadow: false }, g, 6); }
    C(0.03, 0.03, 0.36, P.graphite, 0, 0.07, 0, {}, g, 8);
    R(0.56, 0.09, 0.52, 0.04, color, 0, 0.42, 0, {}, g);
    R(0.52, 0.62, 0.05, 0.05, P.charcoal, 0, 0.6, -0.27, { rx: -0.1 }, g);
    R(0.46, 0.5, 0.03, 0.04, '#5a5e64', 0, 0.66, -0.25, { rx: -0.1, shadow: false }, g);
    for (const s of [-1, 1]) { B(0.03, 0.2, 0.03, P.charcoal, s * 0.27, 0.48, -0.02, { shadow: false }, g); R(0.06, 0.03, 0.28, 0.01, P.charcoal, s * 0.27, 0.68, 0.0, { shadow: false }, g); }
  } else {
    for (const [lx, lz] of [[-0.22, -0.2], [0.22, -0.2], [-0.22, 0.2], [0.22, 0.2]]) C(0.022, 0.018, 0.42, o.legs || P.oakDark, lx, 0, lz, {}, g, 6);
    R(0.56, 0.08, 0.52, 0.04, color, 0, 0.42, 0, {}, g);
    R(0.54, o.tall ? 0.9 : 0.42, 0.07, 0.04, color, 0, 0.55, -0.25, { rx: -0.08 }, g);
  }
  return g;
}
function armchair(x, z, ry, color) {
  const g = new THREE.Group(); g.position.set(x, 0, z); g.rotation.y = ry; scene.add(g);
  R(1.0, 0.3, 0.9, 0.12, color, 0, 0.14, 0, {}, g);
  R(0.8, 0.14, 0.7, 0.06, shade(color, 0.04), 0, 0.42, 0.06, {}, g);
  R(1.0, 0.55, 0.22, 0.1, color, 0, 0.4, -0.36, {}, g);
  for (const s of [-1, 1]) R(0.18, 0.36, 0.9, 0.08, color, s * 0.44, 0.38, 0, {}, g);
  for (const [lx, lz] of [[-0.38, -0.32], [0.38, -0.32], [-0.38, 0.32], [0.38, 0.32]]) C(0.03, 0.02, 0.14, P.oakDark, lx, 0, lz, {}, g, 6);
  return g;
}
function sofa(x, z, ry, color, len = 3) {
  const g = new THREE.Group(); g.position.set(x, 0, z); g.rotation.y = ry; scene.add(g);
  R(len, 0.28, 0.95, 0.1, color, 0, 0.14, 0, {}, g);
  const n = Math.round(len / 1.1);
  for (let i = 0; i < n; i++) R((len - 0.4) / n - 0.04, 0.14, 0.72, 0.06, shade(color, 0.03), -len / 2 + 0.2 + ((len - 0.4) / n) * (i + 0.5), 0.42, 0.08, {}, g);
  R(len, 0.55, 0.24, 0.1, color, 0, 0.4, -0.36, {}, g);
  for (const s of [-1, 1]) R(0.2, 0.38, 0.95, 0.08, color, s * (len / 2 - 0.1), 0.38, 0, {}, g);
  for (const [lx, lz] of [[-len / 2 + 0.2, -0.35], [len / 2 - 0.2, -0.35], [-len / 2 + 0.2, 0.35], [len / 2 - 0.2, 0.35]]) C(0.03, 0.02, 0.14, P.oakDark, lx, 0, lz, {}, g, 6);
  // 抱枕
  R(0.42, 0.38, 0.12, 0.08, P.offwhite, -len / 2 + 0.55, 0.52, -0.18, { rx: -0.25 }, g);
  R(0.42, 0.38, 0.12, 0.08, P.mustard, len / 2 - 0.55, 0.52, -0.18, { rx: -0.25, rz: 0.1 }, g);
  return g;
}
const leafMats = [std(P.leaf, { rough: 0.7 }), std(P.leafDark, { rough: 0.7 }), std('#88ad7f', { rough: 0.7 })];
function plant(x, z, s = 1, pot = P.white, type = 'bush') {
  C(0.26 * s, 0.2 * s, 0.5 * s, pot, x, 0, z, {}, null, 16);
  C(0.24 * s, 0.24 * s, 0.02, '#6d5444', x, 0.49 * s, z, { shadow: false }, null, 16);
  if (type === 'tall') {
    C(0.025 * s, 0.035 * s, 1.1 * s, '#7a5a40', x, 0.5 * s, z, {}, null, 6);
    for (const [dx, dy, dz, r] of [[0, 1.7, 0, 0.42], [0.22, 1.45, 0.1, 0.32], [-0.2, 1.4, -0.08, 0.3], [0.05, 1.98, 0.05, 0.26]])
      S(r * s, leafMats[(dx * 10 | 0) & 1 ? 1 : 0], x + dx * s, dy * s, z + dz * s, {}, null, 10);
  } else {
    for (let i = 0; i < 7; i++) {
      const a = i / 7 * Math.PI * 2, leaf = new THREE.Mesh(new THREE.SphereGeometry(0.1 * s, 8, 6), leafMats[i % 3]);
      leaf.scale.set(1.1, 4, 0.5);
      place(leaf, null, x + Math.cos(a) * 0.14 * s, 0.85 * s, z + Math.sin(a) * 0.14 * s, { ry: -a, rz: 0.45 * Math.cos(a), rx: 0.45 * Math.sin(a) });
      leaf.rotation.order = 'YXZ'; leaf.rotation.set(0.5, -a + Math.PI / 2, 0);
    }
    S(0.18 * s, leafMats[1], x, 0.7 * s, z, {}, null, 10);
  }
}
function pendant(x, z, color = P.charcoal, y = 3.3, r = 0.38) {
  C(0.008, 0.008, 4.5 - y, P.charcoal, x, y + 0.2, z, { shadow: false }, null, 4);
  const shade_ = new THREE.Mesh(new THREE.SphereGeometry(r, 20, 10, 0, Math.PI * 2, 0, Math.PI / 2), std(color, { rough: 0.5, metal: color === P.brass ? 0.6 : 0 }));
  shade_.material.side = THREE.DoubleSide; place(shade_, null, x, y, z, { shadow: false });
  const bm = new THREE.MeshStandardMaterial({ color: '#fff3dc', emissive: '#ffcf8a', emissiveIntensity: 0.4 }); bulbMats.push(bm);
  const b = new THREE.Mesh(new THREE.SphereGeometry(r * 0.32, 12, 8), bm); b.position.set(x, y - 0.02, z); scene.add(b);
}
function floorLamp(x, z) {
  C(0.2, 0.22, 0.04, P.charcoal, x, 0, z, {}, null, 16); C(0.02, 0.02, 1.5, P.charcoal, x, 0, z, {}, null, 6);
  const sh = C(0.18, 0.3, 0.36, P.offwhite, x, 1.45, z, {}, null, 18);
  const bm = new THREE.MeshStandardMaterial({ color: '#fff3dc', emissive: '#ffcf8a', emissiveIntensity: 0.3 }); bulbMats.push(bm);
  const b = new THREE.Mesh(new THREE.SphereGeometry(0.08, 10, 8), bm); b.position.set(x, 1.5, z); scene.add(b);
}
function rug(x, z, w, d, color, border, round = false) {
  const t = canvasTex(512, 512 * d / w | 0, (g, cw, ch) => {
    g.fillStyle = border; if (round) { g.beginPath(); g.ellipse(cw / 2, ch / 2, cw / 2, ch / 2, 0, 0, 7); g.fill(); } else { rr(g, 0, 0, cw, ch, 20); g.fill(); }
    g.fillStyle = color; if (round) { g.beginPath(); g.ellipse(cw / 2, ch / 2, cw / 2 - 22, ch / 2 - 22, 0, 0, 7); g.fill(); } else { rr(g, 18, 18, cw - 36, ch - 36, 12); g.fill(); }
    for (let i = 0; i < 2500; i++) { g.fillStyle = `rgba(${rnd() > 0.5 ? '255,255,255' : '60,50,40'},${rnd() * 0.05})`; g.fillRect(rnd() * cw, rnd() * ch, 2, 2); }
  });
  const m = new THREE.Mesh(new THREE.PlaneGeometry(w, d), new THREE.MeshStandardMaterial({ map: t, transparent: true, roughness: 1 }));
  m.rotation.x = -Math.PI / 2; m.position.set(x, 0.022, z); m.receiveShadow = true; scene.add(m);
}
// 极简墙画
function artTex(v) {
  return canvasTex(384, 480, (g, w, h) => {
    g.fillStyle = '#f3efe8'; g.fillRect(0, 0, w, h);
    if (v === 0) { g.fillStyle = P.terracotta; g.beginPath(); g.arc(w * 0.5, h * 0.42, 95, 0, 7); g.fill(); g.fillStyle = P.sage; g.fillRect(w * 0.18, h * 0.62, w * 0.64, h * 0.2); }
    else if (v === 1) { g.fillStyle = P.dusty; g.beginPath(); g.moveTo(w * 0.2, h * 0.8); g.lineTo(w * 0.2, h * 0.45); g.arc(w * 0.5, h * 0.45, w * 0.3, Math.PI, 0); g.lineTo(w * 0.8, h * 0.8); g.fill(); g.fillStyle = P.mustard; g.beginPath(); g.arc(w * 0.68, h * 0.25, 30, 0, 7); g.fill(); }
    else if (v === 2) { g.strokeStyle = P.charcoal; g.lineWidth = 4; g.beginPath(); g.moveTo(w * 0.15, h * 0.7); g.bezierCurveTo(w * 0.35, h * 0.2, w * 0.6, h * 0.9, w * 0.85, h * 0.3); g.stroke(); g.fillStyle = P.blush; g.beginPath(); g.arc(w * 0.35, h * 0.35, 50, 0, 7); g.fill(); }
    else { g.fillStyle = P.sage; g.beginPath(); g.ellipse(w * 0.4, h * 0.55, 80, 150, 0.3, 0, 7); g.fill(); g.fillStyle = P.oat; g.beginPath(); g.ellipse(w * 0.62, h * 0.5, 70, 120, -0.2, 0, 7); g.fill(); }
  });
}
function art(v, w, h, x, y, z, ry = 0) {
  const g = new THREE.Group(); g.position.set(x, y, z); g.rotation.y = ry; scene.add(g);
  B(w + 0.12, h + 0.12, 0.05, oakMat, 0, -(h + 0.12) / 2, 0, { shadow: false }, g);
  B(w - 0.02, h - 0.02, 0.01, P.white, 0, -(h - 0.02) / 2, 0.026, { shadow: false }, g);
  panel(w * 0.82, h * 0.82, artTex(v), 0, 0, 0.035, { lit: true }, g);
}
function shelf(x, z, ry, w, h, levels, parent) {
  const g = new THREE.Group(); g.position.set(x, 0, z); g.rotation.y = ry; (parent || scene).add(g);
  for (const s of [-1, 1]) B(0.05, h, 0.4, oakMat, s * w / 2, 0, 0, {}, g);
  const bc = [P.terracotta, P.sage, P.dusty, P.oat, P.offwhite, P.charcoal, P.mustard];
  for (let i = 0; i < levels; i++) {
    const y = 0.1 + i * (h - 0.1) / levels; B(w, 0.04, 0.4, oakMat, 0, y, 0, {}, g);
    let bx = -w / 2 + 0.12;
    while (bx < w / 2 - 0.3) {
      if (rnd() < 0.18) { C(0.08, 0.06, 0.26, P.offwhite, bx + 0.1, y + 0.04, 0, {}, g, 10); bx += 0.35; continue; }
      const bw = 0.05 + rnd() * 0.05, bh = 0.24 + rnd() * 0.12; B(bw, bh, 0.26, bc[(rnd() * bc.length) | 0], bx, y + 0.04, 0, {}, g); bx += bw + 0.01;
      if (rnd() < 0.12) bx += 0.25;
    }
  }
  return g;
}


// ---------------- 笔记本电脑（屏幕朝向 -z 方向的使用者） ----------------
function laptop(parent, x, y, z, ry) {
  const g = new THREE.Group(); g.position.set(x, y, z); g.rotation.y = ry; parent.add(g);
  R(0.52, 0.025, 0.36, 0.01, '#c9c6c1', 0, 0, -0.1, { metal: 0.3 }, g);
  R(0.4, 0.004, 0.14, 0.002, '#9d9a95', 0, 0.025, -0.12, { shadow: false }, g);
  const lid = new THREE.Group(); lid.position.set(0, 0.025, 0.08); lid.rotation.x = 0.28; g.add(lid);
  R(0.52, 0.34, 0.016, 0.01, '#c9c6c1', 0, 0, 0, { metal: 0.3 }, lid);
  const sm = new THREE.MeshBasicMaterial({ color: '#2a2c30', toneMapped: false });
  const scr = new THREE.Mesh(new THREE.PlaneGeometry(0.47, 0.29), sm); scr.position.set(0, 0.17, -0.009); scr.rotation.y = Math.PI; lid.add(scr);
  return sm;
}

// 办公小物
function monitor(parent, x, y, z, ry) { // 屏幕朝 +z（局部）
  const g = new THREE.Group(); g.position.set(x, y, z); g.rotation.y = ry; parent.add(g);
  R(0.22, 0.015, 0.16, 0.005, P.charcoal, 0, 0, 0, {}, g); C(0.018, 0.018, 0.22, P.charcoal, 0, 0, -0.03, {}, g, 6);
  R(0.72, 0.42, 0.03, 0.01, P.charcoal, 0, 0.17, -0.02, {}, g);
  const sm = new THREE.MeshBasicMaterial({ color: '#2a2c30', toneMapped: false });
  const scr = new THREE.Mesh(new THREE.PlaneGeometry(0.68, 0.38), sm); scr.position.set(0, 0.38, 0.0); g.add(scr);
  return sm;
}
function deskLamp(parent, x, y, z, ry) {
  const g = new THREE.Group(); g.position.set(x, y, z); g.rotation.y = ry; parent.add(g);
  C(0.07, 0.08, 0.02, P.charcoal, 0, 0, 0, {}, g, 12); C(0.01, 0.01, 0.38, P.charcoal, 0, 0, 0, { rz: 0.25 }, g, 5);
  C(0.04, 0.09, 0.12, P.offwhite, -0.1, 0.33, 0.05, { rx: 0.5 }, g, 12);
}
function cabinet(x, z, ry, w = 0.9, h = 1.2, color = P.offwhite) {
  const g = new THREE.Group(); g.position.set(x, 0, z); g.rotation.y = ry; scene.add(g);
  R(w, h, 0.6, 0.02, color, 0, 0, 0, {}, g);
  const n = Math.round(h / 0.4);
  for (let i = 0; i < n; i++) { B(w - 0.06, 0.005, 0.01, '#c9c3ba', 0, (i + 1) * h / n - 0.01, 0.305, { shadow: false }, g); B(0.18, 0.02, 0.02, P.graphite, 0, (i + 0.6) * h / n, 0.31, { shadow: false }, g); }
  return g;
}

function lightBar(x, z, len, y = 3.0, along = 'x') {
  for (const s of [-1, 1]) C(0.004, 0.004, 4.4 - y, P.charcoal, x + (along === 'x' ? s * len * 0.4 : 0), y + 0.05, z + (along === 'z' ? s * len * 0.4 : 0), { shadow: false }, null, 4);
  R(along === 'x' ? len : 0.1, 0.04, along === 'x' ? 0.1 : len, 0.015, P.offwhite, x, y, z, { shadow: false });
  if (!lightBar.mat) { lightBar.mat = new THREE.MeshStandardMaterial({ color: '#fff6e6', emissive: '#ffd9a0', emissiveIntensity: 0.5 }); bulbMats.push(lightBar.mat); }
  const bm = lightBar.mat;
  const strip = new THREE.Mesh(new THREE.PlaneGeometry(along === 'x' ? len - 0.1 : 0.08, along === 'x' ? 0.08 : len - 0.1), bm); strip.rotation.x = Math.PI / 2; strip.position.set(x, y - 0.002, z); scene.add(strip);
}
// ---------------- 楼层平面：中间走廊，两侧独立房间 ----------------
const FX0 = -28, FX1 = 28, FZ0 = -13, FZ1 = 11, CZ = -1; // 走廊中线 z=-1（走廊 z -3..1）
const BACK = { z0: -13, z1: -3 }, FRONT = { z0: 1, z1: 11 };
const RDEF = [ // id, x0, x1, row, style
  ['boss', -28, -19, 'back', 'solid'], ['director', -19, -13, 'back', 'glass'], ['meeting', -13, -3, 'back', 'glass'],
  ['secretary', -3, 3, 'back', 'glass'], ['design', 3, 9, 'back', 'glass'], ['admin', 9, 15, 'back', 'glass'],
  ['purchasing', 15, 21, 'back', 'glass'], ['spare1', 21, 28, 'back', 'glass'],
  ['tea', -20, -14, 'front', 'glass'], ['lounge', -14, -6, 'front', 'glass'], ['print', -6, 3, 'front', 'glass'],
  ['craft', 3, 14, 'front', 'glass'], ['store', 14, 21, 'front', 'solidside'], ['spare2', 21, 28, 'front', 'glass'],
];
const DEFAULT_NAMES = { boss: '老板办公室', director: '总监室', meeting: '会议室', secretary: '秘书室', design: '设计部', admin: '行政部', purchasing: '采购部',
  spare1: '备用房 1', spare2: '备用房 2', print: '印刷房', craft: '手工房', store: '储物间', tea: '茶水间', lounge: '休息区' };
const ROOMS = {};
for (const [id, x0, x1, row, style] of RDEF) {
  const z = row === 'back' ? BACK : FRONT;
  ROOMS[id] = { id, x0, x1, z0: z.z0, z1: z.z1, row, style, name: DEFAULT_NAMES[id], door: { x: x1 - 1.3 }, cx: (x0 + x1) / 2, seats: [], npcSpots: [] };
}
const doorZ = (r) => r.row === 'back' ? r.z1 : r.z0;
const doorPt = (r, k) => ({ x: r.door.x, z: r.row === 'back' ? r.z1 - k : r.z0 + k }); // k>0 室内，k<0 走廊

B(FX1 - FX0 + 0.6, 0.4, FZ1 - FZ0 + 0.6, P.graphite, 0, -0.42, (FZ0 + FZ1) / 2, { shadow: false });
const floorTexMain = woodTex('#dcc4a1', 64, 0.03); floorTexMain.repeat.set(14, 6);
const floorMain = new THREE.Mesh(new THREE.PlaneGeometry(FX1 - FX0, FZ1 - FZ0), std('#ffffff', { map: floorTexMain, rough: 0.7 }));
floorMain.rotation.x = -Math.PI / 2; floorMain.position.z = (FZ0 + FZ1) / 2; floorMain.receiveShadow = true; scene.add(floorMain);
function floorRect(x0, x1, z0, z1, tex, tile = 4, y = 0.012) {
  const w = x1 - x0, d = z1 - z0; tex.wrapS = tex.wrapT = THREE.RepeatWrapping; tex.repeat.set(w / tile, d / tile);
  const m = new THREE.Mesh(new THREE.PlaneGeometry(w, d), std('#ffffff', { map: tex, rough: 0.9 }));
  m.rotation.x = -Math.PI / 2; m.position.set((x0 + x1) / 2, y, (z0 + z1) / 2); m.receiveShadow = true; scene.add(m); return m;
}
const carpetTex = (tones) => canvasTex(256, 256, (g, w, h) => {
  for (let y = 0; y < 2; y++) for (let x = 0; x < 2; x++) { g.fillStyle = tones[y * 2 + x]; g.fillRect(x * 128, y * 128, 128, 128);
    g.strokeStyle = 'rgba(80,70,60,.05)'; g.lineWidth = 2; for (let k = 6; k < 128; k += 9) { g.beginPath(); if ((x + y) % 2) { g.moveTo(x * 128 + k, y * 128); g.lineTo(x * 128 + k, y * 128 + 128); } else { g.moveTo(x * 128, y * 128 + k); g.lineTo(x * 128 + 128, y * 128 + k); } g.stroke(); } }
  g.fillStyle = 'rgba(60,50,40,.08)'; g.fillRect(0, 0, w, 1.5); g.fillRect(0, 0, 1.5, h); g.fillRect(0, 128, w, 1.5); g.fillRect(128, 0, 1.5, h);
});
const CARPET_A = ['#c9c4bc', '#c3beb6', '#cdc8c0', '#c6c1b9'], CARPET_B = ['#bfc6c0', '#b9c0ba', '#c4cbc5', '#bcc3bd'];
const floorOf = { boss: () => woodTex('#a98466', 64, 0.03), director: () => carpetTex(CARPET_A), meeting: () => carpetTex(CARPET_A),
  secretary: () => carpetTex(CARPET_B), design: () => carpetTex(CARPET_A), admin: () => carpetTex(CARPET_B), purchasing: () => carpetTex(CARPET_A),
  spare1: () => carpetTex(CARPET_B), spare2: () => carpetTex(CARPET_B), tea: () => tileTex('#ebe6de', '#d4ccc0'), lounge: null,
  print: () => concreteTex('#d9d5cf'), craft: () => woodTex('#e3cfb0', 64, 0.03), store: () => concreteTex('#d3cfc8') };
for (const r of Object.values(ROOMS)) { const f = floorOf[r.id]; if (f) floorRect(r.x0, r.x1, r.z0, r.z1, f(), r.id === 'tea' ? 1.0 : (r.id === 'boss' || r.id === 'craft' ? 4 : 2.4)); }
floorRect(FX0, FX1, -3, 1, woodTex('#e2cfb1', 64, 0.02), 4, 0.008); // 走廊

// 外墙
const WALL_TOP = WALL_H;
const wallMat = std(P.white, { rough: 0.95 });
B(FX1 - FX0 + 0.3, WALL_TOP, 0.3, wallMat, 0, 0, FZ0 - 0.15);
B(0.3, WALL_TOP, FZ1 - FZ0 + 0.3, wallMat, FX0 - 0.15, 0, (FZ0 + FZ1) / 2);
B(0.3, WALL_TOP, FZ1 - FZ0 + 0.3, wallMat, FX1 + 0.15, 0, (FZ0 + FZ1) / 2);
B(FX1 - FX0, 0.12, 0.05, P.oakDark, 0, 0, FZ0 + 0.02, { shadow: false });
// 前墙（剖切矮墙，接待处留入口）
const ENTR = -24;
B(ENTR - 1.1 - FX0, 1.0, 0.22, wallMat, (FX0 + ENTR - 1.1) / 2, 0, FZ1);
B(FX1 - ENTR - 1.1, 1.0, 0.22, wallMat, (FX1 + ENTR + 1.1) / 2, 0, FZ1);
B(FX1 - ENTR - 1.1, 0.04, 0.28, oakMat, (FX1 + ENTR + 1.1) / 2, 1.0, FZ1, { shadow: false });
B(ENTR - 1.1 - FX0, 0.04, 0.28, oakMat, (FX0 + ENTR - 1.1) / 2, 1.0, FZ1, { shadow: false });
// 窗
windowAt('back', -23.5, 3.6); windowAt('left', -8, 3.0);
windowAt('back', -16, 2.4); windowAt('back', -11.6, 1.6); windowAt('back', -4.4, 1.6);
for (const id of ['secretary', 'design', 'admin', 'purchasing']) windowAt('back', ROOMS[id].cx, 2.6);
windowAt('back', 24.5, 3.2); windowAt('right', -8, 3.0); windowAt('right', 6, 3.0);
windowAt('left', 6, 3.0);

// ---------------- 隔墙 / 门 / 门牌 ----------------
const DOOR_W = 1.4;
const BOSS_WALL = std('#ddd5ca', { rough: 0.95 }), STORE_WALL = std('#e6e2dc', { rough: 0.95 });
const builtWalls = new Set();
function doorLeaf(r) {
  const x = r.door.x, z = doorZ(r), W = DOOR_W, inward = r.row === 'back' ? -1 : 1;
  B(0.07, 2.3, 0.22, P.charcoal, x - W / 2, 0, z, { shadow: false }); B(0.07, 2.3, 0.22, P.charcoal, x + W / 2, 0, z, { shadow: false });
  const pivot = new THREE.Group(); pivot.position.set(x + W / 2 - 0.04, 0, z); scene.add(pivot);
  if (r.style === 'solid') B(W - 0.1, 2.25, 0.05, std('#ffffff', { map: grainTex('#8a6447'), rough: 0.55 }), -(W - 0.1) / 2, 0, 0, {}, pivot);
  else {
    const leaf = new THREE.Mesh(new THREE.BoxGeometry(W - 0.1, 2.25, 0.03), glassMat); leaf.position.set(-(W - 0.1) / 2, 1.125, 0); pivot.add(leaf);
    for (const y of [0, 2.2]) B(W - 0.1, 0.05, 0.05, P.charcoal, -(W - 0.1) / 2, y, 0, { shadow: false }, pivot);
    for (const xx of [-0.03, -(W - 0.13)]) B(0.05, 2.25, 0.05, P.charcoal, xx, 0, 0, { shadow: false }, pivot);
  }
  B(0.03, 0.45, 0.05, P.brass, -(W - 0.35), 0.85, 0.06 * -inward, { shadow: false }, pivot);
  pivot.rotation.y = 1.25 * inward;
}
function buildRoom(r) {
  const H = WALL_TOP, W = DOOR_W, dz = doorZ(r);
  const solidMat = r.style === 'solid' ? BOSS_WALL : STORE_WALL;
  // 侧墙（与相邻房间共用，避免重复）
  for (const x of [r.x0, r.x1]) {
    if (x <= FX0 || x >= FX1) continue;
    const key = x + '|' + r.row; if (builtWalls.has(key)) continue; builtWalls.add(key);
    if (r.style === 'solid' || r.style === 'solidside') solidSeg(x, r.z0, x, r.z1, H, solidMat); else glassSeg(x, r.z0, x, r.z1, H);
  }
  // 走廊侧墙 + 门
  const segs = [[r.x0, dz, r.door.x - W / 2, dz], [r.door.x + W / 2, dz, r.x1, dz]];
  for (const [x1, z1, x2, z2] of segs) {
    if (r.style === 'solid') { solidSeg(x1, z1, x2, z2, 1.05, BOSS_WALL); glassSeg(x1, z1, x2, z2, H); }
    else glassSeg(x1, z1, x2, z2, H);
  }
  if (r.style === 'solid') solidSeg(r.door.x - W / 2, dz, r.door.x + W / 2, dz, H - 2.3, BOSS_WALL, 2.3);
  else B(W, H - 2.3, 0.07, P.charcoal, r.door.x, 2.3, dz, { shadow: false });
  doorLeaf(r);
  // 门牌（名称可在 data/office.json 的 rooms 中修改）
  const tex = canvasTex(512, 128, () => {}); const sm = new THREE.MeshBasicMaterial({ map: tex, toneMapped: false }), side = std(P.charcoal);
  const sign = new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.42, 0.05), [side, side, side, side, sm, sm]);
  sign.position.set(r.cx < r.door.x - 1.5 ? r.door.x - 2.1 : r.cx, 2.65, dz + (r.row === 'back' ? 0.13 : -0.13)); scene.add(sign);
  r.signTex = tex; drawSign(r);
}
function drawSign(r) {
  const g = r.signTex.userData.ctx, w = 512, h = 128;
  g.clearRect(0, 0, w, h); g.fillStyle = P.charcoal; rr(g, 0, 0, w, h, 18); g.fill();
  g.font = `600 ${r.name.length > 5 ? 46 : 54}px ${FONT}`; g.fillStyle = '#f5f3ef'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(fitText(g, r.name, 470), w / 2, h / 2 + 2);
  r.signTex.needsUpdate = true;
}
function updateRoomNames(map) {
  for (const r of Object.values(ROOMS)) { const n = (map && map[r.id]) || DEFAULT_NAMES[r.id]; if (n !== r.name) { r.name = n; drawSign(r); } }
}
for (const id of ['boss', 'store']) buildRoom(ROOMS[id]);
for (const r of Object.values(ROOMS)) if (r.id !== 'boss' && r.id !== 'store') buildRoom(r);
// ---------------- 通用：工位 / 货架 ----------------
function deskUnit(x, z, o = {}) { // 人坐在 (x,z) 面朝 +z，桌子在前方
  const g = new THREE.Group(); g.position.set(x, 0, z + 1.0); scene.add(g);
  R(1.5, 0.05, 0.8, 0.02, o.top || oakMat, 0, 0.72, 0, {}, g);
  for (const s of [-1, 1]) B(0.05, 0.72, 0.7, P.white, s * 0.7, 0, 0, {}, g);
  B(1.35, 0.32, 0.02, P.white, 0, 0.38, 0.3, { shadow: false }, g);
  let screen;
  if (o.laptop) screen = laptop(g, 0, 0.77, -0.15, 0);
  else { screen = monitor(g, 0, 0.77, 0.16, Math.PI); R(0.42, 0.015, 0.14, 0.005, '#d9d6d1', 0, 0.77, -0.16, { shadow: false }, g); }
  if (o.dual) monitor(g, -0.5, 0.77, 0.1, Math.PI - 0.4).color.set('#cfd9e2');
  if (o.lamp) deskLamp(g, 0.55, 0.77, 0.15, -0.4);
  if (o.plant) { C(0.06, 0.05, 0.1, P.white, -0.58, 0.77, 0.2, {}, g, 10); S(0.09, leafMats[(x * 7 | 0) & 1], -0.58, 0.94, 0.2, {}, g, 8); }
  if (o.papers) { B(0.24, 0.03, 0.32, P.white, 0.5, 0.77, -0.05, { ry: 0.2, shadow: false }, g); B(0.22, 0.04, 0.3, '#f2efe9', -0.5, 0.77, -0.1, { ry: -0.15, shadow: false }, g); }
  chair(x, z, 0, o.chair || P.charcoal, null, { office: true });
  return { x, z, ry: 0, screen, pose: 'sit' };
}
const BOX_C = ['#c9a27a', '#bf9670', '#d1ad86'];
function rack(x, z, ry, w, h, levels, fill) { // 金属货架，正面朝 +z（局部）
  const g = new THREE.Group(); g.position.set(x, 0, z); g.rotation.y = ry; scene.add(g);
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) B(0.05, h, 0.05, P.graphite, sx * (w / 2 - 0.03), 0, sz * 0.25, {}, g);
  for (let i = 0; i < levels; i++) {
    const y = 0.12 + i * (h - 0.2) / (levels - 1 || 1); B(w, 0.03, 0.56, '#9aa0a6', 0, y, 0, {}, g);
    if (i === levels - 1 && fill !== 'bins') continue;
    let bx = -w / 2 + 0.1;
    while (bx < w / 2 - 0.35) {
      if (fill === 'boxes') { const bw = 0.38 + rnd() * 0.2, bh = 0.25 + rnd() * 0.18; B(bw, bh, 0.42, BOX_C[(rnd() * 3) | 0], bx + bw / 2, y + 0.03, 0, {}, g); B(bw + 0.005, 0.03, 0.06, '#e8dcc6', bx + bw / 2, y + 0.03 + bh - 0.02, 0, { shadow: false }, g); bx += bw + 0.05; }
      else if (fill === 'rolls') { const r_ = 0.07 + rnd() * 0.03; C(r_, r_, 0.5, ['#f2efe9', '#e9d8c4', '#dfe7ea', '#ead9d9'][(rnd() * 4) | 0], bx + r_, y + 0.03 + r_ - 0.25, 0, { rx: Math.PI / 2 }, g, 10); bx += r_ * 2 + 0.02; }
      else if (fill === 'paper') { const bw = 0.32; B(bw, 0.2 + rnd() * 0.15, 0.42, rnd() < 0.7 ? '#f4f2ee' : '#dfe6ec', bx + bw / 2, y + 0.03, 0, {}, g); bx += bw + 0.04; }
      else if (fill === 'bins') { const bw = 0.36; B(bw, 0.22, 0.44, [P.terracotta, P.sage, P.mustard, P.dusty, P.blush][(rnd() * 5) | 0], bx + bw / 2, y + 0.03, 0.02, {}, g); bx += bw + 0.05; }
      else break;
    }
  }
  return g;
}
function stool(x, z, color = P.oak) { C(0.2, 0.2, 0.05, color === P.oak ? oakMat : color, x, 0.4, z, {}, null, 16); for (const a of [0.6, 2.7, 4.8]) C(0.018, 0.018, 0.42, P.charcoal, x + Math.cos(a) * 0.13, 0, z + Math.sin(a) * 0.13, { rx: Math.sin(a) * 0.12, rz: -Math.cos(a) * 0.12, shadow: false }, null, 5); }
const ROLE_COL = (s, i) => (i === 0 ? { col: 0 } : {});

// ---------------- 老板办公室 ----------------
const BOSS_SEAT = { x: -23.5, z: -10.6 };
rug(-23.5, -8.4, 5.6, 4.6, '#d3c6b4', '#bfae98');
R(3.0, 0.07, 1.25, 0.02, walnutMat, -23.5, 0.74, -9.6);
B(0.07, 0.74, 1.1, P.charcoal, -24.9, 0, -9.6); B(0.07, 0.74, 1.1, P.charcoal, -22.1, 0, -9.6); B(2.7, 0.45, 0.03, P.charcoal, -23.5, 0.25, -9.05);
laptop(scene, -23.7, 0.81, -9.75, 0).color.set('#dfe7ec');
C(0.07, 0.09, 0.02, P.brass, -22.5, 0.81, -9.9, {}, null, 12); C(0.01, 0.01, 0.38, P.brass, -22.5, 0.82, -9.9, {}, null, 6); C(0.05, 0.12, 0.11, P.brass, -22.5, 1.18, -9.9, {}, null, 14);
C(0.05, 0.045, 0.1, P.offwhite, -24.6, 0.81, -9.4, {}, null, 10);
chair(BOSS_SEAT.x, BOSS_SEAT.z, 0, '#3a3634', null, { office: true });
shelf(-19.35, -9.0, -Math.PI / 2, 3.4, 2.4, 4);
armchair(-26.6, -5.0, Math.PI * 0.8, P.terracotta); armchair(-24.4, -4.9, -Math.PI * 0.85, P.terracotta);
C(0.38, 0.38, 0.04, oakMat, -25.5, 0.42, -5.8, {}, null, 22); C(0.03, 0.03, 0.42, P.charcoal, -25.5, 0, -5.8, {}, null, 6);
plant(-27.4, -12.4, 1.2, P.charcoal, 'tall'); plant(-19.7, -12.4, 0.9, P.white); plant(-27.4, -3.6, 1.0, P.white);
art(1, 0.9, 1.15, -27.97, 2.4, -11.3, Math.PI / 2);
{ const t = canvasTex(512, 160, (g, w, h) => { g.fillStyle = P.brass; rr(g, 0, 0, w, h, 16); g.fill(); g.strokeStyle = 'rgba(60,40,20,.35)'; g.lineWidth = 4; rr(g, 10, 10, w - 20, h - 20, 10); g.stroke();
    g.font = `600 64px ${FONT}`; g.fillStyle = '#3b2e22'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('Eldon 老板', w / 2, h / 2 + 2); });
  ROOMS.boss.plaque = panel(1.15, 0.36, t, -21.7, 0.62, -2.88, { lit: true }); }

// ---------------- 总监室 ----------------
rug(-16, -8.6, 4.4, 3.6, '#e4ddd2', '#cfc5b6');
R(2.4, 0.07, 1.1, 0.02, oakMat, -16, 0.74, -9.6);
for (const sx of [-1.1, 1.1]) B(0.06, 0.74, 0.95, P.white, -16 + sx, 0, -9.6);
const dirScreen = laptop(scene, -16, 0.81, -9.75, 0);
chair(-16, -10.6, 0, P.charcoal, null, { office: true });
chair(-16.7, -8.0, Math.PI, P.dusty); chair(-15.3, -8.0, Math.PI, P.dusty);
cabinet(-13.7, -12.4, 0, 1.0, 0.8, oakMat);
plant(-18.4, -12.4, 1.0, P.offwhite, 'tall'); floorLamp(-18.4, -4.0);
const boardTex = canvasTex(1024, 512, () => {});
{ const g = new THREE.Group(); g.position.set(-18.86, 2.6, -8.4); g.rotation.y = Math.PI / 2; scene.add(g);
  B(3.6, 1.8, 0.04, P.charcoal, 0, -0.9, 0, { shadow: false }, g); panel(3.5, 1.7, boardTex, 0, 0, 0.025, {}, g); }
ROOMS.director.seats.push({ x: -16, z: -10.6, ry: 0, pose: 'sit', screen: dirScreen, via: [{ x: -14.4, z: -10.6 }] });

// ---------------- 会议室 ----------------
floorRect(-11.6, -4.4, -10.0, -5.6, canvasTex(8, 8, (g) => { g.fillStyle = '#b9b2a6'; g.fillRect(0, 0, 8, 8); }), 9, 0.016);
R(5.4, 0.07, 1.7, 0.03, oakMat, -8, 0.74, -7.8);
for (const sx of [-1.9, 1.9]) R(0.1, 0.74, 1.1, 0.03, P.white, -8 + sx, 0, -7.8);
for (let i = 0; i < 4; i++) { chair(-10.1 + i * 1.4, -9.05, 0, i % 2 ? P.sage : P.charcoal); chair(-10.1 + i * 1.4, -6.55, Math.PI, i % 2 ? P.charcoal : P.sage); }
chair(-11.25, -7.8, Math.PI / 2, P.terracotta); chair(-4.75, -7.8, -Math.PI / 2, P.terracotta);
for (let i = 0; i < 3; i++) R(0.3, 0.01, 0.22, 0.005, P.white, -9.4 + i * 1.6, 0.81, -7.7, { ry: i * 0.3, shadow: false });
const btcTex = canvasTex(1024, 576, () => {});
R(4.9, 2.8, 0.08, 0.03, '#1e1f22', -8, 0.48, -12.92);
panel(4.75, 2.66, btcTex, -8, 1.88, -12.86);
B(4.0, 0.45, 0.4, oakMat, -8, 0, -12.6);
plant(-12.4, -3.7, 1.0, P.white, 'tall'); plant(-3.6, -12.4, 0.9, P.charcoal);
// ---------------- 部门房间（秘书室 / 设计部 / 行政部 / 采购部 / 备用房） ----------------
function deptDesks(id, opts, n = 2) {
  const r = ROOMS[id], xs = n === 2 ? [r.cx - 1.5, r.cx + 1.5] : [r.cx - 2.1, r.cx, r.cx + 2.1];
  const z = r.row === 'back' ? -9.6 : 4.0;
  xs.forEach((x, i) => {
    const s = deskUnit(x, z, opts);
    const side = x < r.cx ? 0.95 : (x > r.cx ? -0.95 : 0.95);
    s.via = r.row === 'back' ? [{ x: x + side, z }, { x: x + side, z: z + 1.75 }] : [];
    if (i === 0) s.col = 0; if (n === 3 && i === 2) s.col = 0;
    r.seats.push(s);
  });
  lightBar(r.cx, z + 1.0, 4.2, 2.95);
}
{ // 秘书室
  const r = ROOMS.secretary; deptDesks('secretary', { lamp: true, papers: true, chair: '#7a4b55' });
  cabinet(r.x0 + 0.4, -6.4, Math.PI / 2, 0.9, 1.25); cabinet(r.x0 + 0.4, -5.45, Math.PI / 2, 0.9, 1.25);
  R(0.6, 0.3, 0.5, 0.04, P.offwhite, r.x0 + 0.4, 1.25, -5.45, { ry: Math.PI / 2 }); B(0.05, 0.02, 0.36, P.charcoal, r.x0 + 0.68, 1.42, -5.45, { shadow: false });
  cabinet(r.cx, -12.6, 0, 2.2, 0.62, oakMat); plant(r.x0 + 0.5, -12.4, 1.0, P.white, 'tall');
  C(0.05, 0.04, 0.1, P.terracotta, r.cx + 0.6, 0.62, -12.6, {}, null, 10); S(0.18, leafMats[1], r.cx - 0.6, 0.86, -12.6, {}, null, 10);
  plant(r.x0 + 0.5, -3.6, 0.8, P.offwhite);
}
{ // 设计部
  const r = ROOMS.design; deptDesks('design', { dual: true, plant: true, chair: '#5b4a6b' });
  const g = new THREE.Group(); g.position.set(r.x0 + 1.6, 0, -5.3); g.rotation.y = 0.35; scene.add(g);
  for (const s of [-1, 1]) B(0.04, 1.9, 0.04, P.graphite, s * 0.8, 0, 0, {}, g);
  R(1.7, 1.15, 0.04, 0.02, '#e9e3da', 0, 0.75, 0, {}, g);
  const mt = canvasTex(512, 340, (gg, w, h) => { gg.fillStyle = '#efe9df'; gg.fillRect(0, 0, w, h);
    const cs = [P.terracotta, P.sage, P.dusty, P.mustard, P.blush, '#7a6a8a'];
    cs.forEach((c, i) => { gg.fillStyle = c; gg.fillRect(30 + i * 74, 30, 60, 60); });
    gg.fillStyle = '#fff'; gg.fillRect(30, 120, 200, 180); gg.fillStyle = P.dusty; gg.beginPath(); gg.arc(130, 210, 60, 0, 7); gg.fill();
    gg.fillStyle = '#fff'; gg.fillRect(260, 120, 220, 110); gg.fillStyle = P.terracotta; gg.fillRect(280, 140, 90, 70); gg.fillStyle = P.sage; gg.fillRect(380, 160, 80, 50);
    gg.font = `700 44px ${FONT}`; gg.fillStyle = P.charcoal; gg.fillText('Aa 字体', 270, 285); });
  panel(1.6, 1.06, mt, 0, 1.33, 0.025, { lit: true }, g);
  cabinet(r.cx, -12.6, 0, 2.4, 0.62, P.white); plant(r.x1 - 0.5, -12.4, 1.1, P.charcoal, 'tall');
  for (let i = 0; i < 3; i++) C(0.04, 0.035, 0.14, [P.terracotta, P.dusty, P.mustard][i], r.cx - 0.6 + i * 0.25, 0.62, -12.6, {}, null, 8);
  armchair(r.x1 - 1.6, -5.0, -Math.PI * 0.85, P.mustard);
}
{ // 行政部
  const r = ROOMS.admin; deptDesks('admin', { lamp: true, chair: '#3d5670' });
  cabinet(r.x0 + 0.5, -12.6, 0, 0.9, 1.6); cabinet(r.x0 + 1.45, -12.6, 0, 0.9, 1.6);
  R(1.0, 1.0, 0.75, 0.04, P.offwhite, r.x0 + 0.55, 0, -5.2, { ry: Math.PI / 2 }); R(0.9, 0.2, 0.7, 0.03, '#d8d4ce', r.x0 + 0.55, 1.0, -5.2, { ry: Math.PI / 2 }); B(0.05, 0.05, 0.6, P.charcoal, r.x0 + 1.1, 0.62, -5.2, { shadow: false });
  C(0.22, 0.22, 1.1, P.dusty, r.x1 - 0.45, 0, -12.5, {}, null, 14); C(0.18, 0.18, 0.4, '#d7e8ee', r.x1 - 0.45, 1.1, -12.5, {}, null, 14);
  { const g = new THREE.Group(); g.position.set(r.x0 + 0.08, 1.55, -8.6); g.rotation.y = Math.PI / 2; scene.add(g);
    R(1.9, 1.1, 0.03, 0.02, P.white, 0, 0, 0, {}, g);
    const ct = canvasTex(512, 300, (gg, w, h) => { gg.fillStyle = '#fbfbf9'; gg.fillRect(0, 0, w, h); gg.font = `600 34px ${FONT}`; gg.fillStyle = P.charcoal; gg.fillText('本月行政', 24, 50);
      for (let i = 0; i < 4; i++) { gg.fillStyle = [P.sage, P.mustard, P.dusty, P.blush][i]; gg.fillRect(24, 80 + i * 52, 26, 26); gg.fillStyle = '#6a6d72'; gg.font = `400 28px ${FONT}`; gg.fillText(['会议室预订', '办公用品盘点', '访客登记', '月度报销'][i], 66, 102 + i * 52); } });
    panel(1.8, 1.0, ct, 0, 0.55, 0.02, {}, g); }
  plant(r.x0 + 0.5, -3.6, 0.9, P.white);
}
{ // 采购部
  const r = ROOMS.purchasing; deptDesks('purchasing', { papers: true, chair: '#456b52' });
  rack(r.x0 + 0.4, -5.6, Math.PI / 2, 2.2, 1.8, 3, 'boxes');
  for (const [dx, dz, s, y] of [[1.6, -3.7, 0.5, 0], [2.25, -3.75, 0.42, 0], [1.65, -3.7, 0.36, 0.4]]) B(s, s * 0.8, s, BOX_C[(dx * 10 | 0) % 3], r.x0 + dx, y, dz, { ry: dx * 0.3 });
  cabinet(r.cx, -12.6, 0, 2.2, 0.62, oakMat); plant(r.x1 - 0.5, -12.4, 1.0, P.white, 'tall');
  { const g = new THREE.Group(); g.position.set(r.cx + 0.3, 0.62, -12.6); scene.add(g); B(0.3, 0.22, 0.25, BOX_C[0], 0, 0, 0, {}, g); B(0.22, 0.3, 0.12, P.terracotta, 0.4, 0, 0, {}, g); }
}
for (const id of ['spare1', 'spare2']) {
  const r = ROOMS[id]; deptDesks(id, { laptop: true, chair: '#8a8f96' }, 3);
  r.seats.forEach(s => s.screen.color.set('#2a2c30'));
  if (r.row === 'back') { plant(r.x0 + 0.5, -12.4, 1.0, P.white, 'tall'); plant(r.x1 - 0.5, -3.7, 0.9, P.charcoal); cabinet(r.cx, -12.6, 0, 2.0, 0.62, P.white); }
  else { plant(r.x0 + 0.5, 10.3, 1.0, P.white, 'tall'); plant(r.x1 - 0.5, 10.3, 0.9, P.charcoal); rug(r.cx, 8.3, 3.2, 2.0, '#e5ddcf', '#d3c6b3'); }
}
// ---------------- 茶水间 ----------------
const REST_SPOTS = [];
{ const r = ROOMS.tea, X = r.x0 + 0.42;
  R(0.62, 0.88, 4.4, 0.02, P.white, X, 0, 6.4); R(0.68, 0.05, 4.5, 0.01, oakMat, X, 0.88, 6.4);
  for (let i = 0; i < 5; i++) B(0.01, 0.78, 0.01, P.greige, X + 0.32, 0.05, 4.5 + i * 0.95, { shadow: false });
  R(0.4, 0.5, 0.45, 0.04, P.charcoal, X - 0.05, 0.93, 4.7); C(0.04, 0.04, 0.07, P.offwhite, X + 0.2, 0.95, 4.7, {}, null, 10);
  C(0.11, 0.09, 0.22, '#c7c2bb', X, 0.93, 5.5, { metal: 0.5 }, null, 14);
  B(0.4, 0.02, 0.6, '#c7c2bb', X, 0.93, 7.6, { metal: 0.5, shadow: false });
  for (let i = 0; i < 4; i++) C(0.05, 0.04, 0.1, [P.offwhite, P.sage, P.terracotta, P.dusty][i], X - 0.1, 0.93, 6.0 + i * 0.22, {}, null, 10);
  S(0.22, P.offwhite, X, 1.0, 6.9, {}, null, 12).scale.set(1, 0.4, 1);
  R(0.85, 2.0, 0.75, 0.05, P.offwhite, r.x0 + 0.5, 0, 2.0); B(0.03, 0.6, 0.03, P.graphite, r.x0 + 0.9, 1.0, 2.35, { shadow: false });
  const tx = r.cx + 0.6, tz = 6.4;
  C(0.5, 0.5, 0.04, P.white, tx, 0.72, tz, {}, null, 26); C(0.03, 0.03, 0.72, P.charcoal, tx, 0, tz, {}, null, 8); C(0.22, 0.22, 0.02, P.charcoal, tx, 0, tz, {}, null, 16);
  chair(tx - 1.0, tz, Math.PI / 2, oakMat); chair(tx + 1.0, tz, -Math.PI / 2, oakMat); chair(tx, tz - 1.0, 0, oakMat);
  C(0.05, 0.04, 0.1, P.terracotta, tx + 0.1, 0.76, tz - 0.1, {}, null, 10);
  plant(r.x1 - 0.5, 10.3, 0.9, P.white); C(0.22, 0.22, 1.1, P.dusty, r.x1 - 0.5, 0, 8.6, {}, null, 14); C(0.18, 0.18, 0.4, '#d7e8ee', r.x1 - 0.5, 1.1, 8.6, {}, null, 14);
  REST_SPOTS.push({ x: tx - 1.0, z: tz, ry: Math.PI / 2, room: 'tea', pose: 'sit' }, { x: tx + 1.0, z: tz, ry: -Math.PI / 2, room: 'tea', pose: 'sit' },
    { x: tx, z: tz - 1.0, ry: 0, room: 'tea', pose: 'sit' }, { x: X + 0.75, z: 5.2, ry: -Math.PI / 2, room: 'tea', pose: 'stand' });
  lightBar(r.cx, 6.4, 3.0, 2.95, 'z');
}
// ---------------- 休息区 ----------------
{ const r = ROOMS.lounge, tx = r.cx - 1.0, tz = 6.0;
  rug(tx + 0.4, tz, 5.6, 5.0, '#e9e1d4', '#d6c9b6', true);
  sofa(r.x0 + 0.65, tz, Math.PI / 2, P.sage, 3.4);
  armchair(r.cx + 1.8, tz - 1.4, -1.07, P.dusty); armchair(r.cx + 1.8, tz + 1.4, -2.1, P.dusty);
  C(0.7, 0.7, 0.05, oakMat, tx, 0.36, tz, {}, null, 26); C(0.55, 0.55, 0.36, P.offwhite, tx, 0, tz, {}, null, 26);
  C(0.1, 0.09, 0.16, P.terracotta, tx + 0.1, 0.41, tz - 0.1, {}, null, 12); B(0.36, 0.04, 0.26, P.dusty, tx - 0.2, 0.41, tz + 0.2, { ry: 0.3 });
  shelf(r.cx - 1.2, r.z0 + 0.35, 0, 2.4, 1.6, 3);
  plant(r.x0 + 0.5, 1.6, 1.2, P.white, 'tall'); plant(r.x1 - 0.5, 10.3, 1.0, P.charcoal); floorLamp(r.x0 + 0.5, 9.4);
  pendant(tx, tz, P.brass, 3.0, 0.36);
  for (const dz of [-0.95, 0, 0.95]) REST_SPOTS.push({ x: r.x0 + 0.9, z: tz + dz, ry: Math.PI / 2, room: 'lounge', pose: 'sit', sy: 0.0 });
  REST_SPOTS.push({ x: r.cx + 1.8, z: tz - 1.4, ry: -1.07, room: 'lounge', pose: 'sit', sy: 0.0 }, { x: r.cx + 1.8, z: tz + 1.4, ry: -2.1, room: 'lounge', pose: 'sit', sy: 0.0 },
    { x: r.x1 - 1.4, z: 9.2, ry: -2.6, room: 'lounge', pose: 'stand' });
}
// 重排：茶水间与休息区交替，先坐沙发
REST_SPOTS.sort((a, b) => (a.room === 'lounge' ? 0 : 1) - (b.room === 'lounge' ? 0 : 1));

// ---------------- 印刷房 ----------------
function npcSpot(room, s) { ROOMS[room].npcSpots.push(s); return s; }
{ const r = ROOMS.print, px = r.x0 + 3.6, pz = 9.3;
  // 大幅面写真机
  for (const s of [-1, 1]) { B(0.08, 0.62, 0.7, P.graphite, px + s * 1.7, 0, pz, {}); B(0.1, 0.04, 0.8, P.graphite, px + s * 1.7, 0, pz, { shadow: false }); }
  B(3.4, 0.05, 0.08, P.graphite, px, 0.3, pz, { shadow: false });
  R(3.8, 0.5, 0.78, 0.08, P.offwhite, px, 0.62, pz);
  R(3.3, 0.12, 0.5, 0.05, P.charcoal, px, 1.1, pz - 0.05);
  R(0.5, 0.35, 0.6, 0.06, '#e2ded7', px + 1.6, 1.08, pz);
  C(0.12, 0.12, 3.3, '#f4f2ee', px, 1.22 - 1.65, pz - 0.45, { rz: Math.PI / 2 }, null, 14);
  const scr = new THREE.MeshBasicMaterial({ color: '#7fc4d9', toneMapped: false });
  const sp = new THREE.Mesh(new THREE.PlaneGeometry(0.34, 0.18), scr); sp.position.set(px + 1.6, 1.3, pz - 0.31); sp.rotation.y = Math.PI; scene.add(sp);
  const pt = canvasTex(512, 256, (g, w, h) => { g.fillStyle = '#f6f3ee'; g.fillRect(0, 0, w, h); g.fillStyle = P.terracotta; g.beginPath(); g.arc(120, 128, 80, 0, 7); g.fill();
    g.fillStyle = P.dusty; g.fillRect(230, 50, 230, 60); g.fillStyle = P.mustard; g.fillRect(230, 130, 160, 60); g.font = `700 40px ${FONT}`; g.fillStyle = P.charcoal; g.fillText('SALE', 400, 180); });
  const banner = panel(2.6, 0.9, pt, px - 0.2, 0.55, pz + 0.42, { lit: true }); banner.rotation.x = -0.25;
  // 纸张货架 + 成品推车
  rack(r.x0 + 0.42, 5.4, Math.PI / 2, 2.6, 2.0, 4, 'paper');
  R(1.0, 0.04, 0.6, 0.01, P.graphite, r.x0 + 0.8, 0.55, 2.4, { shadow: false }); for (const sx of [-1, 1]) B(0.04, 0.55, 0.04, P.graphite, r.x0 + 0.8 + sx * 0.45, 0, 2.4, { shadow: false });
  for (let i = 0; i < 4; i++) B(0.6, 0.06, 0.42, ['#f4f2ee', '#e9d8c4', '#dfe7ea', '#f4f2ee'][i], r.x0 + 0.8, 0.59 + i * 0.06, 2.4, { ry: i * 0.06, shadow: false });
  // 复印机
  R(1.0, 1.0, 0.75, 0.04, P.offwhite, r.x1 - 0.5, 0, 4.2, { ry: -Math.PI / 2 }); R(0.9, 0.2, 0.7, 0.03, '#d8d4ce', r.x1 - 0.5, 1.0, 4.2, { ry: -Math.PI / 2 }); B(0.05, 0.05, 0.6, P.charcoal, r.x1 - 1.05, 0.62, 4.2, { shadow: false });
  // 裁切台
  const cx = r.x1 - 2.0, cz = 7.4;
  R(1.9, 0.06, 1.0, 0.02, P.white, cx, 0.86, cz); R(1.7, 0.012, 0.85, 0.005, '#5f8f6e', cx, 0.92, cz, { shadow: false });
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) B(0.05, 0.86, 0.05, P.graphite, cx + sx * 0.85, 0, cz + sz * 0.42, { shadow: false });
  B(1.6, 0.02, 0.05, '#c9ccd0', cx, 0.93, cz + 0.05, { ry: 0.15, metal: 0.6, shadow: false }); B(0.6, 0.012, 0.42, '#f4f2ee', cx - 0.3, 0.93, cz - 0.05, { shadow: false });
  const d1 = deskUnit(r.x0 + 2.0, 2.9, { papers: true }), d2 = deskUnit(r.x0 + 4.4, 2.9, { lamp: true });
  npcSpot('print', { x: px - 0.4, z: pz - 1.15, ry: 0, pose: 'stand', act: 'operate' });
  npcSpot('print', { ...d1, act: 'type' });
  npcSpot('print', { x: cx, z: cz - 0.85, ry: 0, pose: 'stand', act: 'cut' });
  npcSpot('print', { ...d2, act: 'type', col: 0 });
  lightBar(r.cx, 6.0, 4.4, 3.15);
}
// ---------------- 手工房 ----------------
{ const r = ROOMS.craft, tz = 6.0;
  const tools = [P.terracotta, P.sage, P.mustard, P.dusty, P.blush, '#7a6a8a'];
  [r.x0 + 3.0, r.x1 - 3.0].forEach((tx, ti) => {
    R(4.0, 0.07, 1.4, 0.02, oakMat, tx, 0.74, tz);
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) B(0.07, 0.74, 0.07, P.charcoal, tx + sx * 1.85, 0, tz + sz * 0.6);
    for (let k = -1; k <= 1; k++) {
      const x = tx + k * 1.32; stool(x, tz - 1.25);
      B(0.5, 0.01, 0.36, '#f4f2ee', x, 0.81, tz - 0.3, { ry: 0.1 * k, shadow: false });
      const c = tools[(ti * 3 + k + 1) % tools.length];
      if ((ti + k) % 3 === 0) S(0.09, c, x + 0.35, 0.9, tz, {}, null, 10);
      else if ((ti + k) % 3 === 1) { C(0.05, 0.05, 0.12, c, x + 0.35, 0.81, tz + 0.05, {}, null, 10); C(0.012, 0.012, 0.14, P.oakDark, x + 0.35, 0.9, tz + 0.05, { rz: 0.3, shadow: false }, null, 5); }
      else { B(0.18, 0.12, 0.18, c, x + 0.35, 0.81, tz + 0.1, { ry: 0.4 }); B(0.14, 0.01, 0.03, P.graphite, x - 0.3, 0.82, tz + 0.15, { ry: 0.6, shadow: false }); }
      npcSpot('craft', { x, z: tz - 1.25, ry: 0, pose: 'sit', act: 'craft', sy: 0.0, col: (k === 0 ? 0 : undefined) });
    }
    C(0.13, 0.13, 0.03, P.white, tx, 0.81, tz + 0.4, {}, null, 14);
    for (let i = 0; i < 5; i++) S(0.05, tools[i], tx - 0.06 + (i % 3) * 0.06, 0.86, tz + 0.36 + (i > 2 ? 0.06 : 0), {}, null, 8);
  });
  // 洞洞板工具墙 + 材料架
  const g = new THREE.Group(); g.position.set(r.cx, 0, r.z0 + 0.3); scene.add(g);
  for (const s of [-1, 1]) B(0.06, 2.5, 0.06, P.graphite, s * 1.9, 0, 0, {}, g);
  R(3.8, 1.2, 0.04, 0.02, '#dbc6a6', 0, 1.15, 0, {}, g);
  for (let i = 0; i < 11; i++) { const c = tools[i % tools.length]; if (i % 3 === 0) C(0.012, 0.012, 0.42, P.graphite, -1.6 + i * 0.32, 1.45, 0.06, { shadow: false }, g, 5);
    else B(0.08 + (i % 2) * 0.06, 0.3 + (i % 3) * 0.08, 0.03, c, -1.6 + i * 0.32, 1.4, 0.05, { shadow: false }, g); }
  rack(r.x1 - 0.42, 8.0, -Math.PI / 2, 2.6, 2.0, 4, 'bins');
  rack(r.x0 + 0.42, 8.6, Math.PI / 2, 2.0, 1.4, 3, 'bins');
  plant(r.x0 + 0.5, 10.3, 1.0, P.white, 'tall');
  lightBar(r.x0 + 3.0, tz + 0.6, 3.6, 3.15); lightBar(r.x1 - 3.0, tz + 0.6, 3.6, 3.15);
  // 备用位（如有机器人被分到手工房）：桌对面
  npcSpot('craft', { x: r.x0 + 3.0, z: tz + 1.25, ry: Math.PI, pose: 'sit', act: 'craft', sy: 0.0 });
  npcSpot('craft', { x: r.x1 - 3.0, z: tz + 1.25, ry: Math.PI, pose: 'sit', act: 'craft', sy: 0.0 });
  stool(r.x0 + 3.0, tz + 1.25); stool(r.x1 - 3.0, tz + 1.25);
}
// ---------------- 储物间 ----------------
{ const r = ROOMS.store;
  rack(r.x0 + 0.42, 3.9, Math.PI / 2, 2.6, 2.4, 4, 'boxes');
  rack(r.x0 + 0.42, 7.2, Math.PI / 2, 2.6, 2.4, 4, 'rolls');
  rack(r.x1 - 0.42, 6.6, -Math.PI / 2, 3.4, 2.4, 4, 'paper');
  const tx = r.cx + 0.3, tz = 9.1;
  R(2.4, 0.06, 1.0, 0.02, oakMat, tx, 0.8, tz); for (const sx of [-1, 1]) B(0.07, 0.8, 0.85, P.graphite, tx + sx * 1.1, 0, tz);
  B(0.5, 0.36, 0.4, BOX_C[0], tx - 0.6, 0.86, tz + 0.1); B(0.52, 0.02, 0.08, '#e8dcc6', tx - 0.6, 1.21, tz + 0.1, { shadow: false });
  C(0.08, 0.08, 0.06, '#d9c38a', tx + 0.3, 0.86, tz, {}, null, 12); B(0.6, 0.01, 0.4, '#e3d3bb', tx + 0.6, 0.86, tz + 0.1, { shadow: false });
  for (const [x, z, s, y] of [[r.x1 - 0.7, 10.3, 0.6, 0], [r.x1 - 1.35, 10.35, 0.5, 0], [r.x1 - 0.75, 10.3, 0.45, 0.48]]) B(s, s * 0.8, s, BOX_C[(x * 3 | 0) % 3], x, y, z, { ry: x * 0.2 });
  B(1.2, 0.12, 0.9, '#b48a5e', r.x0 + 1.6, 0, 10.2); B(0.5, 0.4, 0.5, BOX_C[1], r.x0 + 1.4, 0.12, 10.2); B(0.45, 0.35, 0.45, BOX_C[2], r.x0 + 1.95, 0.12, 10.1);
  const d1 = deskUnit(r.cx - 0.6, 2.7, { laptop: true, papers: true });
  npcSpot('store', { x: r.x0 + 1.15, z: 4.6, ry: -Math.PI / 2, pose: 'stand', act: 'carry', to: { x: tx - 0.6, z: tz - 0.95, ry: 0 } });
  npcSpot('store', { ...d1, act: 'type' });
  npcSpot('store', { x: tx + 0.6, z: tz - 0.95, ry: 0, pose: 'stand', act: 'operate' });
  lightBar(r.cx, 6.0, 3.6, 3.15);
}
// ---------------- 接待处 / 品牌墙 ----------------
{ const X = -24;
  floorRect(FX0, -20, 1, FZ1, canvasTex(8, 8, (g) => { g.fillStyle = '#e4ddd2'; g.fillRect(0, 0, 8, 8); }), 7, 0.008);
  const logoWall = new THREE.Group(); logoWall.position.set(X, 0, 1.35); scene.add(logoWall);
  B(6.2, WALL_TOP - 0.2, 0.25, P.white, 0, 0, 0, {}, logoWall);
  for (let i = 0; i < 22; i++) B(0.1, 2.5, 0.05, oakMat, -2.6 + i * 0.248, 0.1, 0.15, {}, logoWall);
  const t = canvasTex(1024, 300, (g, w, h) => { g.clearRect(0, 0, w, h); g.textAlign = 'center'; g.textBaseline = 'middle';
    g.font = `700 150px ${FONT}`; g.fillStyle = '#2f3136'; g.fillText('AI TEAM', w / 2, 120); g.font = `400 60px ${FONT}`; g.fillStyle = '#5b5e63'; g.fillText('AI 团队办公室', w / 2, 240); });
  R(3.6, 1.15, 0.04, 0.03, '#f7f5f1', 0, 1.35, 0.2, {}, logoWall);
  panel(3.4, 1.0, t, 0, 1.92, 0.225, { transparent: true }, logoWall);
  R(3.0, 1.05, 0.7, 0.08, P.white, X, 0, 5.4); R(3.2, 0.06, 0.85, 0.03, oakMat, X, 1.05, 5.4);
  R(0.8, 0.02, 0.6, 0.01, '#d8cfc3', X, 1.11, 5.4, { shadow: false }); laptop(scene, X + 1.0, 1.11, 5.25, Math.PI);
  chair(X, 4.2, 0, P.charcoal, null, { office: true });
  C(0.08, 0.06, 0.14, P.white, X - 1.2, 1.11, 5.35, {}, null, 10); S(0.12, leafMats[0], X - 1.2, 1.35, 5.35, {}, null, 8);
  sofa(FX0 + 0.65, 8.2, Math.PI / 2, P.oat, 2.4); C(0.3, 0.3, 0.45, oakMat, FX0 + 0.6, 0, 10.1, {}, null, 16);
  plant(FX0 + 0.5, 2.2, 1.1, P.charcoal, 'tall'); plant(-20.6, 2.4, 0.9, P.white);
  const cr = -20.7, cz = 10.3;
  C(0.18, 0.2, 0.03, P.charcoal, cr, 0, cz, {}, null, 12); C(0.02, 0.02, 1.75, P.charcoal, cr, 0, cz, {}, null, 6);
  for (let i = 0; i < 4; i++) { const a = i * Math.PI / 2; C(0.012, 0.012, 0.25, P.charcoal, cr + Math.cos(a) * 0.1, 1.55, cz + Math.sin(a) * 0.1, { rz: Math.cos(a) * 0.8, rx: -Math.sin(a) * 0.8, shadow: false }, null, 4); }
  R(0.3, 0.8, 0.12, 0.05, P.terracotta, cr + 0.12, 0.9, cz, { rz: 0.1 });
  rug(X, 10.4, 2.4, 1.0, '#8f8a83', '#6e6a64');
  pendant(X, 5.4, P.charcoal, 3.2, 0.3);
}
// ---------------- 走廊 ----------------
for (let x = -16; x <= 24; x += 8) lightBar(x, CZ, 3.2, 3.05);
for (const x of [-18.5, -5.6, 8.6, 21.6]) plant(x, 0.55, 0.75, P.white);
cabinet(27.6, -1, -Math.PI / 2, 0.9, 1.0); C(0.22, 0.22, 1.1, P.dusty, 27.5, 0, 0.3, {}, null, 14); C(0.18, 0.18, 0.4, '#d7e8ee', 27.5, 1.1, 0.3, {}, null, 14);
// ---------------- 文字标签 ----------------
function labelSprite(w, h, sx) {
  const tex = canvasTex(w, h, () => {}); tex.minFilter = THREE.LinearFilter;
  const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false, toneMapped: false }));
  sp.scale.set(sx, sx * h / w, 1); sp.renderOrder = 10; return sp;
}
function drawName(sp, name, role, color) {
  const t = sp.material.map, g = t.userData.ctx, w = 512, h = 104;
  g.clearRect(0, 0, w, h);
  g.font = `600 40px ${FONT}`; const nt = fitText(g, name, 260); const nw = g.measureText(nt).width;
  g.font = `400 30px ${FONT}`; const rt = role ? fitText(g, role, 150) : ''; const rw = rt ? g.measureText(rt).width + 16 : 0;
  const tw = 30 + 22 + nw + rw + 30, x0 = (w - tw) / 2;
  g.shadowColor = 'rgba(0,0,0,.18)'; g.shadowBlur = 10; g.shadowOffsetY = 3;
  g.fillStyle = 'rgba(252,251,248,.96)'; rr(g, x0, 14, tw, 72, 36); g.fill();
  g.shadowColor = 'transparent';
  g.fillStyle = color; g.beginPath(); g.arc(x0 + 38, 50, 11, 0, 7); g.fill();
  g.textBaseline = 'middle'; g.textAlign = 'left';
  g.font = `600 40px ${FONT}`; g.fillStyle = P.charcoal; g.fillText(nt, x0 + 60, 51);
  if (rt) { g.font = `400 30px ${FONT}`; g.fillStyle = '#8a857e'; g.fillText(rt, x0 + 60 + nw + 16, 53); }
  t.needsUpdate = true;
}
function drawIcon(g, status, cx, cy, r, tick) {
  g.fillStyle = STATUS[status].color; g.beginPath(); g.arc(cx, cy, r, 0, 7); g.fill();
  g.strokeStyle = g.fillStyle = '#fff'; g.lineWidth = 5; g.lineCap = g.lineJoin = 'round';
  if (status === 'working') { rr(g, cx - 18, cy - 14, 36, 22, 4); g.stroke(); g.beginPath(); g.moveTo(cx - 24, cy + 14); g.lineTo(cx + 24, cy + 14); g.stroke(); }
  else if (status === 'thinking') { for (let i = 0; i < 3; i++) { g.globalAlpha = (tick % 3) >= i ? 1 : 0.4; g.beginPath(); g.arc(cx - 14 + i * 14, cy, 5, 0, 7); g.fill(); } g.globalAlpha = 1; }
  else if (status === 'browsing') { g.lineWidth = 4; g.beginPath(); g.arc(cx, cy, 17, 0, 7); g.stroke(); g.beginPath(); g.ellipse(cx, cy, 7, 17, 0, 0, 7); g.stroke(); g.beginPath(); g.moveTo(cx - 17, cy); g.lineTo(cx + 17, cy); g.stroke(); }
  else if (status === 'help') { g.beginPath(); g.moveTo(cx, cy - 16); g.lineTo(cx, cy + 4); g.stroke(); g.beginPath(); g.arc(cx, cy + 14, 3.5, 0, 7); g.fill(); }
  else if (status === 'idle') { rr(g, cx - 14, cy - 8, 22, 20, 4); g.stroke(); g.beginPath(); g.arc(cx + 11, cy + 1, 6, -1.4, 1.4); g.stroke(); g.lineWidth = 3; g.beginPath(); g.moveTo(cx - 7, cy - 13); g.quadraticCurveTo(cx - 3, cy - 18, cx - 7, cy - 23); g.stroke(); }
  else if (status === 'done') { g.lineWidth = 6; g.beginPath(); g.moveTo(cx - 14, cy + 1); g.lineTo(cx - 4, cy + 11); g.lineTo(cx + 15, cy - 11); g.stroke(); }
}
function drawBubble(sp, status, task, tick = 0) {
  const t = sp.material.map, g = t.userData.ctx, w = 512, h = 220, S_ = STATUS[status] || STATUS.idle;
  g.clearRect(0, 0, w, h);
  g.font = `400 30px ${FONT}`;
  const lines = wrap2(g, task || (status === 'idle' ? '休息一下～' : ''), 330);
  const bh = lines.length > 1 ? 150 : 112, by = 14, bw = 470, bx = (w - bw) / 2;
  g.shadowColor = 'rgba(0,0,0,.16)'; g.shadowBlur = 14; g.shadowOffsetY = 4;
  g.fillStyle = '#fdfcfa'; rr(g, bx, by, bw, bh, 30); g.fill();
  g.beginPath(); g.moveTo(w / 2 - 18, by + bh - 1); g.lineTo(w / 2, by + bh + 20); g.lineTo(w / 2 + 18, by + bh - 1); g.fill();
  g.shadowColor = 'transparent';
  g.fillStyle = S_.color; rr(g, bx, by, 10, bh, 5); g.save(); g.beginPath(); rr(g, bx, by, bw, bh, 30); g.clip(); g.fillRect(bx, by, 9, bh); g.restore();
  drawIcon(g, status, bx + 64, by + bh / 2, 34, tick);
  g.textAlign = 'left'; g.textBaseline = 'middle';
  g.font = `600 34px ${FONT}`; g.fillStyle = S_.color; g.fillText(S_.label, bx + 116, by + 38);
  g.font = `400 30px ${FONT}`; g.fillStyle = '#4a4d52';
  lines.forEach((ln, i) => g.fillText(ln, bx + 116, by + 80 + i * 38));
  t.needsUpdate = true;
}
const helpTex = canvasTex(128, 128, (g) => { g.fillStyle = STATUS.help.color; g.beginPath(); g.arc(64, 64, 52, 0, 7); g.fill(); g.strokeStyle = '#fff'; g.lineWidth = 12; g.lineCap = 'round'; g.beginPath(); g.moveTo(64, 34); g.lineTo(64, 72); g.stroke(); g.fillStyle = '#fff'; g.beginPath(); g.arc(64, 94, 7, 0, 7); g.fill(); });

// ---------------- Q 版小人 ----------------
const SKINS = ['#f6d7c3', '#f0c9a8', '#e9bc98', '#f7dcca'];
const HAIRS = ['#3a2e28', '#5b4232', '#2c2b2e', '#6e4f38', '#4a362b'];
const hashN = (s) => { let h = 0; for (const ch of s) h = (h * 31 + ch.charCodeAt(0)) >>> 0; return h; };
const eyeMat = std('#2b2522', { rough: 0.4 }), whiteMat = new THREE.MeshBasicMaterial({ color: '#ffffff' });
const blushMat = new THREE.MeshBasicMaterial({ color: '#f2a0a0', transparent: true, opacity: 0.55, depthWrite: false });
function roleKind(bot) {
  const s = (bot.id + ' ' + bot.role + ' ' + bot.name).toLowerCase();
  if (bot.zone === 'director' || /总监|director|调度/.test(s)) return 'director';
  if (/秘书|secretary|助理/.test(s)) return 'secretary';
  if (/设计|design/.test(s)) return 'designer';
  if (/行政|admin/.test(s)) return 'admin';
  if (/采购|purchas|buy/.test(s)) return 'purchasing';
  return 'default';
}
function makeChibi(o) { // o: { cloth, skin, hair, style, kind, pants }
  const root = new THREE.Group(), rig = new THREE.Group(); root.add(rig);
  const cloth = std(o.cloth, { rough: 0.85 }), skin = std(o.skin, { rough: 0.7 }), hair = std(o.hair, { rough: 0.6 }), pants = std(o.pants || '#4b4f57');
  // 腿
  const legs = [];
  for (const sx of [-1, 1]) {
    const lg = new THREE.Group(); lg.position.set(sx * 0.12, 0.48, 0); rig.add(lg);
    CAP(0.085, 0.22, pants, 0, -0.2, 0, {}, lg);
    const shoe = S(0.1, '#3a3532', 0, -0.42, 0.05, {}, lg, 10); shoe.scale.set(1, 0.6, 1.4);
    legs.push(lg);
  }
  // 身体
  const torso = CAP(0.25, 0.26, cloth, 0, 0.8, 0, {}, rig); torso.scale.set(1, 1, 0.85);
  // 手臂
  const arms = [];
  for (const sx of [-1, 1]) {
    const ag = new THREE.Group(); ag.position.set(sx * 0.3, 1.0, 0); ag.rotation.z = sx * 0.18; rig.add(ag);
    CAP(0.07, 0.2, cloth, 0, -0.15, 0, {}, ag); S(0.075, skin, 0, -0.32, 0, {}, ag, 10);
    arms.push(ag);
  }
  // 头
  const head = new THREE.Group(); head.position.set(0, 1.47, 0); rig.add(head);
  S(0.44, skin, 0, 0, 0, {}, head, 22);
  for (const sx of [-1, 1]) { S(0.08, skin, sx * 0.43, -0.02, 0, {}, head, 8); }
  for (const sx of [-0.15, 0.15]) {
    const e = S(0.05, eyeMat, sx, -0.01, 0.41, { shadow: false }, head, 10); e.scale.set(1, 1.3, 0.55);
    const hl = new THREE.Mesh(new THREE.SphereGeometry(0.016, 6, 4), whiteMat); hl.position.set(sx + 0.017, 0.02, 0.437); head.add(hl);
    const bl = new THREE.Mesh(new THREE.CircleGeometry(0.06, 14), blushMat); bl.position.set(sx * 1.65, -0.11, 0.385); bl.rotation.y = sx * 1.6 * 0.5; head.add(bl);
  }
  const smile = new THREE.Mesh(new THREE.TorusGeometry(0.045, 0.011, 6, 14, Math.PI), eyeMat); smile.position.set(0, -0.12, 0.425); smile.rotation.z = Math.PI; head.add(smile);
  // 头发
  const cap = new THREE.Mesh(new THREE.SphereGeometry(0.47, 22, 12, 0, Math.PI * 2, 0, Math.PI * 0.56), hair);
  place(cap, head, 0, 0.03, -0.03, { rx: -0.42 });
  const fringe = S(0.2, hair, 0.12, 0.27, 0.27, {}, head, 12); fringe.scale.set(1.5, 0.55, 0.8); fringe.rotation.z = -0.3;
  if (o.style === 'bun') S(0.17, hair, 0, 0.42, -0.25, {}, head, 12);
  if (o.style === 'long') { const back = CAP(0.36, 0.3, hair, 0, -0.2, -0.17, {}, head); back.scale.set(1.15, 1, 0.6); }
  if (o.style === 'bob') for (const sx of [-1, 1]) { const sd = S(0.2, hair, sx * 0.36, -0.1, -0.04, {}, head, 12); sd.scale.set(0.6, 1.3, 1.1); }
  // 角色配饰
  const props = {};
  const k = o.kind;
  if (k === 'director' || k === 'boss') {
    const tieC = std(o.tie || P.charcoal, { rough: 0.5 });
    const collar = new THREE.Mesh(new THREE.ConeGeometry(0.13, 0.13, 3), std('#f7f5f0')); place(collar, rig, 0, 1.02, 0.17, { rx: Math.PI, shadow: false });
    B(0.07, 0.26, 0.03, tieC, 0, 0.7, 0.22, { shadow: false }, rig); B(0.06, 0.05, 0.03, tieC, 0, 0.95, 0.215, { shadow: false }, rig);
  }
  if (k === 'boss') { for (const sx of [-0.15, 0.15]) { const gl = new THREE.Mesh(new THREE.TorusGeometry(0.085, 0.012, 6, 18), std('#2b2522')); gl.position.set(sx, -0.01, 0.44); head.add(gl); } B(0.12, 0.012, 0.012, '#2b2522', 0, 0.0, 0.44, { shadow: false }, head); }
  if (k === 'secretary') {
    for (const sx of [-0.15, 0.15]) { const gl = new THREE.Mesh(new THREE.TorusGeometry(0.08, 0.01, 6, 18), std(P.brass, { metal: 0.6, rough: 0.4 })); gl.position.set(sx, -0.01, 0.44); head.add(gl); }
    props.hand = R(0.2, 0.26, 0.04, 0.02, P.terracotta, 0, -0.42, 0.06, {}, arms[1]);
  }
  if (k === 'designer') {
    const beret = C(0.33, 0.36, 0.1, std(P.terracotta), 0.02, 0.33, -0.02, { rz: 0.28 }, head, 20); S(0.03, P.terracotta, -0.04, 0.47, -0.02, {}, head, 6);
    props.hand = R(0.28, 0.36, 0.025, 0.03, P.charcoal, 0, -0.42, 0.07, {}, arms[1]);
  }
  if (k === 'admin') {
    const band = new THREE.Mesh(new THREE.TorusGeometry(0.47, 0.025, 6, 24, Math.PI), std(P.charcoal)); band.position.set(0, 0.02, 0); head.add(band);
    for (const sx of [-1, 1]) C(0.1, 0.1, 0.08, P.charcoal, sx * 0.46, -0.08, 0, { rz: Math.PI / 2 }, head, 14);
    const mic = new THREE.Mesh(new THREE.CapsuleGeometry(0.012, 0.25, 2, 6), std(P.charcoal)); mic.position.set(-0.36, -0.2, 0.2); mic.rotation.set(0.2, 0.6, 1.1); head.add(mic);
    S(0.03, P.charcoal, -0.24, -0.27, 0.31, {}, head, 8);
  }
  if (k === 'purchasing') {
    props.hand = new THREE.Group(); props.hand.position.set(0, -0.36, 0.06); arms[1].add(props.hand);
    R(0.22, 0.3, 0.02, 0.02, P.oakDark, 0, -0.05, 0, {}, props.hand); B(0.17, 0.2, 0.01, P.white, 0, -0.17, 0.012, { shadow: false }, props.hand); B(0.08, 0.03, 0.02, P.charcoal, 0, 0.09, 0.012, { shadow: false }, props.hand);
    const bag = R(0.26, 0.28, 0.14, 0.03, P.oat, 0, -0.52, 0, {}, arms[0]); const hdl = new THREE.Mesh(new THREE.TorusGeometry(0.07, 0.012, 6, 14, Math.PI), std(P.oakDark)); hdl.position.set(0, -0.36, 0); arms[0].add(hdl);
  }
  // 地面柔和阴影 + 状态光圈
  const ringMat = new THREE.MeshBasicMaterial({ color: '#bbb', transparent: true, opacity: 0.55, depthWrite: false });
  const ring = new THREE.Mesh(new THREE.RingGeometry(0.5, 0.58, 40), ringMat); ring.rotation.x = -Math.PI / 2; ring.position.y = 0.035; root.add(ring);
  rig.scale.setScalar(1.2);
  return { root, rig, head, arms, legs, torso, ringMat, ring, props };
}
// 角色内部按材质合并网格（保留关节分组，动画不受影响），减少绘制调用
function compactGroup(g) {
  const by = new Map();
  for (const o of g.children) if (o.isMesh && !Array.isArray(o.material) && !o.userData.keep) { const k = o.material.uuid + (o.castShadow ? 'c' : ''); if (!by.has(k)) by.set(k, []); by.get(k).push(o); }
  for (const list of by.values()) {
    if (list.length < 2) continue;
    const geos = list.map(o => { o.updateMatrix(); const q = o.geometry.index ? o.geometry.toNonIndexed() : o.geometry.clone(); q.applyMatrix4(o.matrix);
      for (const k of Object.keys(q.attributes)) if (!['position', 'normal', 'uv'].includes(k)) q.deleteAttribute(k); q.clearGroups(); return q.attributes.uv ? q : null; });
    if (geos.some(q => !q)) continue;
    const merged = mergeGeometries(geos, false); if (!merged) continue;
    const m = new THREE.Mesh(merged, list[0].material); m.castShadow = list[0].castShadow; m.receiveShadow = true; m.renderOrder = list[0].renderOrder; g.add(m);
    for (const o of list) g.remove(o);
  }
}
function compactChibi(ch) { ch.torso.userData.keep = true; for (const g of [ch.rig, ch.head, ...ch.arms, ...ch.legs]) compactGroup(g); }
function makeBotCharacter(bot) {
  const h = hashN(bot.id), kind = roleKind(bot);
  const style = { secretary: 'bun', designer: 'bob', purchasing: 'long' }[kind] || ['short', 'bob', 'long', 'bun'][h % 4];
  const ch = makeChibi({ cloth: soften(bot.color), skin: SKINS[h % SKINS.length], hair: HAIRS[(h >>> 3) % HAIRS.length], style: kind === 'director' || kind === 'admin' ? 'short' : style, kind, tie: kind === 'director' ? P.charcoal : null });
  const LS = isMobile ? 1.35 : 1;
  const name = labelSprite(512, 104, 2.5 * LS); name.position.y = 2.55; ch.root.add(name);
  const bubble = labelSprite(512, 220, 3.0 * LS); bubble.position.y = 3.5 + (LS - 1) * 1.6; bubble.userData.baseY = bubble.position.y; ch.root.add(bubble);
  const help = new THREE.Sprite(new THREE.SpriteMaterial({ map: helpTex, transparent: true, depthWrite: false, toneMapped: false }));
  help.scale.set(0.55, 0.55, 1); help.position.set(1.45, 4.2, 0); help.renderOrder = 11; help.visible = false; ch.root.add(help);
  Object.assign(ch, { name, bubble, help });
  compactChibi(ch);
  ch.root.traverse(o => { if (o.isMesh) o.userData.botRoot = ch.root; });
  scene.add(ch.root); return ch;
}
// 老板（展示用，不需要 Token）
function makeBoss(info) {
  const ch = makeChibi({ cloth: '#3d4250', skin: SKINS[1], hair: '#2c2b2e', style: 'short', kind: 'boss', tie: soften(info.color || '#c0392b', 0.1), pants: '#3d4250' });
  compactChibi(ch); ch.root.position.set(BOSS_SEAT.x, 0, BOSS_SEAT.z); scene.add(ch.root);
  for (const l of ch.legs) l.rotation.x = -Math.PI / 2;
  ch.rig.position.y = 0.0;
  const name = labelSprite(512, 104, 2.7); name.position.y = 2.6; ch.root.add(name);
  drawName(name, info.name, info.title, soften(info.color || '#c0392b'));
  return Object.assign(ch, { name, info });
}
let boss = null;

// ---------------- 静态几何合并（大幅减少绘制调用，提升手机性能） ----------------
function bakeStatic() {
  scene.updateMatrixWorld(true);
  const groups = new Map(), victims = [];
  scene.traverse(o => {
    if (!o.isMesh || o.isInstancedMesh || Array.isArray(o.material) || o.userData.keep) return;
    const key = o.material.uuid + (o.castShadow ? 'c' : '') + (o.receiveShadow ? 'r' : '') + (o.renderOrder || 0);
    if (!groups.has(key)) groups.set(key, []); groups.get(key).push(o);
  });
  for (const list of groups.values()) {
    if (list.length < 2) continue;
    const geos = list.map(o => { let g = o.geometry.index ? o.geometry.toNonIndexed() : o.geometry.clone(); g.applyMatrix4(o.matrixWorld);
      for (const k of Object.keys(g.attributes)) if (!['position', 'normal', 'uv'].includes(k)) g.deleteAttribute(k); if (!g.attributes.uv) return null; g.clearGroups(); return g; });
    if (geos.some(g => !g)) continue;
    const merged = mergeGeometries(geos, false); if (!merged) continue;
    const m = new THREE.Mesh(merged, list[0].material); m.castShadow = list[0].castShadow; m.receiveShadow = list[0].receiveShadow; m.renderOrder = list[0].renderOrder;
    scene.add(m); victims.push(...list); geos.forEach(g => g.dispose());
  }
  for (const o of victims) o.parent && o.parent.remove(o);
}
bakeStatic();

// ---------------- 房间分配（data/bots.json 的 room 字段决定所在房间） ----------------
const desks = new Map();
let npcCounts = { print: 3, craft: 6, store: 2 };
const KIND_ROOM = { director: 'director', secretary: 'secretary', designer: 'design', admin: 'admin', purchasing: 'purchasing' };
function roomSeats(id) {
  const r = ROOMS[id]; if (!r) return [];
  if (r.npcSpots.length) return r.npcSpots.slice(Math.min(r.npcSpots.length, npcCounts[id] || 0)).map(s => (s.botSeat ||= { x: s.x, z: s.z, ry: s.ry, pose: s.pose, sy: s.sy, screen: s.screen, via: s.via, col: s.col, room: id }));
  return r.seats;
}
function roomForBot(b) {
  if (b.room && ROOMS[b.room] && roomSeats(b.room).length) return b.room;
  if (b.zone === 'director') return 'director';
  const s = (b.id + ' ' + b.role + ' ' + b.name).toLowerCase();
  if (/印刷|print/.test(s)) return 'print'; if (/手工|craft/.test(s)) return 'craft'; if (/储物|仓|store|stock/.test(s)) return 'store';
  return KIND_ROOM[roleKind(b)] || null;
}
function assignDesks(list) {
  desks.clear();
  for (const r of Object.values(ROOMS)) for (const s of [...r.seats, ...r.npcSpots]) if (s.screen && !s.npc) s.screen.color.set('#2a2c30');
  const used = new Set(), overflow = [];
  for (const b of list) {
    const id = roomForBot(b), free = id ? roomSeats(id).find(s => !used.has(s)) : null;
    if (free) { used.add(free); desks.set(b.id, free); } else overflow.push(b);
  }
  const spare = [...ROOMS.spare1.seats, ...ROOMS.spare2.seats];
  overflow.forEach((b, i) => { const s = spare.find(x => !used.has(x)) || spare[i % spare.length]; used.add(s); desks.set(b.id, s); });
}
// 给座位标注所在房间
for (const r of Object.values(ROOMS)) for (const s of [...r.seats, ...r.npcSpots]) s.room = r.id;

// ---------------- 路径（座位 → 门 → 走廊 → 门 → 座位） ----------------
function exitChain(s) {
  const r = ROOMS[s.room];
  return [...(s.via || []), doorPt(r, 0.9), doorPt(r, -0.9)];
}
function planPath(fromSeat, to) {
  if (!fromSeat) return [{ x: to.x, z: to.z }];
  if (fromSeat.room === to.room) return [...(fromSeat.via || []), ...(to.via || []).slice().reverse(), { x: to.x, z: to.z }];
  const A = exitChain(fromSeat), Bc = exitChain(to);
  const a = A[A.length - 1], b = Bc[Bc.length - 1];
  return [...A, { x: a.x, z: CZ }, { x: b.x, z: CZ }, ...Bc.slice().reverse(), { x: to.x, z: to.z }];
}

// ---------------- 展示用 NPC 员工（印刷房 / 手工房 / 储物间；不是机器人，不上报状态） ----------------
const NPC_CLOTH = ['#8fa9a0', '#c9a27e', '#a7b4c9', '#d4b37a', '#b98f8f', '#9aa48a', '#c7c0b3', '#a99bb8', '#d1a59a'];
const APRON = { print: ['#4b4f57', '#5d6b7a'], craft: ['#6d86a3', '#c58b67', '#8a9f7a'], store: ['#a0724f', '#7d6a58'] };
const npcs = [];
let npcSig = '';
function makeNpc(room, spot, i) {
  const h = hashN(room + i * 7919);
  const ch = makeChibi({ cloth: NPC_CLOTH[(h >>> 2) % NPC_CLOTH.length], skin: SKINS[(h >>> 5) % SKINS.length], hair: HAIRS[(h >>> 7) % HAIRS.length],
    style: ['short', 'bob', 'long', 'bun', 'short'][(h >>> 9) % 5], kind: 'npc', pants: ['#4b4f57', '#5a5048', '#3f4a5c'][(h >>> 11) % 3] });
  ch.ring.visible = false;
  const ap = std(APRON[room][(h >>> 4) % APRON[room].length], { rough: 0.9 });
  const apron = R(0.42, 0.5, 0.03, 0.03, ap, 0, 0.5, 0.225, { shadow: false }, ch.rig); apron.rotation.x = -0.05;
  B(0.2, 0.2, 0.03, ap, 0, 0.92, 0.205, { shadow: false }, ch.rig);
  B(0.16, 0.08, 0.02, shade(ap.color.getHexString ? '#' + ap.color.getHexString() : '#555', 0.08), 0.06, 0.62, 0.245, { shadow: false }, ch.rig);
  if (room === 'store') { // 工作帽
    const capM = std(['#c8805f', '#3d5670'][(h >>> 3) % 2]);
    const cp = new THREE.Mesh(new THREE.SphereGeometry(0.46, 18, 8, 0, Math.PI * 2, 0, Math.PI / 2), capM); place(cp, ch.head, 0, 0.1, 0, { rx: -0.15, shadow: false });
    B(0.4, 0.03, 0.26, capM, 0, 0.12, 0.42, { rx: -0.1, shadow: false }, ch.head);
  }
  if (room === 'craft' && (h >>> 6) % 3 === 0) { const bd = new THREE.Mesh(new THREE.TorusGeometry(0.44, 0.04, 6, 24), std(P.terracotta)); bd.position.set(0, 0.16, -0.02); bd.rotation.x = Math.PI / 2 - 0.4; ch.head.add(bd); }
  if (room === 'print' && spot.act === 'type') ch.head.add(new THREE.Mesh(new THREE.TorusGeometry(0.47, 0.025, 6, 24, Math.PI), std(P.charcoal)));
  let box = null;
  if (spot.act === 'carry') { box = new THREE.Group(); place(box, ch.rig, 0, 0.92, 0.42, { shadow: false }); B(0.5, 0.38, 0.4, BOX_C[0], 0, -0.19, 0, {}, box); B(0.51, 0.02, 0.1, '#e8dcc6', 0, 0.17, 0, { shadow: false }, box); }
  if (spot.act === 'cut') { place(new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.05, 0.2), std(P.mustard)), ch.arms[1], 0, -0.4, 0.06, { shadow: false }); }
  compactChibi(ch); if (box) compactGroup(box);
  ch.root.position.set(spot.x, 0, spot.z); ch.root.rotation.y = spot.ry;
  if (spot.pose === 'sit') for (const l of ch.legs) l.rotation.x = -Math.PI / 2 + 0.05;
  scene.add(ch.root);
  if (spot.screen) spot.screen.color.set(['#cfe3ea', '#e7dccb', '#d9e6d4'][i % 3]);
  return { ch, spot, room, box, phase: (h % 1000) / 100, t: 0, leg: 0 };
}
function applyNpcs(cfg) {
  const want = {};
  for (const id of ['print', 'craft', 'store']) want[id] = Math.max(0, Math.min(ROOMS[id].npcSpots.length, cfg && cfg[id] != null ? +cfg[id] || 0 : npcCounts[id]));
  const sig = JSON.stringify(want); if (sig === npcSig) return false;
  npcSig = sig; npcCounts = want;
  for (const n of npcs) scene.remove(n.ch.root); npcs.length = 0;
  for (const r of ['print', 'craft', 'store']) { ROOMS[r].npcSpots.forEach(s => { s.npc = false; if (s.screen) s.screen.color.set('#2a2c30'); });
    for (let i = 0; i < want[r]; i++) { const s = ROOMS[r].npcSpots[i]; s.npc = true; npcs.push(makeNpc(r, s, i)); } }
  return true;
}
function animateNpc(n, dt, T) {
  const ch = n.ch, s = n.spot, t = T + n.phase, [la, ra] = ch.arms, [ll, rl] = ch.legs, k = 10;
  let aL = 0, aR = 0, zL = -0.18, zR = 0.18, hx = 0, hy = 0, y = 0, legL = s.pose === 'sit' ? -Math.PI / 2 + 0.05 : 0, legR = legL;
  if (s.act === 'type') { aL = -1.15 + Math.sin(t * 13) * 0.12; aR = -1.15 + Math.cos(t * 13) * 0.12; zL = -0.05; zR = 0.05; hx = 0.12; hy = Math.sin(t * 0.4) * 0.1; y = -0.05; }
  else if (s.act === 'operate') { const ph = (t % 6) / 6; aL = -0.5; aR = ph < 0.5 ? -1.35 + Math.sin(t * 6) * 0.15 : -0.9; zR = ph < 0.5 ? 0.05 : 0.25; hx = 0.18; hy = ph < 0.5 ? 0.15 : -0.25 + Math.sin(t) * 0.1; y = Math.abs(Math.sin(t * 1.2)) * 0.015; }
  else if (s.act === 'cut') { const sw = Math.sin(t * 1.6); aL = -1.1; aR = -1.2 + sw * 0.1; zL = -0.1; zR = 0.15 + sw * 0.3; hx = 0.25; hy = sw * 0.12; }
  else if (s.act === 'craft') { aL = -1.0 + Math.sin(t * 5) * 0.2; aR = -1.05 + Math.sin(t * 5 + 1.7) * 0.22; zL = -0.25 + Math.sin(t * 2.5) * 0.12; zR = 0.25 - Math.sin(t * 2.5 + 1) * 0.12; hx = 0.1 + Math.sin(t * 0.8) * 0.06; hy = Math.sin(t * 0.5) * 0.15; y = 0.0; }
  else if (s.act === 'carry') {
    // 循环：货架取箱 → 走到打包台 → 放下 → 走回
    const A = s, Bp = s.to, L = Math.hypot(Bp.x - A.x, Bp.z - A.z), walkT = L / 1.6, cyc = 2 * walkT + 3.0, p = (T + n.phase) % cyc;
    let px, pz, ry, walking = false, holding;
    if (p < 1.2) { px = A.x; pz = A.z; ry = A.ry; holding = p > 0.7; aL = aR = -1.3; hx = 0.2; }
    else if (p < 1.2 + walkT) { const u = (p - 1.2) / walkT; px = A.x + (Bp.x - A.x) * u; pz = A.z + (Bp.z - A.z) * u; ry = Math.atan2(Bp.x - A.x, Bp.z - A.z); walking = true; holding = true; }
    else if (p < 3.0 + walkT) { px = Bp.x; pz = Bp.z; ry = Bp.ry; holding = p < 2.0 + walkT; aL = aR = -1.3 + Math.sin(t * 8) * 0.08; hx = 0.25; }
    else { const u = (p - 3.0 - walkT) / walkT; px = Bp.x + (A.x - Bp.x) * u; pz = Bp.z + (A.z - Bp.z) * u; ry = Math.atan2(A.x - Bp.x, A.z - Bp.z); walking = true; holding = false; }
    ch.root.position.set(px, 0, pz);
    let d = ry - ch.root.rotation.y; d = Math.atan2(Math.sin(d), Math.cos(d)); ch.root.rotation.y += d * Math.min(1, dt * 10);
    if (walking) { const w = Math.sin(t * 9); legL = w * 0.5; legR = -w * 0.5; y = Math.abs(Math.cos(t * 9)) * 0.05; if (!holding) { aL = -w * 0.5; aR = w * 0.5; } }
    if (holding) { aL = aR = -1.25; zL = -0.35; zR = 0.35; }
    n.box.visible = holding;
  }
  ll.rotation.x = damp(ll.rotation.x, legL, k, dt); rl.rotation.x = damp(rl.rotation.x, legR, k, dt);
  la.rotation.x = damp(la.rotation.x, aL, k, dt); ra.rotation.x = damp(ra.rotation.x, aR, k, dt);
  la.rotation.z = damp(la.rotation.z, zL, k, dt); ra.rotation.z = damp(ra.rotation.z, zR, k, dt);
  ch.head.rotation.x = damp(ch.head.rotation.x, hx, 5, dt); ch.head.rotation.y = damp(ch.head.rotation.y, hy, 5, dt);
  ch.rig.position.y = damp(ch.rig.position.y, y, 14, dt); ch.torso.scale.y = 1 + Math.sin(t * 2.2) * 0.015;
  if (s.screen && s.act === 'type' && Math.random() < dt * 0.5) s.screen.color.offsetHSL(0, 0, (Math.random() - 0.5) * 0.04);
}
applyNpcs(null);
// ---------------- 状态 ----------------
const chars = new Map();
let lastBots = [];
function seatFor(c) {
  const bot = c.bot;
  if (c.status === 'idle') {
    const idx = [...chars.values()].filter(x => x.status === 'idle').sort((a, b) => a.idleSince - b.idleSince).findIndex(x => x.bot.id === bot.id);
    return REST_SPOTS[Math.max(0, idx) % REST_SPOTS.length];
  }
  return desks.get(bot.id) || REST_SPOTS[0];
}
function applyBots(list) {
  lastBots = list;
  const ids = new Set(list.map(b => b.id));
  for (const [id, c] of chars) if (!ids.has(id)) { scene.remove(c.ch.root); chars.delete(id); }
  assignDesks(list);
  for (const b of list) {
    let c = chars.get(b.id);
    const prev = c ? c.status : null;
    if (!c || c.bot.color !== b.color || roleKind(c.bot) !== roleKind(b)) {
      if (c) scene.remove(c.ch.root);
      c = { bot: b, ch: makeBotCharacter(b), status: null, task: null, path: [], idleSince: 0, tick: 0, celebrate: 0, placed: false, phase: Math.random() * 10 };
      chars.set(b.id, c);
    }
    const nameChanged = c.bot.name !== b.name || c.bot.role !== b.role || !c.named;
    c.bot = b;
    if (nameChanged) { drawName(c.ch.name, b.name, b.role, soften(b.color)); c.named = true; }
    if (b.status !== c.status || b.task !== c.task) {
      if (b.status === 'idle' && c.status !== 'idle') c.idleSince = performance.now() + Math.random();
      if (b.status === 'done' && prev && prev !== 'done') { c.celebrate = 1.4; confetti(c.ch.root.position); }
      c.status = b.status; c.task = b.task;
      drawBubble(c.ch.bubble, c.status, c.task, c.tick);
      c.ch.ringMat.color.set((STATUS[c.status] || STATUS.idle).color);
      c.ch.help.visible = c.status === 'help';
    }
  }
  for (const c of chars.values()) {
    const s = seatFor(c);
    if (!c.placed) { c.ch.root.position.set(s.x, 0, s.z); c.ch.root.rotation.y = s.ry; c.placed = true; c.seat = s; c.path = []; }
    else if (c.path.length) c.next = (s === c.seat) ? null : s;
    else if (s !== c.seat) { c.path = planPath(c.seat, s); c.seat = s; }
  }
  renderPanel(); drawBoard();
}

// ---------------- 彩带（柔和色） ----------------
const CONF_N = isMobile ? 220 : 420;
const confMesh = new THREE.InstancedMesh(new THREE.PlaneGeometry(0.12, 0.2), new THREE.MeshBasicMaterial({ side: THREE.DoubleSide }), CONF_N);
confMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage); confMesh.frustumCulled = false; scene.add(confMesh);
const confP = Array.from({ length: CONF_N }, () => ({ life: 0, p: new THREE.Vector3(), v: new THREE.Vector3(), r: new THREE.Euler(), w: new THREE.Vector3() }));
const confCols = [P.terracotta, P.mustard, P.sage, P.dusty, P.blush, '#ffffff', '#b9a6d6'].map(c => new THREE.Color(c));
let confNext = 0;
const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _s = new THREE.Vector3(1, 1, 1), _z = new THREE.Vector3(0, 0, 0);
for (let i = 0; i < CONF_N; i++) { _m.compose(_z, _q, _z); confMesh.setMatrixAt(i, _m); confMesh.setColorAt(i, confCols[i % confCols.length]); }
function confetti(pos) {
  for (let k = 0; k < (isMobile ? 60 : 100); k++) {
    const p = confP[confNext]; confNext = (confNext + 1) % CONF_N;
    p.life = 2.4 + Math.random(); p.p.set(pos.x, 2.4, pos.z);
    const a = Math.random() * Math.PI * 2, s = 1.5 + Math.random() * 3;
    p.v.set(Math.cos(a) * s, 5 + Math.random() * 4, Math.sin(a) * s);
    p.r.set(Math.random() * 6, Math.random() * 6, 0); p.w.set(Math.random() * 8 - 4, Math.random() * 8 - 4, Math.random() * 8 - 4);
  }
}
let confActive = false;
function updateConfetti(dt) {
  let any = false;
  for (let i = 0; i < CONF_N; i++) {
    const p = confP[i]; if (p.life <= 0) continue; any = true;
    p.life -= dt; p.v.y -= 9.8 * dt; p.v.multiplyScalar(1 - 1.8 * dt); p.p.addScaledVector(p.v, dt);
    if (p.p.y < 0.04) { p.p.y = 0.04; p.v.set(0, 0, 0); }
    p.r.x += p.w.x * dt; p.r.y += p.w.y * dt; _q.setFromEuler(p.r);
    _m.compose(p.p, _q, p.life > 0 ? _s : _z); confMesh.setMatrixAt(i, _m);
  }
  if (any || confActive) confMesh.instanceMatrix.needsUpdate = true; confActive = any;
}

// ---------------- 调度看板（总监室） ----------------
function drawBoard() {
  const g = boardTex.userData.ctx, w = 1024, h = 512;
  g.fillStyle = '#f7f5f1'; g.fillRect(0, 0, w, h);
  g.font = `600 44px ${FONT}`; g.fillStyle = P.charcoal; g.textAlign = 'left'; g.textBaseline = 'middle'; g.fillText('调度看板', 40, 52);
  g.font = `400 26px ${FONT}`; g.fillStyle = '#8a857e'; g.fillText('Grok Bot · 今日团队状态', 250, 56);
  g.fillStyle = '#e3ddd4'; g.fillRect(40, 92, w - 80, 2);
  const counts = {}; for (const c of chars.values()) counts[c.status] = (counts[c.status] || 0) + 1;
  let x = 40;
  for (const [k, s] of Object.entries(STATUS)) {
    g.fillStyle = s.color; g.beginPath(); g.arc(x + 10, 135, 9, 0, 7); g.fill();
    g.fillStyle = P.charcoal; g.font = `400 26px ${FONT}`; g.fillText(`${s.label} ${counts[k] || 0}`, x + 28, 136); x += 160;
  }
  [...chars.values()].slice(0, 8).forEach((c, i) => {
    const col = i < 4 ? 40 : 530, y = 200 + (i % 4) * 72;
    g.fillStyle = soften(c.bot.color); g.beginPath(); g.arc(col + 16, y, 14, 0, 7); g.fill();
    g.fillStyle = P.charcoal; g.font = `600 28px ${FONT}`; g.fillText(fitText(g, c.bot.name, 150), col + 42, y);
    g.fillStyle = (STATUS[c.status] || STATUS.idle).color; g.font = `400 24px ${FONT}`;
    g.fillText(fitText(g, (STATUS[c.status] || STATUS.idle).label + (c.task ? ' · ' + c.task : ''), 260), col + 200, y);
  });
  boardTex.needsUpdate = true;
}

// ---------------- BTC 大屏 ----------------
const fmt = (n, d = 0) => Number(n).toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d });
function drawBtc(d) {
  const g = btcTex.userData.ctx, w = 1024, h = 576;
  const gr = g.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, '#24262b'); gr.addColorStop(1, '#1a1b1f'); g.fillStyle = gr; g.fillRect(0, 0, w, h);
  g.textAlign = 'left'; g.textBaseline = 'middle';
  g.fillStyle = P.mustard; g.beginPath(); g.arc(80, 74, 30, 0, 7); g.fill();
  g.fillStyle = '#1a1b1f'; g.font = `700 36px ${FONT}`; g.textAlign = 'center'; g.fillText('₿', 80, 76);
  g.textAlign = 'left'; g.fillStyle = '#e8e4dd'; g.font = `600 36px ${FONT}`; g.fillText('BTC / USD', 128, 76);
  g.fillStyle = '#8f8a83'; g.font = `400 24px ${FONT}`; g.fillText('实时行情', 330, 78);
  if (!d) { g.fillStyle = '#bbb'; g.font = `400 40px ${FONT}`; g.fillText('行情加载中…', 60, 260); btcTex.needsUpdate = true; return; }
  const up = (d.change24h ?? 0) >= 0, col = up ? '#7fbf95' : '#e0857a';
  g.fillStyle = '#f4f1ec'; g.font = `300 120px ${FONT}`; g.fillText('$' + fmt(d.price, 0), 56, 205);
  if (d.change24h != null) { g.fillStyle = col; g.font = `500 40px ${FONT}`; g.fillText((up ? '▲ +' : '▼ ') + d.change24h.toFixed(2) + '%  24h', 62, 300); }
  g.fillStyle = '#8f8a83'; g.font = `400 26px ${FONT}`; g.textAlign = 'right';
  if (d.high24h) { g.fillText(`24h 高  $${fmt(d.high24h)}`, w - 60, 190); g.fillText(`24h 低  $${fmt(d.low24h)}`, w - 60, 232); }
  const hs = d.history || [];
  if (hs.length > 1) {
    const mn = Math.min(...hs), mx = Math.max(...hs), x0 = 60, x1 = w - 60, y0 = 350, y1 = 510;
    const pt = (v, i) => [x0 + (x1 - x0) * i / (hs.length - 1), y1 - (y1 - y0) * ((v - mn) / ((mx - mn) || 1))];
    const fill = g.createLinearGradient(0, y0, 0, y1); fill.addColorStop(0, up ? 'rgba(127,191,149,.28)' : 'rgba(224,133,122,.28)'); fill.addColorStop(1, 'rgba(0,0,0,0)');
    g.beginPath(); hs.forEach((v, i) => { const [x, y] = pt(v, i); i ? g.lineTo(x, y) : g.moveTo(x, y); }); g.lineTo(x1, y1); g.lineTo(x0, y1); g.closePath(); g.fillStyle = fill; g.fill();
    g.beginPath(); hs.forEach((v, i) => { const [x, y] = pt(v, i); i ? g.lineTo(x, y) : g.moveTo(x, y); }); g.lineWidth = 4; g.strokeStyle = col; g.stroke();
  }
  g.font = `400 20px ${FONT}`; g.fillStyle = '#77736c'; g.textAlign = 'right';
  g.fillText(`数据源 ${d.source || ''} · 更新 ${new Date(d.updatedAt).toLocaleTimeString('zh-CN', { hour12: false })}${d.stale ? '（缓存）' : ''}`, w - 40, h - 26);
  btcTex.needsUpdate = true;
}
drawBtc(null);
const $ = (id) => document.getElementById(id);
async function loadBtc() {
  try {
    const r = await fetch('/api/btc', { cache: 'no-store' }); if (!r.ok) throw 0;
    const d = await r.json(); drawBtc(d);
    $('btcPrice').textContent = '$' + fmt(d.price, 0);
    const chg = $('btcChg');
    if (d.change24h != null) { chg.textContent = (d.change24h >= 0 ? '+' : '') + d.change24h.toFixed(2) + '%'; chg.className = d.change24h >= 0 ? 'up' : 'down'; }
  } catch (_) { /* 静默重试 */ }
}
loadBtc(); setInterval(loadBtc, 30000);
// ---------------- 面板 ----------------
const listEl = $('botList');
let selected = null;
function renderPanel() {
  const arr = [...chars.values()];
  const counts = {}; arr.forEach(c => counts[c.status] = (counts[c.status] || 0) + 1);
  $('summary').textContent = `${arr.length} 位成员 · 忙碌 ${(counts.working || 0) + (counts.thinking || 0) + (counts.browsing || 0)} · 空闲 ${counts.idle || 0}`;
  const want = arr.map(c => c.bot.id).join('|');
  if (listEl.dataset.ids !== want) {
    listEl.replaceChildren(); listEl.dataset.ids = want;
    for (const c of arr) {
      const li = document.createElement('li'); li.dataset.id = c.bot.id;
      const dot = document.createElement('span'); dot.className = 'dot';
      const nm = document.createElement('span'); nm.className = 'bname';
      const st = document.createElement('span'); st.className = 'bstatus';
      const tk = document.createElement('span'); tk.className = 'btask';
      li.append(dot, nm, st, tk); listEl.append(li);
      li.addEventListener('click', () => focusBot(c.bot.id));
    }
  }
  for (const li of listEl.children) {
    const c = chars.get(li.dataset.id); if (!c) continue;
    const [dot, nm, st, tk] = li.children; const S = STATUS[c.status] || STATUS.idle;
    dot.style.background = soften(c.bot.color);
    nm.textContent = c.bot.name; const role = document.createElement('span'); role.className = 'brole'; role.textContent = c.bot.role; nm.append(role);
    st.textContent = S.label; st.style.background = S.color;
    tk.textContent = c.task || '—';
    tk.title = c.bot.updatedAt ? '更新于 ' + new Date(c.bot.updatedAt).toLocaleString('zh-CN', { hour12: false }) : '';
    li.classList.toggle('sel', selected === c.bot.id);
  }
}
{ const lg = $('legend'); for (const s of Object.values(STATUS)) { const sp = document.createElement('span'); const i = document.createElement('i'); i.style.background = s.color; sp.append(i, s.label); lg.append(sp); } }
let flyTo = null;
function focusBot(id) {
  const c = chars.get(id); if (!c) return; selected = id; renderPanel();
  const p = c.ch.root.position; flyTo = { target: new THREE.Vector3(p.x, 1.2, p.z), pos: new THREE.Vector3(p.x + 4, 7, p.z + 8), t: 0 };
  toast(`${c.bot.name}（${c.bot.role}）：${(STATUS[c.status] || STATUS.idle).label}${c.task ? ' · ' + c.task : ''}`);
}
let toastTimer;
function toast(msg) { const t = $('toast'); t.textContent = msg; t.hidden = false; clearTimeout(toastTimer); toastTimer = setTimeout(() => t.hidden = true, 3500); }
const panelEl = $('panel');
if (isMobile && innerWidth < 760) panelEl.classList.add('hidden');
$('btnPanel').addEventListener('click', () => { panelEl.classList.toggle('hidden'); $('btnPanel').classList.toggle('on', !panelEl.classList.contains('hidden')); });
$('btnPanel').classList.toggle('on', !panelEl.classList.contains('hidden'));

// 点击角色
const ray = new THREE.Raycaster(), ndc = new THREE.Vector2(); let downAt = null;
renderer.domElement.addEventListener('pointerdown', e => downAt = [e.clientX, e.clientY]);
renderer.domElement.addEventListener('pointerup', e => {
  if (!downAt || Math.hypot(e.clientX - downAt[0], e.clientY - downAt[1]) > 6) return;
  ndc.set(e.clientX / innerWidth * 2 - 1, -(e.clientY / innerHeight) * 2 + 1); ray.setFromCamera(ndc, camera);
  const hits = ray.intersectObjects([...chars.values()].map(c => c.ch.root), true);
  const h = hits.find(x => x.object.userData.botRoot);
  if (h) { const id = [...chars.entries()].find(([, c]) => c.ch.root === h.object.userData.botRoot)?.[0]; if (id) focusBot(id); }
});


// ---------------- 昼夜 ----------------
const modes = ['auto', 'day', 'night'], modeLabel = { auto: '🌓 自动', day: '☀️ 白天', night: '🌙 夜晚' };
let dnMode = localStorage.getItem('office-dn') || 'auto'; if (!modes.includes(dnMode)) dnMode = 'auto';
let isNight = null;
function applyDayNight() {
  const h = new Date().getHours();
  const night = dnMode === 'night' || (dnMode === 'auto' && (h < 7 || h >= 19));
  $('btnDayNight').textContent = modeLabel[dnMode];
  document.body.classList.toggle('night', night);
  if (night === isNight) return; isNight = night;
  scene.background = new THREE.Color(night ? '#1c1b20' : '#efebe5');
  scene.fog = new THREE.Fog(night ? '#1c1b20' : '#efebe5', 75, 170);
  hemi.intensity = night ? 0.32 : 1.5; hemi.color.set(night ? '#8d93b5' : '#fff6ea'); hemi.groundColor.set(night ? '#3a2f28' : '#cbbfae');
  sun.intensity = night ? 0.25 : 2.3; sun.color.set(night ? '#9fb0d8' : '#fff1de');
  lampLights.forEach(l => l.intensity = night ? 22 : 0);
  bulbMats.forEach(m => { m.emissiveIntensity = night ? 3.0 : 0.4; });
  windowMats.forEach(m => { m.map = night ? nightSky : daySky; m.needsUpdate = true; });
  renderer.toneMappingExposure = night ? 1.15 : 1.05;
}
$('btnDayNight').addEventListener('click', () => { dnMode = modes[(modes.indexOf(dnMode) + 1) % 3]; localStorage.setItem('office-dn', dnMode); applyDayNight(); });
applyDayNight(); setInterval(applyDayNight, 60000);
// ---------------- 数据轮询 / 演示模式 ----------------
let demo = false, demoTimer = null, pollDelay = 3000, serverBots = [];
function setConn(t) { $('conn').textContent = t; }
async function poll() {
  try {
    const r = await fetch('/api/state', { cache: 'no-store' });
    if (r.status === 429) { pollDelay = 15000; setConn('请求过多，稍后重试'); }
    else if (!r.ok) throw new Error(r.status);
    else {
      const d = await r.json(); pollDelay = document.hidden ? 15000 : 3000;
      serverBots = d.bots || [];
      if (d.office) { if (d.office.title) { $('title').textContent = d.office.title; document.title = d.office.title; }
        if (!boss || boss.info.name !== d.office.boss.name || boss.info.title !== d.office.boss.title) { if (boss) scene.remove(boss.root); boss = makeBoss(d.office.boss); } }
      if (d.office) { updateRoomNames(d.office.rooms); applyNpcs(d.office.npcs); }
      if (!demo) applyBots(serverBots);
      setConn('● 实时连接'); $('updated').textContent = '更新于 ' + new Date().toLocaleTimeString('zh-CN', { hour12: false });
    }
  } catch (e) { console.error('poll ' + (e && e.stack || e)); setConn('连接中断，重试中…'); pollDelay = 6000; }
  setTimeout(poll, pollDelay);
}
poll();
const DEMO_TASKS = {
  working: ['整理会议纪要', '设计新版海报', '核对采购清单', '安排下周行程', '撰写周报', '处理报销单', '优化 Logo 配色'],
  thinking: ['构思活动方案', '分析供应商报价', '规划项目排期', '评估设计方向'],
  browsing: ['查找竞品资料', '比价办公用品', '搜索设计灵感', '查看行业新闻'],
  help: ['需要老板审批', '缺少供应商联系方式', '素材授权待确认'],
  idle: ['', '喝杯咖啡', '等待新任务'],
  done: ['日报已发送', '海报定稿', '订单已下单', '会议室已预订'],
};
function demoStep() {
  if (!lastBots.length) return;
  const bots = lastBots.map(b => ({ ...b }));
  const n = 1 + (Math.random() * 2 | 0);
  for (let k = 0; k < n; k++) {
    const b = bots[Math.random() * bots.length | 0];
    const keys = Object.keys(STATUS); const st = keys[Math.random() * keys.length | 0];
    const arr = DEMO_TASKS[st]; b.status = st; b.task = arr[Math.random() * arr.length | 0]; b.updatedAt = new Date().toISOString();
  }
  applyBots(bots);
}
$('btnDemo').addEventListener('click', () => {
  demo = !demo; $('btnDemo').classList.toggle('on', demo); $('btnDemo').textContent = demo ? '■ 停止演示' : '▶ 演示';
  $('demoBanner').hidden = !demo; clearInterval(demoTimer);
  if (demo) { demoStep(); demoTimer = setInterval(demoStep, 2600); } else applyBots(serverBots);
});
if (new URLSearchParams(location.search).has('demo')) $('btnDemo').click();


// ---------------- 动画循环 ----------------
const clock = new THREE.Clock(); let thinkAcc = 0, elapsed = 0;
const damp = (a, b, k, dt) => a + (b - a) * Math.min(1, k * dt);
function pose(ch, t, mode, status, dt) {
  const [la, ra] = ch.arms, [ll, rl] = ch.legs;
  let tLegL = 0, tLegR = 0, tArmL = 0, tArmR = 0, tArmLz = 0.18 * -1, tArmRz = 0.18, headX = 0, headY = 0, headZ = 0, y = 0, breathe = 1 + Math.sin(t * 2.2) * 0.015;
  if (mode === 'walk') {
    const s = Math.sin(t * 9); tLegL = s * 0.6; tLegR = -s * 0.6; tArmL = -s * 0.5; tArmR = s * 0.5; y = Math.abs(Math.cos(t * 9)) * 0.06;
  } else if (mode === 'sit' || mode === 'stand') {
    if (mode === 'sit') { tLegL = tLegR = -Math.PI / 2 + 0.05; y = ch._sy || 0; }
    switch (status) {
      case 'working': tArmL = -1.15 + Math.sin(t * 14) * 0.12; tArmR = -1.15 + Math.cos(t * 14) * 0.12; tArmLz = -0.05; tArmRz = 0.05; headX = 0.12; break;
      case 'browsing': tArmL = -0.9; tArmR = -1.0 + Math.sin(t * 3) * 0.05; tArmLz = -0.05; tArmRz = 0.05; headY = Math.sin(t * 0.9) * 0.18; headX = 0.08; break;
      case 'thinking': tArmR = -2.3; tArmRz = -0.35; headZ = Math.sin(t * 1.2) * 0.1 + 0.12; headX = -0.12; break;
      case 'help': tArmR = -2.9 + Math.sin(t * 7) * 0.25; tArmRz = 0.25; headZ = -0.08; break;
      case 'done': tArmL = tArmR = -2.7; tArmLz = -0.4; tArmRz = 0.4; y += Math.abs(Math.sin(t * 5)) * (mode === 'sit' ? 0.04 : 0.12); break;
      case 'idle': headX = -0.05 + Math.sin(t * 0.7) * 0.06; headZ = Math.sin(t * 0.5) * 0.06; tArmL = tArmR = mode === 'sit' ? -0.5 : 0; break;
    }
  }
  const k = 12;
  ll.rotation.x = damp(ll.rotation.x, tLegL, k, dt); rl.rotation.x = damp(rl.rotation.x, tLegR, k, dt);
  la.rotation.x = damp(la.rotation.x, tArmL, k, dt); ra.rotation.x = damp(ra.rotation.x, tArmR, k, dt);
  la.rotation.z = damp(la.rotation.z, tArmLz, k, dt); ra.rotation.z = damp(ra.rotation.z, tArmRz, k, dt);
  ch.head.rotation.x = damp(ch.head.rotation.x, headX, 6, dt); ch.head.rotation.y = damp(ch.head.rotation.y, headY, 6, dt); ch.head.rotation.z = damp(ch.head.rotation.z, headZ, 6, dt);
  ch.rig.position.y = damp(ch.rig.position.y, y, 14, dt); ch.torso.scale.y = breathe;
}
function animate() {
  const dt = Math.min(clock.getDelta(), 0.05); elapsed += dt; thinkAcc += dt;
  const tickThinking = thinkAcc > 0.45; if (tickThinking) thinkAcc = 0;
  for (const c of chars.values()) {
    const ch = c.ch, root = ch.root; let moving = false;
    if (c.path.length) {
      const p = c.path[0], dx = p.x - root.position.x, dz = p.z - root.position.z, dist = Math.hypot(dx, dz), step = 2.6 * dt;
      if (dist <= step) { root.position.x = p.x; root.position.z = p.z; c.path.shift();
        if (!c.path.length && c.next) { c.path = planPath(c.seat, c.next); c.seat = c.next; c.next = null; } }
      else { root.position.x += dx / dist * step; root.position.z += dz / dist * step; moving = true;
        const want = Math.atan2(dx, dz); let d = want - root.rotation.y; d = Math.atan2(Math.sin(d), Math.cos(d)); root.rotation.y += d * Math.min(1, dt * 10); }
    } else if (c.seat) { let d = c.seat.ry - root.rotation.y; d = Math.atan2(Math.sin(d), Math.cos(d)); root.rotation.y += d * Math.min(1, dt * 6); }
    const t = elapsed + c.phase;
    ch._sy = c.seat?.sy ?? -0.05;
    pose(ch, t, moving ? 'walk' : (c.seat?.pose || 'stand'), c.status, dt);
    if (c.celebrate > 0) { c.celebrate -= dt; ch.rig.rotation.y += dt * 9; } else ch.rig.rotation.y = damp(ch.rig.rotation.y % (Math.PI * 2), 0, 8, dt);
    const lift = (!moving && c.seat && c.seat.col === 0) ? 1.05 : 0;
    ch.bubble.position.y = damp(ch.bubble.position.y, ch.bubble.userData.baseY + lift, 6, dt);
    ch.help.position.y = 4.2 + lift + Math.sin(t * 5) * 0.08;
    ch.ringMat.opacity = c.status === 'help' ? 0.35 + 0.4 * Math.abs(Math.sin(t * 4)) : 0.55;
    if (tickThinking && c.status === 'thinking') { c.tick++; drawBubble(ch.bubble, c.status, c.task, c.tick); }
    const d = desks.get(c.bot.id) || (c.bot.zone === 'director' ? { screen: dirScreen } : null);
    if (d) {
      const atDesk = !moving && c.status !== 'idle' && !c.path.length;
      d.screen.color.set(atDesk ? (STATUS[c.status] || STATUS.idle).color : '#2a2c30');
      if (atDesk) d.screen.color.lerp(new THREE.Color('#e9eef2'), 0.35);
      if (atDesk && c.status === 'help') d.screen.color.multiplyScalar(0.75 + 0.25 * Math.sin(t * 5));
    }
  }
  for (const n of npcs) animateNpc(n, dt, elapsed);
  if (boss) { boss._sy = -0.05; pose(boss, elapsed, 'sit', 'idle', dt); boss.root.rotation.y = Math.sin(elapsed * 0.35) * 0.2; }
  updateConfetti(dt);
  if (flyTo) { flyTo.t += dt; const k = Math.min(1, dt * 3); controls.target.lerp(flyTo.target, k); camera.position.lerp(flyTo.pos, k); if (flyTo.t > 1.5) flyTo = null; }
  controls.update();
  renderer.render(scene, camera);
}
renderer.setAnimationLoop(animate);
controls.addEventListener('start', () => { flyTo = null; });
addEventListener('resize', () => { camera.aspect = innerWidth / innerHeight; homeCamera(); renderer.setSize(innerWidth, innerHeight); });
addEventListener('dblclick', (e) => { if (e.target === renderer.domElement) homeCamera(); });

window.__office = { camera, controls, renderer, scene }; // 调试：截图脚本用来设置视角

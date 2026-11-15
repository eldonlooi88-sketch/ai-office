'use strict';
// AI 团队办公室后端 —— 纯 Node.js，无第三方依赖
const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const ROOT = __dirname;
loadEnv(path.join(ROOT, '.env'));
const PORT = parseInt(process.env.PORT || '8787', 10);
const ON_RENDER = !!process.env.RENDER; // Render 会自动设置 RENDER=true
const HOST = process.env.HOST || (ON_RENDER ? '0.0.0.0' : '127.0.0.1');
const PROXY_MODE = process.env.PROXY_MODE || (ON_RENDER ? 'render' : 'local'); // local: 仅信任本机反代；render: 平台反代
const DATA_DIR = path.resolve(ROOT, process.env.DATA_DIR || 'data');
const PUBLIC_DIR = path.join(ROOT, 'public');
const TRUST_PROXY = process.env.TRUST_PROXY !== '0';
const ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGINS || '').split(',').map(s => s.trim()).filter(Boolean);
const REPORT_LIMIT = parseInt(process.env.REPORT_LIMIT_PER_MIN || '30', 10);
const READ_LIMIT = parseInt(process.env.READ_LIMIT_PER_MIN || '120', 10);
const STATIC_LIMIT = parseInt(process.env.STATIC_LIMIT_PER_MIN || '600', 10);
const AUTH_FAIL_LIMIT = parseInt(process.env.AUTH_FAIL_LIMIT_PER_MIN || '10', 10);
const BTC_TTL_MS = parseInt(process.env.BTC_TTL_SEC || '30', 10) * 1000;
const TASK_MAX = 120;
const BODY_MAX = 2048;

const BOTS_FILE = path.join(DATA_DIR, 'bots.json');
const STATE_FILE = path.join(DATA_DIR, 'state.json');
const TOKENS_FILE = path.join(DATA_DIR, 'tokens.json');

function loadEnv(file) {
  try {
    for (const line of fs.readFileSync(file, 'utf8').split('\n')) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
      if (m && process.env[m[1]] === undefined) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
    }
  } catch (_) {}
}

// ---------- 状态枚举与别名 ----------
const STATUS = ['working', 'thinking', 'browsing', 'help', 'idle', 'done'];
const ALIASES = {
  working: 'working', work: 'working', busy: 'working', '工作中': 'working', '工作': 'working', '忙碌': 'working',
  thinking: 'thinking', think: 'thinking', '思考中': 'thinking', '思考': 'thinking',
  browsing: 'browsing', browse: 'browsing', web: 'browsing', '浏览网页': 'browsing', '浏览': 'browsing', '上网': 'browsing',
  help: 'help', 'need-help': 'help', needhelp: 'help', blocked: 'help', error: 'help', '需要帮助': 'help', '求助': 'help', '帮助': 'help',
  idle: 'idle', rest: 'idle', free: 'idle', '空闲': 'idle', '休息': 'idle', '摸鱼': 'idle',
  done: 'done', finished: 'done', complete: 'done', completed: 'done', '已完成': 'done', '完成': 'done',
};
function normStatus(s) { return typeof s === 'string' ? ALIASES[s.trim().toLowerCase()] || null : null; }

// ---------- 文件读写（原子写） ----------
function readJSON(file, fallback) {
  try { return JSON.parse(fs.readFileSync(file, 'utf8')); } catch (_) { return fallback; }
}
function writeJSONAtomic(file, obj, mode = 0o644) {
  const tmp = `${file}.${process.pid}.${crypto.randomBytes(4).toString('hex')}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(obj, null, 2) + '\n', { mode });
  fs.renameSync(tmp, file);
}

const ID_RE = /^[a-z0-9][a-z0-9_-]{0,31}$/;
const COLOR_RE = /^#[0-9a-fA-F]{6}$/;
function clean(s, max) {
  return String(s == null ? '' : s).replace(/[\u0000-\u001f\u007f-\u009f\u200b-\u200f\u202a-\u202e\u2066-\u2069]/g, ' ')
    .replace(/\s+/g, ' ').trim().slice(0, max);
}

let bots = [];
let botsMtime = 0;
function loadBots() {
  let st; try { st = fs.statSync(BOTS_FILE); } catch (_) { return; }
  if (st.mtimeMs === botsMtime) return;
  const raw = readJSON(BOTS_FILE, null);
  const list = Array.isArray(raw) ? raw : raw && Array.isArray(raw.bots) ? raw.bots : null;
  if (!list) { console.error('[bots] bots.json 解析失败，保留上次名单'); return; }
  const seen = new Set();
  bots = list.filter(b => b && ID_RE.test(String(b.id)) && !seen.has(b.id) && seen.add(b.id)).map(b => ({
    id: String(b.id),
    name: clean(b.name || b.id, 24),
    role: clean(b.role || '', 24),
    color: COLOR_RE.test(b.color) ? b.color : '#' + crypto.createHash('md5').update(b.id).digest('hex').slice(0, 6),
    zone: b.zone === 'director' ? 'director' : 'desk',
    room: typeof b.room === 'string' && ID_RE.test(b.room) ? b.room : '',
  }));
  botsMtime = st.mtimeMs;
  console.log(`[bots] 已加载 ${bots.length} 个 Bot`);
}
let state = readJSON(STATE_FILE, {});
// Token 哈希：优先 data/tokens.json（本地，CLI 轮换即时生效）；不存在时读环境变量 OFFICE_TOKEN_HASHES（云端部署，JSON {botId: sha256hex}）
let envHashes = null;
function tokensMap() {
  if (fs.existsSync(TOKENS_FILE)) return readJSON(TOKENS_FILE, {});
  if (envHashes === null) {
    envHashes = {};
    try { const o = JSON.parse(process.env.OFFICE_TOKEN_HASHES || '{}'); for (const [k, v] of Object.entries(o)) if (ID_RE.test(k) && /^[0-9a-f]{64}$/.test(v)) envHashes[k] = v; }
    catch (_) { console.error('[tokens] OFFICE_TOKEN_HASHES 不是合法 JSON'); }
    console.log(`[tokens] 从环境变量载入 ${Object.keys(envHashes).length} 个 Token 哈希`);
  }
  return envHashes;
}

loadBots();
setInterval(loadBots, 2000).unref();

// ---------- 限流（固定窗口 60s） ----------
const buckets = new Map();
function rateOk(key, limit) {
  const now = Date.now();
  let b = buckets.get(key);
  if (!b || now - b.t >= 60000) { b = { t: now, n: 0 }; buckets.set(key, b); }
  b.n++;
  return b.n <= limit ? 0 : Math.ceil((b.t + 60000 - now) / 1000);
}
setInterval(() => { const now = Date.now(); for (const [k, b] of buckets) if (now - b.t >= 60000) buckets.delete(k); }, 30000).unref();

const IP_RE = /^[0-9a-fA-F:.]{3,45}$/;
function clientIp(req) {
  const remote = req.socket.remoteAddress || '';
  if (!TRUST_PROXY) return remote;
  if (PROXY_MODE === 'render') { // Render 前置 Cloudflare：取平台写入的真实 IP；否则取 XFF 最右（平台追加的）一项
    for (const h of ['cf-connecting-ip', 'true-client-ip']) { const v = (req.headers[h] || '').trim(); if (IP_RE.test(v)) return v; }
    const parts = (req.headers['x-forwarded-for'] || '').split(',').map(x => x.trim()).filter(Boolean);
    const last = parts[parts.length - 1]; return last && IP_RE.test(last) ? last : remote;
  }
  const local = remote === '127.0.0.1' || remote === '::1' || remote === '::ffff:127.0.0.1';
  if (local) {
    const cf = req.headers['cf-connecting-ip'];
    if (cf && IP_RE.test(cf)) return cf;
    const xff = (req.headers['x-forwarded-for'] || '').split(',')[0].trim();
    if (xff && IP_RE.test(xff)) return xff;
  }
  return remote;
}

// ---------- 响应工具 ----------
const CSP = "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data: blob:; connect-src 'self'; font-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'; form-action 'none'";
function secHeaders(res) {
  res.setHeader('Content-Security-Policy', CSP);
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'no-referrer');
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=(), payment=()');
  res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
  res.setHeader('Cross-Origin-Resource-Policy', 'same-origin');
  res.setHeader('Strict-Transport-Security', 'max-age=15552000');
}
function cors(req, res) {
  const o = req.headers.origin;
  if (o && ALLOWED_ORIGINS.includes(o)) {
    res.setHeader('Access-Control-Allow-Origin', o);
    res.setHeader('Vary', 'Origin');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type');
    res.setHeader('Access-Control-Max-Age', '600');
  }
}
function json(res, code, obj, extra = {}) {
  const body = JSON.stringify(obj);
  res.writeHead(code, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', ...extra });
  res.end(body);
}
function tooMany(res, retry) { json(res, 429, { error: '请求过于频繁，请稍后再试' }, { 'Retry-After': String(retry) }); }

// ---------- API ----------
const OFFICE_FILE = path.join(DATA_DIR, 'office.json');
function officeInfo() {
  const o = readJSON(OFFICE_FILE, {}) || {};
  const b = o.boss || {};
  const rooms = {}, npcs = {};
  if (o.rooms && typeof o.rooms === 'object') for (const [k, v] of Object.entries(o.rooms).slice(0, 40)) if (ID_RE.test(k) && typeof v === 'string') rooms[k] = clean(v, 12);
  if (o.npcs && typeof o.npcs === 'object') for (const [k, v] of Object.entries(o.npcs).slice(0, 40)) if (ID_RE.test(k)) npcs[k] = Math.max(0, Math.min(12, parseInt(v, 10) || 0));
  return { title: clean(o.title || 'AI 团队办公室', 30),
    boss: { name: clean(b.name || '老板', 24), title: clean(b.title || '老板', 12), color: COLOR_RE.test(b.color) ? b.color : '#c0392b' }, rooms, npcs };
}
function publicState() {
  return {
    serverTime: new Date().toISOString(),
    office: officeInfo(),
    bots: bots.map(b => {
      const s = state[b.id] || {};
      return { id: b.id, name: b.name, role: b.role, color: b.color, zone: b.zone, room: b.room,
        status: STATUS.includes(s.status) ? s.status : 'idle', task: clean(s.task, TASK_MAX), updatedAt: s.updatedAt || null };
    }),
  };
}

function sha256(s) { return crypto.createHash('sha256').update(s, 'utf8').digest(); }
function verifyToken(botId, token) {
  const map = tokensMap();
  const want = map[botId];
  const got = sha256(token);
  // 始终做一次比较，避免通过耗时差异探测 bot 是否存在
  const ref = want && /^[0-9a-f]{64}$/.test(want) ? Buffer.from(want, 'hex') : crypto.randomBytes(32);
  return crypto.timingSafeEqual(got, ref) && !!want;
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let size = 0; const chunks = [];
    if (parseInt(req.headers['content-length'] || '0', 10) > BODY_MAX) return reject(Object.assign(new Error('too large'), { code: 413 }));
    req.on('data', c => { size += c.length; if (size <= BODY_MAX) chunks.push(c); else if (size > BODY_MAX * 32) req.destroy(); });
    req.on('end', () => size > BODY_MAX ? reject(Object.assign(new Error('too large'), { code: 413 })) : resolve(Buffer.concat(chunks).toString('utf8')));
    req.on('error', reject);
  });
}

async function handleReport(req, res, ip) {
  let retry = rateOk('rep-ip:' + ip, REPORT_LIMIT);
  if (retry) return tooMany(res, retry);
  const fails = buckets.get('authfail:' + ip);
  if (fails && Date.now() - fails.t < 60000 && fails.n >= AUTH_FAIL_LIMIT) return tooMany(res, Math.ceil((fails.t + 60000 - Date.now()) / 1000));
  const ct = (req.headers['content-type'] || '').toLowerCase();
  if (!ct.startsWith('application/json')) return json(res, 415, { error: 'Content-Type 必须为 application/json' });
  const auth = req.headers.authorization || '';
  const m = auth.match(/^Bearer\s+([A-Za-z0-9_\-.~]{16,200})$/);
  let body;
  try { body = JSON.parse(await readBody(req) || '{}'); } catch (e) { if (e.code === 413) res.setHeader('Connection', 'close'); return json(res, e.code === 413 ? 413 : 400, { error: e.code === 413 ? '请求体过大' : 'JSON 格式错误' }); }
  const botId = typeof body.bot === 'string' ? body.bot.trim().toLowerCase() : '';
  if (!m || !ID_RE.test(botId) || !verifyToken(botId, m[1])) {
    rateOk('authfail:' + ip, 1e9);
    return json(res, 401, { error: '鉴权失败' }, { 'WWW-Authenticate': 'Bearer' });
  }
  retry = rateOk('rep-tok:' + botId, REPORT_LIMIT);
  if (retry) return tooMany(res, retry);
  if (!bots.find(b => b.id === botId)) return json(res, 404, { error: '名单中不存在该 Bot（请检查 bots.json）' });
  const status = normStatus(body.status);
  if (!status) return json(res, 400, { error: '无效状态', allowed: STATUS });
  const task = clean(body.task, TASK_MAX);
  state[botId] = { status, task, updatedAt: new Date().toISOString() };
  writeJSONAtomic(STATE_FILE, state);
  return json(res, 200, { ok: true, bot: botId, status, task });
}

// ---------- BTC 行情代理（缓存） ----------
let btcCache = null, btcAt = 0, btcInflight = null;
const btcHistory = [];
async function fetchJSON(url) {
  const r = await fetch(url, { signal: AbortSignal.timeout(8000), headers: { 'User-Agent': 'ai-office/1.0', Accept: 'application/json' } });
  if (!r.ok) throw new Error('HTTP ' + r.status);
  return r.json();
}
async function fetchBtc() {
  try {
    const d = (await fetchJSON('https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&ids=bitcoin'))[0];
    return { price: d.current_price, change24h: d.price_change_percentage_24h, high24h: d.high_24h, low24h: d.low_24h, source: 'CoinGecko' };
  } catch (e) {
    try {
      const d = await fetchJSON('https://api.coinbase.com/v2/prices/BTC-USD/spot');
      const price = Number(d.data.amount); if (!Number.isFinite(price)) throw new Error('bad');
      return { price, change24h: null, high24h: null, low24h: null, source: 'Coinbase' };
    } catch (_) {
      const d = await fetchJSON('https://api.kraken.com/0/public/Ticker?pair=XBTUSD');
      const t = Object.values(d.result || {})[0]; const price = Number(t.c[0]), open = Number(t.o);
      return { price, change24h: open ? (price - open) / open * 100 : null, high24h: Number(t.h[1]), low24h: Number(t.l[1]), source: 'Kraken' };
    }
  }
}
let spark = [], sparkAt = 0;
async function refreshSpark() {
  if (Date.now() - sparkAt < 10 * 60000) return;
  sparkAt = Date.now();
  try {
    const d = await fetchJSON('https://api.coingecko.com/api/v3/coins/bitcoin/market_chart?vs_currency=usd&days=1');
    const pts = (d.prices || []).map(x => x[1]).filter(Number.isFinite);
    const step = Math.max(1, Math.floor(pts.length / 96));
    spark = pts.filter((_, i) => i % step === 0);
  } catch (_) { sparkAt = Date.now() - 8 * 60000; }
}
async function getBtc() {
  refreshSpark().catch(() => {});
  if (btcCache && Date.now() - btcAt < BTC_TTL_MS) return btcCache;
  if (!btcInflight) btcInflight = fetchBtc().then(d => {
    if (typeof d.price !== 'number' || !isFinite(d.price)) throw new Error('bad price');
    btcHistory.push({ t: Date.now(), p: d.price }); if (btcHistory.length > 120) btcHistory.shift();
    btcCache = { ...d, updatedAt: new Date().toISOString(), history: (spark.length ? spark.concat([d.price]) : btcHistory.map(h => h.p)).map(v => Math.round(v * 100) / 100) }; btcAt = Date.now();
    return btcCache;
  }).finally(() => { btcInflight = null; });
  try { return await btcInflight; } catch (e) { if (btcCache) return { ...btcCache, stale: true }; throw e; }
}

// ---------- 静态文件 ----------
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.png': 'image/png', '.svg': 'image/svg+xml', '.ico': 'image/x-icon', '.json': 'application/json', '.webmanifest': 'application/manifest+json' };
function serveStatic(req, res, pathname) {
  let rel;
  try { rel = decodeURIComponent(pathname); } catch (_) { return json(res, 400, { error: 'bad path' }); }
  if (rel.endsWith('/')) rel += 'index.html';
  const file = path.resolve(PUBLIC_DIR, '.' + rel);
  if (!file.startsWith(PUBLIC_DIR + path.sep) || rel.split('/').some(p => p.startsWith('.'))) return json(res, 404, { error: 'Not found' });
  fs.stat(file, (err, st) => {
    if (err || !st.isFile()) return json(res, 404, { error: 'Not found' });
    const ext = path.extname(file);
    res.writeHead(200, { 'Content-Type': MIME[ext] || 'application/octet-stream', 'Content-Length': st.size,
      'Cache-Control': rel.startsWith('/vendor/') ? 'public, max-age=86400' : 'no-cache' });
    if (req.method === 'HEAD') return res.end();
    fs.createReadStream(file).pipe(res);
  });
}

// ---------- 路由 ----------
const server = http.createServer(async (req, res) => {
  secHeaders(res); cors(req, res);
  const ip = clientIp(req);
  let url; try { url = new URL(req.url, 'http://x'); } catch (_) { return json(res, 400, { error: 'bad url' }); }
  const p = url.pathname;
  try {
    if (req.method === 'OPTIONS') { res.writeHead(204); return res.end(); }
    if (p === '/api/state' && req.method === 'GET') {
      const r = rateOk('read:' + ip, READ_LIMIT); if (r) return tooMany(res, r);
      return json(res, 200, publicState());
    }
    if (p === '/api/btc' && req.method === 'GET') {
      const r = rateOk('read:' + ip, READ_LIMIT); if (r) return tooMany(res, r);
      try { return json(res, 200, await getBtc()); } catch (e) { return json(res, 502, { error: '行情暂不可用' }); }
    }
    if (p === '/api/report') {
      if (req.method !== 'POST') return json(res, 405, { error: 'Method Not Allowed' }, { Allow: 'POST' });
      return await handleReport(req, res, ip);
    }
    if (p === '/healthz') return json(res, 200, { ok: true });
    if (p.startsWith('/api/')) return json(res, 404, { error: 'Not found' });
    if (req.method !== 'GET' && req.method !== 'HEAD') return json(res, 405, { error: 'Method Not Allowed' });
    const r = rateOk('static:' + ip, STATIC_LIMIT); if (r) return tooMany(res, r);
    return serveStatic(req, res, p);
  } catch (e) {
    console.error('[err]', e.message);
    if (!res.headersSent) json(res, 500, { error: '服务器错误' });
  }
});
server.headersTimeout = 10000; server.requestTimeout = 15000;
server.listen(PORT, HOST, () => console.log(`[office] 监听 http://${HOST}:${PORT}`));

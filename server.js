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
const CHAT_FILE = path.join(DATA_DIR, 'chat.json');
const CHAT_MAX_PER_BOT = parseInt(process.env.CHAT_MAX_PER_BOT || '200', 10);
const CHAT_TEXT_MAX = 500;
const CHAT_LIMIT = parseInt(process.env.CHAT_LIMIT_PER_MIN || '30', 10);
const DISPATCHER = (process.env.DISPATCHER_BOT || 'grok').trim().toLowerCase(); // 调度 Bot：可读取/代回所有 Bot 的留言

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

// ---------- 老板对话（留言 / 回复） ----------
// 老板口令：只保存 SHA-256 哈希（环境变量 BOSS_TOKEN_HASH，64 位 hex）
function verifyBoss(token) {
  const want = (process.env.BOSS_TOKEN_HASH || '').trim().toLowerCase();
  const ok = /^[0-9a-f]{64}$/.test(want);
  const ref = ok ? Buffer.from(want, 'hex') : crypto.randomBytes(32);
  return crypto.timingSafeEqual(sha256(token), ref) && ok;
}
let chat = readJSON(CHAT_FILE, {}) || {};
if (typeof chat !== 'object' || Array.isArray(chat)) chat = {};
function saveChat() { writeJSONAtomic(CHAT_FILE, chat, 0o600); }
function cleanMsg(s) { // 保留换行，去掉控制字符/方向控制符
  return String(s == null ? '' : s).replace(/\r\n?/g, '\n').replace(/[\u0000-\u0009\u000b-\u001f\u007f-\u009f\u200b-\u200f\u202a-\u202e\u2066-\u2069]/g, ' ')
    .replace(/[ \t]+/g, ' ').replace(/\n{3,}/g, '\n\n').trim().slice(0, CHAT_TEXT_MAX);
}
function thread(botId) { if (!Array.isArray(chat[botId])) chat[botId] = []; return chat[botId]; }
function pushMsg(botId, m) { const t = thread(botId); t.push(m); if (t.length > CHAT_MAX_PER_BOT) t.splice(0, t.length - CHAT_MAX_PER_BOT); saveChat(); }
const MSG_ID_RE = /^m_[A-Za-z0-9_-]{6,40}$/;
const newMsgId = () => 'm_' + Date.now().toString(36) + crypto.randomBytes(5).toString('hex');
function bearer(req) { const m = (req.headers.authorization || '').match(/^Bearer\s+([A-Za-z0-9_\-.~]{16,200})$/); return m ? m[1] : null; }
function authBlocked(res, ip) {
  const f = buckets.get('authfail:' + ip);
  if (f && Date.now() - f.t < 60000 && f.n >= AUTH_FAIL_LIMIT) { tooMany(res, Math.ceil((f.t + 60000 - Date.now()) / 1000)); return true; }
  return false;
}
function authFail(res, ip) { rateOk('authfail:' + ip, 1e9); return json(res, 401, { error: '鉴权失败' }, { 'WWW-Authenticate': 'Bearer' }); }
async function jsonBody(req, res) {
  const ct = (req.headers['content-type'] || '').toLowerCase();
  if (!ct.startsWith('application/json')) { json(res, 415, { error: 'Content-Type 必须为 application/json' }); return null; }
  try { const b = JSON.parse(await readBody(req) || '{}'); return b && typeof b === 'object' ? b : {}; }
  catch (e) { if (e.code === 413) res.setHeader('Connection', 'close'); json(res, e.code === 413 ? 413 : 400, { error: e.code === 413 ? '请求体过大' : 'JSON 格式错误' }); return null; }
}
const pubMsg = m => ({ id: m.id, from: m.from, by: m.by || undefined, text: m.text, at: m.at, status: m.status || undefined, replyTo: m.replyTo || undefined });
const findBot = id => bots.find(b => b.id === id);

// 老板：GET /api/chat?bot=<id> 读线程；POST /api/chat {bot,text} 发留言；POST /api/chat/clear {bot|"all"} 清空
async function handleChat(req, res, ip, url) {
  if (authBlocked(res, ip)) return;
  const retry = rateOk((req.method === 'GET' ? 'chat-read:' : 'chat-send:') + ip, req.method === 'GET' ? READ_LIMIT : CHAT_LIMIT);
  if (retry) return tooMany(res, retry);
  const tok = bearer(req);
  if (req.method === 'GET') {
    if (!tok || !verifyBoss(tok)) return authFail(res, ip);
    const botId = (url.searchParams.get('bot') || '').trim().toLowerCase();
    if (!botId) { // 无 bot 参数：返回各线程未读回复数（用于校验口令）
      const counts = {}; for (const b of bots) counts[b.id] = thread(b.id).length;
      return json(res, 200, { ok: true, counts });
    }
    if (!ID_RE.test(botId) || !findBot(botId)) return json(res, 404, { error: '没有这个成员' });
    return json(res, 200, { bot: botId, messages: thread(botId).map(pubMsg), max: CHAT_MAX_PER_BOT });
  }
  const body = await jsonBody(req, res); if (!body) return;
  if (!tok || !verifyBoss(tok)) return authFail(res, ip);
  const botId = typeof body.bot === 'string' ? body.bot.trim().toLowerCase() : '';
  if (url.pathname === '/api/chat/clear') {
    if (botId === 'all') chat = {}; else if (ID_RE.test(botId)) delete chat[botId]; else return json(res, 400, { error: '缺少 bot' });
    saveChat(); return json(res, 200, { ok: true, cleared: botId });
  }
  if (!ID_RE.test(botId) || !findBot(botId)) return json(res, 404, { error: '没有这个成员' });
  const text = cleanMsg(body.text);
  if (!text) return json(res, 400, { error: '留言不能为空' });
  const m = { id: newMsgId(), from: 'boss', text, at: new Date().toISOString(), status: 'sent' };
  pushMsg(botId, m);
  return json(res, 200, { ok: true, message: pubMsg(m) });
}

// Bot：Bearer=该 Bot 的 Token，参数 bot=<自己的 id>；调度 Bot 可用 for=<id>|all 读取或代回
function botAuth(req, res, ip, botId) {
  const tok = bearer(req);
  if (!tok || !ID_RE.test(botId) || !verifyToken(botId, tok)) { authFail(res, ip); return false; }
  return true;
}
function canActFor(authId, target) { return authId === target || (authId === DISPATCHER && (target === 'all' || !!findBot(target))); }
async function handleInbox(req, res, ip, url) {
  if (authBlocked(res, ip)) return;
  const retry = rateOk('inbox:' + ip, READ_LIMIT); if (retry) return tooMany(res, retry);
  const botId = (url.searchParams.get('bot') || '').trim().toLowerCase();
  if (!botAuth(req, res, ip, botId)) return;
  const target = (url.searchParams.get('for') || botId).trim().toLowerCase();
  if (!canActFor(botId, target)) return json(res, 403, { error: '无权读取该成员的留言' });
  const ids = target === 'all' ? bots.map(b => b.id) : [target];
  const includeAll = url.searchParams.get('all') === '1';
  const out = []; let changed = false;
  for (const id of ids) for (const m of thread(id)) {
    if (m.from !== 'boss' || (!includeAll && m.status === 'answered')) continue;
    if (m.status === 'sent') { m.status = 'seen'; changed = true; }
    out.push({ bot: id, ...pubMsg(m) });
  }
  if (changed) saveChat();
  return json(res, 200, { bot: botId, for: target, messages: out });
}
async function handleReply(req, res, ip) {
  if (authBlocked(res, ip)) return;
  const retry = rateOk('chat-send:' + ip, CHAT_LIMIT); if (retry) return tooMany(res, retry);
  const body = await jsonBody(req, res); if (!body) return;
  const botId = typeof body.bot === 'string' ? body.bot.trim().toLowerCase() : '';
  if (!botAuth(req, res, ip, botId)) return;
  const target = typeof body.as === 'string' && body.as.trim() ? body.as.trim().toLowerCase() : botId;
  if (target === 'all' || !canActFor(botId, target) || !findBot(target)) return json(res, 403, { error: '无权代该成员回复' });
  const text = cleanMsg(body.text);
  if (!text) return json(res, 400, { error: '回复不能为空' });
  let orig = null;
  if (body.replyTo != null) {
    if (typeof body.replyTo !== 'string' || !MSG_ID_RE.test(body.replyTo)) return json(res, 400, { error: 'replyTo 格式错误' });
    orig = thread(target).find(m => m.id === body.replyTo && m.from === 'boss');
    if (!orig) return json(res, 404, { error: '找不到这条留言（可能已被清空）' });
    orig.status = 'answered';
  }
  const m = { id: newMsgId(), from: 'bot', text, at: new Date().toISOString(), ...(orig ? { replyTo: orig.id } : {}), ...(botId !== target ? { by: botId } : {}) };
  pushMsg(target, m);
  return json(res, 200, { ok: true, bot: target, message: pubMsg(m) });
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
    try { // 备用 1：Kraken（含 24h 涨跌）
      const d = await fetchJSON('https://api.kraken.com/0/public/Ticker?pair=XBTUSD');
      const t = Object.values(d.result || {})[0]; const price = Number(t.c[0]), open = Number(t.o);
      if (!Number.isFinite(price)) throw new Error('bad');
      return { price, change24h: open ? (price - open) / open * 100 : null, high24h: Number(t.h[1]), low24h: Number(t.l[1]), source: 'Kraken' };
    } catch (_) { // 备用 2：Coinbase（仅现价）
      const d = await fetchJSON('https://api.coinbase.com/v2/prices/BTC-USD/spot');
      const price = Number(d.data.amount); if (!Number.isFinite(price)) throw new Error('bad');
      return { price, change24h: null, high24h: null, low24h: null, source: 'Coinbase' };
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
    if (p === '/api/chat' || p === '/api/chat/clear') {
      if (req.method !== 'GET' && req.method !== 'POST' || (p === '/api/chat/clear' && req.method !== 'POST')) return json(res, 405, { error: 'Method Not Allowed' });
      return await handleChat(req, res, ip, url);
    }
    if (p === '/api/inbox') {
      if (req.method !== 'GET') return json(res, 405, { error: 'Method Not Allowed' }, { Allow: 'GET' });
      return await handleInbox(req, res, ip, url);
    }
    if (p === '/api/chat/reply') {
      if (req.method !== 'POST') return json(res, 405, { error: 'Method Not Allowed' }, { Allow: 'POST' });
      return await handleReply(req, res, ip);
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

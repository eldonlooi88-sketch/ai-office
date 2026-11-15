#!/usr/bin/env node
'use strict';
// 管理命令：list / add / rotate / remove / init
const fs = require('fs'), path = require('path'), crypto = require('crypto');
const ROOT = path.resolve(__dirname, '..');
const DATA = path.join(ROOT, 'data');
const BOTS = path.join(DATA, 'bots.json'), TOKENS = path.join(DATA, 'tokens.json');
const ID_RE = /^[a-z0-9][a-z0-9_-]{0,31}$/;
const rj = (f, d) => { try { return JSON.parse(fs.readFileSync(f, 'utf8')); } catch (_) { return d; } };
function wj(f, o, mode) { const t = f + '.tmp' + process.pid; fs.writeFileSync(t, JSON.stringify(o, null, 2) + '\n', { mode }); fs.renameSync(t, f); fs.chmodSync(f, mode); }
const newToken = () => 'ofc_' + crypto.randomBytes(24).toString('base64url');
const hash = t => crypto.createHash('sha256').update(t, 'utf8').digest('hex');
function rotate(id) { const m = rj(TOKENS, {}); const t = newToken(); m[id] = hash(t); wj(TOKENS, m, 0o600); return t; }
const getBots = () => { const r = rj(BOTS, { bots: [] }); return Array.isArray(r) ? { bots: r } : r; };
const [cmd, ...a] = process.argv.slice(2);
const usage = `用法:
  office-admin list
  office-admin add <id> <名称> <角色> [#颜色] [desk|director] [房间id，如 secretary/design/admin/purchasing/spare1/spare2/print/craft/store]
  office-admin rotate <id>      # 生成新 Token（只显示一次），旧 Token 立即失效
  office-admin remove <id>
  office-admin env-hashes        # 输出云端部署用的 OFFICE_TOKEN_HASHES（只含哈希，不含明文 Token）`;
if (cmd === 'list') {
  const tk = rj(TOKENS, {});
  for (const b of getBots().bots) console.log(`${b.id.padEnd(12)} ${String(b.name).padEnd(12)} ${String(b.role).padEnd(8)} ${b.color} ${b.zone || 'desk'} ${b.room || '-'}  token:${tk[b.id] ? '已设置' : '未设置'}`);
} else if (cmd === 'add') {
  const [id, name, role, color, zone, room] = a;
  if (!id || !ID_RE.test(id) || !name) { console.error(usage); process.exit(1); }
  const d = getBots();
  if (d.bots.find(b => b.id === id)) { console.error('该 id 已存在'); process.exit(1); }
  d.bots.push({ id, name, role: role || '', color: /^#[0-9a-f]{6}$/i.test(color || '') ? color : '#' + crypto.randomBytes(3).toString('hex'), zone: zone === 'director' ? 'director' : 'desk', ...(room && ID_RE.test(room) ? { room } : {}) });
  wj(BOTS, d, 0o644);
  console.log(`已添加 ${id}。Token（仅显示一次，请妥善保存）:\n${rotate(id)}`);
} else if (cmd === 'rotate') {
  const id = a[0];
  if (!getBots().bots.find(b => b.id === id)) { console.error('名单中没有该 id'); process.exit(1); }
  console.log(`${id} 的新 Token（仅显示一次）:\n${rotate(id)}`);
} else if (cmd === 'remove') {
  const id = a[0]; const d = getBots(); d.bots = d.bots.filter(b => b.id !== id); wj(BOTS, d, 0o644);
  const m = rj(TOKENS, {}); delete m[id]; wj(TOKENS, m, 0o600); console.log('已移除 ' + id);
} else if (cmd === 'init') {
  // 为所有尚无 Token 的 Bot 生成 Token，写入 SECRETS-initial-tokens.txt (600)
  const m = rj(TOKENS, {}); const out = [];
  for (const b of getBots().bots) if (!m[b.id]) out.push(`${b.id}=${rotate(b.id)}`);
  if (out.length) { const f = path.join(ROOT, 'SECRETS-initial-tokens.txt'); fs.appendFileSync(f, out.join('\n') + '\n', { mode: 0o600 }); fs.chmodSync(f, 0o600); console.log(`已为 ${out.length} 个 Bot 生成 Token，写入 ${f}`); }
  else console.log('所有 Bot 均已有 Token');
} else if (cmd === 'env-hashes') {
  const m = rj(TOKENS, {}); const ids = new Set(getBots().bots.map(b => b.id)); const o = {};
  for (const [k, v] of Object.entries(m)) if (ids.has(k) && /^[0-9a-f]{64}$/.test(v)) o[k] = v;
  console.log(JSON.stringify(o));
} else { console.log(usage); }

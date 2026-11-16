#!/usr/bin/env node
'use strict';
// office-chat —— 老板留言收件箱 / 回复工具
// Token 来源（优先级）：环境变量 OFFICE_TOKEN_<BOT> > ~/.office-report > <项目>/SECRETS-initial-tokens.txt
// 老板口令：环境变量 BOSS_TOKEN > <项目>/SECRETS-boss-token.txt
// 服务器地址：环境变量 OFFICE_URL > ~/.office-report > https://ai-office-vk1v.onrender.com
const fs = require('fs'), path = require('path'), os = require('os');
const ROOT = path.resolve(fs.realpathSync(__filename), '..', '..');
const DISPATCHER = (process.env.DISPATCHER_BOT || 'grok').toLowerCase();
function kv(file) {
  const o = {};
  try { for (const l of fs.readFileSync(file, 'utf8').split('\n')) { const m = l.match(/^\s*([A-Za-z0-9_-]+)\s*=\s*(\S+)\s*$/); if (m) o[m[1]] = m[2]; } } catch (_) {}
  return o;
}
const conf = kv(process.env.OFFICE_REPORT_CONFIG || path.join(os.homedir(), '.office-report'));
const secrets = kv(path.join(ROOT, 'SECRETS-initial-tokens.txt'));
const URL_ = (process.env.OFFICE_URL || conf.OFFICE_URL || 'https://ai-office-vk1v.onrender.com').replace(/\/+$/, '');
function botToken(id) {
  const v = 'OFFICE_TOKEN_' + id.toUpperCase().replace(/-/g, '_');
  const t = process.env[v] || conf[v] || secrets[id];
  if (!t) die(`缺少 ${id} 的 Token：请设置 ${v}，或在 ${path.join(ROOT, 'SECRETS-initial-tokens.txt')} 中提供 ${id}=...`);
  return t;
}
function bossToken() {
  const t = process.env.BOSS_TOKEN || kv(path.join(ROOT, 'SECRETS-boss-token.txt')).BOSS_TOKEN;
  if (!t) die('缺少老板口令：请设置 BOSS_TOKEN 或提供 SECRETS-boss-token.txt');
  return t;
}
function die(msg, code = 2) { console.error('✗ ' + msg); process.exit(code); }
async function call(method, p, token, body) {
  let r;
  try {
    r = await fetch(URL_ + p, { method, signal: AbortSignal.timeout(60000),
      headers: { Authorization: 'Bearer ' + token, ...(body ? { 'Content-Type': 'application/json' } : {}) },
      body: body ? JSON.stringify(body) : undefined });
  } catch (e) { die(`连接 ${URL_} 失败：${e.message}（免费实例休眠时首次请求约需 30-60 秒）`, 1); }
  const txt = await r.text(); let d; try { d = JSON.parse(txt); } catch (_) { d = { raw: txt }; }
  if (!r.ok) die(`HTTP ${r.status}：${d.error || txt}`, 1);
  return d;
}
const fmtT = s => new Date(s).toLocaleString('zh-CN', { hour12: false, timeZone: process.env.TZ || 'Asia/Kuala_Lumpur' });
const ST = { sent: '未读', seen: '已读', answered: '已回复' };
const usage = `用法:
  office-chat inbox <bot> [--all]        查看该 Bot 未回复的老板留言（--all 含已回复）；查看后标记为“已读”
  office-chat inbox --all                用调度 Bot（${DISPATCHER}）的 Token 查看所有成员的未回复留言
  office-chat reply <bot> <msgId> "内容"  以该 Bot 身份回复某条留言（标记为“已回复”）
  office-chat say <bot> "内容"            以该 Bot 身份主动给老板发消息（不针对某条留言）
    以上命令加 --via ${DISPATCHER}：用调度 Bot 的 Token 代为读取/回复（适用于没有独立 Agent 的岗位）
  office-chat thread <bot>               （老板口令）查看完整对话
  office-chat send <bot> "内容"           （老板口令）以老板身份留言（测试用）
  office-chat clear <bot|all>            （老板口令）清空对话
  选项 --json 输出原始 JSON
服务器: ${URL_}`;

(async () => {
  const argv = process.argv.slice(2);
  const flags = new Set(argv.filter(a => a === '--all' || a === '--json'));
  let via = null; const pos = [];
  for (let i = 0; i < argv.length; i++) { if (argv[i] === '--via') via = (argv[++i] || '').toLowerCase(); else if (!flags.has(argv[i])) pos.push(argv[i]); }
  const [cmd, a1, a2, ...rest] = pos;
  const asJson = flags.has('--json');
  const id = (a1 || '').toLowerCase();
  if (cmd === 'inbox') {
    let auth, target, all = false;
    if (!id) { if (!flags.has('--all')) die(usage); auth = via || DISPATCHER; target = 'all'; }
    else { auth = via || id; target = id; all = flags.has('--all'); }
    const q = `/api/inbox?bot=${encodeURIComponent(auth)}&for=${encodeURIComponent(target)}${all ? '&all=1' : ''}`;
    const d = await call('GET', q, botToken(auth));
    if (asJson) return console.log(JSON.stringify(d, null, 2));
    if (!d.messages.length) return console.log(`（${target === 'all' ? '所有成员' : target} 没有待回复的留言）`);
    for (const m of d.messages) console.log(`[${m.bot}] ${m.id}  ${fmtT(m.at)}  ${ST[m.status] || m.status || ''}\n  ${m.text.replace(/\n/g, '\n  ')}`);
    console.log(`\n共 ${d.messages.length} 条。回复：office-chat reply <bot> <msgId> "内容"`);
  } else if (cmd === 'reply' || cmd === 'say') {
    const text = cmd === 'reply' ? [...rest].join(' ') : [a2, ...rest].filter(x => x != null).join(' ');
    if (!id || !text || (cmd === 'reply' && !a2)) die(usage);
    const auth = via || id;
    const d = await call('POST', '/api/chat/reply', botToken(auth), { bot: auth, ...(auth !== id ? { as: id } : {}), ...(cmd === 'reply' ? { replyTo: a2 } : {}), text });
    console.log(asJson ? JSON.stringify(d, null, 2) : `✓ 已发送（${d.bot}）：${d.message.id}`);
  } else if (cmd === 'thread') {
    if (!id) die(usage);
    const d = await call('GET', '/api/chat?bot=' + encodeURIComponent(id), bossToken());
    if (asJson) return console.log(JSON.stringify(d, null, 2));
    if (!d.messages.length) return console.log('（暂无对话）');
    for (const m of d.messages) console.log(`${fmtT(m.at)}  ${m.from === 'boss' ? '老板' : id + (m.by ? `（由 ${m.by} 代回）` : '')}  ${m.id}${m.status ? ' · ' + (ST[m.status] || m.status) : ''}\n  ${m.text.replace(/\n/g, '\n  ')}`);
  } else if (cmd === 'send') {
    const text = [a2, ...rest].filter(x => x != null).join(' ');
    if (!id || !text) die(usage);
    const d = await call('POST', '/api/chat', bossToken(), { bot: id, text });
    console.log(asJson ? JSON.stringify(d, null, 2) : `✓ 已留言给 ${id}：${d.message.id}`);
  } else if (cmd === 'clear') {
    if (!id) die(usage);
    await call('POST', '/api/chat/clear', bossToken(), { bot: id });
    console.log(`✓ 已清空 ${id} 的对话`);
  } else { console.log(usage); }
})();

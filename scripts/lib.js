// 榜单的计算规则。登榜（submit.js）和建站（build.js）共用。
'use strict';

const REALMS = ['炼气期', '筑基期', '金丹期', '元婴期', '化神期', '渡劫期', '大乘期', '飞升'];
// 各境界所需修为，和游戏里一致；榜上按累计修为折算境界
const NEED = [300, 900, 2400, 6000, 14000, 30000, 60000];
const MAX_DAYS = 400;

function parseSeal(text) {
  const m = /XIUXIAN1\.([A-Za-z0-9_-]+)/.exec(String(text || ''));
  if (!m) throw new Error('没有找到灵契。请粘贴 npx cyber-immortal 输出的、以 XIUXIAN1. 开头的整段文字。');
  let o;
  try { o = JSON.parse(Buffer.from(m[1], 'base64url').toString('utf8')); } catch {
    throw new Error('灵契读不出来，可能复制的时候少了一截。');
  }
  if (!o || o.app !== 'cyber-xiuxian' || !Array.isArray(o.days)) throw new Error('这不是赛博修仙录的灵契。');
  return o;
}

const num = (v, max) => {
  const n = Number(v);
  return Number.isFinite(n) ? Math.min(Math.max(n, 0), max) : 0;
};

// 只收真实日期、不晚于明天的修行日；数字限定在合理范围
function cleanDays(days, now = new Date()) {
  const limit = new Date(now.getTime() + 36 * 3600e3).toISOString().slice(0, 10);
  const out = {};
  for (const d of days) {
    if (!d || typeof d.d !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(d.d)) continue;
    if (d.d > limit || d.d < '2023-01-01') continue;
    out[d.d] = {
      tok: Math.round(num(d.tok, 100000) * 10) / 10,
      r: Math.round(num(d.r, 5000)),
      late: Math.round(num(d.late, 7) * 10) / 10,
      h: Math.round(num(d.h, 500)),
    };
  }
  return out;
}

function cleanName(s, fallback) {
  const n = String(s || '').replace(/[<>&"'`\u0000-\u001f]/g, '').trim().slice(0, 12);
  return n || fallback;
}

function mergePlayer(prev, { login, name, days, now = new Date() }) {
  const p = prev || { login, joined: now.toISOString(), days: {} };
  p.login = login;
  p.name = cleanName(name, p.name || login);
  Object.assign(p.days, days);
  const keys = Object.keys(p.days).sort();
  for (const k of keys.slice(0, Math.max(0, keys.length - MAX_DAYS))) delete p.days[k];
  p.updated = now.toISOString();
  return p;
}

function dayXw(x) {
  const late = Math.round(x.late);
  return 60 * Math.sqrt(x.tok) * (1 + 0.15 * late);
}

function realmOf(xw) {
  let left = xw;
  for (let i = 0; i < NEED.length; i++) {
    if (left < NEED[i]) return { i, name: REALMS[i], progress: left / NEED[i] };
    left -= NEED[i];
  }
  return { i: 7, name: REALMS[7], progress: 1 };
}

function stats(p) {
  const keys = Object.keys(p.days).sort();
  let xw = 0, tok = 0, yx = 0, h = 0, r = 0, nights = 0, maxLate = 0;
  for (const k of keys) {
    const x = p.days[k];
    xw += dayXw(x); tok += x.tok; r += x.r; h += x.h;
    const late = Math.round(x.late);
    yx += late * 10;
    if (late > 0) nights++;
    maxLate = Math.max(maxLate, x.late);
  }
  const realm = realmOf(xw);
  return {
    login: p.login,
    name: p.name,
    xw: Math.round(xw),
    realm: realm.i,
    realmName: realm.name,
    progress: Math.round(realm.progress * 100) / 100,
    tok: Math.round(tok * 10) / 10,
    yx, h, r, nights,
    maxLate: Math.round(maxLate * 10) / 10,
    days: keys.length,
    first: keys[0] || null,
    last: keys[keys.length - 1] || null,
    updated: p.updated,
    recent: keys.slice(-30).map(k => ({ d: k, ...p.days[k] })),
  };
}

function buildBoard(players, now = new Date()) {
  const list = players.map(stats).sort((a, b) => b.xw - a.xw);
  return { updated: now.toISOString(), players: list };
}

module.exports = { REALMS, NEED, parseSeal, cleanDays, cleanName, mergePlayer, stats, buildBoard, realmOf };

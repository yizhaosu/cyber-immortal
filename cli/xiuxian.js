#!/usr/bin/env node
// 赛博修仙录 Cyber Immortal · 本地灵契生成器
// 读取本机 Claude Code / Codex 的日志，按「修行日」汇总 token、对话轮数、熬夜时长，
// 生成一段「灵契」交给游戏导入。只输出每日汇总数字，不读取也不上传任何对话内容。
'use strict';
const fs = require('fs');
const path = require('path');
const os = require('os');

const argv = process.argv.slice(2);
const opt = { days: 30, out: null, json: false, claudeDir: null, codexDir: null };
for (let i = 0; i < argv.length; i++) {
  const a = argv[i];
  if (a === '--days') opt.days = Math.max(1, parseInt(argv[++i], 10) || 30);
  else if (a === '--out') opt.out = argv[++i];
  else if (a === '--json') opt.json = true;
  else if (a === '--claude-dir') opt.claudeDir = argv[++i];
  else if (a === '--codex-dir') opt.codexDir = argv[++i];
  else if (a === '-h' || a === '--help') {
    console.log(`用法: npx cyber-immortal [选项]

  --days N          汇总最近 N 天（默认 30）
  --out 文件        把灵契写入文件
  --json            输出原始 JSON 而不是灵契
  --claude-dir 目录 Claude Code 日志目录（默认 ~/.claude/projects）
  --codex-dir 目录  Codex 日志目录（默认 ~/.codex/sessions）

每个「修行日」从早上 6 点算到次日早上 6 点，所以凌晨 2 点的活动算作前一天的熬夜。`);
    process.exit(0);
  }
}

const home = os.homedir();
const uniq = a => [...new Set(a.filter(Boolean))];
const claudeDirs = uniq([
  opt.claudeDir,
  process.env.CLAUDE_CONFIG_DIR && path.join(process.env.CLAUDE_CONFIG_DIR, 'projects'),
  path.join(home, '.claude', 'projects'),
  path.join(home, '.config', 'claude', 'projects'),
]).filter(d => fs.existsSync(d));
const codexDirs = uniq([
  opt.codexDir,
  path.join(process.env.CODEX_HOME || path.join(home, '.codex'), 'sessions'),
]).filter(d => fs.existsSync(d));

function walk(dir, out = []) {
  let ents;
  try { ents = fs.readdirSync(dir, { withFileTypes: true }); } catch { return out; }
  for (const e of ents) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, out);
    else if (e.isFile() && e.name.endsWith('.jsonl')) out.push(p);
  }
  return out;
}
function* lines(file) {
  let txt;
  try { txt = fs.readFileSync(file, 'utf8'); } catch { return; }
  for (const l of txt.split('\n')) {
    if (!l.trim()) continue;
    try { yield JSON.parse(l); } catch { /* 跳过坏行 */ }
  }
}

const since = Date.now() - opt.days * 86400e3;
const pad = n => String(n).padStart(2, '0');
// 修行日：早上 6 点切日
function dayKey(t) {
  const x = new Date(t.getTime() - 6 * 3600e3);
  return `${x.getFullYear()}-${pad(x.getMonth() + 1)}-${pad(x.getDate())}`;
}
// 晚于 23:00 的小时数（0:00 记为 1，5:59 约为 7）
function lateHours(t) {
  const h = t.getHours() + t.getMinutes() / 60;
  if (h >= 23) return h - 23;
  if (h < 6) return h + 1;
  return 0;
}
const HALL = /(不对|错了|又错|搞错|幻觉|瞎编|胡编|编的吧|不存在|没有这个|根本没有|wrong|incorrect|hallucinat|doesn'?t exist|does not exist|that'?s not right|not what i asked)/i;

const days = new Map();
function day(t) {
  const k = dayKey(t);
  if (!days.has(k)) days.set(k, { d: k, tok: 0, cache: 0, out: 0, rounds: 0, hall: 0, tools: 0, late: 0, models: {}, src: new Set() });
  return days.get(k);
}
function touch(D, t) { D.late = Math.max(D.late, lateHours(t)); }
function userText(c) {
  if (typeof c === 'string') return c;
  if (!Array.isArray(c)) return null;
  if (c.some(x => x && x.type === 'tool_result')) return null;
  const s = c.filter(x => x && x.type === 'text').map(x => x.text || '').join('\n');
  return s || null;
}

// ---------- Claude Code ----------
const seen = new Set();
let claudeFiles = 0;
for (const dir of claudeDirs) {
  for (const f of walk(dir)) {
    try { if (fs.statSync(f).mtimeMs < since) continue; } catch { continue; }
    claudeFiles++;
    for (const o of lines(f)) {
      if (!o || !o.timestamp) continue;
      const t = new Date(o.timestamp);
      if (isNaN(t) || t.getTime() < since) continue;
      if (o.type === 'assistant' && o.message && o.message.usage) {
        const id = `${o.message.id || ''}:${o.requestId || ''}`;
        if (id !== ':' && seen.has(id)) continue;
        seen.add(id);
        const u = o.message.usage, D = day(t);
        D.tok += (u.input_tokens || 0) + (u.output_tokens || 0) + (u.cache_creation_input_tokens || 0);
        D.cache += u.cache_read_input_tokens || 0;
        D.out += u.output_tokens || 0;
        if (Array.isArray(o.message.content)) D.tools += o.message.content.filter(x => x && x.type === 'tool_use').length;
        const m = o.message.model;
        if (m && m !== '<synthetic>') D.models[m] = (D.models[m] || 0) + 1;
        D.src.add('claude'); touch(D, t);
      } else if (o.type === 'user' && o.message && !o.isMeta && !o.isSidechain) {
        const s = userText(o.message.content);
        if (!s || /^\s*<(command|local-command)/.test(s)) continue;
        const D = day(t);
        D.rounds++;
        if (HALL.test(s.slice(0, 600))) D.hall++;
        D.src.add('claude'); touch(D, t);
      }
    }
  }
}

// ---------- Codex ----------
let codexFiles = 0;
for (const dir of codexDirs) {
  for (const f of walk(dir)) {
    try { if (fs.statSync(f).mtimeMs < since) continue; } catch { continue; }
    codexFiles++;
    let prevTotal = -1, model = null;
    for (const o of lines(f)) {
      if (!o || !o.timestamp || !o.payload) continue;
      const t = new Date(o.timestamp);
      if (isNaN(t)) continue;
      const p = o.payload;
      if (o.type === 'turn_context' && p.model) model = p.model;
      if (t.getTime() < since) continue;
      if (o.type === 'event_msg' && p.type === 'token_count' && p.info) {
        const tot = p.info.total_token_usage && p.info.total_token_usage.total_tokens;
        if (tot != null && tot === prevTotal) continue;
        if (tot != null) prevTotal = tot;
        const u = p.info.last_token_usage;
        if (!u) continue;
        const D = day(t), cached = u.cached_input_tokens || 0;
        D.tok += Math.max(0, (u.input_tokens || 0) - cached) + (u.output_tokens || 0);
        D.cache += cached;
        D.out += u.output_tokens || 0;
        if (model) D.models[model] = (D.models[model] || 0) + 1;
        D.src.add('codex'); touch(D, t);
      } else if (o.type === 'event_msg' && p.type === 'user_message') {
        const D = day(t);
        D.rounds++;
        if (typeof p.message === 'string' && HALL.test(p.message.slice(0, 600))) D.hall++;
        D.src.add('codex'); touch(D, t);
      } else if (o.type === 'response_item' && (p.type === 'function_call' || p.type === 'local_shell_call' || p.type === 'custom_tool_call')) {
        day(t).tools++;
      }
    }
  }
}

// ---------- 汇总 ----------
const r1 = x => Math.round(x * 10) / 10;
const out = [...days.values()]
  .filter(D => D.tok > 0 || D.rounds > 0)
  .sort((a, b) => a.d.localeCompare(b.d))
  .map(D => {
    const top = Object.entries(D.models).sort((a, b) => b[1] - a[1])[0];
    return {
      d: D.d,
      tok: r1(D.tok / 1e4),            // 万 token（不含缓存命中）
      cache: r1(D.cache / 1e4),        // 万 token 缓存命中，只做展示
      r: D.rounds,
      h: D.hall,
      late: r1(D.late),
      fa: D.rounds && D.tools / D.rounds > 12 ? 'agent' : 'code',
      m: top ? top[0] : null,
      src: [...D.src],
    };
  });

const seal = { v: 1, app: 'cyber-xiuxian', gen: new Date().toISOString(), days: out };
const code = 'XIUXIAN1.' + Buffer.from(JSON.stringify(seal), 'utf8').toString('base64url');

if (opt.json) { console.log(JSON.stringify(seal, null, 2)); process.exit(0); }

const err = s => process.stderr.write(s + '\n');
if (!claudeDirs.length && !codexDirs.length) {
  err('没找到 Claude Code（~/.claude/projects）或 Codex（~/.codex/sessions）的日志。可以用 --claude-dir / --codex-dir 指定目录。');
  process.exit(1);
}
err(`扫描了 ${claudeFiles} 个 Claude Code 日志、${codexFiles} 个 Codex 日志，最近 ${opt.days} 天共 ${out.length} 个修行日。\n`);
err('日期         Token(万)  对话  熬夜(时)  幻觉  法门');
for (const x of out) {
  err(`${x.d}  ${String(x.tok).padStart(9)}  ${String(x.r).padStart(4)}  ${String(x.late).padStart(8)}  ${String(x.h).padStart(4)}  ${x.fa === 'agent' ? '符箓修' : '剑修'}`);
}
const sum = out.reduce((s, x) => s + x.tok, 0);
err(`\n累计焚香 ${r1(sum)} 万 Token（不含缓存命中）。`);
if (opt.out) {
  fs.writeFileSync(opt.out, code + '\n');
  err(`灵契已写入 ${opt.out}，在游戏里点「导入灵契」上传这个文件。`);
} else {
  err('把下面这一整段灵契复制到游戏的「导入灵契」里：\n');
  console.log(code);
}

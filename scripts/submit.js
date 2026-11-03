// 处理一条「登榜」issue：解析灵契、合并进 data/players/<login>.json，并写出回复内容。
// 输入全部来自环境变量（ISSUE_TITLE / ISSUE_BODY / ISSUE_USER），不经过 shell 拼接。
'use strict';
const fs = require('fs');
const path = require('path');
const { parseSeal, cleanDays, mergePlayer, stats } = require('./lib');

const SITE = process.env.SITE_URL || 'https://yizhaosu.github.io/cyber-immortal';
const root = path.join(__dirname, '..');
const outDir = path.join(root, 'out');
fs.mkdirSync(outDir, { recursive: true });

function finish(ok, msg) {
  fs.writeFileSync(path.join(outDir, 'comment.md'), msg + '\n\n---\n_赛博修仙录 · 登榜机器人_\n');
  fs.writeFileSync(path.join(outDir, 'status'), ok ? 'ok' : 'fail');
  console.log(ok ? 'ok' : 'fail', '\n' + msg);
}

try {
  const login = String(process.env.ISSUE_USER || '');
  if (!/^[A-Za-z0-9-]{1,39}$/.test(login)) throw new Error('无法识别提交者的 GitHub 账号。');
  const title = String(process.env.ISSUE_TITLE || '');
  const name = title.replace(/^\s*登榜\s*[·:：\-]?\s*/, '');
  const seal = parseSeal(process.env.ISSUE_BODY);
  const days = cleanDays(seal.days);
  const n = Object.keys(days).length;
  if (!n) throw new Error('灵契里没有可以登榜的修行日。示例灵契不能登榜，请先用 npx cyber-immortal 生成你自己的。');

  const file = path.join(root, 'data', 'players', login + '.json');
  const prev = fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, 'utf8')) : null;
  const p = mergePlayer(prev, { login, name, days });
  fs.writeFileSync(file, JSON.stringify(p, null, 1) + '\n');
  const s = stats(p);
  finish(true, [
    `**${s.name}** 登榜成功，收录了 ${n} 个修行日。`,
    '',
    `- 境界：**${s.realmName}**（榜上修为 ${s.xw}）`,
    `- 累计焚香：${s.tok} 万 Token`,
    `- 夜修值：${s.yx}，熬夜 ${s.nights} 晚，最晚到 23 点后 ${s.maxLate} 小时`,
    '',
    `榜单大约一两分钟后更新。你的主页：${SITE}/board.html?u=${login}`,
    '',
    '以后想更新成绩，再提交一次新的灵契就行，同一天的数据会被覆盖。',
  ].join('\n'));
} catch (e) {
  finish(false, `登榜没有成功：${e.message}\n\n可以在游戏里重新导入最新的灵契，再点一次「登榜」。`);
}

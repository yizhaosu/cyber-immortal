// 生成要部署的网站：复制 web/，再把 data/players/*.json 汇总成 data/leaderboard.json。
'use strict';
const fs = require('fs');
const path = require('path');
const { buildBoard } = require('./lib');

const root = path.join(__dirname, '..');
const site = path.join(root, '_site');
fs.rmSync(site, { recursive: true, force: true });
fs.cpSync(path.join(root, 'web'), site, { recursive: true });

// web/index.html 和 claude.ai 上的版本共用一份源码，没有自己的 <head>；部署时补上文档外壳
const idx = path.join(site, 'index.html');
const html = fs.readFileSync(idx, 'utf8');
if (!/^\s*<!doctype/i.test(html)) {
  fs.writeFileSync(idx, '<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"></head><body>\n' + html + '\n</body></html>\n');
}

const dir = path.join(root, 'data', 'players');
const players = [];
for (const f of fs.existsSync(dir) ? fs.readdirSync(dir) : []) {
  if (!f.endsWith('.json')) continue;
  try { players.push(JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8'))); } catch (e) {
    console.warn('跳过损坏的存档', f, e.message);
  }
}
fs.mkdirSync(path.join(site, 'data'), { recursive: true });
fs.writeFileSync(path.join(site, 'data', 'leaderboard.json'), JSON.stringify(buildBoard(players)));
console.log(`已生成网站，榜上 ${players.length} 人。`);

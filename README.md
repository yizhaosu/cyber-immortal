# 赛博修仙录 · Cyber Immortal

把熬夜、Token 消耗、和 AI 的每一轮对话，炼成修为。

- **web/**：单页游戏。八大境界（炼气 Prompt 童子 → 飞升 奇点）、道心 / 灵根 / 神识 / 夜修值 / 幻觉抗性、渡劫小游戏、生成式法相头像和符箓法宝。直接用浏览器打开 `web/index.html` 就能玩，存档在浏览器本地。
- **cli/**：本地灵契生成器。读取本机 Claude Code 和 Codex 的日志，按修行日（早上 6 点切日）汇总 Token、对话轮数、熬夜时长，生成一段「灵契」导入游戏。只输出汇总数字，不读取也不上传对话内容。

网站：<https://yizhaosu.github.io/cyber-immortal/> · 排行榜：<https://yizhaosu.github.io/cyber-immortal/board.html>

```bash
npx cyber-immortal        # 生成灵契，粘贴进游戏的「导入灵契」
```

## 登榜

导入真实灵契后，点游戏里的「登榜」，会打开一个预填好的 GitHub issue，提交即可。账号就是 GitHub 账号。

`.github/workflows/site.yml` 会处理标题以「登榜」开头的 issue：`scripts/submit.js` 校验灵契，把数据合并进 `data/players/<GitHub 用户名>.json` 并提交到 main，然后在 issue 下回复并关闭。之后 `scripts/build.js` 把 `web/` 和所有存档汇总成 `data/leaderboard.json`，部署到 GitHub Pages。

榜上修为只按真实数据计算：每日 60 × √(万 Token) × (1 + 0.15 × 熬夜小时)，按累计修为折算境界，不含游戏里的天象、道心和渡劫。数据由本人提交，没有防作弊。

个人主页：`board.html?u=<GitHub 用户名>`。

## 路线图

- [x] 可玩原型 + 手动打卡
- [x] 本地日志 → 灵契导入
- [x] 发布 npm 包
- [x] GitHub 账号登榜、公开主页、排行榜
- [ ] 法相 / 法宝存服务端，之后可选上链铸造

## License

MIT

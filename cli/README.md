# 赛博修仙录 Cyber Immortal · 本地灵契生成器

读取本机 Claude Code（`~/.claude/projects`）和 Codex（`~/.codex/sessions`）的日志，按修行日汇总，生成一段「灵契」，粘贴进赛博修仙录游戏的「导入灵契」即可。

```bash
node xiuxian.js            # 发布到 npm 后：npx cyber-immortal
node xiuxian.js --days 7   # 只算最近 7 天
node xiuxian.js --out seal.txt
node xiuxian.js --json     # 查看原始汇总数据
```

## 算了什么

| 字段 | 来源 |
|---|---|
| tok（万 Token） | 输入 + 输出 + 缓存写入；缓存命中单独记在 cache，不计修为 |
| r（对话轮数） | 你亲手发出的消息数，不含工具返回 |
| late（熬夜小时） | 当天最后一次 AI 活动晚于 23:00 的小时数；修行日早上 6 点切换 |
| h（幻觉次数） | 你的消息里出现「不对 / 错了 / 不存在 / wrong」等字样的次数，只在本地匹配 |
| fa（法门） | 平均每轮工具调用超过 12 次算符箓修（跑 Agent），否则算剑修 |

隐私：脚本只输出每日汇总数字，不输出、不上传任何对话内容。零依赖，Node 18+。

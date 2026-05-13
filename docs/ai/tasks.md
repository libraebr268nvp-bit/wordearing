# WordWiz — 任务跟踪

> 记录已完成功能、已知 Bug、待开发功能。

---

## ✅ 已完成功能

| 功能 | 页面 | 文件 | 状态 |
|------|------|------|------|
| 词书筛选 | 首页 | `home.js` | ✅ |
| 分类筛选（全部/四级/六级/半导体专业/其他） | 首页、收藏夹 | `categoryFilter.js` | ✅ |
| 模糊搜索（300ms 防抖 + 定位） | 首页 | `home.js` | ✅ |
| 单元展开/折叠 | 首页 | `unitCard.js` | ✅ |
| 单元内混序 | 首页 | `unitCard.js` | ✅ |
| 全局混序（跨单元 + 跨页面保持） | 首页 | `home.js` + `AppState` | ✅ (v5) |
| 熟悉度系统（0~5，✓ 按钮） | 所有页面 | `wordCard.js` | ✅ |
| 收藏/取消收藏（⭐ 按钮） | 所有页面 | `wordCard.js` | ✅ |
| 收藏夹独立展示 | 收藏夹 | `favorites.js` | ✅ |
| 收藏夹排序（默认/熟悉度↑/↓） | 收藏夹 | `favorites.js` | ✅ |
| 收藏夹混序 | 收藏夹 | `favorites.js` | ✅ |
| 软删除 → 回收站 | 所有页面 | `wordCard.js` + `db.js` | ✅ |
| 回收站恢复 | 回收站 | `trash.js` | ✅ |
| 回收站永久删除 | 回收站 | `trash.js` | ✅ |
| 回收站 30 天自动清理 | 启动时 | `db.js` | ✅ |
| 统计仪表盘（总数/平均熟悉度/收藏数/回收站） | 设置 | `stats.js` | ✅ |
| 7 天学习趋势图 | 设置 | `stats.js` + Chart.js | ✅ |
| 词书管理（新增/删除/勾选） | 设置 | `settings.js` | ✅ |
| CSV/JSON 导入（自动创建词书） | 设置 | `parser.js` + `settings.js` | ✅ |
| JSON/CSV 导出 | 设置 | `parser.js` + `settings.js` | ✅ |
| 每日桌面提醒 | 自动 | `notifications.js` | ✅ |
| 局域网地址获取 | 设置 | `settings.js` (WebRTC) | ✅ |
| 致命错误页（含重置数据库按钮） | 全局 | `app.js` | ✅ |
| Toast 通知系统 | 全局 | `app.js` | ✅ |
| generation 锁防异步竞态 | 全局 | `app.js` | ✅ (v5) |
| 全局状态 AppState | 全局 | `app.js` | ✅ (v5) |
| 预置 200 个四级单词（2 单元） | 首次启动 | `db.js` | ✅ |
| 挑战模式（四选一、计分、计时、连对、冷却机制） | 挑战 | `challenge.js` | ✅ |
| 错题集（挑战错词收集、分类筛选、导出） | 错题集 | `wrongwords.js` | ✅ |
| 排序系统（6 种模式，集中管理） | 首页/收藏夹 | `sorter.js` | ✅ |
| 首页排序工具（HomeShuffle） | 首页 | `home/shuffle.js` | ✅ |
| 成就系统（5 学习 + 5 挑战，10 个成就） | 全局 | `achievements.js` | ✅ |
| 设置页成就墙 | 设置 | `achievements.js` | ✅ |
| 挑战模式错题冷却（7 天不重复） | 挑战 | `challenge.js` | ✅ |
| 挑战历史记录（最近 20 条） | 设置 | `challenge.js` + `stats.js` | ✅ |
| 挑战熟悉度联动（答对+1，答错-1） | 挑战 | `challenge.js` | ✅ |
| ECDICT 下载脚本 | 根目录 | `download_words.py` | ✅ |
| CSV 源文件 | 根目录 | `ecdict.csv` | ✅ |
| 挑战增强：3 种模式/难度/生命值/限时 | 挑战 | `challenge.js` | ✅ (5ccc39c) |
| 收藏夹/错题集导出（JSON/CSV） | 收藏夹/错题集 | `favorites.js` + `wrongwords.js` + `parser.js` | ✅ (5ccc39c) |
| 多词书拆分（考研/托福/雅思/GRE/高考/中考） | 脚本 | `scripts/split_csv.js` | ✅ (本任务) |
| 移动端单词卡片适配 | CSS | `css/style.css` | ✅ (5ccc39c) |
| 搜索点击冲突修复 | 首页 | `home.js` | ✅ (本修复) |
| 批量导入写入错误跳过 | 数据库 | `connection.js` | ✅ (本修复) |
| 索引重复创建容错 | 数据库 | `connection.js` | ✅ (本修复) |
| 提醒日期/统计日期本地时区 | 通知/统计 | `notifications.js` + `stats.dao.js` | ✅ (本修复) |
| 熟悉度已满提示优化 | 词卡 | `wordCard.js` + `words.dao.js` | ✅ (本修复) |
| 软删除保留收藏状态 | 数据库 | `words.dao.js` | ✅ (本修复) |

---

## 🐛 已知 Bug

| ID | 文件 | 严重级 | 问题 | 状态 |
|----|------|--------|------|------|
| B15 | `db/connection.js` | 🟢 P2 | `_getAllRaw` 降级 `openCursor` 无二次容错 | 待修复 |
| B16 | `categoryFilter.js` | ⚪ P3 | 分类硬编码，不随数据库动态生成 | 待修复 |
| B17 | `notifications.js:13` | ⚪ P3 | 通知图标路径不存在 | 待修复 |
| B18 | `settings.js:170` | ⚪ P3 | WebRTC 获取 IP 超时时显示英文 | 待修复 |
| B19 | `favorites.js` | ⚪ P3 | 收藏夹用了 unit-card 样式类名 | 待修复 |
| B20 | `challenge.js` | 🟡 P1 | 错题集模式性能风险：逐条 `await WordDB.getWordById(id)` 循环查询，极端 200 次异步查询 | 待修复 |
| B21 | `challenge.js` | 🟢 P2 | 限时与生命值模式同时开启时可能重复扣命 | 待修复 |
| B22 | `challenge.js` | ⚪ P3 | 拼写模式提示过于简单且大小写敏感 | 待修复 |
| B23 | `challenge.js` | ⚪ P3 | 设置持久化读取没有版本兼容（已有防御） | 注意即可 |
| B24 | `challenge.js` | ⚪ P3 | `_cleanRecentWords()` 遍历全量冷却记录，数据膨胀后有延迟 | 待优化 |
| B25 | `wrongwords.js` | ⚪ P3 | 单项删除后重渲染全量列表，缺少虚拟滚动或分页 | 跟踪 |
| B26 | `settings.js:22` | 🟢 P2 | 导入用 confirm() 询问，用户不操作时卡住 | 待修复 |

### 已修复的 Bug

| ID | 版本 | 问题 | 修复 |
|----|------|------|------|
| B1-B6 | v4 (65d6e0b) | 收藏夹词书过滤/排序NaN/空列表/缓存 | 6 个 P0 |
| B7 | v3 (36b7b09) | 同页面导航无法重试 | 移除 return 判断 |
| B8-B9 | v5 (8a52c20) | 异步竞态 + 混序每次 onUpdate 重随机 | generation 锁 + AppState |
| B10 | 本修复 | `connection.js` 创建重复索引抛异常 | `createIndex` 加 try-catch |
| B11 | 本修复 | `_addBatch` 某条写入失败 Promise 不 resolve | 循环内 try-catch 跳过错误，用 `resolve(count)` 兜底 |
| B12 | 本修复 | 搜索框点击外部关闭与搜索结果点击冲突 | 搜索结果加 `e.stopPropagation()` |
| B14 | 本修复 | 提醒日期计算使用 UTC 时区 | 改用 `_getLocalDateStr()` 本地日期函数 |

---

## 📋 待开发

### 改进任务（按优先级排列）

| ID | 模块 | 优先级 | 说明 |
|----|------|--------|------|
| T03 | `categoryFilter.js` | P2 🟡 | 分类硬编码 → 改为动态从数据库读取分类列表 |
| T04 | `css/style.css` | P2 🟡 | 移动端导航栏折叠动画可优化 |
| T05 | `favorites.js` | P3 🟢 | 收藏夹使用了 unit-card 样式类名，应改用独立类名 |
| T07 | `app.js` | P3 🟢 | 路由 switch-case 可抽象为路由表 |
| T08 | 全局 | P3 🟢 | 添加页面间过渡动画（目前只有 .page-fade-in） |
| T09 | `settings.js` | P3 🟢 | 导入时 confirm() 改为模态框，避免卡住 |
| T10 | 全局 | P4 ⚪ | Service Worker + PWA 离线缓存 |
| T11 | `challenge.js` | P4 ⚪ | 拼写模式增加逐字母提示、自动纠错 |
| T12 | 全局 | P4 ⚪ | 引入单元测试（至少对 parser/sorter/model） |
| T13 | `down_words.py` | P4 ⚪ | Python 脚本可扩展参数支持自定义筛选 |

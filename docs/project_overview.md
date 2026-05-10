# WordWiz 项目文档

> 跨平台单词学习 App · 纯前端本地离线版（IndexedDB + Hash 路由）

---

## 一、项目结构

```
d:\gxj\code\wordlearing/
├── index.html                 # 主入口 HTML
├── start.bat                  # 启动脚本（npx http-server -c-1）
├── server.py                  # Python 版开发服务器（已弃用）
│
├── css/
│   └── style.css              # 全局样式
│
├── js/
│   ├── app.js                 # ★ 主入口：初始化DB + 路由 + Toast
│   ├── db.js                  # ★ 数据库层：IndexedDB DAO
│   │
│   ├── models/
│   │   └── word.js            # 数据模型：WordModel.create/fromRow
│   │
│   ├── screens/
│   │   ├── home.js            # 首页：学习页（搜索+词书过滤+单元展示）
│   │   ├── favorites.js       # 收藏夹：独立展示收藏单词
│   │   ├── trash.js           # 回收站：软删除/恢复/永久删除
│   │   └── settings.js        # 设置：词书管理/导入导出/提醒/统计
│   │
│   ├── widgets/
│   │   ├── categoryFilter.js  # 分类筛选组件（全部/四级/六级/半导体专业/其他）
│   │   ├── unitCard.js        # 单元卡片组件（折叠+混序）
│   │   └── wordCard.js        # 单词卡片组件（熟悉/收藏/删除按钮）
│   │
│   └── utils/
│       ├── parser.js          # 导入导出工具（CSV/JSON解析）
│       ├── notifications.js   # 桌面通知提醒
│       └── stats.js           # 统计图表（Chart.js）
│
├── assets/
│   ├── words_cet4.json        # 四级词库数据文件
│   ├── words_cet6.json        # 六级词库数据文件
│   └── .gitkeep
│
└── docs/
    └── project_overview.md    # 本文档
```

---

## 二、逻辑框架

### 2.1 技术栈

| 技术 | 用途 |
|------|------|
| 纯 HTML + CSS + JS | 无框架，零依赖 |
| IndexedDB | 本地数据库（浏览器持久存储） |
| Hash 路由 (`#/page`) | 页面切换，无需后端 |
| Chart.js | 学习趋势图表 |
| Web Notifications API | 每日复习提醒 |
| WebRTC | 获取局域网 IP |

### 2.2 数据流

```
用户操作 → Hash 路由变化 → app.js 调度 → 对应 Page.render()
                                                    ↓
                                              调用 WordDB (db.js)
                                                    ↓
                                              IndexedDB CRUD
                                                    ↓
                                              获取数据 → 渲染 DOM
```

### 2.3 数据库结构（IndexedDB）

| 表名 | keyPath | 说明 |
|------|---------|------|
| `words` | `id` (autoIncrement) | 单词表：word, definition, category, unit, book_id, familiarity(0-5), is_favorite, deleted_at |
| `books` | `id` (autoIncrement) | 词书表：name, description, is_system, created_at |
| `settings` | `key` | 键值对设置：active_books, reminder_enabled, reminder_time 等 |
| `stats` | `id` (autoIncrement) | 学习统计：date, word, category, type, timestamp |

---

## 三、功能清单

### ✅ 已实现功能

| 功能 | 文件 | 说明 |
|------|------|------|
| **首页学习** | `home.js` | 按单元展示单词卡片 |
| **分类筛选** | `categoryFilter.js` | 全部/四级/六级/半导体专业/其他 |
| **词书筛选** | `home.js` | 在设置中勾选激活的词书 |
| **模糊搜索** | `home.js` | 300ms 防抖，匹配单词和释义，点击定位到单元 |
| **单元展开/折叠** | `unitCard.js` | 点击单元标题展开/收起 |
| **Fisher-Yates 混序** | `unitCard.js` | 点击「混序」打乱，再点「恢复」还原 |
| **熟悉度系统** | `wordCard.js` | 0-5 级，点击 ✓ 增加，圆点显示 |
| **收藏/取消收藏** | `wordCard.js` | ⭐ 按钮切换，无需确认 |
| **收藏夹** | `favorites.js` | 独立展示所有收藏单词（不受词书过滤影响） |
| **收藏夹排序** | `favorites.js` | 默认/熟悉度升序/降序/混序 |
| **回收站** | `trash.js` | 软删除 → 30天自动清理 |
| **恢复单词** | `trash.js` | 从回收站恢复到原词书 |
| **词书管理** | `settings.js` | 新增/删除/勾选词书 |
| **导入词库** | `settings.js` + `parser.js` | 支持 CSV/JSON，自动创建词书 |
| **导出数据** | `settings.js` + `parser.js` | 导出 JSON/CSV |
| **学习趋势图** | `stats.js` | 最近 7 天学习次数折线图 |
| **每日提醒** | `notifications.js` | 桌面通知，可设时间 |
| **局域网访问** | `settings.js` | 自动获取 IP |

### ❌ 未实现（后续规划）

| 功能 | 说明 |
|------|------|
| **按熟悉度排序**（单元内） | 当前仅收藏夹支持，单元卡片内未有此按钮 |
| **跨单元随机抽词复习** | 从多个单元随机抽取单词复习 |
| **顶部搜索** | ✅ **已完成**（搜索框在首页顶部） |
| **分类动态读取** | 当前硬编码 ['全部', '四级', '六级', '半导体专业', '其他'] |

---

## 四、Bug 全量分析

### 4.1 已修复的 Bug

#### commit 65d6e0b — P0 修复

| ID | 文件 | 严重级 | 问题 | 修复 |
|----|------|--------|------|------|
| B1 | `favorites.js` | P0 🔴 | 收藏夹传了 `activeBookIds` 参数，导致词书未勾选时收藏单词不显示 | 去掉 `getFavoriteWords(category, activeBookIds)` 的第二个参数 |
| B2 | `favorites.js` | P0 🔴 | 部分数据 `familiarity` 为 undefined，排序产生 NaN 导致渲染崩溃 | `a.familiarity ?? 0` 兜底 |
| B3 | `favorites.js` | P0 🔴 | 脏数据跳过时 `list.children.length === 0`，页面空白 | 加空列表检查，显示占位提示 |
| B4 | `unitCard.js` | P0 🔴 | `dataset.id` 不存在时 `parseInt` 返回 NaN，排序崩溃 | `Number.isFinite(id)` 检查 |
| B5 | `app.js` | P0 🔴 | `_renderPage` 无 try-catch，任一页面报错导致整个应用白屏 | 包 try-catch + 友好错误提示 |
| B6 | `index.html` | P0 🔴 | 浏览器缓存旧 JS 文件，代码改了但运行时还是旧的 | 加 `<meta>` no-cache + `?v=2` + http-server `-c-1` |

#### commit 36b7b09 — 导航修复

| ID | 文件 | 严重级 | 问题 | 修复 |
|----|------|--------|------|------|
| B7 | `app.js` | P0 🔴 | 导航按钮点击时 `if (page === this.currentPage) return;` 导致同一页面无法重试 | 移除该判断，每次点击直接调 `_renderPage()` |

---

### 4.2 尚未修复的 Bug（全部代码审查结果）

阅读分析 js 目录下 10 个文件（共约 2400 行）后，识别出以下潜在问题：

#### P1 — 功能异常（页面能打开但行为错误）

| ID | 文件 | 行 | 问题 | 影响 |
|----|------|-----|------|------|
| **B8** | `home.js` | 162-166 | `UnitCard.render()` 传 `onUpdate: () => {}` 空函数，在首页修改熟悉度或删除单词后，**不回调刷新** | 收藏夹/统计面板不会自动更新（需手动 F5） |
| **B9** | `favorites.js` | 27 | `FavoritesPage` 是实例而非静态类，`CategoryFilter.render` 的回调里 `this._renderFavList(container)` 捕获的是实例 `this`，但多次调用 `render()` 时**分类筛选的回调叠加** | 每次切换页面再回来，分类按钮点击会触发 N 次 `_renderFavList` |
| **B10** | `db.js` | 39-42 | `onupgradeneeded` 中给旧 words 表创建 `book_id` 索引时，如果表版本已升级到 v3 但 book_id 索引已存在，**重复创建会抛异常** | 首次升级报错可能导致页面空白（需手动重置数据库） |
| **B11** | `db.js` | 237-248 | `_addBatch` 中 for 循环 + 异步回调，如果某条记录写入失败，Promise **既可能 resolve 也可能不 resolve** | 种子数据 200 词写入时若有一条失败，整个 Promise 挂起 |

#### P2 — 体验优化（不影响核心功能）

| ID | 文件 | 行 | 问题 | 影响 |
|----|------|-----|------|------|
| B12 | `home.js` | 96 | 搜索框点击外部关闭，但同时监听了 `document` 的 click，**点击搜索结果项也会触发关闭事件**（关闭在前，定位在后） | 第一次点击搜索词可能在定位前被关闭 |
| B13 | `settings.js` | 22 | 导入时新建词书后，用 `confirm()` 询问是否覆盖，如果用户不点确定/取消**后续导入会卡住** | 体验不流畅 |
| B14 | `settings.js` | 186 | `reminder_last_sent` 存的是日期字符串 YYYY-MM-DD，**但日期计算用的是本地时区** | 跨时区用可能有偏差 |
| B15 | `db.js` | 254-274 | `_getAllRaw` 的 onerror 分支用 `store.openCursor()` 全表扫描作为降级，但如果 store 未正确获取，`openCursor` 也会报错 | 降级失败无二次容错 |

#### P3 — 代码质量问题（不影响运行）

| ID | 文件 | 行 | 问题 |
|----|------|-----|------|
| B16 | `categoryFilter.js` | 8 | 分类数组 `['全部', '四级', '六级', '半导体专业', '其他']` 硬编码，不随数据库中真实分类动态生成 |
| B17 | `notifications.js` | 13 | `icon: '/assets/icon-192.png'` 引用了不存在的路径（项目没有这个文件），通知图标不会显示 |
| B18 | `settings.js` | 170 | 局域网 IP 获取使用 RTCPeerConnection，但有 3s 超时，如果用户网络环境不允许 WebRTC，显示的文字是英文提示 |
| B19 | `favorites.js` | 76-101 | `_renderFavList` 中 `wrapper.className = 'unit-card'` 用了 unit-card 的样式类名，但 favList 本身不是单元，依赖 unit-card 的 CSS 样式类 |

---

### 4.3 收藏夹功能特别分析

收藏夹的全链路代码已在 `docs/favorites_analysis.md` 中逐文件提取。

#### 收藏夹数据流

```
点击 ⭐ (wordCard.js)
  → WordDB.toggleFavorite(id)  → IndexedDB put
  → onUpdate() 回调 → 刷新列表

点击导航「收藏」 (app.js)
  → _renderPage('favorites')
  → FavoritesPage.render(container)
  → WordDB.getFavoriteWords(category)
  → 拿到所有 is_favorite=true 的单词
  → 渲染 DOM

点击删除 ✕ (wordCard.js)
  → WordDB.softDeleteWord(id)  → 设 deleted_at + is_favorite=false
  → onUpdate() 回调 → 刷新列表
```

#### 收藏夹的防御层

| 防御 | 位置 | 说明 |
|------|------|------|
| try-catch | `_renderFavList` | 整个渲染过程包 try-catch |
| 空列表检测 | `_renderFavList` | words=0 或全脏数据跳过后显示空状态 |
| 脏数据跳过 | `_renderFavList` | `if (!word \|\| !word.word) continue` |
| 排序兜底 | `_renderFavList` | `?? 0` 处理 undefined |
| 不传词书 ID | `_renderFavList` | `getFavoriteWords(category)` 无第二个参数 |
| 实例方法 | `FavoritesPage` | 非静态类，状态可持久 |

#### 收藏夹仍然打不开的排障清单

**前提条件：**
1. ✅ 服务器正确运行 `http-server . -p 3000 -c-1`（看控制台有没有输出）
2. ✅ 浏览器通过 `http://localhost:3000` 访问（不是双击 html）
3. ✅ 刷新页面（F5），不是只改 URL hash
4. ✅ 清浏览器缓存（F12 → 网络 → 勾选「禁用缓存」→ 刷新）

**如果以上都满足，以下步骤：**
1. F12 打开控制台 → 看有没有报错
2. F12 → 网络标签 → 看 `favorites.js?v=2` 有没有加载成功（200）
3. 控制台输入 `!!window.FavoritesPage` → 应该是 `true`
4. 控制台输入 `typeof FavoritesPage.render === 'function'` → 应该是 `true`
5. 控制台输入 `await WordDB.getFavoriteWords('全部')` → 看返回是否为空数组
6. 如果为空 → 控制台输入 `await WordDB.getSetting('active_books', null)` → 看有没有异常
7. 如果上一步有问题 → 点「重置数据库」

---

## 五、导航系统说明

### 路由机制

```
Hash 路由: #/home, #/favorites, #/trash, #/settings
```

### 触发重新渲染的三种方式

| 方式 | 触发链路 | 说明 |
|------|----------|------|
| 点击导航按钮 | → `_setupNavigation` → `_renderPage(page)` | 已修复：现在每次都强制刷新 |
| 浏览器前进/后退 | → `hashchange` 事件 → `_handleRoute` → `_renderPage(page)` | 有 `if (page === this.currentPage) return;` 防抖 |
| 直接改 URL hash | → 同上 | 同上 |

**注意：** `_handleRoute` 中仍保留 `if (page === this.currentPage) return;` 是因为 `hashchange` 可能被重复触发（浏览器兼容性）。如果你手动改 hash 为相同值，它不会重新渲染。

---

## 六、开发指南

### 启动项目

**方法 1（推荐）：双击 start.bat**
```
d:\gxj\code\wordlearing\start.bat
```

**方法 2：手动启动**
```bash
cd d:\gxj\code\wordlearing
npx http-server . -p 3000 -c-1 --cors
```

然后浏览器访问：`http://localhost:3000`

### 开发新页面

1. 在 `js/screens/` 下新建 `xxx.js`
2. 实现 `class XxxPage { static async render(container) { ... } }`
3. 导出到全局：`window.XxxPage = XxxPage`
4. 在 `index.html` 中添加 `<script>` 引用（加 `?v=N`）
5. 在 `app.js` 的 `_renderPage` switch 中注册路由

### 数据库操作

```javascript
// 读取
await WordDB.getAllWords()
await WordDB.getWordsByCategory('四级', [1, 2])
await WordDB.getFavoriteWords('全部')

// 写入
await WordDB.addWord({ word: 'hello', definition: '你好', ... })
await WordDB.updateWord(id, { familiarity: 3 })
await WordDB.toggleFavorite(id)
await WordDB.softDeleteWord(id)
```

### 修改后提交

```bash
git add .
git commit -m "描述改了什么"
```

---

## 七、Git 版本记录

```
24b454e fix: 彻底解决缓存问题 + 改用http-server(c-1)
65d6e0b fix: P0 bugs - 收藏夹词书过滤/排序兜底/空列表检测/NaN容错
4fbad58 WordWiz v3 initial commit
```

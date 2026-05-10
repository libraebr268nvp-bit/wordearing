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

## 四、已修复的 Bug

### v3 P0 修复（commit 65d6e0b）

| Bug | 文件 | 描述 |
|-----|------|------|
| 1 | `favorites.js` | 收藏夹被 `activeBookIds` 词书过滤，去掉该参数 |
| 2 | `favorites.js` | `familiarity` 为 undefined 时排序产生 NaN，加 `?? 0` |
| 3 | `favorites.js` | 脏数据跳过导致空列表白屏，加空状态检查 |
| 4 | `unitCard.js` | `dataset.id` 不存在时 `parseInt` 返回 NaN，加 `Number.isFinite` |
| 5 | `app.js` | `_renderPage` 无 try-catch 导致崩溃白屏 |
| 6 | `index.html` | 无防缓存头，浏览器缓存旧 JS |

### 已知问题

| 问题 | 状态 | 说明 |
|------|------|------|
| **点击同一导航按钮不刷新** | 🔴 待修复 | 详见下面「导航 Bug 说明」 |
| 回收站清空后统计面板未更新 | 🟡 轻微 | 手动刷新页面可解决 |
| 收藏夹混序状态不持久化 | ✅ 特性 | 符合「混序状态不持久化」规则 |
| 浏览器缓存旧文件 | ✅ 已修复 | http-server -c-1 + HTML meta no-cache |

---

## 五、导航 Bug 说明

### 问题

当用户导航到某个页面（如收藏夹）后，如果因某种原因页面渲染失败，**再次点击同一按钮无法重新加载**。

### 原因

```javascript
// app.js - _setupNavigation()
btn.addEventListener('click', () => {
    const page = btn.dataset.page;
    if (page === this.currentPage) return;  // ← 导致同页面无法重试
    ...
    window.location.hash = '#/' + page;
});
```

以及：

```javascript
// app.js - _handleRoute()
async _handleRoute() {
    const page = this._getPageFromHash() || 'home';
    if (page === this.currentPage) return;  // ← 同上
    await this._renderPage(page);
}
```

### 修复方向

`_setupNavigation` 中移除 `if (page === this.currentPage) return;`，改为直接调用 `_renderPage(page)` 触发重新渲染。

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

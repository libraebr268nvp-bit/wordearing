# WordWiz 项目文档

> 跨平台单词学习 App · 纯前端本地离线版（IndexedDB + Hash 路由）

---

## 一、项目结构

```
d:\gxj\code\wordlearing/
├── index.html                 # 主入口 HTML
├── start.bat                  # 启动脚本（npx http-server -c-1）
├── server.py                  # Python 版开发服务器（备选）
│
├── css/
│   └── style.css              # 全局样式（深色科技感主题）
│
├── js/
│   ├── app.js                 # ★ 主入口：初始化DB + 路由 + 全局状态 + Toast
│   ├── db.js                  # ★ 数据库层：IndexedDB DAO（400行）
│   │
│   ├── models/
│   │   └── word.js            # 数据模型：WordModel.create/fromRow
│   │
│   ├── screens/
│   │   ├── home.js            # 首页：学习页（搜索+词书过滤+分类+单元展示+全局混序）
│   │   ├── favorites.js       # 收藏夹：独立展示收藏单词（排序+混序+分类）
│   │   ├── trash.js           # 回收站：软删除/恢复/永久删除
│   │   ├── settings.js        # 设置：统计/词书管理/导入导出/提醒/局域网
│   │   └── challenge.js       # 挑战模式：随机抽词答题（#/challenge）
│   │
│   ├── widgets/
│   │   ├── categoryFilter.js  # 分类筛选组件（全部/四级/六级/半导体专业/其他）
│   │   ├── unitCard.js        # 单元卡片组件（折叠+单元混序+支持全局混序隐藏）
│   │   └── wordCard.js        # 单词卡片组件（熟悉✓/收藏⭐/删除✕）
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
├── docs/
│   ├── project_overview.md    # 本文档
│   ├── favorites_analysis.md  # 收藏夹全链路分析
│   └── bug_tracker.md         # Bug 跟踪（待建）
│
└── other/
    ├── download_words.py      # 词库数据下载脚本
    ├── ecdict.csv             # 词典源数据
    ├── server.py              # Python 开发服务器
    └── start.bat              # 启动脚本
```

---

## 二、技术栈

| 技术 | 用途 |
|------|------|
| **纯 HTML + CSS + JS** | 无框架、无构建工具、零依赖 |
| **IndexedDB** | 本地数据库（浏览器持久存储） |
| **Hash 路由** (`#/home`) | 5 个页面切换，无需后端 |
| **Chart.js** | 学习趋势折线图（内置于 `js/lib/`） |
| **Web Notifications API** | 每日复习桌面通知 |
| **WebRTC** | 获取局域网 IP（设置页展示） |
| **Python / npx http-server** | 开发服务器（解决同源策略 + 强制无缓存） |

---

## 三、启动流程

```
双击 start.bat / npx http-server -p 3000 -c-1
  └→ 浏览器打开 http://localhost:3000
      └→ 加载 index.html
          └→ 按顺序加载 14 个 JS 文件
              └→ DOMContentLoaded 触发
                  └→ app.js: new WordWizApp().init()
                      1. WordDB.open()              → 打开 IndexedDB
                      2. initializeDefaults()       → 创建默认词书 + 迁移孤儿数据
                      3. autoCleanTrash(30)         → 清理过期回收站
                      4. 绑定导航按钮 → 只设 location.hash
                      5. 监听 hashchange → 唯一渲染入口
                      6. hash = '#/home'            → 触发首页渲染
```

---

## 四、导航与路由（v5 架构）

### 路由机制

```
Hash 路由: #/home, #/favorites, #/trash, #/settings, #/challenge
```

### 渲染流程（v5 重写后）

```
导航按钮点击 → 只设 location.hash
浏览器前进/后退 → hashchange 事件
    └─→ _handleRoute(hash)
         └─→ if (page 变了) _renderPage(page)
               └─→ generation++ (防异步竞态)
                    └─→ await Page.render(container)
                          └─→ 如果是过时的 generation → 丢弃结果
```

### 状态管理 — `window.AppState`

```javascript
window.AppState = {
    home: {
        shuffled: false,
        unitOrder: [],          // 首页单元排列顺序
        wordOrders: {},         // 每个单元内单词排列顺序 { unitId: [...] }
    },
    favorites: {
        shuffled: false,
        shuffledOrder: [],
    }
}
```

**AppState 解决了什么问题：**
1. **全局混序跨页面保持** — 混序结果存 AppState，切换页面再回来不会重置
2. **onUpdate 不重新随机** — 修改熟悉度/收藏后回调刷新，按已存排列重渲染
3. **分类/词书切换自动重置** — 切换时 `shuffled = false`

### generation 锁解决异步竞态

```javascript
this.generation = 0; // app.js

_renderPage(page) {
    const gen = ++this.generation;
    // ... await 异步操作 ...
    if (gen !== this.generation) return; // 过时，丢弃
}
```

**解决了：** 快速切换页面时，两个 async render 先后完成，后者覆盖前者的问题（收藏夹 Bug 根因）。

---

## 五、数据库结构（IndexedDB）

| 对象仓库 (表) | keyPath | 索引 | 说明 |
|---------------|---------|------|------|
| `words` | `id` (autoIncrement) | `word`, `category`, `unit`, `book_id`, `is_favorite`, `deleted_at`, `familiarity` | 单词主表 |
| `books` | `id` (autoIncrement) | `name` | 词书表 |
| `settings` | `key` | — | 键值对设置 |
| `stats` | `id` (autoIncrement) | `date`, `type` | 学习统计 |

### 数据库版本历史

| 版本 | 变更 |
|------|------|
| v1 (初始) | words 表 |
| v2 | 加 book_id 索引 |
| v3 | 加 settings 表、stats 表、books 表 |
| v4 | — |
| v5 | — |

### 数据模型 — `words` 表字段

| 字段 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `id` | number | autoIncrement | 主键 |
| `word` | string | — | 英文单词 |
| `definition` | string | — | 中文释义 |
| `category` | string | '四级' | 分类 |
| `unit` | number | 1 | 所属单元（每单元约 100 词） |
| `book_id` | number | 1 | 所属词书 ID |
| `familiarity` | number | 0 | 熟悉度 0~5 |
| `is_favorite` | boolean | false | 是否收藏 |
| `book_source` | string | '内置词库' | 来源词书名称 |
| `deleted_at` | string\|null | null | 软删除时间（回收站用） |
| `created_at` | string | ISO日期 | 创建时间 |

---

## 六、数据流

```
用户操作
    │
    ▼
Hash 路由变化 (app.js)
    │
    ▼
_renderPage(page) ──→ 对应 Page.render(container)
                            │
                            ├── 设置 container.innerHTML
                            ├── 绑定事件监听器
                            ├── 调用 WordDB.xxx() 查询/写入
                            └── 渲染 DOM（单词/单元/卡片）
    │
    ▼
onUpdate 回调 → 重新调 _renderPage 或 _renderXxxList
```

---

## 七、页面功能清单

### 首页 (`#/home`)

| 功能 | 文件 | 说明 |
|------|------|------|
| 词书筛选 | `home.js` | 在设置中勾选激活的词书，首页只显示该词书的单词 |
| 分类筛选 | `categoryFilter.js` | 全部/四级/六级/半导体专业/其他 |
| 模糊搜索 | `home.js` | 300ms 防抖，匹配单词和释义，点击定位到单元 |
| 单元展开/折叠 | `unitCard.js` | 点击单元标题展开/收起 |
| 单元混序 | `unitCard.js` | 点击 🔀 打乱当前单元单词顺序 |
| **全局混序** | `home.js` | 🔀 按钮打乱所有单元顺序和单元内单词顺序，状态存 AppState |
| 熟悉度系统 | `wordCard.js` | 0~5 级，点击 ✓ 增加，圆点显示进度 |
| 收藏/取消收藏 | `wordCard.js` | ⭐ 按钮即点即切 |
| 软删除 | `wordCard.js` | ✕ 按钮移入回收站 |

### 收藏夹 (`#/favorites`)

| 功能 | 说明 |
|------|------|
| 所有收藏单词独立展示 | 不受词书过滤影响 |
| 分类筛选 | 同上分类组件 |
| 排序 | 默认 / 熟悉度升序 / 降序 |
| 混序学习 | 🔀 按钮打乱顺序 |

### 回收站 (`#/trash`)

| 功能 | 说明 |
|------|------|
| 查看已删除单词 | 显示删除时间 |
| 恢复单词 | 回到原词书 |
| 永久删除 | 从数据库彻底移除 |
| 一键清空 | 清空所有回收站 |
| 自动清理 | 超过 30 天自动删除（启动时执行） |

### 挑战 (`#/challenge`)

| 功能 | 说明 |
|------|------|
| 设置菜单 | 题数（10/20/50/100/自定义）、范围（激活词书/全部/按分类），偏好自动保存 |
| 分类动态获取 | 分类下拉从数据库所有单词的 category 字段去重动态生成 |
| 随机抽词 | 按设置从指定范围随机抽取题目 |
| 四选一答题 | 显示英文，选择正确中文释义（含 3 个干扰项） |
| 计时 | 答题过程中实时显示用时 |
| 连对计数 | 连续答对时显示 🔥 N 连对 |
| 即时反馈 | 选完立即显示正确/错误，高亮正确选项 |
| 熟悉度联动 | 答对熟悉度+1（上限5），答错-1（下限0） |
| 冷却机制 | 7 天内已挑战过的单词不会重复出现 |
| 结果页 | 显示正确数、错误数、用时、正确率环形图、最大连对 |
| 错题回顾 | 列出答错的单词和正确释义 |
| 再来一次 | 重新按设置随机抽题挑战 |
| 挑战记录 | 每次结果自动保存，在设置页可查看最近 20 条 |
| 成就触发 | 5 个挑战成就自动检测解锁 |
| 状态机 | `start → playing → result` 三态切换 |


### 设置 (`#/settings`)

| 功能 | 文件 | 说明 |
|------|------|------|
| 统计仪表盘 | `stats.js` | 总数/已学/收藏数 + 7 天趋势折线图 |
| 词书管理 | `settings.js` | 新增/删除/勾选激活词书 |
| 导入 | `settings.js` + `parser.js` | CSV/JSON 导入，自动创建词书 |
| 导出 | `settings.js` + `parser.js` | 导出为 JSON/CSV |
| 每日提醒 | `notifications.js` | 桌面通知，可设时间 |
| 局域网访问 | `settings.js` | 自动获取 IP 地址 |
| 重置数据库 | `settings.js` | 清空所有数据重新初始化 |

---

## 八、文件加载顺序（index.html）

```
 1. chart.umd.min.js           (图表库)
 2. models/word.js             (数据模型)
 3. connection.js              (数据库基类)
 4. settings.dao.js            (设置 DAO)
 5. stats.dao.js               (统计 DAO)
 6. books.dao.js               (词书 DAO)
 7. words.dao.js               (单词 DAO)
 8. db/index.js                (WordDB 单例)
 9. utils/parser.js            (导入导出)
10. utils/notifications.js     (通知)
11. utils/stats.js             (统计图表)
12. widgets/categoryFilter.js  (分类筛选)
13. widgets/wordCard.js        (单词卡片)
14. widgets/unitCard.js        (单元卡片)
15. screens/home/shuffle.js    (混序工具)
16. screens/home.js            (首页)
17. screens/favorites.js       (收藏夹)
18. screens/trash.js           (回收站)
19. screens/settings.js        (设置)
20. screens/challenge.js       (挑战模式)
21. app.js                     (★ 主入口，最后加载)
```

⚠️ **重要：** 顺序不能乱 — 例如 `db.js` 依赖 `WordModel`，`unitCard.js` 依赖 `WordCard`，`app.js` 依赖所有页面。

---

## 九、Bug 历史

### v5 修复 — commit 8a52c20

| ID | 文件 | 严重级 | 问题 | 修复 |
|----|------|--------|------|------|
| B9 | `app.js` | P0 🔴 | 收藏夹 `_renderPage` 先设 hash 又直接调 render，两个 async 异步竞态 | 严格只走 hashchange 一条路径 + generation 锁 |
| B8 | `home.js` | P2 🟡 | 混序每次 onUpdate 重新随机，点 ✓ 收藏后顺序又变 | 混序结果存 AppState，onUpdate 按存储排列重渲染 |

### v4 修复 — commit 65d6e0b

| ID | 文件 | 严重级 | 问题 |
|----|------|--------|------|
| B1 | `favorites.js` | P0 🔴 | 收藏夹传了 activeBookIds 参数，词书未勾选时收藏单词不显示 |
| B2 | `favorites.js` | P0 🔴 | familiarity 为 undefined 导致排序 NaN 崩溃 |
| B3 | `favorites.js` | P0 🔴 | 脏数据跳过时列表空白无提示 |
| B4 | `unitCard.js` | P0 🔴 | dataset.id 为 NaN 时排序崩溃 |
| B5 | `app.js` | P0 🔴 | 无 try-catch，任一页面报错白屏 |
| B6 | `index.html` | P0 🔴 | 浏览器缓存旧 JS |

### v3 修复 — commit 36b7b09

| ID | 文件 | 严重级 | 问题 |
|----|------|--------|------|
| B7 | `app.js` | P0 🔴 | 导航按钮有 `page === currentPage return`，同页面无法重试 |

---

## 十、核心文件评分

| 优先级 | 文件 | 行数 (约) | 为什么重要 |
|--------|------|-----------|-----------|
| ⭐⭐⭐ | **`js/app.js`** | ~200 | 应用入口、路由调度、全局状态、generation 锁 |
| ⭐⭐⭐ | **`js/db.js`** | ~400 | 所有数据的读写都通过它 |
| ⭐⭐⭐ | **`index.html`** | — | 唯一 HTML，JS 加载顺序决定依赖关系 |
| ⭐⭐ | **`js/screens/home.js`** | ~250 | 最复杂的页面：词书+分类+搜索+全局混序 |
| ⭐⭐ | **`js/screens/favorites.js`** | ~130 | Bug 最多的页面（v4 修复 3 个 P0） |
| ⭐ | **`js/widgets/wordCard.js`** | ~80 | 被所有页面引用的通用卡片组件 |
| ⭐ | **`js/screens/settings.js`** | ~200 | 词书管理+导入导出+统计 |

---

## 十一、开发指南

### 启动

```bash
# 方法 1（推荐）
双击 start.bat

# 方法 2
npx http-server d:\gxj\code\wordlearing -p 3000 -c-1 --cors

# 方法 3
python server.py
```

然后浏览器访问 **http://localhost:3000**

### 开发新页面

1. 在 `js/screens/` 下新建 `xxx.js`
2. 实现 `class XxxPage { static async render(container) { ... } }`
3. 导出到全局：`window.XxxPage = XxxPage`
4. 在 `index.html` 中添加 `<script>` 引用
5. 在 `app.js` 的 `_renderPage` switch 中注册路由

### 数据库操作示例

```javascript
// 查询
await WordDB.getAllWords()
await WordDB.getWordsByCategory('四级', [1, 2])
await WordDB.getFavoriteWords('全部')

// 写入
await WordDB.addWord({ word: 'hello', definition: '你好', ... })
await WordDB.updateWord(id, { familiarity: 3 })
await WordDB.toggleFavorite(id)
await WordDB.softDeleteWord(id)
```

### 提交

```bash
git add .
git commit -m "描述改动"
```

---

## 十二、Git 版本记录

```
8a52c20 v5 架构重写：路由+混序+收藏夹+单元卡片
24b454e fix: 彻底解决缓存问题 + 改用http-server(c-1)
65d6e0b fix: P0 bugs - 收藏夹词书过滤/排序兜底/空列表检测/NaN容错
36b7b09 fix: 导航修复 - 移除同页面跳过判断
4fbad58 WordWiz v3 initial commit
```

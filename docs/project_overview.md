# WordWiz 项目文档

> 跨平台单词学习 App · 纯前端本地离线版（IndexedDB + Hash 路由）

---

## 一、项目结构

```
d:\gxj\code\wordlearing/
├── index.html                 # 主入口 HTML
├── start.bat                  # 启动脚本（npx http-server -c-1）
├── server.py                  # Python 版开发服务器（备选）
├── download_words.py          # 词库数据下载脚本（从 ECDICT 转换）
├── ecdict.csv                 # 词典源数据（skywind3000/ECDICT, MIT）
│
├── css/
│   └── style.css              # 全局样式（深色科技感主题，网格点阵背景）
│
├── js/
│   ├── app.js                 # ★ 主入口：初始化DB + 路由 + 全局状态 + Toast
│   │
│   ├── db/                    # ★ 数据库层（6 文件，prototype 挂载）
│   │   ├── connection.js      #   基类 + 建表 + 工具方法 + 初始化 + 预置数据
│   │   ├── settings.dao.js    #   设置 DAO
│   │   ├── stats.dao.js       #   统计 DAO
│   │   ├── books.dao.js       #   词书 DAO（CRUD + 激活管理）
│   │   ├── words.dao.js       #   单词 DAO（CRUD + 查询 + 搜索）
│   │   └── index.js           #   创建 window.WordDB 单例
│   │
│   ├── models/
│   │   └── word.js            # 数据模型：WordModel.create/fromRow
│   │
│   ├── screens/
│   │   ├── home.js            # 首页：学习页（搜索+词书过滤+分类+单元展示+全局混序）
│   │   ├── home/
│   │   │   └── shuffle.js     # 首页排序工具（HomeShuffle，6 种排序模式）
│   │   ├── favorites.js       # 收藏夹：独立展示收藏单词（排序+混序+分类+导出）
│   │   ├── trash.js           # 回收站：软删除/恢复/永久删除
│   │   ├── settings.js        # 设置：统计/词书管理/导入导出/提醒/局域网
│   │   ├── challenge.js       # 挑战模式：3 种答题模式 + 生命值 + 限时 + 难度筛选
│   │   └── wrongwords.js      # 错题集：挑战错词收集 + 分类筛选 + 导出
│   │
│   ├── widgets/
│   │   ├── categoryFilter.js  # 分类筛选组件（全部/四级/六级/半导体专业/其他）
│   │   ├── unitCard.js        # 单元卡片组件（折叠+单元混序+支持全局混序隐藏）
│   │   └── wordCard.js        # 单词卡片组件（熟悉✓/收藏⭐/删除✕）
│   │
│   └── utils/
│       ├── parser.js          # 导入导出工具（CSV/JSON 解析 + 收藏夹/错题集导出）
│       ├── sorter.js          # 通用排序模块（WordSorter，6 种排序模式）
│       ├── achievements.js    # 成就系统（AchievementHelper，10 个成就）
│       ├── notifications.js   # 桌面通知提醒
│       └── stats.js           # 统计图表（Chart.js）
│
├── assets/
│   ├── words_cet4.json        # 四级词库
│   ├── words_cet6.json        # 六级词库
│   ├── words_ky.json          # 考研词库（split_csv.js 生成）
│   ├── words_toefl.json       # 托福词库（split_csv.js 生成）
│   ├── words_ielts.json       # 雅思词库（split_csv.js 生成）
│   ├── words_gre.json         # GRE 词库（split_csv.js 生成）
│   ├── words_gk.json          # 高考词库（split_csv.js 生成）
│   └── words_zk.json          # 中考词库（split_csv.js 生成）
│
├── scripts/
│   └── split_csv.js           # 从 ecdict.csv 按 tag 拆分多词书
│
└── docs/
    ├── project_overview.md    # 本文档
    ├── favorites_analysis.md  # 收藏夹全链路分析
    ├── import_guide.md        # 导入指南
    └── ai/                    # ← AI 辅助上下文（供 Cursor/Claude 等使用）
        ├── context.md
        ├── architecture.md
        ├── rules.md
        └── tasks.md
```

---

## 二、技术栈

| 技术 | 用途 |
|------|------|
| **纯 HTML + CSS + JS** | 无框架、无构建工具、零依赖 |
| **IndexedDB** | 本地数据库（浏览器持久存储，4 个对象仓库） |
| **Hash 路由** (`#/home`) | 6 个页面切换，无需后端 |
| **Chart.js** | 学习趋势折线图（内置于 `js/lib/`） |
| **Web Notifications API** | 每日复习桌面通知 |
| **WebRTC** | 获取局域网 IP（设置页展示） |
| **Node.js** | 词书拆分脚本 `scripts/split_csv.js` |
| **Python / npx http-server** | 开发服务器（解决同源策略 + 强制无缓存） |

---

## 三、启动流程

```
双击 start.bat / npx http-server -p 3000 -c-1
  └→ 浏览器打开 http://localhost:3000
      └→ 加载 index.html
          └→ 按顺序加载 22 个 JS 文件
              └→ DOMContentLoaded 触发
                  └→ app.js: new WordWizApp().init()
                      1. WordDB.open()              → 打开 IndexedDB
                      2. initializeDefaults()       → 创建默认词书 + 迁移孤儿数据 + 预置 200 词
                      3. autoCleanTrash(30)         → 清理过期回收站
                      4. 绑定导航按钮 → 只设 location.hash
                      5. 监听 hashchange → 唯一渲染入口
                      6. hash = '#/home'            → 触发首页渲染
```

---

## 四、导航与路由

### 路由表

| Hash | 页面 | 类名 |
|------|------|------|
| `#/home` | 学习首页 | `HomePage` |
| `#/favorites` | 收藏夹 | `FavoritesPage` |
| `#/trash` | 回收站 | `TrashPage` |
| `#/settings` | 设置 | `SettingsPage` |
| `#/challenge` | 挑战模式 | `ChallengePage` |
| `#/wrong-words` | 错题集 | `WrongWordsPage` |

### 渲染流程

```
导航按钮点击 → 只设 location.hash
浏览器前进/后退 → hashchange 事件
    └─→ _handleRoute(hash)
         └─→ if (page 变了) _renderPage(page)
               └─→ generation++ (防异步竞态)
                    └─→ await Page.render(container)
                          └─→ 如果是过时的 generation → 丢弃结果
```

### generation 锁防异步竞态

```javascript
this.generation = 0;
_renderPage(page) {
    const gen = ++this.generation;
    // ... await 异步操作 ...
    if (gen !== this.generation) return; // 过时，丢弃
}
```

**解决：** 快速切换页面时两个 async render 先后完成、后者覆盖前者的问题。

### 状态管理 — `window.AppState`

```javascript
window.AppState = {
    home: {
        shuffled: false,
        unitOrder: [],          // 首页单元排列顺序
        wordOrders: {},         // 每个单元内单词排列顺序 { unitId: [...] }
    },
    favorites: {
        category: '全部',
        sortMode: 'default',
        shuffledWords: null,
    }
}
```

---

## 五、数据库结构（IndexedDB）

| 对象仓库 | keyPath | 索引 | 说明 |
|---------|---------|------|------|
| `words` | `id` (autoIncrement) | `word`, `category`, `unit`, `book_id`, `is_favorite`, `deleted_at`, `familiarity` | 单词主表 |
| `books` | `id` (autoIncrement) | `name` | 词书表 |
| `settings` | `key` | — | 键值对设置 |
| `stats` | `id` (autoIncrement) | `date`, `type` | 学习统计 |

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

## 六、全局变量一览

| 变量 | 类型 | 说明 |
|------|------|------|
| `window.WordDB` | `WordDatabase` 实例 | 数据库操作入口 |
| `window.WordModel` | 类 | 数据模型工厂 |
| `window.WordCard` | 类 | 单词行组件（静态） |
| `window.UnitCard` | 类 | 单元卡片组件（静态） |
| `window.CategoryFilter` | 类 | 分类筛选组件（静态） |
| `window.HomePage` | 类 | 首页页面（静态） |
| `window.FavoritesPage` | 类 | 收藏夹页面（静态） |
| `window.TrashPage` | 类 | 回收站页面（静态） |
| `window.SettingsPage` | 类 | 设置页面（静态） |
| `window.ChallengePage` | 类 | 挑战模式页面（静态） |
| `window.WrongWordsPage` | 类 | 错题集页面（静态） |
| `window.HomeShuffle` | 类 | 首页排序工具（静态） |
| `window.WordSorter` | 类 | 通用排序模块（静态） |
| `window.AchievementHelper` | 类 | 成就系统（静态） |
| `window.WordParser` | 类 | 导入导出工具（静态） |
| `window.NotificationHelper` | 类 | 桌面通知工具（静态） |
| `window.StatsHelper` | 类 | 统计图表工具（静态） |
| `window.Toast` | 对象 | Toast 通知 `{ show(msg) }` |
| `window.AppState` | 对象 | 全局 UI 状态 |

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
| 全局混序 | `home.js` | 🔀 按钮打乱所有单元顺序和单词顺序，跨页面保持 |
| 熟悉度系统 | `wordCard.js` | 0~5 级，点击 ✓ 增加，圆点显示进度 |
| 收藏/取消收藏 | `wordCard.js` | ⭐ 按钮即点即切 |
| 软删除 | `wordCard.js` | ✕ 按钮移入回收站 |

### 收藏夹 (`#/favorites`)

| 功能 | 文件 | 说明 |
|------|------|------|
| 所有收藏单词独立展示 | `favorites.js` | 不受词书过滤影响 |
| 分类筛选 | `categoryFilter.js` | 同上类别 |
| 6 种排序模式 | `sorter.js` | 默认/熟悉度↑/熟悉度↓/A-Z/Z-A/随机混序 |
| 混序学习 | `favorites.js` | 🔀 按钮配合 AppState 保持 |
| 导出 JSON/CSV | `favorites.js` | 「📤 导出」按钮 → 下拉菜单 |

### 回收站 (`#/trash`)

| 功能 | 文件 | 说明 |
|------|------|------|
| 查看已删除单词 | `trash.js` | 显示删除时间 |
| 恢复单词 | `trash.js` | 回到原词书 |
| 永久删除 | `trash.js` | 从数据库彻底移除 |
| 一键清空 | `trash.js` | 清空所有回收站 |
| 自动清理 | `connection.js` | 超过 30 天自动删除（启动时执行） |

### 挑战模式 (`#/challenge`)

| 功能 | 文件 | 说明 |
|------|------|------|
| 3 种答题模式 | `challenge.js` | 四选一 / 汉→英拼写（首字母提示） / 英→汉拼写 |
| 难度筛选 | `challenge.js` | 简单（熟悉度≥3）/ 普通（全部）/ 困难（熟悉度≤2） |
| 生命值模式 | `challenge.js` | 3 条命，答错扣 1 |
| 限时模式 | `challenge.js` | 每题 10 秒超时 |
| 错题集专项练习 | `challenge.js` | rangeType: 'wrong-words' |
| 设置持久化 | `challenge.js` | settings 表存储 mode/difficulty/lives/timed |
| 即时反馈 | `challenge.js` | 选完立即显示正确/错误，高亮正确选项 |
| 熟悉度联动 | `challenge.js` | 答对+1（上限5），答错-1（下限0） |
| 冷却机制 | `challenge.js` | 7 天已挑战单词不重复 |
| 结果页 | `challenge.js` | 成绩/环图/错题回顾/冷却记录/成就触发 |
| 挑战记录 | `challenge.js` | 最近 20 条历史保存，设置页可查看 |

### 错题集 (`#/wrong-words`)

| 功能 | 文件 | 说明 |
|------|------|------|
| 挑战错词自动收集 | `wrongwords.js` | 挑战答错的单词自动加入 |
| 分类筛选 | `wrongwords.js` | 按类别过滤错题 |
| 单项删除 | `wrongwords.js` | 移除单个错题 |
| 一键清空 | `wrongwords.js` | 「🗑️ 清空错题」按钮 |
| 导出 JSON/CSV | `wrongwords.js` | 「📤 导出」按钮 → 下拉菜单 |
| 统计展示 | `wrongwords.js` | 错题总数和分类分布 |

### 设置 (`#/settings`)

| 功能 | 文件 | 说明 |
|------|------|------|
| 统计仪表盘 | `stats.js` | 总数/已学/收藏数 + 7 天趋势折线图 |
| 词书管理 | `settings.js` | 新增/删除/勾选激活词书 |
| 导入 | `settings.js` + `parser.js` | CSV/JSON 导入，自动创建词书 |
| 导出 | `settings.js` + `parser.js` | 导出为 JSON/CSV |
| 每日提醒 | `notifications.js` | 桌面通知，可设时间 |
| 局域网访问 | `settings.js` | WebRTC 获取 IP 地址 |
| 重置数据库 | `settings.js` | 清空所有数据重新初始化 |
| 成就墙 | `achievements.js` | 10 个成就展示（5 学习 + 5 挑战） |

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
12. utils/sorter.js            (通用排序模块)
13. utils/achievements.js      (成就系统)
14. widgets/categoryFilter.js  (分类筛选)
15. widgets/wordCard.js        (单词卡片)
16. widgets/unitCard.js        (单元卡片)
17. screens/home/shuffle.js    (混序工具)
18. screens/home.js            (首页)
19. screens/favorites.js       (收藏夹)
20. screens/trash.js           (回收站)
21. screens/settings.js        (设置)
22. screens/challenge.js       (挑战模式)
23. screens/wrongwords.js      (错题集)
24. app.js                     (★ 主入口，最后加载)
```

⚠️ **顺序不能乱** — 依赖关系严格。

---

## 九、多词书拆分（scripts/split_csv.js）

基于 [ECDICT](https://github.com/skywind3000/ECDICT) (MIT License) 的 tag 列，生成 6 本词书：

| 文件 | 内容 | 单词数 | 单元数 |
|------|------|--------|--------|
| `words_ky.json` | 考研词汇 (ky) | 4,801 | 49 |
| `words_toefl.json` | 托福词汇 (toefl) | 6,974 | 70 |
| `words_ielts.json` | 雅思词汇 (ielts) | 5,040 | 51 |
| `words_gre.json` | GRE 词汇 (gre) | 7,504 | 76 |
| `words_gk.json` | 高考词汇 (gk) | 3,677 | 37 |
| `words_zk.json` | 中考词汇 (zk) | 1,603 | 17 |

> 运行 `node scripts/split_csv.js` 生成，格式与现有 JSON 兼容<br>
> 注意：ecdict 中无 spoken/simple/computer/IT/ic/ai 标签，暂无法生成口语和计算机词书

---

## 十、Git 版本记录

```
5ccc39c (HEAD) feat: 综合复盘 — 文档同步 + CSS 增强 + 多词书拆分
b051fd1 feat: 导航菜单响应式折叠+高亮+淡入淡出动画
3dc47e0 feat: 增强排序功能 - 6种排序模式+状态保持
70bce09 挑战模式增强 + 成就系统扩展 + 错题集页面
8a52c20 v5 架构重写：路由+混序+收藏夹+单元卡片
7d4b277 fix: 收藏夹导航竞态 + _addBatch 主键冲突 + 全局混序
5f42a18 fix: 首页 onUpdate 空函数 + 通知图标修复
fc76349 docs: 收藏夹全链路分析 + Bug全量审查结果(19个)
36b7b09 fix: 导航按钮同页面不刷新 + 更新完整项目文档
24b454e fix: 彻底解决缓存问题 + 改用http-server(c-1)
```

---

## 十一、数据流

```
用户操作 → Hash 路由变化 (app.js) → _renderPage(page)
    └→ Page.render(container)
        ├── 设置 container.innerHTML
        ├── 绑定事件监听器
        ├── 调用 WordDB.xxx() 查询/写入 IndexedDB
        └── 渲染 DOM（单词/单元/卡片）
            └→ onUpdate 回调 → 重新调 _renderPage 或 _renderXxxList
```

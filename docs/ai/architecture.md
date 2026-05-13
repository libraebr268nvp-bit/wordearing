# WordWiz — 项目架构

## 目录树

```
d:\gxj\code\wordlearing/
├── index.html                          # 唯一 HTML，按序加载 24 个 JS（含 Chart.js）

├── start.bat                           # 启动脚本：npx http-server -p 3000 -c-1
├── server.py                           # Python 版开发服务器（备选）
├── download_words.py                   # Python 脚本：从 ECDICT 下载并转换词库为 JSON
├── ecdict.csv                          # ECDICT 英汉词典源文件（约 130 万词条）
│
├── css/
│   └── style.css                       # 深色科技感主题，网格点阵背景
│
├── js/
│   ├── app.js                          # ★ 主入口 - 路由调度 + 全局状态 + generation 锁
│   │
│   ├── db/                             # ★ 数据库层（6 文件，通过 prototype 挂载到 WordDatabase）
│   │   ├── connection.js               #   基类 + 建表（含 due_date 索引 v5）+ 工具方法 + 初始化 + 预置数据
│   │   ├── settings.dao.js             #   设置 DAO（saveSetting / getSetting）
│   │   ├── stats.dao.js                #   统计 DAO（getStats / recordStudyEvent / getStudyTrend）
│   │   ├── books.dao.js                #   词书 DAO（CRUD + 激活管理）
│   │   ├── words.dao.js                #   单词 DAO（CRUD + 查询 + 搜索 + 间隔复习）
│   │   └── index.js                    #   创建 window.WordDB 单例
│   │
│   ├── lib/
│   │   └── chart.umd.min.js            # Chart.js（学习趋势折线图）
│   │
│   ├── models/
│   │   └── word.js                     # 数据模型 - WordModel 工厂（含 due_date 字段）
│   │
│   ├── screens/
│   │   ├── home.js                     # 首页 - 学习页（含今日复习提示条）
│   │   ├── home/
│   │   │   └── shuffle.js              # 首页排序工具模块（HomeShuffle）
│   │   ├── favorites.js                # 收藏夹
│   │   ├── trash.js                    # 回收站
│   │   ├── settings.js                 # 设置
│   │   ├── challenge.js                # 挑战模式（#/challenge，含"今日待复习"范围）
│   │   └── wrongwords.js               # 错题集（#/wrong-words）
│   │
│   ├── widgets/
│   │   ├── categoryFilter.js           # 分类筛选按钮组
│   │   ├── unitCard.js                 # 单元卡片（折叠 + 混序）
│   │   └── wordCard.js                 # 单词行（✓ / ⭐ / ✕）
│   │
│   └── utils/
│       ├── parser.js                   # CSV/JSON 导入导出
│       ├── notifications.js            # 桌面通知提醒
│       ├── stats.js                    # Chart.js 统计图表 + 热力图渲染
│       ├── sorter.js                   # 通用排序模块（WordSorter，6 种排序模式）
│       └── achievements.js             # 成就系统（AchievementHelper，10 个成就）
│
├── assets/
│   ├── words_cet4.json                 # 四级词库
│   ├── words_cet6.json                 # 六级词库
│   ├── words_ky.json                   # 考研词库（split_csv.js 生成）
│   ├── words_toefl.json                # 托福词库（split_csv.js 生成）
│   ├── words_ielts.json                # 雅思词库（split_csv.js 生成）
│   ├── words_gre.json                  # GRE 词库（split_csv.js 生成）
│   ├── words_gk.json                   # 高考词库（split_csv.js 生成）
│   └── words_zk.json                   # 中考词库（split_csv.js 生成）
│
├── scripts/
│   ├── generate_manual.js              # 生成 WordWiz 使用手册 DOCX
│   └── split_csv.js                    # 从 ecdict.csv 按 tag 拆分多词书

│
└── docs/
    ├── project_overview.md             # 项目总文档
    ├── favorites_analysis.md           # 收藏夹全链路分析
    └── ai/                             # ← AI 辅助上下文
        ├── context.md
        ├── architecture.md
        ├── rules.md
        └── tasks.md
```

---

## 文件职责 & 关键函数签名

### `js/app.js` — 应用入口 + 路由
| 函数/属性 | 签名 | 说明 |
|-----------|------|------|
| `WordWizApp.init()` | `async init(): Promise<void>` | 打开DB → 初始化默认数据 → 绑定导航 → 监听 hashchange → 渲染首页 |
| `WordWizApp._renderPage(page)` | `async _renderPage(page: string): Promise<void>` | _renderGen 锁（this._renderGen），switch 调度各 Page.render() |
| `WordWizApp._handleRoute()` | `async _handleRoute(): Promise<void>` | hashchange 事件处理，提取 page 名后调 _renderPage |
| `WordWizApp._setupNavigation()` | `_setupNavigation(): void` | 绑定导航按钮点击 → 不同页面设 hash，同页面直接调 _renderPage |
| `WordWizApp._showFatalError(err)` | `_showFatalError(err: Error): void` | 致命错误页（含重置数据库按钮） |
| `window.AppState` | `{ home: { shuffled, unitOrder, wordOrders }, favorites: { category, sort, shuffled } }` | 全局 UI 状态 |
| `window.Toast.show(msg, type?)` | `show(msg: string, type?: string): void` | Toast 通知，3 秒自动消失（type: 'info'/'success'/'error'） |

### `js/db/connection.js` — 数据库基类 + 工具方法
| 函数 | 签名 | 说明 |
|------|------|------|
| `WordDatabase.open()` | `async open(): Promise<IDBDatabase>` | 打开/创建 IndexedDB，版本升级（v5 新增 due_date 索引） |
| `initializeDefaults()` | `async initializeDefaults(): Promise<void>` | 创建默认词书 + 迁移孤儿 + 预置 200 词 |
| `_getStore(storeName, mode)` | `async _getStore(storeName: string, mode: IDBTransactionMode): Promise<IDBObjectStore>` | 获取对象仓库引用 |
| `_getAll(storeName)` | `async _getAll(storeName: string): Promise<any[]>` | 获取全部记录 |
| `_getAllRaw(storeName, filterFn)` | `async _getAllRaw(storeName: string, filterFn?: Function): Promise<any[]>` | 全表扫描 + 可选过滤 |
| `_getByKey(storeName, key)` | `async _getByKey(storeName: string, key: any): Promise<any>` | 按 key 获取单条 |
| `_add(storeName, data)` | `async _add(storeName: string, data: object): Promise<number>` | 添加记录（自动去 id） |
| `_addBatch(storeName, dataArray)` | `async _addBatch(storeName: string, dataArray: object[]): Promise<number>` | 批量添加（跳过错误） |
| `_delete(storeName, key)` | `async _delete(storeName: string, key: any): Promise<boolean>` | 删除记录 |

### `js/db/words.dao.js` — 单词 DAO
| 函数 | 签名 | 说明 |
|------|------|------|
| `getAllWords()` | `async getAllWords(): Promise<WordModel[]>` | 获取所有未删除单词 |
| `getWordsByBooks(bookIds)` | `async getWordsByBooks(bookIds: number[]): Promise<WordModel[]>` | 按词书 ID 列表过滤（多归属） |
| `getWordsByCategory(category, bookIds)` | `async getWordsByCategory(category: string, bookIds?: number[]): Promise<WordModel[]>` | 分类筛选 |
| `getFavoriteWords(category, bookIds)` | `async getFavoriteWords(category?: string, bookIds?: number[]): Promise<WordModel[]>` | 获取收藏单词 |
| `getTrashWords()` | `async getTrashWords(): Promise<WordModel[]>` | 获取回收站单词 |
| `getWordById(id)` | `async getWordById(id: number): Promise<WordModel\|null>` | 按 ID 获取 |
| `getWordsByIds(ids)` | `async getWordsByIds(ids: number[]): Promise<WordModel[]>` | 按 ID 数组批量获取 |
| `getAllDeletedWords()` | `async getAllDeletedWords(): Promise<WordModel[]>` | 获取所有已删除单词（含熟悉度排序） |
| `addWord(wordData)` | `async addWord(wordData: object): Promise<number>` | 添加单词，返回新 ID |
| `addWords(wordsArray)` | `async addWords(wordsArray: object[]): Promise<number>` | 批量添加（支持多归属 + 去重） |
| `updateWord(id, updates)` | `async updateWord(id: number, updates: object): Promise<WordModel\|null>` | 更新单词字段 |
| `increaseFamiliarity(id)` | `async increaseFamiliarity(id: number): Promise<WordModel\|null>` | 熟悉度 +1（上限 5，同时更新 due_date） |
| `_calcDueDateStr(familiarity)` | `_calcDueDateStr(familiarity: number): string` | 根据熟悉度计算下次复习日期（间隔：1/2/4/7/15/30 天） |
| `updateDueDate(id, familiarity)` | `async updateDueDate(id: number, familiarity: number): Promise<WordModel\|null>` | 手动更新单词复习日期 |
| `getDueWords(bookIds)` | `async getDueWords(bookIds: number[]): Promise<WordModel[]>` | 获取已到期的待复习单词 |
| `getDueWordCount(bookIds)` | `async getDueWordCount(bookIds: number[]): Promise<number>` | 获取到期单词数（仅计数，优化性能） |
| `toggleFavorite(id)` | `async toggleFavorite(id: number): Promise<WordModel\|null>` | 切换收藏状态 |
| `softDeleteWord(id)` | `async softDeleteWord(id: number): Promise<WordModel\|null>` | 软删除（设 deleted_at，保留收藏状态） |
| `restoreWord(id)` | `async restoreWord(id: number): Promise<WordModel\|null>` | 恢复（设 deleted_at=null） |
| `hardDeleteWord(id)` | `async hardDeleteWord(id: number): Promise<boolean>` | 物理删除 |
| `clearTrash()` | `async clearTrash(): Promise<number>` | 清空回收站 |
| `autoCleanTrash(days)` | `async autoCleanTrash(days?: number): Promise<number>` | 清理过期回收站 |
| `searchWords(keyword)` | `async searchWords(keyword: string): Promise<WordModel[]>` | 模糊搜索（最多 50 条） |

### `js/db/books.dao.js` — 词书 DAO
| 函数 | 签名 | 说明 |
|------|------|------|
| `getBooks()` | `async getBooks(): Promise<BookModel[]>` | 获取所有词书 |
| `getBookById(id)` | `async getBookById(id: number): Promise<BookModel\|null>` | 按 ID 获取词书 |
| `addBook(bookData)` | `async addBook(bookData: object): Promise<number>` | 新增词书 |
| `updateBook(id, updates)` | `async updateBook(id: number, updates: object): Promise<BookModel\|null>` | 更新词书字段 |
| `deleteBook(bookId)` | `async deleteBook(bookId: number): Promise<boolean>` | 删除词书（单词归入默认词书） |
| `getActiveBookIds()` | `async getActiveBookIds(): Promise<number[]>` | 获取勾选的词书 ID |

### `js/db/settings.dao.js` — 设置 DAO
| 函数 | 签名 | 说明 |
|------|------|------|
| `saveSetting(key, value)` | `async saveSetting(key: string, value: any): Promise<void>` | 保存设置项 |
| `getSetting(key)` | `async getSetting(key: string): Promise<any>` | 读取设置项 |
| `removeSetting(key)` | `async removeSetting(key: string): Promise<void>` | 删除设置项 |
| `getAllSettings()` | `async getAllSettings(): Promise<Object>` | 获取所有设置 |
| `resetAllSettings()` | `async resetAllSettings(): Promise<void>` | 重置所有设置（清空后再重置） |

### `js/db/stats.dao.js` — 统计 DAO
| 函数 | 签名 | 说明 |
|------|------|------|
| `getStats()` | `async getStats(): Promise<Stats>` | 获取统计数据（总数/已学/收藏数等） |
| `recordStudyEvent(word, category)` | `async recordStudyEvent(word: string, category: string): Promise<number>` | 记录学习事件 |
| `getStudyTrend(days)` | `async getStudyTrend(days?: number): Promise<{date,count}[]>` | 获取学习趋势（7 天/30 天） |
| `getCategoryStats()` | `async getCategoryStats(): Promise<{category, learned, total}[]>` | 获取各分类学习进度 |
| `getWeekActivity()` | `async getWeekActivity(): Promise<{date, count}[]>` | 获取本周学习活动数据 |
| `getWrongWordCount()` | `async getWrongWordCount(): Promise<number>` | 获取错题总数 |
| `getRecentWrongWords()` | `async getRecentWrongWords(limit?: number): Promise<string[]>` | 获取近期错词列表 |

### `js/models/word.js` — 数据模型
| 函数 | 签名 | 说明 |
|------|------|------|
| `WordModel.create(params)` | `static create(params: object): WordRecord` | 工厂方法，标准化默认值（含 due_date） |
| `WordModel.fromRow(row)` | `static fromRow(row: object): WordRecord\|null` | 数据库行 → 安全转换（含 due_date） |
| `WordModel.getFamiliarityLabel(fam)` | `static getFamiliarityLabel(fam: number): string` | 0→陌生、1→见过……5→掌握 |

### `js/screens/home.js` — 首页
| 函数 | 说明 |
|------|------|
| `HomePage.render(container)` | 渲染首页：词书筛选 + 今日复习提示条 + 搜索 + 分类 + 全局混序 + 单元列表 |
| `HomePage._renderDueBanner(container)` | 渲染今日复习提示条（到期单词数 + 直达挑战按钮） |
| `HomePage._resetShuffle()` | 重置 AppState.home 混序状态 |
| `HomePage._renderUnits(container)` | 按 AppState 排列渲染单元卡片 |
| `HomePage._setupSearch(container)` | 300ms 防抖搜索，点击定位到单词 |
| `HomePage._renderBookFilter(container)` | 词书筛选按钮 |

### `js/screens/favorites.js` — 收藏夹
| 函数 | 说明 |
|------|------|
| `FavoritesPage.render(container)` | 渲染收藏夹：分类 + 排序 + 混序 + 单词列表 |
| `FavoritesPage._renderFavList(container)` | 获取收藏单词 → 排序 → 混序 → 渲染 |

### `js/screens/trash.js` — 回收站
| 函数 | 说明 |
|------|------|
| `TrashPage.render(container)` | 渲染回收站 + 清空按钮 |
| `TrashPage._renderTrashList(container)` | 获取回收站单词，每条有恢复/永久删除按钮 |

### `js/screens/settings.js` — 设置
| 函数 | 说明 |
|------|------|
| `SettingsPage.render(container)` | 渲染所有设置模块 |
| `SettingsPage._renderBookManagement(container)` | 词书列表 + 勾选 + 新增 + 删除 |
| `SettingsPage._showLanAddress(container)` | WebRTC 获取局域网 IP |
| `SettingsPage._downloadFile(content, filename, mimeType)` | Blob 下载文件 |

### `js/screens/challenge.js` — 挑战模式
| 函数 | 说明 |
|------|------|
| `ChallengePage.render(container)` | 清理冷却 → 渲染挑战开始页 |
| `ChallengePage._cleanRecentWords()` | 清除超过 7 天的冷却记录 |
| `ChallengePage._getAvailablePool(category, rangeType)` | 获取可用词库（排除冷却中的词），支持 'due-review' 范围 |
| `ChallengePage._recordRecentWords(wordIds)` | 记录本次单词到冷却列表 |
| `ChallengePage._recordHistory(total, correct, elapsed, count, rangeType)` | 记录挑战结果到历史 |
| `ChallengePage._renderStart(container)` | 设置 UI（题数/范围/分类/模式/难度/生命值/限时） |
| `ChallengePage._startGame(container)` | 读取设置 → 获取可用词 → Fisher-Yates 抽题 → 进入答题 |
| `ChallengePage._buildQuestion(word, pool)` | 为一道题生成 1 正确 + 3 干扰选项 |
| `ChallengePage._renderQuestion(container)` | 渲染答题界面（单词 + 4 选项 + 进度 + 计时 + 连对） |
| `ChallengePage._handleAnswer(container, btn)` | 处理选择 → 更新熟悉度 → 标记 → 下一题 |
| `ChallengePage._renderResult(container)` | 渲染结果页（成绩/环图/错题回顾/冷却记录/成就触发） |
| 状态机 | `start → playing → result` 三态切换 |

### `js/screens/wrongwords.js` — 错题集
| 函数 | 说明 |
|------|------|
| `WrongWordsPage.render(container)` | 渲染错题集页面：统计 + 分类筛选 + 单词列表 |
| `WrongWordsPage._renderList(container)` | 获取错题数据 → 渲染统计/筛选/列表 |
| `WrongWordsPage._renderWords(container, wrongWords, activeCategory)` | 渲染错题列表（过滤 + 单项删除） |
| `WrongWordsPage._setupExport(container)` | 配置导出按钮（JSON / CSV） |

### `js/screens/home/shuffle.js` — 首页排序工具
| 函数 | 说明 |
|------|------|
| `HomeShuffle.reset()` | 重置排序状态为默认 |
| `HomeShuffle.setMode(mode, words)` | 设置排序模式并生成 shuffled 排列 |
| `HomeShuffle.getSortedWords(words)` | 获取排序后的单词列表 |
| `HomeShuffle.isShuffled()` | 判断当前是否处于 shuffled 模式 |

### `js/utils/sorter.js` — 通用排序模块
| 函数 | 说明 |
|------|------|
| `WordSorter.MODES` | 6 种排序模式数组 |
| `WordSorter.getLabel(mode)` | 获取排序模式显示标签 |
| `WordSorter.getShortLabel(mode)` | 获取排序模式短标签 |
| `WordSorter.sort(words, mode, storedOrder)` | 排序入口（6 种模式） |
| `WordSorter.shuffle(arr)` | Fisher-Yates 洗牌 |
| `WordSorter.isDeterministic(mode)` | 判断排序模式是否确定（非随机） |
| `WordSorter.renderSelector(currentMode, onChange)` | 渲染排序选择器 HTML |
| `WordSorter.bindSelector(container, onChange)` | 绑定排序选择器事件 |

### `js/utils/achievements.js` — 成就系统
| 函数 | 说明 |
|------|------|
| `AchievementHelper.DEFINITIONS` | 10 个成就定义（5 学习 + 5 挑战），含 group/rarity 预留字段 |
| `AchievementHelper._getAchievements()` | 从 settings 表读取成就状态 |
| `AchievementHelper._unlock(id)` | 解锁成就 + 庆祝弹窗 |
| `AchievementHelper.checkFirstStudy()` | 检测「首次学习」 |
| `AchievementHelper.checkHundredWords()` | 检测「百词达人」 |
| `AchievementHelper.checkSevenDays()` | 检测「连续 7 天」 |
| `AchievementHelper.checkFiftyFavorites()` | 检测「收藏 50 个」 |
| `AchievementHelper.checkTrashCleaner()` | 检测「清理大师」 |
| `AchievementHelper.recordStudy()` | 记录学习动作 → 检测学习类成就 |
| `AchievementHelper.recordChallenge(correct, total, elapsed, maxStreak)` | 记录挑战结果 → 检测 5 个成就 |
| `AchievementHelper.checkAll()` | 全量检测 |
| `AchievementHelper.renderWall(container)` | 渲染成就墙 |

### **widgets**
| 文件 | 类 | 关键函数 | 说明 |
|------|-----|---------|------|
| `categoryFilter.js` | `CategoryFilter` | `static render(container, activeCategory, onChange)` | 渲染分类按钮组 |
| `unitCard.js` | `UnitCard` | `static render(unit, words, options?)` | 单元卡片（`options.hideShuffle` 控制混序按钮显示） |
| `wordCard.js` | `WordCard` | `static render(word, options?)` | 单词行（options.onUpdate 用于回调刷新） |

### **utils**
| 文件 | 类 | 关键函数 | 说明 |
|------|-----|---------|------|
| `parser.js` | `WordParser` | `parseCSV(text, options)`, `parseJSON(text, options)`, `exportToJSON()`, `exportToCSV()` | 导入导出 |
| `notifications.js` | `NotificationHelper` | `requestPermission()`, `sendReviewReminder(count)`, `checkDailyReminder()`, `startReminderChecker()` | 桌面提醒 |
| `stats.js` | `StatsHelper` | `renderDashboard(container)`, `renderTrendChart(canvas, data)`, `renderHeatmap(container)` | 统计面板 + Chart.js 趋势图 + 热力图 |

---

## 数据模型字段表

### words 表
| 字段 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `id` | number | autoIncrement | 主键 |
| `word` | string | — | 英文单词 |
| `definition` | string | — | 中文释义 |
| `category` | string | '四级' | 分类 |
| `unit` | number | 1 | 所属单元（约 100 词/单元） |
| `book_id` | number | 1 | 主归属词书 ID（兼容旧版） |
| `book_ids` | number[] | [book_id] | 多归属词书 ID 数组（v5 新增） |
| `familiarity` | number | 0 | 熟悉度 0~5 |
| `due_date` | string\|null | null | 下次复习日期（YYYY-MM-DD，v5.2 新增） |
| `is_favorite` | boolean | false | 是否收藏 |
| `book_source` | string | '内置词库' | 来源词书名称 |
| `deleted_at` | string\|null | null | 软删除时间（回收站用） |
| `created_at` | string | ISO 日期 | 创建时间 |

### books 表
| 字段 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `id` | number | autoIncrement | 主键 |
| `name` | string | — | 词书名称 |
| `description` | string | '' | 描述 |
| `is_system` | boolean | false | 系统内置词书 |
| `created_at` | string | 当前时间 | 创建时间 |

### settings 表
| 字段 | 类型 | 说明 |
|------|------|------|
| `key` | string | 主键（如 `active_books`、`reminder_enabled`） |
| `value` | any | 任意值 |

### stats 表
| 字段 | 类型 | 说明 |
|------|------|------|
| `id` | number | autoIncrement |
| `date` | string | 日期（YYYY-MM-DD） |
| `word` | string | 学习的单词 |
| `category` | string | 单词分类 |
| `type` | string | 事件类型（如 `familiar`） |
| `timestamp` | string | ISO 时间戳 |

---

## 窗口全局变量一览

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
| `window.Toast` | 对象 | Toast 通知 `{ show(msg, type?) }` type: 'info'/'success'/'error' |
| `window.AppState` | 对象 | 全局 UI 状态 |

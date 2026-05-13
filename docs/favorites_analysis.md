# 收藏夹功能全链路分析

> 基于当前代码（2026-05，v6 架构）梳理收藏功能完整链路

---

## 一、数据模型层 — `js/models/word.js`

### 字段定义

| 字段 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `is_favorite` | boolean | `false` | 是否收藏，`WordModel.create` 中 `!!is_favorite` 转为布尔 |

### 相关代码段

```javascript
// word.js - WordModel.create() 参数解构
static create({ ..., is_favorite = false, ... } = {}) {
    return {
        // ...
        is_favorite: !!is_favorite,
        // ...
    };
}

// word.js - WordModel.fromRow() 容错转换（兼容 0/1 整数和布尔值）
is_favorite: row.is_favorite === 1 || row.is_favorite === true,
```

---

## 二、数据库层 — `js/db/words.dao.js`

### 收藏相关方法

```javascript
// toggleFavorite(id) — 切换收藏状态
WordDatabase.prototype.toggleFavorite = async function(id) {
    const word = await this.getWordById(id);
    if (!word) return null;
    return this.updateWord(id, { is_favorite: !word.is_favorite });
};

// softDeleteWord(id) — 软删除，保留收藏状态（回收站还原后可恢复）
WordDatabase.prototype.softDeleteWord = async function(id) {
    return this.updateWord(id, { 
        deleted_at: new Date().toISOString()
    });
};

// getFavoriteWords(category, bookIds) — 获取收藏单词
WordDatabase.prototype.getFavoriteWords = async function(category = null, bookIds = null) {
    let words;
    if (bookIds) {
        words = await this.getWordsByBooks(bookIds);
    } else {
        words = await this.getAllWords();
    }
    words = words.filter(w => w.is_favorite);
    if (category && category !== '全部') {
        words = words.filter(w => w.category === category);
    }
    return words;
};
```

### 调用的基础方法

```javascript
// getAllWords() → 遍历 words 表，按 _isNotDeleted 过滤 → WordModel.fromRow()
WordDatabase.prototype.getAllWords = async function() {
    const results = await this._getAllRaw('words', (row) => this._isNotDeleted(row));
    return results.map(r => WordModel.fromRow(r)).filter(r => r !== null);
};

// getWordsByBooks(bookIds) → 按 book_ids 多归属过滤未删除单词
WordDatabase.prototype.getWordsByBooks = async function(bookIds) {
    const results = await this._getAllRaw('words', row => 
        this._isNotDeleted(row) && WordModel.belongsToBook(row, bookIds)
    );
    return results.map(r => WordModel.fromRow(r)).filter(r => r !== null);
};
```

---

## 三、UI 组件层 — `js/widgets/wordCard.js`

### 收藏按钮渲染

```javascript
// 收藏按钮（⭐）
const favBtn = document.createElement('button');
favBtn.className = `action-btn favorite ${word.is_favorite ? 'favorited' : ''}`;
favBtn.title = word.is_favorite ? '取消收藏' : '收藏';
favBtn.textContent = '⭐';

// 点击事件 — 调 WordDB.toggleFavorite(id) 切换
favBtn.addEventListener('click', async (e) => {
    e.stopPropagation();
    const updated = await WordDB.toggleFavorite(word.id);
    if (updated) {
        favBtn.classList.toggle('favorited');
        favBtn.title = updated.is_favorite ? '取消收藏' : '收藏';
        window.Toast.show(updated.is_favorite ? '⭐ 已收藏' : '已取消收藏');
        if (options.onUpdate) options.onUpdate();  // ← 触发列表刷新
    }
});
```

### 删除按钮联动

```javascript
// 删除时自动调用 softDeleteWord（保留收藏状态，回收站还原后可恢复）
delBtn.addEventListener('click', async (e) => {
    e.stopPropagation();
    if (confirm(`确定要将 "${word.word}" 移入回收站？`)) {
        await WordDB.softDeleteWord(word.id);
        row.classList.add('deleted');
        row.style.display = 'none';
        window.Toast.show(`🗑️ "${word.word}" 已移入回收站`);
        if (options.onUpdate) options.onUpdate();
    }
});
```

---

## 四、UI 页面层 — `js/screens/favorites.js`

### 当前架构（v6 静态类 + 6 种排序 + 动态分类 + 导出）

```javascript
class FavoritesPage {
    static async render(container) {
        // 渲染页面骨架：标题 + 混序/导出按钮 + 分类筛选 + 排序选择器 + 列表
    }
    
    static async _renderFavList(container) {
        // 1. 调 WordDB.getFavoriteWords(AppState.favorites.category)
        // 2. 按当前排序模式（WordSorter）排序或混序
        // 3. 调用 WordCard.render() 逐行渲染
        // 4. 空状态处理
    }

    static _renderSortSelector(container) {
        // 用 WordSorter.renderSelector() 生成 6 种排序按钮
        // 默认/熟悉度↑/熟悉度↓/A-Z/Z-A/随机混序
    }
}
```

**关键特点：**
- 使用 `CategoryFilter` 组件（v2 动态分类，不再硬编码）
- 6 种排序模式通过 `WordSorter` 统一管理
- 混序状态存储在 `AppState.favorites.shuffledWords`
- 导出功能内置 「📤 导出」→ JSON / CSV 下拉菜单

### 导出功能（`_setupExport`）

```javascript
// 使用 WordParser.exportFavoritesToJSON(category) / .exportFavoritesToCSV(category)
// 通过 Blob + 临时 <a> 触发下载
```

---

## 五、路由层 — `js/app.js`

```javascript
// app.js - _renderPage() 调度
case 'favorites':
    if (typeof FavoritesPage?.render === 'function') await FavoritesPage.render(this.container);
    break;
```

### HTML 导航按钮

```html
<!-- index.html -->
<button class="nav-btn" data-page="favorites" title="收藏夹">
    <span class="nav-icon">⭐</span>
    <span class="nav-label">收藏</span>
</button>
```

---

## 六、数据流总结

```
用户点击 ⭐ (wordCard.js)
    → WordDB.toggleFavorite(id)  (words.dao.js)
        → updateWord(id, { is_favorite: !word.is_favorite })
            → IndexedDB put
    → 刷新 UI: options.onUpdate()

用户点击收藏夹导航 (app.js _setupNavigation)
    → this._renderPage('favorites')
        → FavoritesPage.render(container)  (favorites.js)
            → CategoryFilter.render()      动态分类（从数据库获取）
            → WordDB.getFavoriteWords()    获取收藏
            → WordSorter.sort()            排序
            → WordCard.render()            逐行渲染

用户删除单词 (wordCard.js delBtn)
    → WordDB.softDeleteWord(id)  (words.dao.js)
        → updateWord(id, { deleted_at: ... })  （保留收藏状态）
    → options.onUpdate() → 刷新收藏夹
```

---

## 七、与收藏夹相关的所有文件总览

| 文件 | 角色 |
|------|------|
| `js/models/word.js` | 字段定义 `is_favorite` |
| `js/db/words.dao.js` | CRUD：toggleFavorite, getFavoriteWords, softDeleteWord, getWordsByBooks |
| `js/widgets/wordCard.js` | UI 收藏按钮 ⭐，删除按钮 |
| `js/screens/favorites.js` | 收藏页面完整实现 |
| `js/app.js` | 路由调度 `_renderPage('favorites')` |
| `js/utils/parser.js` | 导出时包含 `is_favorite` 字段 |
| `js/utils/sorter.js` | 6 种排序模式 |
| `js/utils/stats.js` | 统计仪表盘显示收藏数 `favoriteCount` |
| `js/widgets/categoryFilter.js` | 动态分类筛选组件 |
| `index.html` | 导航按钮 `data-page="favorites"` |

---

## 八、Git 版本演进

| 提交 | 变更 |
|------|------|
| `7d4b277` | 修复收藏夹导航竞态 |
| `8a52c20` | v5 架构重写：收藏夹从实例化改为静态类 |
| `b051fd1` | 导航菜单响应式折叠 |
| `3f34c61` | 收藏夹分类筛选改为动态分类 |
| `3f5b911` | 多归属标签系统 v5 + 文档同步 |

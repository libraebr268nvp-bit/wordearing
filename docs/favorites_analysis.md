# 收藏夹功能全链路分析

> 按文件提取所有与收藏功能相关的代码，包含行号参考。

---

## 一、数据模型层 — `js/models/word.js`

### 字段定义

| 字段 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `is_favorite` | boolean | `false` | 是否收藏，`WordModel.create` 中 `!!is_favorite` 转为布尔 |

### 相关代码段

```javascript
// word.js - WordModel.create() 参数解构
static create({ id, word, definition, category = '四级', unit = 1, book_id = 1,
                 familiarity = 0, is_favorite = false, book_source = '内置词库',
                 deleted_at = null, created_at = null } = {}) {
    // ...
    is_favorite: !!is_favorite,
    // ...
}

// word.js - WordModel.fromRow() 容错转换
is_favorite: row.is_favorite === 1 || row.is_favorite === true,
```

---

## 二、数据库层 — `js/db.js`

### `db.js` — 收藏相关方法

```javascript
// === toggleFavorite(id) — 切换收藏状态 ===
async toggleFavorite(id) {
    const word = await this.getWordById(id);
    if (!word) return null;
    return this.updateWord(id, { is_favorite: !word.is_favorite });
}

// === softDeleteWord(id) — 软删除时自动取消收藏 ===
async softDeleteWord(id) {
    return this.updateWord(id, { 
        deleted_at: new Date().toISOString(),
        is_favorite: false  // ← 删除时强制取消收藏
    });
}

// === getFavoriteWords(category, bookIds) — 获取收藏单词 ===
async getFavoriteWords(category = null, bookIds = null) {
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
}
```

### 调用的基础方法

```javascript
// getAllWords() → 遍历 words 表，按 _isNotDeleted 过滤 → WordModel.fromRow()
async getAllWords() {
    const results = await this._getAllRaw('words', (row) => this._isNotDeleted(row));
    return results.map(r => WordModel.fromRow(r)).filter(r => r !== null);
}

// getWordsByBooks(bookIds) → 按 book_id 过滤未删除单词
async getWordsByBooks(bookIds) {
    const results = await this._getAllRaw('words', row => 
        this._isNotDeleted(row) && bookIds.includes(row.book_id)
    );
    return results.map(r => WordModel.fromRow(r)).filter(r => r !== null);
}
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

// 点击事件
favBtn.addEventListener('click', async (e) => {
    e.stopPropagation();
    const updated = await WordDB.toggleFavorite(word.id);
    if (updated) {
        favBtn.classList.toggle('favorited');
        favBtn.title = updated.is_favorite ? '取消收藏' : '收藏';
        window.Toast.show(updated.is_favorite ? '⭐ 已收藏' : '已取消收藏');
        if (options.onUpdate) options.onUpdate();
    }
});
```

### 删除按钮联动

```javascript
// 删除时自动调用 softDeleteWord（内部取消收藏）
delBtn.addEventListener('click', async (e) => {
    e.stopPropagation();
    if (confirm(`确定要将 "${word.word}" 移入回收站？`)) {
        await WordDB.softDeleteWord(word.id);  // ← 内部设 is_favorite = false
        row.classList.add('deleted');
        row.style.display = 'none';
        window.Toast.show(`🗑️ "${word.word}" 已移入回收站`);
        if (options.onUpdate) options.onUpdate();  // ← 触发收藏夹刷新
    }
});
```

---

## 四、UI 页面层 — `js/screens/favorites.js`

### 完整代码（当前最新版本）

```javascript
class FavoritesPage {
    constructor() {
        this.currentCategory = '全部';
        this.currentSort = 'default';
        this.shuffled = false;
    }

    async render(container) {
        container.innerHTML = `
            <div class="page-header">
                <div class="page-title">⭐ 收藏夹</div>
                <div>
                    <button class="btn btn-sm btn-primary" id="shuffleFavBtn">🔀 混序学习</button>
                </div>
            </div>
            <div id="favCategoryFilter"></div>
            <div class="sort-group">
                <span class="sort-label">排序：</span>
                <button class="sort-btn active" data-sort="default">默认</button>
                <button class="sort-btn" data-sort="asc">熟悉度 ↑</button>
                <button class="sort-btn" data-sort="desc">熟悉度 ↓</button>
            </div>
            <div id="favList"></div>
        `;

        // 分类筛选
        const filterContainer = container.querySelector('#favCategoryFilter');
        CategoryFilter.render(filterContainer, '全部', (category) => {
            this.currentCategory = category;
            this._renderFavList(container);
        });

        // 排序按钮
        container.querySelectorAll('.sort-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                container.querySelectorAll('.sort-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                this.currentSort = btn.dataset.sort;
                this.shuffled = false;
                document.getElementById('shuffleFavBtn').textContent = '🔀 混序学习';
                this._renderFavList(container);
            });
        });

        // 混序按钮
        const shuffleBtn = document.getElementById('shuffleFavBtn');
        if (shuffleBtn) {
            shuffleBtn.addEventListener('click', () => {
                this.shuffled = !this.shuffled;
                shuffleBtn.textContent = this.shuffled ? '🔁 恢复顺序' : '🔀 混序学习';
                this._renderFavList(container);
            });
        }

        await this._renderFavList(container);
    }

    async _renderFavList(container) {
        const listContainer = container.querySelector('#favList');
        if (!listContainer) return;
        
        listContainer.innerHTML = '<div style="text-align:center;padding:40px;color:var(--text-muted)">⏳ 加载中...</div>';

        try {
            // P0 修复：不再传 activeBookIds
            let words = await WordDB.getFavoriteWords(this.currentCategory);

            if (!words || words.length === 0) {
                listContainer.innerHTML = `...⏳ 加载中...</div>`; break;
                // P0 修复：空列表检查
            }

            // 排序（P0 修复：?? 0 兜底）
            if (this.currentSort === 'asc')
                words.sort((a, b) => (a.familiarity ?? 0) - (b.familiarity ?? 0));
            else if (this.currentSort === 'desc')
                words.sort((a, b) => (b.familiarity ?? 0) - (a.familiarity ?? 0));

            // 混序
            if (this.shuffled) {
                for (let i = words.length - 1; i > 0; i--) {
                    const j = Math.floor(Math.random() * (i + 1));
                    [words[i], words[j]] = [words[j], words[i]];
                }
            }

            // 独立渲染，不依赖 unitCard
            listContainer.innerHTML = '';
            const wrapper = document.createElement('div');
            wrapper.className = 'unit-card';
            // ...渲染每一个 word
            for (const word of words) {
                try {
                    if (!word || !word.word) continue;
                    const wordRow = WordCard.render(word, {
                        onUpdate: () => this._renderFavList(container)
                    });
                    if (wordRow) list.appendChild(wordRow);
                } catch (e) {
                    console.warn('收藏夹跳过脏数据:', e, word);
                }
            }
            // P0 修复：空列表检测
            if (list.children.length === 0) {
                listContainer.innerHTML = `...暂无有效收藏...`;
                return;
            }
            listContainer.appendChild(wrapper);
        } catch (e) {
            console.error('收藏夹渲染失败:', e);
            listContainer.innerHTML = `...加载出错...`;
        }
    }
}

window.FavoritesPage = new FavoritesPage();  // ★ 实例化，而非静态类
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
    → WordDB.toggleFavorite(id)  (db.js)
        → updateWord(id, { is_favorite: !word.is_favorite })
            → IndexedDB put
    → 刷新 UI: options.onUpdate()

用户点击收藏夹导航 (app.js _setupNavigation)
    → this._renderPage('favorites')
        → FavoritesPage.render(container)  (favorites.js)
            → WordDB.getFavoriteWords(category)  (db.js)
                → getAllWords() → 遍历所有 is_favorite=true
            → 渲染单词列表

用户删除单词 (wordCard.js delBtn)
    → WordDB.softDeleteWord(id)  (db.js)
        → updateWord(id, { deleted_at: ..., is_favorite: false })
    → options.onUpdate() → 刷新收藏夹
```

---

## 七、与收藏夹相关的所有文件总览

| 文件 | 角色 | 关键行 |
|------|------|--------|
| `js/models/word.js` | 字段定义 `is_favorite` | create(), fromRow() |
| `js/db.js` | CRUD：toggleFavorite, getFavoriteWords, softDeleteWord | ~7 个方法 |
| `js/widgets/wordCard.js` | UI 收藏按钮 ⭐，删除按钮 | 2 个事件绑定 |
| `js/screens/favorites.js` | 收藏页面完整实现 | 核心渲染逻辑 |
| `js/app.js` | 路由调度 `_renderPage('favorites')` | 1 个 case |
| `js/utils/parser.js` | 导出时包含 `is_favorite` 字段 | exportToJSON/CSV |
| `js/utils/stats.js` | 统计仪表盘显示收藏数 `favoriteCount` | renderDashboard() |
| `index.html` | 导航按钮 `data-page="favorites"` | 1 个 button |

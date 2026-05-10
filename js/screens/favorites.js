/**
 * WordWiz - 收藏夹页面
 * 
 * 功能：
 * - 显示收藏的单词（is_favorite = true）
 * - 按分类筛选
 * - 按熟悉度排序（升序/降序）
 * - 混序学习按钮
 * 
 * v3 修复：
 * - 增加 try-catch 容错，防止脏数据导致白屏
 * - 独立渲染，不依赖单元结构
 * - 数据容错兜底
 */

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
                    <button class="btn btn-sm btn-primary" id="shuffleFavBtn">
                        🔀 混序学习
                    </button>
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

        const filterContainer = container.querySelector('#favCategoryFilter');
        CategoryFilter.render(filterContainer, '全部', (category) => {
            this.currentCategory = category;
            this._renderFavList(container);
        });

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
            // 获取已激活词书 ID
            const activeBookIds = await WordDB.getActiveBookIds();
            let words = await WordDB.getFavoriteWords(this.currentCategory, activeBookIds);

            if (!words || words.length === 0) {
                listContainer.innerHTML = `
                    <div class="empty-state">
                        <div class="empty-icon">⭐</div>
                        <div class="empty-text">暂无收藏单词</div>
                        <p style="color:var(--text-muted);font-size:13px;margin-top:8px;">
                            在学习页面点击 ⭐ 按钮收藏单词
                        </p>
                    </div>
                `;
                return;
            }

            // 排序
            if (this.currentSort === 'asc') {
                words.sort((a, b) => a.familiarity - b.familiarity);
            } else if (this.currentSort === 'desc') {
                words.sort((a, b) => b.familiarity - a.familiarity);
            }

            // 混序
            if (this.shuffled) {
                for (let i = words.length - 1; i > 0; i--) {
                    const j = Math.floor(Math.random() * (i + 1));
                    [words[i], words[j]] = [words[j], words[i]];
                }
            }

            // 构建列表 - 独立布局，不依赖 unitCard
            listContainer.innerHTML = '';
            const wrapper = document.createElement('div');
            wrapper.className = 'unit-card';
            
            const header = document.createElement('div');
            header.className = 'unit-header';
            header.innerHTML = `<div class="unit-title">⭐ 收藏的单词 <span class="unit-count">· ${words.length} 词</span></div>`;
            wrapper.appendChild(header);

            const list = document.createElement('div');
            list.className = 'word-list';
            
            for (const word of words) {
                try {
                    if (!word || !word.word) continue; // 跳过脏数据
                    const wordRow = WordCard.render(word, {
                        onUpdate: () => this._renderFavList(container)
                    });
                    if (wordRow) list.appendChild(wordRow);
                } catch (e) {
                    console.warn('收藏夹渲染跳过脏数据:', e, word);
                }
            }
            
            wrapper.appendChild(list);
            listContainer.appendChild(wrapper);
        } catch (e) {
            console.error('收藏夹渲染失败:', e);
            listContainer.innerHTML = `
                <div class="empty-state">
                    <div class="empty-icon">⚠️</div>
                    <div class="empty-text">加载出错</div>
                    <p style="color:var(--text-muted);font-size:13px;margin-top:8px;">
                        ${e.message || '请刷新页面重试'}
                    </p>
                </div>
            `;
        }
    }
}

window.FavoritesPage = new FavoritesPage();

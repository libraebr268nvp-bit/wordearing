/**
 * WordWiz - 收藏夹页面
 * 
 * 功能：
 * - 显示收藏的单词（is_favorite = true）
 * - 按分类筛选
 * - 按熟悉度排序（升序/降序）
 * - 混序学习按钮
 * 
 * v5 重写：
 * - 从实例单例改为静态类（与其他页面一致）
 * - 状态使用 AppState.favorites
 */

class FavoritesPage {
    static async render(container) {
        container.innerHTML = `
            <div class="page-header">
                <div class="page-title">⭐ 收藏夹</div>
                <div>
                    <button class="btn btn-sm btn-primary" id="shuffleFavBtn">
                        ${AppState.favorites.shuffled ? '🔁 恢复顺序' : '🔀 混序学习'}
                    </button>
                </div>
            </div>
            <div id="favCategoryFilter"></div>
            <div class="sort-group">
                <span class="sort-label">排序：</span>
                <button class="sort-btn ${AppState.favorites.sort === 'default' ? 'active' : ''}" data-sort="default">默认</button>
                <button class="sort-btn ${AppState.favorites.sort === 'asc' ? 'active' : ''}" data-sort="asc">熟悉度 ↑</button>
                <button class="sort-btn ${AppState.favorites.sort === 'desc' ? 'active' : ''}" data-sort="desc">熟悉度 ↓</button>
            </div>
            <div id="favList"></div>
        `;

        // 分类筛选
        const filterContainer = container.querySelector('#favCategoryFilter');
        CategoryFilter.render(filterContainer, AppState.favorites.category, (category) => {
            AppState.favorites.category = category;
            this._renderFavList(container);
        });

        // 排序按钮
        container.querySelectorAll('.sort-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                container.querySelectorAll('.sort-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                AppState.favorites.sort = btn.dataset.sort;
                AppState.favorites.shuffled = false;
                const shuffleBtn = document.getElementById('shuffleFavBtn');
                if (shuffleBtn) shuffleBtn.textContent = '🔀 混序学习';
                this._renderFavList(container);
            });
        });

        // 混序按钮
        const shuffleBtn = document.getElementById('shuffleFavBtn');
        if (shuffleBtn) {
            shuffleBtn.addEventListener('click', () => {
                AppState.favorites.shuffled = !AppState.favorites.shuffled;
                shuffleBtn.textContent = AppState.favorites.shuffled ? '🔁 恢复顺序' : '🔀 混序学习';
                this._renderFavList(container);
            });
        }

        await this._renderFavList(container);
    }

    static async _renderFavList(container) {
        const listContainer = container.querySelector('#favList');
        if (!listContainer) return;
        
        listContainer.innerHTML = '<div style="text-align:center;padding:40px;color:var(--text-muted)">⏳ 加载中...</div>';

        try {
            let words = await WordDB.getFavoriteWords(AppState.favorites.category);

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
            if (AppState.favorites.sort === 'asc') {
                words.sort((a, b) => (a.familiarity ?? 0) - (b.familiarity ?? 0));
            } else if (AppState.favorites.sort === 'desc') {
                words.sort((a, b) => (b.familiarity ?? 0) - (a.familiarity ?? 0));
            }

            // 混序
            if (AppState.favorites.shuffled) {
                for (let i = words.length - 1; i > 0; i--) {
                    const j = Math.floor(Math.random() * (i + 1));
                    [words[i], words[j]] = [words[j], words[i]];
                }
            }

            // 构建列表
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
                    if (!word || !word.word) continue;
                    const wordRow = WordCard.render(word, {
                        onUpdate: () => this._renderFavList(container)
                    });
                    if (wordRow) list.appendChild(wordRow);
                } catch (e) {
                    console.warn('收藏夹渲染跳过脏数据:', e, word);
                }
            }
            
            wrapper.appendChild(list);

            if (list.children.length === 0) {
                listContainer.innerHTML = `
                    <div class="empty-state">
                        <div class="empty-icon">⭐</div>
                        <div class="empty-text">暂无有效收藏</div>
                        <p style="color:var(--text-muted);font-size:13px;margin-top:8px;">
                            收藏的单词数据异常，请尝试重新收藏
                        </p>
                    </div>
                `;
                return;
            }

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

window.FavoritesPage = FavoritesPage;

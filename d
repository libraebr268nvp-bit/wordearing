/**
 * WordWiz - 收藏夹页面
 * 
 * 功能：
 * - 显示收藏的单词（is_favorite = true）
 * - 按分类筛选
 * - 6 种排序模式：默认、熟悉度↑、熟悉度↓、A-Z、Z-A、随机混序
 * 
 * v6 重写：
 * - 统一的 6 种排序模式选择器
 * - 混序结果存储在 AppState.favorites.shuffledWords
 */

class FavoritesPage {
    static async render(container) {
        container.innerHTML = `
            <div class="page-header">
                <div class="page-title">⭐ 收藏夹</div>
                <div>
                    <button class="btn btn-sm btn-primary" id="shuffleFavBtn">
                        ${AppState.favorites.sortMode === 'shuffled' ? '🔁 恢复顺序' : '🔀 混序学习'}
                    </button>
                </div>
            </div>
            <div id="favCategoryFilter"></div>
            <div id="favSortSelector"></div>
            <div id="favList"></div>
        `;

        // 分类筛选
        const filterContainer = container.querySelector('#favCategoryFilter');
        CategoryFilter.render(filterContainer, AppState.favorites.category, (category) => {
            AppState.favorites.category = category;
            AppState.favorites.shuffledWords = null;
            this._renderFavList(container);
        });

        // 排序选择器
        this._renderSortSelector(container);

        // 混序按钮
        const shuffleBtn = document.getElementById('shuffleFavBtn');
        if (shuffleBtn) {
            shuffleBtn.addEventListener('click', async () => {
                if (AppState.favorites.sortMode === 'shuffled') {
                    AppState.favorites.sortMode = 'default';
                    AppState.favorites.shuffledWords = null;
                    shuffleBtn.textContent = '🔀 混序学习';
                    // 更新排序选择器高亮
                    const activeBtn = container.querySelector('#favSortSelector .sort-btn.active');
                    if (activeBtn) activeBtn.classList.remove('active');
                    const defaultBtn = container.querySelector('#favSortSelector .sort-btn[data-sort="default"]');
                    if (defaultBtn) defaultBtn.classList.add('active');
                    window.Toast.show('已恢复顺序');
                } else {
                    const words = await WordDB.getFavoriteWords(AppState.favorites.category);
                    AppState.favorites.sortMode = 'shuffled';
                    AppState.favorites.shuffledWords = WordSorter.shuffle(words || []).map(w => w.id);
                    shuffleBtn.textContent = '🔁 恢复顺序';
                    // 更新排序选择器高亮
                    const activeBtn = container.querySelector('#favSortSelector .sort-btn.active');
                    if (activeBtn) activeBtn.classList.remove('active');
                    const shuffledBtn = container.querySelector('#favSortSelector .sort-btn[data-sort="shuffled"]');
                    if (shuffledBtn) shuffledBtn.classList.add('active');
                    window.Toast.show('🔀 已混序');
                }
                this._renderFavList(container);
            });
        }

        await this._renderFavList(container);
    }

    /**
     * 渲染排序选择器
     */
    static _renderSortSelector(container) {
        const sortContainer = container.querySelector('#favSortSelector');
        sortContainer.innerHTML = WordSorter.renderSelector(AppState.favorites.sortMode || 'default');
        WordSorter.bindSelector(sortContainer, async (mode) => {
            AppState.favorites.sortMode = mode;
            AppState.favorites.shuffledWords = null;
            const shuffleBtn = document.getElementById('shuffleFavBtn');
            if (shuffleBtn) {
                shuffleBtn.textContent = mode === 'shuffled' ? '🔁 恢复顺序' : '🔀 混序学习';
            }
            if (mode === 'shuffled') {
                const words = await WordDB.getFavoriteWords(AppState.favorites.category);
                AppState.favorites.shuffledWords = WordSorter.shuffle(words || []).map(w => w.id);
            }
            this._renderFavList(container);
        });
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

            // 根据 sortMode 排序
            const mode = AppState.favorites.sortMode || 'default';
            let sorted;
            if (mode === 'shuffled' && AppState.favorites.shuffledWords) {
                sorted = WordSorter.sort(words, 'shuffled', AppState.favorites.shuffledWords);
            } else {
                sorted = WordSorter.sort(words, mode);
            }

            // 构建列表
            listContainer.innerHTML = '';
            const wrapper = document.createElement('div');
            wrapper.className = 'unit-card';
            
            const header = document.createElement('div');
            header.className = 'unit-header';
            header.innerHTML = `<div class="unit-title">⭐ 收藏的单词 <span class="unit-count">· ${sorted.length} 词</span></div>`;
            wrapper.appendChild(header);

            const list = document.createElement('div');
            list.className = 'word-list';
            
            for (const word of sorted) {
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

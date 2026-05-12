/**
 * WordWiz - 收藏夹页面
 * 
 * 功能：
 * - 显示收藏的单词（is_favorite = true）
 * - 按分类筛选
 * - 6 种排序模式：默认、熟悉度↑、熟悉度↓、A-Z、Z-A、随机混序
 * - 导出收藏单词为 JSON / CSV
 */

class FavoritesPage {
    static async render(container) {
        container.innerHTML = `
            <div class="page-header">
                <div class="page-title">⭐ 收藏夹</div>
                <div style="display:flex;gap:6px;flex-wrap:wrap;">
                    <button class="btn btn-sm btn-primary" id="shuffleFavBtn">
                        ${AppState.favorites.sortMode === 'shuffled' ? '🔁 恢复顺序' : '🔀 混序学习'}
                    </button>
                    <button class="btn btn-sm" id="exportFavBtn">📤 导出</button>
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
                    const activeBtn = container.querySelector('#favSortSelector .sort-btn.active');
                    if (activeBtn) activeBtn.classList.remove('active');
                    const shuffledBtn = container.querySelector('#favSortSelector .sort-btn[data-sort="shuffled"]');
                    if (shuffledBtn) shuffledBtn.classList.add('active');
                    window.Toast.show('🔀 已混序');
                }
                this._renderFavList(container);
            });
        }

        // 导出按钮
        this._setupExport(container);

        await this._renderFavList(container);
    }

    /**
     * 配置导出按钮：点击弹出菜单选择 JSON / CSV
     */
    static _setupExport(container) {
        const exportBtn = container.querySelector('#exportFavBtn');
        if (!exportBtn) return;

        exportBtn.addEventListener('click', async () => {
            const menu = document.createElement('div');
            menu.style.cssText = 'position:fixed;background:var(--bg-card);border:1px solid var(--border-color);border-radius:var(--radius-md);box-shadow:var(--shadow-card);z-index:100;overflow:hidden;';
            const rect = exportBtn.getBoundingClientRect();
            menu.style.top = (rect.bottom + 4) + 'px';
            menu.style.right = (window.innerWidth - rect.right) + 'px';
            menu.innerHTML = `
                <div style="padding:6px 0;">
                    <div class="export-menu-item" data-format="json" style="padding:8px 20px;cursor:pointer;font-size:13px;display:flex;align-items:center;gap:8px;white-space:nowrap;">📄 导出 JSON</div>
                    <div class="export-menu-item" data-format="csv" style="padding:8px 20px;cursor:pointer;font-size:13px;display:flex;align-items:center;gap:8px;white-space:nowrap;">📊 导出 CSV</div>
                </div>
            `;
            document.body.appendChild(menu);

            const closeMenu = (e) => {
                if (!menu.contains(e.target) && e.target !== exportBtn) {
                    menu.remove();
                    document.removeEventListener('click', closeMenu);
                }
            };
            setTimeout(() => document.addEventListener('click', closeMenu), 0);

            menu.querySelectorAll('.export-menu-item').forEach(item => {
                item.addEventListener('mouseenter', () => item.style.background = 'var(--bg-hover)');
                item.addEventListener('mouseleave', () => item.style.background = '');
                item.addEventListener('click', async () => {
                    menu.remove();
                    const format = item.dataset.format;
                    try {
                        let content, filename;
                        if (format === 'json') {
                            content = await WordParser.exportFavoritesToJSON(AppState.favorites.category);
                            filename = 'wordwiz_favorites.json';
                        } else {
                            content = await WordParser.exportFavoritesToCSV(AppState.favorites.category);
                            filename = 'wordwiz_favorites.csv';
                        }
                        const blob = new Blob([content], { type: format === 'json' ? 'application/json' : 'text/csv;charset=utf-8' });
                        const url = URL.createObjectURL(blob);
                        const a = document.createElement('a');
                        a.href = url; a.download = filename;
                        document.body.appendChild(a); a.click();
                        document.body.removeChild(a);
                        URL.revokeObjectURL(url);
                        window.Toast.show('📤 已导出 ' + filename);
                    } catch (e) {
                        window.Toast.show('❌ 导出失败: ' + e.message);
                    }
                });
            });
        });
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

            const mode = AppState.favorites.sortMode || 'default';
            let sorted;
            if (mode === 'shuffled' && AppState.favorites.shuffledWords) {
                sorted = WordSorter.sort(words, 'shuffled', AppState.favorites.shuffledWords);
            } else {
                sorted = WordSorter.sort(words, mode);
            }

            listContainer.innerHTML = '';
            const wrapper = document.createElement('div');
            wrapper.className = 'unit-card';
            
            const header = document.createElement('div');
            header.className = 'unit-header';
            header.innerHTML = '<div class="unit-title">⭐ 收藏的单词 <span class="unit-count">· ' + sorted.length + ' 词</span></div>';
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

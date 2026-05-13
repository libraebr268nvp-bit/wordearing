/**
 * WordWiz - 主学习页面
 * 
 * 功能：
 * - 词书筛选
 * - 分类筛选
 * - 搜索单词
 * - 6 种排序模式：默认顺序、熟悉度从高到低、熟悉度从低到高、
 *   字母 A-Z、字母 Z-A、随机混序
 * 
 * v6 重写：
 * - 新增排序选择器
 * - 非默认排序时打平成单词列表（不按单元分组）
 * - 混序结果存储在 AppState.home.shuffledWords
 * - onUpdate 按当前排序模式重新排列
 */

class HomePage {
    static async render(container) {
        container.innerHTML = `
            <div class="page-header">
                <div class="page-title">📚 学习</div>
                <div style="display:flex;gap:6px;flex-wrap:wrap;">
                    <button id="globalShuffleBtn" class="btn btn-sm btn-primary">
                        ${HomeShuffle.isShuffled() ? '🔁 恢复' : '🔀 全局混序'}
                    </button>
                </div>
            </div>
            <!-- 搜索框 -->
            <div class="search-bar" style="padding:0 16px 12px;">
                <div style="position:relative;">
                    <input type="text" id="searchInput" placeholder="🔍 搜索单词..." 
                           style="width:100%;padding:10px 14px;border:1px solid var(--border-color);border-radius:var(--radius-md);
                                  background:var(--bg-secondary);color:var(--text-primary);font-size:14px;outline:none;
                                  transition:var(--transition);box-sizing:border-box;">
                    <div id="searchResults" style="display:none;position:absolute;top:100%;left:0;right:0;z-index:50;
                         background:var(--bg-card);border:1px solid var(--border-color);border-radius:var(--radius-md);
                         max-height:300px;overflow-y:auto;box-shadow:var(--shadow-card);margin-top:4px;"></div>
                </div>
            </div>
            <div id="bookFilter"></div>
            <div id="categoryFilter"></div>
            <div id="sortSelector"></div>
            <div id="wordUnits"></div>
        `;

        // 搜索功能
        this._setupSearch(container);

        // 词书筛选
        await this._renderBookFilter(container);

        // 今日复习提示条
        await this._renderDueBanner(container);

        // 分类筛选
        await CategoryFilter.render(container.querySelector('#categoryFilter'), AppState.home.category, async (category) => {
            AppState.home.category = category;
            this._resetShuffle();
            await this._renderUnits(container);
        });

        // 排序选择器
        this._renderSortSelector(container);

        // 全局混序按钮
        const shuffleBtn = container.querySelector('#globalShuffleBtn');
        shuffleBtn.addEventListener('click', async () => {
            if (HomeShuffle.isShuffled()) {
                this._resetShuffle();
                shuffleBtn.textContent = '🔀 全局混序';
                window.Toast.show('已恢复原始顺序');
            } else {
                const words = await this._getAllWords();
                HomeShuffle.setMode('shuffled', words);
                shuffleBtn.textContent = '🔁 恢复';
                const activeBtn = container.querySelector('#sortSelector .sort-btn.active');
                if (activeBtn) activeBtn.classList.remove('active');
                const shuffledBtn = container.querySelector('#sortSelector .sort-btn[data-sort="shuffled"]');
                if (shuffledBtn) shuffledBtn.classList.add('active');
                window.Toast.show('🔀 已全局混序');
            }
            await this._renderUnits(container);
        });

        await this._renderUnits(container);
    }

    static async _getAllWords() {
        const activeBookIds = await WordDB.getActiveBookIds();
        const category = AppState.home.category;
        return await WordDB.getWordsByCategory(category, activeBookIds);
    }

    static _renderSortSelector(container) {
        const sortContainer = container.querySelector('#sortSelector');
        sortContainer.innerHTML = WordSorter.renderSelector(AppState.home.sortMode || 'default');
        WordSorter.bindSelector(sortContainer, async (mode) => {
            AppState.home.sortMode = mode;
            AppState.home.shuffledWords = null;
            const shuffleBtn = document.getElementById('globalShuffleBtn');
            if (shuffleBtn) {
                shuffleBtn.textContent = mode === 'shuffled' ? '🔁 恢复' : '🔀 全局混序';
            }
            if (mode === 'shuffled') {
                const words = await this._getAllWords();
                AppState.home.shuffledWords = WordSorter.shuffle(words).map(w => w.id);
            }
            await this._renderUnits(container);
        });
    }

    static _resetShuffle() {
        HomeShuffle.reset();
        const shuffleBtn = document.getElementById('globalShuffleBtn');
        if (shuffleBtn) shuffleBtn.textContent = '🔀 全局混序';
    }

    static _setupSearch(container) {
        const input = container.querySelector('#searchInput');
        const resultBox = container.querySelector('#searchResults');
        if (!input || !resultBox) return;

        let timer = null;
        input.addEventListener('input', () => {
            clearTimeout(timer);
            const val = input.value.trim();
            if (!val) {
                resultBox.style.display = 'none';
                return;
            }
            timer = setTimeout(async () => {
                const results = await WordDB.searchWords(val);
                if (results.length === 0) {
                    resultBox.innerHTML = '<div style="padding:12px;color:var(--text-muted);font-size:13px;text-align:center;">未找到匹配单词</div>';
                    resultBox.style.display = 'block';
                    return;
                }
                resultBox.innerHTML = results.map(w => `
                    <div class="search-result-item" data-id="${w.id}" data-unit="${w.unit}" 
                         style="padding:8px 14px;cursor:pointer;display:flex;align-items:center;gap:8px;
                                border-bottom:1px solid rgba(58,58,92,0.3);transition:var(--transition);">
                        <span style="font-weight:600;font-size:14px;color:var(--text-primary);min-width:80px;">${w.word}</span>
                        <span style="flex:1;font-size:13px;color:var(--text-muted);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${w.definition}</span>
                        <span style="font-size:11px;color:var(--accent-purple);background:rgba(167,139,250,0.1);padding:2px 8px;border-radius:4px;">Unit ${w.unit}</span>
                    </div>
                `).join('') + '</div>';
                resultBox.style.display = 'block';

                resultBox.querySelectorAll('.search-result-item').forEach(el => {
                    el.addEventListener('click', (e) => {
                        e.stopPropagation();
                        const unit = parseInt(el.dataset.unit);
                        const wordId = parseInt(el.dataset.id);
                        resultBox.style.display = 'none';
                        input.value = '';
                        setTimeout(() => {
                            const mode = AppState.home.sortMode || 'default';
                            const wordsContainer = container.querySelector('#wordUnits');
                            let wordEl, scrollTarget;

                            // 统一查找：按 data-id 精确查找单词元素
                            wordEl = wordsContainer?.querySelector(`.word-item[data-id="${wordId}"]`);

                            if (wordEl) {
                                // 高亮该单词
                                wordEl.style.background = 'rgba(108,140,255,0.15)';
                                setTimeout(() => { wordEl.style.background = ''; }, 2000);
                                // 如果折叠了，展开父级 word-list
                                const wordList = wordEl.closest('.word-list');
                                if (wordList) {
                                    wordList.style.removeProperty('display');
                                }
                                wordEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
                            } else if (mode === 'default') {
                                // 默认模式但没找到单词：定位到对应的 unit-card 区域
                                const targetCard = container.querySelector(`.unit-card[data-unit="${unit}"]`);
                                if (targetCard) {
                                    const wordList = targetCard.querySelector('.word-list');
                                    if (wordList) wordList.style.removeProperty('display');
                                    targetCard.scrollIntoView({ behavior: 'smooth', block: 'center' });
                                    window.Toast.show('🔍 已定位到该单词区域');
                                } else {
                                    window.Toast.show('🔍 该词不在当前分类/词书筛选中，请调整筛选条件');
                                }
                            } else {
                                // 非默认排序且精确找不到
                                // 可能是单词已被删除或不在当前筛选范围
                                if (wordsContainer) {
                                    const anyWord = wordsContainer.querySelector('.word-item');
                                    if (anyWord) {
                                        anyWord.closest('.unit-card')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
                                        window.Toast.show('🔍 该词不在当前分类/词书筛选中，请调整筛选条件');
                                    } else {
                                        window.Toast.show('🔍 未找到该单词');
                                    }
                                } else {
                                    window.Toast.show('🔍 未找到该单词');
                                }
                            }
                        }, 100);
                    });
                });
            }, 300);
        });

        document.addEventListener('click', (e) => {
            if (!e.target.closest('.search-bar')) {
                resultBox.style.display = 'none';
            }
        });
    }

    static async _renderBookFilter(container) {
        const bookContainer = container.querySelector('#bookFilter');
        const books = await WordDB.getBooks();
        const activeIds = await WordDB.getActiveBookIds();

        if (books.length <= 1) {
            bookContainer.innerHTML = '';
            return;
        }

        bookContainer.innerHTML = `
            <div class="filter-group" style="margin-bottom:4px;">
                ${books.map(b => `
                    <button class="book-filter-btn ${activeIds.includes(b.id) ? 'active' : ''}" 
                            data-book-id="${b.id}" style="padding:4px 12px;border:1px solid var(--border-color);
                            border-radius:16px;background:${activeIds.includes(b.id) ? 'rgba(108,140,255,0.15)' : 'transparent'};
                            color:${activeIds.includes(b.id) ? 'var(--accent-blue)' : 'var(--text-secondary)'};
                            font-size:12px;cursor:pointer;transition:var(--transition);">
                        ${b.name}
                    </button>
                `).join('')}
            </div>
        `;

        bookContainer.querySelectorAll('.book-filter-btn').forEach(btn => {
            btn.addEventListener('click', async () => {
                const bid = parseInt(btn.dataset.bookId);
                const idx = activeIds.indexOf(bid);
                if (idx >= 0) activeIds.splice(idx, 1);
                else activeIds.push(bid);
                if (activeIds.length === 0) {
                    window.Toast.show('至少保留一个词书');
                    return;
                }
                await WordDB.saveActiveBookIds(activeIds);
                bookContainer.querySelectorAll('.book-filter-btn').forEach(b => {
                    const id = parseInt(b.dataset.bookId);
                    const isActive = activeIds.includes(id);
                    b.style.background = isActive ? 'rgba(108,140,255,0.15)' : 'transparent';
                    b.style.color = isActive ? 'var(--accent-blue)' : 'var(--text-secondary)';
                });
                this._resetShuffle();
                await this._renderUnits(container);
            });
        });
    }

    static async _renderDueBanner(container) {
        const bookFilterEl = container.querySelector('#bookFilter');
        if (!bookFilterEl) return;

        const activeBookIds = await WordDB.getActiveBookIds();
        const dueWords = await WordDB.getDueWords(activeBookIds);
        if (dueWords.length === 0) return;

        // 移除旧的提示条（如果有）
        const oldBanner = container.querySelector('#dueReviewBanner');
        if (oldBanner) oldBanner.remove();

        const banner = document.createElement('div');
        banner.id = 'dueReviewBanner';
        banner.style.cssText = 'background:#0d2818;border-left:3px solid #00ff88;padding:10px 16px;border-radius:6px;margin:0 16px 12px;display:flex;align-items:center;justify-content:space-between;';
        banner.innerHTML = `
            <span style="color:#aaa;font-size:13px;">📚 今日有 <strong style="color:#00ff88;">${dueWords.length}</strong> 个单词待复习</span>
            <button class="btn btn-sm" style="background:rgba(0,255,136,0.12);color:#00ff88;border:1px solid rgba(0,255,136,0.3);padding:5px 14px;border-radius:6px;cursor:pointer;font-size:13px;">开始复习 →</button>
        `;

        banner.querySelector('button').addEventListener('click', () => {
            if (window.AppState) {
                AppState.reviewMode = true;
            }
            window.location.hash = '#/challenge';
        });

        bookFilterEl.parentNode.insertBefore(banner, bookFilterEl.nextSibling);
    }

    static async _renderUnits(container) {
        const unitsContainer = container.querySelector('#wordUnits');
        if (!unitsContainer) return;

        unitsContainer.innerHTML = '<div style="text-align:center;padding:40px;color:var(--text-muted)">⏳ 加载中...</div>';

        const activeBookIds = await WordDB.getActiveBookIds();
        const category = AppState.home.category;
        const words = await WordDB.getWordsByCategory(category, activeBookIds);

        if (words.length === 0) {
            unitsContainer.innerHTML = `
                <div class="empty-state">
                    <div class="empty-icon">📭</div>
                    <div class="empty-text">暂无单词</div>
                    <p style="color:var(--text-muted);font-size:13px;margin-top:8px;">
                        去「设置」页导入词库开始学习吧！
                    </p>
                </div>
            `;
            return;
        }

        const mode = AppState.home.sortMode || 'default';
        if (mode === 'default') {
            this._renderByUnit(unitsContainer, words);
        } else {
            this._renderFlatList(unitsContainer, words, mode);
        }
    }

    static _renderByUnit(container, words) {
        const unitMap = {};
        words.forEach(w => {
            if (!unitMap[w.unit]) unitMap[w.unit] = [];
            unitMap[w.unit].push(w);
        });

        const units = Object.keys(unitMap).sort((a, b) => parseInt(a) - parseInt(b));
        container.innerHTML = '';

        units.forEach(unit => {
            let unitWords = unitMap[unit] || [];
            const card = UnitCard.render(parseInt(unit), unitWords, {
                onUpdate: async () => {
                    const mode = AppState.home.sortMode || 'default';
                    const allWords = await this._getAllWords();
                    if (mode === 'default') this._renderByUnit(container, allWords);
                    else this._renderFlatList(container, allWords, mode);
                },
                hideShuffle: false
            });
            container.appendChild(card);
        });
    }

    static _renderFlatList(container, words, mode) {
        let sorted;
        if (mode === 'shuffled' && AppState.home.shuffledWords) {
            sorted = WordSorter.sort(words, 'shuffled', AppState.home.shuffledWords);
        } else {
            sorted = WordSorter.sort(words, mode);
        }

        container.innerHTML = '';
        const wrapper = document.createElement('div');
        wrapper.className = 'unit-card';

        const sortLabels = {
            'fam-high': '熟悉度从高到低',
            'fam-low': '熟悉度从低到高',
            'alpha-asc': '字母 A→Z',
            'alpha-desc': '字母 Z→A',
            'shuffled': '随机混序'
        };

        const header = document.createElement('div');
        header.className = 'unit-header';
        header.innerHTML = `<div class="unit-title">📖 ${sortLabels[mode] || '排序'} <span class="unit-count">· ${sorted.length} 词</span></div>`;
        wrapper.appendChild(header);

        const list = document.createElement('div');
        list.className = 'word-list';
        sorted.forEach(word => {
            const wordRow = WordCard.render(word, {
                onUpdate: async () => {
                    const mode = AppState.home.sortMode || 'default';
                    const allWords = await this._getAllWords();
                    if (mode === 'default') this._renderByUnit(container, allWords);
                    else this._renderFlatList(container, allWords, mode);
                }
            });
            if (wordRow) list.appendChild(wordRow);
        });
        wrapper.appendChild(list);
        container.appendChild(wrapper);
    }
}

window.HomePage = HomePage;

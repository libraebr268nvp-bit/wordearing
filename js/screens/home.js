/**
 * WordWiz - 主学习页面
 * 
 * v3 新增：
 * - 顶部搜索框（模糊搜索 + 定位单元）
 * - 按词书过滤（读取 active_books 设置）
 */

class HomePage {
    static async render(container) {
        container.innerHTML = `
            <div class="page-header">
                <div class="page-title">📚 学习</div>
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
            <div id="wordUnits"></div>
        `;

        // 搜索功能
        this._setupSearch(container);

        // 词书筛选
        const bookContainer = container.querySelector('#bookFilter');
        await this._renderBookFilter(bookContainer, container);

        // 分类筛选
        const filterContainer = container.querySelector('#categoryFilter');
        CategoryFilter.render(filterContainer, '全部', async (category) => {
            await this._renderUnits(container, category);
        });

        await this._renderUnits(container, '全部');
    }

    /**
     * 设置搜索功能（防抖 + 模糊匹配 + 定位）
     */
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

                // 点击结果 → 定位到对应单元
                resultBox.querySelectorAll('.search-result-item').forEach(el => {
                    el.addEventListener('click', () => {
                        const unit = parseInt(el.dataset.unit);
                        const wordId = parseInt(el.dataset.id);
                        resultBox.style.display = 'none';
                        input.value = '';
                        // 滚动到对应单元
                        setTimeout(() => {
                            const targetCard = container.querySelector(`.unit-card[data-unit="${unit}"]`);
                            if (targetCard) {
                                // 确保展开
                                const wordList = targetCard.querySelector('.word-list');
                                if (wordList) wordList.style.display = '';
                                targetCard.scrollIntoView({ behavior: 'smooth', block: 'center' });
                                // 高亮单词
                                const wordEl = targetCard.querySelector(`.word-item[data-id="${wordId}"]`);
                                if (wordEl) {
                                    wordEl.style.background = 'rgba(108,140,255,0.15)';
                                    setTimeout(() => { wordEl.style.background = ''; }, 2000);
                                }
                            }
                        }, 100);
                    });
                });
            }, 300); // 防抖 300ms
        });

        // 点击外部关闭搜索框
        document.addEventListener('click', (e) => {
            if (!e.target.closest('.search-bar')) {
                resultBox.style.display = 'none';
            }
        });
    }

    /**
     * 渲染词书筛选器
     */
    static async _renderBookFilter(container, pageContainer) {
        const books = await WordDB.getBooks();
        const activeIds = await WordDB.getActiveBookIds();

        if (books.length <= 1) {
            container.innerHTML = '';
            return;
        }

        container.innerHTML = `
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

        container.querySelectorAll('.book-filter-btn').forEach(btn => {
            btn.addEventListener('click', async () => {
                const bid = parseInt(btn.dataset.bookId);
                const idx = activeIds.indexOf(bid);
                if (idx >= 0) {
                    activeIds.splice(idx, 1);
                } else {
                    activeIds.push(bid);
                }
                // 至少保留一个词书
                if (activeIds.length === 0) {
                    window.Toast.show('至少保留一个词书');
                    return;
                }
                await WordDB.saveActiveBookIds(activeIds);
                // 刷新按钮状态
                container.querySelectorAll('.book-filter-btn').forEach(b => {
                    const id = parseInt(b.dataset.bookId);
                    const isActive = activeIds.includes(id);
                    b.style.background = isActive ? 'rgba(108,140,255,0.15)' : 'transparent';
                    b.style.color = isActive ? 'var(--accent-blue)' : 'var(--text-secondary)';
                });
                // 刷新单词列表
                await this._renderUnits(pageContainer, pageContainer.querySelector('.filter-btn.active')?.textContent || '全部');
            });
        });
    }

    static async _renderUnits(container, category) {
        const unitsContainer = container.querySelector('#wordUnits');
        if (!unitsContainer) return;

        unitsContainer.innerHTML = '<div style="text-align:center;padding:40px;color:var(--text-muted)">⏳ 加载中...</div>';

        // 获取已激活词书的单词
        const activeBookIds = await WordDB.getActiveBookIds();
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

        // 按单元分组
        const unitMap = {};
        words.forEach(w => {
            if (!unitMap[w.unit]) unitMap[w.unit] = [];
            unitMap[w.unit].push(w);
        });

        const units = Object.keys(unitMap).sort((a, b) => parseInt(a) - parseInt(b));

        unitsContainer.innerHTML = '';
        // 保存单元映射到容器（供搜索定位使用）
        unitsContainer._unitMap = unitMap;

        units.forEach(unit => {
            const card = UnitCard.render(parseInt(unit), unitMap[unit], {
                onUpdate: async () => {
                    // 重新渲染当前页（收藏、熟悉度、删除后刷新统计和收藏夹）
                    await HomePage._renderUnits(container,
                        container.querySelector('.filter-btn.active')?.textContent || '全部');
                }
            });
            unitsContainer.appendChild(card);
        });
    }
}

window.HomePage = HomePage;

/**
 * WordWiz - 错题集页面
 * 
 * 自动收集挑战中答错的单词，支持按分类筛选、清除错题。
 * 可在挑战模式设置中选择「错题集」范围进行针对性复习。
 * 
 * 路由: #/wrong-words
 */

class WrongWordsPage {
    static async render(container) {
        container.innerHTML = `
            <div class="page-header">
                <div class="page-title">📝 错题集</div>
                <div style="display:flex;gap:6px;flex-wrap:wrap;">
                    <button class="btn btn-sm" id="exportWrongWordsBtn">📤 导出</button>
                    <button class="btn btn-danger btn-sm" id="clearWrongWordsBtn">🗑️ 清空错题</button>
                </div>
            </div>
            <div id="wrongWordsContent"></div>
        `;
        const content = container.querySelector('#wrongWordsContent');
        await this._renderList(content);

        // 导出按钮
        this._setupExport(container);

        // 清空按钮
        document.getElementById('clearWrongWordsBtn').addEventListener('click', async () => {
            if (!confirm('确定要清空所有错题记录吗？')) return;
            await WordDB.saveSetting('challenge_wrong_words', []);
            window.Toast.show('✅ 错题集已清空');
            await this._renderList(content);
        });
    }

    /**
     * 配置导出按钮
     */
    static _setupExport(container) {
        const exportBtn = container.querySelector('#exportWrongWordsBtn');
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
                            content = await WordParser.exportWrongWordsToJSON();
                            filename = 'wordwiz_wrong_words.json';
                        } else {
                            content = await WordParser.exportWrongWordsToCSV();
                            filename = 'wordwiz_wrong_words.csv';
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

    static async _renderList(container) {
        const wrongWords = await WordDB.getSetting('challenge_wrong_words', []);

        if (wrongWords.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <div class="empty-icon">🎉</div>
                    <div class="empty-text">还没有错题记录</div>
                    <p style="color:var(--text-muted);font-size:13px;margin-top:8px;">
                        完成挑战答错的单词会自动收集到这里
                    </p>
                    <button class="btn btn-primary" style="margin-top:16px;" onclick="window.location.hash='#/challenge'">
                        🚀 去挑战
                    </button>
                </div>
            `;
            return;
        }

        // 统计
        const totalCount = wrongWords.length;
        const categories = [...new Set(wrongWords.map(w => w.category).filter(Boolean))].sort();

        container.innerHTML = `
            <div style="padding:0 16px 16px;">
                <div style="display:flex;align-items:center;gap:12px;flex-wrap:wrap;margin-bottom:16px;">
                    <span style="font-size:14px;color:var(--text-secondary);">
                        共 <strong style="color:var(--accent-red);">${totalCount}</strong> 个错题
                    </span>
                    <span style="font-size:12px;color:var(--text-muted);">
                        （挑战答错的单词自动收集，最多保留 200 条）
                    </span>
                </div>
                ${categories.length > 0 ? `
                <div class="filter-group" id="wrongWordsFilter">
                    <button class="filter-btn active" data-category="全部">全部</button>
                    ${categories.map(c => `
                        <button class="filter-btn" data-category="${c}">${c}</button>
                    `).join('')}
                </div>
                ` : ''}
                <div id="wrongWordsList"></div>
            </div>
        `;

        // 绑定分类筛选
        const filterEl = container.querySelector('#wrongWordsFilter');
        if (filterEl) {
            filterEl.addEventListener('click', (e) => {
                const btn = e.target.closest('.filter-btn');
                if (!btn) return;
                filterEl.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                this._renderWords(container, wrongWords, btn.dataset.category);
            });
        }

        // 初始渲染
        this._renderWords(container, wrongWords, '全部');
    }

    static _renderWords(container, wrongWords, activeCategory) {
        const listEl = container.querySelector('#wrongWordsList');
        if (!listEl) return;

        const filtered = activeCategory === '全部'
            ? wrongWords
            : wrongWords.filter(w => w.category === activeCategory);

        if (filtered.length === 0) {
            listEl.innerHTML = `
                <div class="empty-state">
                    <div class="empty-text" style="font-size:14px;">该分类下没有错题</div>
                </div>
            `;
            return;
        }

        listEl.innerHTML = filtered.map(w => `
            <div class="wrong-word-item" style="
                display:flex;align-items:center;padding:12px 16px;
                background:var(--bg-card);border:1px solid var(--border-color);
                border-radius:var(--radius-md);margin-bottom:8px;
                border-left:3px solid var(--accent-red);
            ">
                <div style="flex:1;min-width:0;">
                    <div style="display:flex;align-items:center;gap:8px;margin-bottom:4px;">
                        <span style="font-weight:600;font-size:15px;color:var(--text-primary);">${w.word}</span>
                        <span style="font-size:11px;color:var(--text-muted);background:var(--bg-secondary);
                            padding:2px 8px;border-radius:10px;">${w.category || ''}</span>
                        ${w.book_source ? `<span style="font-size:11px;color:var(--text-muted);">${w.book_source}</span>` : ''}
                    </div>
                    <div style="font-size:14px;color:var(--accent-green);">${w.definition || '(无释义)'}</div>
                    <div style="font-size:11px;color:var(--text-muted);margin-top:4px;">
                        答错于 ${new Date(w.date).toLocaleDateString('zh-CN', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                    </div>
                </div>
                <button class="action-btn delete" data-wordid="${w.wordId}" title="从错题集移除" 
                        style="flex-shrink:0;font-size:14px;">
                    ✕
                </button>
            </div>
        `).join('');

        // 单项删除
        listEl.querySelectorAll('.action-btn.delete').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                e.stopPropagation();
                const wordId = parseInt(btn.dataset.wordid);
                let words = await WordDB.getSetting('challenge_wrong_words', []);
                words = words.filter(w => w.wordId !== wordId);
                await WordDB.saveSetting('challenge_wrong_words', words);
                window.Toast.show('已移除');
                // 重新渲染
                const activeBtn = container.querySelector('#wrongWordsFilter .filter-btn.active');
                this._renderWords(container, words, activeBtn ? activeBtn.dataset.category : '全部');
                // 更新总数
                const totalSpan = container.querySelector('strong');
                if (totalSpan) totalSpan.textContent = words.length;
            });
        });
    }
}

window.WrongWordsPage = WrongWordsPage;

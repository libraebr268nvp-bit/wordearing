/**
 * WordWiz - 设置页面
 * 
 * v3 新增：
 * - 词书管理系统（新增/删除/勾选）
 * - 导入时自动创建词书
 */

class SettingsPage {
    static async render(container) {
        const reminderEnabled = await WordDB.getSetting('reminder_enabled', false);
        const reminderTime = await WordDB.getSetting('reminder_time', '20:00');

        container.innerHTML = `
            <div class="page-header">
                <div class="page-title">⚙️ 设置</div>
            </div>

            <!-- 统计仪表盘 -->
            <div id="statsDashboard"></div>

            <!-- 词书管理 -->
            <div class="settings-section" id="bookManagementSection">
                <h3>📚 词书管理</h3>
                <div id="bookList"></div>
                <div style="margin-top:12px;display:flex;gap:8px;">
                    <input type="text" id="newBookName" placeholder="输入新词书名称..." 
                           style="flex:1;padding:8px 12px;border:1px solid var(--border-color);border-radius:var(--radius-sm);
                                  background:var(--bg-secondary);color:var(--text-primary);font-size:13px;outline:none;">
                    <button class="btn btn-primary btn-sm" id="addBookBtn">➕ 新增词书</button>
                </div>
            </div>

            <!-- 数据管理 -->
            <div class="settings-section">
                <h3>📂 数据管理</h3>
                
                <div class="setting-row">
                    <div>
                        <div class="setting-label">导入词库</div>
                        <div class="setting-desc">支持 CSV（UTF-8）或 JSON 格式</div>
                    </div>
                    <input type="file" id="importFileInput" accept=".csv,.json" style="display:none" />
                    <div style="display:flex;gap:6px;">
                        <button class="btn btn-primary btn-sm" id="importBtn">📥 选择文件导入</button>
                        <button class="btn btn-sm" id="downloadTemplateBtn">📄 下载模板 CSV</button>
                    </div>
                </div>
                <div id="importResult"></div>

                <div class="setting-row">
                    <div>
                        <div class="setting-label">导出数据</div>
                        <div class="setting-desc">导出全部单词（含熟悉度、收藏状态）</div>
                    </div>
                    <div style="display:flex;gap:6px;">
                        <button class="btn btn-sm" id="exportJSONBtn">📤 导出 JSON</button>
                        <button class="btn btn-sm" id="exportCSVBtn">📤 导出 CSV</button>
                    </div>
                </div>

                <div class="setting-row">
                    <div>
                        <div class="setting-label">清空回收站</div>
                        <div class="setting-desc">永久删除回收站所有单词</div>
                    </div>
                    <button class="btn btn-danger btn-sm" id="clearTrashBtn">🗑️ 清空</button>
                </div>
            </div>

            <!-- 学习进度备份与恢复（跨设备同步） -->
            <div class="settings-section">
                <h3>💾 学习进度备份</h3>
                <div class="setting-desc" style="margin-top:-8px;margin-bottom:12px;font-size:12px;">
                    用导出功能备份你的学习进度，到另一台设备导入即可同步
                </div>
                <div class="setting-row">
                    <div>
                        <div class="setting-label">📤 导出全部进度</div>
                        <div class="setting-desc">包含单词数据、熟悉度、收藏、成就、挑战记录、统计</div>
                    </div>
                    <button class="btn btn-primary btn-sm" id="exportProgressBtn">📥 导出备份</button>
                </div>
                <div class="setting-row">
                    <div>
                        <div class="setting-label">📥 导入进度备份</div>
                        <div class="setting-desc">选择之前导出的 .json 备份文件恢复数据</div>
                    </div>
                    <input type="file" id="importProgressInput" accept=".json" style="display:none" />
                    <button class="btn btn-sm" id="importProgressBtn">📂 选择文件导入</button>
                </div>
                <div id="progressResult" style="font-size:13px;margin-top:8px;"></div>
            </div>

            <!-- 在线词库下载 -->
            <div class="settings-section" id="onlineLibSection">
                <h3>📚 在线词库下载</h3>
                <div class="setting-desc" style="margin-top:-8px;margin-bottom:12px;font-size:12px;">
                    一键导入更多词库，扩充你的学习内容
                </div>
                <div id="onlineLibList" style="display:grid;grid-template-columns:repeat(auto-fill,minmax(200px,1fr));gap:8px;margin-bottom:12px;">
                    <div class="lib-card" data-url="assets/words_cet4.json" data-name="四级词汇" style="background:var(--bg-secondary);border-radius:var(--radius-sm);padding:12px;cursor:pointer;border:1px solid var(--border-color);transition:var(--transition);">
                        <div style="font-weight:600;font-size:14px;color:var(--text-primary);">📗 CET-4</div>
                        <div style="font-size:11px;color:var(--text-muted);margin-top:4px;">大学英语四级 · ~4600词</div>
                    </div>
                    <div class="lib-card" data-url="assets/words_cet6.json" data-name="六级词汇" style="background:var(--bg-secondary);border-radius:var(--radius-sm);padding:12px;cursor:pointer;border:1px solid var(--border-color);transition:var(--transition);">
                        <div style="font-weight:600;font-size:14px;color:var(--text-primary);">📘 CET-6</div>
                        <div style="font-size:11px;color:var(--text-muted);margin-top:4px;">大学英语六级 · ~4350词</div>
                    </div>
                    <div class="lib-card" data-url="assets/words_ky.json" data-name="考研词汇" style="background:var(--bg-secondary);border-radius:var(--radius-sm);padding:12px;cursor:pointer;border:1px solid var(--border-color);transition:var(--transition);">
                        <div style="font-weight:600;font-size:14px;color:var(--text-primary);">📙 考研</div>
                        <div style="font-size:11px;color:var(--text-muted);margin-top:4px;">全国硕士研究生 · ~4800词</div>
                    </div>
                    <div class="lib-card" data-url="assets/words_toefl.json" data-name="托福词汇" style="background:var(--bg-secondary);border-radius:var(--radius-sm);padding:12px;cursor:pointer;border:1px solid var(--border-color);transition:var(--transition);">
                        <div style="font-weight:600;font-size:14px;color:var(--text-primary);">📕 TOEFL</div>
                        <div style="font-size:11px;color:var(--text-muted);margin-top:4px;">托福考试 · ~7000词</div>
                    </div>
                    <div class="lib-card" data-url="assets/words_ielts.json" data-name="雅思词汇" style="background:var(--bg-secondary);border-radius:var(--radius-sm);padding:12px;cursor:pointer;border:1px solid var(--border-color);transition:var(--transition);">
                        <div style="font-weight:600;font-size:14px;color:var(--text-primary);">📗 IELTS</div>
                        <div style="font-size:11px;color:var(--text-muted);margin-top:4px;">雅思考试 · ~5040词</div>
                    </div>
                    <div class="lib-card" data-url="assets/words_gre.json" data-name="GRE词汇" style="background:var(--bg-secondary);border-radius:var(--radius-sm);padding:12px;cursor:pointer;border:1px solid var(--border-color);transition:var(--transition);">
                        <div style="font-weight:600;font-size:14px;color:var(--text-primary);">📘 GRE</div>
                        <div style="font-size:11px;color:var(--text-muted);margin-top:4px;">美国研究生入学 · ~7500词</div>
                    </div>
                    <div class="lib-card" data-url="assets/words_gk.json" data-name="高考词汇" style="background:var(--bg-secondary);border-radius:var(--radius-sm);padding:12px;cursor:pointer;border:1px solid var(--border-color);transition:var(--transition);">
                        <div style="font-weight:600;font-size:14px;color:var(--text-primary);">📙 高考</div>
                        <div style="font-size:11px;color:var(--text-muted);margin-top:4px;">普通高考 · ~3677词</div>
                    </div>
                    <div class="lib-card" data-url="assets/words_zk.json" data-name="中考词汇" style="background:var(--bg-secondary);border-radius:var(--radius-sm);padding:12px;cursor:pointer;border:1px solid var(--border-color);transition:var(--transition);">
                        <div style="font-weight:600;font-size:14px;color:var(--text-primary);">📗 中考</div>
                        <div style="font-size:11px;color:var(--text-muted);margin-top:4px;">中考词汇 · ~1600词</div>
                    </div>
                </div>
                <div id="onlineLibResult" style="font-size:13px;color:var(--text-muted);"></div>
                <div style="font-size:11px;color:var(--text-muted);margin-top:8px;border-top:1px solid var(--border-color);padding-top:8px;">
                    💡 这些词库已内置在项目中，点击即可加载到当前词书管理<br>
                    另外也可从 <a href="https://github.com/skywind3000/ECDICT" target="_blank" style="color:var(--accent-blue);">ECDICT 开源词库</a> 下载更多词库（MIT 协议）
                </div>
            </div>

            <!-- 局域网访问 -->
            <div class="settings-section">
                <h3>🌐 局域网访问</h3>
                <div class="setting-row">
                    <div>
                        <div class="setting-label">手机 / 其他设备访问</div>
                        <div class="setting-desc">同一 WiFi 下，在手机浏览器输入以下地址：</div>
                    </div>
                </div>
                <div id="lanAddress" style="background:var(--bg-secondary);padding:12px 16px;border-radius:var(--radius-sm);
                     font-family:monospace;font-size:14px;color:var(--accent-green);text-align:center;user-select:all;">
                    正在获取 IP...
                </div>
                <div style="font-size:12px;color:var(--text-muted);margin-top:8px;">
                    ⚠️ 需要先修改 start.bat 使用 <code>--bind 0.0.0.0</code> 启动
                </div>
            </div>

            <!-- 每日复习提醒 -->
            <div class="settings-section">
                <h3>🔔 每日复习提醒</h3>
                
                <div class="setting-row">
                    <div>
                        <div class="setting-label">开启提醒</div>
                        <div class="setting-desc">每天提醒复习熟悉度低于 3 的单词</div>
                    </div>
                    <label class="toggle-switch">
                        <input type="checkbox" id="reminderToggle" ${reminderEnabled ? 'checked' : ''}>
                        <span class="toggle-slider"></span>
                    </label>
                </div>

                <div class="setting-row">
                    <div>
                        <div class="setting-label">提醒时间</div>
                        <div class="setting-desc">设置每日提醒的具体时间</div>
                    </div>
                    <input type="time" id="reminderTime" class="time-input" 
                           value="${reminderTime}" ${reminderEnabled ? '' : 'disabled'}>
                </div>
            </div>

            <!-- 主题设置 -->
            <div class="settings-section">
                <h3>🎨 主题设置</h3>
                <div class="setting-row">
                    <div>
                        <div class="setting-label">深色模式</div>
                        <div class="setting-desc">切换深色/浅色主题</div>
                    </div>
                    <label class="toggle-switch">
                        <input type="checkbox" id="themeToggle" ${document.documentElement.getAttribute('data-theme') === 'dark' ? 'checked' : ''}>
                        <span class="toggle-slider"></span>
                    </label>
                </div>
            </div>

            <!-- 关于 -->
            <div class="settings-section">
                <h3>ℹ️ 关于</h3>
                <div class="setting-row">
                    <div>
                        <div class="setting-label">WordWiz v1.0.0</div>
                        <div class="setting-desc">跨平台单词学习 App · 纯前端本地离线版</div>
                    </div>
                    <span style="font-size:24px;">📖</span>
                </div>
            </div>
        `;

        // 渲染统计仪表盘
        const dashboardContainer = container.querySelector('#statsDashboard');
        await StatsHelper.renderDashboard(dashboardContainer);

        // 成就墙
        const achievementContainer = document.createElement('div');
        achievementContainer.id = 'achievementWall';
        container.insertBefore(achievementContainer, container.querySelector('#bookManagementSection'));
        await AchievementHelper.renderWall(achievementContainer);

        // 挑战记录
        const challengeHistoryContainer = document.createElement('div');
        challengeHistoryContainer.id = 'challengeHistorySection';
        container.insertBefore(challengeHistoryContainer, container.querySelector('#bookManagementSection'));
        await this._renderChallengeHistory(challengeHistoryContainer);

        // 渲染词书管理
        await this._renderBookManagement(container);

        // 显示局域网地址
        this._showLanAddress(container);

        // ====== 绑定事件 ======

        // 导入
        document.getElementById('importBtn').addEventListener('click', () => {
            document.getElementById('importFileInput').click();
        });

        // 下载 CSV 模板
        document.getElementById('downloadTemplateBtn').addEventListener('click', () => {
            const csv = WordParser.generateTemplateCSV();
            this._downloadFile(csv, 'wordwiz_template.csv', 'text/csv;charset=utf-8');
            window.Toast.show('📄 模板已下载');
        });

        document.getElementById('importFileInput').addEventListener('change', async (e) => {
            const file = e.target.files[0];
            if (!file) return;

            const resultContainer = document.getElementById('importResult');
            resultContainer.innerHTML = '<div style="text-align:center;padding:12px;color:var(--text-muted)">⏳ 正在导入，请稍候...</div>';

            try {
                const text = await file.text();
                const isJSON = file.name.endsWith('.json');
                const onDuplicate = await this._showImportConfirmModal();
                if (!onDuplicate) return;

                // 选择目标词书
                const books = await WordDB.getBooks();
                let targetBookId = null;
                if (books.length > 1) {
                    const bookNames = books.map((b, i) => `${i + 1}. ${b.name}`).join('\n');
                    const choice = prompt(`选择目标词书（输入编号，留空自动创建新词书）：\n\n${bookNames}\n\n输入 0 或留空=自动创建新词书`);
                    if (choice && !isNaN(parseInt(choice)) && parseInt(choice) > 0 && parseInt(choice) <= books.length) {
                        targetBookId = books[parseInt(choice) - 1].id;
                    }
                }

                let result;
                if (isJSON) {
                    result = await WordParser.parseJSON(text, { 
                        onDuplicate,
                        bookSource: file.name.replace(/\.\w+$/, ''),
                        targetBookId
                    });
                } else {
                    result = await WordParser.parseCSV(text, { 
                        onDuplicate,
                        bookSource: file.name.replace(/\.\w+$/, ''),
                        targetBookId
                    });
                }

                // 如果成功创建了新词书，刷新词书管理
                if (result.createdBookId) {
                    await this._renderBookManagement(container);
                }

                    let html = `<div class="import-result ${result.success > 0 ? 'success' : 'error'}">`;
                    html += `📥 导入完成：成功 ${result.success} 个`;
                    if (result.skipped > 0) html += `，跳过 ${result.skipped} 个（重复）`;
                    if (result.multiTagged > 0) html += `<br>🏷️ ${result.multiTagged} 个单词已追加多词书记录（同时属于多本词书）`;
                    if (result.createdBookId) html += `<br>📚 已自动创建新词书「${result.bookName}」`;
                    if (result.errors.length > 0) {
                        html += `<br><span style="font-size:12px;">错误：${result.errors.slice(0, 3).join('；')}</span>`;
                    }
                    html += '</div>';

                resultContainer.innerHTML = html;

                if (result.success > 0) {
                    await StatsHelper.renderDashboard(dashboardContainer);
                }
            } catch (err) {
                resultContainer.innerHTML = `<div class="import-result error">❌ 导入失败：${err.message}</div>`;
            }

            e.target.value = '';
        });

        // 导出 JSON
        document.getElementById('exportJSONBtn').addEventListener('click', async () => {
            try {
                const json = await WordParser.exportToJSON();
                this._downloadFile(json, 'wordwiz_export.json', 'application/json');
                window.Toast.show('📤 JSON 导出成功');
            } catch (err) {
                window.Toast.show('❌ 导出失败：' + err.message);
            }
        });

        // 导出 CSV
        document.getElementById('exportCSVBtn').addEventListener('click', async () => {
            try {
                const csv = await WordParser.exportToCSV();
                this._downloadFile(csv, 'wordwiz_export.csv', 'text/csv;charset=utf-8');
                window.Toast.show('📤 CSV 导出成功');
            } catch (err) {
                window.Toast.show('❌ 导出失败：' + err.message);
            }
        });

        // 清空回收站
        document.getElementById('clearTrashBtn').addEventListener('click', async () => {
            if (confirm('确定要永久删除回收站中的所有单词吗？')) {
                const count = await WordDB.clearTrash();
                window.Toast.show(`🗑️ 已清空 ${count} 个单词`);
                // 成就：标记清空回收站
                await AchievementHelper.markTrashCleaned();
                // 重新渲染成就墙
                const achievementContainer = container.querySelector('#achievementWall');
                if (achievementContainer) await AchievementHelper.renderWall(achievementContainer);
                await StatsHelper.renderDashboard(dashboardContainer);
            }
        });

        // 提醒开关
        document.getElementById('reminderToggle').addEventListener('change', async (e) => {
            const enabled = e.target.checked;
            await WordDB.saveSetting('reminder_enabled', enabled);
            document.getElementById('reminderTime').disabled = !enabled;
            if (enabled) {
                await NotificationHelper.requestPermission();
                window.Toast.show('🔔 提醒已开启');
            } else {
                window.Toast.show('🔕 提醒已关闭');
            }
        });

        // 提醒时间
        document.getElementById('reminderTime').addEventListener('change', async (e) => {
            await WordDB.saveSetting('reminder_time', e.target.value);
            await WordDB.saveSetting('reminder_last_sent', '');
            window.Toast.show(`⏰ 提醒时间已设为 ${e.target.value}`);
        });

        // ====== 主题切换 ======
        const themeToggle = document.getElementById('themeToggle');
        if (themeToggle) {
            themeToggle.addEventListener('change', (e) => {
                const isDark = e.target.checked;
                const theme = isDark ? 'dark' : 'light';
                document.documentElement.setAttribute('data-theme', theme);
                try {
                    localStorage.setItem('wordwiz_theme', theme);
                } catch (err) {}
                window.Toast.show(isDark ? '🌙 已切换为深色主题' : '☀️ 已切换为浅色主题');
            });
        }

        // ====== 学习进度备份/恢复 ======

        // 导出全部进度
        document.getElementById('exportProgressBtn').addEventListener('click', async () => {
            try {
                const json = await WordParser.exportFullProgress();
                const date = new Date().toISOString().slice(0, 10);
                this._downloadFile(json, `wordwiz_backup_${date}.json`, 'application/json');
                window.Toast.show('💾 学习进度备份已导出');
            } catch (err) {
                window.Toast.show('❌ 导出失败：' + err.message);
            }
        });

        // 导入进度备份
        document.getElementById('importProgressBtn').addEventListener('click', () => {
            document.getElementById('importProgressInput').click();
        });

        document.getElementById('importProgressInput').addEventListener('change', async (e) => {
            const file = e.target.files[0];
            if (!file) return;

            const resultEl = document.getElementById('progressResult');
            resultEl.innerHTML = '<div style="color:var(--text-muted)">⏳ 正在导入备份，请稍候...</div>';

            try {
                const text = await file.text();
                const result = await WordParser.importFullProgress(text);

                if (result.success) {
                    const details = result.details;
                    let html = '<div style="color:var(--accent-green);padding:8px 0;">✅ ' + result.message + '</div>';
                    html += '<div style="font-size:12px;color:var(--text-secondary);">';
                    html += `📚 词书：${details.booksImported} 本 | 📝 单词：${details.wordsImported} 个`;
                    if (details.settingsImported > 0) html += ` | ⚙️ 设置：${details.settingsImported} 项`;
                    if (details.statsImported > 0) html += ` | 📊 统计：${details.statsImported} 条`;
                    html += '</div>';
                    resultEl.innerHTML = html;

                    // 刷新统计和词书管理
                    await StatsHelper.renderDashboard(dashboardContainer);
                    await this._renderBookManagement(container);
                    window.Toast.show('✅ 进度恢复成功！');
                } else {
                    resultEl.innerHTML = '<div style="color:var(--accent-red);">❌ ' + result.message + '</div>';
                }
            } catch (err) {
                resultEl.innerHTML = '<div style="color:var(--accent-red);">❌ 导入失败：' + err.message + '</div>';
            }

            e.target.value = '';
        });

        // ====== 在线词库下载 ======

        document.querySelectorAll('.lib-card').forEach(card => {
            card.addEventListener('click', async () => {
                const url = card.dataset.url;
                const name = card.dataset.name;
                const resultEl = document.getElementById('onlineLibResult');

                card.style.opacity = '0.5';
                resultEl.innerHTML = `<span>⏳ 正在加载「${name}」...</span>`;

                try {
                    const response = await fetch(url);
                    const text = await response.text();
                    const result = await WordParser.parseJSON(text, {
                        onDuplicate: 'skip',
                        bookSource: name
                    });

                    let html = '';
                    if (result.success > 0) {
                        html += `<span style="color:var(--accent-green);">✅ 「${name}」已加载：成功 ${result.success} 个单词</span>`;
                        if (result.multiTagged > 0) {
                            html += `<br><span style="font-size:12px;color:var(--text-muted);">🏷️ ${result.multiTagged} 个单词已追加到多词书归属</span>`;
                        }
                        // 刷新统计和词书管理
                        await StatsHelper.renderDashboard(dashboardContainer);
                        await this._renderBookManagement(container);
                    } else {
                        html += `<span style="color:var(--text-muted);">⚠️ 「${name}」中的单词已全部存在，无需重复加载</span>`;
                    }
                    resultEl.innerHTML = html;
                } catch (err) {
                    resultEl.innerHTML = `<span style="color:var(--accent-red);">❌ 加载失败：${err.message}</span>`;
                }

                card.style.opacity = '1';
            });
        });
    }

    /**
     * 渲染词书管理列表
     */
    static async _renderBookManagement(container) {
        const listContainer = container.querySelector('#bookList');
        const books = await WordDB.getBooks();
        const activeIds = await WordDB.getActiveBookIds();

        if (books.length === 0) {
            listContainer.innerHTML = '<div style="color:var(--text-muted);font-size:13px;">暂无词书</div>';
            return;
        }

        listContainer.innerHTML = books.map(b => {
            const isActive = activeIds.includes(b.id);
            return `
                <div class="setting-row" style="flex-wrap:nowrap;">
                    <label class="toggle-switch" style="flex-shrink:0;margin-right:10px;">
                        <input type="checkbox" class="book-toggle" data-book-id="${b.id}" ${isActive ? 'checked' : ''}>
                        <span class="toggle-slider"></span>
                    </label>
                    <div style="flex:1;min-width:0;">
                        <div class="setting-label" style="font-size:13px;">${b.name} ${b.is_system ? '<span style="color:var(--text-muted);font-size:11px;">[系统]</span>' : ''}</div>
                        <div class="setting-desc">${b.description || ''}</div>
                    </div>
                    ${!b.is_system ? `<button class="btn btn-danger btn-sm delete-book-btn" data-book-id="${b.id}" style="font-size:11px;padding:2px 8px;">删除</button>` : ''}
                </div>
            `;
        }).join('');

        // 勾选切换 → 保存激活词书
        listContainer.querySelectorAll('.book-toggle').forEach(cb => {
            cb.addEventListener('change', async () => {
                const books = await WordDB.getBooks();
                const activeIds = [];
                listContainer.querySelectorAll('.book-toggle:checked').forEach(c => activeIds.push(parseInt(c.dataset.bookId)));
                if (activeIds.length === 0) {
                    window.Toast.show('至少保留一个词书');
                    cb.checked = true;
                    return;
                }
                await WordDB.saveActiveBookIds(activeIds);
                window.Toast.show('词书筛选已更新');
            });
        });

        // 删除词书
        listContainer.querySelectorAll('.delete-book-btn').forEach(btn => {
            btn.addEventListener('click', async () => {
                const bid = parseInt(btn.dataset.bookId);
                const book = await WordDB.getBookById(bid);
                if (!book) return;
                if (confirm(`确定删除词书「${book.name}」吗？\n该词书下的单词将归入默认基础词书，不会丢失。`)) {
                    try {
                        await WordDB.deleteBook(bid);
                        window.Toast.show(`已删除词书「${book.name}」`);
                        await this._renderBookManagement(container);
                    } catch (e) {
                        window.Toast.show('❌ ' + e.message);
                    }
                }
            });
        });

        // 新词书按钮
        const addBtn = container.querySelector('#addBookBtn');
        const nameInput = container.querySelector('#newBookName');
        if (addBtn) {
            addBtn.onclick = async () => {
                const name = nameInput.value.trim();
                if (!name) { window.Toast.show('请输入词书名称'); return; }
                await WordDB.addBook({ name, description: '' });
                nameInput.value = '';
                window.Toast.show(`📚 已创建词书「${name}」`);
                await this._renderBookManagement(container);
                // 自动勾选新词书
                await WordDB.saveActiveBookIds((await WordDB.getBooks()).map(b => b.id));
            };
            nameInput.addEventListener('keydown', (e) => {
                if (e.key === 'Enter') addBtn.click();
            });
        }
    }

    /**
     * 渲染挑战历史记录
     */
    static async _renderChallengeHistory(container) {
        const history = await WordDB.getSetting('challenge_history', []);
        const challengeCount = await WordDB.getSetting('achievement_challenge_count', 0);

        if (history.length === 0) {
            container.innerHTML = [
                '<div class="settings-section">',
                '<h3>\uD83C\uDFAF 挑战记录</h3>',
                '<div style="text-align:center;padding:20px;color:var(--text-muted);font-size:13px;">',
                '暂无挑战记录，去挑战模式试试吧！',
                '</div></div>'
            ].join('');
            return;
        }

        // 显示最近的 20 条（倒序）
        const recent = [...history].reverse().slice(0, 20);
        const totalChallenges = history.length;

        // 统计汇总
        const avgCorrect = Math.round(recent.reduce((s, r) => s + r.correct, 0) / recent.length);
        const avgElapsed = Math.round(recent.reduce((s, r) => s + r.elapsed, 0) / recent.length);
        const avgPct = Math.round(recent.reduce((s, r) => s + (r.total > 0 ? r.correct / r.total * 100 : 0), 0) / recent.length);

        // 构建列表行
        const rows = recent.map(r => {
            const d = new Date(r.date);
            const MM = d.getMonth() + 1;
            const DD = d.getDate();
            const HH = String(d.getHours()).padStart(2, '0');
            const mm = String(d.getMinutes()).padStart(2, '0');
            const dateStr = MM + '/' + DD + ' ' + HH + ':' + mm;
            const pct = r.total > 0 ? Math.round(r.correct / r.total * 100) : 0;
            const mins = String(Math.floor(r.elapsed / 60)).padStart(2, '0');
            const secs = String(r.elapsed % 60).padStart(2, '0');
            const rangeMap = { active: '激活词书', all: '全部词库', category: '按分类' };
            const pctColor = pct >= 80 ? 'var(--accent-green)' : pct >= 60 ? 'var(--accent-yellow)' : 'var(--accent-red)';
            
            return '<div style="display:flex;align-items:center;gap:10px;padding:8px 0;border-bottom:1px solid rgba(58,58,92,0.2);font-size:13px;">' +
                '<span style="width:70px;color:var(--text-muted);font-size:12px;">' + dateStr + '</span>' +
                '<span style="flex:1;color:var(--text-secondary);">' + r.correct + '/' + r.total + ' 题</span>' +
                '<span style="width:44px;text-align:center;font-weight:600;color:' + pctColor + ';">' + pct + '%</span>' +
                '<span style="width:50px;text-align:right;color:var(--text-muted);font-size:12px;">' + mins + ':' + secs + '</span>' +
                '<span style="width:60px;text-align:right;color:var(--text-muted);font-size:11px;">' + (rangeMap[r.rangeType] || r.rangeType) + '</span>' +
                '</div>';
        });

        container.innerHTML = [
            '<div class="settings-section">',
            '<h3>\uD83C\uDFAF 挑战记录</h3>',

            // 汇总
            '<div style="display:grid;grid-template-columns:repeat(4,1fr);gap:8px;margin-bottom:16px;">',
            '<div style="background:var(--bg-secondary);padding:10px;border-radius:var(--radius-sm);text-align:center;">',
            '<div style="font-size:20px;font-weight:700;color:var(--accent-blue);">' + totalChallenges + '</div>',
            '<div style="font-size:11px;color:var(--text-muted);">总次数</div></div>',

            '<div style="background:var(--bg-secondary);padding:10px;border-radius:var(--radius-sm);text-align:center;">',
            '<div style="font-size:20px;font-weight:700;color:var(--accent-green);">' + avgPct + '%</div>',
            '<div style="font-size:11px;color:var(--text-muted);">平均正确率</div></div>',

            '<div style="background:var(--bg-secondary);padding:10px;border-radius:var(--radius-sm);text-align:center;">',
            '<div style="font-size:20px;font-weight:700;color:var(--accent-yellow);">' + avgCorrect + '</div>',
            '<div style="font-size:11px;color:var(--text-muted);">平均正确数</div></div>',

            '<div style="background:var(--bg-secondary);padding:10px;border-radius:var(--radius-sm);text-align:center;">',
            '<div style="font-size:20px;font-weight:700;color:var(--accent-purple);">' + avgElapsed + 's</div>',
            '<div style="font-size:11px;color:var(--text-muted);">平均用时</div></div>',
            '</div>',

            // 列表
            '<div style="max-height:320px;overflow-y:auto;">',
            rows.join(''),
            '</div>',

            '<div style="text-align:right;margin-top:8px;font-size:11px;color:var(--text-muted);">',
            '最近 20 条（共 ' + totalChallenges + ' 条）',
            '</div></div>'
        ].join('');
    }

    /**
     * 显示局域网地址
     */
    static async _showLanAddress(container) {
        const el = container.querySelector('#lanAddress');
        try {
            // 使用 WebRTC 获取本地 IP（仅局域网）
            const pc = new RTCPeerConnection({ iceServers: [] });
            pc.createDataChannel('');
            pc.onicecandidate = (e) => {
                if (!e.candidate) return;
                const ip = e.candidate.candidate.match(/([0-9]{1,3}\.){3}[0-9]{1,3}/);
                if (ip) {
                    el.textContent = `http://${ip[0]}:3000`;
                    pc.close();
                }
            };
            pc.createOffer().then(o => pc.setLocalDescription(o));
            setTimeout(() => {
                if (el.textContent === '正在获取 IP...') {
                    el.textContent = '获取局域网地址超时，请确认是否在局域网环境中。';
                }
            }, 3000);
        } catch (e) {
            el.textContent = '当前设备不支持自动获取 IP，请使用 ipconfig 查看';
        }
    }

    static _downloadFile(content, filename, mimeType) {
        const blob = new Blob([content], { type: mimeType });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }

    /**
     * 自定义模态框替代原生 confirm()，用于导入时确认覆盖策略
     * @returns {Promise<string|false>} 'overwrite' | 'skip' | false（取消）
     */
    static _showImportConfirmModal() {
        return new Promise((resolve) => {
            // 创建遮罩层
            const overlay = document.createElement('div');
            overlay.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.6);z-index:9999;display:flex;align-items:center;justify-content:center;';

            // 创建模态框
            const modal = document.createElement('div');
            modal.style.cssText = 'background:#1a1a2e;border:1px solid #00ff88;border-radius:12px;padding:28px 32px;max-width:400px;width:90%;box-shadow:0 8px 32px rgba(0,0,0,0.5);';

            // 标题
            const title = document.createElement('p');
            title.textContent = '📥 导入确认';
            title.style.cssText = 'font-size:18px;font-weight:600;color:var(--text-primary);margin:0 0 12px;';

            // 描述
            const desc = document.createElement('p');
            desc.textContent = '检测到重复单词时是否覆盖释义？';
            desc.style.cssText = 'font-size:14px;color:var(--text-secondary);margin:0 0 20px;line-height:1.5;';

            // 按钮容器
            const btnContainer = document.createElement('div');
            btnContainer.style.cssText = 'display:flex;gap:12px;justify-content:flex-end;';

            // 确认导入按钮（覆盖）
            const confirmBtn = document.createElement('button');
            confirmBtn.textContent = '✅ 确认导入';
            confirmBtn.className = 'btn btn-primary btn-sm';

            // 取消按钮（跳过）
            const skipBtn = document.createElement('button');
            skipBtn.textContent = '⏭ 跳过重复';
            skipBtn.className = 'btn btn-sm';
            skipBtn.style.cssText = 'border-color:#ff6b6b;color:#ff6b6b;';

            // 关闭按钮（取消导入）
            const cancelBtn = document.createElement('button');
            cancelBtn.textContent = '❌ 取消导入';
            cancelBtn.className = 'btn btn-sm';

            btnContainer.appendChild(confirmBtn);
            btnContainer.appendChild(skipBtn);
            btnContainer.appendChild(cancelBtn);

            modal.appendChild(title);
            modal.appendChild(desc);
            modal.appendChild(btnContainer);
            overlay.appendChild(modal);
            document.body.appendChild(overlay);

            // 清理函数
            const cleanup = () => {
                document.body.removeChild(overlay);
            };

            confirmBtn.onclick = () => { cleanup(); resolve('overwrite'); };
            skipBtn.onclick = () => { cleanup(); resolve('skip'); };
            cancelBtn.onclick = () => { cleanup(); resolve(false); };
            overlay.onclick = (e) => {
                if (e.target === overlay) { cleanup(); resolve(false); }
            };
        });
    }
}

window.SettingsPage = SettingsPage;

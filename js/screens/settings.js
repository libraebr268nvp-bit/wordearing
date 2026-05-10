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
                    <button class="btn btn-primary btn-sm" id="importBtn">📥 选择文件导入</button>
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

        // 渲染词书管理
        await this._renderBookManagement(container);

        // 显示局域网地址
        this._showLanAddress(container);

        // ====== 绑定事件 ======

        // 导入
        document.getElementById('importBtn').addEventListener('click', () => {
            document.getElementById('importFileInput').click();
        });

        document.getElementById('importFileInput').addEventListener('change', async (e) => {
            const file = e.target.files[0];
            if (!file) return;

            const resultContainer = document.getElementById('importResult');
            resultContainer.innerHTML = '<div style="text-align:center;padding:12px;color:var(--text-muted)">⏳ 正在导入，请稍候...</div>';

            try {
                const text = await file.text();
                const isJSON = file.name.endsWith('.json');
                const onDuplicate = confirm('检测到重复单词时是否覆盖释义？\n\n选择「确定」= 覆盖\n选择「取消」= 跳过') ? 'overwrite' : 'skip';

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
                    el.textContent = '请确保已通过 --bind 0.0.0.0 启动服务器';
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
}

window.SettingsPage = SettingsPage;

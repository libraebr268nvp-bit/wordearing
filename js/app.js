/**
 * WordWiz - 主入口
 * 
 * 负责：
 * - 初始化数据库
 * - 预置演示数据
 * - Hash 路由管理
 * - 页面渲染调度
 * - Toast 通知系统
 */

// ====== Toast 通知系统 ======
window.Toast = {
    show(message, type = 'info') {
        const container = document.getElementById('toastContainer');
        const item = document.createElement('div');
        item.className = 'toast-item';
        item.textContent = message;
        container.appendChild(item);
        // 动画结束后移除
        setTimeout(() => {
            if (item.parentNode) item.remove();
        }, 3000);
    }
};

// ====== 主应用 ======
class WordWizApp {
    constructor() {
        this.currentPage = 'home';
        this.container = document.getElementById('pageContainer');
    }

    /**
     * 初始化应用
     */
    async init() {
        console.log('WordWiz 启动中...');
        
        try {
            // 1. 打开数据库
            await WordDB.open();
            console.log('数据库已连接');

            // 2. 初始化默认词书 + 预置数据 + 孤儿迁移
            await WordDB.initializeDefaults();

            // 3. 自动清理过期回收站（30 天）
            const cleaned = await WordDB.autoCleanTrash(30);
            if (cleaned > 0) {
                console.log('已自动清理 ' + cleaned + ' 个过期回收站单词');
            }

            // 4. 配置导航
            this._setupNavigation();

            // 5. 监听 hash 变化
            window.addEventListener('hashchange', () => this._handleRoute());

            // 6. 启动每日提醒检查
            NotificationHelper.startReminderChecker();

            // 7. 渲染初始页面
            const initialPage = this._getPageFromHash() || 'home';
            await this._renderPage(initialPage);

            console.log('WordWiz 启动完成');
        } catch (err) {
            console.error('启动失败:', err);
            const errMsg = err.message || String(err);
            this.container.innerHTML = 
                '<div style="text-align:center;padding:80px 20px;">' +
                '<div style="font-size:48px;margin-bottom:16px;">💥</div>' +
                '<h2>启动失败</h2>' +
                '<p style="color:var(--text-muted);margin-top:8px;font-size:14px;">' + errMsg + '</p>' +
                '<div style="margin-top:20px;display:flex;gap:10px;justify-content:center;flex-wrap:wrap;">' +
                '<button onclick="location.reload()" class="btn btn-primary">🔄 重新加载</button>' +
                '<button onclick="window._resetDB()" class="btn btn-danger">🗑️ 重置数据库</button>' +
                '</div>' +
                '<div style="margin-top:20px;padding:12px;background:var(--bg-secondary);border-radius:8px;font-size:12px;color:var(--text-muted);text-align:left;max-width:400px;margin-left:auto;margin-right:auto;">' +
                '<div><strong>可能的原因：</strong></div>' +
                '<div>1. 请确保通过 http://localhost:3000 访问（不要直接双击 html 文件）</div>' +
                '<div>2. 浏览器不支持 IndexedDB（请使用 Chrome/Edge 最新版）</div>' +
                '<div>3. 如果问题持续，请点击「重置数据库」</div>' +
                '</div></div>';
            
            // 注册重置数据库的全局函数
            window._resetDB = async function() {
                if (confirm('确定要重置数据库吗？所有数据将被清除！')) {
                    try {
                        const req = indexedDB.deleteDatabase('WordWizDB');
                        req.onsuccess = () => {
                            window.Toast.show('✅ 数据库已重置，即将刷新...');
                            setTimeout(() => location.reload(), 1000);
                        };
                        req.onerror = () => alert('重置失败，请手动清除浏览器数据');
                    } catch(e) {
                        alert('重置失败: ' + e.message);
                    }
                }
            };
        }
    }

    /**
     * 配置导航按钮
     */
    _setupNavigation() {
        document.querySelectorAll('.nav-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const page = btn.dataset.page;
                if (page === this.currentPage) return;
                
                // 更新导航激活状态
                document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');

                // 更新 hash
                window.location.hash = '#/' + page;
            });
        });
    }

    /**
     * 从 hash 中获取页面名
     */
    _getPageFromHash() {
        const hash = window.location.hash.replace('#/', '');
        const validPages = ['home', 'favorites', 'trash', 'settings'];
        return validPages.includes(hash) ? hash : null;
    }

    /**
     * 处理路由变化
     */
    async _handleRoute() {
        const page = this._getPageFromHash() || 'home';
        if (page === this.currentPage) return;
        await this._renderPage(page);
    }

    /**
     * 渲染指定页面
     */
    async _renderPage(page) {
        this.currentPage = page;

        // 更新导航高亮
        document.querySelectorAll('.nav-btn').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.page === page);
        });

        // 淡出
        this.container.classList.remove('page-fade-in');
        
        // 渲染页面
        switch (page) {
            case 'home':
                await HomePage.render(this.container);
                break;
            case 'favorites':
                await FavoritesPage.render(this.container);
                break;
            case 'trash':
                await TrashPage.render(this.container);
                break;
            case 'settings':
                await SettingsPage.render(this.container);
                break;
        }

        // 淡入动画
        setTimeout(() => this.container.classList.add('page-fade-in'), 50);
    }
}

// ====== 启动应用 ======
document.addEventListener('DOMContentLoaded', () => {
    const app = new WordWizApp();
    app.init();
});

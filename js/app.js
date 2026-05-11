/**
 * WordWiz - 主入口
 * 
 * 负责：
 * - 初始化数据库
 * - 预置演示数据
 * - Hash 路由管理（唯一入口：hashchange）
 * - 页面渲染调度（generation 锁防竞态）
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
        setTimeout(() => {
            if (item.parentNode) item.remove();
        }, 3000);
    }
};

// ====== 全局应用状态 ======
// 所有页面的临时 UI 状态放在这里，切换页面不丢失
window.AppState = {
    home: {
        shuffled: false,
        unitOrder: null,       // null=默认顺序，否则为打乱后的单元编号数组
        wordOrders: {}         // { unit编号: [打乱后的单词ID顺序] }
    },
    favorites: {
        category: '全部',
        sort: 'default',
        shuffled: false
    }
};

// ====== 主应用 ======
class WordWizApp {
    constructor() {
        this.container = document.getElementById('pageContainer');
        this._renderGen = 0;   // generation 锁：每次渲染递增，旧渲染完成后自我丢弃
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

            // 5. 监听 hash 变化（唯一渲染入口）
            window.addEventListener('hashchange', () => this._handleRoute());

            // 6. 启动每日提醒检查
            NotificationHelper.startReminderChecker();

            // 7. 初始渲染：设 hash 触发 hashchange（不直接调 render）
            //    注意：此时还没有 hash，第一次设 hash 必触发 hashchange
            window.location.hash = '#/home';

            console.log('WordWiz 启动完成');
        } catch (err) {
            console.error('启动失败:', err);
            this._showFatalError(err);
        }
    }

    /**
     * 展示致命错误页
     */
    _showFatalError(err) {
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
            '<div>4. 查看控制台(F12 → Console)获取详细错误信息</div>' +
            '</div></div>';
        
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

    /**
     * 配置导航按钮
     * 
     * 规则：
     * - 不同页面 → 设置 hash，由 hashchange 触发渲染
     * - 相同页面 → 直接调 _renderPage（hash 不会变化，hashchange 不会触发）
     * - 导航按钮不直接调任何页面渲染函数
     */
    _setupNavigation() {
        document.querySelectorAll('.nav-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const page = btn.dataset.page;
                
                // 更新导航激活状态
                document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');

                // 获取当前页面
                const currentHash = window.location.hash.replace('#/', '');
                
                if (page === currentHash) {
                    // 相同页面 → 直接渲染（hashchange 不会触发）
                    this._renderPage(page);
                } else {
                    // 不同页面 → 设 hash，由 hashchange 驱动渲染
                    window.location.hash = '#/' + page;
                }
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
     * 处理 hashchange 事件
     * 这是页面切换的唯一入口之一（另一个是导航按钮的同页面点击）
     */
    async _handleRoute() {
        const page = this._getPageFromHash() || 'home';
        await this._renderPage(page);
    }

    /**
     * 渲染指定页面（核心渲染方法）
     * 
     * 使用 generation 锁防止异步竞态：
     * 每次调 _renderPage 时递增 this._renderGen，
     * async 操作完成后检查 gen 是否匹配，不匹配则丢弃结果。
     */
    async _renderPage(page) {
        const gen = ++this._renderGen;

        try {
            // 更新导航高亮
            document.querySelectorAll('.nav-btn').forEach(btn => {
                btn.classList.toggle('active', btn.dataset.page === page);
            });

            // 同步 hash（不触发 hashchange）
            const expectedHash = '#/' + page;
            if (window.location.hash !== expectedHash) {
                history.replaceState(null, '', expectedHash);
            }

            // 淡出
            this.container.classList.remove('page-fade-in');
            
            // 渲染页面
            switch (page) {
                case 'home':
                    if (typeof HomePage?.render === 'function') await HomePage.render(this.container);
                    break;
                case 'favorites':
                    if (typeof FavoritesPage?.render === 'function') await FavoritesPage.render(this.container);
                    break;
                case 'trash':
                    if (typeof TrashPage?.render === 'function') await TrashPage.render(this.container);
                    break;
                case 'settings':
                    if (typeof SettingsPage?.render === 'function') await SettingsPage.render(this.container);
                    break;
            }

            // 如果已被更新的渲染取代，丢弃当前结果
            if (gen !== this._renderGen) return;

            // 淡入动画
            setTimeout(() => this.container.classList.add('page-fade-in'), 50);
        } catch (e) {
            console.error('页面渲染失败:', page, e);
            // 丢弃过时错误
            if (gen !== this._renderGen) return;
            this.container.innerHTML = `
                <div style="text-align:center;padding:80px 20px;">
                    <div style="font-size:48px;margin-bottom:16px;">⚠️</div>
                    <h2>页面加载失败</h2>
                    <p style="color:var(--text-muted);font-size:13px;">${e.message}</p>
                    <button onclick="location.reload()" class="btn btn-primary" style="margin-top:16px;">🔄 重新加载</button>
                </div>
            `;
        }
    }
}

// ====== 启动应用 ======
document.addEventListener('DOMContentLoaded', () => {
    const app = new WordWizApp();
    app.init();
});

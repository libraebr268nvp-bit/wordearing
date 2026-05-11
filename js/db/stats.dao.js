/**
 * WordWiz - 统计数据访问层（DAO）
 * 
 * 依赖：connection.js（WordDatabase 类已定义）
 * 给 WordDatabase.prototype 添加统计相关方法
 */

/**
 * 获取统计数据
 * @returns {Promise<{totalWords: number, averageFamiliarity: string, favoriteCount: number, trashCount: number}>}
 */
WordDatabase.prototype.getStats = async function() {
    const all = await this.getAllWords();
    const trash = await this.getTrashWords();
    const favorites = all.filter(w => w.is_favorite);
    const totalFam = all.reduce((sum, w) => sum + w.familiarity, 0);
    return {
        totalWords: all.length,
        averageFamiliarity: all.length > 0 ? (totalFam / all.length).toFixed(1) : 0,
        favoriteCount: favorites.length,
        trashCount: trash.length
    };
};

/**
 * 记录学习事件
 * @param {string} word
 * @param {string} category
 * @returns {Promise<number>} 记录 ID
 */
WordDatabase.prototype.recordStudyEvent = async function(word, category) {
    const today = new Date().toISOString().split('T')[0];
    return this._add('stats', {
        date: today,
        word: word,
        category: category || '未知',
        type: 'familiar',
        timestamp: new Date().toISOString()
    });
};

/**
 * 获取学习趋势
 * @param {number} [days=7]
 * @returns {Promise<{date: string, count: number}[]>}
 */
WordDatabase.prototype.getStudyTrend = async function(days = 7) {
    const store = await this._getStore('stats', 'readonly');
    return new Promise((resolve) => {
        const req = store.getAll();
        req.onsuccess = () => {
            const records = req.result || [];
            const result = [];
            const now = new Date();
            for (let i = days - 1; i >= 0; i--) {
                const d = new Date(now);
                d.setDate(d.getDate() - i);
                const dateStr = d.toISOString().split('T')[0];
                const count = records.filter(r => r.date === dateStr && r.type === 'familiar').length;
                result.push({ date: dateStr, count });
            }
            resolve(result);
        };
        req.onerror = () => resolve([]);
    });
};

console.log('[WordWiz DAO] stats.dao.js 已加载 — 3 个统计方法已挂载');

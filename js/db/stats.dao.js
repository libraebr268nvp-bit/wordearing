/**
 * WordWiz - 统计数据访问层（DAO）
 * 
 * 依赖：connection.js（WordDatabase 类已定义）
 * v5 新增：getBookWordCounts() — 基于 book_ids 多归属统计每本词书单词数
 * 给 WordDatabase.prototype 添加统计相关方法
 */

/**
 * 获取本地日期字符串（YYYY-MM-DD），避免 UTC 时区偏差
 */
function _getLocalDateStr(date) {
    const d = date || new Date();
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
}

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
 * 获取每本词书的单词统计（基于 book_ids 多归属）
 * @returns {Promise<{bookId: number, bookName: string, wordCount: number}[]>}
 */
WordDatabase.prototype.getBookWordCounts = async function() {
    const books = await this.getBooks();
    const all = await this.getAllWords();
    return books.map(book => {
        let count = 0;
        for (const word of all) {
            if (WordModel.belongsToBook(word, book.id)) {
                count++;
            }
        }
        return { bookId: book.id, bookName: book.name, wordCount: count };
    });
};

/**
 * 记录学习事件
 * @param {string} word
 * @param {string} category
 * @returns {Promise<number>} 记录 ID
 */
WordDatabase.prototype.recordStudyEvent = async function(word, category) {
    const today = _getLocalDateStr();
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
                const dateStr = _getLocalDateStr(d);
                const count = records.filter(r => r.date === dateStr && r.type === 'familiar').length;
                result.push({ date: dateStr, count });
            }
            resolve(result);
        };
        req.onerror = () => resolve([]);
    });
};

/**
 * 获取所有统计记录（用于导出）
 * @returns {Promise<Array>}
 */
WordDatabase.prototype.getAllStats = async function() {
    return this._getAll('stats');
};

/**
 * 添加统计记录
 * @param {{date: string, type: string, value: number, count: number}} statData
 * @returns {Promise<number>} 记录 ID
 */
WordDatabase.prototype.addStat = async function(statData) {
    return this._add('stats', {
        date: statData.date,
        type: statData.type,
        value: statData.value || 0,
        count: statData.count || 0,
        timestamp: new Date().toISOString()
    });
};

console.log('[WordWiz DAO] stats.dao.js 已加载 — 6 个统计方法已挂载');


/**
 * WordWiz - 单词数据访问层（DAO）
 * 
 * 依赖：connection.js（WordDatabase 类已定义）
 * 给 WordDatabase.prototype 添加单词相关方法
 */

// ===================== 查询 =====================

/**
 * 获取所有未删除的单词
 * @returns {Promise<WordModel[]>}
 */
WordDatabase.prototype.getAllWords = async function() {
    const results = await this._getAllRaw('words', (row) => this._isNotDeleted(row));
    return results.map(r => WordModel.fromRow(r)).filter(r => r !== null);
};

/**
 * 根据词书 ID 列表获取未删除单词
 * @param {number[]} bookIds
 * @returns {Promise<WordModel[]>}
 */
WordDatabase.prototype.getWordsByBooks = async function(bookIds) {
    const results = await this._getAllRaw('words', row => 
        this._isNotDeleted(row) && bookIds.includes(row.book_id)
    );
    return results.map(r => WordModel.fromRow(r)).filter(r => r !== null);
};

/**
 * 获取回收站中的单词
 * @returns {Promise<WordModel[]>}
 */
WordDatabase.prototype.getTrashWords = async function() {
    const results = await this._getAllRaw('words', (row) => this._isDeleted(row));
    return results.map(r => WordModel.fromRow(r)).filter(r => r !== null);
};

/**
 * 根据 ID 获取单词
 * @param {number} id
 * @returns {Promise<WordModel|null>}
 */
WordDatabase.prototype.getWordById = async function(id) {
    const row = await this._getByKey('words', id);
    return WordModel.fromRow(row);
};

// ===================== 写入 =====================

/**
 * 添加一个单词
 * @param {object} wordData
 * @returns {Promise<number>} 新单词 ID
 */
WordDatabase.prototype.addWord = async function(wordData) {
    const word = WordModel.create(wordData);
    word.created_at = new Date().toISOString();
    return this._add('words', word);
};

/**
 * 批量添加单词
 * @param {object[]} wordsArray
 * @returns {Promise<number>} 成功添加的数量
 */
WordDatabase.prototype.addWords = async function(wordsArray) {
    const now = new Date().toISOString();
    const batch = wordsArray.map(w => {
        const word = WordModel.create(w);
        word.created_at = now;
        return word;
    });
    return this._addBatch('words', batch);
};

/**
 * 更新单词
 * @param {number} id
 * @param {object} updates
 * @returns {Promise<WordModel|null>}
 */
WordDatabase.prototype.updateWord = async function(id, updates) {
    const store = await this._getStore('words', 'readwrite');
    return new Promise((resolve, reject) => {
        const getReq = store.get(id);
        getReq.onsuccess = () => {
            const word = getReq.result;
            if (!word) { resolve(null); return; }
            Object.assign(word, updates);
            if (updates.familiarity !== undefined) {
                word.familiarity = Math.min(5, Math.max(0, updates.familiarity));
            }
            const putReq = store.put(word);
            putReq.onsuccess = () => resolve(WordModel.fromRow(word));
            putReq.onerror = () => reject(putReq.error);
        };
        getReq.onerror = () => reject(getReq.error);
    });
};

/**
 * 增加熟悉度（上限 5）
 * @param {number} id
 * @returns {Promise<WordModel|null>}
 */
WordDatabase.prototype.increaseFamiliarity = async function(id) {
    const word = await this.getWordById(id);
    if (!word) return null;
    const newFam = Math.min(5, (word.familiarity || 0) + 1);
    const updated = await this.updateWord(id, { familiarity: newFam });
    if (updated) {
        await this.recordStudyEvent(word.word, word.category);
    }
    return updated;
};

/**
 * 切换收藏状态
 * @param {number} id
 * @returns {Promise<WordModel|null>}
 */
WordDatabase.prototype.toggleFavorite = async function(id) {
    const word = await this.getWordById(id);
    if (!word) return null;
    return this.updateWord(id, { is_favorite: !word.is_favorite });
};

/**
 * 软删除单词
 * @param {number} id
 * @returns {Promise<WordModel|null>}
 */
WordDatabase.prototype.softDeleteWord = async function(id) {
    return this.updateWord(id, { 
        deleted_at: new Date().toISOString(),
        is_favorite: false
    });
};

/**
 * 恢复单词（从回收站）
 * @param {number} id
 * @returns {Promise<WordModel|null>}
 */
WordDatabase.prototype.restoreWord = async function(id) {
    return this.updateWord(id, { deleted_at: null });
};

/**
 * 物理删除单词
 * @param {number} id
 * @returns {Promise<boolean>}
 */
WordDatabase.prototype.hardDeleteWord = async function(id) {
    return this._delete('words', id);
};

/**
 * 清空回收站
 * @returns {Promise<number>} 清空的单词数
 */
WordDatabase.prototype.clearTrash = async function() {
    const trashWords = await this.getTrashWords();
    for (const w of trashWords) {
        await this.hardDeleteWord(w.id);
    }
    return trashWords.length;
};

/**
 * 自动清理过期回收站单词
 * @param {number} days - 过期天数，默认 30
 * @returns {Promise<number>} 清理的单词数
 */
WordDatabase.prototype.autoCleanTrash = async function(days = 30) {
    const trashWords = await this.getTrashWords();
    const now = Date.now();
    const cutoff = now - days * 24 * 60 * 60 * 1000;
    let cleaned = 0;
    for (const w of trashWords) {
        if (w.deleted_at && new Date(w.deleted_at).getTime() < cutoff) {
            await this.hardDeleteWord(w.id);
            cleaned++;
        }
    }
    return cleaned;
};

// ===================== 条件查询 =====================

/**
 * 按分类筛选单词
 * @param {string} category - '全部' 表示不过滤
 * @param {number[]} [bookIds] - 可选词书过滤
 * @returns {Promise<WordModel[]>}
 */
WordDatabase.prototype.getWordsByCategory = async function(category, bookIds = null) {
    let words;
    if (bookIds) {
        words = await this.getWordsByBooks(bookIds);
    } else {
        words = await this.getAllWords();
    }
    if (!category || category === '全部') return words;
    return words.filter(w => w.category === category);
};

/**
 * 按单元获取单词
 * @param {number} unit
 * @returns {Promise<WordModel[]>}
 */
WordDatabase.prototype.getWordsByUnit = async function(unit) {
    const all = await this.getAllWords();
    return all.filter(w => w.unit === unit);
};

/**
 * 获取收藏单词
 * @param {string} [category] - 分类过滤
 * @param {number[]} [bookIds] - 词书过滤
 * @returns {Promise<WordModel[]>}
 */
WordDatabase.prototype.getFavoriteWords = async function(category = null, bookIds = null) {
    let words;
    if (bookIds) {
        words = await this.getWordsByBooks(bookIds);
    } else {
        words = await this.getAllWords();
    }
    words = words.filter(w => w.is_favorite);
    if (category && category !== '全部') {
        words = words.filter(w => w.category === category);
    }
    return words;
};

/**
 * 按单词文本精确查找
 * @param {string} wordText
 * @returns {Promise<WordModel|undefined>}
 */
WordDatabase.prototype.findWordByText = async function(wordText) {
    const all = await this.getAllWords();
    return all.find(w => w.word.toLowerCase() === wordText.toLowerCase());
};

/**
 * 搜索单词（模糊匹配）
 * @param {string} keyword
 * @returns {Promise<WordModel[]>} 最多 50 条
 */
WordDatabase.prototype.searchWords = async function(keyword) {
    if (!keyword || !keyword.trim()) return [];
    const kw = keyword.trim().toLowerCase();
    const all = await this.getAllWords();
    return all.filter(w => 
        w.word.toLowerCase().includes(kw) || 
        (w.definition && w.definition.toLowerCase().includes(kw))
    ).slice(0, 50);
};

console.log('[WordWiz DAO] words.dao.js 已加载 — 17 个单词方法已挂载');

/**
 * WordWiz - 词书数据访问层（DAO）
 * 
 * 依赖：connection.js（WordDatabase 类已定义）
 * 给 WordDatabase.prototype 添加词书相关方法
 */

/**
 * 获取所有词书
 * @returns {Promise<BookModel[]>}
 */
WordDatabase.prototype.getBooks = async function() {
    return this._getAll('books');
};

/**
 * 根据 ID 获取词书
 * @param {number} id
 * @returns {Promise<object|null>}
 */
WordDatabase.prototype.getBookById = async function(id) {
    return this._getByKey('books', id);
};

/**
 * 新增词书
 * @param {object} bookData - { name, description, is_system }
 * @returns {Promise<number>} 新词书 ID
 */
WordDatabase.prototype.addBook = async function(bookData) {
    const book = {
        name: bookData.name || '未命名词书',
        description: bookData.description || '',
        is_system: !!bookData.is_system,
        created_at: new Date().toISOString()
    };
    return this._add('books', book);
};

/**
 * 删除词书（单词重置到默认词书）
 * @param {number} bookId
 * @returns {Promise<boolean>}
 */
WordDatabase.prototype.deleteBook = async function(bookId) {
    const books = await this.getBooks();
    const defaultBook = books.find(b => b.is_system) || books[0];
    if (!defaultBook) throw new Error('没有默认词书');

    if (bookId === defaultBook.id) {
        throw new Error('不能删除默认词书');
    }

    const all = await this._getAllRaw('words');
    for (const row of all) {
        if (row.book_id === bookId && this._isNotDeleted(row)) {
            await this.updateWord(row.id, { book_id: defaultBook.id });
        }
    }

    // 从 active_books 中移除被删除的词书 ID
    const activeIds = await this.getActiveBookIds();
    const filtered = activeIds.filter(id => id !== bookId);
    if (filtered.length !== activeIds.length) {
        await this.saveActiveBookIds(filtered);
    }

    return this._delete('books', bookId);
};

/**
 * 获取已激活的词书 ID 列表
 * @returns {Promise<number[]>}
 */
WordDatabase.prototype.getActiveBookIds = async function() {
    const saved = await this.getSetting('active_books', null);
    if (saved) return saved;

    const books = await this.getBooks();
    return books.map(b => b.id);
};

/**
 * 保存激活的词书 ID 列表
 * @param {number[]} ids
 * @returns {Promise<boolean>}
 */
WordDatabase.prototype.saveActiveBookIds = async function(ids) {
    return this.saveSetting('active_books', ids);
};

console.log('[WordWiz DAO] books.dao.js 已加载 — 6 个词书方法已挂载');

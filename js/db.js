/**
 * WordWiz - IndexedDB 数据库封装（DAO 层）
 * 
 * v3 新增：
 * - books 表：管理词书
 * - words 增加 book_id 字段，关联词书
 * - 孤儿数据自动迁移
 */

class WordDatabase {
    constructor() {
        this.dbName = 'WordWizDB';
        this.dbVersion = 3;
        this.db = null;
    }

    /**
     * 打开/初始化数据库
     */
    async open() {
        if (!window.indexedDB) {
            throw new Error('此浏览器不支持 IndexedDB，请使用 Chrome/Edge 最新版本');
        }

        return new Promise((resolve, reject) => {
            const request = indexedDB.open(this.dbName, this.dbVersion);

            request.onupgradeneeded = (event) => {
                const db = event.target.result;
                const oldVersion = event.oldVersion;

                // v1 初始建表
                if (oldVersion < 1) {
                    this._createWordStore(db);
                    this._createSettingsStore(db);
                    this._createStatsStore(db);
                }

                // v2 升级（如果之前是 v1）
                if (oldVersion < 2) {
                    // 主要是修复 autoIncrement 问题，无结构变更
                }

                // v3 新增 books 表 + words 表加 book_id
                if (oldVersion < 3) {
                    this._createBookStore(db);
                    // 给 words 表重建索引（book_id）
                    if (db.objectStoreNames.contains('words')) {
                        const store = event.currentTarget.transaction.objectStore('words');
                        if (!store.indexNames.contains('book_id')) {
                            store.createIndex('book_id', 'book_id', { unique: false });
                        }
                    }
                }

                console.log('📦 数据库升级到 v' + this.dbVersion);
            };

            request.onsuccess = (event) => {
                this.db = event.target.result;
                console.log('📦 数据库连接成功');
                resolve(this.db);
            };

            request.onerror = (event) => {
                console.error('📦 数据库连接失败:', event.target.error);
                reject(event.target.error);
            };
        });
    }

    /**
     * 创建 words 表
     */
    _createWordStore(db) {
        const store = db.createObjectStore('words', { keyPath: 'id', autoIncrement: true });
        store.createIndex('word', 'word', { unique: false });
        store.createIndex('category', 'category', { unique: false });
        store.createIndex('unit', 'unit', { unique: false });
        store.createIndex('book_id', 'book_id', { unique: false });
        store.createIndex('is_favorite', 'is_favorite', { unique: false });
        store.createIndex('deleted_at', 'deleted_at', { unique: false });
        store.createIndex('familiarity', 'familiarity', { unique: false });
    }

    /**
     * 创建 settings 表
     */
    _createSettingsStore(db) {
        db.createObjectStore('settings', { keyPath: 'key' });
    }

    /**
     * 创建 stats 表
     */
    _createStatsStore(db) {
        const store = db.createObjectStore('stats', { keyPath: 'id', autoIncrement: true });
        store.createIndex('date', 'date', { unique: false });
        store.createIndex('type', 'type', { unique: false });
    }

    /**
     * 创建 books 表（v3）
     */
    _createBookStore(db) {
        const store = db.createObjectStore('books', { keyPath: 'id', autoIncrement: true });
        store.createIndex('name', 'name', { unique: false });
    }

    // ===================== 初始化 =====================

    /**
     * 首次初始化：创建默认词书 + 预置数据
     */
    async initializeDefaults() {
        // 检查是否已有词书
        const books = await this.getBooks();
        if (books.length === 0) {
            const defaultBook = await this.addBook({ 
                name: '通用基础词书', 
                description: '系统内置的基础词书，包含核心通用词汇',
                is_system: true
            });
            console.log('📚 已创建默认词书: 通用基础词书 (id=' + defaultBook + ')');
        }

        // 迁移孤儿数据：所有 book_id 缺失的单词归入通用基础词书
        await this._migrateOrphanWords();

        // 预置 200 词（仅首次）
        await this.seedDemoData();
    }

    /**
     * 迁移缺失 book_id 的单词到通用基础词书
     */
    async _migrateOrphanWords() {
        const books = await this.getBooks();
        const defaultBookId = books.length > 0 ? books[0].id : 1;

        const all = await this._getAllRaw('words');
        let migrated = 0;
        for (const row of all) {
            if (!row.book_id && this._isNotDeleted(row)) {
                await this.updateWord(row.id, { book_id: defaultBookId });
                migrated++;
            }
        }
        if (migrated > 0) {
            console.log(`📦 已迁移 ${migrated} 个孤儿单词到默认词书`);
        }
    }

    // ==================== 词书管理 ====================

    /**
     * 获取所有词书
     */
    async getBooks() {
        return this._getAll('books');
    }

    /**
     * 根据 ID 获取词书
     */
    async getBookById(id) {
        return this._getByKey('books', id);
    }

    /**
     * 新增词书
     */
    async addBook(bookData) {
        const book = {
            name: bookData.name || '未命名词书',
            description: bookData.description || '',
            is_system: !!bookData.is_system,
            created_at: new Date().toISOString()
        };
        return this._add('books', book);
    }

    /**
     * 删除词书（单词重置到默认词书）
     */
    async deleteBook(bookId) {
        const books = await this.getBooks();
        const defaultBook = books.find(b => b.is_system) || books[0];
        if (!defaultBook) throw new Error('没有默认词书');

        // 防止删除默认词书
        if (bookId === defaultBook.id) {
            throw new Error('不能删除默认词书');
        }

        // 将该词书下的所有单词重置到默认词书
        const all = await this._getAllRaw('words');
        for (const row of all) {
            if (row.book_id === bookId && this._isNotDeleted(row)) {
                await this.updateWord(row.id, { book_id: defaultBook.id });
            }
        }

        return this._delete('books', bookId);
    }

    /**
     * 获取已激活的词书 ID 列表
     */
    async getActiveBookIds() {
        const saved = await this.getSetting('active_books', null);
        if (saved) return saved;
        
        // 默认全选
        const books = await this.getBooks();
        return books.map(b => b.id);
    }

    /**
     * 保存激活的词书 ID 列表
     */
    async saveActiveBookIds(ids) {
        return this.saveSetting('active_books', ids);
    }

    // ==================== 单词 CRUD ====================

    /**
     * 判断记录是否未删除（兼容 deleted_at 不存在或为 null 的情况）
     */
    _isNotDeleted(row) {
        return row.deleted_at === null || row.deleted_at === undefined;
    }

    /**
     * 判断记录是否已删除
     */
    _isDeleted(row) {
        return row.deleted_at !== null && row.deleted_at !== undefined;
    }

    /**
     * 获取所有未删除的单词
     */
    async getAllWords() {
        const results = await this._getAllRaw('words', (row) => this._isNotDeleted(row));
        return results.map(r => WordModel.fromRow(r)).filter(r => r !== null);
    }

    /**
     * 根据词书 ID 列表获取未删除单词
     */
    async getWordsByBooks(bookIds) {
        const results = await this._getAllRaw('words', row => 
            this._isNotDeleted(row) && bookIds.includes(row.book_id)
        );
        return results.map(r => WordModel.fromRow(r)).filter(r => r !== null);
    }

    /**
     * 获取回收站中的单词
     */
    async getTrashWords() {
        const results = await this._getAllRaw('words', (row) => this._isDeleted(row));
        return results.map(r => WordModel.fromRow(r)).filter(r => r !== null);
    }

    /**
     * 根据 ID 获取单词
     */
    async getWordById(id) {
        const row = await this._getByKey('words', id);
        return WordModel.fromRow(row);
    }

    /**
     * 添加一个单词
     */
    async addWord(wordData) {
        const word = WordModel.create(wordData);
        word.created_at = new Date().toISOString();
        return this._add('words', word);
    }

    /**
     * 批量添加单词
     */
    async addWords(wordsArray) {
        const now = new Date().toISOString();
        const batch = wordsArray.map(w => {
            const word = WordModel.create(w);
            word.created_at = now;
            return word;
        });
        return this._addBatch('words', batch);
    }

    /**
     * 更新单词
     */
    async updateWord(id, updates) {
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
    }

    /**
     * 增加熟悉度（上限 5）
     */
    async increaseFamiliarity(id) {
        const word = await this.getWordById(id);
        if (!word) return null;
        const newFam = Math.min(5, (word.familiarity || 0) + 1);
        const updated = await this.updateWord(id, { familiarity: newFam });
        if (updated) {
            await this.recordStudyEvent(word.word, word.category);
        }
        return updated;
    }

    /**
     * 切换收藏状态
     */
    async toggleFavorite(id) {
        const word = await this.getWordById(id);
        if (!word) return null;
        return this.updateWord(id, { is_favorite: !word.is_favorite });
    }

    /**
     * 软删除单词
     */
    async softDeleteWord(id) {
        return this.updateWord(id, { 
            deleted_at: new Date().toISOString(),
            is_favorite: false  // 删除时自动取消收藏
        });
    }

    /**
     * 恢复单词（从回收站）
     */
    async restoreWord(id) {
        return this.updateWord(id, { deleted_at: null });
    }

    /**
     * 物理删除单词
     */
    async hardDeleteWord(id) {
        return this._delete('words', id);
    }

    /**
     * 清空回收站
     */
    async clearTrash() {
        const trashWords = await this.getTrashWords();
        for (const w of trashWords) {
            await this.hardDeleteWord(w.id);
        }
        return trashWords.length;
    }

    /**
     * 自动清理过期回收站单词
     */
    async autoCleanTrash(days = 30) {
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
    }

    // ==================== 查询 ====================

    /**
     * 按分类筛选单词（基于已激活词书）
     */
    async getWordsByCategory(category, bookIds = null) {
        let words;
        if (bookIds) {
            words = await this.getWordsByBooks(bookIds);
        } else {
            words = await this.getAllWords();
        }
        if (!category || category === '全部') return words;
        return words.filter(w => w.category === category);
    }

    /**
     * 按单元获取单词
     */
    async getWordsByUnit(unit) {
        const all = await this.getAllWords();
        return all.filter(w => w.unit === unit);
    }

    /**
     * 获取收藏单词
     */
    async getFavoriteWords(category = null, bookIds = null) {
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
    }

    /**
     * 按单词文本搜索（模糊匹配）
     */
    async findWordByText(wordText) {
        const all = await this.getAllWords();
        return all.find(w => w.word.toLowerCase() === wordText.toLowerCase());
    }

    /**
     * 搜索单词（模糊匹配，返回匹配列表）
     */
    async searchWords(keyword) {
        if (!keyword || !keyword.trim()) return [];
        const kw = keyword.trim().toLowerCase();
        const all = await this.getAllWords();
        return all.filter(w => 
            w.word.toLowerCase().includes(kw) || 
            (w.definition && w.definition.toLowerCase().includes(kw))
        ).slice(0, 50);  // 最多返回 50 条
    }

    // ==================== 统计 ====================

    async getStats() {
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
    }

    async recordStudyEvent(word, category) {
        const today = new Date().toISOString().split('T')[0];
        return this._add('stats', {
            date: today,
            word: word,
            category: category || '未知',
            type: 'familiar',
            timestamp: new Date().toISOString()
        });
    }

    async getStudyTrend(days = 7) {
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
    }

    // ==================== 设置 ====================

    async saveSetting(key, value) {
        const store = await this._getStore('settings', 'readwrite');
        return new Promise((resolve, reject) => {
            const req = store.put({ key, value });
            req.onsuccess = () => resolve(true);
            req.onerror = () => reject(req.error);
        });
    }

    async getSetting(key, defaultValue = null) {
        const store = await this._getStore('settings', 'readonly');
        return new Promise((resolve) => {
            const req = store.get(key);
            req.onsuccess = () => resolve(req.result ? req.result.value : defaultValue);
            req.onerror = () => resolve(defaultValue);
        });
    }

    // ==================== 预置数据 ====================

    async seedDemoData() {
        const existing = await this.getAllWords();
        if (existing.length > 0) {
            console.log('📦 数据库已有数据，跳过预置');
            return false;
        }

        const books = await this.getBooks();
        const defaultBookId = books.length > 0 ? books[0].id : 1;

        const words = [
            { word: "abandon", definition: "v. 放弃；遗弃", category: "四级", unit: 1, book_id: defaultBookId },
            { word: "ability", definition: "n. 能力；才能", category: "四级", unit: 1, book_id: defaultBookId },
            { word: "abroad", definition: "adv. 在国外；到国外", category: "四级", unit: 1, book_id: defaultBookId },
            { word: "absent", definition: "adj. 缺席的；不在的", category: "四级", unit: 1, book_id: defaultBookId },
            { word: "absolute", definition: "adj. 绝对的；完全的", category: "四级", unit: 1, book_id: defaultBookId },
            { word: "absorb", definition: "v. 吸收；吸引", category: "四级", unit: 1, book_id: defaultBookId },
            { word: "abstract", definition: "adj. 抽象的 n. 摘要", category: "四级", unit: 1, book_id: defaultBookId },
            { word: "abundant", definition: "adj. 丰富的；充裕的", category: "四级", unit: 1, book_id: defaultBookId },
            { word: "academic", definition: "adj. 学术的；学院的", category: "四级", unit: 1, book_id: defaultBookId },
            { word: "accelerate", definition: "v. 加速；促进", category: "四级", unit: 1, book_id: defaultBookId },
            { word: "access", definition: "n. 入口；通道 v. 访问", category: "四级", unit: 1, book_id: defaultBookId },
            { word: "accompany", definition: "v. 陪伴；伴随", category: "四级", unit: 1, book_id: defaultBookId },
            { word: "accomplish", definition: "v. 完成；实现", category: "四级", unit: 1, book_id: defaultBookId },
            { word: "account", definition: "n. 账户；描述 v. 解释", category: "四级", unit: 1, book_id: defaultBookId },
            { word: "accurate", definition: "adj. 准确的；精确的", category: "四级", unit: 1, book_id: defaultBookId },
            { word: "accuse", definition: "v. 指控；指责", category: "四级", unit: 1, book_id: defaultBookId },
            { word: "achieve", definition: "v. 达到；取得", category: "四级", unit: 1, book_id: defaultBookId },
            { word: "acknowledge", definition: "v. 承认；确认", category: "四级", unit: 1, book_id: defaultBookId },
            { word: "acquire", definition: "v. 获得；学到", category: "四级", unit: 1, book_id: defaultBookId },
            { word: "adapt", definition: "v. 适应；改编", category: "四级", unit: 1, book_id: defaultBookId },
            { word: "adequate", definition: "adj. 足够的；适当的", category: "四级", unit: 1, book_id: defaultBookId },
            { word: "adjust", definition: "v. 调整；适应", category: "四级", unit: 1, book_id: defaultBookId },
            { word: "administration", definition: "n. 管理；行政", category: "四级", unit: 1, book_id: defaultBookId },
            { word: "admire", definition: "v. 钦佩；欣赏", category: "四级", unit: 1, book_id: defaultBookId },
            { word: "adopt", definition: "v. 采纳；收养", category: "四级", unit: 1, book_id: defaultBookId },
            { word: "advance", definition: "v. 前进；提前 n. 进步", category: "四级", unit: 1, book_id: defaultBookId },
            { word: "advantage", definition: "n. 优势；有利条件", category: "四级", unit: 1, book_id: defaultBookId },
            { word: "advertise", definition: "v. 做广告；宣传", category: "四级", unit: 1, book_id: defaultBookId },
            { word: "affair", definition: "n. 事务；事件", category: "四级", unit: 1, book_id: defaultBookId },
            { word: "affect", definition: "v. 影响；感动", category: "四级", unit: 1, book_id: defaultBookId },
            { word: "afford", definition: "v. 负担得起；提供", category: "四级", unit: 1, book_id: defaultBookId },
            { word: "aggressive", definition: "adj. 侵略的；好斗的", category: "四级", unit: 1, book_id: defaultBookId },
            { word: "agree", definition: "v. 同意；赞成", category: "四级", unit: 1, book_id: defaultBookId },
            { word: "agriculture", definition: "n. 农业；农艺", category: "四级", unit: 1, book_id: defaultBookId },
            { word: "alcohol", definition: "n. 酒精；含酒精饮料", category: "四级", unit: 1, book_id: defaultBookId },
            { word: "allocate", definition: "v. 分配；拨出", category: "四级", unit: 1, book_id: defaultBookId },
            { word: "alternative", definition: "n. 替代方案 adj. 替代的", category: "四级", unit: 1, book_id: defaultBookId },
            { word: "amaze", definition: "v. 使惊奇；使惊愕", category: "四级", unit: 1, book_id: defaultBookId },
            { word: "ambition", definition: "n. 雄心；野心", category: "四级", unit: 1, book_id: defaultBookId },
            { word: "analysis", definition: "n. 分析；解析", category: "四级", unit: 1, book_id: defaultBookId },
            { word: "announce", definition: "v. 宣布；通告", category: "四级", unit: 1, book_id: defaultBookId },
            { word: "annual", definition: "adj. 每年的 n. 年刊", category: "四级", unit: 1, book_id: defaultBookId },
            { word: "anxiety", definition: "n. 焦虑；忧虑", category: "四级", unit: 1, book_id: defaultBookId },
            { word: "apparent", definition: "adj. 明显的；表面上的", category: "四级", unit: 1, book_id: defaultBookId },
            { word: "appeal", definition: "v. 呼吁；吸引 n. 吸引力", category: "四级", unit: 1, book_id: defaultBookId },
            { word: "appetite", definition: "n. 食欲；欲望", category: "四级", unit: 1, book_id: defaultBookId },
            { word: "application", definition: "n. 申请；应用", category: "四级", unit: 1, book_id: defaultBookId },
            { word: "appreciate", definition: "v. 感激；欣赏", category: "四级", unit: 1, book_id: defaultBookId },
            { word: "approach", definition: "v. 接近 n. 方法；途径", category: "四级", unit: 1, book_id: defaultBookId },
            { word: "appropriate", definition: "adj. 适当的 v. 拨出", category: "四级", unit: 1, book_id: defaultBookId },
            { word: "approve", definition: "v. 批准；赞同", category: "四级", unit: 1, book_id: defaultBookId },
            { word: "arise", definition: "v. 出现；产生", category: "四级", unit: 1, book_id: defaultBookId },
            { word: "arrange", definition: "v. 安排；整理", category: "四级", unit: 1, book_id: defaultBookId },
            { word: "artificial", definition: "adj. 人工的；虚伪的", category: "四级", unit: 1, book_id: defaultBookId },
            { word: "aspect", definition: "n. 方面；层面", category: "四级", unit: 1, book_id: defaultBookId },
            { word: "assemble", definition: "v. 集合；组装", category: "四级", unit: 1, book_id: defaultBookId },
            { word: "assess", definition: "v. 评估；评定", category: "四级", unit: 1, book_id: defaultBookId },
            { word: "assign", definition: "v. 分配；指定", category: "四级", unit: 1, book_id: defaultBookId },
            { word: "assist", definition: "v. 帮助；协助", category: "四级", unit: 1, book_id: defaultBookId },
            { word: "associate", definition: "v. 联想；交往 n. 同事", category: "四级", unit: 1, book_id: defaultBookId },
            { word: "assume", definition: "v. 假定；承担", category: "四级", unit: 1, book_id: defaultBookId },
            { word: "atmosphere", definition: "n. 气氛；大气层", category: "四级", unit: 1, book_id: defaultBookId },
            { word: "attach", definition: "v. 附上；连接", category: "四级", unit: 1, book_id: defaultBookId },
            { word: "attempt", definition: "v./n. 尝试；企图", category: "四级", unit: 1, book_id: defaultBookId },
            { word: "attitude", definition: "n. 态度；看法", category: "四级", unit: 1, book_id: defaultBookId },
            { word: "attract", definition: "v. 吸引；引起", category: "四级", unit: 1, book_id: defaultBookId },
            { word: "authority", definition: "n. 权威；当局", category: "四级", unit: 1, book_id: defaultBookId },
            { word: "available", definition: "adj. 可用的；有效的", category: "四级", unit: 1, book_id: defaultBookId },
            { word: "average", definition: "adj. 平均的 n. 平均水平", category: "四级", unit: 1, book_id: defaultBookId },
            { word: "avoid", definition: "v. 避免；回避", category: "四级", unit: 1, book_id: defaultBookId },
            { word: "aware", definition: "adj. 意识到的；知道的", category: "四级", unit: 1, book_id: defaultBookId },
            { word: "background", definition: "n. 背景；出身", category: "四级", unit: 1, book_id: defaultBookId },
            { word: "balance", definition: "n. 平衡 v. 使平衡", category: "四级", unit: 1, book_id: defaultBookId },
            { word: "barrier", definition: "n. 障碍；屏障", category: "四级", unit: 1, book_id: defaultBookId },
            { word: "behavior", definition: "n. 行为；举止", category: "四级", unit: 1, book_id: defaultBookId },
            { word: "benefit", definition: "n. 利益 v. 受益", category: "四级", unit: 1, book_id: defaultBookId },
            { word: "blame", definition: "v. 责备 n. 责任", category: "四级", unit: 1, book_id: defaultBookId },
            { word: "bother", definition: "v. 打扰；烦恼", category: "四级", unit: 1, book_id: defaultBookId },
            { word: "boundary", definition: "n. 边界；界限", category: "四级", unit: 1, book_id: defaultBookId },
            { word: "brilliant", definition: "adj. 灿烂的；杰出的", category: "四级", unit: 1, book_id: defaultBookId },
            { word: "budget", definition: "n. 预算 v. 做预算", category: "四级", unit: 1, book_id: defaultBookId },
            { word: "calculate", definition: "v. 计算；估计", category: "四级", unit: 1, book_id: defaultBookId },
            { word: "campaign", definition: "n. 运动；战役", category: "四级", unit: 1, book_id: defaultBookId },
            { word: "capable", definition: "adj. 有能力的；能干的", category: "四级", unit: 1, book_id: defaultBookId },
            { word: "capacity", definition: "n. 容量；能力", category: "四级", unit: 1, book_id: defaultBookId },
            { word: "capture", definition: "v. 捕获；夺取", category: "四级", unit: 1, book_id: defaultBookId },
            { word: "career", definition: "n. 职业；生涯", category: "四级", unit: 1, book_id: defaultBookId },
            { word: "category", definition: "n. 类别；分类", category: "四级", unit: 1, book_id: defaultBookId },
            { word: "celebrate", definition: "v. 庆祝；颂扬", category: "四级", unit: 1, book_id: defaultBookId },
            { word: "challenge", definition: "n. 挑战 v. 向…挑战", category: "四级", unit: 1, book_id: defaultBookId },
            { word: "character", definition: "n. 性格；特征；角色", category: "四级", unit: 1, book_id: defaultBookId },
            { word: "charity", definition: "n. 慈善；慈善机构", category: "四级", unit: 1, book_id: defaultBookId },
            { word: "chemical", definition: "adj. 化学的 n. 化学药品", category: "四级", unit: 1, book_id: defaultBookId },
            { word: "circumstance", definition: "n. 环境；情况", category: "四级", unit: 1, book_id: defaultBookId },
            { word: "claim", definition: "v. 声称；要求 n. 索赔", category: "四级", unit: 1, book_id: defaultBookId },
            { word: "classify", definition: "v. 分类；归类", category: "四级", unit: 1, book_id: defaultBookId },
            { word: "climate", definition: "n. 气候；风气", category: "四级", unit: 1, book_id: defaultBookId },
            { word: "collapse", definition: "v./n. 倒塌；崩溃", category: "四级", unit: 1, book_id: defaultBookId },
            { word: "command", definition: "v./n. 命令；指挥；掌握", category: "四级", unit: 1, book_id: defaultBookId },
            { word: "comment", definition: "n./v. 评论；注释", category: "四级", unit: 1, book_id: defaultBookId },
            // Unit 2
            { word: "commit", definition: "v. 犯（罪）；承诺", category: "四级", unit: 2, book_id: defaultBookId },
            { word: "communicate", definition: "v. 交流；传播", category: "四级", unit: 2, book_id: defaultBookId },
            { word: "community", definition: "n. 社区；团体", category: "四级", unit: 2, book_id: defaultBookId },
            { word: "companion", definition: "n. 同伴；伙伴", category: "四级", unit: 2, book_id: defaultBookId },
            { word: "compare", definition: "v. 比较；对比", category: "四级", unit: 2, book_id: defaultBookId },
            { word: "compete", definition: "v. 竞争；比赛", category: "四级", unit: 2, book_id: defaultBookId },
            { word: "complain", definition: "v. 抱怨；投诉", category: "四级", unit: 2, book_id: defaultBookId },
            { word: "complex", definition: "adj. 复杂的；综合的", category: "四级", unit: 2, book_id: defaultBookId },
            { word: "component", definition: "n. 成分；组件", category: "四级", unit: 2, book_id: defaultBookId },
            { word: "concentrate", definition: "v. 集中；专注", category: "四级", unit: 2, book_id: defaultBookId },
            { word: "concept", definition: "n. 概念；观念", category: "四级", unit: 2, book_id: defaultBookId },
            { word: "concern", definition: "n. 关心 v. 涉及；担心", category: "四级", unit: 2, book_id: defaultBookId },
            { word: "conclude", definition: "v. 得出结论；结束", category: "四级", unit: 2, book_id: defaultBookId },
            { word: "conduct", definition: "v. 引导；实施 n. 行为", category: "四级", unit: 2, book_id: defaultBookId },
            { word: "conference", definition: "n. 会议；讨论会", category: "四级", unit: 2, book_id: defaultBookId },
            { word: "confident", definition: "adj. 自信的；确信的", category: "四级", unit: 2, book_id: defaultBookId },
            { word: "confirm", definition: "v. 确认；证实", category: "四级", unit: 2, book_id: defaultBookId },
            { word: "conflict", definition: "n./v. 冲突；矛盾", category: "四级", unit: 2, book_id: defaultBookId },
            { word: "confuse", definition: "v. 使困惑；混淆", category: "四级", unit: 2, book_id: defaultBookId },
            { word: "connect", definition: "v. 连接；联系", category: "四级", unit: 2, book_id: defaultBookId },
            { word: "conscious", definition: "adj. 有意识的；自觉的", category: "四级", unit: 2, book_id: defaultBookId },
            { word: "consequence", definition: "n. 结果；后果", category: "四级", unit: 2, book_id: defaultBookId },
            { word: "conservation", definition: "n. 保存；保护", category: "四级", unit: 2, book_id: defaultBookId },
            { word: "consider", definition: "v. 考虑；认为", category: "四级", unit: 2, book_id: defaultBookId },
            { word: "consistent", definition: "adj. 一致的；始终如一的", category: "四级", unit: 2, book_id: defaultBookId },
            { word: "constant", definition: "adj. 不变的；持续的", category: "四级", unit: 2, book_id: defaultBookId },
            { word: "construct", definition: "v. 建造；构建", category: "四级", unit: 2, book_id: defaultBookId },
            { word: "consume", definition: "v. 消费；消耗", category: "四级", unit: 2, book_id: defaultBookId },
            { word: "contact", definition: "n./v. 联系；接触", category: "四级", unit: 2, book_id: defaultBookId },
            { word: "contain", definition: "v. 包含；容纳", category: "四级", unit: 2, book_id: defaultBookId },
            { word: "contemporary", definition: "adj. 当代的；同时代的", category: "四级", unit: 2, book_id: defaultBookId },
            { word: "content", definition: "n. 内容；目录 adj. 满足的", category: "四级", unit: 2, book_id: defaultBookId },
            { word: "contest", definition: "n. 竞赛 v. 争辩", category: "四级", unit: 2, book_id: defaultBookId },
            { word: "context", definition: "n. 上下文；背景", category: "四级", unit: 2, book_id: defaultBookId },
            { word: "contract", definition: "n. 合同 v. 收缩；订约", category: "四级", unit: 2, book_id: defaultBookId },
            { word: "contrast", definition: "n./v. 对比；对照", category: "四级", unit: 2, book_id: defaultBookId },
            { word: "contribute", definition: "v. 贡献；捐献", category: "四级", unit: 2, book_id: defaultBookId },
            { word: "controversy", definition: "n. 争论；争议", category: "四级", unit: 2, book_id: defaultBookId },
            { word: "convenient", definition: "adj. 方便的；便利的", category: "四级", unit: 2, book_id: defaultBookId },
            { word: "convention", definition: "n. 惯例；大会", category: "四级", unit: 2, book_id: defaultBookId },
            { word: "convince", definition: "v. 说服；使确信", category: "四级", unit: 2, book_id: defaultBookId },
            { word: "cooperate", definition: "v. 合作；协作", category: "四级", unit: 2, book_id: defaultBookId },
            { word: "coordinate", definition: "v. 协调；调整", category: "四级", unit: 2, book_id: defaultBookId },
            { word: "correspond", definition: "v. 对应；通信", category: "四级", unit: 2, book_id: defaultBookId },
            { word: "creative", definition: "adj. 创造性的", category: "四级", unit: 2, book_id: defaultBookId },
            { word: "crisis", definition: "n. 危机；紧要关头", category: "四级", unit: 2, book_id: defaultBookId },
            { word: "criteria", definition: "n. 标准；条件（复数）", category: "四级", unit: 2, book_id: defaultBookId },
            { word: "crucial", definition: "adj. 决定性的；关键的", category: "四级", unit: 2, book_id: defaultBookId },
            { word: "cultivate", definition: "v. 培养；耕作", category: "四级", unit: 2, book_id: defaultBookId },
            { word: "curiosity", definition: "n. 好奇心；求知欲", category: "四级", unit: 2, book_id: defaultBookId },
            { word: "current", definition: "adj. 当前的 n. 电流；水流", category: "四级", unit: 2, book_id: defaultBookId },
            { word: "debate", definition: "n./v. 辩论；争论", category: "四级", unit: 2, book_id: defaultBookId },
            { word: "decade", definition: "n. 十年", category: "四级", unit: 2, book_id: defaultBookId },
            { word: "decline", definition: "v./n. 下降；衰退；拒绝", category: "四级", unit: 2, book_id: defaultBookId },
            { word: "decorate", definition: "v. 装饰；装潢", category: "四级", unit: 2, book_id: defaultBookId },
            { word: "decrease", definition: "v./n. 减少；降低", category: "四级", unit: 2, book_id: defaultBookId },
            { word: "defeat", definition: "v./n. 击败；失败", category: "四级", unit: 2, book_id: defaultBookId },
            { word: "defend", definition: "v. 防御；辩护", category: "四级", unit: 2, book_id: defaultBookId },
            { word: "define", definition: "v. 定义；界定", category: "四级", unit: 2, book_id: defaultBookId },
            { word: "definitely", definition: "adv. 肯定地；明确地", category: "四级", unit: 2, book_id: defaultBookId },
            { word: "deliver", definition: "v. 递送；发表；接生", category: "四级", unit: 2, book_id: defaultBookId },
            { word: "demand", definition: "n./v. 需求；要求", category: "四级", unit: 2, book_id: defaultBookId },
            { word: "demonstrate", definition: "v. 证明；示范；示威", category: "四级", unit: 2, book_id: defaultBookId },
            { word: "depart", definition: "v. 离开；出发", category: "四级", unit: 2, book_id: defaultBookId },
            { word: "depend", definition: "v. 依赖；取决于", category: "四级", unit: 2, book_id: defaultBookId },
            { word: "deposit", definition: "v. 存放 n. 押金；存款", category: "四级", unit: 2, book_id: defaultBookId },
            { word: "depress", definition: "v. 使沮丧；压制", category: "四级", unit: 2, book_id: defaultBookId },
            { word: "derive", definition: "v. 源于；获得", category: "四级", unit: 2, book_id: defaultBookId },
            { word: "describe", definition: "v. 描述；形容", category: "四级", unit: 2, book_id: defaultBookId },
            { word: "deserve", definition: "v. 应得；值得", category: "四级", unit: 2, book_id: defaultBookId },
            { word: "desire", definition: "n./v. 渴望；欲望", category: "四级", unit: 2, book_id: defaultBookId },
            { word: "desperate", definition: "adj. 绝望的；拼命的", category: "四级", unit: 2, book_id: defaultBookId },
            { word: "despite", definition: "prep. 尽管；不管", category: "四级", unit: 2, book_id: defaultBookId },
            { word: "destination", definition: "n. 目的地；终点", category: "四级", unit: 2, book_id: defaultBookId },
            { word: "determine", definition: "v. 决定；确定", category: "四级", unit: 2, book_id: defaultBookId },
            { word: "develop", definition: "v. 发展；开发；培养", category: "四级", unit: 2, book_id: defaultBookId },
            { word: "device", definition: "n. 设备；装置", category: "四级", unit: 2, book_id: defaultBookId },
            { word: "devote", definition: "v. 致力于；奉献", category: "四级", unit: 2, book_id: defaultBookId },
            { word: "discipline", definition: "n. 纪律；学科", category: "四级", unit: 2, book_id: defaultBookId },
            { word: "discover", definition: "v. 发现；发觉", category: "四级", unit: 2, book_id: defaultBookId },
            { word: "discrimination", definition: "n. 歧视；辨别", category: "四级", unit: 2, book_id: defaultBookId },
            { word: "display", definition: "v./n. 展示；显示", category: "四级", unit: 2, book_id: defaultBookId },
            { word: "dispose", definition: "v. 处理；处置", category: "四级", unit: 2, book_id: defaultBookId },
            { word: "distinguish", definition: "v. 区分；辨别", category: "四级", unit: 2, book_id: defaultBookId },
            { word: "distribute", definition: "v. 分配；分发；分布", category: "四级", unit: 2, book_id: defaultBookId },
            { word: "diverse", definition: "adj. 多样的；不同的", category: "四级", unit: 2, book_id: defaultBookId },
            { word: "domestic", definition: "adj. 国内的；家庭的", category: "四级", unit: 2, book_id: defaultBookId },
            { word: "dominate", definition: "v. 支配；主导", category: "四级", unit: 2, book_id: defaultBookId },
            { word: "dramatic", definition: "adj. 戏剧性的；巨大的", category: "四级", unit: 2, book_id: defaultBookId },
            { word: "duration", definition: "n. 持续时间", category: "四级", unit: 2, book_id: defaultBookId },
            { word: "dynamic", definition: "adj. 动态的；有活力的", category: "四级", unit: 2, book_id: defaultBookId },
            { word: "economy", definition: "n. 经济；节约", category: "四级", unit: 2, book_id: defaultBookId },
            { word: "educate", definition: "v. 教育；培养", category: "四级", unit: 2, book_id: defaultBookId },
            { word: "efficient", definition: "adj. 高效的；有效率的", category: "四级", unit: 2, book_id: defaultBookId },
            { word: "elaborate", definition: "adj. 精心制作的 v. 阐述", category: "四级", unit: 2, book_id: defaultBookId },
            { word: "elegant", definition: "adj. 优雅的；精美的", category: "四级", unit: 2, book_id: defaultBookId },
            { word: "eliminate", definition: "v. 消除；淘汰", category: "四级", unit: 2, book_id: defaultBookId },
            { word: "embrace", definition: "v. 拥抱；包含；接受", category: "四级", unit: 2, book_id: defaultBookId },
            { word: "emerge", definition: "v. 出现；浮现", category: "四级", unit: 2, book_id: defaultBookId },
            { word: "emergency", definition: "n. 紧急情况；突发事件", category: "四级", unit: 2, book_id: defaultBookId },
            { word: "emotion", definition: "n. 情感；情绪", category: "四级", unit: 2, book_id: defaultBookId },
            { word: "emphasis", definition: "n. 强调；重点", category: "四级", unit: 2, book_id: defaultBookId },
        ];

        const batchSize = 50;
        for (let i = 0; i < words.length; i += batchSize) {
            await this.addWords(words.slice(i, i + batchSize));
        }
        console.log(`📦 已插入 ${words.length} 个预置单词（归属通用基础词书）`);
        return true;
    }

    // ==================== 内部方法 ====================

    async _getStore(storeName, mode = 'readonly') {
        if (!this.db) await this.open();
        const transaction = this.db.transaction(storeName, mode);
        return transaction.objectStore(storeName);
    }

    async _getAll(storeName) {
        const store = await this._getStore(storeName, 'readonly');
        return new Promise((resolve, reject) => {
            const req = store.getAll();
            req.onsuccess = () => resolve(req.result || []);
            req.onerror = () => reject(req.error);
        });
    }

    async _getAllRaw(storeName, filterFn = null) {
        const store = await this._getStore(storeName, 'readonly');
        return new Promise((resolve, reject) => {
            const req = store.getAll();
            req.onsuccess = () => {
                let results = req.result || [];
                if (filterFn) results = results.filter(filterFn);
                resolve(results);
            };
            req.onerror = () => {
                // 处理索引不存在的兼容问题
                console.warn('getAllRaw 查询失败，尝试全表扫描:', req.error);
                const cursorReq = store.openCursor();
                const results = [];
                cursorReq.onsuccess = (e) => {
                    const cursor = e.target.result;
                    if (cursor) {
                        results.push(cursor.value);
                        cursor.continue();
                    } else {
                        if (filterFn) {
                            resolve(results.filter(filterFn));
                        } else {
                            resolve(results);
                        }
                    }
                };
                cursorReq.onerror = () => reject(cursorReq.error);
            };
        });
    }

    async _getByKey(storeName, key) {
        const store = await this._getStore(storeName, 'readonly');
        return new Promise((resolve, reject) => {
            const req = store.get(key);
            req.onsuccess = () => resolve(req.result || null);
            req.onerror = () => reject(req.error);
        });
    }

    async _add(storeName, data) {
        const store = await this._getStore(storeName, 'readwrite');
        return new Promise((resolve, reject) => {
            const req = store.add(data);
            req.onsuccess = () => resolve(req.result);
            req.onerror = () => reject(req.error);
        });
    }

    async _addBatch(storeName, dataArray) {
        if (!dataArray || dataArray.length === 0) return 0;
        const store = await this._getStore(storeName, 'readwrite');
        return new Promise((resolve, reject) => {
            let completed = 0;
            let hasError = false;
            for (const data of dataArray) {
                try {
                    // 对于 autoIncrement 表，删除 id 避免主键冲突
                    const cleanData = { ...data };
                    delete cleanData.id;
                    const req = store.add(cleanData);
                    req.onsuccess = () => {
                        completed++;
                        if (completed >= dataArray.length && !hasError) resolve(completed);
                    };
                    req.onerror = () => {
                        if (!hasError) {
                            hasError = true;
                            reject(new Error(`批量写入失败: ${req.error?.message || '未知错误'}`));
                        }
                    };
                } catch (e) {
                    if (!hasError) {
                        hasError = true;
                        reject(e);
                    }
                }
            }
        });
    }

    async _delete(storeName, key) {
        const store = await this._getStore(storeName, 'readwrite');
        return new Promise((resolve, reject) => {
            const req = store.delete(key);
            req.onsuccess = () => resolve(true);
            req.onerror = () => reject(req.error);
        });
    }
}

window.WordDB = new WordDatabase();

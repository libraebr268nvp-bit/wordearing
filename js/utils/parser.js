/**
 * WordWiz - CSV/JSON 词库解析工具
 * 
 * v3 新增：
 * - 支持 targetBookId 参数
 * - 自动创建词书（如果指定了 bookSource 且不存在）
 * - 结果返回 createdBookId / bookName
 * 
 * v4 修复：
 * - 多词书重复导入时保留原有 book_id 和 category 不被覆盖
 * - 导入时如果词已存在，只补充空释义，不改变归属
 * 
 * v5 升级（多归属标签系统）：
 * - 重复单词不再简单跳过，而是将新词书的 book_id 追加到 book_ids 数组
 * - 单词同时属于多本词书，筛选任一词书都能显示
 */

class WordParser {
    /**
     * 解析 CSV 文本（按列名解析）
     * 
     * 支持列名（不区分大小写）：
     *   word       — 必填，英文单词
     *   definition — 必填，中文释义
     *   category   — 可选，默认 "其他"
     *   unit       — 可选，默认 1
     *   book_source — 可选，默认使用 options.bookSource 或 "导入词库"
     * 
     * 第一行为表头（列名），后续行为数据行。
     * 当检测到第一行列名包含 "word" 和 "definition" 时，按列名解析；
     * 否则回退到按位置解析（兼容旧格式）。
     */
    static async parseCSV(csvText, options = {}) {
        const result = { success: 0, skipped: 0, multiTagged: 0, errors: [], createdBookId: null, bookName: '' };

        try {
            const lines = csvText.split(/\r?\n/).filter(line => line.trim());
            if (lines.length === 0) {
                result.errors.push('文件为空');
                return result;
            }

            // 确定目标词书
            let bookId = options.targetBookId || null;
            if (!bookId && options.bookSource) {
                bookId = await this._ensureBook(options.bookSource);
                if (bookId) {
                    result.createdBookId = bookId;
                    result.bookName = options.bookSource;
                }
            }
            if (!bookId) bookId = 1;

            // 解析第一行，判断是否有表头
            const firstLineFields = this._parseCSVLine(lines[0]);
            const hasHeader = options.hasHeader !== false &&
                this._detectHeader(firstLineFields);

            let colMap = null;
            const startIndex = hasHeader ? 1 : 0;

            // 如果有表头，建立列名 → 索引映射
            if (hasHeader) {
                colMap = {};
                const headerFields = firstLineFields.map(f => f.trim().toLowerCase());
                const expectedCols = ['word', 'definition', 'category', 'unit', 'book_source'];
                for (const col of expectedCols) {
                    const idx = headerFields.indexOf(col);
                    if (idx >= 0) colMap[col] = idx;
                }
                // 兼容 book_source 的别名
                if (colMap['book_source'] === undefined) {
                    const altIdx = headerFields.indexOf('booksource');
                    if (altIdx >= 0) colMap['book_source'] = altIdx;
                }
            }

            for (let i = startIndex; i < lines.length; i++) {
                try {
                    const line = lines[i].trim();
                    if (!line) continue;

                    const fields = this._parseCSVLine(line);
                    if (fields.length < 2) {
                        result.errors.push(`第 ${i + 1} 行格式错误`);
                        continue;
                    }

                    // 按列名或位置提取字段
                    let word, definition, category, unit, bookSource;

                    if (colMap) {
                        word = colMap['word'] !== undefined ? (fields[colMap['word']] || '').trim() : '';
                        definition = colMap['definition'] !== undefined ? (fields[colMap['definition']] || '').trim() : '';
                        category = colMap['category'] !== undefined && fields[colMap['category']] ? fields[colMap['category']].trim() : '其他';
                        unit = colMap['unit'] !== undefined && fields[colMap['unit']] ? parseInt(fields[colMap['unit']].trim()) || 1 : 1;
                        bookSource = colMap['book_source'] !== undefined && fields[colMap['book_source']] ? fields[colMap['book_source']].trim() : '';
                    } else {
                        word = fields[0].trim();
                        definition = fields[1].trim();
                        category = fields[2] ? fields[2].trim() : '其他';
                        unit = fields[3] ? parseInt(fields[3].trim()) || 1 : 1;
                        bookSource = '';
                    }

                    // 如果数据行中的 book_source 与整体不同，创建或切换到对应词书
                    let rowBookId = bookId;
                    if (bookSource && bookSource !== (options.bookSource || '')) {
                        const foundBookId = await this._ensureBook(bookSource);
                        if (foundBookId) rowBookId = foundBookId;
                    }

                    if (!word) {
                        result.errors.push(`第 ${i + 1} 行：单词为空`);
                        continue;
                    }

                    // ★ v5 多归属处理：重复单词不再简单跳过 → 追加到 book_ids
                    const existing = await WordDB.findWordByText(word);
                    if (existing) {
                        // 如果当前导入的词书 ID 不在已有 book_ids 中，追加归属
                        const currentIds = WordModel.getBookIds(existing);
                        if (!currentIds.includes(rowBookId)) {
                            currentIds.push(rowBookId);
                            await WordDB.updateWord(existing.id, { book_ids: currentIds });
                            result.multiTagged++;
                        }

                        // 可选：补充释义（如果原有释义为空）
                        if (options.onDuplicate === 'overwrite') {
                            const updateData = {};
                            if (!existing.definition || existing.definition === '(无释义)') {
                                updateData.definition = definition;
                            }
                            if (Object.keys(updateData).length > 0) {
                                await WordDB.updateWord(existing.id, updateData);
                            }
                        }
                        
                        result.skipped++;
                        continue;
                    }

                    await WordDB.addWord({
                        word, definition, category, unit,
                        book_id: rowBookId,
                        book_ids: [rowBookId],
                        book_source: bookSource || options.bookSource || '导入词库'
                    });
                    result.success++;
                } catch (err) {
                    result.errors.push(`第 ${i + 1} 行：${err.message}`);
                }
            }
        } catch (err) {
            result.errors.push(`解析失败：${err.message}`);
        }

        return result;
    }

    /**
     * 检测第一行是否为表头（包含 word 和 definition 列名）
     */
    static _detectHeader(fields) {
        const lower = fields.map(f => f.trim().toLowerCase());
        return lower.includes('word') && lower.includes('definition');
    }

    /**
     * 生成 CSV 模板文件（含表头和一行示例数据）
     * @returns {string} CSV 文本
     */
    static generateTemplateCSV() {
        const header = 'word,definition,category,unit,book_source';
        const example = 'example,示例单词 n. 示例；范例,自定义,1,我的词书';
        return header + '\n' + example + '\n\n# 列说明：\n' +
            '# word       — 必填，英文单词\n' +
            '# definition — 必填，中文释义（如含逗号，请用双引号括起）\n' +
            '# category   — 可选，默认"其他"，如：雅思、托福、考研、四级、六级\n' +
            '# unit       — 可选，默认1，相同编号的单词归为一个单元\n' +
            '# book_source — 可选，默认使用文件名，系统自动创建同名词书\n';
    }

    /**
     * 解析 JSON 文本
     * 
     * v5: 多词书重复导入时追加 book_ids，而非简单跳过
     */
    static async parseJSON(jsonText, options = {}) {
        const result = { success: 0, skipped: 0, multiTagged: 0, errors: [], createdBookId: null, bookName: '' };

        try {
            const data = JSON.parse(jsonText);
            const wordsArray = Array.isArray(data) ? data : (data.words || data.data || []);

            if (!Array.isArray(wordsArray) || wordsArray.length === 0) {
                result.errors.push('JSON 格式无效');
                return result;
            }

            // 确定目标词书
            let bookId = options.targetBookId || null;
            if (!bookId && options.bookSource) {
                bookId = await this._ensureBook(options.bookSource);
                if (bookId) {
                    result.createdBookId = bookId;
                    result.bookName = options.bookSource;
                }
            }
            if (!bookId) bookId = 1;

            for (let i = 0; i < wordsArray.length; i++) {
                try {
                    const item = wordsArray[i];
                    if (!item.word) {
                        result.errors.push(`第 ${i + 1} 条：缺少 word`);
                        continue;
                    }

                    // ★ v5 多归属处理
                    const existing = await WordDB.findWordByText(item.word);
                    if (existing) {
                        const currentIds = WordModel.getBookIds(existing);
                        if (!currentIds.includes(bookId)) {
                            currentIds.push(bookId);
                            await WordDB.updateWord(existing.id, { book_ids: currentIds });
                            result.multiTagged++;
                        }

                        // 可选：补充释义
                        if (options.onDuplicate === 'overwrite') {
                            const updateData = {};
                            if (!existing.definition || existing.definition === '(无释义)') {
                                updateData.definition = item.definition || existing.definition;
                            }
                            if (Object.keys(updateData).length > 0) {
                                await WordDB.updateWord(existing.id, updateData);
                            }
                        }
                        result.skipped++;
                        continue;
                    }

                    await WordDB.addWord({
                        word: item.word,
                        definition: item.definition || '',
                        category: item.category || '其他',
                        unit: item.unit || 1,
                        book_id: bookId,
                        book_ids: [bookId],
                        book_source: options.bookSource || '导入词库'
                    });
                    result.success++;
                } catch (err) {
                    result.errors.push(`第 ${i + 1} 条：${err.message}`);
                }
            }
        } catch (err) {
            result.errors.push(`JSON 解析失败：${err.message}`);
        }

        return result;
    }

    /**
     * 确保词书存在，不存在则自动创建
     */
    static async _ensureBook(bookName) {
        if (!bookName) return null;
        const books = await WordDB.getBooks();
        const existing = books.find(b => b.name === bookName);
        if (existing) return existing.id;
        // 自动创建
        const newId = await WordDB.addBook({ name: bookName, description: `从 ${bookName} 导入的词书` });
        return newId;
    }

    static _parseCSVLine(line) {
        const fields = [];
        let current = '';
        let inQuotes = false;
        for (let i = 0; i < line.length; i++) {
            const ch = line[i];
            if (ch === '"') {
                inQuotes = !inQuotes;
            } else if (ch === ',' && !inQuotes) {
                fields.push(current);
                current = '';
            } else {
                current += ch;
            }
        }
        fields.push(current);
        return fields;
    }

    /**
     * 导出全部单词为 JSON
     */
    static async exportToJSON() {
        const allWords = await WordDB.getAllWords();
        return JSON.stringify({
            exportDate: new Date().toISOString(),
            totalWords: allWords.length,
            app: 'WordWiz',
            words: allWords.map(w => ({
                word: w.word,
                definition: w.definition,
                category: w.category,
                unit: w.unit,
                book_id: w.book_id,
                book_ids: w.book_ids,
                familiarity: w.familiarity,
                is_favorite: w.is_favorite
            }))
        }, null, 2);
    }

    /**
     * 导出全部单词为 CSV
     */
    static async exportToCSV() {
        const allWords = await WordDB.getAllWords();
        const header = 'word,definition,category,unit,book_id,familiarity,is_favorite';
        const rows = allWords.map(w => {
            const def = `"${(w.definition || '').replace(/"/g, '""')}"`;
            return `${w.word},${def},${w.category},${w.unit},${w.book_id || 1},${w.familiarity},${w.is_favorite ? 1 : 0}`;
        });
        return [header, ...rows].join('\n');
    }

    // ===================== 收藏夹导出 =====================

    /**
     * 导出收藏夹单词为 JSON
     * @param {string} category - 分类筛选
     */
    static async exportFavoritesToJSON(category) {
        const words = await WordDB.getFavoriteWords(category);
        return JSON.stringify({
            exportDate: new Date().toISOString(),
            totalWords: words.length,
            app: 'WordWiz',
            type: 'favorites',
            words: words.map(w => ({
                word: w.word,
                definition: w.definition,
                category: w.category,
                unit: w.unit,
                book_source: w.book_source,
                familiarity: w.familiarity
            }))
        }, null, 2);
    }

    /**
     * 导出收藏夹单词为 CSV
     * @param {string} category - 分类筛选
     */
    static async exportFavoritesToCSV(category) {
        const words = await WordDB.getFavoriteWords(category);
        const header = 'word,definition,category,unit,familiarity';
        const rows = words.map(w => {
            const def = `"${(w.definition || '').replace(/"/g, '""')}"`;
            return `${w.word},${def},${w.category},${w.unit},${w.familiarity}`;
        });
        return [header, ...rows].join('\n');
    }

    // ===================== 错题本导出 =====================

    /**
     * 导出错题本单词为 JSON
     */
    static async exportWrongWordsToJSON() {
        const words = await WordDB.getSetting('challenge_wrong_words', []);
        return JSON.stringify({
            exportDate: new Date().toISOString(),
            totalWords: words.length,
            app: 'WordWiz',
            type: 'wrong-words',
            words: words.map(w => ({
                word: w.word,
                definition: w.definition,
                category: w.category,
                book_source: w.book_source,
                wrongDate: w.date
            }))
        }, null, 2);
    }

    /**
     * 导出错题本单词为 CSV
     */
    static async exportWrongWordsToCSV() {
        const words = await WordDB.getSetting('challenge_wrong_words', []);
        const header = 'word,definition,category,wrong_date';
        const rows = words.map(w => {
            const def = `"${(w.definition || '').replace(/"/g, '""')}"`;
            const date = w.date ? new Date(w.date).toLocaleDateString('zh-CN') : '';
            return `${w.word},${def},${w.category},${date}`;
        });
        return [header, ...rows].join('\n');
    }
    // ===================== 完整学习进度导出/导入 =====================

    /**
     * 导出全部学习进度（含所有数据，用于跨设备同步）
     * 包含：单词、词书、设置、统计、成就、挑战历史、错题集
     */
    static async exportFullProgress() {
        const allWords = await WordDB.getAllWords();
        const allBooks = await WordDB.getBooks();
        const allSettings = await WordDB.getAllSettings();
        const allStats = await WordDB.getAllStats();
        const activeBookIds = await WordDB.getActiveBookIds();

        // 成就状态
        const achievements = {};
        const achievementKeys = [
            'achievement_challenge_count',
            'achievement_first_completed',
            'achievement_perfect_count',
            'achievement_speed_count',
            'achievement_streak_count',
            'achievement_fav_count',
            'achievement_trash_cleaned',
            'achievement_familiar_count',
            'achievement_type_count',
            'achievement_words_learned'
        ];
        for (const key of achievementKeys) {
            achievements[key] = await WordDB.getSetting(key, 0);
        }

        // 挑战历史
        const challengeHistory = await WordDB.getSetting('challenge_history', []);
        const wrongWords = await WordDB.getSetting('challenge_wrong_words', []);
        const recentWords = await WordDB.getSetting('challenge_recent_words', []);

        // 收藏夹导出额外信息
        const favoriteWords = await WordDB.getFavoriteWords('全部');

        return JSON.stringify({
            exportDate: new Date().toISOString(),
            app: 'WordWiz',
            version: '1.0.0',
            type: 'full-progress',

            // 词书
            books: allBooks.map(b => ({
                name: b.name,
                description: b.description || '',
                is_system: b.is_system || false
            })),

            // 激活词书 IDs (按名称引用)
            activeBookNames: allBooks
                .filter(b => activeBookIds.includes(b.id))
                .map(b => b.name),

            // 单词
            words: allWords.map(w => ({
                word: w.word,
                definition: w.definition,
                category: w.category,
                unit: w.unit,
                book_name: w.book_source || '',
                familiarity: w.familiarity || 0,
                is_favorite: w.is_favorite || false,
                due_date: w.due_date || null,
                created_at: w.created_at
            })),

            // 设置
            settings: allSettings,

            // 学习统计
            stats: allStats,

            // 成就
            achievements: achievements,

            // 挑战记录
            challenge_history: challengeHistory,
            wrong_words: wrongWords,
            challenge_recent_words: recentWords,

            // 收藏单词总数
            favorite_count: favoriteWords.length
        }, null, 2);
    }

    /**
     * 导入完整学习进度
     * @param {string} jsonText - 导出的 JSON 文本
     * @returns {{success: boolean, message: string, details: object}}
     */
    static async importFullProgress(jsonText) {
        const result = { success: false, message: '', details: { wordsImported: 0, booksImported: 0, settingsImported: 0, statsImported: 0 } };

        try {
            const data = JSON.parse(jsonText);

            // 校验
            if (!data || data.type !== 'full-progress') {
                result.message = '无效的备份文件：格式不正确';
                return result;
            }

            // 1. 导入词书（先词书后单词，因为单词依赖词书）
            const bookNameMap = {}; // 旧名称 → 新 ID
            if (data.books && data.books.length > 0) {
                for (const book of data.books) {
                    const existingBooks = await WordDB.getBooks();
                    let existing = existingBooks.find(b => b.name === book.name);
                    if (!existing) {
                        const newId = await WordDB.addBook({
                            name: book.name,
                            description: book.description || '',
                            is_system: book.is_system || false
                        });
                        bookNameMap[book.name] = newId;
                    } else {
                        bookNameMap[book.name] = existing.id;
                    }
                    result.details.booksImported++;
                }
            }

            // 2. 导入单词
            if (data.words && data.words.length > 0) {
                const books = await WordDB.getBooks();
                const defaultBookId = books.length > 0 ? books[0].id : 1;

                for (const w of data.words) {
                    // 确定归属词书 ID
                    let bookId = defaultBookId;
                    if (w.book_name && bookNameMap[w.book_name]) {
                        bookId = bookNameMap[w.book_name];
                    } else if (w.book_name) {
                        // 尝试按名称查找
                        const found = books.find(b => b.name === w.book_name);
                        if (found) bookId = found.id;
                    }

                    // 去重：按单词名查找
                    const existing = await WordDB.findWordByText(w.word);
                    if (existing) {
                        // 已有则更新熟悉度、收藏、due_date
                        const updateData = {};
                        if (w.familiarity !== undefined && w.familiarity > (existing.familiarity || 0)) {
                            updateData.familiarity = w.familiarity;
                        }
                        if (w.is_favorite) {
                            updateData.is_favorite = true;
                        }
                        if (w.due_date && (!existing.due_date || w.due_date > existing.due_date)) {
                            updateData.due_date = w.due_date;
                        }
                        // 追加词书归属
                        const currentBookIds = WordModel.getBookIds(existing);
                        if (!currentBookIds.includes(bookId)) {
                            currentBookIds.push(bookId);
                            updateData.book_ids = currentBookIds;
                        }
                        if (Object.keys(updateData).length > 0) {
                            await WordDB.updateWord(existing.id, updateData);
                        }
                    } else {
                        // 新单词
                        await WordDB.addWord({
                            word: w.word,
                            definition: w.definition || '',
                            category: w.category || '其他',
                            unit: w.unit || 1,
                            book_id: bookId,
                            book_ids: [bookId],
                            book_source: w.book_name || '导入词库',
                            familiarity: w.familiarity || 0,
                            is_favorite: w.is_favorite || false,
                            due_date: w.due_date || null,
                            created_at: w.created_at || new Date().toISOString()
                        });
                    }
                    result.details.wordsImported++;
                }
            }

            // 3. 导入设置（非覆盖，只补充缺失项）
            if (data.settings && data.settings.length > 0) {
                for (const s of data.settings) {
                    const existing = await WordDB.getSetting(s.key, null);
                    if (existing === null) {
                        await WordDB.saveSetting(s.key, s.value);
                        result.details.settingsImported++;
                    }
                }
            }

            // 4. 导入成就
            if (data.achievements) {
                for (const [key, value] of Object.entries(data.achievements)) {
                    const existing = await WordDB.getSetting(key, 0);
                    if (value > existing) {
                        await WordDB.saveSetting(key, value);
                    }
                }
            }

            // 5. 导入挑战历史（合并去重）
            if (data.challenge_history && data.challenge_history.length > 0) {
                const existing = await WordDB.getSetting('challenge_history', []);
                const existingDates = new Set(existing.map(h => h.date + h.correct + h.total));
                const newItems = data.challenge_history.filter(h => !existingDates.has(h.date + h.correct + h.total));
                if (newItems.length > 0) {
                    await WordDB.saveSetting('challenge_history', [...existing, ...newItems]);
                }
            }

            // 6. 导入错题集（合并去重）
            if (data.wrong_words && data.wrong_words.length > 0) {
                const existing = await WordDB.getSetting('challenge_wrong_words', []);
                const existingIds = new Set(existing.map(w => w.wordId));
                const newWords = data.wrong_words.filter(w => !existingIds.has(w.wordId));
                if (newWords.length > 0) {
                    const merged = [...existing, ...newWords];
                    // 限制最多 200 条
                    if (merged.length > 200) merged.splice(0, merged.length - 200);
                    await WordDB.saveSetting('challenge_wrong_words', merged);
                }
            }

            // 7. 导入学习统计
            if (data.stats && data.stats.length > 0) {
                const existing = await WordDB.getAllStats();
                const existingDates = new Set(existing.map(s => s.date + s.type));
                const newStats = data.stats.filter(s => !existingDates.has(s.date + s.type));
                for (const s of newStats) {
                    await WordDB.addStat({
                        date: s.date,
                        type: s.type,
                        value: s.value || 0,
                        count: s.count || 0
                    });
                    result.details.statsImported++;
                }
            }

            // 8. 设置激活词书
            if (data.activeBookNames && data.activeBookNames.length > 0) {
                const books = await WordDB.getBooks();
                const activeIds = data.activeBookNames
                    .map(name => books.find(b => b.name === name))
                    .filter(Boolean)
                    .map(b => b.id);
                if (activeIds.length > 0) {
                    await WordDB.saveActiveBookIds(activeIds);
                }
            }

            result.success = true;
            result.message = '导入完成！';
        } catch (err) {
            result.message = '导入失败：' + err.message;
        }

        return result;
    }

}

window.WordParser = WordParser;

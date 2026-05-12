/**
 * WordWiz - CSV/JSON 词库解析工具
 * 
 * v3 新增：
 * - 支持 targetBookId 参数
 * - 自动创建词书（如果指定了 bookSource 且不存在）
 * - 结果返回 createdBookId / bookName
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
        const result = { success: 0, skipped: 0, errors: [], createdBookId: null, bookName: '' };

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

                    // 去重检测
                    const existing = await WordDB.findWordByText(word);
                    if (existing) {
                        if (options.onDuplicate === 'overwrite') {
                            await WordDB.updateWord(existing.id, {
                                definition, category, unit, book_id: rowBookId
                            });
                            result.success++;
                        } else {
                            result.skipped++;
                        }
                        continue;
                    }

                    await WordDB.addWord({
                        word, definition, category, unit,
                        book_id: rowBookId,
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
     */
    static async parseJSON(jsonText, options = {}) {
        const result = { success: 0, skipped: 0, errors: [], createdBookId: null, bookName: '' };

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

                    const existing = await WordDB.findWordByText(item.word);
                    if (existing) {
                        if (options.onDuplicate === 'overwrite') {
                            await WordDB.updateWord(existing.id, {
                                definition: item.definition || existing.definition,
                                category: item.category || existing.category,
                                unit: item.unit || existing.unit,
                                book_id: bookId
                            });
                            result.success++;
                        } else {
                            result.skipped++;
                        }
                        continue;
                    }

                    await WordDB.addWord({
                        word: item.word,
                        definition: item.definition || '',
                        category: item.category || '其他',
                        unit: item.unit || 1,
                        book_id: item.book_id || bookId,
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
}

window.WordParser = WordParser;

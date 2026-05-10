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
     * 解析 CSV 文本
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
            if (!bookId) bookId = 1; // 默认通用基础词书

            const startIndex = options.hasHeader !== false ? 1 : 0;
            
            for (let i = startIndex; i < lines.length; i++) {
                try {
                    const line = lines[i].trim();
                    if (!line) continue;
                    
                    const fields = this._parseCSVLine(line);
                    if (fields.length < 2) {
                        result.errors.push(`第 ${i + 1} 行格式错误`);
                        continue;
                    }

                    const word = fields[0].trim();
                    const definition = fields[1].trim();
                    const category = fields[2] ? fields[2].trim() : '其他';
                    const unit = fields[3] ? parseInt(fields[3].trim()) || 1 : 1;

                    if (!word) {
                        result.errors.push(`第 ${i + 1} 行：单词为空`);
                        continue;
                    }

                    // 去重检测（同一词书内）
                    const existing = await WordDB.findWordByText(word);
                    if (existing) {
                        if (options.onDuplicate === 'overwrite') {
                            await WordDB.updateWord(existing.id, {
                                definition, category, unit, book_id: bookId
                            });
                            result.success++;
                        } else {
                            result.skipped++;
                        }
                        continue;
                    }

                    await WordDB.addWord({
                        word, definition, category, unit,
                        book_id: bookId,
                        book_source: options.bookSource || '导入词库'
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
}

window.WordParser = WordParser;

/**
 * WordWiz - 单词数据模型
 * 
 * 每个单词包含以下字段：
 * - id: 自增主键
 * - word: 英文单词
 * - definition: 中文释义（可包含词性、例句等）
 * - category: 分类（四级、六级、半导体专业、其他）
 * - unit: 所属单元（每单元 100 词）
 * - familiarity: 熟悉度 0~5，初始 0
 * - is_favorite: 是否收藏
 * - book_source: 来源词库名称
 * - deleted_at: 删除时间（null 表示未删除，用于回收站）
 * - created_at: 创建时间
 */

class WordModel {
    /**
     * 创建一个 Word 对象
     * @param {object} params - 单词参数
     * @param {number} [params.id] - 主键（新记录不传，让 DB 自增）
     * @param {string} params.word - 英文单词
     * @param {string} params.definition - 中文释义
     * @param {string} [params.category='四级'] - 分类
     * @param {number} [params.unit=1] - 所属单元
     * @param {number} [params.book_id=1] - 所属词书 ID（默认通用基础词书）
     * @param {number} [params.familiarity=0] - 熟悉度 0-5
     * @param {boolean} [params.is_favorite=false] - 是否收藏
     * @param {string} [params.book_source='内置词库'] - 来源词书名称
     * @param {string|null} [params.deleted_at=null] - 软删除时间
     * @param {string|null} [params.created_at=null] - 创建时间
     */
    static create({ id, word, definition, category = '四级', unit = 1, book_id = 1,
                     familiarity = 0, is_favorite = false, book_source = '内置词库',
                     deleted_at = null, created_at = null } = {}) {
        const record = {
            word: word || '',
            definition: definition || '',
            category: category || '四级',
            unit: unit || 1,
            book_id: book_id || 1,
            familiarity: Math.min(5, Math.max(0, familiarity || 0)),
            is_favorite: !!is_favorite,
            book_source: book_source || '内置词库',
            deleted_at: deleted_at || null,
            created_at: created_at || new Date().toISOString()
        };
        if (id !== undefined) {
            record.id = id;
        }
        return record;
    }

    /**
     * 从数据库行记录转换为 Word 对象（带容错）
     */
    static fromRow(row) {
        if (!row) return null;
        try {
            return WordModel.create({
                id: row.id,
                word: row.word,
                definition: row.definition || '',
                category: row.category || '其他',
                unit: row.unit || 1,
                book_id: row.book_id || 1,
                familiarity: row.familiarity !== undefined ? row.familiarity : 0,
                is_favorite: row.is_favorite === 1 || row.is_favorite === true,
                book_source: row.book_source || '内置词库',
                deleted_at: row.deleted_at || null,
                created_at: row.created_at || new Date().toISOString()
            });
        } catch (e) {
            console.warn('WordModel.fromRow 转换失败:', e, row);
            return null;
        }
    }

    /**
     * 获取熟悉度等级的中文标签
     */
    static getFamiliarityLabel(familiarity) {
        const labels = ['陌生', '见过', '模糊', '认识', '熟悉', '掌握'];
        return labels[Math.min(5, Math.max(0, familiarity))];
    }
}

// 导出到全局
window.WordModel = WordModel;

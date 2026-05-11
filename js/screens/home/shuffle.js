/**
 * WordWiz - 全局混序工具模块
 * 
 * 负责：
 * - 生成混序排列（单元顺序 + 单词顺序）
 * - 按混序排列获取有序数据
 * - 重置混序状态
 * 
 * 数据存储：AppState.home（shuffled / unitOrder / wordOrders）
 * 
 * v5 重写说明：
 * - 混序结果存储在 AppState.home.unitOrder / wordOrders
 * - 生成排列时不修改原始数据，只存 ID 序列
 * - 多次调用不重复随机，按已存排列重排
 * 
 * 使用方：HomePage.render()、HomePage._renderUnits()
 */

class HomeShuffle {
    /**
     * 重置混序状态
     */
    static reset() {
        AppState.home.shuffled = false;
        AppState.home.unitOrder = null;
        AppState.home.wordOrders = {};
    }

    /**
     * 生成混序排列（不修改数据，只生成排列顺序）
     * - 打乱所有单元的排列顺序
     * - 打乱每个单元内单词的排列顺序
     * - 结果存入 AppState.home
     */
    static async generate() {
        const activeBookIds = await WordDB.getActiveBookIds();
        const category = AppState.home.category;
        const words = await WordDB.getWordsByCategory(category, activeBookIds);

        if (words.length === 0) return;

        // 按单元分组
        const unitMap = {};
        words.forEach(w => {
            if (!unitMap[w.unit]) unitMap[w.unit] = [];
            unitMap[w.unit].push(w);
        });

        // Fisher-Yates 打乱单元顺序
        const units = Object.keys(unitMap).sort((a, b) => parseInt(a) - parseInt(b));
        for (let i = units.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [units[i], units[j]] = [units[j], units[i]];
        }
        AppState.home.unitOrder = units;

        // Fisher-Yates 打乱每个单元内的单词顺序（存单词 id 序列）
        const wordOrders = {};
        for (const u of units) {
            const ids = unitMap[u].map(w => w.id);
            for (let i = ids.length - 1; i > 0; i--) {
                const j = Math.floor(Math.random() * (i + 1));
                [ids[i], ids[j]] = [ids[j], ids[i]];
            }
            wordOrders[u] = ids;
        }
        AppState.home.wordOrders = wordOrders;
    }

    /**
     * 判断当前是否有混序状态
     * @returns {boolean}
     */
    static isActive() {
        return AppState.home.shuffled;
    }

    /**
     * 获取混序按钮文本
     * @returns {string}
     */
    static getButtonText() {
        return AppState.home.shuffled ? '🔁 恢复' : '🔀 全局混序';
    }

    /**
     * 按混序排列获取单元顺序
     * @param {string[]} unitKeys 所有单元的 key 列表
     * @returns {string[]} 排序后的单元 key 列表
     */
    static getOrderedUnits(unitKeys) {
        if (AppState.home.shuffled && AppState.home.unitOrder) {
            return [...AppState.home.unitOrder];
        }
        return [...unitKeys].sort((a, b) => parseInt(a) - parseInt(b));
    }

    /**
     * 按混序排列获取单元内单词顺序
     * @param {object[]} unitWords 该单元的单词对象数组
     * @param {number|string} unit 单元号
     * @returns {object[]} 排序后的单词数组
     */
    static getOrderedWords(unitWords, unit) {
        if (!AppState.home.shuffled || !AppState.home.wordOrders || !AppState.home.wordOrders[unit]) {
            return unitWords;
        }
        const orderMap = {};
        AppState.home.wordOrders[unit].forEach((id, idx) => {
            orderMap[id] = idx;
        });
        return [...unitWords].sort((a, b) => {
            const ia = orderMap[a.id];
            const ib = orderMap[b.id];
            if (ia !== undefined && ib !== undefined) return ia - ib;
            if (ia !== undefined) return -1;
            if (ib !== undefined) return 1;
            return 0;
        });
    }
}

window.HomeShuffle = HomeShuffle;
console.log('[WordWiz] shuffle.js 已加载 — HomeShuffle 工具类已定义');

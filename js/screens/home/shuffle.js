/**
 * WordWiz - 首页排序工具模块
 *
 * 负责：
 * - 管理首页排序状态
 * - shuffled 模式下存储和恢复单词 ID 排列
 *
 * 数据存储：AppState.home
 */

class HomeShuffle {
    /**
     * 重置排序状态为默认
     */
    static reset() {
        AppState.home.sortMode = 'default';
        AppState.home.shuffledWords = null;
    }

    /**
     * 设置排序模式并生成 shuffled 排列（如需）
     * @param {string} mode - 排序模式
     * @param {object[]} words - 当前所有单词（用于生成 shuffled 排列）
     */
    static setMode(mode, words) {
        AppState.home.sortMode = mode;
        if (mode === 'shuffled') {
            AppState.home.shuffledWords = WordSorter.shuffle(words).map(w => w.id);
        } else {
            AppState.home.shuffledWords = null;
        }
    }

    /**
     * 获取排序后的单词列表
     * @param {object[]} words - 单词对象数组
     * @returns {object[]} 排序后的单词
     */
    static getSortedWords(words) {
        if (!words || words.length === 0) return [];
        const mode = AppState.home.sortMode || 'default';

        if (mode === 'shuffled' && AppState.home.shuffledWords) {
            // 按存储的顺序还原
            return WordSorter.sort(words, 'shuffled', AppState.home.shuffledWords);
        }

        return WordSorter.sort(words, mode);
    }

    /**
     * 判断当前是否处于 shuffled 模式
     */
    static isShuffled() {
        return AppState.home.sortMode === 'shuffled';
    }
}

window.HomeShuffle = HomeShuffle;
console.log('[WordWiz] shuffle.js 已加载 — HomeShuffle 工具类已更新');

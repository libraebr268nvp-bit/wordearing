/**
 * WordWiz - 通用排序模块
 *
 * 集中管理所有排序逻辑，首页和收藏夹共用
 * 6 种排序模式：
 * - default:     默认顺序（首页按单元分组，收藏夹按入库顺序）
 * - fam-high:    熟悉度从高到低
 * - fam-low:     熟悉度从低到高
 * - alpha-asc:   字母 A-Z
 * - alpha-desc:  字母 Z-A
 * - shuffled:    随机混序（Fisher-Yates 洗牌）
 */

class WordSorter {
    static MODES = ['default', 'fam-high', 'fam-low', 'alpha-asc', 'alpha-desc', 'shuffled'];

    /**
     * 获取排序模式的显示标签
     */
    static getLabel(mode) {
        const labels = {
            'default':    '📋 默认顺序',
            'fam-high':   '📊 熟悉度 ↑',
            'fam-low':    '📊 熟悉度 ↓',
            'alpha-asc':  'A → Z',
            'alpha-desc': 'Z → A',
            'shuffled':   '🎲 随机混序'
        };
        return labels[mode] || '默认顺序';
    }

    /**
     * 获取排序模式的短标签（用于按钮）
     */
    static getShortLabel(mode) {
        const labels = {
            'default':    '📋 默认',
            'fam-high':   '📊 熟悉↑',
            'fam-low':    '📊 熟悉↓',
            'alpha-asc':  'A→Z',
            'alpha-desc': 'Z→A',
            'shuffled':   '🎲 随机'
        };
        return labels[mode] || mode;
    }

    /**
     * 对单词数组进行排序（返回新数组，不修改原数据）
     * @param {object[]} words - 单词对象数组
     * @param {string} mode - 排序模式
     * @param {number[]} [storedOrder] - shuffled 模式下存储的 ID 顺序
     * @returns {object[]} 排序后的新数组
     */
    static sort(words, mode, storedOrder) {
        if (!words || words.length === 0) return [];
        const arr = [...words];

        switch (mode) {
            case 'fam-high':
                return arr.sort((a, b) => (b.familiarity ?? 0) - (a.familiarity ?? 0));

            case 'fam-low':
                return arr.sort((a, b) => (a.familiarity ?? 0) - (b.familiarity ?? 0));

            case 'alpha-asc':
                return arr.sort((a, b) => (a.word || '').localeCompare(b.word || ''));

            case 'alpha-desc':
                return arr.sort((a, b) => (b.word || '').localeCompare(a.word || ''));

            case 'shuffled':
                if (storedOrder && storedOrder.length > 0) {
                    // 按存储的 ID 顺序还原
                    const idMap = {};
                    arr.forEach(w => { idMap[w.id] = w; });
                    const ordered = [];
                    storedOrder.forEach(id => {
                        if (idMap[id]) ordered.push(idMap[id]);
                    });
                    // 补上可能漏掉的新单词
                    arr.forEach(w => {
                        if (!storedOrder.includes(w.id)) ordered.push(w);
                    });
                    return ordered;
                }
                return WordSorter.shuffle(arr);

            default:
                return arr;
        }
    }

    /**
     * Fisher-Yates 洗牌
     * @param {object[]} arr - 数组
     * @returns {object[]} 洗牌后的新数组
     */
    static shuffle(arr) {
        const a = [...arr];
        for (let i = a.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [a[i], a[j]] = [a[j], a[i]];
        }
        return a;
    }

    /**
     * 判断排序模式是否为确定的（非随机），确定模式不需要存储排列
     */
    static isDeterministic(mode) {
        return mode !== 'shuffled';
    }

    /**
     * 渲染排序选择器 HTML（通用）
     * @param {string} currentMode - 当前排序模式
     * @param {function} onChange - 切换时的回调
     * @returns {string} HTML 字符串
     */
    static renderSelector(currentMode, onChange) {
        const html = `
            <div class="sort-group">
                <span class="sort-label">排序：</span>
                ${WordSorter.MODES.map(mode => `
                    <button class="sort-btn ${mode === currentMode ? 'active' : ''}" data-sort="${mode}">
                        ${WordSorter.getShortLabel(mode)}
                    </button>
                `).join('')}
            </div>
        `;
        return html;
    }

    /**
     * 绑定排序选择器事件
     * @param {HTMLElement} container - 包含排序按钮的容器
     * @param {function} onChange - (mode) => void
     */
    static bindSelector(container, onChange) {
        container.querySelectorAll('.sort-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const mode = btn.dataset.sort;
                container.querySelectorAll('.sort-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                if (onChange) onChange(mode);
            });
        });
    }
}

window.WordSorter = WordSorter;

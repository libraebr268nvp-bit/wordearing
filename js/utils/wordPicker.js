/**
 * WordWiz - 智能抽题算法
 * 
 * 基于熟悉度的加权随机选择：
 * - 越不熟悉的词被抽中的概率越高
 * - 熟悉度5（已掌握）几乎不会被抽到
 * - 支持排除冷却中的词
 */
class WordPicker {
    /**
     * 计算单词的抽题权重
     * 权重 = 1 / (familiarity + 1)^2
     * 熟悉度0 → 权重1.0   (最高概率)
     * 熟悉度1 → 权重0.25
     * 熟悉度2 → 权重0.11
     * 熟悉度3 → 权重0.06
     * 熟悉度4 → 权重0.04
     * 熟悉度5 → 权重0.027 (几乎不抽)
     */
    static getWeight(familiarity) {
        return 1 / Math.pow((familiarity || 0) + 1, 2);
    }

    /**
     * 从单词池中加权随机选择指定数量的单词
     * 规则：
     * - 排除冷却中的词（excludeIds）
     * - 排除熟悉度5（已掌握）的单词
     * - 越不熟悉的词权重越高
     * @param {Array} wordPool - 单词对象数组
     * @param {number} count - 需要抽取的数量
     * @param {Set} excludeIds - 需要排除的单词ID集合
     * @returns {Array} 选中的单词数组
     */
    static pickWeighted(wordPool, count, excludeIds = new Set()) {
        // 排除不需要的词 + 排除已掌握(fam>=5)的词
        let candidates = wordPool.filter(w => 
            !excludeIds.has(w.id) && (w.familiarity || 0) < 5
        );
        if (candidates.length === 0) return [];

        // 计算总权重
        const totalWeight = candidates.reduce((sum, w) => sum + this.getWeight(w.familiarity), 0);

        const result = [];
        const used = new Set();

        for (let i = 0; i < count && i < candidates.length; i++) {
            // 加权随机选一个
            let pick = null;
            const attempts = Math.min(20, candidates.length);

            for (let a = 0; a < attempts; a++) {
                let rand = Math.random() * totalWeight;
                for (const w of candidates) {
                    if (used.has(w.id)) continue;
                    rand -= this.getWeight(w.familiarity);
                    if (rand <= 0) {
                        pick = w;
                        break;
                    }
                }
                if (pick) break;
            }

            // 兜底：选第一个未使用的
            if (!pick) {
                pick = candidates.find(w => !used.has(w.id));
            }

            if (pick) {
                used.add(pick.id);
                result.push(pick);
            }
        }

        return result;
    }

    /**
     * 获取熟悉度标签
     */
    static getFamiliarityLabel(fam) {
        if (fam >= 5) return { text: '已掌握', cls: 'fam-master' };
        if (fam >= 3) return { text: `熟悉 ${fam}/5`, cls: 'fam-high' };
        if (fam >= 1) return { text: `生疏 ${fam}/5`, cls: 'fam-mid' };
        return { text: '陌生 0/5', cls: 'fam-low' };
    }

    static _shuffle(arr) {
        const a = [...arr];
        for (let i = a.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [a[i], a[j]] = [a[j], a[i]];
        }
        return a;
    }
}

window.WordPicker = WordPicker;

/**
 * WordWiz - 单元卡片组件
 * 
 * 每个单元为一个可折叠卡片，包含该单元所有单词的列表
 */

class UnitCard {
    /**
     * 渲染一个单元卡片
     * @param {number} unit - 单元编号
     * @param {Array} words - 该单元的单词列表
     * @param {object} options - 配置项
     * @returns {HTMLElement} 单元卡片元素
     */
    static render(unit, words, options = {}) {
        const card = document.createElement('div');
        card.className = 'unit-card';
        card.dataset.unit = unit;

        // 存储原始顺序用于混序重置
        if (options.shuffled) {
            card._shuffled = true;
        }

        // 标题栏
        const header = document.createElement('div');
        header.className = 'unit-header';
        header.innerHTML = `
            <div class="unit-title">
                📦 Unit ${unit}
                <span class="unit-count">· ${words.length} 词</span>
            </div>
            <div class="unit-actions">
                <button class="unit-shuffle-btn">🔀 混序</button>
            </div>
        `;

        // 单词列表容器
        const listContainer = document.createElement('div');
        listContainer.className = 'word-list';

        // 渲染单词
        words.forEach(word => {
            const wordRow = WordCard.render(word, {
                onUpdate: options.onUpdate || (() => {})
            });
            listContainer.appendChild(wordRow);
        });

        // 点击标题展开/收起
        let expanded = true;
        header.addEventListener('click', (e) => {
            // 如果点击的是按钮则忽略
            if (e.target.closest('.unit-actions')) return;
            expanded = !expanded;
            listContainer.style.display = expanded ? '' : 'none';
        });

        card.appendChild(header);
        card.appendChild(listContainer);

        // 混序按钮逻辑
        const shuffleBtn = header.querySelector('.unit-shuffle-btn');
        shuffleBtn.addEventListener('click', async (e) => {
            e.stopPropagation();
            const items = [...listContainer.querySelectorAll('.word-item')];
            
            // 如果已经混序了，恢复原始顺序
            if (card._shuffled && card._originalOrder) {
                // 恢复原始顺序
                card._shuffled = false;
                shuffleBtn.textContent = '🔀 混序';
                items.sort((a, b) => {
                    const idxA = card._originalOrder.indexOf(parseInt(a.dataset.id));
                    const idxB = card._originalOrder.indexOf(parseInt(b.dataset.id));
                    return idxA - idxB;
                });
                window.Toast.show('已恢复原始顺序');
            } else {
                // 保存原始顺序
                if (!card._originalOrder) {
                    card._originalOrder = items.map(item => parseInt(item.dataset.id));
                }
                // Fisher-Yates 洗牌算法
                for (let i = items.length - 1; i > 0; i--) {
                    const j = Math.floor(Math.random() * (i + 1));
                    [items[i], items[j]] = [items[j], items[i]];
                }
                card._shuffled = true;
                shuffleBtn.textContent = '🔁 恢复';
                window.Toast.show('🔀 已混序排列');
            }

            // 重新添加到容器
            items.forEach(item => listContainer.appendChild(item));
        });

        return card;
    }
}

window.UnitCard = UnitCard;

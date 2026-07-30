/**
 * WordWiz - 单词卡片组件
 * 
 * 负责渲染单个单词行，包含熟悉、收藏、删除操作按钮
 */

class WordCard {
    /**
     * 渲染一个单词行
     * @param {object} word - 单词对象
     * @param {object} options - 配置项
     * @returns {HTMLElement} 单词行元素
     */
    static render(word, options = {}) {
        const row = document.createElement('div');
        row.className = 'word-item';
        row.dataset.id = word.id;

        // 熟悉度小圆点
        const dots = document.createElement('div');
        dots.className = 'familiarity-dots';
        for (let i = 0; i < 5; i++) {
            const dot = document.createElement('span');
            dot.className = `fam-dot ${i < word.familiarity ? 'filled' : ''}`;
            dots.appendChild(dot);
        }
        row.appendChild(dots);

        // 单词文本
        const wordText = document.createElement('span');
        wordText.className = 'word-text';
        wordText.textContent = word.word;
        row.appendChild(wordText);

        // 释义
        const def = document.createElement('span');
        def.className = 'word-definition';
        def.textContent = word.definition;
        row.appendChild(def);

        // 操作按钮组
        const actions = document.createElement('div');
        actions.className = 'word-actions';

        // 熟悉度5：显示已掌握标签，隐藏操作按钮
        const isMastered = (word.familiarity || 0) >= 5;
        
        if (!isMastered) {
            // 熟悉按钮
            const famBtn = document.createElement('button');
            famBtn.className = 'action-btn familiar';
            famBtn.title = `熟悉度: ${WordModel.getFamiliarityLabel(word.familiarity)}`;
            famBtn.textContent = '✓';
            famBtn.addEventListener('click', async (e) => {
                e.stopPropagation();
                const updated = await WordDB.increaseFamiliarity(word.id);
                if (updated) {
                    const newDots = row.querySelector('.familiarity-dots');
                    if (newDots) {
                        newDots.innerHTML = '';
                        for (let i = 0; i < 5; i++) {
                            const dot = document.createElement('span');
                            dot.className = `fam-dot ${i < updated.familiarity ? 'filled' : ''}`;
                            newDots.appendChild(dot);
                        }
                    }
                    famBtn.title = `熟悉度: ${WordModel.getFamiliarityLabel(updated.familiarity)}`;
                    window.Toast.show(`✓ "${updated.word}" 熟悉度 +1`);
                    await AchievementHelper.recordStudy();
                    if (options.onUpdate) options.onUpdate();
                }
            });
            actions.appendChild(famBtn);
        }

        // 如果是已掌握（熟悉度5），在单词文本后加标签
        if (isMastered) {
            const masterTag = document.createElement('span');
            masterTag.style.cssText = 'font-size:11px;padding:2px 8px;border-radius:4px;background:rgba(167,139,250,0.15);color:var(--accent-purple);margin-left:6px;flex-shrink:0;';
            masterTag.textContent = '🌟 已掌握';
            row.insertBefore(masterTag, actions);
        }

        // 收藏按钮
        const favBtn = document.createElement('button');
        favBtn.className = `action-btn favorite ${word.is_favorite ? 'favorited' : ''}`;
        favBtn.title = word.is_favorite ? '取消收藏' : '收藏';
        favBtn.textContent = '⭐';
        favBtn.addEventListener('click', async (e) => {
            e.stopPropagation();
            const updated = await WordDB.toggleFavorite(word.id);
            if (updated) {
                favBtn.classList.toggle('favorited');
                favBtn.title = updated.is_favorite ? '取消收藏' : '收藏';
                window.Toast.show(updated.is_favorite ? '⭐ 已收藏' : '已取消收藏');
                // 成就：检测收藏 50 个
                await AchievementHelper.checkFiftyFavorites();
                if (options.onUpdate) options.onUpdate();
            }
        });
        actions.appendChild(favBtn);

        // 删除按钮
        const delBtn = document.createElement('button');
        delBtn.className = 'action-btn delete';
        delBtn.title = '删除';
        delBtn.textContent = '✕';
        delBtn.addEventListener('click', async (e) => {
            e.stopPropagation();
            if (confirm(`确定要将 "${word.word}" 移入回收站？`)) {
                await WordDB.softDeleteWord(word.id);
                row.classList.add('deleted');
                row.style.display = 'none';
                window.Toast.show(`🗑️ "${word.word}" 已移入回收站`);
                if (options.onUpdate) options.onUpdate();
            }
        });
        actions.appendChild(delBtn);

        row.appendChild(actions);
        return row;
    }
}

window.WordCard = WordCard;

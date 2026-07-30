/**
 * WordWiz - Quizlet 风格翻转闪卡组件
 * 
 * 点击卡片翻转，正面显示英文，背面显示中文释义
 * 支持左右切换、熟悉度标记、收藏
 */
class FlashcardViewer {
    /**
     * 渲染闪卡学习器
     * @param {HTMLElement} container - 容器元素
     * @param {Array} words - 单词列表
     * @param {object} options - 配置项
     *   onUpdate - 数据更新回调
     */
    static render(container, words, options = {}) {
        if (!words || words.length === 0) {
            container.innerHTML = '<div class="empty-state"><div class="empty-icon">📭</div><div class="empty-text">暂无单词</div></div>';
            return;
        }

        let currentIndex = 0;
        let isFlipped = false;

        const wrapper = document.createElement('div');
        wrapper.className = 'flashcard-container';

        const renderCard = () => {
            const word = words[currentIndex];
            if (!word) return;

            wrapper.innerHTML = `
                <div class="flashcard ${isFlipped ? 'flipped' : ''}" id="flashcardEl">
                    <div class="flashcard-inner">
                        <div class="flashcard-front">
                            <div class="flashcard-word">${word.word}</div>
                            <div class="flashcard-hint">👆 点击翻转查看释义</div>
                        </div>
                        <div class="flashcard-back">
                            <div class="flashcard-definition">${word.definition || '(无释义)'}</div>
                            <div class="flashcard-hint" style="margin-top:12px;">👆 点击翻回</div>
                        </div>
                    </div>
                </div>
                <div class="flashcard-progress">${currentIndex + 1} / ${words.length}</div>
                <div class="flashcard-nav">
                    <button class="flashcard-nav-btn" id="flashcardPrev">◀</button>
                    <div style="display:flex;gap:8px;">
                        <button class="flashcard-action-btn dunno" id="flashcardDunno">😓 不认识</button>
                        <button class="flashcard-action-btn know" id="flashcardKnow">😊 认识</button>
                    </div>
                    <button class="flashcard-nav-btn" id="flashcardNext">▶</button>
                </div>
            `;

            // 绑定点击翻转
            const cardEl = wrapper.querySelector('#flashcardEl');
            cardEl.addEventListener('click', (e) => {
                if (e.target.closest('.flashcard-nav-btn') || e.target.closest('.flashcard-action-btn')) return;
                isFlipped = !isFlipped;
                cardEl.classList.toggle('flipped');
            });

            // 前一个
            const prevBtn = wrapper.querySelector('#flashcardPrev');
            prevBtn.addEventListener('click', () => {
                if (currentIndex > 0) {
                    currentIndex--;
                    isFlipped = false;
                    renderCard();
                } else {
                    window.Toast.show('已是第一个');
                }
            });

            // 后一个
            const nextBtn = wrapper.querySelector('#flashcardNext');
            nextBtn.addEventListener('click', () => {
                if (currentIndex < words.length - 1) {
                    currentIndex++;
                    isFlipped = false;
                    renderCard();
                } else {
                    window.Toast.show('🎉 已全部看完！');
                }
            });

            // 认识 → 熟悉度+1
            const knowBtn = wrapper.querySelector('#flashcardKnow');
            knowBtn.addEventListener('click', async () => {
                if (word.id) {
                    const updated = await WordDB.increaseFamiliarity(word.id);
                    if (updated) {
                        window.Toast.show(`✓ "${word.word}" 熟悉度 +1`);
                        await AchievementHelper.recordStudy();
                        if (options.onUpdate) options.onUpdate();
                    }
                }
                // 自动跳到下一个
                if (currentIndex < words.length - 1) {
                    currentIndex++;
                    isFlipped = false;
                    renderCard();
                }
            });

            // 不认识
            const dunnoBtn = wrapper.querySelector('#flashcardDunno');
            dunnoBtn.addEventListener('click', async () => {
                if (word.id) {
                    await WordDB.updateWord(word.id, { familiarity: Math.max(0, (word.familiarity || 0) - 1) });
                    window.Toast.show(`"${word.word}" 已标记不认识`);
                    if (options.onUpdate) options.onUpdate();
                }
                if (currentIndex < words.length - 1) {
                    currentIndex++;
                    isFlipped = false;
                    renderCard();
                }
            });
        };

        renderCard();
        container.innerHTML = '';
        container.appendChild(wrapper);
    }
}

window.FlashcardViewer = FlashcardViewer;
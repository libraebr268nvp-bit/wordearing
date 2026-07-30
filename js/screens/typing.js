/**
 * WordWiz - 打字练习模式
 * 
 * 类似 Qwerty Learner 风格：
 * - 显示中文释义，用户逐字母打出英文单词
 * - 实时显示正确/错误键位反馈
 * - 计时 + 计分
 * - 词书/分类筛选
 * 
 * 路由: #/typing
 */
class TypingPage {
    static async render(container) {
        this._cleanup();

        container.innerHTML = `
            <div class="page-header">
                <div class="page-title">⌨️ 打字练习</div>
            </div>
            <div id="typingContent"></div>
        `;

        const content = container.querySelector('#typingContent');
        await this._renderSetup(content);
    }

    static _cleanup() {
        if (this._timerInterval) {
            clearInterval(this._timerInterval);
            this._timerInterval = null;
        }
        if (this._keyHandler) {
            document.removeEventListener('keydown', this._keyHandler);
            this._keyHandler = null;
        }
        this._words = [];
        this._currentIndex = 0;
        this._typed = '';
        this._correctCount = 0;
        this._wrongCount = 0;
        this._startTime = null;
        this._elapsed = 0;
        this._isFinished = false;
        this._currentCharIndex = 0;
    }

    static async _renderSetup(content) {
        const books = await WordDB.getBooks();
        const activeIds = await WordDB.getActiveBookIds();

        content.innerHTML = `
            <div class="challenge-settings" style="max-width:500px;margin:0 auto;">
                <div class="challenge-setting-row">
                    <span class="setting-label">词书</span>
                    <div class="challenge-option-group" id="typingBookFilter">
                        ${books.map(b => `
                            <button class="challenge-opt-btn ${activeIds.includes(b.id) ? 'active' : ''}" data-id="${b.id}">${b.name}</button>
                        `).join('')}
                    </div>
                </div>
                <div class="challenge-setting-row">
                    <span class="setting-label">题数</span>
                    <div class="challenge-option-group" id="typingCountFilter">
                        ${[10, 20, 30, 50].map(n => `
                            <button class="challenge-opt-btn ${n === 20 ? 'active' : ''}" data-count="${n}">${n}词</button>
                        `).join('')}
                    </div>
                </div>
                <div style="text-align:center;margin-top:20px;">
                    <button class="btn btn-primary" id="typingStartBtn">🚀 开始练习</button>
                </div>
            </div>
        `;

        // 词书选择
        content.querySelectorAll('#typingBookFilter .challenge-opt-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                btn.classList.toggle('active');
                const active = content.querySelectorAll('#typingBookFilter .challenge-opt-btn.active');
                if (active.length === 0) btn.classList.add('active');
            });
        });

        // 题数选择
        content.querySelectorAll('#typingCountFilter .challenge-opt-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                content.querySelectorAll('#typingCountFilter .challenge-opt-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
            });
        });

        // 开始按钮
        content.querySelector('#typingStartBtn').addEventListener('click', async () => {
            const activeBtns = content.querySelectorAll('#typingBookFilter .challenge-opt-btn.active');
            const bookIds = Array.from(activeBtns).map(b => parseInt(b.dataset.id));
            const countBtn = content.querySelector('#typingCountFilter .challenge-opt-btn.active');
            const count = parseInt(countBtn ? countBtn.dataset.count : 20);

            await this._startGame(content, bookIds, count);
        });
    }

    static async _startGame(container, bookIds, count) {
        // 获取单词
        let allWords = bookIds.length > 0
            ? await WordDB.getWordsByBooks(bookIds)
            : await WordDB.getAllWords();

        // 过滤掉太短或太长的单词（打字体验）
        allWords = allWords.filter(w => w.word && w.word.length >= 2 && w.word.length <= 20);

        if (allWords.length === 0) {
            window.Toast.show('📭 所选词书中没有可用的单词');
            return;
        }

        // 随机打乱并截取
        this._words = WordSorter.shuffle(allWords).slice(0, Math.min(count, allWords.length));
        this._currentIndex = 0;
        this._correctCount = 0;
        this._wrongCount = 0;
        this._elapsed = 0;
        this._typed = '';
        this._currentCharIndex = 0;
        this._isFinished = false;
        this._startTime = Date.now();

        this._renderGame(container);
        this._startTimer(container);
        this._bindKeyboard(container);
    }

    static _renderGame(container) {
        const word = this._words[this._currentIndex];
        if (!word) return;

        container.innerHTML = `
            <div class="typing-game" style="max-width:600px;margin:0 auto;padding:0 16px;">
                <!-- 进度 -->
                <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:20px;">
                    <div style="font-size:14px;color:var(--text-muted);">
                        ${this._currentIndex + 1} / ${this._words.length}
                    </div>
                    <div style="display:flex;gap:16px;font-size:14px;">
                        <span style="color:var(--accent-green);">✓ ${this._correctCount}</span>
                        <span style="color:var(--accent-red);">✗ ${this._wrongCount}</span>
                        <span style="color:var(--text-muted);" id="typingTimer">0s</span>
                    </div>
                </div>

                <!-- 释义提示 -->
                <div style="text-align:center;margin-bottom:30px;">
                    <div style="font-size:14px;color:var(--text-muted);margin-bottom:8px;">请输入以下单词：</div>
                    <div style="font-size:22px;color:var(--text-primary);font-weight:500;line-height:1.6;">
                        ${word.definition || '(无释义)'}
                    </div>
                    <div style="font-size:13px;color:var(--text-muted);margin-top:6px;">
                        ${word.category || ''} · ${word.book_source || ''}
                    </div>
                </div>

                <!-- 打字输入区 -->
                <div class="typing-input-area" style="text-align:center;padding:20px 0;">
                    <div class="typing-letters" style="font-size:36px;font-weight:700;font-family:'Courier New',monospace;letter-spacing:4px;user-select:none;">
                        ${this._renderWordLetters(word.word)}
                    </div>
                    <div style="margin-top:16px;font-size:13px;color:var(--text-muted);">
                        ${this._typed ? '继续打字...' : '⌨️ 开始输入（按 Esc 重新开始）'}
                    </div>
                </div>

                <!-- 进度条 -->
                <div style="background:var(--bg-secondary);border-radius:var(--radius-sm);height:6px;overflow:hidden;margin-top:10px;">
                    <div style="height:100%;background:var(--accent-blue);border-radius:var(--radius-sm);transition:width 0.3s ease;width:${(this._currentIndex / this._words.length) * 100}%;"></div>
                </div>
            </div>
        `;
    }

    static _renderWordLetters(word) {
        return word.split('').map((char, i) => {
            const typedChar = this._typed[i];
            let cls = 'typing-char';
            let displayChar = char;

            if (typedChar === undefined) {
                // 还没打到
                cls += ' typing-pending';
            } else if (typedChar.toLowerCase() === char.toLowerCase()) {
                cls += ' typing-correct';
            } else {
                cls += ' typing-wrong';
                displayChar = typedChar;
            }

            // 当前要打的字母加光标
            if (i === this._typed.length) {
                cls += ' typing-current';
            }

            return `<span class="${cls}">${displayChar}</span>`;
        }).join('');
    }

    static _startTimer(container) {
        if (this._timerInterval) clearInterval(this._timerInterval);
        this._timerInterval = setInterval(() => {
            if (this._isFinished) return;
            this._elapsed = Math.floor((Date.now() - this._startTime) / 1000);
            const timerEl = document.getElementById('typingTimer');
            if (timerEl) timerEl.textContent = `${this._elapsed}s`;
        }, 200);
    }

    static _bindKeyboard(container) {
        if (this._keyHandler) {
            document.removeEventListener('keydown', this._keyHandler);
        }

        this._keyHandler = (e) => {
            if (this._isFinished) return;

            const word = this._words[this._currentIndex];
            if (!word) return;

            // Esc 重新开始
            if (e.key === 'Escape') {
                this._cleanup();
                this._renderSetup(container);
                return;
            }

            // Backspace 退格
            if (e.key === 'Backspace') {
                e.preventDefault();
                if (this._typed.length > 0) {
                    this._typed = this._typed.slice(0, -1);
                    this._updateGame(container);
                }
                return;
            }

            // 只处理字母键
            if (e.key.length === 1 && /[a-zA-Z]/.test(e.key)) {
                e.preventDefault();
                this._typed += e.key;

                const expectedChar = word.word[this._typed.length - 1];
                if (expectedChar && e.key.toLowerCase() === expectedChar.toLowerCase()) {
                    // 正确
                } else {
                    // 错误
                }

                // 检查是否打完了整个单词
                if (this._typed.length >= word.word.length) {
                    const isCorrect = this._typed.toLowerCase() === word.word.toLowerCase();
                    if (isCorrect) {
                        this._correctCount++;
                        window.Toast.show(`✓ "${word.word}" 正确！`);

                        // 更新熟悉度
                        if (word.id) {
                            WordDB.increaseFamiliarity(word.id).catch(() => {});
                            AchievementHelper.recordStudy().catch(() => {});
                        }
                    } else {
                        this._wrongCount++;
                        window.Toast.show(`✗ 正确是 "${word.word}"`);
                    }

                    // 下一词
                    setTimeout(() => {
                        if (this._currentIndex < this._words.length - 1) {
                            this._currentIndex++;
                            this._typed = '';
                            this._updateGame(container);
                        } else {
                            this._finishGame(container);
                        }
                    }, isCorrect ? 300 : 1200);
                } else {
                    this._updateGame(container);
                }
            }
        };

        document.addEventListener('keydown', this._keyHandler);
    }

    static _updateGame(container) {
        const word = this._words[this._currentIndex];
        if (!word) return;

        const lettersEl = container.querySelector('.typing-letters');
        if (lettersEl) {
            lettersEl.innerHTML = this._renderWordLetters(word.word);
        }

        // 更新进度条
        const bar = container.querySelector('.typing-game > div:last-child > div');
        if (bar) {
            bar.style.width = `${(this._currentIndex / this._words.length) * 100}%`;
        }
    }

    static async _finishGame(container) {
        this._isFinished = true;
        if (this._timerInterval) {
            clearInterval(this._timerInterval);
            this._timerInterval = null;
        }

        const total = this._words.length;
        const accuracy = total > 0 ? Math.round((this._correctCount / total) * 100) : 0;
        const wpm = this._elapsed > 0 ? Math.round((total / this._elapsed) * 60) : 0;

        // 记录到挑战历史（与挑战模式统一）
        const history = await WordDB.getSetting('challenge_history', []);
        history.push({
            id: Date.now(),
            date: new Date().toISOString(),
            total: this._words.length,
            correct: this._correctCount,
            elapsed: this._elapsed,
            count: this._words.length,
            rangeType: 'active',
            mode: 'typing'
        });
        if (history.length > 50) history.splice(0, history.length - 50);
        await WordDB.saveSetting('challenge_history', history);

        // 记录到学习统计
        if (this._correctCount > 0) {
            WordDB.recordStudyEvent('typing_practice', 'typing').catch(() => {});
        }

        container.innerHTML = `
            <div class="typing-game" style="max-width:500px;margin:0 auto;padding:0 16px;text-align:center;">
                <div style="font-size:48px;margin-bottom:16px;">
                    ${accuracy >= 90 ? '🏆' : accuracy >= 70 ? '👍' : '💪'}
                </div>
                <div style="font-size:24px;font-weight:700;color:var(--text-primary);margin-bottom:20px;">
                    练习完成！
                </div>

                <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:12px;margin-bottom:24px;">
                    <div style="background:var(--bg-secondary);padding:16px;border-radius:var(--radius-md);">
                        <div style="font-size:28px;font-weight:700;color:var(--accent-blue);">${this._correctCount}</div>
                        <div style="font-size:12px;color:var(--text-muted);">正确</div>
                    </div>
                    <div style="background:var(--bg-secondary);padding:16px;border-radius:var(--radius-md);">
                        <div style="font-size:28px;font-weight:700;color:var(--accent-purple);">${accuracy}%</div>
                        <div style="font-size:12px;color:var(--text-muted);">正确率</div>
                    </div>
                    <div style="background:var(--bg-secondary);padding:16px;border-radius:var(--radius-md);">
                        <div style="font-size:28px;font-weight:700;color:var(--accent-green);">${wpm}</div>
                        <div style="font-size:12px;color:var(--text-muted);">词/分钟</div>
                    </div>
                </div>

                <div style="margin-bottom:8px;font-size:14px;color:var(--text-muted);">
                    用时 ${this._elapsed} 秒 · 共 ${total} 词
                </div>

                <div style="display:flex;gap:10px;justify-content:center;margin-top:20px;">
                    <button class="btn btn-primary" id="typingRetryBtn">🔄 再来一次</button>
                    <button class="btn" id="typingBackBtn">🏠 返回</button>
                </div>
            </div>
        `;

        container.querySelector('#typingRetryBtn').addEventListener('click', async () => {
            this._cleanup();
            await this._renderSetup(container);
        });
        container.querySelector('#typingBackBtn').addEventListener('click', () => {
            this._cleanup();
            this._renderSetup(container);
        });
    }
}

window.TypingPage = TypingPage;

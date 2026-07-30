/**
 * WordWiz - 配对游戏
 * 
 * 翻牌配对：在网格中匹配单词与释义
 * 计时计分，难度选择
 * 
 * 路由: #/matching
 */
class MatchingPage {
    static async render(container) {
        this._cleanup();
        container.innerHTML = `
            <div class="page-header">
                <div class="page-title">🃏 配对游戏</div>
            </div>
            <div id="matchingContent"></div>
        `;
        const content = container.querySelector('#matchingContent');
        await this._renderSetup(content);
    }

    static _cleanup() {
        if (this._timerInterval) { clearInterval(this._timerInterval); this._timerInterval = null; }
        this._cards = [];
        this._flipped = [];
        this._matched = [];
        this._moves = 0;
        this._elapsed = 0;
        this._isLocked = false;
        this._isFinished = false;
    }

    static async _renderSetup(content) {
        const books = await WordDB.getBooks();
        const activeIds = await WordDB.getActiveBookIds();

        content.innerHTML = `
            <div class="challenge-settings" style="max-width:500px;margin:0 auto;">
                <div class="challenge-setting-row">
                    <span class="setting-label">词书</span>
                    <div class="challenge-option-group" id="matchBookFilter">
                        ${books.map(b => `<button class="challenge-opt-btn ${activeIds.includes(b.id)?'active':''}" data-id="${b.id}">${b.name}</button>`).join('')}
                    </div>
                </div>
                <div class="challenge-setting-row">
                    <span class="setting-label">难度</span>
                    <div class="challenge-option-group" id="matchDifficulty">
                        <button class="challenge-opt-btn active" data-pairs="6">简单 (6对)</button>
                        <button class="challenge-opt-btn" data-pairs="10">普通 (10对)</button>
                        <button class="challenge-opt-btn" data-pairs="15">困难 (15对)</button>
                    </div>
                </div>
                <div style="text-align:center;margin-top:20px;">
                    <button class="btn btn-primary" id="matchStartBtn">🃏 开始游戏</button>
                </div>
            </div>
        `;

        content.querySelectorAll('#matchBookFilter .challenge-opt-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                btn.classList.toggle('active');
                if (content.querySelectorAll('#matchBookFilter .challenge-opt-btn.active').length === 0) btn.classList.add('active');
            });
        });
        content.querySelectorAll('#matchDifficulty .challenge-opt-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                content.querySelectorAll('#matchDifficulty .challenge-opt-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
            });
        });

        content.querySelector('#matchStartBtn').addEventListener('click', async () => {
            const bookIds = Array.from(content.querySelectorAll('#matchBookFilter .challenge-opt-btn.active')).map(b => parseInt(b.dataset.id));
            const pairs = parseInt(content.querySelector('#matchDifficulty .challenge-opt-btn.active').dataset.pairs);
            await this._startGame(content, bookIds, pairs);
        });
    }

    static async _startGame(container, bookIds, pairs) {
        let allWords = bookIds.length > 0 ? await WordDB.getWordsByBooks(bookIds) : await WordDB.getAllWords();
        allWords = WordSorter.shuffle(allWords).filter(w => w.word && w.word.length < 30 && w.definition && w.definition.length < 50);

        if (allWords.length < pairs) {
            window.Toast.show(`📭 词库不足${pairs}个可用单词，当前${allWords.length}个`);
            return;
        }

        const selected = allWords.slice(0, pairs);
        this._cards = [];
        this._flipped = [];
        this._matched = new Set();
        this._moves = 0;
        this._elapsed = 0;
        this._isLocked = false;
        this._isFinished = false;

        // 创建卡片对：每对包含一个 word 卡和一个 definition 卡
        selected.forEach((w, idx) => {
            this._cards.push({ id: `word-${idx}`, pairId: idx, type: 'word', text: w.word, word: w });
            this._cards.push({ id: `def-${idx}`, pairId: idx, type: 'def', text: w.definition, word: w });
        });

        // 打乱卡片顺序
        this._cards = WordSorter.shuffle(this._cards);

        this._renderGame(container);
        this._startTimer();
    }

    static _renderGame(container) {
        const totalPairs = this._cards.length / 2;
        const matchedCount = this._matched.size;

        container.innerHTML = `
            <div style="max-width:600px;margin:0 auto;padding:0 16px;">
                <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;">
                    <div style="font-size:14px;color:var(--text-muted);">
                        ✅ ${matchedCount}/${totalPairs} 对
                    </div>
                    <div style="display:flex;gap:16px;font-size:14px;">
                        <span style="color:var(--text-secondary);">🔄 ${this._moves} 步</span>
                        <span style="color:var(--text-muted);" id="matchTimer">${this._elapsed}s</span>
                    </div>
                </div>
                <div class="matching-grid" style="display:grid;grid-template-columns:repeat(4,1fr);gap:8px;">
                    ${this._cards.map((card, i) => {
                        const isMatched = this._matched.has(card.pairId);
                        const isFlipped = this._flipped.includes(i) || isMatched;
                        return `
                            <div class="match-card ${isFlipped ? 'flipped' : ''} ${isMatched ? 'matched' : ''}"
                                 data-index="${i}" style="aspect-ratio:1;cursor:pointer;border-radius:var(--radius-sm);
                                 background:${isFlipped ? 'var(--bg-card)' : 'var(--accent-blue)'};
                                 border:1px solid ${isMatched ? 'var(--accent-green)' : isFlipped ? 'var(--border-color)' : 'var(--accent-blue)'};
                                 display:flex;align-items:center;justify-content:center;padding:6px;
                                 font-size:${card.type === 'word' ? '13px' : '11px'};
                                 font-weight:${card.type === 'word' ? '700' : '400'};
                                 color:${isMatched ? 'var(--accent-green)' : isFlipped ? 'var(--text-primary)' : '#fff'};
                                 text-align:center;transition:all 0.3s ease;overflow:hidden;
                                 box-shadow:${isMatched ? '0 0 8px rgba(74,222,128,0.3)' : isFlipped ? 'var(--shadow-sm)' : '0 0 4px rgba(108,140,255,0.3)'};
                                 ${isMatched ? 'opacity:0.7;' : ''}">
                                ${isFlipped ? (card.type === 'word' ? card.text : card.text) : '?'}
                            </div>
                        `;
                    }).join('')}
                </div>
                <div style="text-align:center;margin-top:12px;font-size:12px;color:var(--text-muted);">
                    点击翻开两张卡片，匹配单词和释义
                </div>
            </div>
        `;

        // 绑定点击事件
        container.querySelectorAll('.match-card:not(.flipped)').forEach(el => {
            el.addEventListener('click', () => this._flipCard(container, parseInt(el.dataset.index)));
        });
    }

    static _flipCard(container, index) {
        if (this._isLocked || this._isFinished) return;
        if (this._flipped.includes(index)) return;
        if (this._flipped.length >= 2) return;
        if (this._matched.has(this._cards[index].pairId)) return;

        this._flipped.push(index);
        this._renderGame(container);

        // 重新绑定已翻开的卡片点击（不处理已匹配的）
        container.querySelectorAll('.match-card').forEach(el => {
            const i = parseInt(el.dataset.index);
            if (!this._flipped.includes(i) && !this._matched.has(this._cards[i].pairId)) {
                el.addEventListener('click', () => this._flipCard(container, i));
            }
        });

        if (this._flipped.length === 2) {
            this._isLocked = true;
            this._moves++;

            const [i1, i2] = this._flipped;
            const c1 = this._cards[i1];
            const c2 = this._cards[i2];

            if (c1.pairId === c2.pairId && c1.type !== c2.type) {
                // 匹配成功
                this._matched.add(c1.pairId);
                this._flipped = [];
                this._isLocked = false;

                // 检查是否全部完成
                if (this._matched.size === this._cards.length / 2) {
                    this._finishGame(container);
                } else {
                    this._renderGame(container);
                    container.querySelectorAll('.match-card').forEach(el => {
                        const i = parseInt(el.dataset.index);
                        if (!this._flipped.includes(i) && !this._matched.has(this._cards[i].pairId)) {
                            el.addEventListener('click', () => this._flipCard(container, i));
                        }
                    });
                }
            } else {
                // 不匹配，翻回去
                setTimeout(() => {
                    this._flipped = [];
                    this._isLocked = false;
                    this._renderGame(container);
                    container.querySelectorAll('.match-card').forEach(el => {
                        const i = parseInt(el.dataset.index);
                        if (!this._flipped.includes(i) && !this._matched.has(this._cards[i].pairId)) {
                            el.addEventListener('click', () => this._flipCard(container, i));
                        }
                    });
                }, 1000);
            }
        }
    }

    static _startTimer() {
        if (this._timerInterval) clearInterval(this._timerInterval);
        this._timerInterval = setInterval(() => {
            if (this._isFinished) return;
            this._elapsed++;
            const el = document.getElementById('matchTimer');
            if (el) el.textContent = `${this._elapsed}s`;
        }, 1000);
    }

    static async _finishGame(container) {
        this._isFinished = true;
        if (this._timerInterval) { clearInterval(this._timerInterval); this._timerInterval = null; }

        const totalPairs = this._cards.length / 2;
        const score = Math.max(0, Math.round((totalPairs / this._moves) * 100));

        // 记录到挑战历史（与挑战模式统一）
        const history = await WordDB.getSetting('challenge_history', []);
        history.push({
            id: Date.now(),
            date: new Date().toISOString(),
            total: totalPairs,
            correct: totalPairs, // 配对全部完成即为正确
            elapsed: this._elapsed,
            count: totalPairs,
            rangeType: 'active',
            mode: 'matching'
        });
        if (history.length > 50) history.splice(0, history.length - 50);
        await WordDB.saveSetting('challenge_history', history);

        // 记录成就事件
        AchievementHelper.recordStudy().catch(() => {});

        container.innerHTML = `
            <div style="max-width:500px;margin:0 auto;padding:0 16px;text-align:center;">
                <div style="font-size:56px;margin-bottom:16px;">
                    ${score >= 80 ? '🏆' : score >= 50 ? '🎉' : '💪'}
                </div>
                <div style="font-size:24px;font-weight:700;color:var(--text-primary);margin-bottom:20px;">
                    配对完成！
                </div>
                <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:12px;margin-bottom:24px;">
                    <div style="background:var(--bg-secondary);padding:16px;border-radius:var(--radius-md);">
                        <div style="font-size:28px;font-weight:700;color:var(--accent-blue);">${totalPairs}</div>
                        <div style="font-size:12px;color:var(--text-muted);">配对</div>
                    </div>
                    <div style="background:var(--bg-secondary);padding:16px;border-radius:var(--radius-md);">
                        <div style="font-size:28px;font-weight:700;color:var(--accent-purple);">${this._moves}</div>
                        <div style="font-size:12px;color:var(--text-muted);">步数</div>
                    </div>
                    <div style="background:var(--bg-secondary);padding:16px;border-radius:var(--radius-md);">
                        <div style="font-size:28px;font-weight:700;color:var(--accent-green);">${score}</div>
                        <div style="font-size:12px;color:var(--text-muted);">得分</div>
                    </div>
                </div>
                <div style="font-size:14px;color:var(--text-muted);margin-bottom:20px;">
                    用时 ${this._elapsed} 秒
                </div>
                <div style="display:flex;gap:10px;justify-content:center;">
                    <button class="btn btn-primary" id="matchRetryBtn">🔄 再来一局</button>
                    <button class="btn" id="matchBackBtn">🏠 返回</button>
                </div>
            </div>
        `;

        container.querySelector('#matchRetryBtn').addEventListener('click', async () => {
            this._cleanup();
            await this._renderSetup(container);
        });
        container.querySelector('#matchBackBtn').addEventListener('click', () => {
            this._cleanup();
            this._renderSetup(container);
        });
    }
}

window.MatchingPage = MatchingPage;

/**
 * WordWiz - 挑战模式页面
 * 
 * 功能：
 * - 设置：题数（10/20/50/100/自定义）、范围（激活词书/全部/按分类）
 * - 7天内近期出现过的词不会出现（冷却机制）
 * - 答对熟悉度+1，答错-1
 * - 记录每次挑战结果，在设置页可查看
 * - 触发挑战相关成就
 * 
 * 路由: #/challenge
 * 状态机: start → playing → result
 */

class ChallengePage {
    /** 冷却天数 */
    static COOLDOWN_DAYS = 7;

    static async render(container) {
        // 清理冷却数据中过期的记录
        await this._cleanRecentWords();

        container.innerHTML = `
            <div class="page-header">
                <div class="page-title">⚡ 挑战模式</div>
            </div>
            <div id="challengeContent"></div>
        `;
        const content = container.querySelector('#challengeContent');
        await this._renderStart(content);
    }

    // ===================== 冷却机制 =====================

    /** 清理超过冷却天数的记录 */
    static async _cleanRecentWords() {
        const recent = await WordDB.getSetting('challenge_recent_words', []);
        const cutoff = new Date();
        cutoff.setDate(cutoff.getDate() - this.COOLDOWN_DAYS);
        const cutoffStr = cutoff.toISOString().split('T')[0];
        const filtered = recent.filter(r => r.date >= cutoffStr);
        if (filtered.length !== recent.length) {
            await WordDB.saveSetting('challenge_recent_words', filtered);
        }
    }

    /** 获取可用的词库（排除冷却中的词） */
    static async _getAvailablePool(category, rangeType) {
        let allWords;
        if (rangeType === 'all') {
            allWords = await WordDB.getAllWords();
        } else if (rangeType === 'category' && category && category !== '全部') {
            allWords = await WordDB.getWordsByCategory(category);
        } else {
            const activeIds = await WordDB.getActiveBookIds();
            allWords = await WordDB.getWordsByBooks(activeIds);
        }

        // 排除冷却中的词
        const recent = await WordDB.getSetting('challenge_recent_words', []);
        const recentIds = new Set(recent.map(r => r.wordId));

        return allWords.filter(w => !recentIds.has(w.id));
    }

    /** 记录本次出现的单词到冷却列表 */
    static async _recordRecentWords(wordIds) {
        const recent = await WordDB.getSetting('challenge_recent_words', []);
        const today = new Date().toISOString().split('T')[0];
        for (const id of wordIds) {
            // 避免重复记录同一天同一个词
            if (!recent.some(r => r.wordId === id && r.date === today)) {
                recent.push({ wordId: id, date: today });
            }
        }
        // 最多保留 500 条，防止无限膨胀
        if (recent.length > 500) {
            recent.splice(0, recent.length - 500);
        }
        await WordDB.saveSetting('challenge_recent_words', recent);
    }

    // ===================== 错题收集 =====================

    /** 记录答错的单词到错题集 */
    static async _recordWrongWords(wrongQuestions) {
        if (!wrongQuestions || wrongQuestions.length === 0) return;
        const wrongWords = await WordDB.getSetting('challenge_wrong_words', []);
        const existingIds = new Set(wrongWords.map(w => w.wordId));
        const now = new Date().toISOString();
        for (const q of wrongQuestions) {
            if (!existingIds.has(q.word.id) && wrongWords.length < 200) {
                wrongWords.unshift({
                    wordId: q.word.id,
                    word: q.word.word,
                    definition: q.word.definition,
                    category: q.word.category,
                    book_source: q.word.book_source,
                    date: now
                });
                existingIds.add(q.word.id);
            }
        }
        // 最多保留 200 条
        if (wrongWords.length > 200) {
            wrongWords.splice(200);
        }
        await WordDB.saveSetting('challenge_wrong_words', wrongWords);
    }

    // ===================== 挑战记录 =====================

    /** 记录一次挑战结果 */
    static async _recordHistory(total, correct, elapsed, count, rangeType) {
        const history = await WordDB.getSetting('challenge_history', []);
        history.push({
            id: Date.now(),
            date: new Date().toISOString(),
            total,
            correct,
            elapsed,
            count,
            rangeType
        });
        // 最多保留 50 条
        if (history.length > 50) {
            history.splice(0, history.length - 50);
        }
        await WordDB.saveSetting('challenge_history', history);
    }

    // ===================== 开始页 =====================

    static async _renderStart(container) {
        // 获取所有分类（动态）
        const allWords = await WordDB.getAllWords();
        const categories = [...new Set(allWords.map(w => w.category).filter(Boolean))].sort();

        // 读取上次设置
        const settings = await WordDB.getSetting('challenge_settings', { count: 10, rangeType: 'active', category: null });

        container.innerHTML = `
            <div class="challenge-start" style="text-align:center;padding:40px 20px;max-width:520px;margin:0 auto;">
                <div style="font-size:64px;margin-bottom:16px;">🎯</div>
                <h2 style="font-size:20px;margin-bottom:6px;">随机抽词挑战</h2>
                <p style="color:var(--text-muted);font-size:13px;margin-bottom:24px;">
                    选择正确的中文释义，每题 4 选 1
                </p>

                <!-- 设置区 -->
                <div class="challenge-settings" style="text-align:left;margin-bottom:28px;">
                    <!-- 题数 -->
                    <div class="challenge-setting-row">
                        <span class="setting-label">题数</span>
                        <div class="challenge-option-group" id="countOptions">
                            ${[10, 20, 50, 100].map(n => `
                                <button class="challenge-opt-btn ${settings.count === n ? 'active' : ''}" data-value="${n}">${n}</button>
                            `).join('')}
                            <button class="challenge-opt-btn ${![10,20,50,100].includes(settings.count) ? 'active' : ''}" data-value="custom">自定义</button>
                        </div>
                    </div>
                    <div id="customCountRow" style="display:${![10,20,50,100].includes(settings.count) ? 'flex' : 'none'};align-items:center;gap:8px;margin-top:4px;padding-left:48px;">
                        <input type="number" id="customCountInput" min="1" max="200" value="${![10,20,50,100].includes(settings.count) ? settings.count : 10}" 
                               style="width:80px;padding:4px 8px;border:1px solid var(--border-color);border-radius:var(--radius-sm);background:var(--bg-secondary);color:var(--text-primary);font-size:13px;">
                        <span style="color:var(--text-muted);font-size:12px;">题（1~200）</span>
                    </div>

                    <!-- 范围 -->
                    <div class="challenge-setting-row">
                        <span class="setting-label">范围</span>
                        <div class="challenge-option-group" id="rangeOptions">
                            <button class="challenge-opt-btn ${settings.rangeType === 'active' ? 'active' : ''}" data-value="active">激活词书</button>
                            <button class="challenge-opt-btn ${settings.rangeType === 'all' ? 'active' : ''}" data-value="all">全部词库</button>
                            <button class="challenge-opt-btn ${settings.rangeType === 'category' ? 'active' : ''}" data-value="category">按分类</button>
                        </div>
                    </div>

                    <!-- 分类选择（仅当范围=按分类时显示） -->
                    <div id="categorySelectRow" style="display:${settings.rangeType === 'category' ? 'flex' : 'none'};align-items:center;gap:8px;padding-left:48px;margin-top:4px;">
                        <span style="color:var(--text-muted);font-size:12px;">分类</span>
                        <select id="categorySelect" style="padding:4px 8px;border:1px solid var(--border-color);border-radius:var(--radius-sm);background:var(--bg-secondary);color:var(--text-primary);font-size:13px;">
                            ${categories.map(c => `
                                <option value="${c}" ${settings.category === c ? 'selected' : ''}>${c}</option>
                            `).join('')}
                            ${categories.length === 0 ? '<option value="">（暂无分类）</option>' : ''}
                        </select>
                    </div>
                </div>

                <!-- 开始按钮 -->
                <div id="challengeStartBtnWrapper">
                    <button class="btn btn-primary" id="challengeStartBtn" style="font-size:16px;padding:12px 40px;">
                        🚀 开始挑战
                    </button>
                </div>
                <div id="challengeStartError" style="color:var(--accent-red);font-size:13px;margin-top:12px;display:none;"></div>
            </div>
        `;

        // 绑定题数选择
        container.querySelectorAll('#countOptions .challenge-opt-btn').forEach(btn => {
            btn.addEventListener('click', async () => {
                container.querySelectorAll('#countOptions .challenge-opt-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                const val = btn.dataset.value;
                document.getElementById('customCountRow').style.display = val === 'custom' ? 'flex' : 'none';
            });
        });

        // 绑定范围选择
        container.querySelectorAll('#rangeOptions .challenge-opt-btn').forEach(btn => {
            btn.addEventListener('click', async () => {
                container.querySelectorAll('#rangeOptions .challenge-opt-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                const val = btn.dataset.value;
                document.getElementById('categorySelectRow').style.display = val === 'category' ? 'flex' : 'none';
            });
        });

        // 开始按钮
        document.getElementById('challengeStartBtn').addEventListener('click', () => this._startGame(container));
    }

    // ===================== 开始游戏 =====================

    static async _startGame(container) {
        const btnWrapper = document.getElementById('challengeStartBtnWrapper');
        const errorEl = document.getElementById('challengeStartError');
        btnWrapper.innerHTML = '<span style="color:var(--text-muted);font-size:14px;">⏳ 正在准备题目...</span>';

        try {
            // 1. 读取设置
            const activeCountBtn = container.querySelector('#countOptions .challenge-opt-btn.active');
            let count;
            if (activeCountBtn.dataset.value === 'custom') {
                const input = document.getElementById('customCountInput');
                count = parseInt(input.value) || 10;
                count = Math.min(200, Math.max(1, count));
            } else {
                count = parseInt(activeCountBtn.dataset.value);
            }

            const activeRangeBtn = container.querySelector('#rangeOptions .challenge-opt-btn.active');
            const rangeType = activeRangeBtn.dataset.value;
            let category = null;
            if (rangeType === 'category') {
                category = document.getElementById('categorySelect').value;
            }

            // 保存设置
            await WordDB.saveSetting('challenge_settings', { count, rangeType, category });

            // 2. 获取可用词库
            const pool = await this._getAvailablePool(category, rangeType);

            // 3. 检查词库是否足够
            if (pool.length < 4) {
                this._showError(container, `可用单词不足 4 个（当前 ${pool.length} 个），无法生成干扰项。冷却中的词 7 天后可再次挑战。`);
                return;
            }

            if (pool.length < count) {
                this._showError(container, `可用单词仅有 ${pool.length} 个，不足 ${count} 题。将使用全部可用单词进行挑战。`);
                count = pool.length;
            }

            // 4. Fisher-Yates 随机抽题
            const shuffled = [...pool];
            for (let i = shuffled.length - 1; i > 0; i--) {
                const j = Math.floor(Math.random() * (i + 1));
                [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
            }
            const questions = shuffled.slice(0, count);

            // 5. 生成题目
            const quiz = questions.map(q => this._buildQuestion(q, pool));

            // 6. 进入答题
            this._currentQuiz = quiz;
            this._currentIndex = 0;
            this._correctCount = 0;
            this._wrongIndices = [];   // 答错的题号
            this._startTime = Date.now();
            this._timerInterval = null;
            this._streakCount = 0;     // 连续答对计数
            this._maxStreak = 0;       // 本轮最大连对

            this._renderQuestion(container);

        } catch (err) {
            this._showError(container, `加载失败：${err.message}`);
            console.error('[Challenge] 启动失败:', err);
        }
    }

    static _showError(container, msg) {
        const errorEl = document.getElementById('challengeStartError');
        if (errorEl) {
            errorEl.textContent = '❌ ' + msg;
            errorEl.style.display = 'block';
        }
        const btnWrapper = document.getElementById('challengeStartBtnWrapper');
        if (btnWrapper) {
            btnWrapper.innerHTML = '<button class="btn btn-primary" id="challengeStartBtn" style="font-size:16px;padding:12px 40px;">🔄 重试</button>';
            document.getElementById('challengeStartBtn').addEventListener('click', () => this._startGame(container));
        }
    }

    /**
     * 为一道题生成 4 个选项（1 正确 + 3 干扰）
     */
    static _buildQuestion(correctWord, pool) {
        const correctDef = correctWord.definition || '(无释义)';

        // 收集干扰项
        const distractors = new Set();
        const filtered = pool.filter(w =>
            w.id !== correctWord.id &&
            w.definition &&
            w.definition !== correctDef
        );

        const candidates = [...filtered];
        for (let i = candidates.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [candidates[i], candidates[j]] = [candidates[j], candidates[i]];
        }

        for (const c of candidates) {
            if (distractors.size >= 3) break;
            distractors.add(c.definition);
        }

        const distractorList = [...distractors];
        while (distractorList.length < 3) {
            distractorList.push('(错误选项)');
        }

        // 4 选项随机排列
        const options = [correctDef, ...distractorList];
        for (let i = options.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [options[i], options[j]] = [options[j], options[i]];
        }

        return {
            word: correctWord,
            correctDef,
            options,
            correctIndex: options.indexOf(correctDef)
        };
    }

    // ===================== 答题页 =====================

    static _renderQuestion(container) {
        const q = this._currentQuiz[this._currentIndex];
        const total = this._currentQuiz.length;
        const elapsed = Math.floor((Date.now() - this._startTime) / 1000);
        const minutes = String(Math.floor(elapsed / 60)).padStart(2, '0');
        const seconds = String(elapsed % 60).padStart(2, '0');

        container.innerHTML = `
            <div class="challenge-quiz" style="max-width:600px;margin:0 auto;padding:20px;">
                <!-- 进度 & 计时 & 连对 -->
                <div class="challenge-progress" style="display:flex;justify-content:space-between;align-items:center;margin-bottom:24px;
                    padding:12px 16px;background:var(--bg-card);border:1px solid var(--border-color);border-radius:var(--radius-md);">
                    <span style="font-size:14px;color:var(--text-secondary);">
                        第 <strong style="color:var(--accent-blue);">${this._currentIndex + 1}</strong> / ${total} 题
                    </span>
                    <div style="display:flex;gap:16px;align-items:center;">
                        ${this._streakCount >= 2 ? `<span style="font-size:13px;color:var(--accent-yellow);">🔥 ${this._streakCount} 连对</span>` : ''}
                        <span style="font-size:14px;color:var(--text-secondary);font-variant-numeric:tabular-nums;" id="challengeTimer">
                            ⏱ ${minutes}:${seconds}
                        </span>
                    </div>
                </div>

                <!-- 进度条 -->
                <div style="height:4px;background:var(--border-color);border-radius:2px;margin-bottom:32px;overflow:hidden;">
                    <div style="height:100%;width:${(this._currentIndex / total) * 100}%;background:var(--accent-blue);border-radius:2px;
                        transition:width 0.3s ease;"></div>
                </div>

                <!-- 单词 -->
                <div style="text-align:center;margin-bottom:32px;">
                    <div style="font-size:36px;font-weight:700;color:var(--text-primary);letter-spacing:1px;margin-bottom:8px;">
                        ${q.word.word}
                    </div>
                    <div style="font-size:13px;color:var(--text-muted);">
                        ${q.word.category || ''} ${q.word.book_source ? '· ' + q.word.book_source : ''}
                        <span style="margin-left:8px;font-size:12px;">熟悉度: ${q.word.familiarity}/5</span>
                    </div>
                </div>

                <!-- 选项 -->
                <div id="challengeOptions" style="display:flex;flex-direction:column;gap:10px;">
                    ${q.options.map((opt, i) => `
                        <button class="challenge-option" data-index="${i}" style="
                            width:100%;padding:14px 18px;border:1px solid var(--border-color);border-radius:var(--radius-md);
                            background:var(--bg-card);color:var(--text-primary);font-size:15px;text-align:left;
                            cursor:pointer;transition:var(--transition);display:flex;align-items:center;gap:12px;
                        ">
                            <span style="width:28px;height:28px;border-radius:50%;border:1px solid var(--border-color);
                                display:flex;align-items:center;justify-content:center;font-size:13px;flex-shrink:0;
                                color:var(--text-muted);background:var(--bg-secondary);">
                                ${String.fromCharCode(65 + i)}
                            </span>
                            <span style="flex:1;line-height:1.4;">${opt}</span>
                        </button>
                    `).join('')}
                </div>
            </div>
        `;

        // 启动计时器
        if (this._timerInterval) clearInterval(this._timerInterval);
        this._timerInterval = setInterval(() => {
            const timerEl = document.getElementById('challengeTimer');
            if (!timerEl) { clearInterval(this._timerInterval); return; }
            const e = Math.floor((Date.now() - this._startTime) / 1000);
            const m = String(Math.floor(e / 60)).padStart(2, '0');
            const s = String(e % 60).padStart(2, '0');
            timerEl.textContent = `⏱ ${m}:${s}`;
        }, 1000);

        // 绑定选项
        document.querySelectorAll('.challenge-option').forEach(btn => {
            btn.addEventListener('click', () => this._handleAnswer(container, btn));
        });
    }

    static async _handleAnswer(container, clickedBtn) {
        const selectedIndex = parseInt(clickedBtn.dataset.index);
        const q = this._currentQuiz[this._currentIndex];
        const isCorrect = selectedIndex === q.correctIndex;

        // 更新熟悉度
        try {
            const word = q.word;
            if (isCorrect) {
                await WordDB.updateWord(word.id, {
                    familiarity: Math.min(5, (word.familiarity || 0) + 1)
                });
                this._correctCount++;
                this._streakCount++;
                if (this._streakCount > this._maxStreak) {
                    this._maxStreak = this._streakCount;
                }
            } else {
                await WordDB.updateWord(word.id, {
                    familiarity: Math.max(0, (word.familiarity || 0) - 1)
                });
                this._wrongIndices.push(this._currentIndex);
                this._streakCount = 0;
            }
        } catch (e) {
            console.warn('[Challenge] 更新熟悉度失败:', e);
        }

        // 标记答案
        document.querySelectorAll('.challenge-option').forEach(btn => {
            btn.style.pointerEvents = 'none';
            const idx = parseInt(btn.dataset.index);
            if (idx === q.correctIndex) {
                btn.style.borderColor = 'var(--accent-green)';
                btn.style.background = 'rgba(74, 222, 128, 0.1)';
                btn.style.boxShadow = '0 0 12px rgba(74, 222, 128, 0.2)';
            } else if (idx === selectedIndex && !isCorrect) {
                btn.style.borderColor = 'var(--accent-red)';
                btn.style.background = 'rgba(255, 82, 82, 0.1)';
                btn.style.boxShadow = '0 0 12px rgba(255, 82, 82, 0.2)';
            }
        });

        if (isCorrect) {
            clickedBtn.innerHTML += ' <span style="margin-left:auto;font-size:18px;">✅</span>';
        } else {
            clickedBtn.innerHTML += ' <span style="margin-left:auto;font-size:18px;">❌</span>';
        }

        // 0.8 秒后下一题或结果
        setTimeout(() => {
            if (this._currentIndex + 1 < this._currentQuiz.length) {
                this._currentIndex++;
                this._renderQuestion(container);
            } else {
                this._renderResult(container);
            }
        }, 800);
    }

    // ===================== 结果页 =====================

    static async _renderResult(container) {
        if (this._timerInterval) {
            clearInterval(this._timerInterval);
            this._timerInterval = null;
        }

        const total = this._currentQuiz.length;
        const elapsed = Math.floor((Date.now() - this._startTime) / 1000);
        const minutes = String(Math.floor(elapsed / 60)).padStart(2, '0');
        const seconds = String(elapsed % 60).padStart(2, '0');
        const pct = Math.round((this._correctCount / total) * 100);

        // 评价
        let emoji, comment;
        if (pct === 100) { emoji = '🏆'; comment = '满分通关！太厉害了！'; }
        else if (pct >= 80) { emoji = '🌟'; comment = '非常优秀！继续保持！'; }
        else if (pct >= 60) { emoji = '👍'; comment = '不错，再接再厉！'; }
        else if (pct >= 40) { emoji = '💪'; comment = '加油，多复习几次！'; }
        else { emoji = '📖'; comment = '需要更多练习哦！'; }

        // 记录冷却词
        const wordIds = this._currentQuiz.map(q => q.word.id);
        await this._recordRecentWords(wordIds);

        // 记录挑战历史
        const settings = await WordDB.getSetting('challenge_settings', { count: 10, rangeType: 'active' });
        await this._recordHistory(total, this._correctCount, elapsed, settings.count, settings.rangeType);

        // 记录错题到错题集
        const wrongQuestions = this._wrongIndices?.length > 0
            ? this._wrongIndices.map(i => this._currentQuiz[i])
            : [];
        await this._recordWrongWords(wrongQuestions);

        // 触发成就
        await AchievementHelper.recordChallenge(this._correctCount, total, elapsed, this._maxStreak);

        container.innerHTML = `
            <div class="challenge-result" style="text-align:center;padding:40px 20px;max-width:480px;margin:0 auto;">
                <div style="font-size:72px;margin-bottom:16px;">${emoji}</div>
                <h2 style="font-size:22px;margin-bottom:8px;">挑战完成！</h2>
                <p style="color:var(--text-muted);font-size:14px;margin-bottom:28px;">${comment}</p>

                <!-- 成绩卡片 -->
                <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:12px;margin-bottom:32px;">
                    <div style="background:var(--bg-card);border:1px solid var(--border-color);border-radius:var(--radius-md);padding:16px;">
                        <div style="font-size:28px;font-weight:700;color:var(--accent-green);">${this._correctCount}</div>
                        <div style="font-size:12px;color:var(--text-muted);margin-top:4px;">正确</div>
                    </div>
                    <div style="background:var(--bg-card);border:1px solid var(--border-color);border-radius:var(--radius-md);padding:16px;">
                        <div style="font-size:28px;font-weight:700;color:var(--accent-red);">${total - this._correctCount}</div>
                        <div style="font-size:12px;color:var(--text-muted);margin-top:4px;">错误</div>
                    </div>
                    <div style="background:var(--bg-card);border:1px solid var(--border-color);border-radius:var(--radius-md);padding:16px;">
                        <div style="font-size:28px;font-weight:700;color:var(--accent-blue);">${minutes}:${seconds}</div>
                        <div style="font-size:12px;color:var(--text-muted);margin-top:4px;">用时</div>
                    </div>
                </div>

                <!-- 连对 + 正确率 -->
                <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:28px;">
                    <div style="background:var(--bg-card);border:1px solid var(--border-color);border-radius:var(--radius-md);padding:16px;">
                        <div style="font-size:24px;font-weight:700;color:var(--accent-yellow);">🔥 ${this._maxStreak}</div>
                        <div style="font-size:12px;color:var(--text-muted);margin-top:4px;">最大连对</div>
                    </div>
                    <div style="background:var(--bg-card);border:1px solid var(--border-color);border-radius:var(--radius-md);padding:16px;position:relative;">
                        <svg viewBox="0 0 36 36" style="width:60px;height:60px;margin:0 auto;">
                            <path d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                                fill="none" stroke="var(--border-color)" stroke-width="3" />
                            <path d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                                fill="none" stroke="var(--accent-green)" stroke-width="3"
                                stroke-dasharray="${pct}, 100" />
                        </svg>
                        <div style="font-size:13px;color:var(--text-muted);margin-top:4px;">正确率 ${pct}%</div>
                    </div>
                </div>

                <!-- 错题回顾 -->
                <div id="challengeReview" style="margin-bottom:28px;text-align:left;"></div>

                <!-- 按钮 -->
                <div style="display:flex;gap:12px;justify-content:center;flex-wrap:wrap;">
                    <button class="btn btn-primary" id="challengeRetryBtn" style="font-size:15px;padding:10px 28px;">
                        🔄 再来一次
                    </button>
                    <button class="btn" id="challengeHomeBtn" style="font-size:15px;padding:10px 28px;">
                        🏠 返回首页
                    </button>
                </div>

                <div style="margin-top:12px;font-size:11px;color:var(--text-muted);">
                    💡 已通过挑战的单词 7 天内不会重复出现
                </div>
            </div>
        `;

        // 错题回顾
        const reviewEl = document.getElementById('challengeReview');
        if (this._wrongIndices && this._wrongIndices.length > 0) {
            const wrongQuestions = this._wrongIndices.map(i => this._currentQuiz[i]);
            reviewEl.innerHTML = `
                <div style="font-size:14px;font-weight:600;margin-bottom:12px;color:var(--accent-red);">📝 错题回顾</div>
                ${wrongQuestions.map(q => `
                    <div style="padding:10px 14px;background:var(--bg-secondary);border-radius:var(--radius-sm);margin-bottom:8px;
                        border-left:3px solid var(--accent-red);">
                        <div style="font-weight:600;font-size:14px;">${q.word.word}</div>
                        <div style="font-size:13px;color:var(--accent-green);margin-top:4px;">✅ ${q.correctDef}</div>
                    </div>
                `).join('')}
            `;
        }

        document.getElementById('challengeRetryBtn').addEventListener('click', () => this._startGame(container));
        document.getElementById('challengeHomeBtn').addEventListener('click', () => {
            window.location.hash = '#/home';
        });
    }
}

window.ChallengePage = ChallengePage;

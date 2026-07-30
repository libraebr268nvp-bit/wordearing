/**
 * WordWiz - 挑战模式页面
 * 
 * 功能：
 * - 3 种答题模式：四选一 / 汉→英拼写 / 英→汉拼写
 * - 拼写模式带提示（首字母+下划线 / 首字提示）
 * - 难度选择：简单(熟悉度≥3) / 普通(全部) / 困难(熟悉度≤2)
 * - 生命值模式：3 条命，答错扣 1，扣完即止
 * - 计时模式：每题限时 10 秒
 * - 设置：题数（10/20/50/100/自定义）、范围（激活词书/全部/按分类/错题集）
 * - 7 天冷却、错题收集、成就触发
 * 
 * 路由: #/challenge
 * 状态机: start → playing → result
 */

class ChallengePage {
    /** 冷却天数（可用 challenge_config 覆盖） */
    static DEFAULT_COOLDOWN_DAYS = 7;
    /** 每题限时（秒）（可用 challenge_config 覆盖） */
    static DEFAULT_PER_QUESTION_TIMEOUT = 10;
    /** 生命值模式初始命数（可用 challenge_config 覆盖） */
    static DEFAULT_LIVES = 3;

    // 运行时实际使用的值（初始与默认值相同，可由配置覆盖）
    static COOLDOWN_DAYS = 7;
    static PER_QUESTION_TIMEOUT = 10;
    static LIVES = 3;

    static _cleanupTimers() {
        if (this._totalTimerInterval) {
            clearInterval(this._totalTimerInterval);
            this._totalTimerInterval = null;
        }
        if (this._perQuestionTimerInterval) {
            clearInterval(this._perQuestionTimerInterval);
            this._perQuestionTimerInterval = null;
        }
    }

    static async render(container) {
        // 加载动态配置（覆盖默认静态常量）
        const saved = await WordDB.getSetting('challenge_config', {});
        if (saved.cooldownDays !== undefined) this.COOLDOWN_DAYS = saved.cooldownDays;
        if (saved.perQuestionTimeout !== undefined) this.PER_QUESTION_TIMEOUT = saved.perQuestionTimeout;
        if (saved.lives !== undefined) this.LIVES = saved.lives;

        this._cleanupTimers();
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

    static _getLocalDateStr(date) {
        const d = date || new Date();
        const y = d.getFullYear();
        const m = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        return `${y}-${m}-${day}`;
    }

    static async _cleanRecentWords() {
        const recent = await WordDB.getSetting('challenge_recent_words', []);
        const cutoff = new Date();
        cutoff.setDate(cutoff.getDate() - this.COOLDOWN_DAYS);
        const cutoffStr = this._getLocalDateStr(cutoff);
        const filtered = recent.filter(r => r.date >= cutoffStr);
        if (filtered.length !== recent.length) {
            await WordDB.saveSetting('challenge_recent_words', filtered);
        }
    }

    static async _getAvailablePool(category, rangeType, difficulty) {
        let allWords;
        if (rangeType === 'wrong-words') {
            // 从错题集取词
            const wrongWords = await WordDB.getSetting('challenge_wrong_words', []);
            // 错题集里只有 wordId / word / definition，需要从主表取完整数据
            const wordIds = wrongWords.map(w => w.wordId).filter(Boolean);
            if (wordIds.length === 0) return [];
            allWords = await WordDB.getWordsByIds(wordIds);
        } else if (rangeType === 'all') {
            allWords = await WordDB.getAllWords();
        } else if (rangeType === 'due-review') {
            const bookIds = await WordDB.getActiveBookIds();
            allWords = await WordDB.getDueWords(bookIds);
            if (allWords.length === 0) {
                window.Toast.show('🎉 今日暂无待复习单词，继续保持！');
                return [];
            }
        } else if (rangeType === 'category' && category && category !== '全部') {
            allWords = await WordDB.getWordsByCategory(category);
        } else {
            const activeIds = await WordDB.getActiveBookIds();
            allWords = await WordDB.getWordsByBooks(activeIds);
        }

        // 排除冷却中的词
        const recent = await WordDB.getSetting('challenge_recent_words', []);
        const recentIds = new Set(recent.map(r => r.wordId));
        let filtered = allWords.filter(w => !recentIds.has(w.id));

        // 难度筛选
        if (difficulty === 'easy') {
            filtered = filtered.filter(w => (w.familiarity || 0) >= 3);
        } else if (difficulty === 'hard') {
            filtered = filtered.filter(w => (w.familiarity || 0) <= 2);
        }

        return filtered;
    }

    static async _recordRecentWords(wordIds) {
        const recent = await WordDB.getSetting('challenge_recent_words', []);
        const today = this._getLocalDateStr();
        for (const id of wordIds) {
            if (!recent.some(r => r.wordId === id && r.date === today)) {
                recent.push({ wordId: id, date: today });
            }
        }
        if (recent.length > 500) {
            recent.splice(0, recent.length - 500);
        }
        await WordDB.saveSetting('challenge_recent_words', recent);
    }

    // ===================== 错题收集 =====================

    static async _recordWrongWords(wrongQuestions) {
        if (!wrongQuestions || wrongQuestions.length === 0) return;
        const wrongWords = await WordDB.getSetting('challenge_wrong_words', []);
        const existingIds = new Set(wrongWords.map(w => w.wordId));
        const now = new Date().toISOString();
        for (const q of wrongQuestions) {
            // q 已经是单词对象（由调用方从 quiz 题目中提取的 .word）
            const word = q;
            if (word && word.id && !existingIds.has(word.id) && wrongWords.length < 200) {
                wrongWords.unshift({
                    wordId: word.id,
                    word: word.word,
                    definition: word.definition,
                    category: word.category,
                    book_source: word.book_source,
                    date: now
                });
                existingIds.add(word.id);
            }
        }
        if (wrongWords.length > 200) wrongWords.splice(200);
        await WordDB.saveSetting('challenge_wrong_words', wrongWords);
    }

    // ===================== 挑战记录 =====================

    static async _recordHistory(total, correct, elapsed, count, rangeType, mode) {
        const history = await WordDB.getSetting('challenge_history', []);
        history.push({
            id: Date.now(),
            date: new Date().toISOString(),
            total, correct, elapsed, count, rangeType, mode
        });
        if (history.length > 50) history.splice(0, history.length - 50);
        await WordDB.saveSetting('challenge_history', history);
    }

    // ===================== 开始页 =====================

    static async _renderStart(container) {
        const allWords = await WordDB.getAllWords();
        const categories = [...new Set(allWords.map(w => w.category).filter(Boolean))].sort();
        const settings = await WordDB.getSetting('challenge_settings', {
            count: 10, rangeType: 'active', category: null,
            mode: 'choice-cn', difficulty: 'normal', lives: false, timed: false
        });

        container.innerHTML = `
            <div class="challenge-start" style="text-align:center;padding:40px 20px;max-width:560px;margin:0 auto;">
                <div style="font-size:64px;margin-bottom:16px;">🎯</div>
                <h2 style="font-size:20px;margin-bottom:6px;">随机抽词挑战</h2>
                <p style="color:var(--text-muted);font-size:13px;margin-bottom:20px;" id="challengeModeDesc">
                    ${this._getModeDesc(settings.mode)}
                </p>

                <div class="challenge-settings" style="text-align:left;margin-bottom:28px;">
                    <!-- 答题模式 -->
                    <div class="challenge-setting-row">
                        <span class="setting-label">模式</span>
                        <div class="challenge-option-group" id="modeOptions">
                            <button class="challenge-opt-btn ${settings.mode === 'choice-cn' ? 'active' : ''}" data-value="choice-cn">📋 看英文选中文</button>
                            <button class="challenge-opt-btn ${settings.mode === 'choice-en' ? 'active' : ''}" data-value="choice-en">📋 看中文选英文</button>
                            <button class="challenge-opt-btn ${settings.mode === 'spelling-en' ? 'active' : ''}" data-value="spelling-en">✍️ 逐格拼写</button>
                            <button class="challenge-opt-btn ${settings.mode === 'matching' ? 'active' : ''}" data-value="matching">🃏 配对</button>
                        </div>
                    </div>

                    <!-- 题数 -->
                    <div class="challenge-setting-row">
                        <span class="setting-label">题数</span>
                        <div class="challenge-option-group" id="countOptions">
                            ${[10, 20, 50, 100].map(n => `
                                <button class="challenge-opt-btn ${settings.count === n ? 'active' : ''}" data-value="${n}">${n}</button>
                            `).join('')}
                            <button class="challenge-opt-btn ${![10, 20, 50, 100].includes(settings.count) ? 'active' : ''}" data-value="custom">自定义</button>
                        </div>
                    </div>
                    <div id="customCountRow" style="display:${![10, 20, 50, 100].includes(settings.count) ? 'flex' : 'none'};align-items:center;gap:8px;margin-top:4px;padding-left:48px;">
                        <input type="number" id="customCountInput" min="1" max="200" value="${![10, 20, 50, 100].includes(settings.count) ? settings.count : 10}"
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
                            <button class="challenge-opt-btn ${settings.rangeType === 'wrong-words' ? 'active' : ''}" data-value="wrong-words">📝 错题集</button>
                            <button class="challenge-opt-btn ${settings.rangeType === 'due-review' ? 'active' : ''}" data-value="due-review">📅 今日待复习</button>
                        </div>
                    </div>

                    <div id="categorySelectRow" style="display:${settings.rangeType === 'category' ? 'flex' : 'none'};align-items:center;gap:8px;padding-left:48px;margin-top:4px;">
                        <span style="color:var(--text-muted);font-size:12px;">分类</span>
                        <select id="categorySelect" style="padding:4px 8px;border:1px solid var(--border-color);border-radius:var(--radius-sm);background:var(--bg-secondary);color:var(--text-primary);font-size:13px;">
                            ${categories.map(c => `
                                <option value="${c}" ${settings.category === c ? 'selected' : ''}>${c}</option>
                            `).join('')}
                            ${categories.length === 0 ? '<option value="">（暂无分类）</option>' : ''}
                        </select>
                    </div>

                    <!-- 难度 -->
                    <div class="challenge-setting-row">
                        <span class="setting-label">难度</span>
                        <div class="challenge-option-group" id="difficultyOptions">
                            <button class="challenge-opt-btn ${settings.difficulty === 'easy' ? 'active' : ''}" data-value="easy">🌱 简单</button>
                            <button class="challenge-opt-btn ${settings.difficulty === 'normal' ? 'active' : ''}" data-value="normal">⚖️ 普通</button>
                            <button class="challenge-opt-btn ${settings.difficulty === 'hard' ? 'active' : ''}" data-value="hard">🔥 困难</button>
                        </div>
                    </div>

                    <!-- 附加模式 -->
                    <div class="challenge-setting-row">
                        <span class="setting-label">附加</span>
                        <div style="display:flex;gap:16px;flex-wrap:wrap;align-items:center;">
                            <label style="display:flex;align-items:center;gap:6px;font-size:13px;color:var(--text-secondary);cursor:pointer;">
                                <input type="checkbox" id="livesMode" ${settings.lives ? 'checked' : ''}>
                                ❤️ 生命值
                            </label>
                            <select id="livesCountSelect" style="padding:4px 6px;border:1px solid var(--border-color);border-radius:var(--radius-sm);background:var(--bg-secondary);color:var(--text-primary);font-size:12px;width:60px;">
                                ${[1, 3, 5, 10].map(n => `
                                    <option value="${n}" ${(settings.livesCount || this.LIVES) === n ? 'selected' : ''}>${n}条</option>
                                `).join('')}
                            </select>
                            <label style="display:flex;align-items:center;gap:6px;font-size:13px;color:var(--text-secondary);cursor:pointer;">
                                <input type="checkbox" id="timedMode" ${settings.timed ? 'checked' : ''}>
                                ⏱ 限时
                            </label>
                            <select id="timedSecondsSelect" style="padding:4px 6px;border:1px solid var(--border-color);border-radius:var(--radius-sm);background:var(--bg-secondary);color:var(--text-primary);font-size:12px;width:70px;">
                                ${[5, 10, 15, 20, 30].map(n => `
                                    <option value="${n}" ${(settings.timedSeconds || this.PER_QUESTION_TIMEOUT) === n ? 'selected' : ''}>${n}秒</option>
                                `).join('')}
                            </select>
                        </div>
                    </div>
                </div>

                <div id="challengeStartBtnWrapper">
                    <button class="btn btn-primary" id="challengeStartBtn" style="font-size:16px;padding:12px 40px;">
                        🚀 开始挑战
                    </button>
                </div>
                <div id="challengeStartError" style="color:var(--accent-red);font-size:13px;margin-top:12px;display:none;"></div>
            </div>
        `;

        // 模式切换 → 更新描述
        container.querySelectorAll('#modeOptions .challenge-opt-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                container.querySelectorAll('#modeOptions .challenge-opt-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                const desc = document.getElementById('challengeModeDesc');
                if (desc) desc.textContent = this._getModeDesc(btn.dataset.value);
            });
        });

        // 题数选择
        container.querySelectorAll('#countOptions .challenge-opt-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                container.querySelectorAll('#countOptions .challenge-opt-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                document.getElementById('customCountRow').style.display = btn.dataset.value === 'custom' ? 'flex' : 'none';
            });
        });

        // 范围选择
        container.querySelectorAll('#rangeOptions .challenge-opt-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                container.querySelectorAll('#rangeOptions .challenge-opt-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                document.getElementById('categorySelectRow').style.display = btn.dataset.value === 'category' ? 'flex' : 'none';
            });
        });

        // 开始按钮
        document.getElementById('challengeStartBtn').addEventListener('click', () => this._startGame(container));
    }

    static _getModeDesc(mode) {
        const map = {
            'choice-cn': '看英文单词，选择正确的中文释义，每题 4 选 1',
            'choice-en': '看中文释义，选择正确的英文单词，每题 4 选 1',
            'spelling-en': '看中文释义，逐格填充拼出对应的英文单词',
            'matching': '翻牌配对游戏，匹配单词与释义'
        };
        return map[mode] || '看英文单词，选择正确的中文释义，每题 4 选 1';
    }

    // ===================== 开始游戏 =====================

    static async _startGame(container) {
        // 重置防重复标记
        this._answerSubmitted = false;
        const btnWrapper = document.getElementById('challengeStartBtnWrapper');

        btnWrapper.innerHTML = '<span style="color:var(--text-muted);font-size:14px;">⏳ 正在准备题目...</span>';

        try {
            // 读取设置
            const activeModeBtn = container.querySelector('#modeOptions .challenge-opt-btn.active');
            const mode = activeModeBtn ? activeModeBtn.dataset.value : 'choice-cn';

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

            const activeDiffBtn = container.querySelector('#difficultyOptions .challenge-opt-btn.active');
            const difficulty = activeDiffBtn ? activeDiffBtn.dataset.value : 'normal';

            const lives = document.getElementById('livesMode').checked;
            const timed = document.getElementById('timedMode').checked;

            // 读取自定义生命值/限时秒数
            const livesCountEl = document.getElementById('livesCountSelect');
            const timedSecondsEl = document.getElementById('timedSecondsSelect');
            if (lives && livesCountEl) this.LIVES = parseInt(livesCountEl.value) || this.LIVES;
            if (timed && timedSecondsEl) this.PER_QUESTION_TIMEOUT = parseInt(timedSecondsEl.value) || this.PER_QUESTION_TIMEOUT;

            // 保存设置
            await WordDB.saveSetting('challenge_settings', {
                count, rangeType, category, mode, difficulty, lives, timed,
                livesCount: this.LIVES,
                timedSeconds: this.PER_QUESTION_TIMEOUT
            });

            // 配对模式：跳转到配对页面
            if (mode === 'matching') {
                await MatchingPage.render(container);
                return;
            }

            // 获取可用词库
            const pool = await this._getAvailablePool(category, rangeType, difficulty);

            const isChoiceMode = mode === 'choice-cn' || mode === 'choice-en';

            // 检查词库
            const minPool = isChoiceMode ? 4 : 2;
            if (pool.length < minPool) {
                this._showError(container, `可用单词不足 ${minPool} 个（当前 ${pool.length} 个）。冷却中的词 7 天后可再次挑战。`);
                return;
            }
            if (pool.length < count) {
                this._showError(container, `可用单词仅有 ${pool.length} 个，不足 ${count} 题。将使用全部可用单词进行挑战。`);
                count = pool.length;
            }

            // Fisher-Yates 随机抽题
            const shuffled = [...pool];
            for (let i = shuffled.length - 1; i > 0; i--) {
                const j = Math.floor(Math.random() * (i + 1));
                [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
            }
            const questions = shuffled.slice(0, count);

            // 生成题目
            const quiz = isChoiceMode
                ? questions.map(q => this._buildChoiceQuestion(q, pool, mode))
                : questions.map(q => this._buildSpellingQuestion(q, mode));

            // 进入答题
            this._currentMode = mode;
            this._currentQuiz = quiz;
            this._currentIndex = 0;
            this._correctCount = 0;
            this._wrongIndices = [];
            this._startTime = Date.now();
            this._totalTimerInterval = null;
            this._perQuestionTimerInterval = null;
            this._streakCount = 0;
            this._maxStreak = 0;
            this._lives = lives ? this.LIVES : -1;
            this._hasLivesMode = lives;
            this._hasTimedMode = timed;
            this._isFinished = false;
            this._timeoutFired = false;

            this._renderQuestion(container);

        } catch (err) {
            this._showError(container, '加载失败：' + (err.message || err));
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

    // ===================== 题目构建 =====================

    /** 构建四选一题目 */
    static _buildChoiceQuestion(correctWord, pool, direction) {
        const isCnMode = direction === 'choice-cn';
        // choice-cn：显示英文单词，选项是中文释义
        // choice-en：显示中文释义，选项是英文单词
        const correctDisplay = isCnMode
            ? (correctWord.definition || '(无释义)')
            : correctWord.word.trim();

        const distractors = new Set();
        const filtered = pool.filter(w => w.id !== correctWord.id && w.definition);
        const candidates = [...filtered];
        for (let i = candidates.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [candidates[i], candidates[j]] = [candidates[j], candidates[i]];
        }
        for (const c of candidates) {
            if (distractors.size >= 3) break;
            const val = isCnMode ? (c.definition || '(无释义)') : c.word.trim();
            if (val !== correctDisplay) distractors.add(val);
        }
        const distractorList = [...distractors];
        while (distractorList.length < 3) distractorList.push('(错误选项)');

        const options = [correctDisplay, ...distractorList];
        for (let i = options.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [options[i], options[j]] = [options[j], options[i]];
        }

        return {
            type: 'choice',
            word: correctWord,
            isCnMode,
            prompt: isCnMode ? correctWord.word : (correctWord.definition || '(无释义)'),
            correctDisplay,
            options,
            correctIndex: options.indexOf(correctDisplay)
        };
    }

    /** 构建拼写题目 */
    static _buildSpellingQuestion(word, mode) {
        const isEnToCn = mode === 'spelling-cn';
        const correctAnswer = isEnToCn ? (word.definition || '').trim() : word.word.trim();
        return {
            type: 'spelling',
            mode: mode,
            word: word,
            // 汉→英：显示 definition，正确答案是 word.word（逐格）
            // 英→汉：显示 word.word，正确答案是 definition（单输入框）
            prompt: isEnToCn ? word.word : (word.definition || '(无释义)'),
            correctAnswer: correctAnswer,
            // 逐格拼写模式：将正确答案拆成字母数组
            letters: isEnToCn ? null : correctAnswer.split(''),
            // 提示：汉→英显示首字母+下划线；英→汉显示首字
            hint: isEnToCn
                ? word.word.charAt(0) + '_'.repeat(Math.max(0, word.word.length - 1))
                : ((word.definition || '').charAt(0) || '') + '...',
            maxHints: 2,
            hintsUsed: 0
        };
    }

    // ===================== 答题页 =====================

    static _renderQuestion(container) {
        if (this._isFinished) return;
        this._timeoutFired = false;
        this._answerSubmitted = false;

        const q = this._currentQuiz[this._currentIndex];
        const total = this._currentQuiz.length;
        const elapsed = Math.floor((Date.now() - this._startTime) / 1000);
        const minutes = String(Math.floor(elapsed / 60)).padStart(2, '0');
        const seconds = String(elapsed % 60).padStart(2, '0');

        // 生命值显示（每个❤用.heart-icon包裹，供裂开动画定位）
        const livesHtml = this._hasLivesMode
            ? '<span style="font-size:14px;">' 
                + '<span class="heart-icon">❤️</span>'.repeat(Math.max(0, this._lives)) 
                + '🖤'.repeat(Math.max(0, this.LIVES - this._lives)) 
              + '</span>'
            : '';

        // 限时模式倒计时
        const timedHtml = this._hasTimedMode
            ? '<span style="font-size:14px;color:var(--accent-yellow);font-variant-numeric:tabular-nums;" id="perQuestionTimer">⏳ ' + this.PER_QUESTION_TIMEOUT + 's</span>'
            : '';

        // 拼写模式 → 拼写 UI
        if (q.type === 'spelling') {
            this._renderSpellingQuestion(container, q, total, elapsed, minutes, seconds, livesHtml, timedHtml);
            return;
        }

        // ===== 四选一 UI =====
        container.innerHTML = `
            <div class="challenge-quiz" style="max-width:600px;margin:0 auto;padding:20px;">
                <div class="challenge-progress" style="display:flex;justify-content:space-between;align-items:center;margin-bottom:24px;
                    padding:12px 16px;background:var(--bg-card);border:1px solid var(--border-color);border-radius:var(--radius-md);">
                    <span style="font-size:14px;color:var(--text-secondary);">
                        第 <strong style="color:var(--accent-blue);">${this._currentIndex + 1}</strong> / ${total} 题
                    </span>
                    <div style="display:flex;gap:12px;align-items:center;">
                        ${livesHtml}
                        ${this._streakCount >= 2 ? `<span style="font-size:13px;color:var(--accent-yellow);">🔥 ${this._streakCount} 连对</span>` : ''}
                        ${timedHtml}
                        <span style="font-size:14px;color:var(--text-secondary);font-variant-numeric:tabular-nums;" id="challengeTimer">⏱ ${minutes}:${seconds}</span>
                    </div>
                </div>

                <div style="height:4px;background:var(--border-color);border-radius:2px;margin-bottom:32px;overflow:hidden;">
                    <div style="height:100%;width:${(this._currentIndex / total) * 100}%;background:var(--accent-blue);border-radius:2px;transition:width 0.3s ease;"></div>
                </div>

                <div style="text-align:center;margin-bottom:32px;">
                    <div style="font-size:13px;color:var(--text-muted);margin-bottom:8px;">
                        ${q.isCnMode ? '请选择正确的中文释义' : '请选择正确的英文单词'}
                    </div>
                    <div style="font-size:36px;font-weight:700;color:var(--text-primary);letter-spacing:1px;margin-bottom:8px;">
                        ${q.prompt}
                    </div>
                    <div style="font-size:13px;color:var(--text-muted);">
                        ${q.word.category || ''} ${q.word.book_source ? '· ' + q.word.book_source : ''}
                        <span style="margin-left:8px;font-size:12px;">熟悉度: ${q.word.familiarity}/5</span>
                    </div>
                </div>

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

        this._startTimers(container);
        document.querySelectorAll('.challenge-option').forEach(btn => {
            btn.addEventListener('click', () => this._handleChoiceAnswer(container, btn));
        });
    }

    /** 拼写问题 UI */
    static _renderSpellingQuestion(container, q, total, elapsed, minutes, seconds, livesHtml, timedHtml) {
        const isEnToCn = q.mode === 'spelling-cn';
        const hintsRemaining = q.maxHints - q.hintsUsed;
        const hasLetterBoxes = !isEnToCn && q.letters && q.letters.length > 0;

        container.innerHTML = `
            <div class="challenge-quiz" style="max-width:600px;margin:0 auto;padding:20px;">
                <div class="challenge-progress" style="display:flex;justify-content:space-between;align-items:center;margin-bottom:24px;
                    padding:12px 16px;background:var(--bg-card);border:1px solid var(--border-color);border-radius:var(--radius-md);">
                    <span style="font-size:14px;color:var(--text-secondary);">
                        第 <strong style="color:var(--accent-blue);">${this._currentIndex + 1}</strong> / ${total} 题
                    </span>
                    <div style="display:flex;gap:12px;align-items:center;">
                        ${livesHtml}
                        ${this._streakCount >= 2 ? `<span style="font-size:13px;color:var(--accent-yellow);">🔥 ${this._streakCount} 连对</span>` : ''}
                        ${timedHtml}
                        <span style="font-size:14px;color:var(--text-secondary);font-variant-numeric:tabular-nums;" id="challengeTimer">⏱ ${minutes}:${seconds}</span>
                    </div>
                </div>

                <div style="height:4px;background:var(--border-color);border-radius:2px;margin-bottom:32px;overflow:hidden;">
                    <div style="height:100%;width:${(this._currentIndex / total) * 100}%;background:var(--accent-blue);border-radius:2px;transition:width 0.3s ease;"></div>
                </div>

                <div style="text-align:center;margin-bottom:20px;">
                    <div style="font-size:14px;color:var(--text-muted);margin-bottom:8px;">
                        ${isEnToCn ? '请输入中文释义' : '逐格输入英文单词'}
                    </div>
                    <div style="font-size:32px;font-weight:700;color:var(--text-primary);letter-spacing:1px;margin-bottom:12px;">
                        ${q.prompt}
                    </div>
                    <div style="font-size:13px;color:var(--text-muted);">
                        ${q.word.category || ''} ${q.word.book_source ? '· ' + q.word.book_source : ''}
                        <span style="margin-left:8px;font-size:12px;">熟悉度: ${q.word.familiarity}/5</span>
                    </div>
                </div>

                <!-- 提示区 -->
                <div id="hintArea" style="text-align:center;margin-bottom:16px;font-size:18px;font-weight:600;color:var(--accent-purple);letter-spacing:2px;">
                    💡 ${q.hint}
                </div>

                <!-- 输入区 -->
                <div style="text-align:center;margin-bottom:20px;">
                    ${hasLetterBoxes ? `
                        <div id="letterBoxContainer" style="display:flex;gap:6px;justify-content:center;flex-wrap:wrap;margin-bottom:12px;">
                            ${q.letters.map((_, i) => `
                                <input type="text" class="letter-input" data-index="${i}" maxlength="1"
                                       autocomplete="off" autocorrect="off" autocapitalize="off" spellcheck="false"
                                       style="width:36px;height:44px;padding:4px;border:2px solid var(--border-color);border-radius:var(--radius-sm);
                                              background:var(--bg-secondary);color:var(--text-primary);font-size:20px;text-align:center;outline:none;
                                              text-transform:lowercase;transition:var(--transition);">
                            `).join('')}
                        </div>
                    ` : `
                        <input type="text" id="spellingInput" autocomplete="off" autocorrect="off" autocapitalize="off" spellcheck="false"
                               placeholder="输入中文释义..."
                               style="width:80%;max-width:360px;padding:14px 18px;border:2px solid var(--border-color);border-radius:var(--radius-md);
                                      background:var(--bg-secondary);color:var(--text-primary);font-size:18px;text-align:center;outline:none;
                                      transition:var(--transition);">
                    `}
                    <div style="margin-top:12px;display:flex;gap:10px;justify-content:center;flex-wrap:wrap;">
                        <button class="btn btn-primary" id="spellingSubmitBtn" style="font-size:15px;padding:10px 28px;">↵ 确认</button>
                        <button class="btn btn-sm" id="spellingSkipBtn" style="font-size:13px;">跳过 →</button>
                        <button class="btn btn-sm" id="spellingHintBtn" style="font-size:13px;" ${hintsRemaining <= 0 ? 'disabled' : ''}>
                            💡 提示 (${hintsRemaining})
                        </button>
                    </div>
                </div>

                <div id="spellingFeedback" style="text-align:center;font-size:15px;min-height:24px;"></div>
            </div>
        `;

        this._startTimers(container);

        if (hasLetterBoxes) {
            // 逐格输入：绑定键盘导航
            const boxes = container.querySelectorAll('.letter-input');
            boxes.forEach((box, idx) => {
                box.addEventListener('input', (e) => {
                    const val = e.target.value.toLowerCase();
                    e.target.value = val.replace(/[^a-zA-Z'-]/g, '').toLowerCase();
                    if (e.target.value && idx < boxes.length - 1) {
                        boxes[idx + 1].focus();
                    }
                });
                box.addEventListener('keydown', (e) => {
                    if (e.key === 'Backspace' && !e.target.value && idx > 0) {
                        boxes[idx - 1].focus();
                    }
                    if (e.key === 'Enter') {
                        this._handleSpellingAnswer(container);
                    }
                });
            });
            // 第一个格子获得焦点
            setTimeout(() => { if (boxes[0]) boxes[0].focus(); }, 100);
        } else {
            // 中文输入：单输入框
            const input = document.getElementById('spellingInput');
            input.addEventListener('keydown', (e) => {
                if (e.key === 'Enter') this._handleSpellingAnswer(container);
            });
            setTimeout(() => input.focus(), 100);
        }

        document.getElementById('spellingSubmitBtn').addEventListener('click', () => this._handleSpellingAnswer(container));
        document.getElementById('spellingSkipBtn').addEventListener('click', () => this._handleSpellingSkip(container));
        const hintBtn = document.getElementById('spellingHintBtn');
        if (hintBtn) {
            hintBtn.addEventListener('click', () => this._useSpellingHint(container));
        }
    }

    /** 使用拼写提示：在逐格/输入框中填充下一个字符 */
    static _useSpellingHint(container) {
        const q = this._currentQuiz[this._currentIndex];
        if (this._answerSubmitted || q.hintsUsed >= q.maxHints) return;

        q.hintsUsed++;

        // 逐格模式
        const boxes = container.querySelectorAll('.letter-input');
        if (boxes.length > 0) {
            let nextIdx = -1;
            for (let i = 0; i < boxes.length; i++) {
                if (!boxes[i].value) { nextIdx = i; break; }
            }
            if (nextIdx >= 0 && nextIdx < q.letters.length) {
                boxes[nextIdx].value = q.letters[nextIdx].toLowerCase();
                if (nextIdx < boxes.length - 1) boxes[nextIdx + 1].focus();
                else boxes[nextIdx].focus();
            }
        } else {
            // 单输入框模式
            const input = document.getElementById('spellingInput');
            if (!input) return;
            const correct = q.correctAnswer;
            const currentVal = input.value;
            let nextChar = '';
            for (let i = 0; i < correct.length; i++) {
                if (i >= currentVal.length || currentVal[i] !== correct[i]) {
                    nextChar = correct[i];
                    break;
                }
            }
            if (nextChar) {
                input.value = currentVal + nextChar;
                input.focus();
            }
        }

        // 更新提示按钮文本
        const hintBtn = document.getElementById('spellingHintBtn');
        const hintsRemaining = q.maxHints - q.hintsUsed;
        if (hintBtn) {
            if (hintsRemaining <= 0) {
                hintBtn.disabled = true;
                hintBtn.textContent = '💡 提示 (0)';
            } else {
                hintBtn.textContent = `💡 提示 (${hintsRemaining})`;
            }
        }
    }

    /** 启动总计时 + 每題计时 */
    static _startTimers(container) {
        // 总计时
        if (this._totalTimerInterval) clearInterval(this._totalTimerInterval);
        this._totalTimerInterval = setInterval(() => {
            const el = document.getElementById('challengeTimer');
            if (!el) { clearInterval(this._totalTimerInterval); return; }
            const e = Math.floor((Date.now() - this._startTime) / 1000);
            el.textContent = '⏱ ' + String(Math.floor(e / 60)).padStart(2, '0') + ':' + String(e % 60).padStart(2, '0');
        }, 1000);

        // 每题限时
        if (this._perQuestionTimerInterval) clearInterval(this._perQuestionTimerInterval);
        if (this._hasTimedMode) {
            let remaining = this.PER_QUESTION_TIMEOUT;
            const perEl = document.getElementById('perQuestionTimer');
            if (perEl) perEl.textContent = '⏳ ' + remaining + 's';

            this._perQuestionTimerInterval = setInterval(() => {
                const pel = document.getElementById('perQuestionTimer');
                if (!pel) { clearInterval(this._perQuestionTimerInterval); return; }
                remaining--;
                if (remaining <= 0) {
                    pel.textContent = '⏳ 0s';
                    clearInterval(this._perQuestionTimerInterval);
                    // 超时 → 当作答错
                    this._handleTimeout(container);
                } else {
                    pel.textContent = '⏳ ' + remaining + 's';
                    if (remaining <= 3) pel.style.color = 'var(--accent-red)';
                }
            }, 1000);
        }
    }

    // ===================== 四选一答题处理 =====================

    static async _handleChoiceAnswer(container, clickedBtn) {
        if (this._answerSubmitted) return;
        this._answerSubmitted = true;
        const selectedIndex = parseInt(clickedBtn.dataset.index);

        const q = this._currentQuiz[this._currentIndex];
        const isCorrect = selectedIndex === q.correctIndex;

        // 标记答案（在更新熟悉度之前先标记，避免重复 push wrongIndices）
        document.querySelectorAll('.challenge-option').forEach(btn => {
            btn.style.pointerEvents = 'none';
            const idx = parseInt(btn.dataset.index);
            if (idx === q.correctIndex) {
                btn.style.borderColor = 'var(--accent-green)';
                btn.style.background = 'rgba(74, 222, 128, 0.1)';
                btn.style.boxShadow = '0 0 12px rgba(74, 222, 128, 0.2)';
                if (isCorrect) btn.classList.add('correct-flash');
            } else if (idx === selectedIndex && !isCorrect) {
                btn.style.borderColor = 'var(--accent-red)';
                btn.style.background = 'rgba(255, 82, 82, 0.1)';
                btn.style.boxShadow = '0 0 12px rgba(255, 82, 82, 0.2)';
                btn.classList.add('wrong-shake');
            }
        });

        clickedBtn.innerHTML += isCorrect
            ? ' <span style="margin-left:auto;font-size:18px;">✅</span>'
            : ' <span style="margin-left:auto;font-size:18px;">❌</span>';

        // 心碎飘出
        if (!isCorrect) this._showHeartBreakEffect(container);

        // 更新熟悉度（_updateFamiliarity 内部已处理 correctCount/错误记录/生命值）
        await this._updateFamiliarity(q.word, isCorrect);

        this._advanceAfterDelay(container, 800);
    }

    // ===================== 拼写答题处理 =====================

    /** 获取拼写用户答案（逐格拼接 or 单输入框） */
    static _getSpellingUserAnswer(container) {
        const boxes = container.querySelectorAll('.letter-input');
        if (boxes.length > 0) {
            return Array.from(boxes).map(b => b.value).join('').trim();
        }
        const input = document.getElementById('spellingInput');
        return input ? input.value.trim() : '';
    }

    /** 禁用拼写所有输入 */
    static _disableSpellingInputs(container) {
        container.querySelectorAll('.letter-input').forEach(b => b.disabled = true);
        const input = document.getElementById('spellingInput');
        if (input) input.disabled = true;
        document.getElementById('spellingSubmitBtn').disabled = true;
        document.getElementById('spellingSkipBtn').disabled = true;
    }

    /** 对所有拼写输入框添加样式 */
    static _applySpellingStyle(container, isCorrect) {
        const boxes = container.querySelectorAll('.letter-input');
        const input = document.getElementById('spellingInput');
        const color = isCorrect ? 'var(--accent-green)' : 'var(--accent-red)';
        const cls = isCorrect ? 'correct-flash' : 'wrong-shake';
        if (boxes.length > 0) {
            boxes.forEach(b => { b.style.borderColor = color; b.classList.add(cls); });
        } else if (input) {
            input.style.borderColor = color;
            input.classList.add(cls);
        }
    }

    static async _handleSpellingAnswer(container) {
        if (this._answerSubmitted) return;
        const feedback = document.getElementById('spellingFeedback');
        const q = this._currentQuiz[this._currentIndex];

        const userAnswer = this._getSpellingUserAnswer(container);
        if (!userAnswer) {
            feedback.textContent = '⚠️ 请输入答案';
            feedback.style.color = 'var(--accent-yellow)';
            return;
        }
        this._answerSubmitted = true;

        // 忽略大小写比较（英文拼写）
        const isCorrect = q.mode === 'spelling-cn'
            ? userAnswer === q.correctAnswer
            : userAnswer.toLowerCase() === q.correctAnswer.toLowerCase();

        this._disableSpellingInputs(container);
        await this._updateFamiliarity(q.word, isCorrect);

        this._applySpellingStyle(container, isCorrect);

        if (isCorrect) {
            feedback.textContent = '✅ 正确！';
            feedback.style.color = 'var(--accent-green)';
        } else {
            this._showHeartBreakEffect(container);
            const displayCorrect = q.mode === 'spelling-cn' ? q.correctAnswer : q.word.word;
            feedback.innerHTML = '❌ 正确答案：<strong style="color:var(--accent-green);">' + displayCorrect + '</strong>';
            feedback.style.color = 'var(--accent-red)';
        }

        this._advanceAfterDelay(container, 1200);
    }

    static async _handleSpellingSkip(container) {
        if (this._answerSubmitted) return;
        this._answerSubmitted = true;

        const feedback = document.getElementById('spellingFeedback');
        const q = this._currentQuiz[this._currentIndex];

        this._disableSpellingInputs(container);

        await this._updateFamiliarity(q.word, false);
        this._showHeartBreakEffect(container);
        const displayCorrect = q.mode === 'spelling-cn' ? q.correctAnswer : q.word.word;
        feedback.innerHTML = '⏭ 正确答案：<strong style="color:var(--accent-green);">' + displayCorrect + '</strong>';
        feedback.style.color = 'var(--accent-red)';

        this._advanceAfterDelay(container, 1200);
    }

    /** 超时处理 */
    static async _handleTimeout(container) {
        if (this._answerSubmitted) return;
        this._answerSubmitted = true;
        this._timeoutFired = true;

        const q = this._currentQuiz[this._currentIndex];

        if (q.type === 'choice') {
            // 禁用所有选项
            document.querySelectorAll('.challenge-option').forEach(btn => {
                btn.style.pointerEvents = 'none';
                btn.style.opacity = '0.6';
                const idx = parseInt(btn.dataset.index);
                if (idx === q.correctIndex) {
                    btn.style.borderColor = 'var(--accent-green)';
                    btn.style.background = 'rgba(74, 222, 128, 0.1)';
                }
            });
        } else {
            this._disableSpellingInputs(container);
            this._applySpellingStyle(container, false);
            const feedback = document.getElementById('spellingFeedback');
            if (feedback) {
                const displayCorrect = q.mode === 'spelling-cn' ? q.correctAnswer : q.word.word;
                feedback.innerHTML = '⏰ 超时！正确答案：<strong style="color:var(--accent-green);">' + displayCorrect + '</strong>';
                feedback.style.color = 'var(--accent-red)';
            }
        }

        await this._updateFamiliarity(q.word, false);
        this._showHeartBreakEffect(container);

        this._advanceAfterDelay(container, 1200);
    }

    // ===================== 通用答题逻辑 =====================

    static async _updateFamiliarity(word, isCorrect) {
        try {
            if (isCorrect) {
                await WordDB.updateWord(word.id, {
                    familiarity: Math.min(5, (word.familiarity || 0) + 1)
                });
                // 记录学习事件到 stats 表（使学习趋势图/热力图能反映挑战数据）
                await WordDB.recordStudyEvent(word.word, word.category || '挑战');
                this._correctCount++;
                this._streakCount++;
                if (this._streakCount > this._maxStreak) this._maxStreak = this._streakCount;

                // 连击弹窗
                if (this._streakCount >= 2) {
                    this._showComboPopup(this._streakCount);
                }
            } else {
                await WordDB.updateWord(word.id, {
                    familiarity: Math.max(0, (word.familiarity || 0) - 1)
                });
                this._wrongIndices.push(this._currentIndex);
                this._streakCount = 0;
                if (this._hasLivesMode) {
                    this._lives--;
                    // 爱心裂开动画：找到当前第 _lives 个 ❤️（扣之前的 _lives+1）
                    this._animateHeartBreak();
                }
            }
        } catch (e) {
            console.warn('[Challenge] 更新熟悉度失败:', e);
        }
    }

    /** 爱心裂开动画 */
    static _animateHeartBreak() {
        const livesSpan = document.querySelector('#challengeContent .challenge-progress span');
        if (!livesSpan) return;
        // 找到第 this._lives 个 ❤️（因为 _lives 已经减过 1 了）
        const hearts = livesSpan.querySelectorAll('.heart-icon');
        if (hearts.length > 0 && this._lives >= 0 && this._lives < hearts.length) {
            hearts[this._lives].classList.add('heart-breaking');
            // 动画结束后替换为 🖤
            const target = hearts[this._lives];
            target.addEventListener('animationend', () => {
                target.textContent = '🖤';
                target.classList.remove('heart-breaking');
            }, { once: true });
        }
    }

    /** 连击弹窗（不阻塞交互） */
    static _showComboPopup(count) {
        const el = document.createElement('div');
        el.textContent = count >= 5 ? '⚡ ' + count + '连击！' : '🔥 ' + count + '连击！';
        el.style.cssText = 'position:fixed;top:30%;left:50%;transform:translateX(-50%);font-size:28px;font-weight:700;z-index:999;pointer-events:none;animation:comboPop 1s ease forwards;';
        document.body.appendChild(el);
        setTimeout(() => el.remove(), 1000);
    }

    /** 答错时生成心碎飘出 */
    static _showHeartBreakEffect(container) {
        const el = document.createElement('div');
        el.textContent = '💔';
        el.className = 'heart-float-up';
        // 定位到答题区域中间
        const quiz = container.querySelector('.challenge-quiz');
        if (quiz) {
            const rect = quiz.getBoundingClientRect();
            el.style.left = (rect.left + rect.width / 2 - 12) + 'px';
            el.style.top = (rect.top + 40) + 'px';
        } else {
            el.style.left = '50%';
            el.style.top = '30%';
        }
        document.body.appendChild(el);
        setTimeout(() => el.remove(), 800);
    }

    /** @deprecated 不再使用 — _updateFamiliarity 已统一处理 */
    static _recordWrongAnswer(word) {
        // 保留此方法仅为兼容性，实际不再被调用
    }


    static _advanceAfterDelay(container, delay) {
        if (this._perQuestionTimerInterval) {
            clearInterval(this._perQuestionTimerInterval);
            this._perQuestionTimerInterval = null;
        }

        setTimeout(() => {
            // 生命值模式：命数归零则结束
            if (this._hasLivesMode && this._lives <= 0) {
                this._isFinished = true;
                this._renderResult(container);
                return;
            }

            if (this._currentIndex + 1 < this._currentQuiz.length) {
                this._currentIndex++;
                this._renderQuestion(container);
            } else {
                this._isFinished = true;
                this._renderResult(container);
            }
        }, delay);
    }

    // ===================== 结果页 =====================

    static async _renderResult(container) {
        if (this._totalTimerInterval) {
            clearInterval(this._totalTimerInterval);
            this._totalTimerInterval = null;
        }
        if (this._perQuestionTimerInterval) {
            clearInterval(this._perQuestionTimerInterval);
            this._perQuestionTimerInterval = null;
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

        // 如果是生命值模式下提前结束，改评价
        if (this._hasLivesMode && this._lives <= 0) {
            emoji = '💔';
            comment = '生命值耗尽！下次加油！';
        }

        // 记录冷却词
        // 生命值模式下只记录实际答过的题目，避免未答的题也被锁 7 天
        let wordIds;
        if (this._hasLivesMode && this._lives <= 0) {
            // 命数耗尽：只记录已答过的题（_wrongIndices 包含答错的索引）
            wordIds = [];
            for (let i = 0; i <= this._currentIndex; i++) {
                wordIds.push(this._currentQuiz[i].word.id);
            }
        } else {
            wordIds = this._currentQuiz.map(q => q.word.id);
        }
        await this._recordRecentWords(wordIds);

        // 记录挑战历史
        const settings = await WordDB.getSetting('challenge_settings', { count: 10, rangeType: 'active' });
        await this._recordHistory(total, this._correctCount, elapsed, settings.count, settings.rangeType, this._currentMode);

        // 记录错题
        const wrongQuestions = this._wrongIndices?.length > 0
            ? this._wrongIndices.map(i => this._currentQuiz[i]).map(q => q.word)
            : [];
        await this._recordWrongWords(wrongQuestions);

        // 触发成就
        await AchievementHelper.recordChallenge(this._correctCount, total, elapsed, this._maxStreak);

        container.innerHTML = `
            <div class="challenge-result" style="text-align:center;padding:40px 20px;max-width:480px;margin:0 auto;">
                <div style="font-size:72px;margin-bottom:16px;">${emoji}</div>
                <h2 style="font-size:22px;margin-bottom:8px;">挑战完成！</h2>
                <p style="color:var(--text-muted);font-size:14px;margin-bottom:28px;">${comment}</p>

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

                <div id="challengeReview" style="margin-bottom:28px;text-align:left;"></div>

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
            const wrongQs = this._wrongIndices.map(i => this._currentQuiz[i]);
            reviewEl.innerHTML = `
                <div style="font-size:14px;font-weight:600;margin-bottom:12px;color:var(--accent-red);">📝 错题回顾</div>
                ${wrongQs.map(q => {
                const word = q.word;
                const correctDisplay = q.type === 'spelling'
                    ? (q.mode === 'spelling-cn' ? q.correctAnswer : word.word)
                    : q.correctDisplay;
                return `
                        <div style="padding:10px 14px;background:var(--bg-secondary);border-radius:var(--radius-sm);margin-bottom:8px;
                            border-left:3px solid var(--accent-red);">
                            <div style="font-weight:600;font-size:14px;">${word.word}</div>
                            <div style="font-size:13px;color:var(--accent-green);margin-top:4px;">✅ ${correctDisplay}</div>
                        </div>
                    `;
            }).join('')}
            `;
        }

        document.getElementById('challengeRetryBtn').addEventListener('click', async () => {
            const content = document.getElementById('challengeContent');
            if (content) {
                await this._renderStart(content);
                setTimeout(() => {
                    const startBtn = document.getElementById('challengeStartBtn');
                    if (startBtn) startBtn.click();
                }, 100);
            }
        });
        document.getElementById('challengeHomeBtn').addEventListener('click', () => {
            window.location.hash = '#/home';
        });
    }
}

window.ChallengePage = ChallengePage;

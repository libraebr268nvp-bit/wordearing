/**
 * WordWiz - 成就系统
 * 
 * 管理 10 个成就的检测、解锁、展示：
 * 
 * 📚 学习类：
 * - 🎓 首次学习     → 学习任意单词
 * - 💯 百词达人     → 累计学习 100 个单词
 * - 🔥 连续 7 天   → 连续 7 天每天至少学习一次
 * - ⭐ 收藏 50 个   → 收藏 50 个单词
 * - 🧹 清理大师     → 清空过一次回收站
 * 
 * 🎯 挑战类：
 * - 🎯 初次挑战     → 完成任意一次挑战
 * - 💯 挑战达人     → 累计完成 50 次挑战
 * - 🌟 满分王       → 单次正确率 100%
 * - ⚡ 速度之星     → 单次用时 < 30 秒
 * - 🧠 连对达人     → 连续答对 10 题
 * 
 * 成就数据存储在 settings 表的 achievements key 中，格式：
 * { "first_study": { unlocked: true, unlockedAt: "2026-05-11T12:00:00" }, ... }
 * 
 * 结构预留 group / rarity 字段，方便未来扩展。
 */

class AchievementHelper {
    /** 成就定义（预留 group/rarity 字段方便未来扩展） */
    static DEFINITIONS = [
        // ===== 学习类 =====
        { id: 'first_study',      icon: '🎓', title: '首次学习',      desc: '学习任意一个单词',               group: 'study',   rarity: 'common' },
        { id: 'hundred_words',    icon: '💯', title: '百词达人',      desc: '累计学习 100 个单词',            group: 'study',   rarity: 'rare' },
        { id: 'seven_days',       icon: '🔥', title: '连续 7 天',     desc: '连续 7 天每天至少学习一次',       group: 'study',   rarity: 'rare' },
        { id: 'fifty_favorites',  icon: '⭐', title: '收藏 50 个',    desc: '收藏 50 个单词',                 group: 'study',   rarity: 'rare' },
        { id: 'trash_cleaner',    icon: '🧹', title: '清理大师',      desc: '清空过一次回收站',               group: 'study',   rarity: 'common' },
        // ===== 挑战类 =====
        { id: 'first_challenge',  icon: '🎯', title: '初次挑战',      desc: '完成任意一次挑战',               group: 'challenge', rarity: 'common' },
        { id: 'challenge_master', icon: '💯', title: '挑战达人',      desc: '累计完成 50 次挑战',             group: 'challenge', rarity: 'epic' },
        { id: 'perfect_score',    icon: '🌟', title: '满分王',       desc: '单次挑战正确率 100%',            group: 'challenge', rarity: 'epic' },
        { id: 'speed_star',       icon: '⚡', title: '速度之星',     desc: '单次挑战用时不超过 30 秒',        group: 'challenge', rarity: 'rare' },
        { id: 'streak_master',    icon: '🧠', title: '连对达人',     desc: '单次挑战连续答对 10 题',          group: 'challenge', rarity: 'epic' },
    ];

    /** 事件触发计数 key */
    static STUDY_COUNT_KEY = 'achievement_study_count';
    static CHALLENGE_COUNT_KEY = 'achievement_challenge_count';

    /**
     * 从数据库读取已解锁成就
     * @returns {Promise<Object>} { id: { unlocked, unlockedAt }, ... }
     */
    static async _getAchievements() {
        const data = await WordDB.getSetting('achievements', {});
        // 确保所有定义都存在
        for (const def of this.DEFINITIONS) {
            if (!data[def.id]) {
                data[def.id] = { unlocked: false, unlockedAt: null };
            }
        }
        return data;
    }

    /**
     * 保存成就状态到数据库
     */
    static async _saveAchievements(data) {
        await WordDB.saveSetting('achievements', data);
    }

    /**
     * 尝试解锁一个成就（如果尚未解锁）
     * @returns {Promise<Object|null>} 返回解锁的成就定义，或 null
     */
    static async _unlock(id) {
        const data = await this._getAchievements();
        if (data[id]?.unlocked) return null; // 已解锁

        data[id] = { unlocked: true, unlockedAt: new Date().toISOString() };
        await this._saveAchievements(data);
        
        const def = this.DEFINITIONS.find(d => d.id === id);
        this._showCelebration(def);
        return def;
    }

    /**
     * 庆祝动画（CSS 动画）
     */
    static _showCelebration(def) {
        const el = document.createElement('div');
        el.className = 'achievement-celebration';
        el.innerHTML = `
            <div class="achievement-popup">
                <div class="achievement-popup-icon">${def.icon}</div>
                <div class="achievement-popup-title">🎉 成就解锁！</div>
                <div class="achievement-popup-name">${def.title}</div>
                <div class="achievement-popup-desc">${def.desc}</div>
            </div>
        `;
        document.body.appendChild(el);

        // 3.5 秒后自动移除
        setTimeout(() => {
            el.classList.add('achievement-celebration-fadeout');
            setTimeout(() => el.remove(), 500);
        }, 3000);
    }

    // ===================== 学习类成就检测 =====================

    /**
     * 检测「首次学习」成就
     */
    static async checkFirstStudy() {
        const count = await WordDB.getSetting(this.STUDY_COUNT_KEY, 0);
        if (count >= 1) return this._unlock('first_study');
        return null;
    }

    /**
     * 检测「百词达人」成就
     */
    static async checkHundredWords() {
        const count = await WordDB.getSetting(this.STUDY_COUNT_KEY, 0);
        if (count >= 100) return this._unlock('hundred_words');
        return null;
    }

    /**
     * 检测「连续 7 天」成就
     */
    static async checkSevenDays() {
        const trend = await WordDB.getStudyTrend(7);
        const allHaveData = trend.every(d => d.count > 0);
        if (allHaveData && trend.length >= 7) return this._unlock('seven_days');
        return null;
    }

    /**
     * 检测「收藏 50 个」成就
     */
    static async checkFiftyFavorites() {
        const stats = await WordDB.getStats();
        if (stats.favoriteCount >= 50) return this._unlock('fifty_favorites');
        return null;
    }

    /**
     * 检测「清理大师」成就
     */
    static async checkTrashCleaner() {
        const flag = await WordDB.getSetting('achievement_trash_cleaned', false);
        if (flag) return this._unlock('trash_cleaner');
        return null;
    }

    /**
     * 标记回收站已清空
     */
    static async markTrashCleaned() {
        await WordDB.saveSetting('achievement_trash_cleaned', true);
        return this._unlock('trash_cleaner');
    }

    /**
     * 记录一次学习动作（由 wordCard 等触发）
     */
    static async recordStudy() {
        let count = await WordDB.getSetting(this.STUDY_COUNT_KEY, 0);
        count++;
        await WordDB.saveSetting(this.STUDY_COUNT_KEY, count);
        
        await WordDB.recordStudyEvent('(学习动作)', '全部');
        
        await this.checkFirstStudy();
        await this.checkHundredWords();
        await this.checkSevenDays();
    }

    // ===================== 挑战类成就检测 =====================

    /**
     * 记录挑战结果并检测相关成就
     * 由 challenge.js 的 _renderResult 调用
     * 
     * @param {number} correctCount - 正确数
     * @param {number} total - 总题数
     * @param {number} elapsed - 用时（秒）
     * @param {number} maxStreak - 最大连对数
     */
    static async recordChallenge(correctCount, total, elapsed, maxStreak) {
        // 累计挑战次数
        let challengeCount = await WordDB.getSetting(this.CHALLENGE_COUNT_KEY, 0);
        challengeCount++;
        await WordDB.saveSetting(this.CHALLENGE_COUNT_KEY, challengeCount);

        // 逐项检测
        await this._unlock('first_challenge');  // 初次挑战——只要调用就一定能解锁

        if (challengeCount >= 50) {
            await this._unlock('challenge_master');
        }

        const pct = total > 0 ? Math.round((correctCount / total) * 100) : 0;
        if (pct === 100) {
            await this._unlock('perfect_score');
        }

        if (elapsed < 30) {
            await this._unlock('speed_star');
        }

        if (maxStreak >= 10) {
            await this._unlock('streak_master');
        }
    }

    // ===================== 全量检测 + 渲染 =====================

    /**
     * 全量检测所有成就
     */
    static async checkAll() {
        await this.checkFirstStudy();
        await this.checkHundredWords();
        await this.checkSevenDays();
        await this.checkFiftyFavorites();
        await this.checkTrashCleaner();
        
        // 挑战类：检查已有的挑战记录
        const challengeCount = await WordDB.getSetting(this.CHALLENGE_COUNT_KEY, 0);
        if (challengeCount >= 1) await this._unlock('first_challenge');
        if (challengeCount >= 50) await this._unlock('challenge_master');
        
        // 其他挑战成就需要在挑战中触发，checkAll 不重复检测
    }

    /**
     * 在设置页渲染成就墙
     * @param {HTMLElement} container
     */
    static async renderWall(container) {
        const data = await this._getAchievements();

        container.innerHTML = `
            <div class="achievement-wall">
                <h3>🏆 成就墙</h3>
                <div class="achievement-grid">
                    ${this.DEFINITIONS.map(def => {
                        const ach = data[def.id] || { unlocked: false };
                        const isUnlocked = ach.unlocked;
                        const date = ach.unlockedAt ? new Date(ach.unlockedAt).toLocaleDateString('zh-CN') : '';
                        return `
                            <div class="achievement-card ${isUnlocked ? 'unlocked' : 'locked'}">
                                <div class="achievement-icon">${isUnlocked ? def.icon : '🔒'}</div>
                                <div class="achievement-title">${def.title}</div>
                                <div class="achievement-desc">${def.desc}</div>
                                ${isUnlocked ? `<div class="achievement-date">${date}</div>` : '<div class="achievement-date">未解锁</div>'}
                            </div>
                        `;
                    }).join('')}
                </div>
                <div style="text-align:center;margin-top:12px;">
                    <button class="btn btn-sm" id="refreshAchievementsBtn" style="font-size:12px;">🔄 刷新成就</button>
                </div>
            </div>
        `;

        // 绑定刷新按钮
        const refreshBtn = container.querySelector('#refreshAchievementsBtn');
        if (refreshBtn) {
            refreshBtn.addEventListener('click', async () => {
                const before = JSON.stringify(await this._getAchievements());
                await this.checkAll();
                const after = JSON.stringify(await this._getAchievements());
                await this.renderWall(container);
                if (before !== after) {
                    window.Toast.show('🏆 成就已更新');
                } else {
                    window.Toast.show('没有新的成就可解锁');
                }
            });
        }
    }
}

window.AchievementHelper = AchievementHelper;

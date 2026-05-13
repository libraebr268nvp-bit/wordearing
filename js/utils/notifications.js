/**
 * WordWiz - 通知工具
 * 
 * 使用 Web Notifications API + Toast 兜底实现每日复习提醒
 * 
 * 提醒触发条件：
 * 1. 设置中已开启提醒
 * 2. 当天尚未触发过提醒
 * 3. 当前时间 ≥ 设置的提醒时间
 * 
 * 提醒方式（优先级由高到低）：
 * 1. 浏览器桌面通知（需授予权限）
 * 2. 页面内 Toast 提示（兜底方案）
 * 
 * 注意：纯前端应用无法在浏览器关闭后推送提醒，
 * 需要保持浏览器标签页打开。
 */

class NotificationHelper {
    /**
     * 请求通知权限
     * @returns {Promise<boolean>} 是否获得权限
     */
    static async requestPermission() {
        if (!('Notification' in window)) {
            console.log('[通知] 此浏览器不支持通知功能');
            return false;
        }
        if (Notification.permission === 'granted') return true;
        if (Notification.permission === 'denied') {
            console.warn('[通知] 通知权限已被用户拒绝，请在浏览器设置中重新开启');
            return false;
        }
        
        const permission = await Notification.requestPermission();
        const granted = permission === 'granted';
        console.log('[通知] 权限请求结果:', granted ? '已授予' : '已拒绝');
        return granted;
    }

    /**
     * 检查当前通知权限状态
     * @returns {string} 'granted' | 'denied' | 'default' | 'unsupported'
     */
    static getPermissionStatus() {
        if (!('Notification' in window)) return 'unsupported';
        return Notification.permission;
    }

    /**
     * 发送复习提醒
     * 优先使用桌面通知，不支持/无权限时用 Toast 兜底
     * @param {number} wordCount - 需要复习的单词数
     */
    static sendReviewReminder(wordCount) {
        const title = '📖 WordWiz 复习提醒';
        const message = wordCount > 0 
            ? `你有 ${wordCount} 个熟悉度低于 3 的单词需要复习！` 
            : '今天的单词都已掌握，明天继续加油！';

        // 方案 1：桌面通知（需要权限）
        if ('Notification' in window && Notification.permission === 'granted') {
            try {
                const notif = new Notification(title, {
                    body: message,
                    icon: null
                });
                // 点击通知跳转到首页
                notif.onclick = () => {
                    window.focus();
                    if (window.location.hash !== '#/home') {
                        window.location.hash = '#/home';
                    }
                };
                console.log('[通知] 桌面通知已发送');
                return;
            } catch (e) {
                console.warn('[通知] 桌面通知发送失败:', e);
            }
        }

        // 方案 2：Toast 兜底（始终可用）
        if (typeof window.Toast?.show === 'function') {
            window.Toast.show('🔔 ' + message, 'info');
        }

        // 方案 3：尝试播放提示音（简单的 Web Audio）
        try {
            const ctx = new (window.AudioContext || window.webkitAudioContext)();
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.connect(gain);
            gain.connect(ctx.destination);
            osc.frequency.value = 880;
            osc.type = 'sine';
            gain.gain.value = 0.3;
            osc.start();
            osc.stop(ctx.currentTime + 0.3);
            // 两次提示音
            setTimeout(() => {
                const ctx2 = new (window.AudioContext || window.webkitAudioContext)();
                const osc2 = ctx2.createOscillator();
                const gain2 = ctx2.createGain();
                osc2.connect(gain2);
                gain2.connect(ctx2.destination);
                osc2.frequency.value = 1100;
                osc2.type = 'sine';
                gain2.gain.value = 0.3;
                osc2.start();
                osc2.stop(ctx2.currentTime + 0.3);
            }, 400);
        } catch (e) {
            // 声音不可用，忽略
        }
    }

    /**
     * 获取需要复习的单词数量（熟悉度 < 3）
     * @returns {Promise<number>}
     */
    static async getReviewCount() {
        try {
            const allWords = await WordDB.getAllWords();
            return allWords.filter(w => (w.familiarity || 0) < 3).length;
        } catch (e) {
            console.warn('[通知] 获取复习数量失败:', e);
            return 0;
        }
    }

    /**
     * 检查并触发每日提醒
     * 由 app.js 和设置页定时调用
     */
    static _getLocalDateStr() {
        const d = new Date();
        const y = d.getFullYear();
        const m = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        return `${y}-${m}-${day}`;
    }

    static async checkDailyReminder() {
        try {
            const enabled = await WordDB.getSetting('reminder_enabled', false);
            if (!enabled) return;

            const reminderTime = await WordDB.getSetting('reminder_time', '20:00');
            const lastSentDate = await WordDB.getSetting('reminder_last_sent', '');
            const today = this._getLocalDateStr();

            // 今天已经发过了就不重复发
            if (lastSentDate === today) {
                // 但更新状态显示
                await this._updateReminderStatus(true);
                return;
            }

            // 检查当前时间是否到达提醒时间
            const now = new Date();
            const [hour, minute] = reminderTime.split(':').map(Number);
            const reminderDate = new Date(now);
            reminderDate.setHours(hour, minute, 0, 0);

            if (now >= reminderDate) {
                const count = await NotificationHelper.getReviewCount();
                NotificationHelper.sendReviewReminder(count);
                await WordDB.saveSetting('reminder_last_sent', today);
                await this._updateReminderStatus(true);
                console.log('[通知] 今日提醒已发送');
            } else {
                await this._updateReminderStatus(false);
            }
        } catch (e) {
            console.warn('[通知] checkDailyReminder 出错:', e);
        }
    }

    /**
     * 更新提醒状态的内部记录（仅供开发者面板/控制台调试用）
     */
    static async _updateReminderStatus(sent) {
        await WordDB.saveSetting('_reminder_check_status', {
            lastCheck: new Date().toISOString(),
            sent: sent,
            permission: this.getPermissionStatus()
        });
    }

    /**
     * 获取提醒系统当前状态信息（用于设置页显示）
     * @returns {Promise<object>}
     */
    static async getStatus() {
        const enabled = await WordDB.getSetting('reminder_enabled', false);
        const reminderTime = await WordDB.getSetting('reminder_time', '20:00');
        const lastSent = await WordDB.getSetting('reminder_last_sent', '');
        const today = this._getLocalDateStr();
        const permission = this.getPermissionStatus();

        return {
            enabled,
            reminderTime,
            alreadySentToday: lastSent === today,
            permission,
            hasNotificationSupport: 'Notification' in window,
            isPageVisible: document.visibilityState === 'visible'
        };
    }

    /**
     * 启动定时检查
     * 使用更可靠的重试策略：每分钟检查一次
     * 同时监听页面可见性变化，切回前台时立即检查一次
     */
    static startReminderChecker() {
        console.log('[通知] 启动提醒检查器...');

        // 立即检查一次
        setTimeout(() => {
            this.checkDailyReminder();
        }, 2000); // 延迟 2 秒确保数据库已就绪

        // 每分钟检查一次
        setInterval(() => {
            this.checkDailyReminder();
        }, 60000);

        // 监听页面可见性变化：用户切回标签页时立即检查
        document.addEventListener('visibilitychange', () => {
            if (document.visibilityState === 'visible') {
                console.log('[通知] 页面回到前台，检查提醒...');
                this.checkDailyReminder();
            }
        });

        // 首次启动时输出权限状态
        const status = this.getPermissionStatus();
        if ('Notification' in window) {
            if (status === 'denied') {
                console.warn('[通知] ⚠️ 通知权限已被浏览器拒绝，如需接收桌面通知，请在浏览器站点设置中允许');
            } else if (status === 'default') {
                console.log('[通知] 通知权限未设置，在设置页开启提醒时会自动请求权限');
            } else {
                console.log('[通知] ✅ 通知权限已授予，可以接收桌面通知');
            }
        } else {
            console.log('[通知] 当前浏览器不支持桌面通知，使用页面内 Toast 提示');
        }
    }
}

window.NotificationHelper = NotificationHelper;


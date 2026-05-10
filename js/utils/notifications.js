/**
 * WordWiz - 通知工具
 * 
 * 使用 Web Notifications API 实现每日复习提醒
 */

class NotificationHelper {
    /**
     * 请求通知权限
     */
    static async requestPermission() {
        if (!('Notification' in window)) {
            console.log('此浏览器不支持通知功能');
            return false;
        }
        if (Notification.permission === 'granted') return true;
        if (Notification.permission === 'denied') return false;
        
        const permission = await Notification.requestPermission();
        return permission === 'granted';
    }

    /**
     * 发送复习提醒通知
     * @param {number} wordCount - 需要复习的单词数
     */
    static sendReviewReminder(wordCount) {
        if (!('Notification' in window)) return;
        if (Notification.permission !== 'granted') return;
        
        const title = '📖 WordWiz 复习提醒';
        const body = wordCount > 0 
            ? `你有 ${wordCount} 个熟悉度低于 3 的单词需要复习！` 
            : '今天的单词都已掌握，明天继续加油！';
        
        new Notification(title, {
            body: body,
            icon: '/assets/icon-192.png'
        });
    }

    /**
     * 获取需要复习的单词数量（熟悉度 < 3）
     */
    static async getReviewCount() {
        const allWords = await WordDB.getAllWords();
        return allWords.filter(w => w.familiarity < 3).length;
    }

    /**
     * 检查并触发每日提醒
     * 由 app.js 定时调用
     */
    static async checkDailyReminder() {
        const enabled = await WordDB.getSetting('reminder_enabled', false);
        if (!enabled) return;
        
        const reminderTime = await WordDB.getSetting('reminder_time', '20:00');
        const lastSentDate = await WordDB.getSetting('reminder_last_sent', '');
        const today = new Date().toISOString().split('T')[0];
        
        // 今天已经发过了就不重复发
        if (lastSentDate === today) return;
        
        // 检查当前时间是否到达提醒时间
        const now = new Date();
        const [hour, minute] = reminderTime.split(':').map(Number);
        const reminderDate = new Date(now);
        reminderDate.setHours(hour, minute, 0, 0);
        
        if (now >= reminderDate) {
            const count = await NotificationHelper.getReviewCount();
            NotificationHelper.sendReviewReminder(count);
            await WordDB.saveSetting('reminder_last_sent', today);
        }
    }

    /**
     * 启动定时检查（每分钟检查一次）
     */
    static startReminderChecker() {
        // 立即检查一次
        this.checkDailyReminder();
        // 每分钟检查一次
        setInterval(() => this.checkDailyReminder(), 60000);
    }
}

window.NotificationHelper = NotificationHelper;

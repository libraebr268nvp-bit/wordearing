/**
 * WordWiz - 设置数据访问层（DAO）
 * 
 * 依赖：connection.js（WordDatabase 类已定义）
 * 给 WordDatabase.prototype 添加设置相关方法
 */

/**
 * 保存设置
 * @param {string} key
 * @param {any} value
 * @returns {Promise<boolean>}
 */
WordDatabase.prototype.saveSetting = async function(key, value) {
    const store = await this._getStore('settings', 'readwrite');
    return new Promise((resolve, reject) => {
        const req = store.put({ key, value });
        req.onsuccess = () => resolve(true);
        req.onerror = () => reject(req.error);
    });
};

/**
 * 读取设置
 * @param {string} key
 * @param {any} [defaultValue=null]
 * @returns {Promise<any>}
 */
WordDatabase.prototype.getSetting = async function(key, defaultValue = null) {
    const store = await this._getStore('settings', 'readonly');
    return new Promise((resolve) => {
        const req = store.get(key);
        req.onsuccess = () => resolve(req.result ? req.result.value : defaultValue);
        req.onerror = () => resolve(defaultValue);
    });
};

console.log('[WordWiz DAO] settings.dao.js 已加载 — 2 个设置方法已挂载');

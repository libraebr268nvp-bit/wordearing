/**
 * WordWiz - 数据库层入口
 * 
 * 创建 WordDB 单例实例。
 * 所有 DAO 方法通过 prototype 已挂载在 WordDatabase 类上。
 * 这个文件必须放在所有 DAO 文件之后加载。
 */
window.WordDB = new WordDatabase();

console.log('[WordWiz DAO] index.js 已加载 — window.WordDB 实例已创建');

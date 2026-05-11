# WordWiz — 编码约束与 AI 协作规则

> ❗️ 修改代码前必须先阅读 `docs/ai/context.md` 和 `docs/ai/architecture.md`。  
> ❗️ 每次任务执行前必须输出改动计划，等我回复“确认”后再动手修改。

---

## 0. AI 工作流（元规则）

0.1 **任务启动**  
   接到任务后：
   1. 先读取 `docs/ai/tasks.md` 了解当前进度。  
   2. 搜索当前代码库中与任务相关的函数、类、文件路径，**不要全库通读**。  
   3. 用 1-2 句话描述你的理解，然后输出 **改动计划**（改哪些文件、增/删/改什么，为什么）。  
   4. **等待我回复“确认”后才执行修改**。

0.2 **执行中**  
   - 严格只改已确认的文件，不“顺手”重构无关部分。  
   - 保持改动最小化：能写 5 行不改 10 行，能加一个函数不拆整个文件。  
   - 所有新增代码必须与项目现有风格一致（缩进、引号、命名）。

0.3 **任务结束**  
   - 更新 `docs/ai/tasks.md` 中对应任务的状态为“已完成”。  
   - 如需更新架构文档或上下文文档，微调即可，**不要大改文档**。  
   - 列出本次改动的文件清单及潜在风险点。

---

## 1. 页面规范

1.1 **静态类 + render 方法**  
```javascript
// ✅ 正确
class XxxPage {
    static async render(container) { /* ... */ }
}
window.XxxPage = XxxPage;

// ❌ 错误：不要用实例单例
window.XxxPage = new XxxPage();
 
 
1.2 render 方法签名
javascript
 
复制
 
 
下载
 
static async render(container: HTMLElement): Promise<void>
 
 
• container 是 #pageContainer，每次调用先 container.innerHTML = '...'。
• 不要假设 container 外部有任何元素。
• 渲染结束需保证交互元素就绪（事件绑定完毕）。
1.3 页面注册与导航
• 每个页面必须挂载到 window 上。
• 在 app.js 的 _renderPage switch 中注册。
• 导航只通过 location.hash = '#/xxx' 触发，严禁绕过路由直接调 render。
 
2. 数据库规范
2.1 统一入口
所有数据库操作通过 window.WordDB 公开的方法完成，不允许直接使用 indexedDB API。
2.2 数据刷新
修改数据后，必须通过 AppState 回调或重新调用 _renderPage 来刷新 UI，不要手动删改 DOM。
2.3 DAO 文件职责
• 一个 DAO 只对应一张表。
• DAO 方法命名：getXxx, addXxx, updateXxx, deleteXxx。
• 所有 DAO 是 async 函数。
 
3. 状态管理规范
3.1 全局状态 window.AppState
可存的状态：排序方式、混序开关、混序结果、当前分类、筛选条件。
不可存的状态：数据库数据（单词列表）、HTML 元素、页面实例。
3.2 混序与排序
• 全局混序状态必须通过 AppState.home.shuffled 等字段管理。
• 组件内部临时混序（如单元内小混序）可以用自己的私有变量，但不能脱离 AppState 持久化。
• 新功能需要持久化的 UI 状态一律添加到 AppState 并初始化默认值。
3.3 状态变更通知
• 修改 AppState 属性后，若需要刷新页面，直接调用 app._renderPage(page)。
• 不要自行在组件中监听属性变化或触发自定义事件，保持通知链路单一。
 
4. 代码规范
4.1 变量声明：全部使用 const / let，禁用 var。
4.2 异步竞态：app.js 已实现 generation 锁，页面不再重复加锁。
4.3 错误兜底
• 页面渲染主流程有 try-catch。
• 列表渲染中对每条数据单独兜底，失败跳过该条。
• 任何错误必须以 Toast 提示用户，不能白屏。
4.4 事件规范
• Hash 路由变化是唯一刷新入口。
• 按钮事件只设置 hash。
4.5 组件复用
• WordCard.render(word, options) 返回 DOM 元素。
• UnitCard.render(unit, words, options) 返回 DOM 元素。
• 组件不直接调 WordDB，通过 options.onUpdate 通知父级。
• 新组件也遵循此静态模式。
 
5. 修改范围与安全保障
5.1 精准修改
• 只改任务明确要求的文件，不扩展。
• 即使发现其他代码有优化空间，也留到下次单独任务。
5.2 版本控制
• 修改 JS 文件后，在 index.html 对应 <script> 标签中更新 ?v=N 版本号。
• 修改 CSS 文件后，更新 <link> 版本号。
5.3 兼容检查
• 保证收藏夹、回收站、首页、设置页四个页面的基本操作仍正常。
• 保证搜索、混淆、导入导出不受影响。
5.4 测试要求
• 任务完成后使用 npx http-server -p 3000 -c-1 启动，在 http://localhost:3000 做一遍手动冒烟测试。
• 确认控制台无报错。
 
6. 禁止事项（增强约束）
6.1 ❌ 禁止引入任何第三方 CDN 或 npm 包（除非任务明确授权）。
6.2 ❌ 禁止修改 AppState 结构和 IndexedDB 表字段。
6.3 ❌ 禁止删除或重命名已有公有方法（如 WordDB 方法）。
6.4 ❌ 禁止使用 innerHTML += 拼接大段 HTML（用 insertAdjacentHTML 或 createElement）。
6.5 ❌ 禁止在循环中使用 await（批量操作用 Promise.all）。
6.6 ❌ 禁止将敏感信息（仅本地）暴露到全局或序列化。
 
*本规则随项目演进持续更新，最后更新：2026-05-11*
# WordWiz 全面审查报告

> 审查时间：2026-07-30
> 审查范围：所有近期改动的文件

---

## 一、文件级问题

### ❌ 严重：文件尾残留标签

| 文件 | 问题 | 影响 |
|------|------|------|
| `css/animations.css:65-66` | 末尾残留 `</css/animations.css> + </write_to_file>` | **CSS 文件被截断，整个文件解析失败** |
| `js/utils/wordPicker.js:99` | 末尾残留 `</write_to_file>` | JS 解析可能出错 |
| `js/screens/matching.js` | 已有残留标签（已修复） | 之前导致配对关打不开 |

### ❌ 逻辑问题

| 问题 | 文件 | 说明 |
|------|------|------|
| 熟悉度5不排除 | `js/utils/wordPicker.js:31-76` | 熟悉度5的单词仍有权重 0.027，不会被排除抽题池 |
| 无自动删除机制 | `js/widgets/wordCard.js:52-55` | 熟悉度5只是Toast提示「已满」，不会从学习列表移除 |
| 首页✓按钮无5上限处理 | `js/widgets/wordCard.js:52` | 正确判断了≥5，但在挑战模式中答对仍会涨到5，但没有后续处理 |
| 动画未实际触发 | `js/screens/challenge.js` | `_updateFamiliarity` 没有在答题后添加 CSS 动画类 |
| 配对关/打字关独立 | 两个独立文件 | 功能已集成到挑战但独立文件仍在 |

### ⚠️ 次要问题

| 问题 | 说明 |
|------|------|
| `animations.css` 定义了动画类（`.correct-flash` 等） | 但挑战模式的答题处理中从未使用这些类 |
| 导航打字按钮已删除 | ✅ 正确 |

---

## 二、修复计划

### Step 1：修复文件尾残留标签
- `css/animations.css` — 删掉最后两行
- `js/utils/wordPicker.js` — 删掉 `</write_to_file>`

### Step 2：修复熟悉度5逻辑矛盾
修改 `WordPicker.pickWeighted`：排除 familiarity >= 5 的单词
```js
let candidates = wordPool.filter(w => 
    !excludeIds.has(w.id) && (w.familiarity || 0) < 5
);
```

### Step 3：首页熟悉度5视觉处理
修改 `WordCard.render`：熟悉度5时显示「已掌握」样式

### Step 4：更新文档
- 更新 `docs/project_overview.md` 加入新功能
- 更新 `PLAN.md`

### Step 5：Git 提交推送
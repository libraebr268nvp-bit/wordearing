# WordWiz — 项目上下文

## 一句话简介
纯前端离线单词学习 App，数据存浏览器 IndexedDB，通过 Hash 路由实现 6 个页面切换，零框架零依赖。

## 技术栈
- **语言：** 纯 HTML + CSS + JavaScript（ES6+）
- **存储：** IndexedDB（4 个对象仓库：words / books / settings / stats）
- **路由：** Hash 路由（`#/home`、`#/favorites`、`#/trash`、`#/settings`、`#/challenge`、`#/wrong-words`）
- **图表：** Chart.js（内置 `js/lib/chart.umd.min.js`）
- **通知：** Web Notifications API
- **启动：** `npx http-server -p 3000 -c-1` 提供 HTTP 服务

## 路由表
| Hash | 页面 | 类名 |
|------|------|------|
| `#/home` | 学习首页 | `HomePage` |
| `#/favorites` | 收藏夹 | `FavoritesPage` |
| `#/trash` | 回收站 | `TrashPage` |
| `#/settings` | 设置 | `SettingsPage` |
| `#/challenge` | 挑战模式 | `ChallengePage` |
| `#/wrong-words` | 错题集 | `WrongWordsPage` |

## 挑战模式（challenge.js）增强 — commit 5ccc39c
- **3 种答题模式：** 四选一 / 汉→英拼写（首字母提示） / 英→汉拼写
- **难度筛选：** 简单（熟悉度≥3）/ 普通（全部）/ 困难（熟悉度≤2）
- **生命值模式：** 3 条命，答错扣 1
- **限时模式：** 每题 10 秒超时
- **错题集专项练习：** `rangeType: 'wrong-words'`
- **设置持久化：** settings 表存储 mode/difficulty/lives/timed

## 导出功能（parser.js / favorites.js / wrongwords.js）
- **parser.js：** `exportFavoritesToJSON(category)` / `exportFavoritesToCSV(category)` / `exportWrongWordsToJSON()` / `exportWrongWordsToCSV()`
- **favorites.js：** 右上角「📤 导出」按钮 → 下拉菜单（JSON / CSV）
- **wrongwords.js：** 右上角「📤 导出」按钮 → 下拉菜单（JSON / CSV）+ 「🗑️ 清空错题」按钮

## 数据流概要
```
用户操作 → hashchange → app.js (generation 锁) → Page.render(container)
    → WordDB.xxx() → IndexedDB CRUD → 渲染 DOM → onUpdate 回调刷新
```

## 多词书拆分（scripts/split_csv.js）
基于 ecdict.csv 的 tag 列，可生成 6 本词书 JSON：
| 文件 | 内容 | 标签 |
|------|------|------|
| `assets/words_ky.json` | 考研词汇 | ky |
| `assets/words_toefl.json` | 托福词汇 | toefl |
| `assets/words_ielts.json` | 雅思词汇 | ielts |
| `assets/words_gre.json` | GRE 词汇 | gre |
| `assets/words_gk.json` | 高考词汇 | gk |
| `assets/words_zk.json` | 中考词汇 | zk |

> 运行 `node scripts/split_csv.js` 生成，数据源为 skywind3000/ECDICT (MIT License)
> 注意：ecdict.csv 中不包含 spoken/simple/computer/IT/ic/ai 标签，故口语和计算机专业词书无法从此源生成

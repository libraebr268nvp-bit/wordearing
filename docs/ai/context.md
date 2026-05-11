# WordWiz — 项目上下文

## 一句话简介
纯前端离线单词学习 App，数据存浏览器 IndexedDB，通过 Hash 路由实现 4 页面切换，零框架零依赖。

## 技术栈
- **语言：** 纯 HTML + CSS + JavaScript（ES6+）
- **存储：** IndexedDB（4 个对象仓库：words / books / settings / stats）
- **路由：** Hash 路由（`#/home`、`#/favorites`、`#/trash`、`#/settings`）
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

## 数据流概要
```
用户操作 → hashchange → app.js (generation 锁) → Page.render(container)
    → WordDB.xxx() → IndexedDB CRUD → 渲染 DOM → onUpdate 回调刷新
```

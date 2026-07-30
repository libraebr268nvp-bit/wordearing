# WordWiz 部署指南

> 如何将 WordWiz 部署到 GitHub Pages，实现从任何设备免费访问

---

## 方式一：本地运行（最简单）

### Windows
```bash
# 方式 A：用 Node.js
npx http-server . -p 3000 -c-1 --cors

# 方式 B：双击 start.bat
```

### Python
```bash
python server.py
```

然后浏览器打开 **http://localhost:3000**

---

## 方式二：GitHub Pages 部署（推荐，完全免费 🌟）

这样你的 WordWiz 就可以在手机、公司电脑、任何设备上通过网址直接打开。

### 步骤

#### 1. 推送到 GitHub
```bash
git add .
git commit -m "阶段A: 修复路径 + 进度备份 + 在线词库 + manifest"
git push
```

#### 2. 启用 GitHub Pages
1. 在浏览器打开你的 GitHub 仓库：`https://github.com/libraebr268nvp-bit/wordearing`
2. 点击 **Settings** → 左侧 **Pages**
3. **Branch** 选择 `main`，文件夹选择 `/ (root)`
4. 点击 **Save**
5. 等待 1-2 分钟，你会看到：
   ```
   Your site is published at https://libraebr268nvp-bit.github.io/wordearing/
   ```

#### 3. 在任何设备上访问
- 手机、平板、公司电脑打开上述网址即可使用
- **数据存在每个设备的浏览器本地**（IndexedDB），互不干扰

---

## 跨设备同步学习进度

由于每个浏览器的数据是独立的，跨设备同步需要手动操作：

### 导出（旧设备）
1. 打开**设置页** → **学习进度备份**
2. 点击 **📥 导出备份**
3. 下载 `.json` 文件（保存到手机或网盘）

### 导入（新设备）
1. 在新设备上打开同一个网址
2. 进入**设置页** → **学习进度备份**
3. 点击 **📂 选择文件导入**
4. 选中之前导出的备份文件
5. 完成！所有单词、熟悉度、收藏、成就都已恢复

---

## 方式三：局域网访问（无需互联网）

如果设备在同一个 WiFi 下：

1. 用方式一运行本地服务器
2. 进入设置页 → 查看「局域网访问」中的 IP 地址
3. 其他设备在浏览器输入该地址即可

---

## 常见问题

### Q: 部署到 GitHub Pages 后数据会丢吗？
不会。数据存在每个用户的浏览器本地（IndexedDB），GitHub Pages 只托管静态文件。

### Q: 更换手机或清空浏览器缓存后数据还在吗？
不在。请先导出备份再操作。

### Q: 可以自动同步吗？
目前是手动导出/导入。后续阶段 D 会探索自动同步方案（如 GitHub API 或免费云存储）。
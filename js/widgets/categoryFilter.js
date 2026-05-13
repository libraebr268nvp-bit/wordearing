/**
 * WordWiz - 分类筛选组件
 * 
 * 支持动态分类：从数据库现有单词中提取所有分类，而非硬编码。
 * 首次渲染时异步获取分类列表。
 * 
 * v2 升级：动态分类 —— 从所有未删除单词中提取唯一 category 值
 */

class CategoryFilter {
    /**
     * 渲染分类筛选按钮组
     * @param {HTMLElement} container - 容器元素
     * @param {string} activeCategory - 当前选中的分类
     * @param {Function} onChange - 切换分类时的回调
     */
    static async render(container, activeCategory = '全部', onChange) {
        // 从数据库获取动态分类列表
        let categories = ['全部'];
        try {
            const dbCategories = await WordDB.getCategories();
            // 过滤掉空值，合并到 categories 列表
            if (dbCategories && dbCategories.length > 0) {
                dbCategories.forEach(c => {
                    if (c && !categories.includes(c)) categories.push(c);
                });
            }
        } catch (e) {
            console.warn('[CategoryFilter] 获取分类失败，使用默认分类:', e);
            categories = ['全部', '四级', '六级', '其他'];
        }

        container.innerHTML = `<div class="filter-group">
            ${categories.map(cat => `
                <button class="filter-btn ${cat === activeCategory ? 'active' : ''}"
                        data-category="${cat}">
                    ${cat}
                </button>
            `).join('')}
        </div>`;

        // 绑定点击事件
        container.querySelectorAll('.filter-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const category = btn.dataset.category;
                container.querySelectorAll('.filter-btn').forEach(b => 
                    b.classList.remove('active'));
                btn.classList.add('active');
                if (onChange) onChange(category);
            });
        });
    }
}

window.CategoryFilter = CategoryFilter;

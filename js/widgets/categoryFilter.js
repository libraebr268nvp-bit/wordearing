/**
 * WordWiz - 分类筛选组件
 * 
 * 生成筛选按钮组，支持全部/四级/六级/半导体专业/其他
 */

class CategoryFilter {
    /**
     * 渲染分类筛选按钮组
     * @param {HTMLElement} container - 容器元素
     * @param {string} activeCategory - 当前选中的分类
     * @param {Function} onChange - 切换分类时的回调
     */
    static render(container, activeCategory = '全部', onChange) {
        const categories = ['全部', '四级', '六级', '半导体专业', '其他'];
        
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
                // 更新激活状态
                container.querySelectorAll('.filter-btn').forEach(b => 
                    b.classList.remove('active'));
                btn.classList.add('active');
                // 触发回调
                if (onChange) onChange(category);
            });
        });
    }
}

window.CategoryFilter = CategoryFilter;

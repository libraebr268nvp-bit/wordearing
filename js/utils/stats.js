/**
 * WordWiz - 统计工具
 * 
 * 使用 Chart.js 渲染学习趋势图
 * v5 新增：renderHeatmap() 学习打卡热力图（自实现，无外部依赖）
 */

/**
 * 获取本地日期字符串（YYYY-MM-DD），避免 UTC 时区偏差（用于热力图）
 */
function _getLocalDateStr2(date) {
    const d = date || new Date();
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
}

class StatsHelper {
    /**
     * 渲染学习趋势图
     * @param {HTMLElement} canvasEl - canvas 元素
     * @param {Array} trendData - [{date, count}] 格式的数据
     */
    static renderTrendChart(canvasEl, trendData) {
        if (!canvasEl || !trendData || trendData.length === 0) {
            if (canvasEl) {
                canvasEl.parentElement.innerHTML = '<div style="text-align:center;padding:20px;color:var(--text-muted);font-size:13px;">📊 暂无学习数据</div>';
            }
            return;
        }

        // 检查 Chart 是否可用
        if (typeof Chart === 'undefined') {
            canvasEl.parentElement.innerHTML = '<div style="text-align:center;padding:20px;color:var(--text-muted);font-size:13px;">⚠️ Chart.js 未加载，图表无法显示</div>';
            console.warn('Chart.js 未加载，跳过图表渲染');
            return;
        }

        // 如果已有 Chart 实例则销毁
        if (canvasEl._chart) {
            canvasEl._chart.destroy();
        }

        const ctx = canvasEl.getContext('2d');
        const labels = trendData.map(d => {
            const parts = d.date.split('-');
            return `${parts[1]}/${parts[2]}`;
        });
        const values = trendData.map(d => d.count);

        canvasEl._chart = new Chart(ctx, {
            type: 'line',
            data: {
                labels: labels,
                datasets: [{
                    label: '学习次数',
                    data: values,
                    borderColor: '#6C8CFF',
                    backgroundColor: 'rgba(108, 140, 255, 0.1)',
                    borderWidth: 2,
                    fill: true,
                    tension: 0.4,
                    pointBackgroundColor: '#6C8CFF',
                    pointBorderColor: '#1E1E2E',
                    pointBorderWidth: 2,
                    pointRadius: 4,
                    pointHoverRadius: 6
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        labels: { color: '#9898B8', font: { size: 12 } }
                    },
                    tooltip: {
                        backgroundColor: '#2A2A45',
                        titleColor: '#E0E0F0',
                        bodyColor: '#9898B8',
                        borderColor: '#3A3A5C',
                        borderWidth: 1,
                        padding: 10,
                        cornerRadius: 8
                    }
                },
                scales: {
                    x: {
                        ticks: { color: '#6868A0', font: { size: 11 } },
                        grid: { color: 'rgba(58, 58, 92, 0.3)' }
                    },
                    y: {
                        beginAtZero: true,
                        ticks: { 
                            color: '#6868A0', 
                            font: { size: 11 },
                            stepSize: 1
                        },
                        grid: { color: 'rgba(58, 58, 92, 0.3)' }
                    }
                }
            }
        });
    }

    /**
     * 渲染学习打卡热力图（GitHub 贡献图风格）
     * @param {HTMLElement} container - 统计面板容器
     */
    static async renderHeatmap(container) {
        const trend = await WordDB.getStudyTrend(365);

        // 标题
        const title = document.createElement('p');
        title.textContent = '📅 学习日历（近12个月）';
        title.style.cssText = 'color:#aaa;font-size:13px;margin:16px 0 8px;';
        container.appendChild(title);

        // 容器
        const heatmapEl = document.createElement('div');
        heatmapEl.id = 'cal-heatmap-' + Date.now();
        heatmapEl.style.cssText = 'overflow-x:auto;padding:12px 0;';
        container.appendChild(heatmapEl);

        if (!trend || trend.length === 0) {
            heatmapEl.innerHTML = '<div style="text-align:center;padding:16px;color:var(--text-muted);font-size:13px;">暂无学习数据</div>';
            return;
        }

        // 将 trend 数据转换为 { 'YYYY-MM-DD': count } 的 Map
        const dataMap = new Map();
        let maxCount = 0;
        for (const item of trend) {
            dataMap.set(item.date, item.count);
            if (item.count > maxCount) maxCount = item.count;
        }

        // 色阶（空→少→多）：从深绿到亮绿
        const colors = ['#1a1a2e', '#0d3320', '#1a6640', '#26994f', '#33cc66', '#00ff88'];
        const getColor = (count) => {
            if (count === 0) return colors[0];
            const idx = Math.min(Math.ceil((count / Math.max(maxCount, 1)) * (colors.length - 2)), colors.length - 1);
            return colors[idx] || colors[colors.length - 1];
        };

        // 生成热力图表格
        const today = new Date();
        const oneYearAgo = new Date(today);
        oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);

        // 计算从 oneYearAgo 所在的周一开始到今天的周数
        const startDate = new Date(oneYearAgo);
        startDate.setDate(startDate.getDate() - startDate.getDay()); // 回到周日
        const endDate = new Date(today);
        endDate.setDate(endDate.getDate() + (6 - endDate.getDay())); // 到周六

        const weeks = [];
        const current = new Date(startDate);
        while (current <= endDate) {
            const week = [];
            for (let d = 0; d < 7; d++) {
                const dateStr = _getLocalDateStr2(current);
                week.push({
                    date: dateStr,
                    count: dataMap.get(dateStr) || 0,
                    day: current.getDay(),
                    isInRange: current >= oneYearAgo && current <= today
                });
                current.setDate(current.getDate() + 1);
            }
            weeks.push(week);
        }

        // 星期标签
        const dayLabels = ['', '一', '', '三', '', '五', ''];

        // 构建表格
        const table = document.createElement('table');
        table.style.cssText = 'border-collapse:collapse;font-size:10px;';

        // 月份标签行
        const monthRow = document.createElement('tr');
        const monthPlaceholder = document.createElement('td');
        monthPlaceholder.style.cssText = 'width:28px;';
        monthRow.appendChild(monthPlaceholder);
        let lastMonth = -1;
        for (const week of weeks) {
            const firstDay = week.find(d => d.isInRange);
            if (firstDay) {
                const m = new Date(firstDay.date).getMonth();
                if (m !== lastMonth) {
                    const td = document.createElement('td');
                    td.textContent = ['', '1月', '2月', '3月', '4月', '5月', '6月', '7月', '8月', '9月', '10月', '11月', '12月'][m + 1];
                    td.style.cssText = 'padding:1px;color:#6868a0;font-size:9px;text-align:center;';
                    td.colSpan = week.length;
                    monthRow.appendChild(td);
                    lastMonth = m;
                }
            }
        }
        table.appendChild(monthRow);

        // 每天行
        for (let dayIdx = 0; dayIdx < 7; dayIdx++) {
            const row = document.createElement('tr');
            const label = document.createElement('td');
            label.textContent = dayLabels[dayIdx];
            label.style.cssText = 'padding-right:4px;color:#6868a0;font-size:9px;text-align:right;width:28px;';
            row.appendChild(label);

            for (const week of weeks) {
                const cell = week[dayIdx];
                const td = document.createElement('td');
                td.style.cssText = 'width:10px;height:10px;padding:1px;';
                if (cell.isInRange) {
                    const div = document.createElement('div');
                    div.style.cssText = 'width:10px;height:10px;border-radius:2px;background:' + getColor(cell.count) + ';cursor:pointer;';
                    div.title = cell.date + ': ' + cell.count + ' 次学习';
                    td.appendChild(div);
                }
                row.appendChild(td);
            }
            table.appendChild(row);
        }

        heatmapEl.appendChild(table);

        // 图例
        const legend = document.createElement('div');
        legend.style.cssText = 'display:flex;align-items:center;gap:4px;justify-content:flex-end;margin-top:6px;font-size:10px;color:#6868a0;';
        legend.innerHTML = '少 ' + colors.map(function(c) { return '<span style="display:inline-block;width:10px;height:10px;border-radius:2px;background:' + c + ';"></span>'; }).join('') + ' 多';
        heatmapEl.appendChild(legend);
    }

    /**
     * 更新统计仪表盘
     * @param {HTMLElement} container - 统计面板容器
     */
    static async renderDashboard(container) {
        const stats = await WordDB.getStats();
        const trend = await WordDB.getStudyTrend(7);

        container.innerHTML = `
            <div class="stats-dashboard">
                <h3>📊 数据统计</h3>
                <div class="stats-grid">
                    <div class="stat-card">
                        <span class="stat-value">${stats.totalWords}</span>
                        <span class="stat-label">总单词数</span>
                    </div>
                    <div class="stat-card">
                        <span class="stat-value">${stats.averageFamiliarity}</span>
                        <span class="stat-label">平均熟悉度</span>
                    </div>
                    <div class="stat-card">
                        <span class="stat-value">${stats.favoriteCount}</span>
                        <span class="stat-label">收藏数</span>
                    </div>
                    <div class="stat-card">
                        <span class="stat-value">${stats.trashCount}</span>
                        <span class="stat-label">回收站词数</span>
                    </div>
                </div>
                <div class="chart-container">
                    <h4 style="color: var(--text-secondary); margin-bottom: 12px; font-size: 14px;">
                        📈 最近 7 天学习趋势
                    </h4>
                    <div style="height: 200px;">
                        <canvas id="trendChart"></canvas>
                    </div>
                </div>
            </div>
        `;

        // 渲染图表
        const canvas = container.querySelector('#trendChart');
        if (canvas) {
            this.renderTrendChart(canvas, trend);
        }

        // 渲染热力图
        await this.renderHeatmap(container);
    }
}

window.StatsHelper = StatsHelper;

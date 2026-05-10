/**
 * WordWiz - 统计工具
 * 
 * 使用 Chart.js 渲染学习趋势图
 */

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
    }
}

window.StatsHelper = StatsHelper;

/**
 * WordWiz - 回收站页面
 * 
 * 功能：
 * - 查看已删除的单词
 * - 恢复单词
 * - 永久删除
 */

class TrashPage {
    /**
     * 渲染回收站页面
     */
    static async render(container) {
        container.innerHTML = `
            <div class="page-header">
                <div class="page-title">🗑️ 回收站</div>
                <button class="btn btn-danger btn-sm" id="clearAllTrash">
                    🗑️ 清空回收站
                </button>
            </div>
            <div id="trashList"></div>
        `;

        document.getElementById('clearAllTrash').addEventListener('click', async () => {
            if (confirm('确定要永久删除回收站中的所有单词吗？此操作不可恢复！')) {
                const count = await WordDB.clearTrash();
                window.Toast.show(`🗑️ 已永久删除 ${count} 个单词`);
                await this.render(container);
            }
        });

        await this._renderTrashList(container);
    }

    /**
     * 渲染回收站单词列表
     */
    static async _renderTrashList(container) {
        const listContainer = container.querySelector('#trashList');
        
        const words = await WordDB.getTrashWords();

        if (words.length === 0) {
            listContainer.innerHTML = `
                <div class="empty-state">
                    <div class="empty-icon">🗑️</div>
                    <div class="empty-text">回收站为空</div>
                    <p style="color:var(--text-muted);font-size:13px;margin-top:8px;">
                        删除的单词会暂存在这里，30 天后自动清理
                    </p>
                </div>
            `;
            return;
        }

        const wrapper = document.createElement('div');
        wrapper.className = 'unit-card';

        const header = document.createElement('div');
        header.className = 'unit-header';
        const deletedCount = words.length;
        header.innerHTML = `<div class="unit-title">🗑️ 已删除单词 <span class="unit-count">· ${deletedCount} 词</span></div>`;
        wrapper.appendChild(header);

        const listContainerInner = document.createElement('div');
        
        words.forEach(word => {
            const item = document.createElement('div');
            item.className = 'trash-item';
            
            const info = document.createElement('div');
            info.className = 'trash-info';
            const deleteDate = word.deleted_at ? new Date(word.deleted_at).toLocaleDateString() : '未知';
            info.innerHTML = `
                <div class="trash-word">${word.word}</div>
                <div class="trash-meta">${word.definition} · 删除于 ${deleteDate}</div>
            `;
            item.appendChild(info);

            const actions = document.createElement('div');
            actions.className = 'trash-actions';

            // 恢复按钮
            const restoreBtn = document.createElement('button');
            restoreBtn.className = 'btn btn-sm btn-primary';
            restoreBtn.textContent = '↩ 恢复';
            restoreBtn.addEventListener('click', async () => {
                await WordDB.restoreWord(word.id);
                window.Toast.show(`↩ "${word.word}" 已恢复`);
                await this._renderTrashList(container);
            });
            actions.appendChild(restoreBtn);

            // 永久删除按钮
            const deleteBtn = document.createElement('button');
            deleteBtn.className = 'btn btn-sm btn-danger';
            deleteBtn.textContent = '✕ 永久删除';
            deleteBtn.addEventListener('click', async () => {
                if (confirm(`确定要永久删除 "${word.word}" 吗？`)) {
                    await WordDB.hardDeleteWord(word.id);
                    window.Toast.show(`🗑️ "${word.word}" 已永久删除`);
                    await this._renderTrashList(container);
                }
            });
            actions.appendChild(deleteBtn);

            item.appendChild(actions);
            listContainerInner.appendChild(item);
        });

        wrapper.appendChild(listContainerInner);
        listContainer.innerHTML = '';
        listContainer.appendChild(wrapper);
    }
}

window.TrashPage = TrashPage;

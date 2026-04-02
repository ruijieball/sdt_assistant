// 沙雕图小助理 - 前端交互逻辑

// 全局状态
const state = {
    currentTab: 'add',
    selectedFiles: [],
    searchResults: [],
    searchDocuments: {},
    searchMetadatas: {}
};

// DOM 元素
const elements = {
    // 标签页
    tabBtns: document.querySelectorAll('.tab-btn'),
    tabContents: document.querySelectorAll('.tab-content'),
    
    // 添加图片模块
    uploadArea: document.getElementById('upload-area'),
    fileInput: document.getElementById('file-input'),
    previewArea: document.getElementById('preview-area'),
    uploadBtn: document.getElementById('upload-btn'),
    addResult: document.getElementById('add-result'),
    
    // 搜索模块
    searchInput: document.getElementById('search-input'),
    searchBtn: document.getElementById('search-btn'),
    searchStats: document.getElementById('search-stats'),
    searchResults: document.getElementById('search-results'),
    
    // 二次优化模块
    scIdInput: document.getElementById('sc-id-input'),
    scPromptInput: document.getElementById('sc-prompt-input'),
    scBtn: document.getElementById('sc-btn'),
    scResult: document.getElementById('sc-result'),
    
    // 模态框
    modal: document.getElementById('image-modal'),
    modalImage: document.getElementById('modal-image'),
    modalInfo: document.getElementById('modal-info'),
    modalClose: document.querySelector('.modal-close'),
    
    // Toast
    toast: document.getElementById('toast')
};

// 初始化
function init() {
    bindEvents();
}

// 绑定事件
function bindEvents() {
    // 标签页切换
    elements.tabBtns.forEach(btn => {
        btn.addEventListener('click', () => switchTab(btn.dataset.tab));
    });
    
    // 文件上传
    elements.uploadArea.addEventListener('click', () => elements.fileInput.click());
    elements.uploadArea.addEventListener('dragover', handleDragOver);
    elements.uploadArea.addEventListener('dragleave', handleDragLeave);
    elements.uploadArea.addEventListener('drop', handleDrop);
    elements.fileInput.addEventListener('change', handleFileSelect);
    
    // 上传按钮
    elements.uploadBtn.addEventListener('click', handleUpload);
    
    // 搜索
    elements.searchBtn.addEventListener('click', handleSearch);
    elements.searchInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') handleSearch();
    });
    
    // 二次优化
    elements.scBtn.addEventListener('click', handleSecondChance);
    
    // 模态框
    elements.modalClose.addEventListener('click', closeModal);
    elements.modal.addEventListener('click', (e) => {
        if (e.target === elements.modal) closeModal();
    });
    
    // ESC 关闭模态框
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') closeModal();
    });
}

// 切换标签页
function switchTab(tabName) {
    state.currentTab = tabName;
    
    elements.tabBtns.forEach(btn => {
        btn.classList.toggle('active', btn.dataset.tab === tabName);
    });
    
    elements.tabContents.forEach(content => {
        content.classList.toggle('active', content.id === `${tabName}-tab`);
    });
}

// 拖拽相关
function handleDragOver(e) {
    e.preventDefault();
    elements.uploadArea.classList.add('dragover');
}

function handleDragLeave(e) {
    e.preventDefault();
    elements.uploadArea.classList.remove('dragover');
}

function handleDrop(e) {
    e.preventDefault();
    elements.uploadArea.classList.remove('dragover');
    
    const files = Array.from(e.dataTransfer.files).filter(file => file.type.startsWith('image/'));
    if (files.length > 0) {
        addFiles(files);
    }
}

// 文件选择
function handleFileSelect(e) {
    const files = Array.from(e.target.files);
    if (files.length > 0) {
        addFiles(files);
    }
}

// 添加文件到预览
function addFiles(files) {
    const remainingSlots = 5 - state.selectedFiles.length;
    const filesToAdd = files.slice(0, remainingSlots);
    
    if (files.length > remainingSlots) {
        showToast(`最多只能上传 5 张图片，已选择前${remainingSlots}张`, 'warning');
    }
    
    filesToAdd.forEach(file => {
        if (!state.selectedFiles.find(f => f.name === file.name)) {
            state.selectedFiles.push(file);
            createPreview(file);
        }
    });
    
    updateUploadButton();
}

// 创建预览
function createPreview(file) {
    const reader = new FileReader();
    reader.onload = (e) => {
        const div = document.createElement('div');
        div.className = 'preview-item';
        div.innerHTML = `
            <img src="${e.target.result}" alt="${file.name}">
            <button class="preview-remove" onclick="removeFile('${file.name}')">&times;</button>
        `;
        elements.previewArea.appendChild(div);
    };
    reader.readAsDataURL(file);
}

// 移除文件
function removeFile(fileName) {
    state.selectedFiles = state.selectedFiles.filter(f => f.name !== fileName);
    renderPreviews();
    updateUploadButton();
}

// 重新渲染预览
function renderPreviews() {
    elements.previewArea.innerHTML = '';
    state.selectedFiles.forEach(file => createPreview(file));
}

// 更新上传按钮状态
function updateUploadButton() {
    elements.uploadBtn.disabled = state.selectedFiles.length === 0;
}

// 处理上传
async function handleUpload() {
    if (state.selectedFiles.length === 0) return;
    
    setLoading(elements.uploadBtn, true);
    elements.addResult.classList.remove('show');
    
    const formData = new FormData();
    state.selectedFiles.forEach(file => {
        formData.append('user_files', file);
    });
    
    try {
        const response = await fetch('/add', {
            method: 'POST',
            body: formData
        });
        
        const data = await response.json();
        
        if (response.ok) {
            showResult(elements.addResult, 'success', '识别成功！', data.add_document);
            showToast('图片添加成功！', 'success');
            state.selectedFiles = [];
            renderPreviews();
            updateUploadButton();
        } else {
            throw new Error(data.detail || '上传失败');
        }
    } catch (error) {
        showResult(elements.addResult, 'error', '识别失败', error.message);
        showToast(error.message, 'error');
    } finally {
        setLoading(elements.uploadBtn, false);
    }
}

// 处理搜索
async function handleSearch() {
    const query = elements.searchInput.value.trim();
    if (!query) {
        showToast('请输入搜索关键词', 'info');
        return;
    }
    
    setLoading(elements.searchBtn, true);
    elements.searchResults.innerHTML = '<div class="empty-state">搜索中...</div>';
    elements.searchStats.textContent = '';
    
    try {
        const response = await fetch(`/search?text=${encodeURIComponent(query)}`);
        const data = await response.json();
        
        if (response.ok) {
            renderSearchResults(data);
        } else {
            throw new Error(data.detail || '搜索失败');
        }
    } catch (error) {
        elements.searchResults.innerHTML = `<div class="empty-state error">搜索失败：${error.message}</div>`;
        showToast(error.message, 'error');
    } finally {
        setLoading(elements.searchBtn, false);
    }
}

// 渲染搜索结果
function renderSearchResults(data) {
    let { ids, distances, metadatas, documents } = data;  // ← 添加 documents
    
    // 处理 ChromaDB 返回的二维数组格式
    if (Array.isArray(ids) && ids.length > 0 && Array.isArray(ids[0])) {
        ids = ids[0];
    }
    if (Array.isArray(distances) && distances.length > 0 && Array.isArray(distances[0])) {
        distances = distances[0];
    }
    if (Array.isArray(metadatas) && metadatas.length > 0 && Array.isArray(metadatas[0])) {
        metadatas = metadatas[0];
    }
    if (Array.isArray(documents) && documents.length > 0 && Array.isArray(documents[0])) {
        documents = documents[0];  // ← 添加 documents 的二维数组处理
    }
    
    if (!ids || ids.length === 0) {
        elements.searchStats.textContent = '未找到相关结果';
        elements.searchResults.innerHTML = '<div class="empty-state">没有找到匹配的图片 😢</div>';
        return;
    }

    // 保存 documents 和 metadatas 到状态，建立 id -> document/metadata 的映射
    state.searchDocuments = {};
    state.searchMetadatas = {};
    ids.forEach((id, index) => {
    state.searchDocuments[id] = documents[index];
    state.searchMetadatas[id] = metadatas && metadatas[index] ? metadatas[index] : {};
});
    
    elements.searchStats.textContent = `找到 ${ids.length} 个相关结果`;
    elements.searchResults.innerHTML = '';
    
    ids.forEach((id, index) => {
        const distance = distances[index];
        const score = Math.round((1 - distance) * 100);
        const metadata = metadatas && metadatas[index] ? metadatas[index] : {};
        createResultCard(id, score, metadata);
    });
}

// 创建结果卡片
function createResultCard(id, score, metadata) {
    console.log('createResultCard - id:', id, 'metadata:', metadata, 'file_names:', metadata.file_names);
    const card = document.createElement('div');
    card.className = 'result-card';
    
    // 从 metadata 中获取 file_names
    const fileNames = metadata.file_names || [];
    const folderId = metadata.id || id;
    
    // 构建图片区域 HTML
    let imagesHtml = '';
    if (fileNames.length > 0) {
        if (fileNames.length === 1) {
            // 单张图片 - 使用原有样式
            const imageUrl = `/uploads/${folderId}/${fileNames[0]}`;
            imagesHtml = `
                <div class="result-image-container single">
                    <img src="${imageUrl}" class="result-image" alt="${fileNames[0]}" 
                         onerror="this.parentElement.innerHTML='<div class=\\'result-image-placeholder\\' style=\\'height: 200px; display: flex; align-items: center; justify-content: center; background: #e2e8f0;\\'>📷 加载失败</div>'">
                </div>
            `;
        } else {
            // 多张图片 - 使用网格布局
            imagesHtml = '<div class="result-images-grid">';
            fileNames.forEach((fileName, idx) => {
                const imageUrl = `/uploads/${folderId}/${fileName}`;
                const loadingAttr = idx === 0 ? '' : 'loading="lazy"';
                imagesHtml += `
                    <div class="result-image-wrapper" onclick="event.stopPropagation(); showImageDetail('${folderId}', '${fileName}')">
                        <img src="${imageUrl}" alt="${fileName}" ${loadingAttr} 
                             onerror="this.parentElement.innerHTML='<div class=\\'image-error\\'>📷</div>'">
                    </div>
                `;
            });
            imagesHtml += '</div>';
        }
    } else {
        // 没有图片时的占位
        imagesHtml = `
            <div class="result-image-placeholder" style="height: 200px; background: #e2e8f0; display: flex; align-items: center; justify-content: center;">
                <span>📷 暂无图片</span>
            </div>
        `;
    }
    
    card.innerHTML = `
        ${imagesHtml}
        <div class="result-info">
            <div class="result-score">匹配度：${score}%</div>
            ${fileNames.length > 1 ? `<div class="result-files-count">${fileNames.length} 个文件</div>` : ''}
            <div class="result-actions">
                <button class="btn-view" onclick="event.stopPropagation(); showImageDetail('${folderId}')">查看详情</button>
                <button class="btn-optimize" onclick="event.stopPropagation(); openSecondChance('${folderId}')">二次优化</button>
            </div>
        </div>
    `;
    
    // 点击卡片查看详情（使用第一张图片）
    card.addEventListener('click', () => {
        const firstFile = fileNames.length > 0 ? fileNames[0] : null;
        showImageDetail(folderId, firstFile);
    });
    
    elements.searchResults.appendChild(card);
}

// 从搜索结果打开二次优化
function openSecondChance(id) {
    elements.scIdInput.value = id;
    switchTab('second-chance');
    elements.scPromptInput.focus();
}

// 显示图片详情
// 显示图片详情
function showImageDetail(id, specificFileName = null) {
    // 从保存的搜索结果中获取 document 和 metadata
    const doc = state.searchDocuments[id];
    const metadata = state.searchMetadatas[id] || {};
    
    if (!doc && !metadata.file_names) {
        showToast('未找到图片信息，请重新搜索', 'error');
        return;
    }
    
    // 优先从 metadata 中获取 file_names（与 createResultCard 保持一致）
    let files = metadata.file_names || [];
    
    // 如果 metadata 中没有，尝试从 document 解析（兜底）
    if (files.length === 0 && doc) {
        const fileMatches = doc.match(/file_names:\s*\n((?:\s*-\s*[^\n]+\n?)+)/);
        files = fileMatches ? fileMatches[1].match(/-\s*([^\n]+)/g).map(m => m.replace('- ', '').trim()) : [];
    }
    
    // 确定要显示的图片
    let displayFile = specificFileName;
    if (!displayFile && files.length > 0) {
        displayFile = files[0];
    }
    
    if (displayFile) {
        elements.modalImage.src = `/uploads/${id}/${displayFile}`;
        elements.modalImage.style.display = '';
    } else {
        elements.modalImage.src = '';
        elements.modalImage.style.display = 'none';
    }
    
    // 构建文件列表 HTML（如果有多张图片）
    let filesHtml = '';
    if (files.length > 1) {
        filesHtml = '<div class="modal-files-list"><h4>文件夹中的所有文件：</h4><div class="files-grid">';
        files.forEach(file => {
            const isActive = file === displayFile ? 'active' : '';
            filesHtml += `
                <div class="file-thumb ${isActive}" onclick="switchModalImage('${id}', '${file}')">
                    <img src="/uploads/${id}/${file}" loading="lazy" alt="${file}">
                    <span>${file}</span>
                </div>
            `;
        });
        filesHtml += '</div></div>';
    }
    
    // 格式化时间戳
    function formatTimestamp(timestamp) {
        if (!timestamp) return '未知';
        const date = new Date(timestamp * 1000); // 时间戳是秒，需要乘1000
        return date.toLocaleString('zh-CN', {
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit'
        });
    }
    
    const creationTime = formatTimestamp(metadata['creation time']);
    const modificationTime = formatTimestamp(metadata['modification time']);
    
    elements.modalInfo.innerHTML = `
        <h3>图片信息</h3>
        <p><strong>ID:</strong> ${id}</p>
        <p><strong>创建时间:</strong> ${creationTime}</p>
        <p><strong>修改时间:</strong> ${modificationTime}</p>
        ${files.length > 1 ? `<p><strong>当前文件:</strong> ${displayFile || '无'}</p>` : ''}
        ${filesHtml}
        <div class="document-content"><pre>${escapeHtml(doc || '无描述信息')}</pre></div>
        <div class="modal-actions">
            <button class="btn-optimize" onclick="closeModal(); openSecondChance('${id}')">🔄 二次优化</button>
        </div>
    `;
    
    elements.modal.classList.add('show');
    document.body.style.overflow = 'hidden';
}

// 新增：切换模态框中的图片
function switchModalImage(id, fileName) {
    elements.modalImage.src = `/uploads/${id}/${fileName}`;
    // 更新 active 状态
    document.querySelectorAll('.file-thumb').forEach(thumb => {
        thumb.classList.remove('active');
        if (thumb.querySelector('span').textContent === fileName) {
            thumb.classList.add('active');
        }
    });
    // 更新当前文件显示
    const currentFileP = elements.modalInfo.querySelector('p:nth-of-type(2)');
    if (currentFileP) {
        currentFileP.innerHTML = `<strong>当前文件:</strong> ${fileName}`;
    }
}

// 关闭模态框
function closeModal() {
    elements.modal.classList.remove('show');
    document.body.style.overflow = '';
    elements.modalImage.src = '';
}

// 处理二次优化
async function handleSecondChance() {
    const id = elements.scIdInput.value.trim();
    const text = elements.scPromptInput.value.trim();
    
    if (!id) {
        showToast('请输入图片 ID', 'info');
        return;
    }
    if (!text) {
        showToast('请输入优化提示词', 'info');
        return;
    }
    
    setLoading(elements.scBtn, true);
    elements.scResult.classList.remove('show');
    
    try {
        const response = await fetch('/second-chance', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ id, text })
        });
        
        const data = await response.json();
        
        if (response.ok) {
            showResult(elements.scResult, 'success', '优化成功！', data.add_document);
            showToast('图片识别已优化！', 'success');
            elements.scIdInput.value = '';
            elements.scPromptInput.value = '';
        } else {
            throw new Error(data.detail || '优化失败');
        }
    } catch (error) {
        showResult(elements.scResult, 'error', '优化失败', error.message);
        showToast(error.message, 'error');
    } finally {
        setLoading(elements.scBtn, false);
    }
}

// 设置加载状态
function setLoading(button, loading) {
    const spinner = button.querySelector('.loading-spinner');
    const text = button.querySelector('.btn-text');
    
    if (loading) {
        button.disabled = true;
        if (spinner) spinner.classList.remove('hidden');  // 添加空值检查
        if (text) text.textContent = '处理中...';
    } else {
        button.disabled = false;
        if (spinner) spinner.classList.add('hidden');  // 添加空值检查
        if (text) text.textContent = button.id === 'upload-btn' ? '开始识别并添加' : 
                                  button.id === 'sc-btn' ? '重新识别并保存' : '搜索';
    }
}

// 显示结果
function showResult(container, type, title, content) {
    container.className = `result-area show ${type}`;
    container.innerHTML = `
        <div class="result-title">
            ${type === 'success' ? '✅' : '❌'} ${title}
        </div>
        <div class="result-content">${escapeHtml(content)}</div>
    `;
}

// 显示 Toast
function showToast(message, type = 'info') {
    elements.toast.textContent = message;
    elements.toast.className = `toast ${type}`;
    elements.toast.classList.add('show');
    
    setTimeout(() => {
        elements.toast.classList.remove('show');
    }, 3000);
}

// HTML 转义
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// 启动应用
init();
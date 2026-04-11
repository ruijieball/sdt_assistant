// 沙雕图小助理 - 前端交互逻辑

// 全局状态
const state = {
    currentTab: 'add',
    selectedFiles: [],
    searchResults: [],
    searchDocuments: {},
    searchMetadatas: {},
    dedupResults: {}, 
    dedupGroups: [],
    dedupIdInfo: {},
    deletedIds: new Set(),
    idListPage: 1,
    idListPageSize: 20,
    idListTotal: 0,
    idListCache: {},  // id -> {document, metadata} 缓存
    safeSearch: true
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
    safeSearchCheckbox: document.getElementById('safe-search-checkbox'),
    
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
    toast: document.getElementById('toast'),

    // 查重模块
    checkDupBtn: document.getElementById('check-dedup-btn'),
    dedupStats: document.getElementById('dedup-stats'),
    dedupResults: document.getElementById('dedup-results'),

    // 素材管理模块
    loadIdListBtn: document.getElementById('load-id-list-btn'),
    prevPageBtn: document.getElementById('prev-page-btn'),
    nextPageBtn: document.getElementById('next-page-btn'),
    currentPageInput: document.getElementById('current-page-input'),
    totalPages: document.getElementById('total-pages'),
    manageStats: document.getElementById('manage-stats'),
    idListResults: document.getElementById('id-list-results')


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
    // Safe search toggle
    if (elements.safeSearchCheckbox) {
        elements.safeSearchCheckbox.addEventListener('change', handleSafeSearchToggle);
    }
    
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

    // 查重
    elements.checkDupBtn.addEventListener('click', handleCheckDuplication);

    // 素材管理
    elements.loadIdListBtn.addEventListener('click', handleIdListLoad);
    elements.prevPageBtn.addEventListener('click', () => handlePageChange(-1));
    elements.nextPageBtn.addEventListener('click', () => handlePageChange(1));
    elements.currentPageInput.addEventListener('change', handlePageInput);
    elements.currentPageInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') handlePageInput();
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

// Handle safe search toggle
function handleSafeSearchToggle() {
    state.safeSearch = elements.safeSearchCheckbox.checked;
}

// Modify handleSearch function to include safe_search parameter
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
        const safeSearchParam = state.safeSearch ? 'true' : 'false';
        const response = await fetch(`/search?text=${encodeURIComponent(query)}&safe_search=${safeSearchParam}`);
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

// Add this helper function to format sensitive status
function formatSensitiveStatus(sensitive) {
    if (sensitive === true) {
        return '<span class="sensitive-indicator">🔞 敏感内容</span>';
    }
    return '';
}

// Add this helper function to format source
function formatSource(source) {
    if (source && source.trim()) {
        return `<p><strong>来源:</strong> ${escapeHtml(source)}</p>`;
    }
    return '';
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
            ${metadata['sensitive'] === true ? '<div class="result-sensitive">🔞 敏感</div>' : ''}
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
function showImageDetail(id, specificFileName = null) {
    // 1. 先从搜索结果中获取（搜索模块）
    let doc = state.searchDocuments[id];
    let metadata = state.searchMetadatas[id] || {};
    
    // 2. 如果搜索结果中没有，从图片管理缓存中获取（图片管理模块）
    if (!doc && state.idListCache[id]) {
        doc = state.idListCache[id].document;
        metadata = state.idListCache[id].metadata || {};
    }
    
    // 3. 如果还是没有，从查重信息中获取（查重模块）
    if (!doc && state.dedupIdInfo[id]) {
        doc = state.dedupIdInfo[id].document;
        metadata = state.dedupIdInfo[id].metadata || {};
    }
    
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
        const date = new Date(timestamp * 1000);
        return date.toLocaleString('zh-CN', {
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit'
        });
    }
    
    const creationTime = formatTimestamp(metadata['creation_time']);
    const modificationTime = formatTimestamp(metadata['modification_time']);
    const sensitiveStatus = formatSensitiveStatus(metadata['sensitive']);
    const sourceInfo = formatSource(metadata['source']);
    
    elements.modalInfo.innerHTML = `
        <h3>图片信息</h3>
        <p><strong>ID:</strong> ${id}</p>
        <p><strong>创建时间:</strong> ${creationTime}</p>
        <p><strong>修改时间:</strong> ${modificationTime}</p>
        ${sensitiveStatus ? `<p>${sensitiveStatus}</p>` : ''}
        ${sourceInfo}
        ${files.length > 1 ? `<p><strong>当前文件:</strong> ${displayFile || '无'}</p>` : ''}
        ${filesHtml}
        <div class="document-content"><pre>${escapeHtml(doc || '无描述信息')}</pre></div>
        <div class="modal-actions">
            <button class="btn-view-doc" onclick="showDocumentModal('${id}', event)">📄 查看文档</button>
            <button class="btn-optimize" onclick="closeModal(); openSecondChance('${id}')">🔄 二次优化</button>
        </div>
    `;
    
    elements.modal.classList.add('show');
    document.body.style.overflow = 'hidden';
}

// 切换模态框中的图片
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
        if (spinner) spinner.classList.remove('hidden');
        if (text) text.textContent = '处理中...';
    } else {
        button.disabled = false;
        if (spinner) spinner.classList.add('hidden');
        // 根据按钮 ID 恢复对应的文字
        if (text) {
            text.textContent = button.id === 'upload-btn' ? '开始识别并添加' : 
                               button.id === 'sc-btn' ? '重新识别并保存' : 
                               button.id === 'search-btn' ? '搜索' : 
                               button.id === 'load-id-list-btn' ? '刷新列表' : 
                               button.id === 'check-dedup-btn' ? '开始查重' : '搜索';
        }
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

// 查重主函数
async function handleCheckDuplication() {
    setLoading(elements.checkDupBtn, true);
    elements.dedupResults.innerHTML = '<div class="empty-state">查重中，请稍候...</div>';
    elements.dedupStats.textContent = '';
    
    // 重置状态
    state.dedupResults = {};
    state.dedupGroups = [];
    state.dedupIdInfo = {};
    state.deletedIds.clear();
    
    try {
        // 1. 调用查重接口
        const response = await fetch('/check-duplication');
        const data = await response.json();
        
        if (!response.ok) {
            throw new Error(data.detail || '查重失败');
        }
        
        state.dedupResults = data.result;
        
        // 2. 解析并分组（按 id 分组）
        state.dedupGroups = groupDedupById(state.dedupResults);
        
        // 3. 获取每个 id 的详细信息
        await fetchIdInfo(state.dedupGroups);
        
        // 4. 渲染结果
        renderDedupResults();
        
        showToast('查重完成！', 'success');
    } catch (error) {
        elements.dedupResults.innerHTML = `<div class="empty-state error">查重失败：${error.message}</div>`;
        showToast(error.message, 'error');
    } finally {
        setLoading(elements.checkDupBtn, false);
    }
}

// 按 id 分组查重结果
function groupDedupById(rawResults) {
    const groups = new Map(); // id -> { id, images: [{path, fileName, related: []}] }
    
    // 第一步：收集所有出现过的图片路径
    const allPaths = new Set();
    
    for (const [sourcePath, duplicates] of Object.entries(rawResults)) {
        allPaths.add(sourcePath);
        for (const [dupPath, score] of duplicates) {
            allPaths.add(dupPath);
        }
    }
    
    // 第二步：为每个路径建立图片对象
    const imageMap = new Map(); // path -> { path, fileName, id, related: [] }
    
    for (const path of allPaths) {
        const fileName = path.split('/')[1];
        const id = extractIdFromPath(path);
        
        imageMap.set(path, {
            path,
            fileName,
            id,
            related: []
        });
    }
    
    // 第三步：填充重复关系
    for (const [sourcePath, duplicates] of Object.entries(rawResults)) {
        const sourceImage = imageMap.get(sourcePath);
        
        for (const [dupPath, score] of duplicates) {
            const dupImage = imageMap.get(dupPath);
            
            // 添加双向关系
            if (sourceImage && dupImage) {
                sourceImage.related.push({
                    path: dupPath,
                    fileName: dupImage.fileName,
                    id: dupImage.id,
                    score
                });
            }
        }
    }
    
    // 第四步：按 id 分组
    for (const [path, image] of imageMap.entries()) {
        const id = image.id;
        
        if (!groups.has(id)) {
            groups.set(id, {
                id,
                images: []
            });
        }
        
        groups.get(id).images.push(image);
    }
    
    return Array.from(groups.values());
}

// 从路径提取 id (e.g., "id1/image.jpg" -> "id1")
function extractIdFromPath(path) {
    return path.split('/')[0];
}

// 获取所有 id 的详细信息
async function fetchIdInfo(groups) {
    const idSet = new Set(groups.map(g => g.id));
    const promises = [];
    
    for (const id of idSet) {
        if (!state.dedupIdInfo[id]) {
            promises.push((async () => {
                try {
                    const response = await fetch(`/query-id?id=${encodeURIComponent(id)}`);
                    const data = await response.json();
                    state.dedupIdInfo[id] = data;
                } catch (error) {
                    console.error(`获取 id ${id} 信息失败:`, error);
                    state.dedupIdInfo[id] = null;
                }
            })());
        }
    }
    
    await Promise.all(promises);
}

// 渲染查重结果
function renderDedupResults() {
    if (state.dedupGroups.length === 0) {
        elements.dedupStats.textContent = '未发现重复图片';
        elements.dedupResults.innerHTML = '<div class="empty-state">🎉 没有发现重复的图片！</div>';
        return;
    }
    
    // 过滤掉已删除的组（可选，看需求是否要显示）
    const activeGroups = state.dedupGroups.filter(g => !state.deletedIds.has(g.id));
    
    elements.dedupStats.textContent = `发现 ${activeGroups.length} 组重复图片，共涉及 ${state.dedupGroups.length} 个素材`;
    
    elements.dedupResults.innerHTML = '';
    
    activeGroups.forEach(group => {
        const groupEl = createDedupGroupElement(group);
        elements.dedupResults.appendChild(groupEl);
    });
}

// 创建分组卡片元素
function createDedupGroupElement(group) {
    const card = document.createElement('div');
    card.className = `dedup-group ${state.deletedIds.has(group.id) ? 'deleted' : ''}`;
    card.dataset.groupId = group.id;
    
    const idInfo = state.dedupIdInfo[group.id];
    const creationTime = idInfo ? formatTimestamp(idInfo.metadata?.['creation_time']) : '未知';
    const modificationTime = idInfo ? formatTimestamp(idInfo.metadata?.['modification_time']) : '未知';
    const docContent = idInfo ? idInfo.document : '';
    
    // 构建图片列表 HTML
    let imagesHtml = '';
    
    group.images.forEach((image, index) => {
        const imageUrl = `/uploads/${image.path}`;
        const isDeleted = state.deletedIds.has(image.id);
        const hasRelated = image.related.length > 0;
        
        imagesHtml += `
            <div class="dedup-image-item ${isDeleted ? 'deleted' : ''}" data-image-path="${image.path}">
                <div class="dedup-main-image">
                    <div class="dedup-image-wrapper" onclick="showDedupImageDetail('${group.id}', '${image.fileName}')">
                        <img src="${imageUrl}" alt="${image.fileName}" loading="lazy" 
                             onload="updateImageResolution(this, '${image.path}')">
                    </div>
                    <div class="dedup-image-meta">
                        <div class="dedup-image-name">${image.fileName}</div>
                        <div class="dedup-image-resolution" data-path="${image.path}">-</div>
                        ${!hasRelated ? '<div class="dedup-no-dup">✅ 无重复图片</div>' : ''}
                    </div>
                </div>
                
                ${hasRelated ? `
                    <div class="dedup-related-list">
                        <div class="dedup-related-title">🔗 重复图片：</div>
                        ${image.related.map(rel => {
                            const relImageUrl = `/uploads/${rel.path}`;
                            const relIsDeleted = state.deletedIds.has(rel.id);
                            const scoreClass = getScoreClass(rel.score);
                            return `
                                <div class="dedup-related-item ${relIsDeleted ? 'deleted' : ''}" 
                                     data-related-path="${rel.path}" data-related-id="${rel.id}">
                                    <div class="dedup-related-image-wrapper" 
                                         onclick="showDedupImageDetail('${rel.id}', '${rel.fileName}')">
                                        <img src="${relImageUrl}" alt="${rel.fileName}" loading="lazy">
                                    </div>
                                    <div class="dedup-related-info">
                                        <div class="dedup-related-name">${rel.fileName}</div>
                                        <div class="dedup-related-id">ID: ${rel.id}</div>
                                        <div class="dedup-related-actions">
                                            <span class="dedup-image-score ${scoreClass}">score: ${rel.score}</span>
                                            <button class="btn-jump" onclick="jumpToGroup('${rel.id}', event)">
                                                跳转至 ID
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            `;
                        }).join('')}
                    </div>
                ` : ''}
                
                ${index < group.images.length - 1 ? '<div class="dedup-image-divider"></div>' : ''}
            </div>
        `;
    });
    
    const sensitiveStatus = idInfo?.metadata?.['sensitive'] === true ? '🔞 敏感内容' : '';
    const sourceInfo = idInfo?.metadata?.['source'] ? ` | 来源: ${idInfo.metadata['source']}` : '';
    
    card.innerHTML = `
        <div class="dedup-group-header">
            <div class="dedup-group-info">
                <div class="dedup-group-id">📁 ID: ${group.id} ${sensitiveStatus}</div>
                <div class="dedup-group-times">创建：${creationTime} | 修改：${modificationTime}${sourceInfo}</div>
            </div>
            <div class="dedup-group-actions">
                <button class="btn-view-doc" onclick="showDocumentModal('${group.id}', event)">
                    📄 查看文档
                </button>
                <button class="btn-delete" onclick="deleteDedupGroup('${group.id}', event)" 
                        ${state.deletedIds.has(group.id) ? 'disabled' : ''}>
                    ${state.deletedIds.has(group.id) ? '已删除' : '删除'}
                </button>
            </div>
        </div>
        <div class="dedup-images-list">
            ${imagesHtml}
        </div>
    `;
    
    // 存储 document 信息到卡片数据
    card.dataset.document = docContent || '';
    
    return card;
}


// 显示文档模态框
function showDocumentModal(id, event) {
    event.stopPropagation();
    
    const idInfo = state.dedupIdInfo[id];
    const docContent = idInfo ? idInfo.document : '';
    
    elements.modalInfo.innerHTML = `
        <h3>📄 索引文档 - ${id}</h3>
        <div class="document-content">
            <pre>${escapeHtml(docContent || '无文档内容')}</pre>
        </div>
        <div class="modal-actions">
            <button class="btn-optimize" onclick="closeModal(); openSecondChance('${id}')">🔄 二次优化</button>
        </div>
    `;
    
    elements.modalImage.style.display = 'none';
    elements.modal.classList.add('show');
    document.body.style.overflow = 'hidden';
}


// 查重页面显示图片详情
function showDedupImageDetail(id, specificFileName = null) {
    const idInfo = state.dedupIdInfo[id];
    
    if (!idInfo) {
        showToast('未找到图片信息，请重新查重', 'error');
        return;
    }
    
    const metadata = idInfo.metadata || {};
    const docContent = idInfo.document;
    
    // 从 metadata 中获取 file_names
    let files = metadata.file_names || [];
    
    // 如果 metadata 中没有，尝试从 document 解析（兜底）
    if (files.length === 0 && docContent) {
        const fileMatches = docContent.match(/file_names:\s*\n((?:\s*-\s*[^\n]+\n?)+)/);
        files = fileMatches ? fileMatches[1].match(/-\s*([^\n]+)/g).map(m => m.replace('- ', '').trim()) : [];
    }
    
    // 确定要显示的图片
    let displayFile = specificFileName;
    if (!displayFile && files.length > 0) {
        displayFile = files[0];
    }
    
    // 设置模态框图片
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
    const creationTime = formatTimestamp(metadata['creation_time']);
    const modificationTime = formatTimestamp(metadata['modification_time']);
    const sensitiveStatus = formatSensitiveStatus(metadata['sensitive']);
    const sourceInfo = formatSource(metadata['source']);
    
    elements.modalInfo.innerHTML = `
        <h3>图片信息</h3>
        <p><strong>ID:</strong> ${id}</p>
        <p><strong>创建时间:</strong> ${creationTime}</p>
        <p><strong>修改时间:</strong> ${modificationTime}</p>
        ${sensitiveStatus ? `<p>${sensitiveStatus}</p>` : ''}
        ${sourceInfo}
        ${files.length > 1 ? `<p><strong>当前文件:</strong> ${displayFile || '无'}</p>` : ''}
        ${filesHtml}
        <div class="document-content"><pre>${escapeHtml(docContent || '无描述信息')}</pre></div>
        <div class="modal-actions">
            <button class="btn-view-doc" onclick="showDocumentModal('${id}', event)">📄 查看文档</button>
            <button class="btn-optimize" onclick="closeModal(); openSecondChance('${id}')">🔄 二次优化</button>
        </div>
    `;
    
    elements.modal.classList.add('show');
    document.body.style.overflow = 'hidden';
}


// 跳转至指定 ID 分组
function jumpToGroup(targetId, event) {
    event.stopPropagation();
    
    const targetGroup = document.querySelector(`.dedup-group[data-group-id="${targetId}"]`);
    if (targetGroup) {
        targetGroup.scrollIntoView({ behavior: 'smooth', block: 'center' });
        targetGroup.style.transition = 'box-shadow 0.3s';
        targetGroup.style.boxShadow = '0 0 0 3px #4f46e5';
        setTimeout(() => {
            targetGroup.style.boxShadow = '';
        }, 2000);
    } else {
        showToast(`ID "${targetId}" 的分组不存在或已删除`, 'warning');
    }
}


// 获取相似度评分的样式类
function getScoreClass(score) {
    if (score <= 5) return 'high';
    if (score <= 10) return 'medium';
    return 'low';
}

// 更新图片分辨率显示
async function updateImageResolution(imgElement, imagePath) {
    try {
        // 创建 Image 对象获取分辨率
        const img = new Image();
        img.src = imgElement.src;
        await new Promise((resolve, reject) => {
            img.onload = resolve;
            img.onerror = reject;
        });
        
        const resolutionEl = document.querySelector(`.dedup-image-resolution[data-path="${imagePath}"]`);
        if (resolutionEl) {
            resolutionEl.textContent = `${img.width} × ${img.height} px`;
        }
    } catch (error) {
        const resolutionEl = document.querySelector(`.dedup-image-resolution[data-path="${imagePath}"]`);
        if (resolutionEl) {
            resolutionEl.textContent = '获取失败';
        }
    }
}

// 删除分组
async function deleteDedupGroup(id, event) {
    if (!confirm(`确定要删除素材 "${id}" 吗？此操作不可恢复！`)) {
        return;
    }
    
    const btn = event.target;
    const originalText = btn.textContent;
    btn.textContent = '删除中...';
    btn.disabled = true;
    
    try {
        const response = await fetch(`/delete?id=${encodeURIComponent(id)}`);
        const data = await response.json();
        
        if (!response.ok) {
            throw new Error(data.detail || '删除失败');
        }
        
        // 标记为已删除
        state.deletedIds.add(id);
        
        // 更新 UI 状态
        updateDeletedState(id);
        
        showToast(`素材 "${id}" 已删除`, 'success');
    } catch (error) {
        showToast(error.message, 'error');
        btn.textContent = originalText;
        btn.disabled = false;
    }
}

// 更新已删除状态的显示
function updateDeletedState(deletedId) {
    // 1. 更新该分组的显示
    const deletedGroup = document.querySelector(`.dedup-group[data-group-id="${deletedId}"]`);
    if (deletedGroup) {
        deletedGroup.classList.add('deleted');
        const deleteBtn = deletedGroup.querySelector('.btn-delete');
        if (deleteBtn) {
            deleteBtn.textContent = '已删除';
            deleteBtn.disabled = true;
        }
    }
    
    // 2. 更新所有引用该 id 的相关图片
    document.querySelectorAll(`.dedup-related-item[data-related-id="${deletedId}"]`).forEach(item => {
        item.classList.add('deleted');
    });
    
    // 3. 更新所有属于该 id 的主图片
    document.querySelectorAll(`.dedup-image-item[data-image-path^="${deletedId}/"]`).forEach(item => {
        item.classList.add('deleted');
    });
    
    // 4. 更新统计信息
    const activeGroups = state.dedupGroups.filter(g => !state.deletedIds.has(g.id));
    elements.dedupStats.textContent = `发现 ${activeGroups.length} 组重复图片（已删除 ${state.deletedIds.size} 个素材）`;
}

// 格式化时间戳
function formatTimestamp(timestamp) {
    if (!timestamp) return '未知';
    const date = new Date(timestamp * 1000);
    return date.toLocaleString('zh-CN', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit'
    });
}


// 加载 ID 列表
async function handleIdListLoad() {
    setLoading(elements.loadIdListBtn, true);
    elements.idListResults.innerHTML = '<div class="empty-state">加载中...</div>';
    elements.manageStats.textContent = '';
    
    try {
        // 1. 获取 ID 列表
        const response = await fetch(`/get-id-list?page=${state.idListPage}&size=${state.idListPageSize}`);
        const data = await response.json();
        
        if (!response.ok) {
            throw new Error(data.detail || '获取列表失败');
        }
        
        state.idListTotal = data.item_count;
        const idList = data.id_list;
        
        // 2. 批量获取每个 ID 的详情
        elements.idListResults.innerHTML = `<div class="empty-state">获取到 ${idList.length} 个 ID，正在加载详情...</div>`;
        
        const promises = idList.map(async (id) => {
            // 先从缓存获取
            if (state.idListCache[id]) {
                return { id, ...state.idListCache[id] };
            }
            // 否则调用 API
            try {
                const res = await fetch(`/query-id?id=${encodeURIComponent(id)}`);
                const result = await res.json();
                // 缓存结果
                state.idListCache[id] = { document: result.document, metadata: result.metadata };
                return { id, document: result.document, metadata: result.metadata };
            } catch (error) {
                console.error(`获取 ID ${id} 详情失败:`, error);
                return { id, document: '', metadata: {} };
            }
        });
        
        const results = await Promise.all(promises);
        
        // 3. 渲染结果
        renderIdList(results, data.item_count);
        
        // 4. 更新分页控件
        updatePageControls(data.item_count);
        
        showToast('列表加载完成！', 'success');
    } catch (error) {
        elements.idListResults.innerHTML = `<div class="empty-state error">加载失败：${error.message}</div>`;
        showToast(error.message, 'error');
    } finally {
        setLoading(elements.loadIdListBtn, false);
    }
}

// 渲染 ID 列表
function renderIdList(results, totalCount) {
    if (results.length === 0) {
        elements.manageStats.textContent = '暂无数据';
        elements.idListResults.innerHTML = '<div class="empty-state">📭 还没有图片，去添加一些吧！</div>';
        return;
    }
    
    const currentPage = state.idListPage;
    const pageSize = state.idListPageSize;
    const start = (currentPage - 1) * pageSize + 1;
    const end = Math.min(currentPage * pageSize, totalCount);
    
    elements.manageStats.textContent = `共 ${totalCount} 个素材，当前显示第 ${start}-${end} 个`;
    elements.idListResults.innerHTML = '';
    
    results.forEach(item => {
        createIdListCard(item);
    });
}

// 创建 ID 列表卡片（复用搜索结果卡片逻辑）
function createIdListCard(item) {
    const { id, document: docContent, metadata } = item;
    const card = document.createElement('div');
    card.className = 'result-card';
    
    const fileNames = metadata.file_names || [];
    const creationTime = formatTimestamp(metadata['creation_time']);
    const modificationTime = formatTimestamp(metadata['modification_time']);
    
    // 构建图片区域 HTML（复用搜索结果的图片显示逻辑）
    let imagesHtml = '';
    if (fileNames.length > 0) {
        if (fileNames.length === 1) {
            const imageUrl = `/uploads/${id}/${fileNames[0]}`;
            imagesHtml = `
                <div class="result-image-container single">
                    <img src="${imageUrl}" class="result-image" alt="${fileNames[0]}" 
                         onerror="this.parentElement.innerHTML='<div class=\\'result-image-placeholder\\' style=\\'height: 200px; display: flex; align-items: center; justify-content: center; background: #e2e8f0;\\'>📷 加载失败</div>'">
                </div>
            `;
        } else {
            imagesHtml = '<div class="result-images-grid">';
            fileNames.slice(0, 4).forEach((fileName, idx) => {
                const imageUrl = `/uploads/${id}/${fileName}`;
                imagesHtml += `
                    <div class="result-image-wrapper" onclick="event.stopPropagation(); showImageDetail('${id}', '${fileName}')">
                        <img src="${imageUrl}" alt="${fileName}" loading="lazy" 
                             onerror="this.parentElement.innerHTML='<div class=\\'image-error\\'>📷</div>'">
                    </div>
                `;
            });
            if (fileNames.length > 4) {
                imagesHtml += `<div class="result-image-more">+${fileNames.length - 4}</div>`;
            }
            imagesHtml += '</div>';
        }
    } else {
        imagesHtml = `
            <div class="result-image-placeholder" style="height: 200px; background: #e2e8f0; display: flex; align-items: center; justify-content: center;">
                <span>📷 暂无图片</span>
            </div>
        `;
    }
    
    // 截取文档内容预览
    const docPreview = docContent ? docContent.substring(0, 150) + (docContent.length > 150 ? '...' : '') : '无描述信息';
    const sourceInfo = metadata['source'] ? `<div class="result-source">来源: ${escapeHtml(metadata['source'])}</div>` : '';
    
    card.innerHTML = `
        ${imagesHtml}
        <div class="result-info">
            <div class="result-id">📁 ID: ${id}</div>
            <div class="result-times">
                <span>创建：${creationTime}</span>
                <span>修改：${modificationTime}</span>
            </div>
            ${metadata['sensitive'] === true ? '<div class="result-sensitive">🔞 敏感</div>' : ''}
            ${sourceInfo}
            ${fileNames.length > 1 ? `<div class="result-files-count">${fileNames.length} 个文件</div>` : ''}
            <div class="result-doc-preview">${escapeHtml(docPreview)}</div>
            <div class="result-actions">
                <button class="btn-view" onclick="event.stopPropagation(); showImageDetail('${id}')">查看详情</button>
                <button class="btn-optimize" onclick="event.stopPropagation(); openSecondChance('${id}')">二次优化</button>
                <button class="btn-delete" onclick="event.stopPropagation(); deleteIdListItem('${id}', this)">删除</button>
            </div>
        </div>
    `;
    
    card.addEventListener('click', () => {
        const firstFile = fileNames.length > 0 ? fileNames[0] : null;
        showImageDetail(id, firstFile);
    });
    
    elements.idListResults.appendChild(card);
}

// 处理分页
function handlePageChange(delta) {
    const newPage = state.idListPage + delta;
    
    // 计算总页数
    const totalPages = Math.ceil(state.idListTotal / state.idListPageSize) || 1;
    
    // 边界检查
    if (newPage < 1 || newPage > totalPages) {
        showToast('已经是第一页或最后一页了', 'info');
        return;
    }
    
    state.idListPage = newPage;
    elements.currentPageInput.value = newPage;
    handleIdListLoad();
}

// 处理页码输入
function handlePageInput() {
    const newPage = parseInt(elements.currentPageInput.value);
    
    // 计算总页数
    const totalPages = Math.ceil(state.idListTotal / state.idListPageSize) || 1;
    
    // 验证输入
    if (isNaN(newPage) || newPage < 1) {
        showToast('页码必须大于 0', 'warning');
        elements.currentPageInput.value = state.idListPage;
        return;
    }
    
    if (newPage > totalPages) {
        showToast(`最大页码为 ${totalPages}`, 'warning');
        elements.currentPageInput.value = state.idListPage;
        return;
    }
    
    state.idListPage = newPage;
    handleIdListLoad();
}

// 更新分页控件状态
function updatePageControls(totalCount) {
    const totalPages = Math.ceil(totalCount / state.idListPageSize) || 1;
    elements.totalPages.textContent = totalPages;
    
    // 更新 input 的 max 属性
    if (elements.currentPageInput) {
        elements.currentPageInput.max = totalPages;
    }
    
    elements.prevPageBtn.disabled = state.idListPage <= 1;
    elements.nextPageBtn.disabled = state.idListPage >= totalPages;
}

// 删除图片列表项
async function deleteIdListItem(id, btn) {
    if (!confirm(`确定要删除素材 "${id}" 吗？此操作不可恢复！`)) {
        return;
    }
    
    const originalText = btn.textContent;
    btn.textContent = '删除中...';
    btn.disabled = true;
    
    try {
        const response = await fetch(`/delete?id=${encodeURIComponent(id)}`);
        const data = await response.json();
        
        if (!response.ok) {
            throw new Error(data.detail || '删除失败');
        }
        
        // 从缓存中移除
        delete state.idListCache[id];
        
        // 移除卡片
        const card = btn.closest('.result-card');
        card.style.transition = 'all 0.3s';
        card.style.opacity = '0';
        card.style.transform = 'scale(0.9)';
        setTimeout(() => card.remove(), 300);
        
        showToast(`素材 "${id}" 已删除`, 'success');
        
        // 更新统计（可选：重新加载列表或减少计数）
        state.idListTotal--;
        elements.manageStats.textContent = `共 ${state.idListTotal} 个素材（已刷新计数）`;
        
    } catch (error) {
        showToast(error.message, 'error');
        btn.textContent = originalText;
        btn.disabled = false;
    }
}

// 在 switchTab 中添加
function switchTab(tabName) {
    state.currentTab = tabName;
    
    elements.tabBtns.forEach(btn => {
        btn.classList.toggle('active', btn.dataset.tab === tabName);
    });
    
    elements.tabContents.forEach(content => {
        content.classList.toggle('active', content.id === `${tabName}-tab`);
    });
    
    // 新增：切换到图片管理标签时自动加载列表
    if (tabName === 'manage' && elements.idListResults.innerHTML.includes('点击') || 
        elements.idListResults.innerHTML.includes('加载中')) {
        handleIdListLoad();
    }
}


// 启动应用
init();
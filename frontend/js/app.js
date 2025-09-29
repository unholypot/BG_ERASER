// File: frontend/js/app.js
// Directory: your-image-app/frontend/js/

// Main Application JavaScript
// Handles all functionality for the authenticated app section

// Global variables
let selectedFile = null;
let currentImages = [];
let currentLogs = [];

// Initialize app on load
document.addEventListener('DOMContentLoaded', function() {
    // Check authentication
    if (!isAuthenticated()) {
        redirectToLogin();
        return;
    }
    
    // Set username in UI
    const username = getUserName();
    document.getElementById('username').textContent = username;
    
    // Initialize navigation
    initializeNavigation();
    
    // Initialize upload area
    initializeUploadArea();
    
    // Load dashboard data
    loadDashboardData();
    
    // Handle hash navigation
    handleHashNavigation();
});

// Navigation System (similar to React Router)
function initializeNavigation() {
    // Handle nav link clicks
    document.querySelectorAll('.nav-link').forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            const page = link.getAttribute('data-page');
            navigateTo(page);
        });
    });
}

function navigateTo(page) {
    // Update URL hash
    window.location.hash = page;
    
    // Hide all pages
    document.querySelectorAll('.page').forEach(p => {
        p.classList.remove('active');
    });
    
    // Show selected page
    const pageElement = document.getElementById(page);
    if (pageElement) {
        pageElement.classList.add('active');
    }
    
    // Update nav active state
    document.querySelectorAll('.nav-link').forEach(link => {
        link.classList.remove('active');
        if (link.getAttribute('data-page') === page) {
            link.classList.add('active');
        }
    });
    
    // Load page-specific data
    switch(page) {
        case 'dashboard':
            loadDashboardData();
            break;
        case 'gallery':
            loadGallery();
            break;
        case 'logs':
            loadLogs();
            break;
    }
}

function handleHashNavigation() {
    const hash = window.location.hash.slice(1) || 'dashboard';
    navigateTo(hash);
    
    // Listen for hash changes
    window.addEventListener('hashchange', () => {
        const newHash = window.location.hash.slice(1) || 'dashboard';
        navigateTo(newHash);
    });
}

// Logout function (matching Remove My Background app)
function logout() {
    clearAuthData();
    window.location.href = 'index.html';
}

// Dashboard Functions
async function loadDashboardData() {
    try {
        // Load images to get count
        const response = await API.getImages();
        if (response && response.ok) {
            const images = await response.json();
            document.getElementById('totalImages').textContent = images.length || 0;
            
            // Count today's images
            const today = new Date().toDateString();
            const todayCount = images.filter(img => {
                return new Date(img.timestamp || img.createdAt).toDateString() === today;
            }).length;
            document.getElementById('processedToday').textContent = todayCount;
        }
    } catch (error) {
        console.error('Error loading dashboard data:', error);
    }
}

// Upload Functionality (matching Remove My Background app's Request.js)
function initializeUploadArea() {
    const uploadArea = document.getElementById('uploadArea');
    const fileInput = document.getElementById('fileInput');
    
    if (!uploadArea || !fileInput) return;
    
    // Click to upload
    uploadArea.addEventListener('click', () => {
        fileInput.click();
    });
    
    // File selection
    fileInput.addEventListener('change', (e) => {
        handleFileSelect(e.target.files[0]);
    });
    
    // Drag and drop
    uploadArea.addEventListener('dragover', (e) => {
        e.preventDefault();
        uploadArea.classList.add('dragover');
    });
    
    uploadArea.addEventListener('dragleave', () => {
        uploadArea.classList.remove('dragover');
    });
    
    uploadArea.addEventListener('drop', (e) => {
        e.preventDefault();
        uploadArea.classList.remove('dragover');
        handleFileSelect(e.dataTransfer.files[0]);
    });
}

function handleFileSelect(file) {
    if (!file) return;
    
    // Validate file type
    if (!CONFIG.APP.ALLOWED_TYPES.includes(file.type)) {
        showAlert('uploadAlert', 'Please select a valid image file (JPG, PNG, or WebP)', 'error');
        return;
    }
    
    // Validate file size
    if (file.size > CONFIG.APP.MAX_FILE_SIZE) {
        showAlert('uploadAlert', 'File size must be less than 10MB', 'error');
        return;
    }
    
    selectedFile = file;
    
    // Update upload area UI
    const uploadArea = document.getElementById('uploadArea');
    uploadArea.classList.add('has-file');
    uploadArea.innerHTML = `
        <div class="upload-icon">✅</div>
        <p><strong>${file.name}</strong></p>
        <p class="text-muted">${(file.size / 1024 / 1024).toFixed(2)} MB</p>
    `;
    
    // Enable process button
    document.getElementById('processBtn').disabled = false;
    
    // Show preview
    const reader = new FileReader();
    reader.onload = (e) => {
        document.getElementById('previewContainer').innerHTML = `
            <div class="preview-item">
                <div class="preview-label">Original Image</div>
                <img src="${e.target.result}" alt="Original">
            </div>
        `;
    };
    reader.readAsDataURL(file);
}

async function processImage() {
    if (!selectedFile) {
        showAlert('uploadAlert', 'Please select an image first', 'error');
        return;
    }
    
    const processBtn = document.getElementById('processBtn');
    const loading = document.getElementById('uploadLoading');
    const imageName = document.getElementById('imageName').value || selectedFile.name.split('.')[0];
    
    // Show loading state
    processBtn.disabled = true;
    loading.style.display = 'flex';
    hideAlert('uploadAlert');
    
    try {
        // Upload and process image
        const response = await API.uploadImage(selectedFile, imageName);
        
        if (response && response.ok) {
            const data = await response.json();
            
            // Add success message
            showAlert('uploadAlert', 'Image processed successfully!', 'success');
            
            // ===== DEV-ONLY BEGIN =====
            // Show the processed image immediately
            if (data.processedUrl) {
                // Build the correct URL for local development
                const processedImageUrl = `${CONFIG.API_HOST}/uploads/${data.processedUrl}`;
                
                // Update preview container to show both images
                const previewContainer = document.getElementById('previewContainer');
                const originalPreview = previewContainer.querySelector('.preview-item');
                
                // Add processed image preview
                const processedPreview = document.createElement('div');
                processedPreview.className = 'preview-item';
                processedPreview.innerHTML = `
                    <div class="preview-label">Processed (Background Removed)</div>
                    <img src="${processedImageUrl}" alt="Processed" onerror="console.error('Failed to load processed image from:', '${processedImageUrl}')">
                    <button class="btn btn-success btn-block mt-2" onclick="downloadImage('${processedImageUrl}', '${data.imageName || imageName}')">
                        📥 Download Processed Image
                    </button>
                `;
                
                previewContainer.appendChild(processedPreview);
                
                console.log('Processed image URL:', processedImageUrl);
            }
            // ===== DEV-ONLY END =====
            
        } else {
            const errorData = await response.json();
            showAlert('uploadAlert', errorData.message || 'Failed to process image', 'error');
        }
    } catch (error) {
        console.error('Upload error:', error);
        showAlert('uploadAlert', 'An error occurred while processing your image', 'error');
    } finally {
        processBtn.disabled = false;
        loading.style.display = 'none';
    }
}

// Replace the loadGallery function with this updated version:
async function loadGallery() {
    const loading = document.getElementById('galleryLoading');
    const grid = document.getElementById('galleryGrid');
    const alert = document.getElementById('galleryAlert');
    
    loading.style.display = 'flex';
    hideAlert('galleryAlert');
    
    try {
        const response = await API.getImages();
        
        if (response && response.ok) {
            const images = await response.json();
            currentImages = images;
            
            if (images.length === 0) {
                grid.innerHTML = `
                    <div class="text-center" style="grid-column: 1/-1;">
                        <p class="text-muted">No images yet. Start by uploading your first image!</p>
                        <button class="btn btn-primary mt-2" onclick="navigateTo('upload')">
                            Upload Image
                        </button>
                    </div>
                `;
            } else {
                // Sort images by date (newest first)
                images.sort((a, b) => new Date(b.timestamp || b.createdAt) - new Date(a.timestamp || a.createdAt));
                
                grid.innerHTML = images.map(img => {
                    // Use the retrieve endpoint for all images
                    const imageUrl = `${CONFIG.API_HOST}/images/retrieve?filename=${encodeURIComponent(img.processedS3Url || img.filename)}`;
                    
                    return `
                        <div class="gallery-item" onclick="viewImage('${img.processedS3Url || img.filename}', '${img.imageName}')">
                            <img src="${imageUrl}" 
                                 alt="${img.imageName}"
                                 onerror="this.onerror=null; this.src='data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAwIiBoZWlnaHQ9IjIwMCIgdmlld0JveD0iMCAwIDIwMCAyMDAiIGZpbGw9Im5vbmUiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+CjxyZWN0IHdpZHRoPSIyMDAiIGhlaWdodD0iMjAwIiBmaWxsPSIjRTBFMEUwIi8+Cjx0ZXh0IHg9IjUwJSIgeT0iNTAlIiBkb21pbmFudC1iYXNlbGluZT0ibWlkZGxlIiB0ZXh0LWFuY2hvcj0ibWlkZGxlIiBmb250LWZhbWlseT0iQXJpYWwiIGZvbnQtc2l6ZT0iMTQiIGZpbGw9IiM5OTk5OTkiPkltYWdlIE5vdCBGb3VuZDwvdGV4dD4KPC9zdmc+'"
                            >
                            <div class="gallery-item-info">
                                <div class="gallery-item-name">${img.imageName}</div>
                                <div class="gallery-item-date">${formatDate(img.timestamp || img.createdAt)}</div>
                            </div>
                        </div>
                    `;
                }).join('');
            }
        } else if (response && response.status === 204) {
            grid.innerHTML = `
                <div class="text-center" style="grid-column: 1/-1;">
                    <p class="text-muted">No images found. Upload your first image!</p>
                    <button class="btn btn-primary mt-2" onclick="navigateTo('upload')">
                        Upload Image
                    </button>
                </div>
            `;
        } else {
            showAlert('galleryAlert', 'Failed to load images', 'error');
        }
    } catch (error) {
        console.error('Gallery error:', error);
        showAlert('galleryAlert', 'An error occurred while loading images', 'error');
    } finally {
        loading.style.display = 'none';
    }
}

function viewImage(filename, displayName) {
    // ===== DEV-ONLY BEGIN =====
    const imageUrl = filename.includes('/') 
        ? `${CONFIG.API_HOST}/uploads/${filename}`
        : `${CONFIG.API_HOST}/images/retrieve?filename=${encodeURIComponent(filename)}`;
    // ===== DEV-ONLY END =====
    
    const modal = document.createElement('div');
    modal.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(0,0,0,0.8);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 10000;
        cursor: pointer;
    `;
    
    modal.innerHTML = `
        <div style="background: white; border-radius: 10px; padding: 2rem; max-width: 90%; max-height: 90%; overflow: auto; cursor: default;" onclick="event.stopPropagation()">
            <h2>${displayName || filename}</h2>
            <img src="${imageUrl}" style="max-width: 100%; height: auto; display: block; margin: 1rem 0;">
            <div style="display: flex; gap: 1rem;">
                <button class="btn btn-success" onclick="downloadImage('${imageUrl}', '${displayName || filename}')">
                    📥 Download Image
                </button>
                <button class="btn btn-secondary" onclick="this.closest('div[style]').parentElement.remove()">
                    Close
                </button>
            </div>
        </div>
    `;
    
    modal.addEventListener('click', (e) => {
        if (e.target === modal) {
            modal.remove();
        }
    });
    
    document.body.appendChild(modal);
}

function downloadImage(url, filename) {
    // Create a temporary anchor element for download
    fetch(url)
        .then(response => response.blob())
        .then(blob => {
            const blobUrl = window.URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = blobUrl;
            link.download = filename.includes('.') ? filename : `${filename}_processed.png`;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            window.URL.revokeObjectURL(blobUrl);
        })
        .catch(error => {
            console.error('Download error:', error);
            alert('Failed to download image');
        });
}

// Add a function to reset upload form after successful processing
function resetUploadForm() {
    selectedFile = null;
    const uploadArea = document.getElementById('uploadArea');
    const fileInput = document.getElementById('fileInput');
    const processBtn = document.getElementById('processBtn');
    const imageName = document.getElementById('imageName');
    
    if (uploadArea) {
        uploadArea.classList.remove('has-file');
        uploadArea.innerHTML = `
            <div class="upload-icon">📤</div>
            <p>Drag & drop your image here or click to browse</p>
            <p class="text-muted">Supports JPG, PNG, WebP (Max 10MB)</p>
            <input type="file" id="fileInput" class="file-input" accept="image/*" style="display: none;">
        `;
        // Re-initialize upload area after resetting
        initializeUploadArea();
    }
    
    if (fileInput) fileInput.value = '';
    if (processBtn) processBtn.disabled = true;
    if (imageName) imageName.value = '';
    
    hideAlert('uploadAlert');
}

// Add a button to start a new upload after processing
function addNewUploadButton() {
    const previewContainer = document.getElementById('previewContainer');
    if (previewContainer && !document.getElementById('newUploadBtn')) {
        const button = document.createElement('button');
        button.id = 'newUploadBtn';
        button.className = 'btn btn-primary btn-block btn-lg mt-3';
        button.innerHTML = '🔄 Process Another Image';
        button.onclick = () => {
            resetUploadForm();
            document.getElementById('previewContainer').innerHTML = '';
        };
        previewContainer.parentElement.appendChild(button);
    }
}

// Logs Functions (matching Remove My Background app's Logs.js)
async function loadLogs() {
    const loading = document.getElementById('logsLoading');
    const table = document.getElementById('logsTable');
    const tbody = document.getElementById('logsTableBody');
    
    loading.style.display = 'flex';
    table.style.display = 'none';
    hideAlert('logsAlert');
    
    try {
        const response = await API.getLogs();
        
        if (response && response.ok) {
            const logs = await response.json();
            currentLogs = logs;
            
            if (logs.length === 0) {
                tbody.innerHTML = `
                    <tr>
                        <td colspan="3" class="text-center text-muted">No activity logs yet</td>
                    </tr>
                `;
            } else {
                // Sort logs by date (newest first)
                logs.sort((a, b) => new Date(b.timestamp || b.createdAt) - new Date(a.timestamp || a.createdAt));
                
                tbody.innerHTML = logs.map(log => `
                    <tr>
                        <td>${formatDateTime(log.timestamp || log.createdAt)}</td>
                        <td>${log.description}</td>
                        <td>${log.imageId || '-'}</td>
                    </tr>
                `).join('');
            }
            
            table.style.display = 'table';
        } else if (response && response.status === 404) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="3" class="text-center text-muted">No logs found</td>
                </tr>
            `;
            table.style.display = 'table';
        } else {
            showAlert('logsAlert', 'Failed to load logs', 'error');
        }
    } catch (error) {
        console.error('Logs error:', error);
        showAlert('logsAlert', 'An error occurred while loading logs', 'error');
    } finally {
        loading.style.display = 'none';
    }
}

// Utility Functions
function showAlert(alertId, message, type) {
    const alert = document.getElementById(alertId);
    if (alert) {
        alert.className = `alert alert-${type} show`;
        alert.textContent = message;
        
        // Auto-hide success messages
        if (type === 'success') {
            setTimeout(() => {
                hideAlert(alertId);
            }, 5000);
        }
    }
}

function hideAlert(alertId) {
    const alert = document.getElementById(alertId);
    if (alert) {
        alert.classList.remove('show');
    }
}

function formatDate(dateString) {
    if (!dateString) return 'Unknown';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric'
    });
}

function formatDateTime(dateString) {
    if (!dateString) return 'Unknown';
    const date = new Date(dateString);
    return date.toLocaleString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });
}

// Reset upload area
function resetUploadArea() {
    selectedFile = null;
    const uploadArea = document.getElementById('uploadArea');
    const fileInput = document.getElementById('fileInput');
    const processBtn = document.getElementById('processBtn');
    const previewContainer = document.getElementById('previewContainer');
    const imageName = document.getElementById('imageName');
    
    if (uploadArea) {
        uploadArea.classList.remove('has-file');
        uploadArea.innerHTML = `
            <div class="upload-icon">📤</div>
            <p>Drag & drop your image here or click to browse</p>
            <p class="text-muted">Supports JPG, PNG, WebP (Max 10MB)</p>
            <input type="file" id="fileInput" class="file-input" accept="image/*" style="display: none;">
        `;
        // Re-initialize upload area after resetting
        initializeUploadArea();
    }
    
    if (fileInput) fileInput.value = '';
    if (processBtn) processBtn.disabled = true;
    if (previewContainer) previewContainer.innerHTML = '';
    if (imageName) imageName.value = '';
    
    hideAlert('uploadAlert');
}

// Auto-refresh gallery and logs when navigating to them
window.addEventListener('hashchange', () => {
    const hash = window.location.hash.slice(1);
    if (hash === 'gallery') {
        loadGallery();
    } else if (hash === 'logs') {
        loadLogs();
    }
});

// Periodically check auth status
setInterval(() => {
    if (!isAuthenticated()) {
        redirectToLogin();
    }
}, 60000); // Check every minute
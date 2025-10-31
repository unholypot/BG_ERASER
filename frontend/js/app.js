// File: frontend/js/app.js

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

// Navigation System 
function initializeNavigation() {

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
            
            // Show the processed image immediately
            if (data.processedUrl) {
                // The processedUrl is already a complete presigned URL
                const processedImageUrl = data.processedUrl;
                const imageId = data.imageId; // Get the imageId from response
                
                // Update preview container to show both images
                const previewContainer = document.getElementById('previewContainer');
                
                // Add processed image preview
                const processedPreview = document.createElement('div');
                processedPreview.className = 'preview-item';
                processedPreview.innerHTML = `
                    <div class="preview-label">Processed (Background Removed)</div>
                    <img src="${processedImageUrl}" alt="Processed">
                    <button class="btn btn-success btn-block mt-2" onclick="downloadImage('${imageId}', '${data.imageName || imageName}')">
                         Download Processed Image
                    </button>
                `;
                
                previewContainer.appendChild(processedPreview);
                
                console.log('Processed image URL:', processedImageUrl);
                console.log('Image ID:', imageId);
            }
            
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


async function loadGallery() {
    const loading = document.getElementById('galleryLoading');
    const grid = document.getElementById('galleryGrid');
    
    loading.style.display = 'flex';
    hideAlert('galleryAlert');
    
    try {
        const response = await API.getImages();
        
        if (response && response.ok) {
            const images = await response.json();
            
            if (images.length === 0) {
                grid.innerHTML = '<p>No images yet</p>';
            } else {
                grid.innerHTML = images.map(img => `
    <div class="gallery-item">
        <img src="${img.presignedUrl}" alt="${img.imageName}" onclick="viewImage('${img.imageId}', '${img.imageName}')">
        <div class="gallery-item-info">
            <div class="gallery-item-name">${img.imageName}</div>
            <div class="gallery-item-date">${formatDate(img.timestamp)}</div>
            <button class="btn btn-sm btn-success" onclick="event.stopPropagation(); downloadImage('${img.imageId}', '${img.imageName}')">
                Download
            </button>
        </div>
    </div>
`).join('');
            }
        }
    } catch (error) {
        console.error('Gallery error:', error);
        showAlert('galleryAlert', 'Failed to load images', 'error');
    } finally {
        loading.style.display = 'none';
    }
}

async function viewImage(imageId, displayName) {
    try {
        // Fetch presigned URLs for this image
        const response = await fetch(`${CONFIG.API_HOST}/images/url/${imageId}`, {
            headers: getAuthHeaders()
        });
        
        if (response.ok) {
            const data = await response.json();
            const imageUrl = data.processedUrl;
            
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
        <h2>${displayName}</h2>
        <img src="${imageUrl}" style="max-width: 100%; height: auto; display: block; margin: 1rem 0;">
        <div style="display: flex; gap: 1rem;">
            <button class="btn btn-success" onclick="downloadImage('${imageId}', '${displayName}')">
                🔥 Download Image
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
    } catch (error) {
        console.error('Error loading image:', error);
        alert('Failed to load image');
    }
}

function downloadImage(imageId, filename) {
    // Get the token
    const token = localStorage.getItem(CONFIG.APP.TOKEN_KEY);
    
    if (!token) {
        alert('Please login to download images');
        return;
    }
    
    // Create download URL with token as query parameter
    const downloadUrl = `${CONFIG.API_HOST}/images/download/${imageId}?token=${encodeURIComponent(token)}`;
    

    const link = document.createElement('a');
    link.href = downloadUrl;
    link.download = filename.includes('.') ? filename : `${filename}_processed.png`;
    link.style.display = 'none';
    
    document.body.appendChild(link);
    link.click();
    
    // Clean up
    setTimeout(() => {
        document.body.removeChild(link);
    }, 100);
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
// File: frontend/js/api.js
// Directory: your-image-app/frontend/js/

// API Helper Functions

async function apiCall(endpoint, options = {}) {
    const defaultOptions = {
        headers: {
            ...getAuthHeaders(),
            ...options.headers
        }
    };
    
    // Don't set Content-Type for FormData
    if (!(options.body instanceof FormData)) {
        defaultOptions.headers['Content-Type'] = 'application/json';
    }
    
    try {
        const response = await fetch(`${CONFIG.API_HOST}${endpoint}`, {
            ...defaultOptions,
            ...options
        });
        
        if (response.status === 401) {
            // Unauthorized, redirect to login
            redirectToLogin();
            return;
        }
        
        return response;
    } catch (error) {
        console.error('API call error:', error);
        throw error;
    }
}



// API Functions for core features
const API = {
    // Upload and process image
    uploadImage: async (file, imageName) => {
        const formData = new FormData();
        formData.append('image', file);
        if (imageName) {
            formData.append('imageName', imageName);
        }
        
        return await apiCall('/upload', {
            method: 'POST',
            body: formData
        });
    },
    
    // Get all images - fixed endpoint
    getImages: async () => {
        return await apiCall('/images');
    },

    // Get single image - fixed to match backend
    getImage: async (filename) => {
        return await apiCall(`/images/retrieve?filename=${encodeURIComponent(filename)}`);
    },
    
    // Get logs
    getLogs: async () => {
        return await apiCall('/logs');
    }
};
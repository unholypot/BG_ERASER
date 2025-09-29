// File: frontend/js/auth.js
// Directory: your-image-app/frontend/js/

// Authentication helper functions

function isAuthenticated() {
    const token = localStorage.getItem(CONFIG.APP.TOKEN_KEY);
    const expiry = localStorage.getItem(CONFIG.APP.EXPIRY_KEY);
    
    if (!token) return false;
    
    if (expiry) {
        const expiryDate = new Date(expiry);
        if (expiryDate <= new Date()) {
            // Token expired, clear storage
            clearAuthData();
            return false;
        }
    }
    
    return true;
}

function clearAuthData() {
    localStorage.removeItem(CONFIG.APP.TOKEN_KEY);
    localStorage.removeItem(CONFIG.APP.USERNAME_KEY);
    localStorage.removeItem(CONFIG.APP.EXPIRY_KEY);
}

function getAuthHeaders() {
    const token = localStorage.getItem(CONFIG.APP.TOKEN_KEY);
    return token ? { 'Authorization': `Bearer ${token}` } : {};
}

function redirectToLogin() {
    clearAuthData();
    window.location.href = 'login.html';
}

function getUserName() {
    return localStorage.getItem(CONFIG.APP.USERNAME_KEY) || '';
}

// Auto-redirect if not authenticated on protected pages
if (window.location.pathname.includes('app.html')) {
    if (!isAuthenticated()) {
        redirectToLogin();
    }
}
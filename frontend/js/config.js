// Configuration for the application
const CONFIG = {
    // API endpoint - will be updated when backend is ready
    API_HOST: 'http://n11310375-alb-1035475761.ap-southeast-2.elb.amazonaws.com',
    
    // AWS Cognito settings - TO BE CONFIGURED
    COGNITO: {
        REGION: '',  // Will be set when we configure Cognito
        USER_POOL_ID: '',
        CLIENT_ID: ''
    },
    
    // Application settings
    APP: {
        NAME: 'AI Image Processor',
        MAX_FILE_SIZE: 10 * 1024 * 1024, // 10MB
        ALLOWED_TYPES: ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'],
        TOKEN_KEY: 'authToken',
        USERNAME_KEY: 'userName',
        EXPIRY_KEY: 'expiryTime'
    }
};


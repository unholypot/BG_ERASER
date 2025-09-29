const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
// const cognitoService = require('../services/cognito');
const cognitoService = process.env.NODE_ENV === 'development' // testing
  ? require('../services/cognito')
  : require('../services/mockCognito');

const databaseService = require('../services/database');

// Register new user
router.post('/register', async (req, res) => {
  try {
    const { username, email, password, firstName, lastName } = req.body;
    
    // Validate input
    if (!username || !email || !password || !firstName || !lastName) {
      return res.status(400).json({
        error: true,
        message: 'All fields are required'
      });
    }

    // Sign up with Cognito
    const result = await cognitoService.signUp(username, password, email, firstName, lastName);
    
    // Log registration
    await databaseService.saveLog(result.userSub, 'User registered');
    
    res.json({
      error: false,
      message: 'Registration successful. Please check your email for confirmation code.'
    });
  } catch (error) {
    res.status(400).json({
      error: true,
      message: error.message
    });
  }
});

// Confirm email
router.post('/confirm', async (req, res) => {
  try {
    const { username, confirmationCode } = req.body;
    
    await cognitoService.confirmSignUp(username, confirmationCode);
    
    res.json({
      error: false,
      message: 'Email confirmed successfully'
    });
  } catch (error) {
    res.status(400).json({
      error: true,
      message: error.message
    });
  }
});

// Login
router.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body;

     // Local dev admin bypass
    if (process.env.NODE_ENV === 'development') {
      // Check for admin credentials or your email with the admin password
      if ((username === 'admin' && password === 'admin12345678') || 
          (username.includes('@') && password === 'admin12345678')) {
        const token = jwt.sign(
          { 
            userId: 'local_admin',
            username: username === 'admin' ? 'admin' : username,
            email: username === 'admin' ? 'admin@local.dev' : username
          },
          process.env.JWT_SECRET,
          { expiresIn: process.env.JWT_EXPIRY }
        );
        
        // Log successful login
        await databaseService.saveLog('local_admin', `Dev login: ${username}`);
        
        return res.json({
          error: false,
          token: token,
          expiresIn: 604800 // 7 days in seconds
        });
      }
    }
    
    // Authenticate with Cognito
    const authResult = await cognitoService.signIn(username, password);
    
    // Parse the ID token to get user info
    const idTokenPayload = JSON.parse(
      Buffer.from(authResult.idToken.split('.')[1], 'base64').toString()
    );
    
    // Create JWT token for our app
    const token = jwt.sign(
      { 
        userId: idTokenPayload.sub,
        username: username,
        email: idTokenPayload.email
      },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRY }
    );
    
    // Log successful login
    await databaseService.saveLog(idTokenPayload.sub, 'User logged in');
    
    res.json({
      error: false,
      token: token,
      expiresIn: 604800 // 7 days in seconds
    });
  } catch (error) {
    res.status(401).json({
      error: true,
      message: 'Invalid credentials'
    });
  }
});

// Resend confirmation code
router.post('/resend-confirmation-code', async (req, res) => {
  try {
    const { username } = req.body;
    
    await cognitoService.resendConfirmationCode(username);
    
    res.json({
      error: false,
      message: 'Confirmation code resent successfully'
    });
  } catch (error) {
    res.status(400).json({
      error: true,
      message: error.message
    });
  }
});

module.exports = router;
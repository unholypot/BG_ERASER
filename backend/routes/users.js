const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const cognitoService = require('../services/cognito');
const databaseService = require('../services/database');

// Remove the conditional import - always use real Cognito
// const cognitoService = process.env.NODE_ENV === 'development' 
//   ? require('../services/cognito')
//   : require('../services/mockCognito');


router.post('/register', async (req, res) => {
  try {
    const { username, email, password, firstName, lastName } = req.body;
    
    if (!username || !email || !password || !firstName || !lastName) {
      return res.status(400).json({
        error: true,
        message: 'All fields are required'
      });
    }

    const result = await cognitoService.signUp(username, password, email, firstName, lastName);
    
    await databaseService.saveLog(result.userSub, 'User registered');
    
    res.json({
      error: false,
      message: 'Registration successful. Please check your email for confirmation code.',
      needsConfirmation: true
    });
  } catch (error) {
    console.error('Registration error:', error);
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
    
    const authResult = await cognitoService.signIn(username, password);
    
    // Parse the ID token to get user info
    const idTokenPayload = JSON.parse(
      Buffer.from(authResult.idToken.split('.')[1], 'base64').toString()
    );
    
    const token = jwt.sign(
      { 
        userId: idTokenPayload.sub,
        username: username,
        email: idTokenPayload.email
      },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRY }
    );
    
    await databaseService.saveLog(idTokenPayload.sub, 'User logged in');
    
    res.json({
      error: false,
      token: token,
      expiresIn: 604800
    });
  } catch (error) {
    console.error('Login error:', error);
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
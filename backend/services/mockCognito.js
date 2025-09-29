// Mock Cognito for local development
const users = new Map();

class MockCognitoService {
  async signUp(username, password, email, firstName, lastName) {
    if (users.has(username)) {
      throw new Error('User already exists');
    }
    const userSub = 'mock_' + Date.now();
    users.set(username, {
      password,
      email,
      firstName,
      lastName,
      userSub,
      confirmed: false
    });
    return { success: true, userSub };
  }

  async confirmSignUp(username, confirmationCode) {
    if (confirmationCode === '123456') {
      const user = users.get(username);
      if (user) {
        user.confirmed = true;
        return { success: true };
      }
    }
    throw new Error('Invalid confirmation code');
  }

  async signIn(username, password) {
    const user = users.get(username);
    if (user && user.password === password && user.confirmed) {
      return {
        success: true,
        idToken: 'mock_id_token_' + Date.now(),
        accessToken: 'mock_access_token',
        refreshToken: 'mock_refresh_token'
      };
    }
    throw new Error('Invalid credentials');
  }

  async resendConfirmationCode(username) {
    return { success: true };
  }
}

module.exports = new MockCognitoService();
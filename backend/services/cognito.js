// const { cognitoClient } = require('../config/aws');
// const {
//   SignUpCommand,
//   ConfirmSignUpCommand,
//   InitiateAuthCommand,
//   ResendConfirmationCodeCommand
// } = require('@aws-sdk/client-cognito-identity-provider');
// const crypto = require('crypto');

// class CognitoService {
//   async signUp(username, password, email, firstName, lastName) {
    
//     // Local dev bypass
//     if (process.env.NODE_ENV === 'development') {
//       return { success: true, userSub: 'local_' + username };
//     }
//     const params = {
//       ClientId: process.env.COGNITO_CLIENT_ID,
//       Username: username,
//       Password: password,
//       UserAttributes: [
//         { Name: 'email', Value: email },
//         { Name: 'given_name', Value: firstName },
//         { Name: 'family_name', Value: lastName }
//       ]
//     };

//     try {
//       const command = new SignUpCommand(params);
//       const result = await cognitoClient.send(command);
//       return { success: true, userSub: result.UserSub };
//     } catch (error) {
//       throw new Error(error.message || 'Sign up failed');
//     }
//   }

//   async confirmSignUp(username, confirmationCode) {

//     // Local dev bypass
//     if (process.env.NODE_ENV === 'development') {
//       return { success: true };
//     }
//     const params = {
//       ClientId: process.env.COGNITO_CLIENT_ID,
//       Username: username,
//       ConfirmationCode: confirmationCode
//     };

//     try {
//       const command = new ConfirmSignUpCommand(params);
//       await cognitoClient.send(command);
//       return { success: true };
//     } catch (error) {
//       throw new Error(error.message || 'Confirmation failed');
//     }
//   }

//   async signIn(username, password) {

//     // Local dev hardcoded admin user
//     if (process.env.NODE_ENV === 'development') {
//       if (username === 'admin' && password === 'admin12345678') {
//         return {
//           success: true,
//           idToken: 'local_admin_id_token',
//           accessToken: 'local_admin_access_token',
//           refreshToken: 'local_admin_refresh_token'
//         };
//       }
//       throw new Error('Invalid credentials');
//     }

//     const params = {
//       AuthFlow: 'USER_PASSWORD_AUTH',
//       ClientId: process.env.COGNITO_CLIENT_ID,
//       AuthParameters: {
//         USERNAME: username,
//         PASSWORD: password
//       }
//     };

//     try {
//       const command = new InitiateAuthCommand(params);
//       const result = await cognitoClient.send(command);
//       return {
//         success: true,
//         idToken: result.AuthenticationResult.IdToken,
//         accessToken: result.AuthenticationResult.AccessToken,
//         refreshToken: result.AuthenticationResult.RefreshToken
//       };
//     } catch (error) {
//       throw new Error(error.message || 'Sign in failed');
//     }
//   }

//   async resendConfirmationCode(username) {

//     // Local dev bypass
//     if (process.env.NODE_ENV === 'development') {
//       return { success: true };
//     }
    
//     const params = {
//       ClientId: process.env.COGNITO_CLIENT_ID,
//       Username: username
//     };

//     try {
//       const command = new ResendConfirmationCodeCommand(params);
//       await cognitoClient.send(command);
//       return { success: true };
//     } catch (error) {
//       throw new Error(error.message || 'Failed to resend code');
//     }
//   }
// }

// module.exports = new CognitoService();

const { cognitoClient } = require('../config/aws');
const {
  SignUpCommand,
  ConfirmSignUpCommand,
  InitiateAuthCommand,
  ResendConfirmationCodeCommand
} = require('@aws-sdk/client-cognito-identity-provider');
const crypto = require('crypto');

class CognitoService {
  // Add secret hash generation
  generateSecretHash(username) {
    const hasher = crypto.createHmac('sha256', process.env.COGNITO_CLIENT_SECRET);
    hasher.update(`${username}${process.env.COGNITO_CLIENT_ID}`);
    return hasher.digest('base64');
  }

  async signUp(username, password, email, firstName, lastName) {
    const params = {
      ClientId: process.env.COGNITO_CLIENT_ID,
      SecretHash: this.generateSecretHash(username),
      Username: username,
      Password: password,
      UserAttributes: [
        { Name: 'email', Value: email },
        { Name: 'given_name', Value: firstName },
        { Name: 'family_name', Value: lastName }
      ]
    };

    try {
      const command = new SignUpCommand(params);
      const result = await cognitoClient.send(command);
      return { success: true, userSub: result.UserSub };
    } catch (error) {
      throw new Error(error.message || 'Sign up failed');
    }
  }

  async confirmSignUp(username, confirmationCode) {
    const params = {
      ClientId: process.env.COGNITO_CLIENT_ID,
      SecretHash: this.generateSecretHash(username),
      Username: username,
      ConfirmationCode: confirmationCode
    };

    try {
      const command = new ConfirmSignUpCommand(params);
      await cognitoClient.send(command);
      return { success: true };
    } catch (error) {
      throw new Error(error.message || 'Confirmation failed');
    }
  }

  async signIn(username, password) {
    const params = {
      AuthFlow: 'USER_PASSWORD_AUTH',
      ClientId: process.env.COGNITO_CLIENT_ID,
      AuthParameters: {
        USERNAME: username,
        PASSWORD: password,
        SECRET_HASH: this.generateSecretHash(username)
      }
    };

    try {
      const command = new InitiateAuthCommand(params);
      const result = await cognitoClient.send(command);
      return {
        success: true,
        idToken: result.AuthenticationResult.IdToken,
        accessToken: result.AuthenticationResult.AccessToken,
        refreshToken: result.AuthenticationResult.RefreshToken
      };
    } catch (error) {
      throw new Error(error.message || 'Sign in failed');
    }
  }

  async resendConfirmationCode(username) {
    const params = {
      ClientId: process.env.COGNITO_CLIENT_ID,
      SecretHash: this.generateSecretHash(username),
      Username: username
    };

    try {
      const command = new ResendConfirmationCodeCommand(params);
      await cognitoClient.send(command);
      return { success: true };
    } catch (error) {
      throw new Error(error.message || 'Failed to resend code');
    }
  }
}

module.exports = new CognitoService();
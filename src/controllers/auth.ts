import { Request, Response } from 'express';
import { OAuth2Client } from 'google-auth-library';

import { AuthError, DatabaseError, ValidationError } from '../db/errors.js';
import { AuthService } from '../services/auth.js';
import { GoogleUserProfile } from '../types/user.js';

export class AuthController {
  private authService: AuthService;
  private googleOAuth2Client: OAuth2Client;

  constructor() {
    this.authService = new AuthService();

    this.googleOAuth2Client = new OAuth2Client(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET,
      `${process.env.BACKEND_URL || 'http://localhost:3000'}/api/auth/google/callback`
    );

    this.validateGoogleOAuthConfig();
  }

  /**
   * Validates that required Google OAuth environment variables are present
   */
  private validateGoogleOAuthConfig(): void {
    const requiredEnvVars = ['GOOGLE_CLIENT_ID', 'GOOGLE_CLIENT_SECRET'];
    const missingVars = requiredEnvVars.filter((varName) => !process.env[varName]);

    if (missingVars.length > 0) {
      console.warn(`⚠️  Missing Google OAuth environment variables: ${missingVars.join(', ')}`);
      console.warn('Google OAuth authentication will not work properly without these variables.');
    } else {
      console.log('✅ Google OAuth configuration validated successfully');
    }
  }

  /**
   * Gets the frontend redirect URL for OAuth success/error scenarios
   */
  private getFrontendUrl(): string {
    return process.env.FRONTEND_URL || 'http://localhost:5173';
  }

  /**
   * Checks if Google OAuth is properly configured and available
   */
  private isGoogleOAuthAvailable(): boolean {
    return !!(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET);
  }

  async register(req: Request, res: Response): Promise<void> {
    console.log(`POST /api/auth/register - Request body:`, {
      email: req.body.email,
      name: req.body.name
    });
    try {
      const { email, password, name } = req.body;
      const user = await this.authService.registerUser({ email, password, name });
      console.log(`POST /api/auth/register - User registered successfully:`, user.id);
      res
        .status(201)
        .json({ message: 'User registered successfully', userId: user.id, email: user.email });
    } catch (error: any) {
      console.error(`POST /api/auth/register - Error:`, error.message);
      if (error instanceof ValidationError) {
        res.status(400).json({ error: error.message });
      } else if (error instanceof DatabaseError) {
        res.status(500).json({ error: 'Registration failed due to a database issue.' });
      } else {
        res.status(500).json({ error: 'An unexpected error occurred during registration.' });
      }
    }
  }

  async login(req: Request, res: Response): Promise<void> {
    console.log(`POST /api/auth/login - Request for email:`, req.body.email);
    try {
      const { email, password } = req.body;
      const { token, user } = await this.authService.loginUser(email, password);
      console.log(`POST /api/auth/login - User logged in:`, user.id);
      res.status(200).json({
        message: 'Login successful',
        token,
        user: { id: user.id, email: user.email, name: user.name }
      });
    } catch (error: any) {
      console.error(`POST /api/auth/login - Error:`, error.message);
      if (error instanceof ValidationError) {
        res.status(400).json({ error: error.message });
      } else if (error instanceof AuthError) {
        res.status(401).json({ error: error.message });
      } else {
        res.status(500).json({ error: 'An unexpected error occurred during login.' });
      }
    }
  }

  async logout(req: Request, res: Response): Promise<void> {
    console.log(`POST /api/auth/logout - Request received`);
    res
      .status(200)
      .json({ message: 'Logout successful. Please clear your token on the client-side.' });
  }

  async getMe(req: Request, res: Response): Promise<void> {
    if (!req.user) {
      res.status(401).json({ error: 'Not authenticated' });
      return;
    }
    console.log(`GET /api/auth/me - User:`, req.user.id);
    const { id, email, name, role } = req.user as any;
    res.status(200).json({ id, email, name, role });
  }

  async initiateGoogleOAuth(req: Request, res: Response): Promise<void> {
    console.log('GET /api/auth/google - Initiating Google OAuth flow');

    if (!this.isGoogleOAuthAvailable()) {
      console.error('GET /api/auth/google - Google OAuth not configured');
      res.status(503).json({
        error: 'Google OAuth is not available',
        message: 'Google OAuth authentication is not properly configured on this server'
      });
      return;
    }

    try {
      // Generate the OAuth URL with appropriate scopes
      const authUrl = this.googleOAuth2Client.generateAuthUrl({
        access_type: 'offline',
        scope: [
          'https://www.googleapis.com/auth/userinfo.profile',
          'https://www.googleapis.com/auth/userinfo.email'
        ],
        include_granted_scopes: true
      });

      console.log('GET /api/auth/google - Redirecting to Google OAuth URL');
      res.redirect(authUrl);
    } catch (error: any) {
      console.error('GET /api/auth/google - Error:', error.message);
      res.status(500).json({ error: 'Failed to initiate Google OAuth flow' });
    }
  }

  async handleGoogleCallback(req: Request, res: Response): Promise<void> {
    console.log('GET /api/auth/google/callback - Handling Google OAuth callback');

    try {
      const { code, error, state: _state } = req.query;

      if (error) {
        console.error('GET /api/auth/google/callback - Google OAuth error:', error);
        const frontendUrl = this.getFrontendUrl();
        res.redirect(
          `${frontendUrl}/auth/callback?error=oauth_error&message=${encodeURIComponent(error as string)}`
        );
        return;
      }

      if (!code) {
        console.error('GET /api/auth/google/callback - No authorization code received');
        const frontendUrl = this.getFrontendUrl();
        res.redirect(
          `${frontendUrl}/auth/callback?error=missing_code&message=No authorization code received`
        );
        return;
      }

      console.log('GET /api/auth/google/callback - Authorization code received, processing...');

      // Step 1: Exchange authorization code for tokens
      const { tokens } = await this.googleOAuth2Client.getToken(code as string);
      console.log('GET /api/auth/google/callback - Successfully exchanged code for tokens');

      if (!tokens.access_token || !tokens.id_token) {
        console.error('GET /api/auth/google/callback - Missing required tokens');
        const frontendUrl = this.getFrontendUrl();
        res.redirect(
          `${frontendUrl}/auth/callback?error=token_error&message=Failed to obtain required tokens`
        );
        return;
      }

      // Step 2: Set the credentials for the client
      this.googleOAuth2Client.setCredentials(tokens);
      console.log('GET /api/auth/google/callback - OAuth2 client credentials set successfully');

      // Step 3: Verify and decode the ID token
      const ticket = await this.googleOAuth2Client.verifyIdToken({
        idToken: tokens.id_token!,
        audience: process.env.GOOGLE_CLIENT_ID
      });

      const payload = ticket.getPayload();
      if (!payload) {
        console.error('GET /api/auth/google/callback - Failed to get payload from ID token');
        const frontendUrl = this.getFrontendUrl();
        res.redirect(
          `${frontendUrl}/auth/callback?error=token_validation_error&message=Failed to validate ID token`
        );
        return;
      }

      // Step 4: Extract user profile information
      const googleUserProfile: GoogleUserProfile = {
        googleId: payload.sub,
        email: payload.email!,
        name: payload.name || null,
        picture: payload.picture || null,
        emailVerified: payload.email_verified || false
      };

      console.log('GET /api/auth/google/callback - User profile extracted:', {
        googleId: googleUserProfile.googleId,
        email: googleUserProfile.email,
        name: googleUserProfile.name,
        emailVerified: googleUserProfile.emailVerified
      });

      // Step 5: Authenticate user via auth service
      const authResult = await this.authService.authenticateGoogleUser(googleUserProfile);
      console.log('GET /api/auth/google/callback - User authenticated:', {
        userId: authResult.user.id,
        email: authResult.user.email,
        isNewUser: authResult.isNewUser
      });

      // Step 6: Redirect to frontend with success and token
      const frontendUrl = this.getFrontendUrl();
      const redirectUrl = `${frontendUrl}/auth/callback?success=google_oauth&token=${encodeURIComponent(authResult.token)}&new_user=${authResult.isNewUser}`;

      console.log(
        'GET /api/auth/google/callback - Redirecting to frontend with authentication success'
      );
      res.redirect(redirectUrl);
    } catch (error: any) {
      console.error('GET /api/auth/google/callback - Error processing callback:', error.message);

      const frontendUrl = this.getFrontendUrl();
      if (
        error instanceof AuthError &&
        error.message.includes(
          'account with this email already exists with password authentication'
        )
      ) {
        // Specific error for existing password-based account
        res.redirect(
          `${frontendUrl}/auth/callback?error=account_exists&message=${encodeURIComponent(error.message)}`
        );
      } else {
        res.redirect(
          `${frontendUrl}/auth/callback?error=callback_error&message=${encodeURIComponent('OAuth callback processing failed')}`
        );
      }
    }
  }
}

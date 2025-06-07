import 'dotenv/config';

/**
 * Centralized secrets management service
 * All application secrets should be loaded through this service
 */

interface ApplicationSecrets {
  DATABASE_URL: string;
  DATABASE_ANON_KEY?: string;

  JWT_SECRET: string;
  JWT_EXPIRES_IN: string;

  GEMINI_API_KEY: string;

  NODE_ENV: string;
  PORT: string;
}

class SecretsManager {
  private secrets: ApplicationSecrets | null = null;
  private isInitialized = false;

  /**
   * Initialize the secrets manager and validate all required secrets
   */
  public async initialize(): Promise<void> {
    if (this.isInitialized) {
      return;
    }

    console.log('🔐 Initializing secrets manager...');

    try {
      this.secrets = await this.loadSecrets();
      this.validateSecrets(this.secrets);
      this.isInitialized = true;
      console.log('✅ Secrets manager initialized successfully');
    } catch (error) {
      console.error('❌ Failed to initialize secrets manager:', error);
      throw new Error(
        `Secrets initialization failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Load secrets from environment variables
   */
  private async loadSecrets(): Promise<ApplicationSecrets> {
    return {
      DATABASE_URL: this.getRequiredSecret('DATABASE_URL'),
      DATABASE_ANON_KEY: this.getOptionalSecret('DATABASE_ANON_KEY'),

      JWT_SECRET: this.getRequiredSecret('JWT_SECRET'),
      JWT_EXPIRES_IN: this.getOptionalSecret('JWT_EXPIRES_IN') || '1h',

      GEMINI_API_KEY: this.getRequiredSecret('GEMINI_API_KEY'),

      NODE_ENV: this.getOptionalSecret('NODE_ENV') || 'development',
      PORT: this.getOptionalSecret('PORT') || '3000'
    };
  }

  /**
   * Validate that all required secrets are present and properly formatted
   */
  private validateSecrets(secrets: ApplicationSecrets): void {
    const validationErrors: string[] = [];

    if (
      !secrets.DATABASE_URL.startsWith('postgres://') &&
      !secrets.DATABASE_URL.startsWith('postgresql://')
    ) {
      validationErrors.push('DATABASE_URL must be a valid PostgreSQL connection string');
    }

    if (secrets.JWT_SECRET.length < 32) {
      validationErrors.push('JWT_SECRET must be at least 32 characters long');
    }

    if (!secrets.GEMINI_API_KEY || secrets.GEMINI_API_KEY.length < 20) {
      validationErrors.push('GEMINI_API_KEY must be a valid API key');
    }

    const port = parseInt(secrets.PORT, 10);
    if (isNaN(port) || port < 1 || port > 65535) {
      validationErrors.push('PORT must be a valid port number (1-65535)');
    }

    if (!['development', 'production', 'test'].includes(secrets.NODE_ENV)) {
      validationErrors.push('NODE_ENV must be one of: development, production, test');
    }

    if (validationErrors.length > 0) {
      throw new Error(`Secret validation failed:\n${validationErrors.join('\n')}`);
    }
  }

  /**
   * Get a required secret from environment variables
   */
  private getRequiredSecret(key: string): string {
    const value = process.env[key];
    if (!value) {
      throw new Error(`Required environment variable ${key} is not defined`);
    }
    return value;
  }

  /**
   * Get an optional secret from environment variables
   */
  private getOptionalSecret(key: string): string | undefined {
    return process.env[key];
  }

  /**
   * Get all loaded secrets (only after initialization)
   */
  public getSecrets(): ApplicationSecrets {
    if (!this.isInitialized || !this.secrets) {
      throw new Error('Secrets manager not initialized. Call initialize() first.');
    }
    return this.secrets;
  }

  /**
   * Get a specific secret by key
   */
  public getSecret<K extends keyof ApplicationSecrets>(key: K): ApplicationSecrets[K] {
    if (!this.isInitialized || !this.secrets) {
      throw new Error('Secrets manager not initialized. Call initialize() first.');
    }
    return this.secrets[key];
  }

  /**
   * Check if a secret exists
   */
  public hasSecret(key: keyof ApplicationSecrets): boolean {
    if (!this.isInitialized || !this.secrets) {
      return false;
    }
    return this.secrets[key] !== undefined;
  }

  /**
   * Reload secrets (useful for testing or development)
   */
  public async reload(): Promise<void> {
    this.isInitialized = false;
    this.secrets = null;
    await this.initialize();
  }

  /**
   * Check if secrets manager is properly initialized
   */
  public get initialized(): boolean {
    return this.isInitialized;
  }

  /**
   * Get redacted secrets for logging (hides sensitive values)
   */
  public getRedactedSecrets(): Record<string, string> {
    if (!this.isInitialized || !this.secrets) {
      throw new Error('Secrets manager not initialized. Call initialize() first.');
    }

    const redacted: Record<string, string> = {};

    Object.entries(this.secrets).forEach(([key, value]) => {
      if (typeof value === 'string') {
        if (this.isSensitiveKey(key)) {
          redacted[key] = this.redactValue(value);
        } else {
          redacted[key] = value;
        }
      }
    });

    return redacted;
  }

  /**
   * Check if a key contains sensitive information
   */
  private isSensitiveKey(key: string): boolean {
    const sensitivePatterns = ['SECRET', 'KEY', 'PASSWORD', 'TOKEN', 'URL'];
    return sensitivePatterns.some((pattern) => key.includes(pattern));
  }

  /**
   * Redact a sensitive value for logging
   */
  private redactValue(value: string): string {
    if (value.length <= 8) {
      return '***';
    }
    const visibleChars = Math.min(4, Math.floor(value.length * 0.1));
    const prefix = value.substring(0, visibleChars);
    const suffix = value.substring(value.length - visibleChars);
    return `${prefix}***${suffix}`;
  }
}

export const secretsManager = new SecretsManager();

export const getSecret = <K extends keyof ApplicationSecrets>(key: K) =>
  secretsManager.getSecret(key);

/**
 * Initialize secrets at application startup
 * This should be called before any other service initialization
 */
export const initializeSecrets = async (): Promise<void> => {
  return secretsManager.initialize();
};

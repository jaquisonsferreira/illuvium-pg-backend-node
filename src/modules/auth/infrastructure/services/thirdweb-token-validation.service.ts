import { Injectable, Logger } from '@nestjs/common';
import { createThirdwebClient } from 'thirdweb';
import { createAuth } from 'thirdweb/auth';
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';
import {
  ThirdwebTokenClaimsData,
  ThirdwebTokenClaims,
} from '../../domain/value-objects/thirdweb-token-claims.value-object';

const getThirdwebConfig = () => {
  const secretsPath = '/mnt/secrets';
  const clientIdPath = join(secretsPath, 'thirdweb-client-id');
  const secretKeyPath = join(secretsPath, 'thirdweb-secret-key');
  const domainPath = join(secretsPath, 'thirdweb-auth-domain');

  if (existsSync(clientIdPath) && existsSync(secretKeyPath)) {
    return {
      clientId: readFileSync(clientIdPath, 'utf8').trim(),
      secretKey: readFileSync(secretKeyPath, 'utf8').trim(),
      domain: existsSync(domainPath)
        ? readFileSync(domainPath, 'utf8').trim()
        : 'localhost:3000',
    };
  }

  // Fallback use environment variables
  return {
    clientId: process.env.THIRDWEB_CLIENT_ID || '',
    secretKey: process.env.THIRDWEB_SECRET_KEY || '',
    domain: process.env.THIRDWEB_AUTH_DOMAIN || 'localhost:3000',
  };
};

export interface ThirdwebTokenValidationResult {
  isValid: boolean;
  claims?: ThirdwebTokenClaimsData;
  error?: string;
}

@Injectable()
export class ThirdwebTokenValidationService {
  private readonly logger = new Logger(ThirdwebTokenValidationService.name);
  private thirdwebClient: any;
  private auth: any;
  private secretKey: string;
  private clientId: string;
  private domain: string;

  constructor() {
    const config = getThirdwebConfig();
    this.secretKey = config.secretKey;
    this.clientId = config.clientId;
    this.domain = config.domain;

    this.logger.log('Initializing Thirdweb client', {
      hasClientId: !!this.clientId,
      hasSecretKey: !!this.secretKey,
      domain: this.domain,
    });

    if (this.secretKey && this.clientId) {
      this.thirdwebClient = createThirdwebClient({
        secretKey: this.secretKey,
        clientId: this.clientId,
      });

      this.auth = createAuth({
        domain: this.domain,
        client: this.thirdwebClient,
      });
    }
  }

  async validateToken(token: string): Promise<ThirdwebTokenValidationResult> {
    try {
      if (!this.secretKey) {
        return {
          isValid: false,
          error: 'Thirdweb secret key not configured',
        };
      }

      if (!this.clientId) {
        return {
          isValid: false,
          error: 'Thirdweb client ID not configured',
        };
      }

      if (!this.auth) {
        return {
          isValid: false,
          error: 'Thirdweb auth not initialized',
        };
      }

      const verificationResult = await this.auth.verifyJWT({ jwt: token });

      if (!verificationResult.valid || !verificationResult.parsedJWT) {
        return {
          isValid: false,
          error: 'Invalid JWT token',
        };
      }

      try {
        const tokenClaims = new ThirdwebTokenClaims(
          verificationResult.parsedJWT,
        );

        return {
          isValid: true,
          claims: tokenClaims.toJSON(),
        };
      } catch (claimsError) {
        return {
          isValid: false,
          error:
            claimsError instanceof Error
              ? claimsError.message
              : 'Invalid token claims',
        };
      }
    } catch (error) {
      return {
        isValid: false,
        error:
          error instanceof Error ? error.message : 'Token validation failed',
      };
    }
  }

  async validateTokenWithOptions(
    token: string,
    options?: {
      audience?: string;
      issuer?: string;
    },
  ): Promise<ThirdwebTokenValidationResult> {
    const result = await this.validateToken(token);

    if (!result.isValid || !result.claims) {
      return result;
    }

    if (options?.audience && result.claims.aud !== options.audience) {
      return {
        isValid: false,
        error: 'Token audience mismatch',
      };
    }

    if (options?.issuer && !result.claims.iss.includes(options.issuer)) {
      return {
        isValid: false,
        error: 'Token issuer mismatch',
      };
    }

    return result;
  }
}

import { Injectable } from '@nestjs/common';
import { createThirdwebClient } from 'thirdweb';
import { createAuth } from 'thirdweb/auth';
import {
  ThirdwebTokenClaimsData,
  ThirdwebTokenClaims,
} from '../../domain/value-objects/thirdweb-token-claims.value-object';

export interface ThirdwebTokenValidationResult {
  isValid: boolean;
  claims?: ThirdwebTokenClaimsData;
  error?: string;
}

@Injectable()
export class ThirdwebTokenValidationService {
  private thirdwebClient: any;
  private auth: any;
  private secretKey: string;
  private clientId: string;
  private domain: string;

  constructor() {
    this.secretKey = process.env.THIRDWEB_SECRET_KEY || '';
    this.clientId = process.env.THIRDWEB_CLIENT_ID || '';
    this.domain = process.env.THIRDWEB_AUTH_DOMAIN || 'localhost:3000';

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

import { Injectable } from '@nestjs/common';
import { PrivyClient } from '@privy-io/server-auth';
import { PrivyTokenClaimsData } from '../../domain/value-objects/privy-token-claims.value-object';

export interface PrivyTokenValidationResult {
  isValid: boolean;
  claims?: PrivyTokenClaimsData;
  error?: string;
}

@Injectable()
export class PrivyTokenValidationService {
  private privyClient: PrivyClient;

  constructor() {
    this.privyClient = new PrivyClient(
      process.env.PRIVY_APP_ID || '',
      process.env.PRIVY_APP_SECRET || '',
    );
  }

  async validateToken(token: string): Promise<PrivyTokenValidationResult> {
    try {
      if (!process.env.PRIVY_APP_ID) {
        return {
          isValid: false,
          error: 'Privy app ID not configured',
        };
      }

      const verifiedClaims = await this.privyClient.verifyAuthToken(token);

      return {
        isValid: true,
        claims: {
          appId: verifiedClaims.appId,
          userId: verifiedClaims.userId,
          issuer: verifiedClaims.issuer,
          issuedAt: new Date(
            Number(verifiedClaims.issuedAt) * 1000,
          ).toISOString(),
          expiration: new Date(
            Number(verifiedClaims.expiration) * 1000,
          ).toISOString(),
          sessionId: verifiedClaims.sessionId,
        },
      };
    } catch (error) {
      return {
        isValid: false,
        error:
          error instanceof Error ? error.message : 'Token validation failed',
      };
    }
  }

  async validateTokenWithVerificationKey(
    token: string,
    verificationKey?: string,
  ): Promise<PrivyTokenValidationResult> {
    try {
      if (!process.env.PRIVY_APP_ID) {
        return {
          isValid: false,
          error: 'Privy app ID not configured',
        };
      }

      // Use verification key if provided to avoid API calls
      const verifiedClaims = verificationKey
        ? await this.privyClient.verifyAuthToken(token, verificationKey)
        : await this.privyClient.verifyAuthToken(token);

      return {
        isValid: true,
        claims: {
          appId: verifiedClaims.appId,
          userId: verifiedClaims.userId,
          issuer: verifiedClaims.issuer,
          issuedAt: new Date(
            Number(verifiedClaims.issuedAt) * 1000,
          ).toISOString(),
          expiration: new Date(
            Number(verifiedClaims.expiration) * 1000,
          ).toISOString(),
          sessionId: verifiedClaims.sessionId,
        },
      };
    } catch (error) {
      return {
        isValid: false,
        error:
          error instanceof Error ? error.message : 'Token validation failed',
      };
    }
  }
}

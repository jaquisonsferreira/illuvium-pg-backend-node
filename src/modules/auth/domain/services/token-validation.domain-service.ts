import {
  PrivyTokenClaims,
  PrivyTokenClaimsData,
} from '../value-objects/privy-token-claims.value-object';

export interface TokenValidationResult {
  isValid: boolean;
  claims?: PrivyTokenClaims;
  error?: string;
}

export class TokenValidationDomainService {
  public validateTokenClaims(
    claimsData: PrivyTokenClaimsData,
    expectedAppId: string,
  ): TokenValidationResult {
    try {
      const claims = new PrivyTokenClaims(claimsData);

      if (claims.getAppId !== expectedAppId) {
        return {
          isValid: false,
          error: 'Invalid app ID in token claims',
        };
      }

      if (claims.isExpired()) {
        return {
          isValid: false,
          error: 'Token has expired',
        };
      }

      return {
        isValid: true,
        claims,
      };
    } catch (error) {
      return {
        isValid: false,
        error: error instanceof Error ? error.message : 'Invalid token claims',
      };
    }
  }
}

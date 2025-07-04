import {
  ThirdwebTokenClaims,
  ThirdwebTokenClaimsData,
} from '../value-objects/thirdweb-token-claims.value-object';

export interface TokenValidationResult {
  isValid: boolean;
  claims?: ThirdwebTokenClaims;
  error?: string;
}

export class TokenValidationDomainService {
  public validateTokenClaims(
    claimsData: ThirdwebTokenClaimsData,
    expectedClientId: string,
  ): TokenValidationResult {
    try {
      const claims = new ThirdwebTokenClaims(claimsData);

      if (claims.getAudience !== expectedClientId) {
        return {
          isValid: false,
          error: 'Invalid client ID in token claims',
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

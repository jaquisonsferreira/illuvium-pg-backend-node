import { TokenValidationDomainService } from './token-validation.domain-service';
import { ThirdwebTokenClaimsData } from '../value-objects/thirdweb-token-claims.value-object';

describe('TokenValidationDomainService', () => {
  let service: TokenValidationDomainService;
  const expectedAppId = 'test-app-id';

  beforeEach(() => {
    service = new TokenValidationDomainService();
  });

  const validClaimsData: ThirdwebTokenClaimsData = {
    iss: 'thirdweb.com',
    sub: 'test-user-id',
    aud: expectedAppId,
    iat: new Date(Date.now() - 60000).toISOString(),
    exp: new Date(Date.now() + 3600000).toISOString(),
    walletAddress: '0x1234567890123456789012345678901234567890',
    chainId: '1',
  };

  describe('validateTokenClaims', () => {
    it('should return valid result for correct claims', () => {
      const result = service.validateTokenClaims(
        validClaimsData,
        expectedAppId,
      );

      expect(result.isValid).toBe(true);
      expect(result.claims).toBeDefined();
      expect(result.error).toBeUndefined();
      expect(result.claims?.getAudience).toBe(expectedAppId);
      expect(result.claims?.getUserId).toBe(validClaimsData.sub);
    });

    it('should return invalid result for wrong client ID', () => {
      const wrongClientIdData = { ...validClaimsData, aud: 'wrong-client-id' };
      const result = service.validateTokenClaims(
        wrongClientIdData,
        expectedAppId,
      );

      expect(result.isValid).toBe(false);
      expect(result.claims).toBeUndefined();
      expect(result.error).toBe('Invalid client ID in token claims');
    });

    it('should return invalid result for expired token', () => {
      const expiredData = {
        ...validClaimsData,
        exp: new Date(Date.now() - 60000).toISOString(), // 1 minute ago
      };
      const result = service.validateTokenClaims(expiredData, expectedAppId);

      expect(result.isValid).toBe(false);
      expect(result.claims).toBeUndefined();
      expect(result.error).toBe('Token has expired');
    });

    it('should return invalid result for invalid claims data', () => {
      const invalidData = { ...validClaimsData, aud: '' };
      const result = service.validateTokenClaims(invalidData, expectedAppId);

      expect(result.isValid).toBe(false);
      expect(result.claims).toBeUndefined();
      expect(result.error).toBe('Invalid audience in token claims');
    });

    it('should return invalid result for invalid issuer', () => {
      const invalidIssuerData = {
        ...validClaimsData,
        iss: 'invalid-issuer',
      };
      const result = service.validateTokenClaims(
        invalidIssuerData,
        expectedAppId,
      );

      expect(result.isValid).toBe(false);
      expect(result.claims).toBeUndefined();
      expect(result.error).toBe('Invalid issuer in token claims');
    });

    it('should return invalid result for token issued in future', () => {
      const futureData = {
        ...validClaimsData,
        iat: new Date(Date.now() + 60000).toISOString(), // 1 minute from now
      };
      const result = service.validateTokenClaims(futureData, expectedAppId);

      expect(result.isValid).toBe(false);
      expect(result.claims).toBeUndefined();
      expect(result.error).toBe('Token issued in the future');
    });

    it('should handle null/undefined claims data gracefully', () => {
      const result = service.validateTokenClaims(null as any, expectedAppId);

      expect(result.isValid).toBe(false);
      expect(result.claims).toBeUndefined();
      expect(result.error).toBe(
        "Cannot read properties of null (reading 'iss')",
      );
    });

    it('should handle claims construction errors', () => {
      const invalidData = {
        ...validClaimsData,
        sub: '',
      };
      const result = service.validateTokenClaims(invalidData, expectedAppId);

      expect(result.isValid).toBe(false);
      expect(result.claims).toBeUndefined();
      expect(result.error).toBe('Invalid user ID in token claims');
    });

    it('should handle unexpected errors gracefully', () => {
      // Create a mock that throws an Error object
      const mockClaimsData = {
        get aud() {
          throw new Error('Unexpected error');
        },
        iss: 'thirdweb.com',
        sub: 'test-user-id',
        iat: new Date(Date.now() - 60000).toISOString(),
        exp: new Date(Date.now() + 3600000).toISOString(),
        walletAddress: '0x1234567890123456789012345678901234567890',
        chainId: '1',
      } as unknown as ThirdwebTokenClaimsData;

      const result = service.validateTokenClaims(mockClaimsData, expectedAppId);

      expect(result.isValid).toBe(false);
      expect(result.claims).toBeUndefined();
      expect(result.error).toBe('Unexpected error');
    });

    it('should validate claims even if client ID matches but token is expired', () => {
      const expiredButCorrectClientId = {
        ...validClaimsData,
        exp: new Date(Date.now() - 60000).toISOString(), // 1 minute ago
      };
      const result = service.validateTokenClaims(
        expiredButCorrectClientId,
        expectedAppId,
      );

      expect(result.isValid).toBe(false);
      expect(result.error).toBe('Token has expired');
    });

    it('should validate in correct order - claims creation, then client ID, then expiration', () => {
      const invalidClaimsData = { ...validClaimsData, sub: '' };
      let result = service.validateTokenClaims(
        invalidClaimsData,
        'wrong-client-id',
      );
      expect(result.error).toBe('Invalid user ID in token claims');

      const wrongClientIdData = { ...validClaimsData, aud: 'wrong-client-id' };
      result = service.validateTokenClaims(wrongClientIdData, expectedAppId);
      expect(result.error).toBe('Invalid client ID in token claims');

      const expiredData = {
        ...validClaimsData,
        exp: new Date(Date.now() - 60000).toISOString(),
      };
      result = service.validateTokenClaims(expiredData, expectedAppId);
      expect(result.error).toBe('Token has expired');
    });
  });
});

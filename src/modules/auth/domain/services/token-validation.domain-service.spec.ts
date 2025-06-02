import { TokenValidationDomainService } from './token-validation.domain-service';
import { PrivyTokenClaimsData } from '../value-objects/privy-token-claims.value-object';

describe('TokenValidationDomainService', () => {
  let service: TokenValidationDomainService;
  const expectedAppId = 'test-app-id';

  beforeEach(() => {
    service = new TokenValidationDomainService();
  });

  const validClaimsData: PrivyTokenClaimsData = {
    appId: expectedAppId,
    userId: 'test-user-id',
    issuer: 'privy.io',
    issuedAt: new Date(Date.now() - 60000).toISOString(), // 1 minute ago
    expiration: new Date(Date.now() + 3600000).toISOString(), // 1 hour from now
    sessionId: 'test-session-id',
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
      expect(result.claims?.getAppId).toBe(expectedAppId);
      expect(result.claims?.getUserId).toBe(validClaimsData.userId);
    });

    it('should return invalid result for wrong app ID', () => {
      const wrongAppIdData = { ...validClaimsData, appId: 'wrong-app-id' };
      const result = service.validateTokenClaims(wrongAppIdData, expectedAppId);

      expect(result.isValid).toBe(false);
      expect(result.claims).toBeUndefined();
      expect(result.error).toBe('Invalid app ID in token claims');
    });

    it('should return invalid result for expired token', () => {
      const expiredData = {
        ...validClaimsData,
        expiration: new Date(Date.now() - 60000).toISOString(), // 1 minute ago
      };
      const result = service.validateTokenClaims(expiredData, expectedAppId);

      expect(result.isValid).toBe(false);
      expect(result.claims).toBeUndefined();
      expect(result.error).toBe('Token has expired');
    });

    it('should return invalid result for invalid claims data', () => {
      const invalidData = { ...validClaimsData, appId: '' };
      const result = service.validateTokenClaims(invalidData, expectedAppId);

      expect(result.isValid).toBe(false);
      expect(result.claims).toBeUndefined();
      expect(result.error).toBe('Invalid app ID in token claims');
    });

    it('should return invalid result for invalid issuer', () => {
      const invalidIssuerData = {
        ...validClaimsData,
        issuer: 'invalid-issuer',
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
        issuedAt: new Date(Date.now() + 60000).toISOString(), // 1 minute from now
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
        "Cannot read properties of null (reading 'appId')",
      );
    });

    it('should handle claims construction errors', () => {
      const invalidData = {
        ...validClaimsData,
        userId: '', // This will cause PrivyTokenClaims constructor to throw
      };
      const result = service.validateTokenClaims(invalidData, expectedAppId);

      expect(result.isValid).toBe(false);
      expect(result.claims).toBeUndefined();
      expect(result.error).toBe('Invalid user ID in token claims');
    });

    it('should handle unexpected errors gracefully', () => {
      // Create a mock that throws an Error object
      const mockClaimsData = {
        get appId() {
          throw new Error('Unexpected error');
        },
        userId: 'test-user-id',
        issuer: 'privy.io',
        issuedAt: new Date(Date.now() - 60000).toISOString(),
        expiration: new Date(Date.now() + 3600000).toISOString(),
        sessionId: 'test-session-id',
      } as unknown as PrivyTokenClaimsData;

      const result = service.validateTokenClaims(mockClaimsData, expectedAppId);

      expect(result.isValid).toBe(false);
      expect(result.claims).toBeUndefined();
      expect(result.error).toBe('Unexpected error');
    });

    it('should validate claims even if app ID matches but token is expired', () => {
      const expiredButCorrectAppId = {
        ...validClaimsData,
        expiration: new Date(Date.now() - 60000).toISOString(), // 1 minute ago
      };
      const result = service.validateTokenClaims(
        expiredButCorrectAppId,
        expectedAppId,
      );

      expect(result.isValid).toBe(false);
      expect(result.error).toBe('Token has expired');
    });

    it('should validate in correct order - claims creation, then app ID, then expiration', () => {
      const invalidClaimsData = { ...validClaimsData, userId: '' };
      let result = service.validateTokenClaims(
        invalidClaimsData,
        'wrong-app-id',
      );
      expect(result.error).toBe('Invalid user ID in token claims');

      const wrongAppIdData = { ...validClaimsData, appId: 'wrong-app-id' };
      result = service.validateTokenClaims(wrongAppIdData, expectedAppId);
      expect(result.error).toBe('Invalid app ID in token claims');

      const expiredData = {
        ...validClaimsData,
        expiration: new Date(Date.now() - 60000).toISOString(),
      };
      result = service.validateTokenClaims(expiredData, expectedAppId);
      expect(result.error).toBe('Token has expired');
    });
  });
});

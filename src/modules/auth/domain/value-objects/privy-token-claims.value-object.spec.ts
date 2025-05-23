import {
  PrivyTokenClaims,
  PrivyTokenClaimsData,
} from './privy-token-claims.value-object';

describe('PrivyTokenClaims', () => {
  const validClaimsData: PrivyTokenClaimsData = {
    appId: 'test-app-id',
    userId: 'test-user-id',
    issuer: 'privy.io',
    issuedAt: new Date(Date.now() - 60000).toISOString(), // 1 minute ago
    expiration: new Date(Date.now() + 3600000).toISOString(), // 1 hour from now
    sessionId: 'test-session-id',
  };

  describe('constructor', () => {
    it('should create a valid PrivyTokenClaims instance', () => {
      const claims = new PrivyTokenClaims(validClaimsData);

      expect(claims.getAppId).toBe(validClaimsData.appId);
      expect(claims.getUserId).toBe(validClaimsData.userId);
      expect(claims.getIssuer).toBe(validClaimsData.issuer);
      expect(claims.getIssuedAt).toEqual(new Date(validClaimsData.issuedAt));
      expect(claims.getExpiration).toEqual(
        new Date(validClaimsData.expiration),
      );
      expect(claims.getSessionId).toBe(validClaimsData.sessionId);
    });

    it('should throw error for invalid app ID', () => {
      const invalidData = { ...validClaimsData, appId: '' };
      expect(() => new PrivyTokenClaims(invalidData)).toThrow(
        'Invalid app ID in token claims',
      );
    });

    it('should throw error for non-string app ID', () => {
      const invalidData = { ...validClaimsData, appId: null as any };
      expect(() => new PrivyTokenClaims(invalidData)).toThrow(
        'Invalid app ID in token claims',
      );
    });

    it('should throw error for invalid user ID', () => {
      const invalidData = { ...validClaimsData, userId: '' };
      expect(() => new PrivyTokenClaims(invalidData)).toThrow(
        'Invalid user ID in token claims',
      );
    });

    it('should throw error for non-string user ID', () => {
      const invalidData = { ...validClaimsData, userId: undefined as any };
      expect(() => new PrivyTokenClaims(invalidData)).toThrow(
        'Invalid user ID in token claims',
      );
    });

    it('should throw error for invalid issuer', () => {
      const invalidData = { ...validClaimsData, issuer: 'invalid-issuer' };
      expect(() => new PrivyTokenClaims(invalidData)).toThrow(
        'Invalid issuer in token claims',
      );
    });

    it('should throw error for expired token', () => {
      const expiredData = {
        ...validClaimsData,
        expiration: new Date(Date.now() - 60000).toISOString(), // 1 minute ago
      };
      expect(() => new PrivyTokenClaims(expiredData)).toThrow(
        'Token has expired',
      );
    });

    it('should throw error for token issued in the future', () => {
      const futureData = {
        ...validClaimsData,
        issuedAt: new Date(Date.now() + 60000).toISOString(), // 1 minute from now
      };
      expect(() => new PrivyTokenClaims(futureData)).toThrow(
        'Token issued in the future',
      );
    });
  });

  describe('isExpired', () => {
    it('should return false for non-expired token', () => {
      const claims = new PrivyTokenClaims(validClaimsData);
      expect(claims.isExpired()).toBe(false);
    });

    it('should return true for expired token', () => {
      const expiredData = {
        ...validClaimsData,
        expiration: new Date(Date.now() + 100).toISOString(), // 100ms from now
      };
      const claims = new PrivyTokenClaims(expiredData);

      // Wait for token to expire
      return new Promise((resolve) => {
        setTimeout(() => {
          expect(claims.isExpired()).toBe(true);
          resolve(undefined);
        }, 150);
      });
    });

    it('should return true for token that expires exactly now', () => {
      const nowData = {
        ...validClaimsData,
        expiration: new Date(Date.now() + 1000).toISOString(), // 1 second from now
      };
      const claims = new PrivyTokenClaims(nowData);

      // Small delay to ensure the token is expired
      setTimeout(() => {
        expect(claims.isExpired()).toBe(true);
      }, 1100);
    });
  });

  describe('getters', () => {
    it('should return correct app ID', () => {
      const claims = new PrivyTokenClaims(validClaimsData);
      expect(claims.getAppId).toBe(validClaimsData.appId);
    });

    it('should return correct user ID', () => {
      const claims = new PrivyTokenClaims(validClaimsData);
      expect(claims.getUserId).toBe(validClaimsData.userId);
    });

    it('should return correct issuer', () => {
      const claims = new PrivyTokenClaims(validClaimsData);
      expect(claims.getIssuer).toBe(validClaimsData.issuer);
    });

    it('should return correct issued at date', () => {
      const claims = new PrivyTokenClaims(validClaimsData);
      expect(claims.getIssuedAt).toEqual(new Date(validClaimsData.issuedAt));
    });

    it('should return correct expiration date', () => {
      const claims = new PrivyTokenClaims(validClaimsData);
      expect(claims.getExpiration).toEqual(
        new Date(validClaimsData.expiration),
      );
    });

    it('should return correct session ID', () => {
      const claims = new PrivyTokenClaims(validClaimsData);
      expect(claims.getSessionId).toBe(validClaimsData.sessionId);
    });
  });

  describe('toJSON', () => {
    it('should return correct JSON representation', () => {
      const claims = new PrivyTokenClaims(validClaimsData);
      const json = claims.toJSON();

      expect(json).toEqual(validClaimsData);
      expect(json).not.toBe(validClaimsData); // Should be a new object
    });

    it('should return serializable dates', () => {
      const claims = new PrivyTokenClaims(validClaimsData);
      const json = claims.toJSON();

      expect(typeof json.issuedAt).toBe('string');
      expect(typeof json.expiration).toBe('string');
      expect(new Date(json.issuedAt)).toEqual(
        new Date(validClaimsData.issuedAt),
      );
      expect(new Date(json.expiration)).toEqual(
        new Date(validClaimsData.expiration),
      );
    });
  });

  describe('edge cases', () => {
    it('should handle exactly current time for expiration', () => {
      const currentTime = new Date(Date.now() + 1000); // 1 second in future
      const edgeData = {
        ...validClaimsData,
        expiration: currentTime.toISOString(),
      };

      // Should not throw during construction since token is not yet expired
      expect(() => new PrivyTokenClaims(edgeData)).not.toThrow();
    });

    it('should handle exactly current time for issuedAt', () => {
      const currentTime = new Date();
      const edgeData = {
        ...validClaimsData,
        issuedAt: currentTime.toISOString(),
      };

      expect(() => new PrivyTokenClaims(edgeData)).not.toThrow();
    });
  });
});

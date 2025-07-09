import {
  ThirdwebTokenClaims,
  ThirdwebTokenClaimsData,
} from './thirdweb-token-claims.value-object';

describe('ThirdwebTokenClaims', () => {
  const now = new Date();
  const oneHourFromNow = new Date(now.getTime() + 60 * 60 * 1000);
  const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);
  const twoHoursFromNow = new Date(now.getTime() + 2 * 60 * 60 * 1000);

  const validClaimsData: ThirdwebTokenClaimsData = {
    iss: 'https://thirdweb.com',
    sub: 'user-123',
    aud: 'thirdweb-app',
    iat: oneHourAgo.toISOString(),
    exp: oneHourFromNow.toISOString(),
    walletAddress: '0x1234567890123456789012345678901234567890',
    chainId: '1',
  };

  const expiredClaimsData: ThirdwebTokenClaimsData = {
    ...validClaimsData,
    iat: new Date(now.getTime() - 2 * 60 * 60 * 1000).toISOString(),
    exp: oneHourAgo.toISOString(),
  };

  const futureIssuedClaimsData: ThirdwebTokenClaimsData = {
    ...validClaimsData,
    iat: twoHoursFromNow.toISOString(),
    exp: new Date(twoHoursFromNow.getTime() + 60 * 60 * 1000).toISOString(),
  };

  describe('constructor', () => {
    it('should create a valid ThirdwebTokenClaims instance', () => {
      const claims = new ThirdwebTokenClaims(validClaimsData);

      expect(claims.getIssuer).toBe('https://thirdweb.com');
      expect(claims.getUserId).toBe('user-123');
      expect(claims.getAudience).toBe('thirdweb-app');
      expect(claims.getWalletAddress).toBe(
        '0x1234567890123456789012345678901234567890',
      );
      expect(claims.getChainId).toBe('1');
    });

    it('should throw error for invalid issuer', () => {
      const invalidData = { ...validClaimsData, iss: 'invalid-issuer' };

      expect(() => new ThirdwebTokenClaims(invalidData)).toThrow(
        'Invalid issuer in token claims',
      );
    });

    it('should throw error for missing user ID', () => {
      const invalidData = { ...validClaimsData, sub: '' };

      expect(() => new ThirdwebTokenClaims(invalidData)).toThrow(
        'Invalid user ID in token claims',
      );
    });

    it('should throw error for invalid wallet address', () => {
      const invalidData = {
        ...validClaimsData,
        walletAddress: 'invalid-address',
      };

      expect(() => new ThirdwebTokenClaims(invalidData)).toThrow(
        'Invalid wallet address in token claims',
      );
    });

    it('should throw error for expired token', () => {
      expect(() => new ThirdwebTokenClaims(expiredClaimsData)).toThrow(
        'Token has expired',
      );
    });

    it('should throw error for token issued in the future', () => {
      expect(() => new ThirdwebTokenClaims(futureIssuedClaimsData)).toThrow(
        'Token issued in the future',
      );
    });

    it('should throw error for invalid chain ID', () => {
      const invalidData = { ...validClaimsData, chainId: '' };

      expect(() => new ThirdwebTokenClaims(invalidData)).toThrow(
        'Invalid chain ID in token claims',
      );
    });
  });

  describe('getters', () => {
    it('should return correct values', () => {
      const claims = new ThirdwebTokenClaims(validClaimsData);

      expect(claims.getIssuer).toBe('https://thirdweb.com');
      expect(claims.getUserId).toBe('user-123');
      expect(claims.getAudience).toBe('thirdweb-app');
      expect(claims.getWalletAddress).toBe(
        '0x1234567890123456789012345678901234567890',
      );
      expect(claims.getChainId).toBe('1');
      expect(claims.getIssuedAt).toEqual(oneHourAgo);
      expect(claims.getExpiration).toEqual(oneHourFromNow);
    });
  });

  describe('isExpired', () => {
    it('should return false for valid token', () => {
      const futureExpirationData = {
        ...validClaimsData,
        exp: new Date(Date.now() + 3600000).toISOString(), // 1 hour from now
      };
      const claims = new ThirdwebTokenClaims(futureExpirationData);

      expect(claims.isExpired()).toBe(false);
    });

    it('should return true for expired token', () => {
      // Create a token with a short expiration time (but safely in the future)
      const shortLivedData = {
        ...validClaimsData,
        iat: new Date(now.getTime() - 2 * 60 * 60 * 1000).toISOString(),
        exp: new Date(now.getTime() + 500).toISOString(), // expires in 500ms
      };

      const claims = new ThirdwebTokenClaims(shortLivedData);

      // Wait for the token to expire
      return new Promise<void>((resolve) => {
        setTimeout(() => {
          expect(claims.isExpired()).toBe(true);
          resolve();
        }, 600); // Wait 600ms to ensure token is expired
      });
    });
  });

  describe('toJSON', () => {
    it('should return correct JSON representation', () => {
      const claims = new ThirdwebTokenClaims(validClaimsData);
      const json = claims.toJSON();

      expect(json).toEqual({
        iss: 'https://thirdweb.com',
        sub: 'user-123',
        aud: 'thirdweb-app',
        iat: oneHourAgo.toISOString(),
        exp: oneHourFromNow.toISOString(),
        walletAddress: '0x1234567890123456789012345678901234567890',
        chainId: '1',
      });
    });
  });
});

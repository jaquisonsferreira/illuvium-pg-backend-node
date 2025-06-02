/* eslint-disable @typescript-eslint/unbound-method */
import { PrivyTokenValidationService } from './privy-token-validation.service';
import { PrivyClient } from '@privy-io/server-auth';

jest.mock('@privy-io/server-auth');

describe('PrivyTokenValidationService', () => {
  let service: PrivyTokenValidationService;
  let mockPrivyClient: jest.Mocked<PrivyClient>;

  const originalEnv = process.env;

  beforeEach(() => {
    jest.resetModules();
    process.env = { ...originalEnv };
    process.env.PRIVY_APP_ID = 'test-app-id';
    process.env.PRIVY_APP_SECRET = 'test-app-secret';

    mockPrivyClient = {
      verifyAuthToken: jest.fn(),
    } as any;

    (PrivyClient as jest.MockedClass<typeof PrivyClient>).mockImplementation(
      () => mockPrivyClient,
    );

    service = new PrivyTokenValidationService();
  });

  afterEach(() => {
    process.env = originalEnv;
    jest.clearAllMocks();
  });

  describe('validateToken', () => {
    const mockVerifiedClaims = {
      appId: 'test-app-id',
      userId: 'test-user-id',
      issuer: 'privy.io',
      issuedAt: 1640995200,
      expiration: 1641081600,
      sessionId: 'test-session-id',
    };

    it('should return valid result for successful token validation', async () => {
      mockPrivyClient.verifyAuthToken.mockResolvedValue(mockVerifiedClaims);

      const result = await service.validateToken('valid-token');

      expect(result.isValid).toBe(true);
      expect(result.claims).toEqual({
        appId: 'test-app-id',
        userId: 'test-user-id',
        issuer: 'privy.io',
        issuedAt: new Date(1640995200 * 1000).toISOString(),
        expiration: new Date(1641081600 * 1000).toISOString(),
        sessionId: 'test-session-id',
      });
      expect(result.error).toBeUndefined();
      expect(mockPrivyClient.verifyAuthToken).toHaveBeenCalledWith(
        'valid-token',
      );
    });

    it('should return invalid result when PRIVY_APP_ID is not configured', async () => {
      delete process.env.PRIVY_APP_ID;
      service = new PrivyTokenValidationService();

      const result = await service.validateToken('valid-token');

      expect(result.isValid).toBe(false);
      expect(result.claims).toBeUndefined();
      expect(result.error).toBe('Privy app ID not configured');
      expect(mockPrivyClient.verifyAuthToken).not.toHaveBeenCalled();
    });

    it('should return invalid result when token verification fails', async () => {
      mockPrivyClient.verifyAuthToken.mockRejectedValue(
        new Error('Invalid token'),
      );

      const result = await service.validateToken('invalid-token');

      expect(result.isValid).toBe(false);
      expect(result.claims).toBeUndefined();
      expect(result.error).toBe('Invalid token');
      expect(mockPrivyClient.verifyAuthToken).toHaveBeenCalledWith(
        'invalid-token',
      );
    });

    it('should handle non-Error exceptions gracefully', async () => {
      mockPrivyClient.verifyAuthToken.mockRejectedValue('String error');

      const result = await service.validateToken('invalid-token');

      expect(result.isValid).toBe(false);
      expect(result.claims).toBeUndefined();
      expect(result.error).toBe('Token validation failed');
    });
  });

  describe('validateTokenWithVerificationKey', () => {
    const mockVerifiedClaims = {
      appId: 'test-app-id',
      userId: 'test-user-id',
      issuer: 'privy.io',
      issuedAt: 1640995200,
      expiration: 1641081600,
      sessionId: 'test-session-id',
    };

    it('should use verification key when provided', async () => {
      mockPrivyClient.verifyAuthToken.mockResolvedValue(mockVerifiedClaims);

      const result = await service.validateTokenWithVerificationKey(
        'valid-token',
        'verification-key',
      );

      expect(result.isValid).toBe(true);
      expect(result.claims).toEqual({
        appId: 'test-app-id',
        userId: 'test-user-id',
        issuer: 'privy.io',
        issuedAt: new Date(1640995200 * 1000).toISOString(),
        expiration: new Date(1641081600 * 1000).toISOString(),
        sessionId: 'test-session-id',
      });
      expect(mockPrivyClient.verifyAuthToken).toHaveBeenCalledWith(
        'valid-token',
        'verification-key',
      );
    });

    it('should not use verification key when not provided', async () => {
      mockPrivyClient.verifyAuthToken.mockResolvedValue(mockVerifiedClaims);

      const result =
        await service.validateTokenWithVerificationKey('valid-token');

      expect(result.isValid).toBe(true);
      expect(mockPrivyClient.verifyAuthToken).toHaveBeenCalledWith(
        'valid-token',
      );
    });

    it('should return invalid result when PRIVY_APP_ID is not configured', async () => {
      delete process.env.PRIVY_APP_ID;
      service = new PrivyTokenValidationService();

      const result = await service.validateTokenWithVerificationKey(
        'valid-token',
        'verification-key',
      );

      expect(result.isValid).toBe(false);
      expect(result.claims).toBeUndefined();
      expect(result.error).toBe('Privy app ID not configured');
      expect(mockPrivyClient.verifyAuthToken).not.toHaveBeenCalled();
    });

    it('should return invalid result when token verification fails', async () => {
      mockPrivyClient.verifyAuthToken.mockRejectedValue(
        new Error('Invalid token'),
      );

      const result = await service.validateTokenWithVerificationKey(
        'invalid-token',
        'verification-key',
      );

      expect(result.isValid).toBe(false);
      expect(result.claims).toBeUndefined();
      expect(result.error).toBe('Invalid token');
    });

    it('should handle non-Error exceptions gracefully', async () => {
      mockPrivyClient.verifyAuthToken.mockRejectedValue('String error');

      const result = await service.validateTokenWithVerificationKey(
        'invalid-token',
        'verification-key',
      );

      expect(result.isValid).toBe(false);
      expect(result.claims).toBeUndefined();
      expect(result.error).toBe('Token validation failed');
    });
  });

  describe('constructor', () => {
    it('should create PrivyClient with environment variables', () => {
      expect(PrivyClient).toHaveBeenCalledWith(
        'test-app-id',
        'test-app-secret',
      );
    });

    it('should handle missing environment variables gracefully', () => {
      delete process.env.PRIVY_APP_ID;
      delete process.env.PRIVY_APP_SECRET;

      new PrivyTokenValidationService();

      expect(PrivyClient).toHaveBeenCalledWith('', '');
    });
  });
});

import {
  ThirdwebTokenValidationService,
  ThirdwebTokenValidationResult,
} from './thirdweb-token-validation.service';
import { ThirdwebTokenClaimsData } from '../../domain/value-objects/thirdweb-token-claims.value-object';

// Mock thirdweb modules
jest.mock('thirdweb', () => ({
  createThirdwebClient: jest.fn(),
}));

jest.mock('thirdweb/auth', () => ({
  createAuth: jest.fn(),
}));

// Create test helpers
const mockVerifyJWT = jest.fn();
let mockCreateAuth: jest.MockedFunction<any>;
let mockCreateThirdwebClient: jest.MockedFunction<any>;

describe('ThirdwebTokenValidationService', () => {
  let service: ThirdwebTokenValidationService;

  const validTokenClaims: ThirdwebTokenClaimsData = {
    iss: 'https://thirdweb.com',
    sub: 'user-123',
    aud: 'thirdweb-app',
    iat: new Date(Date.now() - 60 * 60 * 1000).toISOString(),
    exp: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
    walletAddress: '0x1234567890123456789012345678901234567890',
    chainId: '1',
  };

  beforeEach(() => {
    jest.clearAllMocks();

    process.env.THIRDWEB_SECRET_KEY = 'test-secret-key';
    process.env.THIRDWEB_CLIENT_ID = 'test-client-id';

    // Setup mocks
    const thirdweb = require('thirdweb');
    const thirdwebAuth = require('thirdweb/auth');
    
    mockCreateThirdwebClient = thirdweb.createThirdwebClient as jest.MockedFunction<any>;
    mockCreateAuth = thirdwebAuth.createAuth as jest.MockedFunction<any>;
    
    mockCreateThirdwebClient.mockReturnValue({
      clientId: 'test-client-id',
    });
    
    mockCreateAuth.mockReturnValue({
      verifyJWT: mockVerifyJWT,
    });

    service = new ThirdwebTokenValidationService();
  });

  afterEach(() => {
    // Clean up environment variables
    delete process.env.THIRDWEB_SECRET_KEY;
    delete process.env.THIRDWEB_CLIENT_ID;
  });

  describe('validateToken', () => {
    it('should return valid result for valid token', async () => {
      mockVerifyJWT.mockResolvedValue({
        valid: true,
        parsedJWT: validTokenClaims,
      });

      const result: ThirdwebTokenValidationResult = await service.validateToken('valid-jwt-token');

      expect(result.isValid).toBe(true);
      expect(result.claims).toEqual(validTokenClaims);
      expect(result.error).toBeUndefined();
      expect(mockVerifyJWT).toHaveBeenCalledWith({
        jwt: 'valid-jwt-token',
      });
    });

    it('should return invalid result for invalid token', async () => {
      mockVerifyJWT.mockResolvedValue({
        valid: false,
        parsedJWT: null,
      });

      const result: ThirdwebTokenValidationResult = await service.validateToken('invalid-jwt-token');

      expect(result.isValid).toBe(false);
      expect(result.claims).toBeUndefined();
      expect(result.error).toBe('Invalid JWT token');
    });

    it('should return error when thirdweb secret key is not configured', async () => {
      delete process.env.THIRDWEB_SECRET_KEY;
      service = new ThirdwebTokenValidationService();

      const result: ThirdwebTokenValidationResult = await service.validateToken('some-token');

      expect(result.isValid).toBe(false);
      expect(result.claims).toBeUndefined();
      expect(result.error).toBe('Thirdweb secret key not configured');
    });

    it('should return error when thirdweb client ID is not configured', async () => {
      delete process.env.THIRDWEB_CLIENT_ID;
      service = new ThirdwebTokenValidationService();

      const result: ThirdwebTokenValidationResult = await service.validateToken('some-token');

      expect(result.isValid).toBe(false);
      expect(result.claims).toBeUndefined();
      expect(result.error).toBe('Thirdweb client ID not configured');
    });

    it('should handle thirdweb verification errors', async () => {
      const errorMessage = 'JWT verification failed';
      mockVerifyJWT.mockRejectedValue(new Error(errorMessage));

      const result: ThirdwebTokenValidationResult = await service.validateToken('error-token');

      expect(result.isValid).toBe(false);
      expect(result.claims).toBeUndefined();
      expect(result.error).toBe(errorMessage);
    });

    it('should handle unknown errors gracefully', async () => {
      mockVerifyJWT.mockRejectedValue('unknown error');

      const result: ThirdwebTokenValidationResult = await service.validateToken('error-token');

      expect(result.isValid).toBe(false);
      expect(result.claims).toBeUndefined();
      expect(result.error).toBe('Token validation failed');
    });

    it('should validate token structure when thirdweb returns valid result', async () => {
      const invalidStructureClaims = {
        ...validTokenClaims,
        walletAddress: 'invalid-address', // Invalid Ethereum address
      };

      mockVerifyJWT.mockResolvedValue({
        valid: true,
        parsedJWT: invalidStructureClaims,
      });

      const result: ThirdwebTokenValidationResult = await service.validateToken('token-with-invalid-claims');

      expect(result.isValid).toBe(false);
      expect(result.claims).toBeUndefined();
      expect(result.error).toContain('Invalid wallet address');
    });
  });

  describe('constructor', () => {
    it('should initialize with valid configuration', () => {
      expect(() => new ThirdwebTokenValidationService()).not.toThrow();
    });

    it('should handle missing environment variables gracefully', () => {
      delete process.env.THIRDWEB_SECRET_KEY;
      delete process.env.THIRDWEB_CLIENT_ID;
      
      expect(() => new ThirdwebTokenValidationService()).not.toThrow();
    });
  });
});

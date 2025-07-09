import { ValidateTokenUseCase } from './validate-token.use-case';
import { UserRepositoryInterface } from '../../domain/repositories/user.repository.interface';
import { TokenValidationDomainService } from '../../domain/services/token-validation.domain-service';
import { ThirdwebTokenValidationService } from '../../infrastructure/services/thirdweb-token-validation.service';
import { UserEntity } from '../../domain/entities/user.entity';
import {
  ThirdwebTokenClaims,
  ThirdwebTokenClaimsData,
} from '../../domain/value-objects/thirdweb-token-claims.value-object';

describe('ValidateTokenUseCase', () => {
  let useCase: ValidateTokenUseCase;
  let mockUserRepository: jest.Mocked<UserRepositoryInterface>;
  let mockTokenValidationService: jest.Mocked<TokenValidationDomainService>;
  let mockThirdwebTokenValidationService: jest.Mocked<ThirdwebTokenValidationService>;

  const validTokenClaims: ThirdwebTokenClaimsData = {
    iss: 'https://thirdweb.com',
    sub: 'user-123',
    aud: 'test-client-id',
    iat: new Date(Date.now() - 60 * 60 * 1000).toISOString(),
    exp: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
    walletAddress: '0x1234567890123456789012345678901234567890',
    chainId: '1',
  };

  const mockUser = new UserEntity({
    id: 'user-entity-123',
    thirdwebId: 'user-123',
    walletAddress: '0x1234567890123456789012345678901234567890',
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  });

  beforeEach(() => {
    mockUserRepository = {
      findById: jest.fn(),
      findByThirdwebId: jest.fn(),
      findByWalletAddress: jest.fn(),
      save: jest.fn(),
      create: jest.fn(),
    } as jest.Mocked<UserRepositoryInterface>;

    mockThirdwebTokenValidationService = {
      validateToken: jest.fn(),
      validateTokenWithOptions: jest.fn(),
    } as unknown as jest.Mocked<ThirdwebTokenValidationService>;

    mockTokenValidationService = {
      validateTokenClaims: jest.fn(),
    } as jest.Mocked<TokenValidationDomainService>;

    useCase = new ValidateTokenUseCase(
      mockUserRepository,
      mockTokenValidationService,
      mockThirdwebTokenValidationService,
    );
  });

  describe('execute', () => {
    it('should return valid response for valid token and existing user', async () => {
      const request = {
        token: 'valid-jwt-token',
        clientId: 'test-client-id',
      };

      // Mock Thirdweb token validation
      mockThirdwebTokenValidationService.validateToken.mockResolvedValue({
        isValid: true,
        claims: validTokenClaims,
      });

      // Mock domain validation
      const mockClaims = new ThirdwebTokenClaims(validTokenClaims);
      mockTokenValidationService.validateTokenClaims.mockReturnValue({
        isValid: true,
        claims: mockClaims,
      });

      // Mock user repository
      mockUserRepository.findByThirdwebId.mockResolvedValue(mockUser);

      const result = await useCase.execute(request);

      expect(result.isValid).toBe(true);
      expect(result.user).toEqual(mockUser);
      expect(result.internalError).toBeUndefined();
      expect(
        mockThirdwebTokenValidationService.validateToken,
      ).toHaveBeenCalledTimes(1);
      expect(
        mockThirdwebTokenValidationService.validateToken,
      ).toHaveBeenCalledWith(request.token);
      expect(
        mockTokenValidationService.validateTokenClaims,
      ).toHaveBeenCalledTimes(1);
      expect(
        mockTokenValidationService.validateTokenClaims,
      ).toHaveBeenCalledWith(validTokenClaims, request.clientId);
      expect(mockUserRepository.findByThirdwebId).toHaveBeenCalledTimes(1);
      expect(mockUserRepository.findByThirdwebId).toHaveBeenCalledWith(
        'user-123',
      );
    });

    it('should return invalid response when token validation fails', async () => {
      const request = {
        token: 'invalid-jwt-token',
        clientId: 'test-client-id',
      };

      mockThirdwebTokenValidationService.validateToken.mockResolvedValue({
        isValid: false,
        error: 'Invalid JWT token',
      });

      const result = await useCase.execute(request);

      expect(result.isValid).toBe(false);
      expect(result.user).toBeUndefined();
      expect(result.internalError).toBe('Invalid JWT token');
    });

    it('should return invalid response when claims validation fails', async () => {
      const request = {
        token: 'valid-jwt-token',
        clientId: 'test-client-id',
      };

      mockThirdwebTokenValidationService.validateToken.mockResolvedValue({
        isValid: true,
        claims: validTokenClaims,
      });

      mockTokenValidationService.validateTokenClaims.mockReturnValue({
        isValid: false,
        error: 'Invalid audience',
      });

      const result = await useCase.execute(request);

      expect(result.isValid).toBe(false);
      expect(result.user).toBeUndefined();
      expect(result.internalError).toBe('Invalid audience');
    });

    it('should return invalid response when user is not found', async () => {
      const request = {
        token: 'valid-jwt-token',
        clientId: 'test-client-id',
      };

      mockThirdwebTokenValidationService.validateToken.mockResolvedValue({
        isValid: true,
        claims: validTokenClaims,
      });

      const mockClaims = new ThirdwebTokenClaims(validTokenClaims);
      mockTokenValidationService.validateTokenClaims.mockReturnValue({
        isValid: true,
        claims: mockClaims,
      });

      mockUserRepository.findByThirdwebId.mockResolvedValue(null);

      const result = await useCase.execute(request);

      expect(result.isValid).toBe(false);
      expect(result.user).toBeUndefined();
      expect(result.internalError).toBe('User not found');
    });

    it('should return invalid response when user account is inactive', async () => {
      const request = {
        token: 'valid-jwt-token',
        clientId: 'test-client-id',
      };

      const inactiveUser = new UserEntity({
        ...mockUser.toJSON(),
        isActive: false,
      });

      mockThirdwebTokenValidationService.validateToken.mockResolvedValue({
        isValid: true,
        claims: validTokenClaims,
      });

      const mockClaims = new ThirdwebTokenClaims(validTokenClaims);
      mockTokenValidationService.validateTokenClaims.mockReturnValue({
        isValid: true,
        claims: mockClaims,
      });

      mockUserRepository.findByThirdwebId.mockResolvedValue(inactiveUser);

      const result = await useCase.execute(request);

      expect(result.isValid).toBe(false);
      expect(result.user).toBeUndefined();
      expect(result.internalError).toBe('User account is inactive');
    });

    it('should handle unexpected errors gracefully', async () => {
      const request = {
        token: 'valid-jwt-token',
        clientId: 'test-client-id',
      };

      mockThirdwebTokenValidationService.validateToken.mockRejectedValue(
        new Error('Network error'),
      );

      const result = await useCase.execute(request);

      expect(result.isValid).toBe(false);
      expect(result.user).toBeUndefined();
      expect(result.internalError).toBe('Network error');
    });

    it('should handle non-Error exceptions', async () => {
      const request = {
        token: 'valid-jwt-token',
        clientId: 'test-client-id',
      };

      mockThirdwebTokenValidationService.validateToken.mockRejectedValue(
        'Unknown error',
      );

      const result = await useCase.execute(request);

      expect(result.isValid).toBe(false);
      expect(result.user).toBeUndefined();
      expect(result.internalError).toBe('Token validation failed');
    });
  });
});

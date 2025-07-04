import { Test, TestingModule } from '@nestjs/testing';
import { ValidateTokenUseCase } from './validate-token.use-case';
import { UserRepositoryInterface } from '../../domain/repositories/user.repository.interface';
import { TokenValidationDomainService } from '../../domain/services/token-validation.domain-service';
import { ThirdwebTokenValidationService } from '../../infrastructure/services/thirdweb-token-validation.service';
import { UserEntity } from '../../domain/entities/user.entity';
import { USER_REPOSITORY_TOKEN } from '../../constants';
import { ThirdwebTokenClaimsData } from '../../domain/value-objects/thirdweb-token-claims.value-object';

describe('ValidateTokenUseCase (Thirdweb)', () => {
  let useCase: ValidateTokenUseCase;
  let userRepository: jest.Mocked<UserRepositoryInterface>;
  let tokenValidationService: jest.Mocked<TokenValidationDomainService>;
  let thirdwebTokenValidationService: jest.Mocked<ThirdwebTokenValidationService>;

  const mockUser = new UserEntity({
    id: '123e4567-e89b-12d3-a456-426614174000',
    thirdwebId: 'user-123',
    walletAddress: '0x1234567890123456789012345678901234567890',
    createdAt: new Date(),
    updatedAt: new Date(),
    isActive: true,
  });

  const validClaimsData: ThirdwebTokenClaimsData = {
    iss: 'https://thirdweb.com',
    sub: 'user-123',
    aud: 'test-client-id',
    iat: new Date(Date.now() - 60 * 60 * 1000).toISOString(),
    exp: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
    walletAddress: '0x1234567890123456789012345678901234567890',
    chainId: '1',
  };

  beforeEach(async () => {
    const mockUserRepository = {
      findByThirdwebId: jest.fn(),
      findById: jest.fn(),
      save: jest.fn(),
      create: jest.fn(),
    };

    const mockTokenValidationService = {
      validateTokenClaims: jest.fn(),
    };

    const mockThirdwebTokenValidationService = {
      validateToken: jest.fn(),
      validateTokenWithOptions: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ValidateTokenUseCase,
        {
          provide: USER_REPOSITORY_TOKEN,
          useValue: mockUserRepository,
        },
        {
          provide: TokenValidationDomainService,
          useValue: mockTokenValidationService,
        },
        {
          provide: ThirdwebTokenValidationService,
          useValue: mockThirdwebTokenValidationService,
        },
      ],
    }).compile();

    useCase = module.get<ValidateTokenUseCase>(ValidateTokenUseCase);
    userRepository = module.get(USER_REPOSITORY_TOKEN);
    tokenValidationService = module.get(TokenValidationDomainService);
    thirdwebTokenValidationService = module.get(ThirdwebTokenValidationService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('execute', () => {
    const validRequest = {
      token: 'valid-token',
      clientId: 'test-app-id',
    };

    it('should return valid response for successful validation', async () => {
      thirdwebTokenValidationService.validateToken.mockResolvedValue({
        isValid: true,
        claims: validClaimsData,
      });

      tokenValidationService.validateTokenClaims.mockReturnValue({
        isValid: true,
        claims: {
          getUserId: 'user-123',
          getWalletAddress: '0x1234567890123456789012345678901234567890',
          getChainId: '1',
          getIssuer: 'https://thirdweb.com',
          getIssuedAt: new Date(validClaimsData.iat),
          getExpiration: new Date(validClaimsData.exp),
          isExpired: () => false,
          toJSON: () => validClaimsData,
        } as any,
      });

      userRepository.findByThirdwebId.mockResolvedValue(mockUser);

      const result = await useCase.execute(validRequest);

      expect(result.isValid).toBe(true);
      expect(result.user).toBe(mockUser);
      expect(result.internalError).toBeUndefined();
      expect(thirdwebTokenValidationService.validateToken).toHaveBeenCalledWith(
        'valid-token',
      );
      expect(tokenValidationService.validateTokenClaims).toHaveBeenCalledWith(
        validClaimsData,
        'test-app-id',
      );
      expect(userRepository.findByThirdwebId).toHaveBeenCalledWith('user-123');
    });

    it('should return invalid response when thirdweb token validation fails', async () => {
      thirdwebTokenValidationService.validateToken.mockResolvedValue({
        isValid: false,
        error: 'Invalid token',
      });

      const result = await useCase.execute(validRequest);

      expect(result.isValid).toBe(false);
      expect(result.user).toBeUndefined();
      expect(result.internalError).toBe('Invalid token');
      expect(tokenValidationService.validateTokenClaims).not.toHaveBeenCalled();
      expect(userRepository.findByThirdwebId).not.toHaveBeenCalled();
    });

    it('should return invalid response when thirdweb token validation returns no claims', async () => {
      thirdwebTokenValidationService.validateToken.mockResolvedValue({
        isValid: true,
        claims: undefined,
      });

      const result = await useCase.execute(validRequest);

      expect(result.isValid).toBe(false);
      expect(result.user).toBeUndefined();
      expect(result.internalError).toBe('Token validation failed');
      expect(tokenValidationService.validateTokenClaims).not.toHaveBeenCalled();
      expect(userRepository.findByThirdwebId).not.toHaveBeenCalled();
    });

    it('should return invalid response when domain validation fails', async () => {
      thirdwebTokenValidationService.validateToken.mockResolvedValue({
        isValid: true,
        claims: validClaimsData,
      });

      tokenValidationService.validateTokenClaims.mockReturnValue({
        isValid: false,
        error: 'Invalid client ID',
      });

      const result = await useCase.execute(validRequest);

      expect(result.isValid).toBe(false);
      expect(result.user).toBeUndefined();
      expect(result.internalError).toBe('Invalid client ID');
      expect(userRepository.findByThirdwebId).not.toHaveBeenCalled();
    });

    it('should return invalid response when domain validation returns no claims', async () => {
      thirdwebTokenValidationService.validateToken.mockResolvedValue({
        isValid: true,
        claims: validClaimsData,
      });

      tokenValidationService.validateTokenClaims.mockReturnValue({
        isValid: true,
        claims: undefined,
      });

      const result = await useCase.execute(validRequest);

      expect(result.isValid).toBe(false);
      expect(result.user).toBeUndefined();
      expect(result.internalError).toBe('Claims validation failed');
      expect(userRepository.findByThirdwebId).not.toHaveBeenCalled();
    });

    it('should return invalid response when user is not found', async () => {
      thirdwebTokenValidationService.validateToken.mockResolvedValue({
        isValid: true,
        claims: validClaimsData,
      });

      tokenValidationService.validateTokenClaims.mockReturnValue({
        isValid: true,
        claims: {
          getUserId: 'user-123',
          getWalletAddress: '0x1234567890123456789012345678901234567890',
          getChainId: '1',
          getIssuer: 'https://thirdweb.com',
          getIssuedAt: new Date(validClaimsData.iat),
          getExpiration: new Date(validClaimsData.exp),
          isExpired: () => false,
          toJSON: () => validClaimsData,
        } as any,
      });

      userRepository.findByThirdwebId.mockResolvedValue(null);

      const result = await useCase.execute(validRequest);

      expect(result.isValid).toBe(false);
      expect(result.user).toBeUndefined();
      expect(result.internalError).toBe('User not found');
    });

    it('should return invalid response when user is inactive', async () => {
      const inactiveUser = new UserEntity({
        ...mockUser.toJSON(),
        isActive: false,
      });

      thirdwebTokenValidationService.validateToken.mockResolvedValue({
        isValid: true,
        claims: validClaimsData,
      });

      tokenValidationService.validateTokenClaims.mockReturnValue({
        isValid: true,
        claims: {
          getUserId: 'user-123',
          getWalletAddress: '0x1234567890123456789012345678901234567890',
          getChainId: '1',
          getIssuer: 'https://thirdweb.com',
          getIssuedAt: new Date(validClaimsData.iat),
          getExpiration: new Date(validClaimsData.exp),
          isExpired: () => false,
          toJSON: () => validClaimsData,
        } as any,
      });

      userRepository.findByThirdwebId.mockResolvedValue(inactiveUser);

      const result = await useCase.execute(validRequest);

      expect(result.isValid).toBe(false);
      expect(result.user).toBeUndefined();
      expect(result.internalError).toBe('User account is inactive');
    });

    it('should handle unexpected errors gracefully', async () => {
      thirdwebTokenValidationService.validateToken.mockRejectedValue(
        new Error('Unexpected error'),
      );

      const result = await useCase.execute(validRequest);

      expect(result.isValid).toBe(false);
      expect(result.user).toBeUndefined();
      expect(result.internalError).toBe('Unexpected error');
    });

    it('should handle non-Error exceptions gracefully', async () => {
      thirdwebTokenValidationService.validateToken.mockRejectedValue(
        'String error',
      );

      const result = await useCase.execute(validRequest);

      expect(result.isValid).toBe(false);
      expect(result.user).toBeUndefined();
      expect(result.internalError).toBe('Token validation failed');
    });
  });
});

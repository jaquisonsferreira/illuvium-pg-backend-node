/* eslint-disable @typescript-eslint/unbound-method */
import { Test, TestingModule } from '@nestjs/testing';
import { ValidateTokenUseCase } from './validate-token.use-case';
import { UserRepositoryInterface } from '../../domain/repositories/user.repository.interface';
import { TokenValidationDomainService } from '../../domain/services/token-validation.domain-service';
import { PrivyTokenValidationService } from '../../infrastructure/services/privy-token-validation.service';
import { UserEntity } from '../../domain/entities/user.entity';
import { USER_REPOSITORY_TOKEN } from '../../constants';
import { PrivyTokenClaimsData } from '../../domain/value-objects/privy-token-claims.value-object';

describe('ValidateTokenUseCase', () => {
  let useCase: ValidateTokenUseCase;
  let userRepository: jest.Mocked<UserRepositoryInterface>;
  let tokenValidationService: jest.Mocked<TokenValidationDomainService>;
  let privyTokenValidationService: jest.Mocked<PrivyTokenValidationService>;

  const mockUser = new UserEntity({
    id: '123e4567-e89b-12d3-a456-426614174000',
    privyId: 'privy_123',
    walletAddress: '0x1234567890123456789012345678901234567890',
    email: 'test@example.com',
    phoneNumber: '+1234567890',
    createdAt: new Date('2023-01-01T00:00:00.000Z'),
    updatedAt: new Date('2023-01-01T00:00:00.000Z'),
    isActive: true,
  });

  const mockClaimsData: PrivyTokenClaimsData = {
    appId: 'test-app-id',
    userId: 'privy_123',
    issuer: 'privy.io',
    issuedAt: new Date(Date.now() - 60000).toISOString(),
    expiration: new Date(Date.now() + 3600000).toISOString(),
    sessionId: 'test-session-id',
  };

  beforeEach(async () => {
    const mockUserRepository = {
      findByPrivyId: jest.fn(),
      findById: jest.fn(),
      save: jest.fn(),
      create: jest.fn(),
    };

    const mockTokenValidationService = {
      validateTokenClaims: jest.fn(),
    };

    const mockPrivyTokenValidationService = {
      validateToken: jest.fn(),
      validateTokenWithVerificationKey: jest.fn(),
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
          provide: PrivyTokenValidationService,
          useValue: mockPrivyTokenValidationService,
        },
      ],
    }).compile();

    useCase = module.get<ValidateTokenUseCase>(ValidateTokenUseCase);
    userRepository = module.get(USER_REPOSITORY_TOKEN);
    tokenValidationService = module.get(TokenValidationDomainService);
    privyTokenValidationService = module.get(PrivyTokenValidationService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('execute', () => {
    const validRequest = {
      token: 'valid-token',
      appId: 'test-app-id',
    };

    it('should return valid response for successful validation', async () => {
      privyTokenValidationService.validateToken.mockResolvedValue({
        isValid: true,
        claims: mockClaimsData,
      });

      tokenValidationService.validateTokenClaims.mockReturnValue({
        isValid: true,
        claims: {
          getUserId: 'privy_123',
          getAppId: 'test-app-id',
          getIssuer: 'privy.io',
          getIssuedAt: new Date(),
          getExpiration: new Date(),
          getSessionId: 'test-session-id',
          isExpired: () => false,
          toJSON: () => mockClaimsData,
        } as any,
      });

      userRepository.findByPrivyId.mockResolvedValue(mockUser);

      const result = await useCase.execute(validRequest);

      expect(result.isValid).toBe(true);
      expect(result.user).toBe(mockUser);
      expect(result.error).toBeUndefined();
      expect(privyTokenValidationService.validateToken).toHaveBeenCalledWith(
        'valid-token',
      );
      expect(tokenValidationService.validateTokenClaims).toHaveBeenCalledWith(
        mockClaimsData,
        'test-app-id',
      );
      expect(userRepository.findByPrivyId).toHaveBeenCalledWith('privy_123');
    });

    it('should return invalid response when privy token validation fails', async () => {
      privyTokenValidationService.validateToken.mockResolvedValue({
        isValid: false,
        error: 'Invalid token',
      });

      const result = await useCase.execute(validRequest);

      expect(result.isValid).toBe(false);
      expect(result.user).toBeUndefined();
      expect(result.error).toBe('Invalid token');
      expect(tokenValidationService.validateTokenClaims).not.toHaveBeenCalled();
      expect(userRepository.findByPrivyId).not.toHaveBeenCalled();
    });

    it('should return invalid response when privy token validation returns no claims', async () => {
      privyTokenValidationService.validateToken.mockResolvedValue({
        isValid: true,
        claims: undefined,
      });

      const result = await useCase.execute(validRequest);

      expect(result.isValid).toBe(false);
      expect(result.user).toBeUndefined();
      expect(result.error).toBe('Token validation failed');
      expect(tokenValidationService.validateTokenClaims).not.toHaveBeenCalled();
      expect(userRepository.findByPrivyId).not.toHaveBeenCalled();
    });

    it('should return invalid response when domain validation fails', async () => {
      privyTokenValidationService.validateToken.mockResolvedValue({
        isValid: true,
        claims: mockClaimsData,
      });

      tokenValidationService.validateTokenClaims.mockReturnValue({
        isValid: false,
        error: 'Invalid app ID',
      });

      const result = await useCase.execute(validRequest);

      expect(result.isValid).toBe(false);
      expect(result.user).toBeUndefined();
      expect(result.error).toBe('Invalid app ID');
      expect(userRepository.findByPrivyId).not.toHaveBeenCalled();
    });

    it('should return invalid response when domain validation returns no claims', async () => {
      privyTokenValidationService.validateToken.mockResolvedValue({
        isValid: true,
        claims: mockClaimsData,
      });

      tokenValidationService.validateTokenClaims.mockReturnValue({
        isValid: true,
        claims: undefined,
      });

      const result = await useCase.execute(validRequest);

      expect(result.isValid).toBe(false);
      expect(result.user).toBeUndefined();
      expect(result.error).toBe('Claims validation failed');
      expect(userRepository.findByPrivyId).not.toHaveBeenCalled();
    });

    it('should return invalid response when user is not found', async () => {
      privyTokenValidationService.validateToken.mockResolvedValue({
        isValid: true,
        claims: mockClaimsData,
      });

      tokenValidationService.validateTokenClaims.mockReturnValue({
        isValid: true,
        claims: {
          getUserId: 'privy_123',
          getAppId: 'test-app-id',
          getIssuer: 'privy.io',
          getIssuedAt: new Date(),
          getExpiration: new Date(),
          getSessionId: 'test-session-id',
          isExpired: () => false,
          toJSON: () => mockClaimsData,
        } as any,
      });

      userRepository.findByPrivyId.mockResolvedValue(null);

      const result = await useCase.execute(validRequest);

      expect(result.isValid).toBe(false);
      expect(result.user).toBeUndefined();
      expect(result.error).toBe('User not found');
    });

    it('should return invalid response when user is inactive', async () => {
      const inactiveUser = new UserEntity({
        ...mockUser.toJSON(),
        isActive: false,
      });

      privyTokenValidationService.validateToken.mockResolvedValue({
        isValid: true,
        claims: mockClaimsData,
      });

      tokenValidationService.validateTokenClaims.mockReturnValue({
        isValid: true,
        claims: {
          getUserId: 'privy_123',
          getAppId: 'test-app-id',
          getIssuer: 'privy.io',
          getIssuedAt: new Date(),
          getExpiration: new Date(),
          getSessionId: 'test-session-id',
          isExpired: () => false,
          toJSON: () => mockClaimsData,
        } as any,
      });

      userRepository.findByPrivyId.mockResolvedValue(inactiveUser);

      const result = await useCase.execute(validRequest);

      expect(result.isValid).toBe(false);
      expect(result.user).toBeUndefined();
      expect(result.error).toBe('User account is inactive');
    });

    it('should handle unexpected errors gracefully', async () => {
      privyTokenValidationService.validateToken.mockRejectedValue(
        new Error('Unexpected error'),
      );

      const result = await useCase.execute(validRequest);

      expect(result.isValid).toBe(false);
      expect(result.user).toBeUndefined();
      expect(result.error).toBe('Unexpected error');
    });

    it('should handle non-Error exceptions gracefully', async () => {
      privyTokenValidationService.validateToken.mockRejectedValue(
        'String error',
      );

      const result = await useCase.execute(validRequest);

      expect(result.isValid).toBe(false);
      expect(result.user).toBeUndefined();
      expect(result.error).toBe('Token validation failed');
    });
  });
});

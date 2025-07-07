import { Test, TestingModule } from '@nestjs/testing';
import { ValidateTokenUseCase } from './validate-token.use-case';
import { UserRepositoryInterface } from '../../domain/repositories/user.repository.interface';
import { TokenValidationDomainService } from '../../domain/services/token-validation.domain-service';
import { ThirdwebTokenValidationService } from '../../infrastructure/services/thirdweb-token-validation.service';
import { UserEntity } from '../../domain/entities/user.entity';
import { USER_REPOSITORY_TOKEN } from '../../constants';

describe('ValidateTokenUseCase Integration', () => {
  let useCase: ValidateTokenUseCase;
  let userRepository: jest.Mocked<UserRepositoryInterface>;
  let tokenValidationService: TokenValidationDomainService;
  let thirdwebTokenValidationService: ThirdwebTokenValidationService;

  const mockUser = new UserEntity({
    id: '123e4567-e89b-12d3-a456-426614174000',
    thirdwebId: 'user-123',
    walletAddress: '0x1234567890123456789012345678901234567890',
    createdAt: new Date(),
    updatedAt: new Date(),
    isActive: true,
  });

  beforeEach(async () => {
    const mockUserRepository = {
      findByThirdwebId: jest.fn(),
      findById: jest.fn(),
      save: jest.fn(),
      create: jest.fn(),
      findByWalletAddress: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ValidateTokenUseCase,
        {
          provide: USER_REPOSITORY_TOKEN,
          useValue: mockUserRepository,
        },
        TokenValidationDomainService,
        ThirdwebTokenValidationService,
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

  describe('execute - Integration Tests', () => {
    it('should handle invalid token format', async () => {
      const request = {
        token: 'invalid-token-format',
        clientId: 'test-client-id',
      };

      const result = await useCase.execute(request);

      expect(result.isValid).toBe(false);
      expect(result.internalError).toContain(
        'Thirdweb secret key not configured',
      );
    });

    it('should handle missing token', async () => {
      const request = {
        token: '',
        clientId: 'test-client-id',
      };

      const result = await useCase.execute(request);

      expect(result.isValid).toBe(false);
      expect(result.internalError).toContain(
        'Thirdweb secret key not configured',
      );
    });

    it('should handle missing client ID', async () => {
      const request = {
        token: 'some-token',
        clientId: '',
      };

      const result = await useCase.execute(request);

      expect(result.isValid).toBe(false);
      expect(result.internalError).toContain(
        'Thirdweb secret key not configured',
      );
    });

    it('should validate token claims using real domain service', async () => {
      const validClaimsData = {
        iss: 'https://thirdweb.com',
        sub: 'user-123',
        aud: 'test-client-id',
        iat: new Date(Date.now() - 60 * 60 * 1000).toISOString(),
        exp: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
        walletAddress: '0x1234567890123456789012345678901234567890',
        chainId: '1',
      };

      const domainResult = tokenValidationService.validateTokenClaims(
        validClaimsData,
        'test-client-id',
      );

      expect(domainResult.isValid).toBe(true);
      expect(domainResult.claims).toBeDefined();
    });

    it('should reject expired token claims', async () => {
      const expiredClaimsData = {
        iss: 'https://thirdweb.com',
        sub: 'user-123',
        aud: 'test-client-id',
        iat: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
        exp: new Date(Date.now() - 60 * 60 * 1000).toISOString(),
        walletAddress: '0x1234567890123456789012345678901234567890',
        chainId: '1',
      };

      const domainResult = tokenValidationService.validateTokenClaims(
        expiredClaimsData,
        'test-client-id',
      );

      expect(domainResult.isValid).toBe(false);
      expect(domainResult.error).toContain('expired');
    });

    it('should reject invalid audience', async () => {
      const invalidAudClaimsData = {
        iss: 'https://thirdweb.com',
        sub: 'user-123',
        aud: 'wrong-client-id',
        iat: new Date(Date.now() - 60 * 60 * 1000).toISOString(),
        exp: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
        walletAddress: '0x1234567890123456789012345678901234567890',
        chainId: '1',
      };

      const domainResult = tokenValidationService.validateTokenClaims(
        invalidAudClaimsData,
        'test-client-id',
      );

      expect(domainResult.isValid).toBe(false);
      expect(domainResult.error).toContain('Invalid client ID');
    });

    it('should handle user not found scenario', async () => {
      userRepository.findByThirdwebId.mockResolvedValue(null);

      const validClaimsData = {
        iss: 'https://thirdweb.com',
        sub: 'user-123',
        aud: 'test-client-id',
        iat: new Date(Date.now() - 60 * 60 * 1000).toISOString(),
        exp: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
        walletAddress: '0x1234567890123456789012345678901234567890',
        chainId: '1',
      };

      const domainResult = tokenValidationService.validateTokenClaims(
        validClaimsData,
        'test-client-id',
      );

      expect(domainResult.isValid).toBe(true);

      const request = {
        token: 'mock-token',
        clientId: 'test-client-id',
      };

      jest
        .spyOn(thirdwebTokenValidationService, 'validateToken')
        .mockResolvedValue({
          isValid: true,
          claims: validClaimsData,
        });

      const result = await useCase.execute(request);

      expect(result.isValid).toBe(false);
      expect(result.internalError).toContain('User not found');
    });

    it('should handle inactive user scenario', async () => {
      const inactiveUser = new UserEntity({
        ...mockUser.toJSON(),
        isActive: false,
      });

      userRepository.findByThirdwebId.mockResolvedValue(inactiveUser);

      const validClaimsData = {
        iss: 'https://thirdweb.com',
        sub: 'user-123',
        aud: 'test-client-id',
        iat: new Date(Date.now() - 60 * 60 * 1000).toISOString(),
        exp: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
        walletAddress: '0x1234567890123456789012345678901234567890',
        chainId: '1',
      };

      jest
        .spyOn(thirdwebTokenValidationService, 'validateToken')
        .mockResolvedValue({
          isValid: true,
          claims: validClaimsData,
        });

      const request = {
        token: 'mock-token',
        clientId: 'test-client-id',
      };

      const result = await useCase.execute(request);

      expect(result.isValid).toBe(false);
      expect(result.internalError).toContain('User account is inactive');
    });

    it('should handle successful validation flow', async () => {
      userRepository.findByThirdwebId.mockResolvedValue(mockUser);

      const validClaimsData = {
        iss: 'https://thirdweb.com',
        sub: 'user-123',
        aud: 'test-client-id',
        iat: new Date(Date.now() - 60 * 60 * 1000).toISOString(),
        exp: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
        walletAddress: '0x1234567890123456789012345678901234567890',
        chainId: '1',
      };

      jest
        .spyOn(thirdwebTokenValidationService, 'validateToken')
        .mockResolvedValue({
          isValid: true,
          claims: validClaimsData,
        });

      const request = {
        token: 'mock-token',
        clientId: 'test-client-id',
      };

      const result = await useCase.execute(request);

      expect(result.isValid).toBe(true);
      expect(result.user).toBeDefined();
      expect(result.user?.id).toBe(mockUser.id);
    });

    it('should handle unexpected errors', async () => {
      userRepository.findByThirdwebId.mockRejectedValue(
        new Error('Database connection failed'),
      );

      jest
        .spyOn(thirdwebTokenValidationService, 'validateToken')
        .mockResolvedValue({
          isValid: true,
          claims: {
            iss: 'https://thirdweb.com',
            sub: 'user-123',
            aud: 'test-client-id',
            iat: new Date(Date.now() - 60 * 60 * 1000).toISOString(),
            exp: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
            walletAddress: '0x1234567890123456789012345678901234567890',
            chainId: '1',
          },
        });

      const request = {
        token: 'mock-token',
        clientId: 'test-client-id',
      };

      const result = await useCase.execute(request);

      expect(result.isValid).toBe(false);
      expect(result.internalError).toContain('Database connection failed');
    });
  });
});

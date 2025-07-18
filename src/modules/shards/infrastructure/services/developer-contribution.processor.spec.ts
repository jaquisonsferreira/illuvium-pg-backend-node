import { Test, TestingModule } from '@nestjs/testing';
import { DeveloperContributionProcessor } from './developer-contribution.processor';
import { IDeveloperContributionRepository } from '../../domain/repositories/developer-contribution.repository.interface';
import {
  AntiFraudDomainService,
  FraudCheckResult,
} from '../../domain/services/anti-fraud.domain-service';
import { CacheService } from '@shared/services/cache.service';
import { BlockchainVerificationService } from './blockchain-verification.service';
import { GitHubVerificationService } from './github-verification.service';
import {
  DeveloperContributionEntity,
  DeveloperActionType,
} from '../../domain/entities/developer-contribution.entity';
import { SHARD_CACHE_KEYS, SHARD_CACHE_TTL } from '../../constants';

describe('DeveloperContributionProcessor', () => {
  let processor: DeveloperContributionProcessor;
  let repository: jest.Mocked<IDeveloperContributionRepository>;
  let antiFraudService: jest.Mocked<AntiFraudDomainService>;
  let cacheService: jest.Mocked<CacheService>;
  let blockchainVerificationService: jest.Mocked<BlockchainVerificationService>;
  let githubVerificationService: jest.Mocked<GitHubVerificationService>;

  const mockContribution = new DeveloperContributionEntity(
    '1',
    '0xwallet1234567890abcdef1234567890abcdef12',
    1,
    DeveloperActionType.SMART_CONTRACT_DEPLOY,
    {
      contractAddress: '0xcontract123',
      transactionHash: '0xtxhash123',
      deployerAddress: '0xwallet1234567890abcdef1234567890abcdef12',
      chainId: 1,
    } as any,
    100,
    false,
    null,
    null,
    null,
    new Date('2024-01-15'),
    new Date('2024-01-15'),
  );

  beforeEach(async () => {
    const mockRepository = {
      checkDuplicateContribution: jest.fn(),
      create: jest.fn(),
      findById: jest.fn(),
      update: jest.fn(),
      findVerifiedUndistributed: jest.fn(),
      findByWallet: jest.fn(),
    };

    const mockAntiFraudService = {
      checkWallet: jest.fn(),
    };

    const mockCacheService = {
      get: jest.fn(),
      set: jest.fn(),
    };

    const mockBlockchainVerificationService = {
      verifyContractDeployment: jest.fn(),
      checkContractVerification: jest.fn(),
    };

    const mockGithubVerificationService = {
      verifyContributionUrl: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      imports: [],
      providers: [
        DeveloperContributionProcessor,
        {
          provide: 'IDeveloperContributionRepository',
          useValue: mockRepository,
        },
        {
          provide: AntiFraudDomainService,
          useValue: mockAntiFraudService,
        },
        {
          provide: CacheService,
          useValue: mockCacheService,
        },
        {
          provide: BlockchainVerificationService,
          useValue: mockBlockchainVerificationService,
        },
        {
          provide: GitHubVerificationService,
          useValue: mockGithubVerificationService,
        },
      ],
    })
      .overrideProvider('IDeveloperContributionRepository')
      .useValue(mockRepository)
      .compile();

    processor = module.get<DeveloperContributionProcessor>(
      DeveloperContributionProcessor,
    );
    repository = module.get<jest.Mocked<IDeveloperContributionRepository>>(
      'IDeveloperContributionRepository',
    );
    antiFraudService = module.get<jest.Mocked<AntiFraudDomainService>>(
      AntiFraudDomainService,
    );
    cacheService = module.get<jest.Mocked<CacheService>>(CacheService);
    blockchainVerificationService = module.get<
      jest.Mocked<BlockchainVerificationService>
    >(BlockchainVerificationService);
    githubVerificationService = module.get<
      jest.Mocked<GitHubVerificationService>
    >(GitHubVerificationService);
  });

  describe('processContribution', () => {
    const validContext = {
      walletAddress: '0xWALLET1234567890ABCDEF1234567890ABCDEF12',
      actionType: DeveloperActionType.SMART_CONTRACT_DEPLOY,
      actionDetails: {
        contractAddress: '0xcontract123',
        transactionHash: '0xtxhash123',
        deployerAddress: '0xWALLET1234567890ABCDEF1234567890ABCDEF12',
        chainId: 1,
      } as Record<string, any>,
      seasonId: 1,
    };

    it('should process a valid contribution', async () => {
      repository.checkDuplicateContribution.mockResolvedValue(false);
      antiFraudService.checkWallet.mockResolvedValue({
        isSuspicious: false,
        reasons: [],
        score: 0,
        recommendations: [],
      } as FraudCheckResult);
      repository.findByWallet.mockResolvedValue([]);
      repository.create.mockResolvedValue(mockContribution);

      const result = await processor.processContribution(validContext);

      expect(repository.checkDuplicateContribution).toHaveBeenCalledWith(
        validContext.walletAddress,
        validContext.actionType,
        validContext.actionDetails,
        validContext.seasonId,
      );
      expect(antiFraudService.checkWallet).toHaveBeenCalledWith(
        validContext.walletAddress,
        0,
        validContext.seasonId,
      );
      expect(repository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          walletAddress: '0xwallet1234567890abcdef1234567890abcdef12', // lowercase
          actionType: validContext.actionType,
          seasonId: validContext.seasonId,
          shardsEarned: 150, // Base 100 + 50% first contribution bonus
        }),
      );
      expect(result).toBe(mockContribution);
    });

    it('should throw error for duplicate contribution', async () => {
      repository.checkDuplicateContribution.mockResolvedValue(true);

      await expect(processor.processContribution(validContext)).rejects.toThrow(
        'Duplicate contribution detected',
      );
    });

    it('should throw error for invalid action details', async () => {
      repository.checkDuplicateContribution.mockResolvedValue(false);

      const invalidContext = {
        ...validContext,
        actionDetails: { invalid: 'data' },
      };

      await expect(
        processor.processContribution(invalidContext),
      ).rejects.toThrow('Invalid action details');
    });

    it('should throw error for suspicious wallet', async () => {
      repository.checkDuplicateContribution.mockResolvedValue(false);
      antiFraudService.checkWallet.mockResolvedValue({
        isSuspicious: true,
        reasons: ['High risk score'],
        score: 75,
        recommendations: ['Manual review required'],
      } as FraudCheckResult);

      await expect(processor.processContribution(validContext)).rejects.toThrow(
        'Wallet flagged for suspicious activity',
      );
    });

    it('should apply diversity bonus for multiple action types', async () => {
      repository.checkDuplicateContribution.mockResolvedValue(false);
      antiFraudService.checkWallet.mockResolvedValue({
        isSuspicious: false,
        reasons: [],
        score: 0,
        recommendations: [],
      } as FraudCheckResult);

      const existingContributions = [
        new DeveloperContributionEntity(
          '2',
          mockContribution.walletAddress,
          mockContribution.seasonId,
          DeveloperActionType.GITHUB_CONTRIBUTION,
          {
            repositoryUrl: 'https://github.com/org/repo',
            pullRequestUrl: 'https://github.com/org/repo/pull/1',
          },
          50,
          true,
          new Date(),
          'admin',
          null,
          new Date(),
          new Date(),
        ),
        new DeveloperContributionEntity(
          '3',
          mockContribution.walletAddress,
          mockContribution.seasonId,
          DeveloperActionType.BUG_REPORT,
          {
            issueUrl: 'https://github.com/org/repo/issues/1',
            metadata: { severity: 'high' },
          },
          150,
          true,
          new Date(),
          'admin',
          null,
          new Date(),
          new Date(),
        ),
        new DeveloperContributionEntity(
          '4',
          mockContribution.walletAddress,
          mockContribution.seasonId,
          DeveloperActionType.DOCUMENTATION,
          {
            description: 'Tutorial documentation',
            metadata: {
              documentationUrl: 'https://docs.example.com',
              type: 'tutorial',
            },
          },
          75,
          true,
          new Date(),
          'admin',
          null,
          new Date(),
          new Date(),
        ),
      ];

      repository.findByWallet.mockResolvedValue(existingContributions);
      repository.create.mockResolvedValue(mockContribution);

      await processor.processContribution(validContext);

      expect(repository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          shardsEarned: 165, // Base 100 * 1.5 (first time) + 0.15 (diversity)
        }),
      );
    });

    it('should reduce reward for repeated contributions', async () => {
      repository.checkDuplicateContribution.mockResolvedValue(false);
      antiFraudService.checkWallet.mockResolvedValue({
        isSuspicious: false,
        reasons: [],
        score: 0,
        recommendations: [],
      } as FraudCheckResult);

      const existingContributions = Array(10)
        .fill(null)
        .map(
          (_, index) =>
            new DeveloperContributionEntity(
              `contrib-${index}`,
              mockContribution.walletAddress,
              mockContribution.seasonId,
              mockContribution.actionType,
              mockContribution.actionDetails,
              mockContribution.shardsEarned,
              true,
              new Date(),
              'admin',
              null,
              new Date(),
              new Date(),
            ),
        );

      repository.findByWallet.mockResolvedValue(existingContributions);
      repository.create.mockResolvedValue(mockContribution);

      await processor.processContribution(validContext);

      expect(repository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          shardsEarned: 50, // Base 100 * 0.5 (10+ contributions)
        }),
      );
    });
  });

  describe('verifyContribution', () => {
    it('should verify a valid smart contract deployment', async () => {
      repository.findById.mockResolvedValue(mockContribution);
      cacheService.get.mockResolvedValue(null);
      blockchainVerificationService.verifyContractDeployment.mockResolvedValue({
        contractAddress: '0xcontract123',
        deployerAddress: '0xwallet123',
        transactionHash: '0xtxhash123',
        blockNumber: 12345678,
        timestamp: 1642000000,
        verified: true,
      });

      const updatedContribution = new DeveloperContributionEntity(
        mockContribution.id,
        mockContribution.walletAddress,
        mockContribution.seasonId,
        mockContribution.actionType,
        mockContribution.actionDetails,
        mockContribution.shardsEarned,
        true,
        new Date(),
        'admin',
        null,
        mockContribution.createdAt,
        new Date(),
      );

      repository.update.mockResolvedValue(updatedContribution);
      cacheService.set.mockResolvedValue(undefined);

      const result = await processor.verifyContribution('1', 'admin');

      expect(repository.findById).toHaveBeenCalledWith('1');
      expect(
        blockchainVerificationService.verifyContractDeployment,
      ).toHaveBeenCalledWith(
        '0xcontract123',
        '0xwallet1234567890abcdef1234567890abcdef12',
        '0xtxhash123',
        'ethereum',
      );
      expect(cacheService.set).toHaveBeenCalledWith(
        `${SHARD_CACHE_KEYS.DEVELOPER_VERIFICATION}:1`,
        true,
        SHARD_CACHE_TTL.DEVELOPER_VERIFICATION,
      );
      expect(repository.update).toHaveBeenCalledWith(
        expect.objectContaining({
          verified: true,
          verifiedBy: 'admin',
        }),
      );
      expect(result).toEqual(updatedContribution);
    });

    it('should throw error for non-existent contribution', async () => {
      repository.findById.mockResolvedValue(null);

      await expect(
        processor.verifyContribution('999', 'admin'),
      ).rejects.toThrow('Contribution not found');
    });

    it('should throw error for already verified contribution', async () => {
      const verifiedContribution = new DeveloperContributionEntity(
        mockContribution.id,
        mockContribution.walletAddress,
        mockContribution.seasonId,
        mockContribution.actionType,
        mockContribution.actionDetails,
        mockContribution.shardsEarned,
        true,
        new Date(),
        'admin1',
        null,
        mockContribution.createdAt,
        new Date(),
      );
      repository.findById.mockResolvedValue(verifiedContribution);

      await expect(processor.verifyContribution('1', 'admin2')).rejects.toThrow(
        'Contribution already verified',
      );
    });

    it('should throw error when verification fails', async () => {
      const unverifiedContribution = new DeveloperContributionEntity(
        '1',
        mockContribution.walletAddress,
        mockContribution.seasonId,
        mockContribution.actionType,
        mockContribution.actionDetails,
        mockContribution.shardsEarned,
        false,
        null,
        null,
        null,
        mockContribution.createdAt,
        mockContribution.updatedAt,
      );

      repository.findById.mockResolvedValue(unverifiedContribution);
      cacheService.get.mockResolvedValue(null);
      blockchainVerificationService.verifyContractDeployment.mockResolvedValue(
        null,
      );

      await expect(processor.verifyContribution('1', 'admin')).rejects.toThrow(
        'Contribution verification failed',
      );
    });

    it('should verify a GitHub contribution', async () => {
      const githubContribution = new DeveloperContributionEntity(
        mockContribution.id,
        mockContribution.walletAddress,
        mockContribution.seasonId,
        DeveloperActionType.GITHUB_CONTRIBUTION,
        {
          githubUrl: 'https://github.com/org/repo/pull/123',
          authorEmail: 'dev@example.com',
        } as Record<string, any>,
        mockContribution.shardsEarned,
        false,
        null,
        null,
        null,
        mockContribution.createdAt,
        mockContribution.updatedAt,
      );

      repository.findById.mockResolvedValue(githubContribution);
      cacheService.get.mockResolvedValue(null);
      githubVerificationService.verifyContributionUrl.mockResolvedValue({
        type: 'pull_request',
        id: '123',
        author: 'developer',
        authorEmail: 'dev@example.com',
        repository: 'org/repo',
        title: 'Fix bug in authentication',
        status: 'merged',
        mergedAt: new Date('2024-01-10'),
        createdAt: new Date('2024-01-09'),
        url: 'https://github.com/org/repo/pull/123',
      });

      repository.update.mockResolvedValue(
        new DeveloperContributionEntity(
          githubContribution.id,
          githubContribution.walletAddress,
          githubContribution.seasonId,
          githubContribution.actionType,
          githubContribution.actionDetails,
          githubContribution.shardsEarned,
          true,
          new Date(),
          'admin',
          null,
          githubContribution.createdAt,
          new Date(),
        ),
      );

      const result = await processor.verifyContribution('1', 'admin');

      expect(
        githubVerificationService.verifyContributionUrl,
      ).toHaveBeenCalledWith('https://github.com/org/repo/pull/123');
      expect(result.verified).toBe(true);
    });

    it('should use cached verification result', async () => {
      const unverifiedContribution = new DeveloperContributionEntity(
        '1',
        mockContribution.walletAddress,
        mockContribution.seasonId,
        mockContribution.actionType,
        mockContribution.actionDetails,
        mockContribution.shardsEarned,
        false,
        null,
        null,
        null,
        mockContribution.createdAt,
        mockContribution.updatedAt,
      );

      repository.findById.mockResolvedValue(unverifiedContribution);
      cacheService.get.mockResolvedValue(true);

      repository.update.mockResolvedValue(
        new DeveloperContributionEntity(
          unverifiedContribution.id,
          unverifiedContribution.walletAddress,
          unverifiedContribution.seasonId,
          unverifiedContribution.actionType,
          unverifiedContribution.actionDetails,
          unverifiedContribution.shardsEarned,
          true,
          new Date(),
          'admin',
          null,
          unverifiedContribution.createdAt,
          new Date(),
        ),
      );

      await processor.verifyContribution('1', 'admin');

      expect(
        blockchainVerificationService.verifyContractDeployment,
      ).not.toHaveBeenCalled();
      expect(cacheService.set).not.toHaveBeenCalled();
    });
  });

  describe('distributeRewards', () => {
    it('should distribute rewards for verified contributions', async () => {
      const undistributedContributions = [
        new DeveloperContributionEntity(
          '1',
          mockContribution.walletAddress,
          mockContribution.seasonId,
          mockContribution.actionType,
          mockContribution.actionDetails,
          mockContribution.shardsEarned,
          true,
          new Date(),
          'admin',
          null,
          new Date(),
          new Date(),
        ),
        new DeveloperContributionEntity(
          '2',
          mockContribution.walletAddress,
          mockContribution.seasonId,
          mockContribution.actionType,
          mockContribution.actionDetails,
          mockContribution.shardsEarned,
          true,
          new Date(),
          'admin',
          null,
          new Date(),
          new Date(),
        ),
        new DeveloperContributionEntity(
          '3',
          mockContribution.walletAddress,
          mockContribution.seasonId,
          mockContribution.actionType,
          mockContribution.actionDetails,
          mockContribution.shardsEarned,
          true,
          new Date(),
          'admin',
          null,
          new Date(),
          new Date(),
        ),
      ];

      repository.findVerifiedUndistributed.mockResolvedValue(
        undistributedContributions,
      );
      repository.update.mockResolvedValue(mockContribution);

      const result = await processor.distributeRewards(1);

      expect(repository.findVerifiedUndistributed).toHaveBeenCalledWith(1);
      expect(repository.update).toHaveBeenCalledTimes(3);
      expect(repository.update).toHaveBeenCalledWith(
        expect.objectContaining({
          distributedAt: expect.any(Date),
        }),
      );
      expect(result).toBe(3);
    });

    it('should return 0 when no undistributed contributions', async () => {
      repository.findVerifiedUndistributed.mockResolvedValue([]);

      const result = await processor.distributeRewards(1);

      expect(result).toBe(0);
      expect(repository.update).not.toHaveBeenCalled();
    });

    it('should handle errors and continue distribution', async () => {
      const undistributedContributions = [
        new DeveloperContributionEntity(
          '1',
          mockContribution.walletAddress,
          mockContribution.seasonId,
          mockContribution.actionType,
          mockContribution.actionDetails,
          mockContribution.shardsEarned,
          true,
          new Date(),
          'admin',
          null,
          new Date(),
          new Date(),
        ),
        new DeveloperContributionEntity(
          '2',
          mockContribution.walletAddress,
          mockContribution.seasonId,
          mockContribution.actionType,
          mockContribution.actionDetails,
          mockContribution.shardsEarned,
          true,
          new Date(),
          'admin',
          null,
          new Date(),
          new Date(),
        ),
        new DeveloperContributionEntity(
          '3',
          mockContribution.walletAddress,
          mockContribution.seasonId,
          mockContribution.actionType,
          mockContribution.actionDetails,
          mockContribution.shardsEarned,
          true,
          new Date(),
          'admin',
          null,
          new Date(),
          new Date(),
        ),
      ];

      repository.findVerifiedUndistributed.mockResolvedValue(
        undistributedContributions,
      );
      repository.update
        .mockResolvedValueOnce(mockContribution)
        .mockRejectedValueOnce(new Error('Update failed'))
        .mockResolvedValueOnce(mockContribution);

      const result = await processor.distributeRewards(1);

      expect(repository.update).toHaveBeenCalledTimes(3);
      expect(result).toBe(2); // Only 2 successful distributions
    });
  });

  describe('getContributionStats', () => {
    it('should calculate contribution statistics', async () => {
      const contributions = [
        new DeveloperContributionEntity(
          '1',
          mockContribution.walletAddress,
          mockContribution.seasonId,
          DeveloperActionType.SMART_CONTRACT_DEPLOY,
          mockContribution.actionDetails,
          100,
          true,
          new Date(),
          'admin',
          new Date(),
          new Date(),
          new Date(),
        ),
        new DeveloperContributionEntity(
          '2',
          mockContribution.walletAddress,
          mockContribution.seasonId,
          DeveloperActionType.GITHUB_CONTRIBUTION,
          {
            repositoryUrl: 'https://github.com/org/repo',
            pullRequestUrl: 'https://github.com/org/repo/pull/1',
          },
          50,
          true,
          new Date(),
          'admin',
          new Date(),
          new Date(),
          new Date(),
        ),
        new DeveloperContributionEntity(
          '3',
          mockContribution.walletAddress,
          mockContribution.seasonId,
          DeveloperActionType.BUG_REPORT,
          {
            issueUrl: 'https://github.com/org/repo/issues/1',
            metadata: { severity: 'high' },
          },
          150,
          false,
          null,
          null,
          null,
          new Date(),
          new Date(),
        ),
      ];

      repository.findByWallet.mockResolvedValue(contributions);

      const result = await processor.getContributionStats(
        '0xwallet1234567890abcdef1234567890abcdef12',
        1,
      );

      expect(result.totalContributions).toBe(3);
      expect(result.verifiedContributions).toBe(2);
      expect(result.totalShardsEarned).toBe(150); // Only verified and distributed
      expect(
        result.contributionsByType[DeveloperActionType.SMART_CONTRACT_DEPLOY],
      ).toBe(1);
      expect(
        result.contributionsByType[DeveloperActionType.GITHUB_CONTRIBUTION],
      ).toBe(1);
      expect(result.contributionsByType[DeveloperActionType.BUG_REPORT]).toBe(
        1,
      );
      expect(result.lastContributionDate).toEqual(contributions[0].createdAt);
    });

    it('should handle empty contributions', async () => {
      repository.findByWallet.mockResolvedValue([]);

      const result = await processor.getContributionStats('0xwallet', 1);

      expect(result.totalContributions).toBe(0);
      expect(result.verifiedContributions).toBe(0);
      expect(result.totalShardsEarned).toBe(0);
      expect(result.lastContributionDate).toBeNull();
    });
  });

  describe('validation methods', () => {
    it('should validate smart contract deploy details', async () => {
      repository.checkDuplicateContribution.mockResolvedValue(false);
      antiFraudService.checkWallet.mockResolvedValue({
        isSuspicious: false,
        reasons: [],
        score: 0,
        recommendations: [],
      } as FraudCheckResult);
      repository.findByWallet.mockResolvedValue([]);
      repository.create.mockResolvedValue(mockContribution);

      const validDetails = {
        contractAddress: '0xcontract',
        transactionHash: '0xtxhash',
        chainId: 1,
      };

      await processor.processContribution({
        walletAddress: '0xwallet',
        actionType: DeveloperActionType.SMART_CONTRACT_DEPLOY,
        actionDetails: validDetails,
        seasonId: 1,
      });

      expect(repository.create).toHaveBeenCalled();
    });

    it('should validate GitHub contribution details', async () => {
      repository.checkDuplicateContribution.mockResolvedValue(false);
      antiFraudService.checkWallet.mockResolvedValue({
        isSuspicious: false,
        reasons: [],
        score: 0,
        recommendations: [],
      } as FraudCheckResult);
      repository.findByWallet.mockResolvedValue([]);
      repository.create.mockResolvedValue(mockContribution);

      const validDetails = {
        repositoryUrl: 'https://github.com/org/repo',
        pullRequestUrl: 'https://github.com/org/repo/pull/123',
      };

      await processor.processContribution({
        walletAddress: '0xwallet',
        actionType: DeveloperActionType.GITHUB_CONTRIBUTION,
        actionDetails: validDetails,
        seasonId: 1,
      });

      expect(repository.create).toHaveBeenCalled();
    });

    it('should validate bug report details', async () => {
      repository.checkDuplicateContribution.mockResolvedValue(false);
      antiFraudService.checkWallet.mockResolvedValue({
        isSuspicious: false,
        reasons: [],
        score: 0,
        recommendations: [],
      } as FraudCheckResult);
      repository.findByWallet.mockResolvedValue([]);
      repository.create.mockResolvedValue(mockContribution);

      const validDetails = {
        issueUrl: 'https://github.com/org/repo/issues/123',
        severity: 'high',
      };

      await processor.processContribution({
        walletAddress: '0xwallet',
        actionType: DeveloperActionType.BUG_REPORT,
        actionDetails: validDetails,
        seasonId: 1,
      });

      expect(repository.create).toHaveBeenCalled();
    });

    it('should validate documentation details', async () => {
      repository.checkDuplicateContribution.mockResolvedValue(false);
      antiFraudService.checkWallet.mockResolvedValue({
        isSuspicious: false,
        reasons: [],
        score: 0,
        recommendations: [],
      } as FraudCheckResult);
      repository.findByWallet.mockResolvedValue([]);
      repository.create.mockResolvedValue(mockContribution);

      const validDetails = {
        documentationUrl: 'https://docs.example.com/guide',
        type: 'tutorial',
      };

      await processor.processContribution({
        walletAddress: '0xwallet',
        actionType: DeveloperActionType.DOCUMENTATION,
        actionDetails: validDetails,
        seasonId: 1,
      });

      expect(repository.create).toHaveBeenCalled();
    });

    it('should validate tool development details', async () => {
      repository.checkDuplicateContribution.mockResolvedValue(false);
      antiFraudService.checkWallet.mockResolvedValue({
        isSuspicious: false,
        reasons: [],
        score: 0,
        recommendations: [],
      } as FraudCheckResult);
      repository.findByWallet.mockResolvedValue([]);
      repository.create.mockResolvedValue(mockContribution);

      const validDetails = {
        toolUrl: 'https://github.com/org/tool',
        description: 'A useful development tool',
        category: 'development',
      };

      await processor.processContribution({
        walletAddress: '0xwallet',
        actionType: DeveloperActionType.TOOL_DEVELOPMENT,
        actionDetails: validDetails,
        seasonId: 1,
      });

      expect(repository.create).toHaveBeenCalled();
    });

    it('should validate community support details', async () => {
      repository.checkDuplicateContribution.mockResolvedValue(false);
      antiFraudService.checkWallet.mockResolvedValue({
        isSuspicious: false,
        reasons: [],
        score: 0,
        recommendations: [],
      } as FraudCheckResult);
      repository.findByWallet.mockResolvedValue([]);
      repository.create.mockResolvedValue(mockContribution);

      const validDetails = {
        supportUrl: 'https://discord.com/channels/123/456',
        platform: 'discord',
      };

      await processor.processContribution({
        walletAddress: '0xwallet',
        actionType: DeveloperActionType.COMMUNITY_SUPPORT,
        actionDetails: validDetails,
        seasonId: 1,
      });

      expect(repository.create).toHaveBeenCalled();
    });
  });

  describe('chain name mapping', () => {
    it('should verify contract on supported chains', async () => {
      const contribution = new DeveloperContributionEntity(
        mockContribution.id,
        mockContribution.walletAddress,
        mockContribution.seasonId,
        mockContribution.actionType,
        {
          contractAddress: '0xcontract',
          transactionHash: '0xtxhash',
          deployerAddress: '0xwallet',
          chainId: 8453, // Base
        } as Record<string, any>,
        mockContribution.shardsEarned,
        false,
        null,
        null,
        null,
        mockContribution.createdAt,
        mockContribution.updatedAt,
      );

      repository.findById.mockResolvedValue(contribution);
      cacheService.get.mockResolvedValue(null);
      blockchainVerificationService.verifyContractDeployment.mockResolvedValue({
        contractAddress: '0xcontract',
        deployerAddress: '0xwallet',
        transactionHash: '0xtxhash',
        blockNumber: 12345678,
        timestamp: 1642000000,
        verified: true,
      });

      repository.update.mockResolvedValue(
        new DeveloperContributionEntity(
          contribution.id,
          contribution.walletAddress,
          contribution.seasonId,
          contribution.actionType,
          contribution.actionDetails,
          contribution.shardsEarned,
          true,
          new Date(),
          'admin',
          null,
          contribution.createdAt,
          new Date(),
        ),
      );

      await processor.verifyContribution('1', 'admin');

      expect(
        blockchainVerificationService.verifyContractDeployment,
      ).toHaveBeenCalledWith('0xcontract', '0xwallet', '0xtxhash', 'base');
    });

    it('should fail verification for unsupported chain', async () => {
      const contribution = new DeveloperContributionEntity(
        mockContribution.id,
        mockContribution.walletAddress,
        mockContribution.seasonId,
        mockContribution.actionType,
        {
          contractAddress: '0xcontract',
          transactionHash: '0xtxhash',
          deployerAddress: '0xwallet',
          chainId: 999, // Unsupported
        } as Record<string, any>,
        mockContribution.shardsEarned,
        false,
        null,
        null,
        null,
        mockContribution.createdAt,
        mockContribution.updatedAt,
      );

      repository.findById.mockResolvedValue(contribution);
      cacheService.get.mockResolvedValue(null);

      await expect(processor.verifyContribution('1', 'admin')).rejects.toThrow(
        'Contribution verification failed',
      );
    });
  });
});

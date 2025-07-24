import {
  DeveloperContributionEntity,
  DeveloperActionType,
  DeveloperActionDetails,
} from './developer-contribution.entity';

describe('DeveloperContributionEntity', () => {
  const validWallet = '0x1234567890abcdef1234567890abcdef12345678';
  const mockActionDetails: DeveloperActionDetails = {
    contractAddress: '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
    transactionHash:
      '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef',
    description: 'Deployed new staking contract',
  };

  describe('create', () => {
    it('should create a new developer contribution', () => {
      const params = {
        walletAddress: validWallet,
        seasonId: 1,
        actionType: DeveloperActionType.SMART_CONTRACT_DEPLOY,
        actionDetails: mockActionDetails,
        shardsEarned: 100,
      };

      const contribution = DeveloperContributionEntity.create(params);

      expect(contribution.id).toBeDefined();
      expect(contribution.walletAddress).toBe(validWallet.toLowerCase());
      expect(contribution.seasonId).toBe(1);
      expect(contribution.actionType).toBe(
        DeveloperActionType.SMART_CONTRACT_DEPLOY,
      );
      expect(contribution.actionDetails).toEqual(mockActionDetails);
      expect(contribution.shardsEarned).toBe(100);
      expect(contribution.verified).toBe(false);
      expect(contribution.verifiedAt).toBeNull();
      expect(contribution.verifiedBy).toBeNull();
      expect(contribution.distributedAt).toBeNull();
      expect(contribution.createdAt).toBeInstanceOf(Date);
      expect(contribution.updatedAt).toBeInstanceOf(Date);
    });

    it('should convert wallet address to lowercase', () => {
      const params = {
        walletAddress: validWallet.toUpperCase(),
        seasonId: 1,
        actionType: DeveloperActionType.GITHUB_CONTRIBUTION,
        actionDetails: {},
        shardsEarned: 50,
      };

      const contribution = DeveloperContributionEntity.create(params);

      expect(contribution.walletAddress).toBe(validWallet.toLowerCase());
    });

    it('should throw error when shards earned is negative', () => {
      const params = {
        walletAddress: validWallet,
        seasonId: 1,
        actionType: DeveloperActionType.BUG_REPORT,
        actionDetails: {},
        shardsEarned: -10,
      };

      expect(() => DeveloperContributionEntity.create(params)).toThrow(
        'Shards earned cannot be negative',
      );
    });

    it('should create contribution with zero shards', () => {
      const params = {
        walletAddress: validWallet,
        seasonId: 1,
        actionType: DeveloperActionType.DOCUMENTATION,
        actionDetails: {},
        shardsEarned: 0,
      };

      const contribution = DeveloperContributionEntity.create(params);

      expect(contribution.shardsEarned).toBe(0);
    });
  });

  describe('verify', () => {
    let contribution: DeveloperContributionEntity;

    beforeEach(() => {
      contribution = DeveloperContributionEntity.create({
        walletAddress: validWallet,
        seasonId: 1,
        actionType: DeveloperActionType.CONTRIBUTE_CODE,
        actionDetails: {},
        shardsEarned: 75,
      });
    });

    it('should verify contribution', () => {
      const verifier = 'admin123';
      const verified = contribution.verify(verifier);

      expect(verified.verified).toBe(true);
      expect(verified.verifiedAt).toBeInstanceOf(Date);
      expect(verified.verifiedBy).toBe(verifier);
      expect(verified.updatedAt).toBeInstanceOf(Date);
    });

    it('should throw error when already verified', () => {
      const verifier = 'admin123';
      const verified = contribution.verify(verifier);

      expect(() => verified.verify('another-admin')).toThrow(
        'Contribution is already verified',
      );
    });
  });

  describe('markAsDistributed', () => {
    let contribution: DeveloperContributionEntity;

    beforeEach(() => {
      contribution = DeveloperContributionEntity.create({
        walletAddress: validWallet,
        seasonId: 1,
        actionType: DeveloperActionType.FIX_BUG,
        actionDetails: {},
        shardsEarned: 50,
      });
    });

    it('should mark verified contribution as distributed', () => {
      const verified = contribution.verify('admin123');
      const distributed = verified.markAsDistributed();

      expect(distributed.distributedAt).toBeInstanceOf(Date);
      expect(distributed.updatedAt).toBeInstanceOf(Date);
    });

    it('should throw error when not verified', () => {
      expect(() => contribution.markAsDistributed()).toThrow(
        'Cannot distribute unverified contribution',
      );
    });

    it('should throw error when already distributed', () => {
      const verified = contribution.verify('admin123');
      const distributed = verified.markAsDistributed();

      expect(() => distributed.markAsDistributed()).toThrow(
        'Contribution is already distributed',
      );
    });
  });

  describe('status methods', () => {
    it('should correctly identify pending contribution', () => {
      const contribution = DeveloperContributionEntity.create({
        walletAddress: validWallet,
        seasonId: 1,
        actionType: DeveloperActionType.DEPLOY_DAPP,
        actionDetails: {},
        shardsEarned: 200,
      });

      expect(contribution.isPending()).toBe(true);
      expect(contribution.isVerified()).toBe(false);
      expect(contribution.isDistributed()).toBe(false);
    });

    it('should correctly identify verified contribution', () => {
      const contribution = DeveloperContributionEntity.create({
        walletAddress: validWallet,
        seasonId: 1,
        actionType: DeveloperActionType.COMPLETE_BOUNTY,
        actionDetails: {},
        shardsEarned: 150,
      });
      const verified = contribution.verify('admin123');

      expect(verified.isPending()).toBe(false);
      expect(verified.isVerified()).toBe(true);
      expect(verified.isDistributed()).toBe(false);
    });

    it('should correctly identify distributed contribution', () => {
      const contribution = DeveloperContributionEntity.create({
        walletAddress: validWallet,
        seasonId: 1,
        actionType: DeveloperActionType.CREATE_DOCUMENTATION,
        actionDetails: {},
        shardsEarned: 80,
      });
      const verified = contribution.verify('admin123');
      const distributed = verified.markAsDistributed();

      expect(distributed.isPending()).toBe(false);
      expect(distributed.isVerified()).toBe(true);
      expect(distributed.isDistributed()).toBe(true);
    });
  });

  describe('getActionTypeDisplayName', () => {
    it('should return correct display names for all action types', () => {
      const testCases = [
        {
          type: DeveloperActionType.SMART_CONTRACT_DEPLOY,
          expected: 'Deploy Smart Contract',
        },
        {
          type: DeveloperActionType.VERIFIED_CONTRACT,
          expected: 'Verified Contract',
        },
        {
          type: DeveloperActionType.GITHUB_CONTRIBUTION,
          expected: 'GitHub Contribution',
        },
        { type: DeveloperActionType.BUG_REPORT, expected: 'Bug Report' },
        { type: DeveloperActionType.DOCUMENTATION, expected: 'Documentation' },
        {
          type: DeveloperActionType.TOOL_DEVELOPMENT,
          expected: 'Tool Development',
        },
        {
          type: DeveloperActionType.COMMUNITY_SUPPORT,
          expected: 'Community Support',
        },
        {
          type: DeveloperActionType.DEPLOY_CONTRACT,
          expected: 'Deploy Smart Contract',
        },
        { type: DeveloperActionType.DEPLOY_DAPP, expected: 'Deploy DApp' },
        {
          type: DeveloperActionType.CONTRIBUTE_CODE,
          expected: 'Code Contribution',
        },
        { type: DeveloperActionType.FIX_BUG, expected: 'Bug Fix' },
        {
          type: DeveloperActionType.COMPLETE_BOUNTY,
          expected: 'Complete Bounty',
        },
        {
          type: DeveloperActionType.CREATE_DOCUMENTATION,
          expected: 'Create Documentation',
        },
        { type: DeveloperActionType.OTHER, expected: 'Other Contribution' },
      ];

      testCases.forEach(({ type, expected }) => {
        const contribution = DeveloperContributionEntity.create({
          walletAddress: validWallet,
          seasonId: 1,
          actionType: type,
          actionDetails: {},
          shardsEarned: 10,
        });

        expect(contribution.getActionTypeDisplayName()).toBe(expected);
      });
    });
  });

  describe('toJSON', () => {
    it('should serialize pending contribution correctly', () => {
      const contribution = DeveloperContributionEntity.create({
        walletAddress: validWallet,
        seasonId: 1,
        actionType: DeveloperActionType.GITHUB_CONTRIBUTION,
        actionDetails: mockActionDetails,
        shardsEarned: 100,
      });

      const json = contribution.toJSON();

      expect(json).toMatchObject({
        id: contribution.id,
        walletAddress: validWallet.toLowerCase(),
        seasonId: 1,
        actionType: DeveloperActionType.GITHUB_CONTRIBUTION,
        actionTypeDisplay: 'GitHub Contribution',
        actionDetails: mockActionDetails,
        shardsEarned: 100,
        verified: false,
        verifiedAt: null,
        verifiedBy: null,
        distributedAt: null,
        status: 'pending',
        createdAt: contribution.createdAt,
        updatedAt: contribution.updatedAt,
      });
    });

    it('should serialize verified contribution correctly', () => {
      const contribution = DeveloperContributionEntity.create({
        walletAddress: validWallet,
        seasonId: 1,
        actionType: DeveloperActionType.BUG_REPORT,
        actionDetails: {},
        shardsEarned: 50,
      });
      const verified = contribution.verify('admin123');

      const json = verified.toJSON();

      expect(json.status).toBe('verified');
      expect(json.verified).toBe(true);
      expect(json.verifiedAt).toBeInstanceOf(Date);
      expect(json.verifiedBy).toBe('admin123');
    });

    it('should serialize distributed contribution correctly', () => {
      const contribution = DeveloperContributionEntity.create({
        walletAddress: validWallet,
        seasonId: 1,
        actionType: DeveloperActionType.COMPLETE_BOUNTY,
        actionDetails: {},
        shardsEarned: 150,
      });
      const verified = contribution.verify('admin123');
      const distributed = verified.markAsDistributed();

      const json = distributed.toJSON();

      expect(json.status).toBe('distributed');
      expect(json.verified).toBe(true);
      expect(json.distributedAt).toBeInstanceOf(Date);
    });
  });
});

import { randomUUID } from 'crypto';

export enum DeveloperActionType {
  SMART_CONTRACT_DEPLOY = 'SMART_CONTRACT_DEPLOY',
  VERIFIED_CONTRACT = 'VERIFIED_CONTRACT',
  GITHUB_CONTRIBUTION = 'GITHUB_CONTRIBUTION',
  BUG_REPORT = 'BUG_REPORT',
  DOCUMENTATION = 'DOCUMENTATION',
  TOOL_DEVELOPMENT = 'TOOL_DEVELOPMENT',
  COMMUNITY_SUPPORT = 'COMMUNITY_SUPPORT',
  DEPLOY_CONTRACT = 'DEPLOY_CONTRACT',
  DEPLOY_DAPP = 'DEPLOY_DAPP',
  CONTRIBUTE_CODE = 'CONTRIBUTE_CODE',
  FIX_BUG = 'FIX_BUG',
  COMPLETE_BOUNTY = 'COMPLETE_BOUNTY',
  CREATE_DOCUMENTATION = 'CREATE_DOCUMENTATION',
  OTHER = 'OTHER',
}

export interface DeveloperActionDetails {
  operationId?: string;
  contractAddress?: string;
  transactionHash?: string;
  repositoryUrl?: string;
  pullRequestUrl?: string;
  issueUrl?: string;
  description?: string;
  metadata?: Record<string, any>;
}

export class DeveloperContributionEntity {
  constructor(
    public readonly id: string,
    public readonly walletAddress: string,
    public readonly seasonId: number,
    public readonly actionType: DeveloperActionType,
    public readonly actionDetails: DeveloperActionDetails,
    public readonly shardsEarned: number,
    public verified: boolean,
    public verifiedAt: Date | null,
    public verifiedBy: string | null,
    public distributedAt: Date | null,
    public readonly createdAt: Date,
    public readonly updatedAt: Date,
  ) {}

  static create(params: {
    walletAddress: string;
    seasonId: number;
    actionType: DeveloperActionType;
    actionDetails: DeveloperActionDetails;
    shardsEarned: number;
  }): DeveloperContributionEntity {
    if (params.shardsEarned < 0) {
      throw new Error('Shards earned cannot be negative');
    }

    return new DeveloperContributionEntity(
      randomUUID(),
      params.walletAddress.toLowerCase(),
      params.seasonId,
      params.actionType,
      params.actionDetails,
      params.shardsEarned,
      false, // Not verified by default
      null,
      null,
      null,
      new Date(),
      new Date(),
    );
  }

  verify(verifiedBy: string): DeveloperContributionEntity {
    if (this.verified) {
      throw new Error('Contribution is already verified');
    }

    return new DeveloperContributionEntity(
      this.id,
      this.walletAddress,
      this.seasonId,
      this.actionType,
      this.actionDetails,
      this.shardsEarned,
      true,
      new Date(),
      verifiedBy,
      this.distributedAt,
      this.createdAt,
      new Date(),
    );
  }

  markAsDistributed(): DeveloperContributionEntity {
    if (!this.verified) {
      throw new Error('Cannot distribute unverified contribution');
    }

    if (this.distributedAt) {
      throw new Error('Contribution is already distributed');
    }

    return new DeveloperContributionEntity(
      this.id,
      this.walletAddress,
      this.seasonId,
      this.actionType,
      this.actionDetails,
      this.shardsEarned,
      this.verified,
      this.verifiedAt,
      this.verifiedBy,
      new Date(),
      this.createdAt,
      new Date(),
    );
  }

  isVerified(): boolean {
    return this.verified;
  }

  isDistributed(): boolean {
    return this.distributedAt !== null;
  }

  isPending(): boolean {
    return !this.verified && !this.distributedAt;
  }

  getActionTypeDisplayName(): string {
    const displayNames: Record<DeveloperActionType, string> = {
      [DeveloperActionType.SMART_CONTRACT_DEPLOY]: 'Deploy Smart Contract',
      [DeveloperActionType.VERIFIED_CONTRACT]: 'Verified Contract',
      [DeveloperActionType.GITHUB_CONTRIBUTION]: 'GitHub Contribution',
      [DeveloperActionType.BUG_REPORT]: 'Bug Report',
      [DeveloperActionType.DOCUMENTATION]: 'Documentation',
      [DeveloperActionType.TOOL_DEVELOPMENT]: 'Tool Development',
      [DeveloperActionType.COMMUNITY_SUPPORT]: 'Community Support',
      [DeveloperActionType.DEPLOY_CONTRACT]: 'Deploy Smart Contract',
      [DeveloperActionType.DEPLOY_DAPP]: 'Deploy DApp',
      [DeveloperActionType.CONTRIBUTE_CODE]: 'Code Contribution',
      [DeveloperActionType.FIX_BUG]: 'Bug Fix',
      [DeveloperActionType.COMPLETE_BOUNTY]: 'Complete Bounty',
      [DeveloperActionType.CREATE_DOCUMENTATION]: 'Create Documentation',
      [DeveloperActionType.OTHER]: 'Other Contribution',
    };

    return displayNames[this.actionType] || this.actionType;
  }

  toJSON() {
    return {
      id: this.id,
      walletAddress: this.walletAddress,
      seasonId: this.seasonId,
      actionType: this.actionType,
      actionTypeDisplay: this.getActionTypeDisplayName(),
      actionDetails: this.actionDetails,
      shardsEarned: this.shardsEarned,
      verified: this.verified,
      verifiedAt: this.verifiedAt,
      verifiedBy: this.verifiedBy,
      distributedAt: this.distributedAt,
      status: this.isPending()
        ? 'pending'
        : this.isDistributed()
          ? 'distributed'
          : 'verified',
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
    };
  }
}

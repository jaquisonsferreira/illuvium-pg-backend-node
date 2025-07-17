import { Injectable, Logger } from '@nestjs/common';
import { v4 as uuidv4 } from 'uuid';
import { IDeveloperContributionRepository } from '../../domain/repositories/developer-contribution.repository.interface';
import { AntiFraudDomainService } from '../../domain/services/anti-fraud.domain-service';
import {
  DeveloperContributionEntity,
  DeveloperActionType,
} from '../../domain/entities/developer-contribution.entity';
import { CacheService } from '@shared/services/cache.service';
import { SHARD_CACHE_KEYS, SHARD_CACHE_TTL } from '../../constants';
import { BlockchainVerificationService } from './blockchain-verification.service';
import { GitHubVerificationService } from './github-verification.service';

interface DeveloperActionContext {
  walletAddress: string;
  actionType: DeveloperActionType;
  actionDetails: Record<string, any>;
  seasonId: number;
}

@Injectable()
export class DeveloperContributionProcessor {
  private readonly logger = new Logger(DeveloperContributionProcessor.name);

  private readonly actionRewards: Record<DeveloperActionType, number> = {
    [DeveloperActionType.SMART_CONTRACT_DEPLOY]: 100,
    [DeveloperActionType.VERIFIED_CONTRACT]: 200,
    [DeveloperActionType.GITHUB_CONTRIBUTION]: 50,
    [DeveloperActionType.BUG_REPORT]: 150,
    [DeveloperActionType.DOCUMENTATION]: 75,
    [DeveloperActionType.TOOL_DEVELOPMENT]: 300,
    [DeveloperActionType.COMMUNITY_SUPPORT]: 25,
    [DeveloperActionType.DEPLOY_CONTRACT]: 500,
    [DeveloperActionType.DEPLOY_DAPP]: 500,
    [DeveloperActionType.CONTRIBUTE_CODE]: 100,
    [DeveloperActionType.FIX_BUG]: 200,
    [DeveloperActionType.COMPLETE_BOUNTY]: 300,
    [DeveloperActionType.CREATE_DOCUMENTATION]: 75,
    [DeveloperActionType.OTHER]: 50,
  };

  constructor(
    private readonly developerContributionRepository: IDeveloperContributionRepository,
    private readonly antiFraudService: AntiFraudDomainService,
    private readonly cacheService: CacheService,
    private readonly blockchainVerificationService: BlockchainVerificationService,
    private readonly githubVerificationService: GitHubVerificationService,
  ) {}

  async processContribution(
    context: DeveloperActionContext,
  ): Promise<DeveloperContributionEntity> {
    const { walletAddress, actionType, actionDetails, seasonId } = context;

    const isDuplicate =
      await this.developerContributionRepository.checkDuplicateContribution(
        walletAddress,
        actionType,
        actionDetails,
        seasonId,
      );

    if (isDuplicate) {
      throw new Error('Duplicate contribution detected');
    }

    const isValidAction = await this.validateAction(actionType, actionDetails);
    if (!isValidAction) {
      throw new Error('Invalid action details');
    }

    const fraudCheckResult = await this.antiFraudService.checkWallet(
      walletAddress,
      0,
      seasonId,
    );
    if (fraudCheckResult.isSuspicious) {
      this.logger.warn(
        `Wallet ${walletAddress} flagged for fraud: ${fraudCheckResult.reasons.join(', ')}`,
      );
      throw new Error('Wallet flagged for suspicious activity');
    }

    const baseReward = this.actionRewards[actionType] || 0;
    const adjustedReward = await this.calculateAdjustedReward(
      walletAddress,
      actionType,
      baseReward,
      seasonId,
    );

    const contribution = new DeveloperContributionEntity(
      uuidv4(),
      walletAddress.toLowerCase(),
      seasonId,
      actionType,
      actionDetails,
      adjustedReward,
      false,
      null,
      null,
      null,
      new Date(),
      new Date(),
    );

    return this.developerContributionRepository.create(contribution);
  }

  async verifyContribution(
    contributionId: string,
    verifiedBy: string,
  ): Promise<DeveloperContributionEntity> {
    const contribution =
      await this.developerContributionRepository.findById(contributionId);

    if (!contribution) {
      throw new Error('Contribution not found');
    }

    if (contribution.verified) {
      throw new Error('Contribution already verified');
    }

    const isValid = await this.performVerification(contribution);

    if (!isValid) {
      throw new Error('Contribution verification failed');
    }

    contribution.verified = true;
    contribution.verifiedAt = new Date();
    contribution.verifiedBy = verifiedBy;

    return this.developerContributionRepository.update(contribution);
  }

  async distributeRewards(seasonId: number): Promise<number> {
    const undistributed =
      await this.developerContributionRepository.findVerifiedUndistributed(
        seasonId,
      );

    if (undistributed.length === 0) {
      this.logger.log('No undistributed developer contributions found');
      return 0;
    }

    let distributedCount = 0;
    const distributedAt = new Date();

    for (const contribution of undistributed) {
      try {
        contribution.distributedAt = distributedAt;
        await this.developerContributionRepository.update(contribution);
        distributedCount++;
      } catch (error) {
        this.logger.error(
          `Failed to mark contribution ${contribution.id} as distributed`,
          error instanceof Error ? error.stack : error,
        );
      }
    }

    this.logger.log(
      `Distributed rewards for ${distributedCount} developer contributions`,
    );
    return distributedCount;
  }

  private async validateAction(
    actionType: DeveloperActionType,
    actionDetails: Record<string, any>,
  ): Promise<boolean> {
    switch (actionType) {
      case DeveloperActionType.SMART_CONTRACT_DEPLOY:
        return this.validateSmartContractDeploy(actionDetails);

      case DeveloperActionType.VERIFIED_CONTRACT:
        return this.validateVerifiedContract(actionDetails);

      case DeveloperActionType.GITHUB_CONTRIBUTION:
        return this.validateGithubContribution(actionDetails);

      case DeveloperActionType.BUG_REPORT:
        return this.validateBugReport(actionDetails);

      case DeveloperActionType.DOCUMENTATION:
        return this.validateDocumentation(actionDetails);

      case DeveloperActionType.TOOL_DEVELOPMENT:
        return this.validateToolDevelopment(actionDetails);

      case DeveloperActionType.COMMUNITY_SUPPORT:
        return this.validateCommunitySupport(actionDetails);

      default:
        return false;
    }
  }

  private validateSmartContractDeploy(details: Record<string, any>): boolean {
    return !!(
      details.contractAddress &&
      details.transactionHash &&
      details.chainId
    );
  }

  private validateVerifiedContract(details: Record<string, any>): boolean {
    return !!(
      details.contractAddress &&
      details.verificationUrl &&
      details.chainId
    );
  }

  private validateGithubContribution(details: Record<string, any>): boolean {
    return !!(
      details.repositoryUrl &&
      (details.pullRequestUrl || details.commitHash)
    );
  }

  private validateBugReport(details: Record<string, any>): boolean {
    return !!(
      details.issueUrl &&
      details.severity &&
      ['low', 'medium', 'high', 'critical'].includes(details.severity)
    );
  }

  private validateDocumentation(details: Record<string, any>): boolean {
    return !!(
      details.documentationUrl &&
      details.type &&
      ['tutorial', 'guide', 'api', 'readme'].includes(details.type)
    );
  }

  private validateToolDevelopment(details: Record<string, any>): boolean {
    return !!(details.toolUrl && details.description && details.category);
  }

  private validateCommunitySupport(details: Record<string, any>): boolean {
    return !!(
      details.supportUrl &&
      details.platform &&
      ['discord', 'forum', 'stackoverflow', 'reddit'].includes(details.platform)
    );
  }

  private async calculateAdjustedReward(
    walletAddress: string,
    actionType: DeveloperActionType,
    baseReward: number,
    seasonId: number,
  ): Promise<number> {
    const recentContributions =
      await this.developerContributionRepository.findByWallet(
        walletAddress,
        seasonId,
      );

    const sameTypeCount = recentContributions.filter(
      (c) => c.actionType === actionType && c.verified,
    ).length;

    let multiplier = 1.0;

    if (sameTypeCount === 0) {
      multiplier = 1.5;
    } else if (sameTypeCount < 3) {
      multiplier = 1.2;
    } else if (sameTypeCount < 5) {
      multiplier = 1.0;
    } else if (sameTypeCount < 10) {
      multiplier = 0.8;
    } else {
      multiplier = 0.5;
    }

    const diversityBonus = this.calculateDiversityBonus(recentContributions);
    multiplier += diversityBonus;

    return Math.round(baseReward * multiplier);
  }

  private calculateDiversityBonus(
    contributions: DeveloperContributionEntity[],
  ): number {
    const uniqueActionTypes = new Set(
      contributions.filter((c) => c.verified).map((c) => c.actionType),
    );

    if (uniqueActionTypes.size >= 5) {
      return 0.3;
    } else if (uniqueActionTypes.size >= 3) {
      return 0.15;
    }

    return 0;
  }

  private async performVerification(
    contribution: DeveloperContributionEntity,
  ): Promise<boolean> {
    const cacheKey = `${SHARD_CACHE_KEYS.DEVELOPER_VERIFICATION}:${contribution.id}`;
    const cached = await this.cacheService.get<boolean>(cacheKey);

    if (cached !== null) {
      return cached;
    }

    let isValid = false;

    switch (contribution.actionType) {
      case DeveloperActionType.SMART_CONTRACT_DEPLOY:
        isValid = await this.verifySmartContractDeploy(
          contribution.actionDetails,
        );
        break;

      case DeveloperActionType.VERIFIED_CONTRACT:
        isValid = await this.verifyContractVerification(
          contribution.actionDetails,
        );
        break;

      case DeveloperActionType.GITHUB_CONTRIBUTION:
        isValid = await this.verifyGithubContribution(
          contribution.actionDetails,
        );
        break;

      default:
        isValid = true;
    }

    await this.cacheService.set(
      cacheKey,
      isValid,
      SHARD_CACHE_TTL.DEVELOPER_VERIFICATION,
    );

    return isValid;
  }

  private async verifySmartContractDeploy(
    details: Record<string, any>,
  ): Promise<boolean> {
    if (
      !details.contractAddress ||
      !details.transactionHash ||
      !details.deployerAddress ||
      !details.chainId
    ) {
      return false;
    }

    const chainName = this.getChainName(details.chainId);
    if (!chainName) {
      this.logger.warn(`Unsupported chain ID: ${details.chainId}`);
      return false;
    }

    const deploymentInfo =
      await this.blockchainVerificationService.verifyContractDeployment(
        details.contractAddress,
        details.deployerAddress,
        details.transactionHash,
        chainName,
      );

    return deploymentInfo !== null;
  }

  private async verifyContractVerification(
    details: Record<string, any>,
  ): Promise<boolean> {
    if (!details.contractAddress || !details.chainId) {
      return false;
    }

    const chainName = this.getChainName(details.chainId);
    if (!chainName) {
      this.logger.warn(`Unsupported chain ID: ${details.chainId}`);
      return false;
    }

    const isVerified =
      await this.blockchainVerificationService.checkContractVerification(
        details.contractAddress,
        chainName,
      );

    return isVerified;
  }

  private async verifyGithubContribution(
    details: Record<string, any>,
  ): Promise<boolean> {
    if (!details.githubUrl) {
      return false;
    }

    const contributionInfo =
      await this.githubVerificationService.verifyContributionUrl(
        details.githubUrl,
      );

    if (!contributionInfo) {
      return false;
    }

    if (contributionInfo.status !== 'merged') {
      this.logger.warn(`Contribution not merged: ${details.githubUrl}`);
      return false;
    }

    if (
      details.authorEmail &&
      contributionInfo.authorEmail !== details.authorEmail
    ) {
      this.logger.warn(
        `Author email mismatch: expected ${details.authorEmail}, got ${contributionInfo.authorEmail}`,
      );
      return false;
    }

    return true;
  }

  async getContributionStats(
    walletAddress: string,
    seasonId: number,
  ): Promise<{
    totalContributions: number;
    verifiedContributions: number;
    totalShardsEarned: number;
    contributionsByType: Record<DeveloperActionType, number>;
    lastContributionDate: Date | null;
  }> {
    const contributions =
      await this.developerContributionRepository.findByWallet(
        walletAddress,
        seasonId,
      );

    const contributionsByType: Record<DeveloperActionType, number> = {} as any;

    for (const actionType of Object.values(DeveloperActionType)) {
      contributionsByType[actionType] = 0;
    }

    let totalShardsEarned = 0;
    let lastContributionDate: Date | null = null;

    for (const contribution of contributions) {
      contributionsByType[contribution.actionType]++;

      if (contribution.verified && contribution.distributedAt) {
        totalShardsEarned += contribution.shardsEarned;
      }

      if (
        !lastContributionDate ||
        contribution.createdAt > lastContributionDate
      ) {
        lastContributionDate = contribution.createdAt;
      }
    }

    return {
      totalContributions: contributions.length,
      verifiedContributions: contributions.filter((c) => c.verified).length,
      totalShardsEarned,
      contributionsByType,
      lastContributionDate,
    };
  }

  private getChainName(chainId: number): string | null {
    const chainMap: Record<number, string> = {
      1: 'ethereum',
      8453: 'base',
      42161: 'arbitrum',
      10: 'optimism',
    };

    return chainMap[chainId] || null;
  }
}

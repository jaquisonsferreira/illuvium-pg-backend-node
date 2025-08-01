import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as fs from 'fs';
import * as path from 'path';
import {
  ChainType,
  VaultType,
  VaultConfig,
  ChainConfig,
} from '../../domain/types/staking-types';
import {
  SeasonConfig as SeasonConfigFromFile,
  SeasonConfigFile,
  VaultSeasonConfig,
  SeasonStatusType,
} from '../../domain/types/season.types';

interface SeasonConfig {
  seasonNumber: number;
  primaryChain: ChainType;
  vaults: VaultConfig[];
  isActive: boolean;
  startTimestamp: number;
  endTimestamp?: number;
  migrationConfig?: {
    fromChain: ChainType;
    toChain: ChainType;
    migrationStartTime: number;
    migrationEndTime: number;
  };
}

interface TokenConfig {
  address: string;
  symbol: string;
  name: string;
  decimals: number;
  coingeckoId: string;
  isLP: boolean;
  token0?: string;
  token1?: string;
}

@Injectable()
export class VaultConfigService {
  private readonly logger = new Logger(VaultConfigService.name);
  private readonly chainConfigs: Map<ChainType, ChainConfig> = new Map();
  private readonly vaultConfigs: Map<string, VaultConfig> = new Map();
  private readonly seasonConfigs: Map<number, SeasonConfig> = new Map();
  private readonly tokenConfigs: Map<string, TokenConfig> = new Map();
  private readonly seasonConfigsFromFile: Map<number, SeasonConfigFromFile> =
    new Map();
  private readonly vaultSeasonConfigs: Map<string, VaultSeasonConfig> =
    new Map();

  constructor(private readonly configService: ConfigService) {
    this.initializeConfigurations();

    this.logger.log(`Initialized ${this.vaultConfigs.size} vaults`);
    this.vaultConfigs.forEach((vault, key) => {
      this.logger.log(
        `Vault ${key}: ${vault.name} - Active: ${vault.isActive}`,
      );
    });
  }

  private initializeConfigurations(): void {
    this.initializeChainConfigs();
    this.initializeSeasonConfigs();
    this.initializeTokenConfigs();
    this.initializeVaultConfigs();
  }

  private initializeChainConfigs(): void {
    const isProduction =
      this.configService.get<string>('NODE_ENV') === 'production';

    const baseConfig: ChainConfig = {
      chainId: isProduction ? 8453 : 84532, // Base mainnet : Base Sepolia
      name: isProduction ? 'Base' : 'Base Sepolia',
      rpcUrl: this.configService.get<string>(
        'BASE_RPC_URL',
        isProduction ? 'https://mainnet.base.org' : 'https://sepolia.base.org',
      ),
      subgraphUrl: this.configService.get<string>(
        'SUBGRAPH_BASE_URL',
        'https://api.thegraph.com/subgraphs/name/obelisk/base-staking',
      ),
      blockExplorerUrl: isProduction
        ? 'https://basescan.org'
        : 'https://sepolia.basescan.org',
      nativeCurrency: {
        name: 'Ethereum',
        symbol: 'ETH',
        decimals: 18,
      },
      multicallAddress: '0xcA11bde05977b3631167028862bE2a173976CA11',
      isTestnet: !isProduction,
      confirmationsRequired: 1,
      avgBlockTimeMs: 2000,
    };

    const obeliskConfig: ChainConfig = {
      chainId: 1001,
      name: 'Obelisk',
      rpcUrl: this.configService.get<string>(
        'OBELISK_RPC_URL',
        'https://rpc.obelisk.gg',
      ),
      subgraphUrl: this.configService.get<string>(
        'SUBGRAPH_OBELISK_URL',
        'https://api.thegraph.com/subgraphs/name/obelisk/obelisk-staking',
      ),
      blockExplorerUrl: 'https://explorer.obelisk.gg',
      nativeCurrency: {
        name: 'Obelisk',
        symbol: 'OBL',
        decimals: 18,
      },
      multicallAddress: this.configService.get<string>(
        'OBELISK_MULTICALL_ADDRESS',
      ),
      isTestnet: false,
      confirmationsRequired: 3,
      avgBlockTimeMs: 1000,
    };

    this.chainConfigs.set(ChainType.BASE, baseConfig);
    this.chainConfigs.set(ChainType.OBELISK, obeliskConfig);
  }

  private initializeSeasonConfigs(): void {
    try {
      this.loadSeasonConfigFromFile();
    } catch {
      this.logger.warn(
        'Failed to load season config from file, using fallback configuration',
      );
      this.initializeFallbackSeasonConfigs();
    }
  }

  private loadSeasonConfigFromFile(): void {
    const configPath = path.join(__dirname, 'seasons.config.json');

    if (!fs.existsSync(configPath)) {
      throw new Error(`Season config file not found at ${configPath}`);
    }

    const configFile = fs.readFileSync(configPath, 'utf8');
    const seasonConfigData: SeasonConfigFile = JSON.parse(configFile);

    Object.values(seasonConfigData.seasons).forEach((seasonConfig) => {
      this.seasonConfigsFromFile.set(seasonConfig.seasonId, seasonConfig);

      const legacySeasonConfig: SeasonConfig = {
        seasonNumber: seasonConfig.seasonId,
        primaryChain: seasonConfig.chain,
        vaults: [],
        isActive: seasonConfig.status === SeasonStatusType.ACTIVE,
        startTimestamp: Math.floor(
          new Date(seasonConfig.startDate).getTime() / 1000,
        ),
        endTimestamp: seasonConfig.endDate
          ? Math.floor(new Date(seasonConfig.endDate).getTime() / 1000)
          : undefined,
        migrationConfig: seasonConfig.migrationConfig
          ? {
              fromChain: seasonConfig.migrationConfig.fromChain,
              toChain: seasonConfig.migrationConfig.toChain,
              migrationStartTime: Math.floor(
                new Date(
                  seasonConfig.migrationConfig.migrationStartTime,
                ).getTime() / 1000,
              ),
              migrationEndTime: Math.floor(
                new Date(
                  seasonConfig.migrationConfig.migrationEndTime,
                ).getTime() / 1000,
              ),
            }
          : undefined,
      };

      this.seasonConfigs.set(seasonConfig.seasonId, legacySeasonConfig);
    });

    Object.values(seasonConfigData.vaultConfigs).forEach((vaultConfig) => {
      this.vaultSeasonConfigs.set(vaultConfig.vaultId, vaultConfig);
    });

    this.logger.log(
      `Loaded ${Object.keys(seasonConfigData.seasons).length} season configurations from file`,
    );
  }

  private initializeFallbackSeasonConfigs(): void {
    const season1: SeasonConfig = {
      seasonNumber: 1,
      primaryChain: ChainType.BASE,
      vaults: [],
      isActive: true,
      startTimestamp: 1704067200,
      endTimestamp: 1767225600,
    };

    const season2: SeasonConfig = {
      seasonNumber: 2,
      primaryChain: ChainType.OBELISK,
      vaults: [],
      isActive: false,
      startTimestamp: 1735689600,
      migrationConfig: {
        fromChain: ChainType.BASE,
        toChain: ChainType.OBELISK,
        migrationStartTime: 1735603200,
        migrationEndTime: 1735689600,
      },
    };

    this.seasonConfigs.set(1, season1);
    this.seasonConfigs.set(2, season2);
  }

  private initializeTokenConfigs(): void {
    // Use environment variables for token addresses to support both mainnet and testnet
    const ilvTokenAddress = this.configService.get<string>(
      'TOKEN_ILV_ADDRESS',
      '0xC3fcc8530F6d6997adD7EA9439F0C7F6855bF8e8',
    );

    const ilvEthLpAddress = this.configService.get<string>(
      'TOKEN_ILV_ETH_ADDRESS',
      '0x9470ed99A5797D3F4696B74732830B87BAc51d24',
    );

    const wethAddress = this.configService.get<string>(
      'TOKEN_WETH_ADDRESS',
      '0x4200000000000000000000000000000000000006', // Default Base WETH
    );

    this.tokenConfigs.set('ilv', {
      address: ilvTokenAddress,
      symbol: 'ILV',
      name: 'Illuvium',
      decimals: 18,
      coingeckoId: 'illuvium',
      isLP: false,
    });

    this.tokenConfigs.set('ilv-eth-lp-base', {
      address: ilvEthLpAddress,
      symbol: 'ILV-ETH-LP',
      name: 'ILV/ETH Liquidity Pool',
      decimals: 18,
      coingeckoId: '',
      isLP: true,
      token0: ilvTokenAddress,
      token1: wethAddress,
    });

    this.tokenConfigs.set('eth-usdc-lp-base', {
      address: '0x88e6A0c2dDD26FEEb64F039a2c41296FcB3f5640',
      symbol: 'ETH-USDC-LP',
      name: 'ETH/USDC Liquidity Pool',
      decimals: 18,
      coingeckoId: '',
      isLP: true,
      token0: '0x4200000000000000000000000000000000000006',
      token1: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
    });
  }

  private initializeVaultConfigs(): void {
    const ilvVaultBase: VaultConfig = {
      address: this.configService.get<string>(
        'ILV_VAULT_BASE_ADDRESS',
        '0xbBfadF4149D7fc67b6a1C33dd7424003F09Ed484',
      ),
      name: 'ILV Staking Vault',
      symbol: 'sILV',
      asset: this.tokenConfigs.get('ilv')!.address,
      type: VaultType.SINGLE_TOKEN,
      chain: ChainType.BASE,
      seasonNumber: 1,
      isActive: true,
      totalAssets: '0',
      totalSupply: '0',
      depositEnabled: true,
      withdrawalEnabled: true,
      minimumDeposit: '1000000000000000000',
      maximumDeposit: '1000000000000000000000000',
      lockDuration: 0,
      aprBase: 0.05,
      tokenConfig: this.tokenConfigs.get('ilv')!,
      createdAt: new Date('2024-01-01'),
      updatedAt: new Date(),
    };

    const ilvEthLpVaultBase: VaultConfig = {
      address: this.configService.get<string>(
        'ILV_ETH_LP_VAULT_BASE_ADDRESS',
        '0xF91971689C33C1a1545C9286530C300e59014F0F',
      ),
      name: 'ILV/ETH LP Staking Vault',
      symbol: 'sILV-ETH-LP',
      asset: this.tokenConfigs.get('ilv-eth-lp-base')!.address,
      type: VaultType.LP_TOKEN,
      chain: ChainType.BASE,
      seasonNumber: 1,
      isActive: true,
      totalAssets: '0',
      totalSupply: '0',
      depositEnabled: true,
      withdrawalEnabled: true,
      minimumDeposit: '1000000000000000000',
      maximumDeposit: '100000000000000000000000',
      lockDuration: 0,
      aprBase: 0.08,
      tokenConfig: this.tokenConfigs.get('ilv-eth-lp-base')!,
      createdAt: new Date('2024-01-01'),
      updatedAt: new Date(),
    };

    this.vaultConfigs.set(ilvVaultBase.address.toLowerCase(), ilvVaultBase);
    this.vaultConfigs.set(
      ilvEthLpVaultBase.address.toLowerCase(),
      ilvEthLpVaultBase,
    );

    const season1 = this.seasonConfigs.get(1)!;
    season1.vaults = [ilvVaultBase, ilvEthLpVaultBase];
    this.seasonConfigs.set(1, season1);
  }

  getChainConfig(chain: ChainType): ChainConfig | undefined {
    return this.chainConfigs.get(chain);
  }

  getAllChainConfigs(): ChainConfig[] {
    return Array.from(this.chainConfigs.values());
  }

  getVaultConfig(vaultAddress: string): VaultConfig | undefined {
    return this.vaultConfigs.get(vaultAddress.toLowerCase());
  }

  getAllVaultConfigs(): VaultConfig[] {
    return Array.from(this.vaultConfigs.values());
  }

  getVaultsByChain(chain: ChainType): VaultConfig[] {
    return this.getAllVaultConfigs().filter((vault) => vault.chain === chain);
  }

  getVaultsBySeason(seasonNumber: number): VaultConfig[] {
    return this.getAllVaultConfigs().filter(
      (vault) => vault.seasonNumber === seasonNumber,
    );
  }

  getActiveVaults(): VaultConfig[] {
    return this.getAllVaultConfigs().filter((vault) => vault.isActive);
  }

  getVaultsByType(type: VaultType): VaultConfig[] {
    return this.getAllVaultConfigs().filter((vault) => vault.type === type);
  }

  getSeasonConfig(seasonNumber: number): SeasonConfig | undefined {
    return this.seasonConfigs.get(seasonNumber);
  }

  getSeasonConfigFromFile(seasonId: number): SeasonConfigFromFile | undefined {
    return this.seasonConfigsFromFile.get(seasonId);
  }

  getAllSeasonConfigsFromFile(): SeasonConfigFromFile[] {
    return Array.from(this.seasonConfigsFromFile.values());
  }

  getVaultSeasonConfig(vaultId: string): VaultSeasonConfig | undefined {
    return this.vaultSeasonConfigs.get(vaultId);
  }

  getAllVaultSeasonConfigs(): VaultSeasonConfig[] {
    return Array.from(this.vaultSeasonConfigs.values());
  }

  getCurrentSeason(): SeasonConfig | undefined {
    const now = Date.now() / 1000;
    return Array.from(this.seasonConfigs.values()).find(
      (season) =>
        season.isActive &&
        season.startTimestamp <= now &&
        (!season.endTimestamp || season.endTimestamp > now),
    );
  }

  getCurrentSeasonFromFile(): SeasonConfigFromFile | undefined {
    const now = new Date();
    return Array.from(this.seasonConfigsFromFile.values()).find(
      (season) =>
        season.status === SeasonStatusType.ACTIVE &&
        new Date(season.startDate) <= now &&
        (!season.endDate || new Date(season.endDate) > now),
    );
  }

  getNextSeason(): SeasonConfig | undefined {
    const currentSeason = this.getCurrentSeason();
    if (!currentSeason) return undefined;

    return this.seasonConfigs.get(currentSeason.seasonNumber + 1);
  }

  getNextSeasonFromFile(): SeasonConfigFromFile | undefined {
    const currentSeason = this.getCurrentSeasonFromFile();
    if (!currentSeason) return undefined;

    return this.seasonConfigsFromFile.get(currentSeason.seasonId + 1);
  }

  getTokenConfig(tokenKey: string): TokenConfig | undefined {
    return this.tokenConfigs.get(tokenKey);
  }

  getTokenConfigByAddress(address: string): TokenConfig | undefined {
    return Array.from(this.tokenConfigs.values()).find(
      (token) => token.address.toLowerCase() === address.toLowerCase(),
    );
  }

  getAllTokenConfigs(): TokenConfig[] {
    return Array.from(this.tokenConfigs.values());
  }

  getLPTokenConfigs(): TokenConfig[] {
    return this.getAllTokenConfigs().filter((token) => token.isLP);
  }

  getSingleTokenConfigs(): TokenConfig[] {
    return this.getAllTokenConfigs().filter((token) => !token.isLP);
  }

  isMainnetLaunched(): boolean {
    const currentSeason = this.getCurrentSeason();
    return currentSeason?.seasonNumber === 1;
  }

  isEmergencyMode(): boolean {
    return false;
  }

  isMaintenanceMode(): boolean {
    return false;
  }

  validateSeasonOperation(
    seasonNumber: number,
    operationType: 'deposit' | 'withdrawal' | 'migration' | 'transfer',
  ): { isValid: boolean; errors: string[]; warnings: string[] } {
    const season = this.getSeasonConfigFromFile(seasonNumber);
    const errors: string[] = [];
    const warnings: string[] = [];

    if (!season) {
      errors.push(`Season ${seasonNumber} configuration not found`);
      return { isValid: false, errors, warnings };
    }

    if (this.isEmergencyMode()) {
      if (operationType !== 'withdrawal') {
        errors.push('Only withdrawals allowed in emergency mode');
      }
    }

    if (this.isMaintenanceMode()) {
      errors.push('System is in maintenance mode');
    }

    const now = new Date();

    switch (operationType) {
      case 'deposit':
        if (!season.features.depositsEnabled) {
          errors.push('Deposits are disabled for this season');
        }
        break;
      case 'withdrawal':
        if (!season.features.withdrawalsEnabled) {
          errors.push('Withdrawals are disabled for this season');
        }
        break;
      case 'migration':
        if (!season.migrationConfig) {
          errors.push('Migration not configured for this season');
        } else {
          const { migrationStartTime, migrationDeadline } =
            season.migrationConfig;
          if (now < new Date(migrationStartTime)) {
            errors.push('Migration period has not started');
          }
          if (now > new Date(migrationDeadline)) {
            errors.push('Migration deadline has passed');
          }
        }
        break;
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
    };
  }

  isMigrationPeriod(): boolean {
    const now = Date.now() / 1000;
    const nextSeason = this.getNextSeason();

    if (!nextSeason?.migrationConfig) return false;

    return (
      now >= nextSeason.migrationConfig.migrationStartTime &&
      now <= nextSeason.migrationConfig.migrationEndTime
    );
  }

  getMigrationConfig(): SeasonConfig['migrationConfig'] | undefined {
    const nextSeason = this.getNextSeason();
    return nextSeason?.migrationConfig;
  }

  getSubgraphUrl(chain: ChainType): string {
    const chainConfig = this.getChainConfig(chain);
    if (!chainConfig?.subgraphUrl) {
      throw new Error(`Subgraph URL not configured for chain: ${chain}`);
    }
    return chainConfig.subgraphUrl;
  }

  getRpcUrl(chain: ChainType): string {
    const chainConfig = this.getChainConfig(chain);
    if (!chainConfig?.rpcUrl) {
      throw new Error(`RPC URL not configured for chain: ${chain}`);
    }
    return chainConfig.rpcUrl;
  }

  getChainId(chain: ChainType): number {
    const chainConfig = this.getChainConfig(chain);
    if (!chainConfig) {
      throw new Error(`Chain configuration not found for: ${chain}`);
    }
    return chainConfig.chainId;
  }

  isVaultActive(vaultAddress: string): boolean {
    const vault = this.getVaultConfig(vaultAddress);
    return vault?.isActive ?? false;
  }

  isDepositEnabled(vaultAddress: string): boolean {
    const vault = this.getVaultConfig(vaultAddress);
    return vault?.depositEnabled ?? false;
  }

  isWithdrawalEnabled(vaultAddress: string): boolean {
    const vault = this.getVaultConfig(vaultAddress);
    return vault?.withdrawalEnabled ?? false;
  }

  getVaultMinimumDeposit(vaultAddress: string): string {
    const vault = this.getVaultConfig(vaultAddress);
    return vault?.minimumDeposit ?? '0';
  }

  getVaultMaximumDeposit(vaultAddress: string): string {
    const vault = this.getVaultConfig(vaultAddress);
    return vault?.maximumDeposit ?? '0';
  }

  updateVaultConfig(vaultAddress: string, updates: Partial<VaultConfig>): void {
    const vault = this.getVaultConfig(vaultAddress);
    if (!vault) {
      this.logger.warn(`Vault config not found for address: ${vaultAddress}`);
      return;
    }

    const updatedVault = { ...vault, ...updates, updatedAt: new Date() };
    this.vaultConfigs.set(vaultAddress.toLowerCase(), updatedVault);

    this.logger.log(`Updated vault config for ${vaultAddress}`);
  }

  addVaultConfig(vault: VaultConfig): void {
    this.vaultConfigs.set(vault.address.toLowerCase(), vault);
    this.logger.log(`Added new vault config: ${vault.address}`);
  }

  removeVaultConfig(vaultAddress: string): void {
    this.vaultConfigs.delete(vaultAddress.toLowerCase());
    this.logger.log(`Removed vault config: ${vaultAddress}`);
  }

  validateVaultAddress(vaultAddress: string): boolean {
    return this.vaultConfigs.has(vaultAddress.toLowerCase());
  }

  validateChain(chain: ChainType): boolean {
    return this.chainConfigs.has(chain);
  }

  validateTokenAddress(tokenAddress: string): boolean {
    return Array.from(this.tokenConfigs.values()).some(
      (token) => token.address.toLowerCase() === tokenAddress.toLowerCase(),
    );
  }

  getVaultDisplayInfo(vaultAddress: string): {
    name: string;
    symbol: string;
    type: VaultType;
    chain: ChainType;
    asset: {
      symbol: string;
      name: string;
      isLP: boolean;
    };
  } | null {
    const vault = this.getVaultConfig(vaultAddress);
    if (!vault) return null;

    return {
      name: vault.name,
      symbol: vault.symbol,
      type: vault.type,
      chain: vault.chain,
      asset: {
        symbol: vault.tokenConfig.symbol,
        name: vault.tokenConfig.name,
        isLP: vault.tokenConfig.isLP,
      },
    };
  }

  getConfigStats(): {
    totalVaults: number;
    activeVaults: number;
    supportedChains: number;
    currentSeason: number | null;
    lpVaults: number;
    singleTokenVaults: number;
  } {
    const allVaults = this.getAllVaultConfigs();
    const currentSeason = this.getCurrentSeason();

    return {
      totalVaults: allVaults.length,
      activeVaults: allVaults.filter((v) => v.isActive).length,
      supportedChains: this.chainConfigs.size,
      currentSeason: currentSeason?.seasonNumber ?? null,
      lpVaults: allVaults.filter((v) => v.type === VaultType.LP_TOKEN).length,
      singleTokenVaults: allVaults.filter(
        (v) => v.type === VaultType.SINGLE_TOKEN,
      ).length,
    };
  }
}

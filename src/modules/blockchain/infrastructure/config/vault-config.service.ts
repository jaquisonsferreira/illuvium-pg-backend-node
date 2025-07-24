import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  ChainType,
  VaultType,
  SeasonStatus,
  VaultConfig,
  ChainConfig,
} from '../../domain/types/staking-types';

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

  constructor(private readonly configService: ConfigService) {
    this.initializeConfigurations();
  }

  private initializeConfigurations(): void {
    this.initializeChainConfigs();
    this.initializeSeasonConfigs();
    this.initializeTokenConfigs();
    this.initializeVaultConfigs();
  }

  private initializeChainConfigs(): void {
    const baseConfig: ChainConfig = {
      chainId: 8453,
      name: 'Base',
      rpcUrl: this.configService.get<string>(
        'BASE_RPC_URL',
        'https://mainnet.base.org',
      ),
      subgraphUrl: this.configService.get<string>(
        'SUBGRAPH_BASE_URL',
        'https://api.thegraph.com/subgraphs/name/obelisk/base-staking',
      ),
      blockExplorerUrl: 'https://basescan.org',
      nativeCurrency: {
        name: 'Ethereum',
        symbol: 'ETH',
        decimals: 18,
      },
      multicallAddress: '0xcA11bde05977b3631167028862bE2a173976CA11',
      isTestnet: false,
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
    const season1: SeasonConfig = {
      seasonNumber: 1,
      primaryChain: ChainType.BASE,
      vaults: [],
      isActive: true,
      startTimestamp: 1704067200,
      endTimestamp: 1735689600,
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
    this.tokenConfigs.set('ilv', {
      address: '0x767FE9EDC9E0dF98E07454847909b5E959D7ca0E',
      symbol: 'ILV',
      name: 'Illuvium',
      decimals: 18,
      coingeckoId: 'illuvium',
      isLP: false,
    });

    this.tokenConfigs.set('ilv-eth-lp-base', {
      address: '0x6A9865aDE2B6207dAAC49f8bCBa9705dEB0B0e6D',
      symbol: 'ILV-ETH-LP',
      name: 'ILV/ETH Liquidity Pool',
      decimals: 18,
      coingeckoId: '',
      isLP: true,
      token0: '0x767FE9EDC9E0dF98E07454847909b5E959D7ca0E',
      token1: '0x4200000000000000000000000000000000000006',
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
        '0x742d35Cc4Bf3b4A5b5b8e10a4E1F0e8C6F8D9E0A',
      ),
      name: 'ILV Staking Vault',
      symbol: 'sILV',
      asset: '0x767FE9EDC9E0dF98E07454847909b5E959D7ca0E',
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
        '0x893E8a50Bc3c4b5b8d8F23A4b5c8D8F9E1a2b3c4',
      ),
      name: 'ILV/ETH LP Staking Vault',
      symbol: 'sILV-ETH-LP',
      asset: '0x6A9865aDE2B6207dAAC49f8bCBa9705dEB0B0e6D',
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

  getCurrentSeason(): SeasonConfig | undefined {
    const now = Date.now() / 1000;
    return Array.from(this.seasonConfigs.values()).find(
      (season) =>
        season.isActive &&
        season.startTimestamp <= now &&
        (!season.endTimestamp || season.endTimestamp > now),
    );
  }

  getNextSeason(): SeasonConfig | undefined {
    const currentSeason = this.getCurrentSeason();
    if (!currentSeason) return undefined;

    return this.seasonConfigs.get(currentSeason.seasonNumber + 1);
  }

  getTokenConfig(tokenKey: string): TokenConfig | undefined {
    return this.tokenConfigs.get(tokenKey);
  }

  getTokenConfigByAddress(
    address: string,
    chain: ChainType,
  ): TokenConfig | undefined {
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

  validateTokenAddress(tokenAddress: string, chain: ChainType): boolean {
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

import { ValidationError, ErrorCodes } from '@shared/errors/validation.error';

export interface PaginationParams {
  page?: number;
  limit?: number;
  offset?: number;
}

export interface TimeframeParams {
  startDate?: Date;
  endDate?: Date;
  timeframe?: 'hour' | 'day' | 'week' | 'month' | 'year';
}

export class ParameterValidator {
  static validateVaultId(vaultId: string | undefined | null): string {
    if (!vaultId || typeof vaultId !== 'string') {
      throw new ValidationError(
        ErrorCodes.INVALID_PARAMS,
        'Vault ID is required',
        {
          provided_value: vaultId,
          expected_format: 'String vault identifier',
        },
      );
    }

    const trimmedVaultId = vaultId.trim();

    // Vault ID format validation
    if (!/^[A-Z0-9_]+_vault(_[a-z]+)?$/.test(trimmedVaultId)) {
      throw new ValidationError(
        ErrorCodes.INVALID_PARAMS,
        'Invalid vault ID format',
        {
          provided_vault_id: trimmedVaultId,
          expected_format: 'TOKEN_vault_chain (e.g., ILV_vault_base)',
          examples: [
            'ILV_vault_base',
            'ILV_ETH_vault_base',
            'ETH_vault_ethereum',
          ],
        },
      );
    }

    return trimmedVaultId;
  }

  static validateChain(chain: string | undefined | null): string {
    if (!chain || typeof chain !== 'string') {
      throw new ValidationError(
        ErrorCodes.INVALID_PARAMS,
        'Chain is required',
        {
          provided_value: chain,
          expected_values: ['base', 'ethereum', 'arbitrum', 'optimism'],
        },
      );
    }

    const trimmedChain = chain.trim().toLowerCase();
    const validChains = ['base', 'ethereum', 'arbitrum', 'optimism'];

    if (!validChains.includes(trimmedChain)) {
      throw new ValidationError(ErrorCodes.INVALID_PARAMS, 'Invalid chain', {
        provided_chain: trimmedChain,
        valid_chains: validChains,
      });
    }

    return trimmedChain;
  }

  static validateSeasonId(
    seasonId: number | string | undefined | null,
  ): number {
    if (seasonId === undefined || seasonId === null) {
      throw new ValidationError(
        ErrorCodes.INVALID_PARAMS,
        'Season ID is required',
        {
          provided_value: seasonId,
        },
      );
    }

    const numericSeasonId =
      typeof seasonId === 'string' ? parseInt(seasonId, 10) : seasonId;

    if (isNaN(numericSeasonId) || !isFinite(numericSeasonId)) {
      throw new ValidationError(
        ErrorCodes.INVALID_PARAMS,
        'Invalid season ID',
        {
          provided_value: seasonId,
          expected_type: 'number',
        },
      );
    }

    if (numericSeasonId < 1 || numericSeasonId > 10) {
      throw new ValidationError(
        ErrorCodes.INVALID_PARAMS,
        'Season ID out of range',
        {
          provided_season_id: numericSeasonId,
          valid_range: '1-10',
        },
      );
    }

    return numericSeasonId;
  }

  static validatePagination(
    params: PaginationParams,
  ): Required<PaginationParams> {
    const page = params.page ?? 1;
    const limit = params.limit ?? 10;
    const offset = params.offset ?? (page - 1) * limit;

    if (page < 1) {
      throw new ValidationError(
        ErrorCodes.INVALID_PARAMS,
        'Page must be greater than 0',
        {
          provided_page: page,
          minimum_page: 1,
        },
      );
    }

    if (limit < 1 || limit > 100) {
      throw new ValidationError(
        ErrorCodes.INVALID_PARAMS,
        'Limit must be between 1 and 100',
        {
          provided_limit: limit,
          valid_range: '1-100',
        },
      );
    }

    if (offset < 0) {
      throw new ValidationError(
        ErrorCodes.INVALID_PARAMS,
        'Offset cannot be negative',
        {
          provided_offset: offset,
          minimum_offset: 0,
        },
      );
    }

    return { page, limit, offset };
  }

  static validateTimeframe(params: TimeframeParams): TimeframeParams {
    if (params.startDate && params.endDate) {
      const start = new Date(params.startDate);
      const end = new Date(params.endDate);

      if (isNaN(start.getTime())) {
        throw new ValidationError(
          ErrorCodes.INVALID_PARAMS,
          'Invalid start date',
          {
            provided_value: params.startDate,
            expected_format: 'ISO 8601 date string',
          },
        );
      }

      if (isNaN(end.getTime())) {
        throw new ValidationError(
          ErrorCodes.INVALID_PARAMS,
          'Invalid end date',
          {
            provided_value: params.endDate,
            expected_format: 'ISO 8601 date string',
          },
        );
      }

      if (start > end) {
        throw new ValidationError(
          ErrorCodes.INVALID_PARAMS,
          'Start date must be before end date',
          {
            start_date: start.toISOString(),
            end_date: end.toISOString(),
          },
        );
      }

      // Maximum time range of 1 year
      const oneYear = 365 * 24 * 60 * 60 * 1000;
      if (end.getTime() - start.getTime() > oneYear) {
        throw new ValidationError(
          ErrorCodes.INVALID_PARAMS,
          'Time range exceeds maximum of 1 year',
          {
            start_date: start.toISOString(),
            end_date: end.toISOString(),
            max_range_days: 365,
          },
        );
      }
    }

    if (params.timeframe) {
      const validTimeframes = ['hour', 'day', 'week', 'month', 'year'];
      if (!validTimeframes.includes(params.timeframe)) {
        throw new ValidationError(
          ErrorCodes.INVALID_PARAMS,
          'Invalid timeframe',
          {
            provided_timeframe: params.timeframe,
            valid_timeframes: validTimeframes,
          },
        );
      }
    }

    return params;
  }

  static validateSearchString(
    search: string | undefined | null,
    maxLength: number = 100,
  ): string | null {
    if (!search) {
      return null;
    }

    if (typeof search !== 'string') {
      throw new ValidationError(
        ErrorCodes.INVALID_PARAMS,
        'Search must be a string',
        {
          provided_type: typeof search,
          expected_type: 'string',
        },
      );
    }

    const trimmedSearch = search.trim();

    if (trimmedSearch.length === 0) {
      return null;
    }

    if (trimmedSearch.length > maxLength) {
      throw new ValidationError(
        ErrorCodes.INVALID_PARAMS,
        `Search string exceeds maximum length of ${maxLength}`,
        {
          provided_length: trimmedSearch.length,
          max_length: maxLength,
        },
      );
    }

    // Basic SQL injection prevention
    if (/[';\\]/.test(trimmedSearch)) {
      throw new ValidationError(
        ErrorCodes.INVALID_PARAMS,
        'Search contains invalid characters',
        {
          invalid_characters: "', ;, \\",
        },
      );
    }

    return trimmedSearch;
  }

  static validateTokenSymbol(symbol: string | undefined | null): string {
    if (!symbol || typeof symbol !== 'string') {
      throw new ValidationError(
        ErrorCodes.INVALID_PARAMS,
        'Token symbol is required',
        {
          provided_value: symbol,
        },
      );
    }

    const trimmedSymbol = symbol.trim().toUpperCase();

    if (!/^[A-Z0-9\-/]+$/.test(trimmedSymbol)) {
      throw new ValidationError(
        ErrorCodes.INVALID_PARAMS,
        'Invalid token symbol format',
        {
          provided_symbol: trimmedSymbol,
          expected_format:
            'Uppercase letters, numbers, hyphens, and forward slashes',
          examples: ['ILV', 'ETH', 'ILV/ETH', 'USDC'],
        },
      );
    }

    if (trimmedSymbol.length > 20) {
      throw new ValidationError(
        ErrorCodes.INVALID_PARAMS,
        'Token symbol too long',
        {
          provided_symbol: trimmedSymbol,
          max_length: 20,
        },
      );
    }

    return trimmedSymbol;
  }
}

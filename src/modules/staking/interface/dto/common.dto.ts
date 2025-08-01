import { ApiProperty } from '@nestjs/swagger';

export class PaginationDto {
  @ApiProperty({
    description: 'Current page number',
    example: 1,
  })
  page: number;

  @ApiProperty({
    description: 'Number of items per page',
    example: 20,
  })
  limit: number;

  @ApiProperty({
    description: 'Total number of items',
    example: 150,
  })
  total: number;

  @ApiProperty({
    description: 'Total number of pages',
    example: 8,
  })
  total_pages: number;

  @ApiProperty({
    description: 'Whether there is a next page',
    example: true,
  })
  has_next: boolean;

  @ApiProperty({
    description: 'Whether there is a previous page',
    example: false,
  })
  has_previous: boolean;
}

export class TokenIconsDto {
  @ApiProperty({
    description: 'Primary token icon URL',
    example:
      'https://coin-images.coingecko.com/coins/images/2588/large/ilv.png',
  })
  primary: string;

  @ApiProperty({
    description: 'Secondary token icon URL (for LP tokens)',
    example:
      'https://coin-images.coingecko.com/coins/images/279/large/ethereum.png',
    required: false,
    nullable: true,
  })
  secondary?: string | null;
}

export class MetadataDto {
  @ApiProperty({
    description: 'Data source',
    example: 'subgraph',
    enum: ['subgraph', 'blockchain', 'cache', 'alchemy'],
  })
  source: string;

  @ApiProperty({
    description: 'Last updated timestamp',
    example: '2024-01-15T10:30:00Z',
  })
  lastUpdated: string;

  @ApiProperty({
    description: 'Whether the data is stale',
    example: false,
  })
  isStale: boolean;
}

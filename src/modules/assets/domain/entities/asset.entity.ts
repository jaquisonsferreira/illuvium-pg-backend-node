import { randomUUID } from 'crypto';
import { ApiProperty } from '@nestjs/swagger';

export class Asset {
  @ApiProperty({ description: 'Unique identifier for the asset' })
  id: string;

  @ApiProperty({ description: 'Name of the asset' })
  name: string;

  @ApiProperty({ description: 'Description of the asset' })
  description: string;

  @ApiProperty({ description: 'Image URL of the asset' })
  imageUrl: string;

  @ApiProperty({ description: 'Price of the asset' })
  price: number;

  @ApiProperty({
    description: 'Tags associated with the asset',
    type: [String],
  })
  tags: string[];

  @ApiProperty({ description: 'Creation date of the asset' })
  createdAt: Date;

  @ApiProperty({ description: 'Update date of the asset' })
  updatedAt: Date;

  constructor(params: {
    id?: string;
    name: string;
    description: string;
    imageUrl: string;
    price: number;
    tags?: string[];
  }) {
    this.id = params.id ?? randomUUID();
    this.name = params.name;
    this.description = params.description;
    this.imageUrl = params.imageUrl;
    this.price = params.price;
    this.tags = params.tags ?? [];
    this.createdAt = new Date();
    this.updatedAt = new Date();
  }
}

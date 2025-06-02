import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNotEmpty, IsNumber, IsOptional } from 'class-validator';

export class CreateAssetDto {
  @ApiProperty({
    description: 'Name of the asset',
    example: 'Illuvial Fire',
  })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiProperty({
    description: 'Description of the asset',
    example: 'A powerful Illuvial of fire',
  })
  @IsString()
  @IsNotEmpty()
  description: string;

  @ApiProperty({
    description: 'URL of the asset image',
    example: 'https://assets.illuvium.io/images/illuvials/fire-1.png',
  })
  @IsString()
  @IsNotEmpty()
  imageUrl: string;

  @ApiProperty({
    description: 'Price of the asset',
    example: 1.5,
  })
  @IsNumber()
  @IsNotEmpty()
  price: number;

  @ApiProperty({
    description: 'Tags associated with the asset',
    example: ['fire', 'rare', 'season-1'],
    required: false,
  })
  @IsString({ each: true })
  @IsOptional()
  tags?: string[];
}

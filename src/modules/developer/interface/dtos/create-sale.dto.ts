import {
  IsString,
  IsObject,
  IsEthereumAddress,
  IsOptional,
} from 'class-validator';

export class CreateSaleDto {
  @IsString()
  @IsEthereumAddress()
  contractAddress: string;

  @IsString()
  tokenId: string;

  @IsString()
  @IsEthereumAddress()
  fromAddress: string;

  @IsString()
  price: string;

  @IsString()
  currency: string;

  @IsOptional()
  @IsObject()
  metadata?: Record<string, any>;
}

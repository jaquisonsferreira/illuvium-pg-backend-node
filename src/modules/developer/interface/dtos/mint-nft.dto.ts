import { IsString, IsObject, IsEthereumAddress } from 'class-validator';

export class MintNftDto {
  @IsString()
  @IsEthereumAddress()
  contractAddress: string;

  @IsString()
  @IsEthereumAddress()
  toAddress: string;

  @IsObject()
  metadata: Record<string, any>;
}

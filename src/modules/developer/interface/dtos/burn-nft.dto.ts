import { IsString, IsEthereumAddress } from 'class-validator';

export class BurnNftDto {
  @IsString()
  @IsEthereumAddress()
  contractAddress: string;

  @IsString()
  tokenId: string;

  @IsString()
  @IsEthereumAddress()
  fromAddress: string;
}

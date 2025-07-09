import { IsString, IsEthereumAddress } from 'class-validator';

export class TransferNftDto {
  @IsString()
  @IsEthereumAddress()
  contractAddress: string;

  @IsString()
  tokenId: string;

  @IsString()
  @IsEthereumAddress()
  fromAddress: string;

  @IsString()
  @IsEthereumAddress()
  toAddress: string;
}

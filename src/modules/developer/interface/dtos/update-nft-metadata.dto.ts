import { IsString, IsObject, IsEthereumAddress } from 'class-validator';

export class UpdateNftMetadataDto {
  @IsString()
  @IsEthereumAddress()
  contractAddress: string;

  @IsString()
  tokenId: string;

  @IsObject()
  metadata: Record<string, any>;
}

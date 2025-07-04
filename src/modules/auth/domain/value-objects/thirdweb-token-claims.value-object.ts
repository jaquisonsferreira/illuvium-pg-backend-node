export interface ThirdwebTokenClaimsData {
  iss: string; // issuer
  sub: string; // subject (user ID)
  aud: string; // audience
  iat: string; // issued at
  exp: string; // expiration
  walletAddress: string; // wallet address
  chainId: string; // blockchain chain ID
}

export class ThirdwebTokenClaims {
  private readonly issuer: string;
  private readonly userId: string;
  private readonly audience: string;
  private readonly issuedAt: Date;
  private readonly expiration: Date;
  private readonly walletAddress: string;
  private readonly chainId: string;

  constructor(data: ThirdwebTokenClaimsData) {
    this.validateClaims(data);

    this.issuer = data.iss;
    this.userId = data.sub;
    this.audience = data.aud;
    this.issuedAt = new Date(data.iat);
    this.expiration = new Date(data.exp);
    this.walletAddress = data.walletAddress;
    this.chainId = data.chainId;
  }

  private validateClaims(data: ThirdwebTokenClaimsData): void {
    if (!data.iss || !data.iss.includes('thirdweb')) {
      throw new Error('Invalid issuer in token claims');
    }

    if (!data.sub || typeof data.sub !== 'string') {
      throw new Error('Invalid user ID in token claims');
    }

    if (!data.aud || typeof data.aud !== 'string') {
      throw new Error('Invalid audience in token claims');
    }

    if (
      !data.walletAddress ||
      !this.isValidEthereumAddress(data.walletAddress)
    ) {
      throw new Error('Invalid wallet address in token claims');
    }

    if (!data.chainId || typeof data.chainId !== 'string') {
      throw new Error('Invalid chain ID in token claims');
    }

    const expirationDate = new Date(data.exp);
    if (expirationDate <= new Date()) {
      throw new Error('Token has expired');
    }

    const issuedAtDate = new Date(data.iat);
    if (issuedAtDate > new Date()) {
      throw new Error('Token issued in the future');
    }
  }

  private isValidEthereumAddress(address: string): boolean {
    return /^0x[a-fA-F0-9]{40}$/.test(address);
  }

  get getIssuer(): string {
    return this.issuer;
  }

  get getUserId(): string {
    return this.userId;
  }

  get getAudience(): string {
    return this.audience;
  }

  get getIssuedAt(): Date {
    return this.issuedAt;
  }

  get getExpiration(): Date {
    return this.expiration;
  }

  get getWalletAddress(): string {
    return this.walletAddress;
  }

  get getChainId(): string {
    return this.chainId;
  }

  public isExpired(): boolean {
    return this.expiration <= new Date();
  }

  public toJSON(): ThirdwebTokenClaimsData {
    return {
      iss: this.issuer,
      sub: this.userId,
      aud: this.audience,
      iat: this.issuedAt.toISOString(),
      exp: this.expiration.toISOString(),
      walletAddress: this.walletAddress,
      chainId: this.chainId,
    };
  }
}

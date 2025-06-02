export interface PrivyTokenClaimsData {
  appId: string;
  userId: string;
  issuer: string;
  issuedAt: string;
  expiration: string;
  sessionId: string;
}

export class PrivyTokenClaims {
  private readonly appId: string;
  private readonly userId: string;
  private readonly issuer: string;
  private readonly issuedAt: Date;
  private readonly expiration: Date;
  private readonly sessionId: string;

  constructor(data: PrivyTokenClaimsData) {
    this.validateClaims(data);

    this.appId = data.appId;
    this.userId = data.userId;
    this.issuer = data.issuer;
    this.issuedAt = new Date(data.issuedAt);
    this.expiration = new Date(data.expiration);
    this.sessionId = data.sessionId;
  }

  private validateClaims(data: PrivyTokenClaimsData): void {
    if (!data.appId || typeof data.appId !== 'string') {
      throw new Error('Invalid app ID in token claims');
    }

    if (!data.userId || typeof data.userId !== 'string') {
      throw new Error('Invalid user ID in token claims');
    }

    if (data.issuer !== 'privy.io') {
      throw new Error('Invalid issuer in token claims');
    }

    const expirationDate = new Date(data.expiration);
    if (expirationDate <= new Date()) {
      throw new Error('Token has expired');
    }

    const issuedAtDate = new Date(data.issuedAt);
    if (issuedAtDate > new Date()) {
      throw new Error('Token issued in the future');
    }
  }

  get getAppId(): string {
    return this.appId;
  }

  get getUserId(): string {
    return this.userId;
  }

  get getIssuer(): string {
    return this.issuer;
  }

  get getIssuedAt(): Date {
    return this.issuedAt;
  }

  get getExpiration(): Date {
    return this.expiration;
  }

  get getSessionId(): string {
    return this.sessionId;
  }

  public isExpired(): boolean {
    return this.expiration <= new Date();
  }

  public toJSON(): PrivyTokenClaimsData {
    return {
      appId: this.appId,
      userId: this.userId,
      issuer: this.issuer,
      issuedAt: this.issuedAt.toISOString(),
      expiration: this.expiration.toISOString(),
      sessionId: this.sessionId,
    };
  }
}

export interface UserProps {
  id: string;
  privyId: string;
  walletAddress?: string;
  email?: string;
  phoneNumber?: string;
  createdAt: Date;
  updatedAt: Date;
  isActive: boolean;
}

export class UserEntity {
  constructor(private readonly props: UserProps) {}

  get id(): string {
    return this.props.id;
  }

  get privyId(): string {
    return this.props.privyId;
  }

  get walletAddress(): string | undefined {
    return this.props.walletAddress;
  }

  get email(): string | undefined {
    return this.props.email;
  }

  get phoneNumber(): string | undefined {
    return this.props.phoneNumber;
  }

  get createdAt(): Date {
    return this.props.createdAt;
  }

  get updatedAt(): Date {
    return this.props.updatedAt;
  }

  get isActive(): boolean {
    return this.props.isActive;
  }

  public updateWalletAddress(walletAddress: string): UserEntity {
    return new UserEntity({
      ...this.props,
      walletAddress,
      updatedAt: new Date(),
    });
  }

  public deactivate(): UserEntity {
    return new UserEntity({
      ...this.props,
      isActive: false,
      updatedAt: new Date(),
    });
  }

  public activate(): UserEntity {
    return new UserEntity({
      ...this.props,
      isActive: true,
      updatedAt: new Date(),
    });
  }

  public toJSON(): UserProps {
    return { ...this.props };
  }
}

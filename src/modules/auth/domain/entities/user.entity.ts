export interface UserProps {
  id: string;
  thirdwebId?: string; // Added for Thirdweb support
  walletAddress?: string; // Added for wallet-based authentication
  nickname?: string;
  avatarUrl?: string;
  experiments?: Record<string, any>;
  socialBluesky?: string;
  socialDiscord?: string;
  socialInstagram?: string;
  socialFarcaster?: string;
  socialTwitch?: string;
  socialYoutube?: string;
  socialX?: string;
  createdAt: Date;
  updatedAt: Date;
  isActive: boolean;
}

export class UserEntity {
  constructor(private readonly props: UserProps) {}

  get id(): string {
    return this.props.id;
  }
  get thirdwebId(): string | undefined {
    return this.props.thirdwebId;
  }
  get walletAddress(): string | undefined {
    return this.props.walletAddress;
  }

  get nickname(): string | undefined {
    return this.props.nickname;
  }

  get avatarUrl(): string | undefined {
    return this.props.avatarUrl;
  }

  get experiments(): Record<string, any> | undefined {
    return this.props.experiments;
  }

  get socialBluesky(): string | undefined {
    return this.props.socialBluesky;
  }

  get socialDiscord(): string | undefined {
    return this.props.socialDiscord;
  }

  get socialInstagram(): string | undefined {
    return this.props.socialInstagram;
  }

  get socialFarcaster(): string | undefined {
    return this.props.socialFarcaster;
  }

  get socialTwitch(): string | undefined {
    return this.props.socialTwitch;
  }

  get socialYoutube(): string | undefined {
    return this.props.socialYoutube;
  }

  get socialX(): string | undefined {
    return this.props.socialX;
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

  public updateNickname(nickname: string): UserEntity {
    return new UserEntity({
      ...this.props,
      nickname,
      updatedAt: new Date(),
    });
  }

  public updateAvatarUrl(avatarUrl: string): UserEntity {
    return new UserEntity({
      ...this.props,
      avatarUrl,
      updatedAt: new Date(),
    });
  }

  public updateExperiments(experiments: Record<string, any>): UserEntity {
    return new UserEntity({
      ...this.props,
      experiments,
      updatedAt: new Date(),
    });
  }

  public updateSocialLinks(
    socialLinks: Partial<{
      socialBluesky: string;
      socialDiscord: string;
      socialInstagram: string;
      socialFarcaster: string;
      socialTwitch: string;
      socialYoutube: string;
      socialX: string;
    }>,
  ): UserEntity {
    return new UserEntity({
      ...this.props,
      ...socialLinks,
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

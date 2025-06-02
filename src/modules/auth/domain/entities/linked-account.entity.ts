export interface LinkedAccountProps {
  owner: string;
  type: string;
  identifier: string;
  emailAddress?: string;
  label?: string;
  createdAt: Date;
  updatedAt: Date;
}

export class LinkedAccountEntity {
  constructor(private readonly props: LinkedAccountProps) {}

  get owner(): string {
    return this.props.owner;
  }

  get type(): string {
    return this.props.type;
  }

  get identifier(): string {
    return this.props.identifier;
  }

  get emailAddress(): string | undefined {
    return this.props.emailAddress;
  }

  get label(): string | undefined {
    return this.props.label;
  }

  get createdAt(): Date {
    return this.props.createdAt;
  }

  get updatedAt(): Date {
    return this.props.updatedAt;
  }

  public updateEmailAddress(emailAddress: string): LinkedAccountEntity {
    return new LinkedAccountEntity({
      ...this.props,
      emailAddress,
      updatedAt: new Date(),
    });
  }

  public updateLabel(label: string): LinkedAccountEntity {
    return new LinkedAccountEntity({
      ...this.props,
      label,
      updatedAt: new Date(),
    });
  }

  public toJSON(): LinkedAccountProps {
    return { ...this.props };
  }

  public static createWalletAccount(
    owner: string,
    walletAddress: string,
    label?: string,
  ): LinkedAccountEntity {
    return new LinkedAccountEntity({
      owner,
      type: 'wallet',
      identifier: walletAddress,
      label,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
  }

  public static createEmailAccount(
    owner: string,
    emailAddress: string,
  ): LinkedAccountEntity {
    return new LinkedAccountEntity({
      owner,
      type: 'email',
      identifier: emailAddress,
      emailAddress: emailAddress,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
  }

  public static createDiscordAccount(
    owner: string,
    discordId: string,
    label?: string,
  ): LinkedAccountEntity {
    return new LinkedAccountEntity({
      owner,
      type: 'discord',
      identifier: discordId,
      label,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
  }

  public static createGoogleAccount(
    owner: string,
    googleId: string,
    emailAddress?: string,
  ): LinkedAccountEntity {
    return new LinkedAccountEntity({
      owner,
      type: 'google',
      identifier: googleId,
      emailAddress,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
  }

  public static createPasskeyAccount(
    owner: string,
    passkeyId: string,
  ): LinkedAccountEntity {
    return new LinkedAccountEntity({
      owner,
      type: 'passkey',
      identifier: passkeyId,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
  }
}

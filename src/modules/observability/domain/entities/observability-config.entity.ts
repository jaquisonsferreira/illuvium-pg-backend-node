export class ObservabilityConfig {
  constructor(
    public readonly serviceName: string,
    public readonly serviceVersion: string,
    public readonly environment: string,
    public readonly sigNozEndpoint: string,
    public readonly sigNozToken?: string,
    public readonly enableDebugLogs: boolean = false,
    public readonly samplingRatio: number = 1.0,
    public readonly enabledInstrumentations: string[] = [],
    public readonly customAttributes: Record<string, string> = {},
  ) {
    this.validateConfig();
  }

  private validateConfig(): void {
    if (!this.serviceName || this.serviceName.trim().length === 0) {
      throw new Error(
        'Service name is required for observability configuration',
      );
    }

    if (!this.serviceVersion || this.serviceVersion.trim().length === 0) {
      throw new Error(
        'Service version is required for observability configuration',
      );
    }

    if (!this.sigNozEndpoint || this.sigNozEndpoint.trim().length === 0) {
      throw new Error(
        'SigNoz endpoint is required for observability configuration',
      );
    }

    if (this.samplingRatio < 0 || this.samplingRatio > 1) {
      throw new Error('Sampling ratio must be between 0 and 1');
    }
  }

  toTraceConfig(): Record<string, any> {
    return {
      serviceName: this.serviceName,
      serviceVersion: this.serviceVersion,
      environment: this.environment,
      endpoint: this.sigNozEndpoint,
      headers: this.sigNozToken
        ? { 'signoz-access-token': this.sigNozToken }
        : {},
      samplingRatio: this.samplingRatio,
      customAttributes: this.customAttributes,
    };
  }

  getInstrumentationConfig(): Record<string, any> {
    const config: Record<string, any> = {};

    this.enabledInstrumentations.forEach((instrumentation) => {
      config[instrumentation] = { enabled: true };
    });

    return config;
  }
}

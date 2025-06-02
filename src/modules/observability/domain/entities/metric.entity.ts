export enum MetricType {
  COUNTER = 'counter',
  GAUGE = 'gauge',
  HISTOGRAM = 'histogram',
  SUMMARY = 'summary',
}

export class Metric {
  constructor(
    public readonly name: string,
    public readonly type: MetricType,
    public readonly value: number,
    public readonly description?: string,
    public readonly unit?: string,
    public readonly labels: Record<string, string> = {},
    public readonly timestamp: number = Date.now(),
  ) {
    this.validateMetric();
  }

  private validateMetric(): void {
    if (!this.name || this.name.trim().length === 0) {
      throw new Error('Metric name is required');
    }

    if (!this.isValidMetricName(this.name)) {
      throw new Error(
        'Metric name must follow naming conventions (alphanumeric and underscores only)',
      );
    }

    if (typeof this.value !== 'number' || isNaN(this.value)) {
      throw new Error('Metric value must be a valid number');
    }

    if (this.type === MetricType.COUNTER && this.value < 0) {
      throw new Error('Counter metrics cannot have negative values');
    }
  }

  private isValidMetricName(name: string): boolean {
    const regex = /^[a-zA-Z][a-zA-Z0-9_]*$/;
    return regex.test(name);
  }

  withLabel(key: string, value: string): Metric {
    return new Metric(
      this.name,
      this.type,
      this.value,
      this.description,
      this.unit,
      { ...this.labels, [key]: value },
      this.timestamp,
    );
  }

  increment(amount: number = 1): Metric {
    if (this.type !== MetricType.COUNTER) {
      throw new Error('Only counter metrics can be incremented');
    }

    return new Metric(
      this.name,
      this.type,
      this.value + amount,
      this.description,
      this.unit,
      this.labels,
      Date.now(),
    );
  }

  setValue(newValue: number): Metric {
    if (this.type === MetricType.COUNTER && newValue < this.value) {
      throw new Error('Counter metrics cannot decrease');
    }

    return new Metric(
      this.name,
      this.type,
      newValue,
      this.description,
      this.unit,
      this.labels,
      Date.now(),
    );
  }

  toOpenTelemetryFormat(): Record<string, any> {
    return {
      name: this.name,
      type: this.type,
      value: this.value,
      description: this.description,
      unit: this.unit,
      labels: this.labels,
      timestamp: this.timestamp,
    };
  }
}

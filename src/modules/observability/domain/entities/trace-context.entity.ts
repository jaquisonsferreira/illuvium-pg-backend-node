export class TraceContext {
  constructor(
    public readonly traceId: string,
    public readonly spanId: string,
    public readonly parentSpanId?: string,
    public readonly operationName?: string,
    public readonly startTime: number = Date.now(),
    public readonly attributes: Record<string, any> = {},
    public readonly tags: Record<string, string> = {},
  ) {
    this.validateContext();
  }

  private validateContext(): void {
    if (!this.traceId || this.traceId.trim().length === 0) {
      throw new Error('Trace ID is required');
    }

    if (!this.spanId || this.spanId.trim().length === 0) {
      throw new Error('Span ID is required');
    }
  }

  addAttribute(key: string, value: any): TraceContext {
    return new TraceContext(
      this.traceId,
      this.spanId,
      this.parentSpanId,
      this.operationName,
      this.startTime,
      { ...this.attributes, [key]: value },
      this.tags,
    );
  }

  addTag(key: string, value: string): TraceContext {
    return new TraceContext(
      this.traceId,
      this.spanId,
      this.parentSpanId,
      this.operationName,
      this.startTime,
      this.attributes,
      { ...this.tags, [key]: value },
    );
  }

  withOperation(operationName: string): TraceContext {
    return new TraceContext(
      this.traceId,
      this.spanId,
      this.parentSpanId,
      operationName,
      this.startTime,
      this.attributes,
      this.tags,
    );
  }

  getDuration(): number {
    return Date.now() - this.startTime;
  }

  isValid(): boolean {
    return this.traceId.length > 0 && this.spanId.length > 0;
  }
}

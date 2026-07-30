/**
 * Primitive values supported by infrastructure serialization contracts.
 */
export type SerializablePrimitive = string | number | boolean | null;

/**
 * Recursive serializable value.
 */
export type SerializableValue =
  SerializablePrimitive | SerializableObject | readonly SerializableValue[];

/**
 * Serializable object shape.
 */
export interface SerializableObject {
  readonly [key: string]: SerializableValue;
}

/**
 * Utility type for creating nominally typed string identifiers.
 */
export type BrandedString<TBrand extends string> = string & {
  readonly __brand: TBrand;
};

/**
 * Generic infrastructure identifier.
 */
export type Identifier = BrandedString<'Identifier'>;

/**
 * Correlation identifier used for traceable operations.
 */
export type CorrelationId = BrandedString<'CorrelationId'>;

/**
 * Trace identifier used for distributed tracing.
 */
export type TraceId = BrandedString<'TraceId'>;

/**
 * Timestamp represented as an ISO 8601 string.
 */
export type TimestampString = BrandedString<'TimestampString'>;

/**
 * Creates a branded infrastructure identifier from a string.
 */
export function toIdentifier(value: string): Identifier {
  return value as Identifier;
}

/**
 * Creates a branded correlation identifier from a string.
 */
export function toCorrelationId(value: string): CorrelationId {
  return value as CorrelationId;
}

/**
 * Creates a branded trace identifier from a string.
 */
export function toTraceId(value: string): TraceId {
  return value as TraceId;
}

/**
 * Creates a branded timestamp string from a string.
 */
export function toTimestampString(value: string): TimestampString {
  return value as TimestampString;
}

/**
 * Factory contract for generating shared identifiers.
 */
export interface IIdFactory {
  create(namespace?: string): Identifier;
  createCorrelationId(): CorrelationId;
  createTraceId(): TraceId;
}

/**
 * Options for the default ID factory.
 */
export interface IdFactoryOptions {
  readonly seed?: number;
  readonly prefix?: string;
}

/**
 * Deterministic ID factory that remains provider-agnostic.
 */
export class DefaultIdFactory implements IIdFactory {
  private counter: number;
  private readonly prefix: string;

  public constructor(options: IdFactoryOptions = {}) {
    this.counter = options.seed ?? 0;
    this.prefix = options.prefix ?? 'id';
  }

  public create(namespace = 'default'): Identifier {
    this.counter += 1;
    const value = `${this.prefix}.${namespace}.${this.counter.toString(36)}`;
    return toIdentifier(value);
  }

  public createCorrelationId(): CorrelationId {
    return toCorrelationId(this.create('correlation'));
  }

  public createTraceId(): TraceId {
    return toTraceId(this.create('trace'));
  }
}

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
export declare function toIdentifier(value: string): Identifier;
/**
 * Creates a branded correlation identifier from a string.
 */
export declare function toCorrelationId(value: string): CorrelationId;
/**
 * Creates a branded trace identifier from a string.
 */
export declare function toTraceId(value: string): TraceId;
/**
 * Creates a branded timestamp string from a string.
 */
export declare function toTimestampString(value: string): TimestampString;
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
export declare class DefaultIdFactory implements IIdFactory {
  private counter;
  private readonly prefix;
  constructor(options?: IdFactoryOptions);
  create(namespace?: string): Identifier;
  createCorrelationId(): CorrelationId;
  createTraceId(): TraceId;
}
//# sourceMappingURL=primitives.d.ts.map

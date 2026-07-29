/**
 * Primitive values that can be serialized across service boundaries.
 */
export type SerializablePrimitive = string | number | boolean | null;

/**
 * Recursive serializable value used for kernel contracts.
 */
export type SerializableValue =
  SerializablePrimitive | SerializableValueObject | readonly SerializableValue[];

/**
 * Serializable object shape used for metadata and payloads.
 */
export interface SerializableValueObject {
  readonly [key: string]: SerializableValue;
}

/**
 * Unique identifier used throughout the kernel.
 */
export type Identifier = string;

/**
 * Correlation identifier used for request and event correlation.
 */
export type CorrelationId = string;

/**
 * ISO 8601 timestamp string.
 */
export type TimestampString = string;

/**
 * Semantic version string.
 */
export type VersionString = string;

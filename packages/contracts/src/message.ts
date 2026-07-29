import type {
  CorrelationId,
  Identifier,
  SerializableValueObject,
  TimestampString,
} from './primitives';

/**
 * Base contract for all data transfer objects.
 */
export interface BaseDto {
  readonly id: Identifier;
  readonly type: string;
  readonly createdAt: TimestampString;
}

/**
 * Envelope used to wrap DTO payloads for transport.
 */
export interface Envelope<T extends BaseDto = BaseDto> {
  readonly envelopeId: Identifier;
  readonly payload: T;
  readonly metadata?: SerializableValueObject;
  readonly timestamp: TimestampString;
}

/**
 * Standard response contract for kernel request handling.
 */
export interface Response<TPayload extends SerializableValueObject = SerializableValueObject> {
  readonly requestId: Identifier;
  readonly correlationId?: CorrelationId;
  readonly payload: TPayload;
  readonly succeeded: boolean;
  readonly code: string;
  readonly message?: string;
  readonly timestamp: TimestampString;
}

/**
 * Command contract for intent-driven interactions.
 */
export interface Command<
  TPayload extends SerializableValueObject = SerializableValueObject,
> extends BaseDto {
  readonly commandType: string;
  readonly payload: TPayload;
  readonly requestId: Identifier;
  readonly correlationId?: CorrelationId;
}

/**
 * Query contract for retrieval-oriented interactions.
 */
export interface Query<
  TPayload extends SerializableValueObject = SerializableValueObject,
> extends BaseDto {
  readonly queryType: string;
  readonly payload: TPayload;
  readonly requestId: Identifier;
  readonly correlationId?: CorrelationId;
}

/**
 * Event contract for state and lifecycle notifications.
 */
export interface Event<
  TPayload extends SerializableValueObject = SerializableValueObject,
> extends BaseDto {
  readonly eventType: string;
  readonly payload: TPayload;
  readonly correlationId?: CorrelationId;
  readonly source?: string;
}

/**
 * Generic message contract for kernel message exchange.
 */
export interface Message<
  TPayload extends SerializableValueObject = SerializableValueObject,
> extends BaseDto {
  readonly messageType: string;
  readonly payload: TPayload;
  readonly correlationId?: CorrelationId;
  readonly metadata?: SerializableValueObject;
}

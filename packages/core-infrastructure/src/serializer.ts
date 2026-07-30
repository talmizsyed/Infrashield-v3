import { createError, ErrorSeverity, type InfrastructureError } from './errors';
import { fail, ok, type Result } from './result';

/**
 * Generic serializer contract.
 */
export interface ISerializer {
  serialize<TValue>(value: TValue): string;
  deserialize<TValue>(value: string): TValue;
  safeSerialize<TValue>(value: TValue): Result<string, InfrastructureError>;
  safeDeserialize<TValue>(value: string): Result<TValue, InfrastructureError>;
}

/**
 * JSON serializer implementation.
 */
export class JsonSerializer implements ISerializer {
  public serialize<TValue>(value: TValue): string {
    return JSON.stringify(value);
  }

  public deserialize<TValue>(value: string): TValue {
    return JSON.parse(value) as TValue;
  }

  public safeSerialize<TValue>(value: TValue): Result<string, InfrastructureError> {
    try {
      return ok(this.serialize(value));
    } catch (cause) {
      return fail(
        createError({
          code: 'serializer.serialize_failed',
          message: 'Failed to serialize value.',
          severity: ErrorSeverity.Error,
          cause,
        }),
      );
    }
  }

  public safeDeserialize<TValue>(value: string): Result<TValue, InfrastructureError> {
    try {
      return ok(this.deserialize<TValue>(value));
    } catch (cause) {
      return fail(
        createError({
          code: 'serializer.deserialize_failed',
          message: 'Failed to deserialize value.',
          severity: ErrorSeverity.Error,
          cause,
          details: { value },
        }),
      );
    }
  }
}

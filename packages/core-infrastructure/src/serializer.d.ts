import { type InfrastructureError } from './errors';
import { type Result } from './result';
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
export declare class JsonSerializer implements ISerializer {
  serialize<TValue>(value: TValue): string;
  deserialize<TValue>(value: string): TValue;
  safeSerialize<TValue>(value: TValue): Result<string, InfrastructureError>;
  safeDeserialize<TValue>(value: string): Result<TValue, InfrastructureError>;
}
//# sourceMappingURL=serializer.d.ts.map

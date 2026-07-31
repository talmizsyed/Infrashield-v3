import { type InfrastructureError } from './errors';
import type { SerializableValue } from './primitives';
import { type Result } from './result';
/**
 * Configuration value shape.
 */
export type ConfigurationValue = SerializableValue;
/**
 * Configuration map shape.
 */
export type ConfigurationMap = Readonly<Record<string, ConfigurationValue>>;
/**
 * Generic configuration provider contract.
 */
export interface IConfigurationProvider {
  has(key: string): boolean;
  get<TValue extends ConfigurationValue>(key: string): TValue | undefined;
  getRequired<TValue extends ConfigurationValue>(key: string): Result<TValue, InfrastructureError>;
  snapshot(): ConfigurationMap;
}
/**
 * Configuration provider backed by an immutable in-memory map.
 */
export declare class StaticConfigurationProvider implements IConfigurationProvider {
  private readonly values;
  constructor(values: Record<string, ConfigurationValue>);
  has(key: string): boolean;
  get<TValue extends ConfigurationValue>(key: string): TValue | undefined;
  getRequired<TValue extends ConfigurationValue>(key: string): Result<TValue, InfrastructureError>;
  snapshot(): ConfigurationMap;
}
/**
 * Factory function for static configuration providers.
 */
export declare function createConfigurationProvider(
  values: Record<string, ConfigurationValue>,
): IConfigurationProvider;
//# sourceMappingURL=configuration.d.ts.map
